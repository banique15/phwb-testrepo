<script lang="ts">
	import type { ComponentType, SvelteComponent } from 'svelte'
	import { BarChart, ClipboardList, Calendar, CheckCircle, Users, Music } from 'lucide-svelte'
	import { createEventSchema, type Event, type CreateEvent, type UpdateEvent } from '$lib/schemas/event'
	import { eventsStore } from '$lib/stores/events'
	import UnifiedArtistAssignment from '$lib/components/UnifiedArtistAssignment.svelte'
	import ScheduleEditor from './ScheduleEditor.svelte'
	import RequirementsEditor from './RequirementsEditor.svelte'
	import StatusManager from './StatusManager.svelte'
	import FacilityLocationSelector from '$lib/components/ui/FacilityLocationSelector.svelte'
	import ProgramSelector from '$lib/components/ui/ProgramSelector.svelte'
	import ProductionManagerSelector from '$lib/components/ui/ProductionManagerSelector.svelte'
	import TimePicker from '$lib/components/ui/TimePicker.svelte'
	import CreateEnsemble from '../../ensembles/components/modals/CreateEnsemble.svelte'
	import type { Ensemble } from '$lib/schemas/ensemble'
	import type { LocationWithFacility } from '$lib/schemas/location'
	import { supabase } from '$lib/supabase'
	import { onMount } from 'svelte'
	import { generatePayrollForEvent } from '$lib/services/payroll-generator'
	import type { GeneratedPayrollEntry } from '$lib/schemas/rate-card'
	import type { ArtistAssignment } from '$lib/components/UnifiedArtistAssignment.svelte'
	
	interface Props {
		event?: Event | null
		isEdit?: boolean
		onSuccess?: () => void
		onCancel?: () => void
	}
	
	let { event = null, isEdit = false, onSuccess, onCancel }: Props = $props()
	
	// Form state
	let formData = $state({
		title: event?.title || '',
		date: event?.date || '',
		start_time: event?.start_time || '',
		end_time: event?.end_time || '',
		status: typeof event?.status === 'string' ? event.status : 'planned',
		notes: typeof event?.notes === 'string' ? event.notes : '',
		location_id: event?.location_id || undefined,
		program: event?.program || undefined,
		schedule: event?.schedule || null,
		requirements: event?.requirements || null,
		artist_assignments: (event?.artists?.assignments || []) as ArtistAssignment[],
		selected_artists: ((event?.artists?.assignments || []) as ArtistAssignment[]).map((a: ArtistAssignment) => a.artist_id),
		number_of_attendees: event?.number_of_attendees || undefined,
		number_of_musicians: event?.number_of_musicians || undefined,
		production_manager_artist_id: event?.production_manager_artist_id || null,
		production_manager_id: event?.production_manager_id || null
	})
	
	let loading = $state(false)
	let errors = $state<Record<string, string>>({})
	let submitError = $state('')
	
	// Ensemble state
	let ensembles = $state<(Ensemble & { member_count?: number })[]>([])
	let loadingEnsembles = $state(true)
	let selectedEnsembleId = $state<string | null>(null)
	let isCreateEnsembleModalOpen = $state(false)
	let assigningEnsemble = $state(false)
	let newlyCreatedFacilityId = $state<number | null>(null)
	let selectedLocation = $state<LocationWithFacility | null>(null)
	let locationSelectorRef: any = $state(null)
	let showPayrollReviewModal = $state(false)
	let payrollPreviewLoading = $state(false)
	let payrollPreviewEntries = $state<GeneratedPayrollEntry[]>([])
	
	const statusOptions = [
		{ value: 'planned', label: 'Planned' },
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' },
		{ value: 'draft', label: 'Draft' }
	]

	onMount(async () => {
		await loadEnsembles()
		// Check if event already has artists that match an ensemble
		if (event && formData.artist_assignments && formData.artist_assignments.length > 0) {
			await detectEnsembleFromArtists()
		}
	})

	async function loadEnsembles() {
		try {
			// First get all active ensembles
			const { data: ensembleData, error: ensembleError } = await supabase
				.from('phwb_ensembles')
				.select('*')
				.eq('status', 'active')
				.order('name')

			if (ensembleError) throw ensembleError

			// Then get member counts for each ensemble
			const ensemblesWithCounts = await Promise.all(
				(ensembleData || []).map(async (ensemble) => {
					const { count, error: countError } = await supabase
						.from('phwb_ensemble_members')
						.select('*', { count: 'exact', head: true })
						.eq('ensemble_id', ensemble.id)
						.eq('is_active', true)

					return {
						...ensemble,
						member_count: countError ? 0 : (count || 0)
					}
				})
			)

			ensembles = ensemblesWithCounts
		} catch (err) {
			console.error('Failed to load ensembles:', err)
		} finally {
			loadingEnsembles = false
		}
	}

	async function detectEnsembleFromArtists() {
		// Try to find if the current artists match an ensemble
		if (!formData.artist_assignments || formData.artist_assignments.length === 0) return

		const currentArtistIds = new Set(formData.artist_assignments.map((a: ArtistAssignment) => a.artist_id))

		for (const ensemble of ensembles) {
			const { data: members } = await supabase
				.from('phwb_ensemble_members')
				.select('artist_id')
				.eq('ensemble_id', ensemble.id)
				.eq('is_active', true)

			if (members && members.length > 0) {
				const ensembleArtistIds = new Set(members.map(m => m.artist_id))
				// Check if all ensemble members are in the current artist list
				const allMembersPresent = Array.from(ensembleArtistIds).every(id => currentArtistIds.has(id))
				// Check if all current artists are in the ensemble
				const allArtistsInEnsemble = Array.from(currentArtistIds).every(id => ensembleArtistIds.has(id))

				if (allMembersPresent && allArtistsInEnsemble && ensemble.id) {
					selectedEnsembleId = ensemble.id
					break
				}
			}
		}
	}

	function normalizeAssignmentsWithSingleBandleader(assignments: ArtistAssignment[]): ArtistAssignment[] {
		let sawLeader = false
		return (assignments || []).map((assignment) => {
			if (assignment?.is_bandleader && !sawLeader) {
				sawLeader = true
				return { ...assignment, is_bandleader: true }
			}
			return { ...assignment, is_bandleader: false }
		})
	}

	function getCurrentBandleaderArtistId(assignments: ArtistAssignment[]): string | null {
		return assignments.find((assignment) => assignment.is_bandleader)?.artist_id || null
	}

	function setBandleader(artistId: string) {
		formData.artist_assignments = (formData.artist_assignments || []).map((assignment: ArtistAssignment) => ({
			...assignment,
			is_bandleader: assignment.artist_id === artistId
		}))
	}

	async function assignEnsemble(ensembleId: string) {
		if (assigningEnsemble) return
		
		assigningEnsemble = true
		selectedEnsembleId = ensembleId
		
		try {
			// Get ensemble name
			const ensemble = ensembles.find(e => e.id === ensembleId)
			const ensembleName = ensemble?.name || 'Unknown Ensemble'
			
			// Fetch active ensemble members with artist data
			const { data: members, error: membersError } = await supabase
				.from('phwb_ensemble_members')
				.select('artist_id, role, phwb_artists(id, full_name, artist_name, is_bandleader)')
				.eq('ensemble_id', ensembleId)
				.eq('is_active', true)

			if (membersError) {
				console.error('Failed to fetch ensemble members:', membersError)
				submitError = 'Failed to load ensemble members'
				return
			}

			if (members && members.length > 0) {
				const currentLeaderId = getCurrentBandleaderArtistId(formData.artist_assignments)
				const memberIds = new Set(members.map((member: any) => member.artist_id))
				let preselectedLeaderId: string | null = null
				if (ensemble?.leader_id && memberIds.has(ensemble.leader_id)) {
					preselectedLeaderId = ensemble.leader_id
				} else {
					const taggedMembers = members.filter((member: any) => !!member?.phwb_artists?.is_bandleader)
					if (taggedMembers.length === 1) {
						preselectedLeaderId = taggedMembers[0].artist_id
					}
				}

				// Create assignments for all ensemble members with ensemble metadata
				const newAssignments = members.map((member: any) => {
					const artist = member.phwb_artists
					return {
						artist_id: member.artist_id,
						artist_name: artist?.full_name || artist?.artist_name || 'Unknown',
						role: member.role || 'Ensemble Member',
						status: 'pending' as const,
						num_hours: 0,
						hourly_rate: 0,
						notes: '',
						ensemble_id: ensembleId,
						ensemble_name: ensembleName,
						is_bandleader: !currentLeaderId && preselectedLeaderId === member.artist_id
					}
				})

				// Merge with existing assignments, avoiding duplicates
				const existingArtistIds = new Set(formData.artist_assignments.map((a: ArtistAssignment) => a.artist_id))
				const uniqueNewAssignments = newAssignments.filter((a: ArtistAssignment) => !existingArtistIds.has(a.artist_id))
				
				formData.artist_assignments = normalizeAssignmentsWithSingleBandleader([
					...formData.artist_assignments,
					...uniqueNewAssignments
				])
				formData.selected_artists = formData.artist_assignments.map((a: ArtistAssignment) => a.artist_id)
				
				// Trigger update handlers
				handleArtistAssignmentsUpdate(formData.artist_assignments)
			}
		} catch (err) {
			console.error('Error assigning ensemble:', err)
			submitError = 'Failed to assign ensemble members'
		} finally {
			assigningEnsemble = false
		}
	}

	function clearEnsembleSelection() {
		selectedEnsembleId = null
	}

	function handleEnsembleCreated(event: CustomEvent<{ ensemble: any }>) {
		const newEnsemble = event.detail.ensemble
		// Refresh ensembles list
		loadEnsembles()
		// Optionally auto-select the newly created ensemble
		if (newEnsemble?.id) {
			assignEnsemble(newEnsemble.id)
		}
		isCreateEnsembleModalOpen = false
	}


	let selectedEnsemble = $derived.by(() => {
		if (!selectedEnsembleId) return null
		return ensembles.find(e => e.id === selectedEnsembleId) || null
	})
	
	function validateForm() {
		errors = {}
		
		try {
			if (isEdit) {
				// For edit, allow partial validation
				const partialData = Object.fromEntries(
					Object.entries(formData).filter(([_, value]) => value !== '' && value !== undefined)
				)
				createEventSchema.partial().parse(partialData)
			} else {
				// For create, require all fields
				createEventSchema.parse(formData)
			}
			return true
		} catch (error: any) {
			if (error.errors) {
				error.errors.forEach((err: any) => {
					errors[err.path[0]] = err.message
				})
			}
			return false
		}
	}
	
	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault()
		
		if (!validateForm()) return
		
		loading = true
		submitError = ''
		
		try {
			// Transform artist_assignments to artists.assignments format for database
			const dataToSave: any = { ...formData }
			
			// Ensure status and notes are strings
			if (typeof dataToSave.status !== 'string') {
				dataToSave.status = 'planned'
			}
			if (typeof dataToSave.notes !== 'string') {
				dataToSave.notes = ''
			}
			
			// Convert times to HH:MM format if they include seconds
			if (dataToSave.start_time && dataToSave.start_time.includes(':')) {
				dataToSave.start_time = dataToSave.start_time.substring(0, 5) // HH:MM
			}
			if (dataToSave.end_time && dataToSave.end_time.includes(':')) {
				dataToSave.end_time = dataToSave.end_time.substring(0, 5) // HH:MM
			}
			
			if (dataToSave.artist_assignments && dataToSave.artist_assignments.length > 0) {
				dataToSave.artist_assignments = normalizeAssignmentsWithSingleBandleader(
					dataToSave.artist_assignments as ArtistAssignment[]
				)
				// Convert proxy arrays to plain objects for JSON serialization
				dataToSave.artists = {
					assignments: JSON.parse(JSON.stringify(dataToSave.artist_assignments))
				}
			}
			// Remove the temporary artist_assignments field
			delete dataToSave.artist_assignments
			delete dataToSave.selected_artists
			
			if (isEdit && event) {
				// Update existing event
				const updateData: UpdateEvent = {}
				
				// Only include fields that have actual values, but handle different types properly
				Object.entries(dataToSave).forEach(([key, value]) => {
					if (value !== '' && value !== undefined && value !== null) {
						// Convert any proxy objects to plain objects for JSON serialization
						if (typeof value === 'object' && value !== null) {
							updateData[key as keyof UpdateEvent] = JSON.parse(JSON.stringify(value))
						} else {
							updateData[key as keyof UpdateEvent] = value
						}
					}
				})
				
				console.log('EventForm: Sending update data:', updateData)
				await eventsStore.enhanced.update(event.id!, updateData)
			} else {
				// Create new event
				await eventsStore.create(dataToSave as CreateEvent)
			}
			
			onSuccess?.()
		} catch (error: any) {
			submitError = error.message || 'Failed to save event'
		} finally {
			loading = false
		}
	}
	
	function resetForm() {
		formData = {
			title: event?.title || '',
			date: event?.date || '',
			start_time: event?.start_time || '',
			end_time: event?.end_time || '',
			status: typeof event?.status === 'string' ? event.status : 'planned',
			notes: typeof event?.notes === 'string' ? event.notes : '',
			location_id: event?.location_id || undefined,
			program: event?.program || undefined,
			schedule: event?.schedule || null,
			requirements: event?.requirements || null,
			artist_assignments: (event?.artists?.assignments || []) as ArtistAssignment[],
			selected_artists: ((event?.artists?.assignments || []) as ArtistAssignment[]).map((a: ArtistAssignment) => a.artist_id),
			number_of_attendees: event?.number_of_attendees || undefined,
			number_of_musicians: event?.number_of_musicians || undefined,
			production_manager_artist_id: event?.production_manager_artist_id || null,
			production_manager_id: event?.production_manager_id || null
		}
		errors = {}
		submitError = ''
	}
	
	// Tab management
	let activeTab = $state('basic')
	const tabs: Array<{ id: string; label: string; icon: ComponentType<SvelteComponent> }> = [
		{ id: 'basic', label: 'Basic Info', icon: ClipboardList },
		{ id: 'schedule', label: 'Schedule', icon: Calendar },
		{ id: 'requirements', label: 'Requirements', icon: CheckCircle },
		{ id: 'artists', label: 'Artists', icon: Users },
		{ id: 'status', label: 'Status', icon: BarChart }
	]
	
	// Handle advanced component updates
	function handleScheduleUpdate(schedule: any) {
		formData.schedule = schedule
	}
	
	function handleRequirementsUpdate(requirements: any) {
		formData.requirements = requirements
	}
	
	// Check if a title looks auto-generated (so we can safely regenerate it)
	function isAutoGeneratedTitle(title: string): boolean {
		if (!title) return true
		if (title === 'Draft Event') return true
		if (title.startsWith('Draft Event -') || title.startsWith('Draft Event @')) return true
		if (title.startsWith('Event -') || title.startsWith('Event @')) return true
		// Matches patterns like "Artist - Facility" or "Artist1 & Artist2 - Facility"
		if (/^.+ - .+$/.test(title) || /^.+ @ .+$/.test(title)) return true
		return false
	}

	// Regenerate the title based on current artists and facility
	function regenerateTitle(assignments: any[]) {
		const facilityName = (event as any)?.facility_name || selectedLocation?.facility?.name || ''
		const locationDisplay = facilityName || 'Unknown Facility'
		const artistNames = assignments
			.map((a: any) => a.artist_name)
			.filter((name: string) => name && name !== 'Unknown')

		if (artistNames.length === 0) {
			formData.title = formData.status === 'draft' 
				? (facilityName ? `Draft Event - ${facilityName}` : 'Draft Event')
				: `Event - ${locationDisplay}`
		} else if (artistNames.length === 1) {
			formData.title = `${artistNames[0]} - ${locationDisplay}`
		} else if (artistNames.length === 2) {
			formData.title = `${artistNames[0]} & ${artistNames[1]} - ${locationDisplay}`
		} else {
			formData.title = `${artistNames[0]} +${artistNames.length - 1} - ${locationDisplay}`
		}
	}

	function handleArtistAssignmentsUpdate(assignments: any[]) {
		const normalizedAssignments = normalizeAssignmentsWithSingleBandleader(assignments as ArtistAssignment[])
		formData.artist_assignments = normalizedAssignments
		formData.selected_artists = normalizedAssignments.map((a: ArtistAssignment) => a.artist_id)
		
		// Auto-regenerate title if it looks auto-generated
		if (isAutoGeneratedTitle(formData.title)) {
			regenerateTitle(normalizedAssignments)
		}
	}
	
	async function handleStatusChange(newStatus: string, options?: { reviewPayroll?: boolean }) {
		formData.status = newStatus as Event['status']
		// Auto-save status changes if editing
		if (isEdit && event?.id) {
			try {
				if (newStatus === 'completed' && options?.reviewPayroll) {
					payrollPreviewLoading = true
					const preview = await generatePayrollForEvent(event.id, { dryRun: true })
					payrollPreviewEntries = preview.entries.map((entry) => ({ ...entry }))
					showPayrollReviewModal = true
					return
				}
				await eventsStore.update(event.id, { status: newStatus as Event['status'] })
			} catch (error) {
				console.error('Failed to update status:', error)
			} finally {
				payrollPreviewLoading = false
			}
		}
	}

	function updatePreviewEntry(index: number, field: 'hours' | 'rate' | 'additional_pay', value: number) {
		const next = [...payrollPreviewEntries]
		const current = { ...next[index] }
		current[field] = value
		current.total_pay = Number((current.hours * current.rate + current.additional_pay).toFixed(2))
		next[index] = current
		payrollPreviewEntries = next
	}

	async function confirmPayrollReviewAndComplete() {
		if (!event?.id) return
		payrollPreviewLoading = true
		try {
			await eventsStore.update(event.id, {
				status: 'completed',
				__reviewedPayrollEntries: payrollPreviewEntries
			} as any)
			showPayrollReviewModal = false
		} catch (error) {
			console.error('Failed to complete event with reviewed payroll:', error)
		} finally {
			payrollPreviewLoading = false
		}
	}

	async function handleSaveDraft() {
		loading = true
		submitError = ''
		
		try {
			// Deep clone formData to avoid reactive proxy issues
			const dataToSave: any = JSON.parse(JSON.stringify({
				title: formData.title || '',
				date: formData.date || '',
				start_time: formData.start_time || '',
				end_time: formData.end_time || '',
				status: 'draft',
				notes: typeof formData.notes === 'string' ? formData.notes : '',
				location_id: formData.location_id,
				program: formData.program,
				schedule: formData.schedule,
				requirements: formData.requirements,
				number_of_attendees: formData.number_of_attendees,
				number_of_musicians: formData.number_of_musicians,
				production_manager_artist_id: formData.production_manager_artist_id,
				production_manager_id: formData.production_manager_id
			}))
			
			// Handle artist assignments - ensure it's always an array
			const artistAssignments = Array.isArray(formData.artist_assignments) 
				? formData.artist_assignments 
				: []
			
			if (artistAssignments.length > 0) {
				// Convert to plain objects for JSON serialization
				dataToSave.artists = {
					assignments: JSON.parse(JSON.stringify(artistAssignments))
				}
			}
			
			// Convert times to HH:MM format if they include seconds
			if (dataToSave.start_time && typeof dataToSave.start_time === 'string' && dataToSave.start_time.includes(':')) {
				dataToSave.start_time = dataToSave.start_time.substring(0, 5) // HH:MM
			}
			if (dataToSave.end_time && typeof dataToSave.end_time === 'string' && dataToSave.end_time.includes(':')) {
				dataToSave.end_time = dataToSave.end_time.substring(0, 5) // HH:MM
			}
			
			// For drafts, we allow minimal data - only require date if creating new
			// Generate a default title if missing
			if (!dataToSave.title && !isEdit) {
				dataToSave.title = 'Draft Event'
			}
			
			// Ensure date exists for new drafts
			if (!dataToSave.date && !isEdit) {
				dataToSave.date = new Date().toISOString().split('T')[0]
			}
			
			// Clean up empty strings - convert to undefined for optional fields
			if (dataToSave.start_time === '') delete dataToSave.start_time
			if (dataToSave.end_time === '') delete dataToSave.end_time
			if (dataToSave.notes === '') delete dataToSave.notes
			
			if (isEdit && event) {
				// Update existing event as draft
				const updateData: UpdateEvent = {}
				
				// Include all fields that have values
				Object.entries(dataToSave).forEach(([key, value]) => {
					if (value !== '' && value !== undefined && value !== null) {
						updateData[key as keyof UpdateEvent] = value as any
					}
				})
				
				// Always set status to draft
				updateData.status = 'draft'
				
				console.log('EventForm: Saving draft with data:', updateData)
				await eventsStore.enhanced.update(event.id!, updateData)
			} else {
				// Create new event as draft
				await eventsStore.create(dataToSave as CreateEvent)
			}
			
			onSuccess?.()
		} catch (error: any) {
			console.error('Error saving draft:', error)
			submitError = error.message || 'Failed to save draft'
		} finally {
			loading = false
		}
	}
</script>

<div class="space-y-4">
	{#if submitError}
		<div class="alert alert-error">
			<span>{submitError}</span>
		</div>
	{/if}
	
	<!-- Tab Navigation -->
	<div class="tabs tabs-boxed">
		{#each tabs as tab}
			<button
				type="button"
				class="tab {activeTab === tab.id ? 'tab-active' : ''}"
				onclick={() => activeTab = tab.id}
			>
				<svelte:component this={tab.icon} class="w-4 h-4 mr-2" />
				{tab.label}
			</button>
		{/each}
	</div>
	
	<form onsubmit={handleSubmit} class="space-y-4">
		{#if activeTab === 'basic'}
			<!-- Basic Info Tab -->
			<div class="space-y-4">
				<!-- Event Title -->
				<div class="form-control">
					<label class="label" for="title">
						<span class="label-text">Event Title *</span>
					</label>
					<input
						id="title"
						type="text"
						bind:value={formData.title}
						class="input input-bordered {errors.title ? 'input-error' : ''}"
						placeholder="Enter event title"
						required
					/>
					{#if errors.title}
						<label class="label">
							<span class="label-text-alt text-error">{errors.title}</span>
						</label>
					{/if}
				</div>
				
				<!-- Date, Time, and Attendees Row -->
				<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
					<!-- Date -->
					<div class="form-control">
						<label class="label" for="date">
							<span class="label-text">Date *</span>
						</label>
						<input
							id="date"
							type="date"
							bind:value={formData.date}
							class="input input-bordered {errors.date ? 'input-error' : ''}"
							required
						/>
						{#if errors.date}
							<label class="label">
								<span class="label-text-alt text-error">{errors.date}</span>
							</label>
						{/if}
					</div>
					
					<!-- Start Time -->
					<div class="form-control">
						<label class="label" for="start_time">
							<span class="label-text">Start Time</span>
						</label>
						<TimePicker
							bind:value={formData.start_time}
							error={!!errors.start_time}
						/>
						{#if errors.start_time}
							<label class="label">
								<span class="label-text-alt text-error">{errors.start_time}</span>
							</label>
						{/if}
					</div>
					
					<!-- End Time -->
					<div class="form-control">
						<label class="label" for="end_time">
							<span class="label-text">End Time</span>
						</label>
					<TimePicker
						bind:value={formData.end_time}
						error={!!errors.end_time}
						defaultPeriod="PM"
					/>
						{#if errors.end_time}
							<label class="label">
								<span class="label-text-alt text-error">{errors.end_time}</span>
							</label>
						{/if}
					</div>

					<!-- Number of Attendees -->
					<div class="form-control">
						<label class="label" for="number_of_attendees">
							<span class="label-text">Number of Attendees</span>
						</label>
						<input
							id="number_of_attendees"
							type="number"
							bind:value={formData.number_of_attendees}
							class="input input-bordered {errors.number_of_attendees ? 'input-error' : ''}"
							placeholder="Enter number of attendees"
							min="0"
							step="1"
						/>
						{#if errors.number_of_attendees}
							<label class="label">
								<span class="label-text-alt text-error">{errors.number_of_attendees}</span>
							</label>
						{/if}
					</div>
					<!-- Number of Artists/Musicians -->
					<div class="form-control">
						<label class="label" for="number_of_musicians">
							<span class="label-text">Number of Artists/Musicians</span>
						</label>
						<input
							id="number_of_musicians"
							type="number"
							bind:value={formData.number_of_musicians}
							class="input input-bordered {errors.number_of_musicians ? 'input-error' : ''}"
							placeholder="Enter number of artists/musicians performing"
							min="0"
							step="1"
						/>
						{#if errors.number_of_musicians}
							<label class="label">
								<span class="label-text-alt text-error">{errors.number_of_musicians}</span>
							</label>
						{/if}
					</div>
				</div>

				<!-- Status and References Row -->
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<!-- Status -->
					<div class="form-control">
						<label class="label" for="status">
							<span class="label-text">Status</span>
						</label>
						<select
							id="status"
							bind:value={formData.status}
							class="select select-bordered {errors.status ? 'select-error' : ''}"
						>
							{#each statusOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
						{#if errors.status}
							<label class="label">
								<span class="label-text-alt text-error">{errors.status}</span>
							</label>
						{/if}
					</div>
					
					<!-- Location -->
					<div class="form-control">
						<FacilityLocationSelector
							bind:this={locationSelectorRef}
							value={formData.location_id}
							placeholder="Select facility and location"
							error={errors.location_id}
							onchange={(locationId, location) => {
								formData.location_id = locationId ?? undefined
								selectedLocation = location ? { ...location, facility: undefined } as LocationWithFacility : null
							}}
						/>
					</div>
					
					<!-- Program -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Program</span>
						</label>
						<ProgramSelector
							value={formData.program}
							placeholder="Search for a program..."
							error={errors.program}
							onchange={(e) => formData.program = e.detail.value}
						/>
					</div>
				</div>

				<!-- Production Manager (artist with is_production_manager) -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Production Manager</span>
					</label>
					<ProductionManagerSelector
						value={formData.production_manager_id}
						placeholder="Select a production manager (optional)"
						disabled={loading}
						onchange={(productionManagerId, productionManager) => {
							formData.production_manager_id = productionManagerId
							formData.production_manager_artist_id = productionManager?.artist_id ?? null
						}}
					/>
				</div>
				
				<!-- Notes -->
				<div class="form-control">
					<label class="label" for="notes">
						<span class="label-text">Notes</span>
					</label>
					<textarea
						id="notes"
						bind:value={formData.notes}
						class="textarea textarea-bordered {errors.notes ? 'textarea-error' : ''}"
						placeholder="Additional notes or details..."
						rows="3"
					></textarea>
					{#if errors.notes}
						<label class="label">
							<span class="label-text-alt text-error">{errors.notes}</span>
						</label>
					{/if}
				</div>
			</div>
		{:else if activeTab === 'schedule'}
			<!-- Schedule Tab -->
			<ScheduleEditor 
				schedule={formData.schedule}
				onUpdate={handleScheduleUpdate}
			/>
		{:else if activeTab === 'requirements'}
			<!-- Requirements Tab -->
			<RequirementsEditor 
				requirements={formData.requirements}
				onUpdate={handleRequirementsUpdate}
			/>
		{:else if activeTab === 'artists'}
			<!-- Artists Tab -->
			<div class="space-y-4">
				<!-- Ensemble Selector -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Ensemble (Optional)</span>
					</label>
					<div class="flex gap-2">
						<select
							bind:value={selectedEnsembleId}
							class="select select-bordered flex-1"
							disabled={loading || loadingEnsembles || assigningEnsemble}
							onchange={(e) => {
								const value = (e.target as HTMLSelectElement).value
								if (value) {
									assignEnsemble(value)
								} else {
									clearEnsembleSelection()
								}
							}}
						>
							<option value={null}>Select an ensemble...</option>
							{#each ensembles as ensemble}
								<option value={ensemble.id}>
									{ensemble.name} {ensemble.member_count ? `(${ensemble.member_count} members)` : ''}
								</option>
							{/each}
						</select>
						<button
							type="button"
							class="btn btn-outline"
							onclick={() => isCreateEnsembleModalOpen = true}
							disabled={loading}
						>
							<Music class="w-4 h-4 mr-1" />
							Create New
						</button>
					</div>
					{#if selectedEnsemble}
						<label class="label">
							<span class="label-text-alt text-info">
								Selected: {selectedEnsemble.name} ({selectedEnsemble.member_count || 0} members)
							</span>
						</label>
					{/if}
					{#if loadingEnsembles}
						<label class="label">
							<span class="label-text-alt">Loading ensembles...</span>
						</label>
					{/if}
				</div>

				<UnifiedArtistAssignment
					assignments={formData.artist_assignments}
					onAssignmentsUpdate={handleArtistAssignmentsUpdate}
					mode={isEdit ? 'edit' : 'create'}
					readonly={false}
					eventStartTime={formData.start_time}
					eventEndTime={formData.end_time}
				/>

				{#if formData.artist_assignments.length > 0}
					<div class="border border-base-300 rounded-lg p-3 space-y-2">
						<div class="flex items-center justify-between gap-2">
							<h4 class="font-semibold text-sm">Bandleader</h4>
							<span class="text-xs text-base-content/70">One leader per event</span>
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
							{#each formData.artist_assignments as assignment}
								<label class="label cursor-pointer justify-start gap-3 px-2 py-1 rounded hover:bg-base-200">
									<input
										type="radio"
										name="event-form-bandleader"
										class="radio radio-sm radio-primary"
										checked={assignment.is_bandleader === true}
										onchange={() => setBandleader(assignment.artist_id)}
									/>
									<span class="label-text">{assignment.artist_name || 'Unknown Artist'}</span>
								</label>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{:else if activeTab === 'status'}
			<!-- Status Tab -->
			{#if event}
				<StatusManager 
					event={event}
					onStatusChange={handleStatusChange}
				/>
			{:else}
				<div class="text-center py-8 bg-base-200 rounded-lg">
					<BarChart class="w-16 h-16 mx-auto text-base-content/70" />
					<p class="mt-2 text-lg">Status Management</p>
					<p class="text-sm opacity-60">
						Status management is available after creating the event
					</p>
				</div>
			{/if}
		{/if}
		
		<!-- Form Actions -->
		<div class="flex justify-end gap-2 pt-4">
			<button
				type="button"
				class="btn btn-outline"
				onclick={onCancel}
				disabled={loading}
			>
				Cancel
			</button>
			<button
				type="button"
				class="btn btn-outline"
				onclick={resetForm}
				disabled={loading}
			>
				Reset
			</button>
			<button
				type="button"
				class="btn btn-ghost"
				onclick={handleSaveDraft}
				disabled={loading}
			>
				{#if loading}
					<span class="loading loading-spinner loading-sm"></span>
				{/if}
				Save as Draft
			</button>
			<button
				type="submit"
				class="btn btn-primary"
				disabled={loading}
			>
				{#if loading}
					<span class="loading loading-spinner loading-sm"></span>
				{/if}
				{isEdit ? 'Update Event' : 'Create Event'}
			</button>
		</div>
	</form>

	<!-- Create Ensemble Modal -->
	<CreateEnsemble
		open={isCreateEnsembleModalOpen}
		on:close={() => isCreateEnsembleModalOpen = false}
		on:success={handleEnsembleCreated}
	/>

	{#if showPayrollReviewModal}
		<div class="modal modal-open">
			<div class="modal-box max-w-5xl">
				<h3 class="font-bold text-lg">Review Payroll Before Completion</h3>
				<p class="text-sm opacity-70 mt-1">Adjust entries as needed before payroll is generated for this completed event.</p>
				<div class="overflow-x-auto mt-4 max-h-[50vh]">
					<table class="table table-sm">
						<thead>
							<tr>
								<th>Payee</th>
								<th>Hours</th>
								<th>Rate</th>
								<th>Additional</th>
								<th>Total</th>
							</tr>
						</thead>
						<tbody>
							{#each payrollPreviewEntries as entry, index}
								<tr>
									<td>
										{entry.payee_name || entry.artist_name}
										{#if entry.is_production_manager}
											<span class="badge badge-secondary badge-xs ml-2">PM</span>
										{/if}
									</td>
									<td>
										<input
											type="number"
											class="input input-bordered input-xs w-24"
											value={entry.hours}
											min="0"
											step="0.25"
											oninput={(e) => updatePreviewEntry(index, 'hours', Number(e.currentTarget.value))}
										/>
									</td>
									<td>
										<input
											type="number"
											class="input input-bordered input-xs w-24"
											value={entry.rate}
											min="0"
											step="0.01"
											oninput={(e) => updatePreviewEntry(index, 'rate', Number(e.currentTarget.value))}
										/>
									</td>
									<td>
										<input
											type="number"
											class="input input-bordered input-xs w-24"
											value={entry.additional_pay}
											min="0"
											step="0.01"
											oninput={(e) => updatePreviewEntry(index, 'additional_pay', Number(e.currentTarget.value))}
										/>
									</td>
									<td>${entry.total_pay.toFixed(2)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="modal-action">
					<button class="btn btn-ghost" onclick={() => showPayrollReviewModal = false} disabled={payrollPreviewLoading}>Cancel</button>
					<button class="btn btn-primary" onclick={confirmPayrollReviewAndComplete} disabled={payrollPreviewLoading}>
						{#if payrollPreviewLoading}<span class="loading loading-spinner loading-sm"></span>{/if}
						Complete Event & Generate Payroll
					</button>
				</div>
			</div>
		</div>
	{/if}

</div>