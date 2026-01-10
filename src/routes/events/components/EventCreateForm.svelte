<script lang="ts">
	import { Lightbulb, HelpCircle, X } from 'lucide-svelte'
	import { eventsStore } from '$lib/stores/events'
	import { onMount } from 'svelte'
	import type { Program } from '$lib/schemas/program'
	import type { LocationWithFacility } from '$lib/schemas/location'
	import { supabase } from '$lib/supabase'
	import type { EnhancedEvent } from '$lib/stores/events'
	import 'driver.js/dist/driver.css'
	import { startCreateEventTour } from '$lib/tours/createEventTour'
	import FacilityLocationSelector from '$lib/components/ui/FacilityLocationSelector.svelte'
	import CreateFacility from '../../facilities/components/modals/CreateFacility.svelte'
	import CreateLocation from '../../facilities/components/modals/CreateLocation.svelte'
	import UnifiedArtistAssignment, { type ArtistAssignment } from '$lib/components/UnifiedArtistAssignment.svelte'
	import { Plus } from 'lucide-svelte'

	interface Props {
		onSuccess?: (createdEvent?: EnhancedEvent) => void
		onCancel?: () => void
		initialDate?: string
		initialTime?: string
	}

	let { onSuccess, onCancel, initialDate, initialTime }: Props = $props()

	// Form state
	let title = $state('')
	let date = $state(initialDate || new Date().toISOString().split('T')[0])
	let startTime = $state(initialTime || '')
	let endTime = $state('')
	let status = $state('planned')
	let locationId = $state<number | null>(null)
	let selectedLocation = $state<LocationWithFacility | null>(null)
	let programId = $state<number | null>(null)
	let artistAssignments = $state<ArtistAssignment[]>([])

	// Data state
	let programs = $state<Program[]>([])
	let loadingPrograms = $state(true)

	// UI state
	let submitting = $state(false)
	let error = $state<string | null>(null)
	let isCreateFacilityModalOpen = $state(false)
	let isCreateLocationModalOpen = $state(false)
	let newlyCreatedFacilityId = $state<number | null>(null)
	let locationSelectorRef: any = $state(null)

	const statusOptions = [
		{ value: 'planned', label: 'Planned' },
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' },
		{ value: 'draft', label: 'Draft' }
	]

	// Calculate minimum end time based on start time
	let minEndTime = $derived.by(() => {
		if (!startTime) return ''
		// If start time is set, end time must be at least 1 minute after
		const [hours, minutes] = startTime.split(':').map(Number)
		const startDate = new Date()
		startDate.setHours(hours, minutes, 0, 0)
		startDate.setMinutes(startDate.getMinutes() + 1)
		return `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`
	})

	// Validate that end time is after start time
	let timeError = $derived.by(() => {
		if (!startTime || !endTime) return null
		const [startHours, startMinutes] = startTime.split(':').map(Number)
		const [endHours, endMinutes] = endTime.split(':').map(Number)
		const startTotal = startHours * 60 + startMinutes
		const endTotal = endHours * 60 + endMinutes
		if (endTotal <= startTotal) {
			return 'End time must be after start time'
		}
		return null
	})

	onMount(async () => {
		await loadPrograms()
	})

	async function loadPrograms() {
		try {
			const { data, error: supabaseError } = await supabase
				.from('phwb_programs')
				.select('*')
				.order('title')

			if (supabaseError) throw supabaseError
			programs = data || []
		} catch (err) {
			console.error('Failed to load programs:', err)
		} finally {
			loadingPrograms = false
		}
	}


	function handleAssignmentsUpdate(assignments: ArtistAssignment[]) {
		artistAssignments = assignments
	}

	function handleLocationChange(newLocationId: number | null, location?: LocationWithFacility | null) {
		locationId = newLocationId
		selectedLocation = location || null
	}

	async function handleFacilityCreated(event: CustomEvent<{ facility: any }>) {
		const newFacility = event.detail.facility
		newlyCreatedFacilityId = newFacility?.id || null
		isCreateFacilityModalOpen = false
		
		// If we have a new facility, open the location creation modal
		if (newlyCreatedFacilityId) {
			isCreateLocationModalOpen = true
		}
	}

	async function handleLocationCreated(event: CustomEvent<{ location: any }>) {
		const newLocation = event.detail.location
		isCreateLocationModalOpen = false
		newlyCreatedFacilityId = null
		
		// Refresh the location selector and select the new location
		if (newLocation?.id) {
			// Refresh the location selector's cache
			if (locationSelectorRef?.refresh) {
				await locationSelectorRef.refresh()
			}
			
			// Reload the location with facility data
			const { data, error } = await supabase
				.from('phwb_locations')
				.select(`
					*,
					facility:phwb_facilities!inner(id, name, address, type)
				`)
				.eq('id', newLocation.id)
				.single()
			
			if (!error && data) {
				locationId = newLocation.id
				selectedLocation = data as LocationWithFacility
				handleLocationChange(newLocation.id, data as LocationWithFacility)
			}
		}
	}

	async function handleSaveDraft() {
		submitting = true
		error = null

		if (timeError) {
			error = timeError
			submitting = false
			return
		}

		try {
			// Get plain array copies to avoid reactive proxy issues
			const programsArray = Array.isArray(programs) ? [...programs] : []
			
			// For drafts, we allow minimal data - generate defaults if needed
			let finalTitle = title.trim()
			if (!finalTitle) {
				// Try to generate from available data, or use default
				if (selectedLocation) {
					const locationName = selectedLocation.name
					const facilityName = selectedLocation.facility?.name || 'Unknown Facility'
					finalTitle = `Draft Event @ ${locationName} (${facilityName})`
				} else {
					finalTitle = 'Draft Event'
				}
			}

			// Ensure date exists
			const eventDate = date || new Date().toISOString().split('T')[0]

			// Use existing artistAssignments, no need to convert

			const eventData = {
				title: finalTitle,
				date: eventDate,
				...(startTime && { start_time: startTime }),
				...(endTime && { end_time: endTime }),
				status: 'draft',
				...(locationId && { location_id: locationId }),
				...(programId && { program_id: programId }),
				notes: '',
				...(artistAssignments.length > 0 && {
					artists: { assignments: artistAssignments }
				})
			}

			const createdEvent = await eventsStore.create(eventData)
			// Add program_name to the returned event for calendar display
			if (createdEvent && programId) {
				const program = programsArray.find(p => p.id === programId)
				(createdEvent as any).program_name = program?.title || null
			}
			onSuccess?.(createdEvent)

		} catch (err) {
			console.error('Error saving draft:', err)
			error = err instanceof Error ? err.message : 'Failed to save draft'
		} finally {
			submitting = false
		}
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault()

		if (!programId) {
			error = 'Please select a program'
			return
		}

		if (!locationId) {
			error = 'Please select a location'
			return
		}

		if (timeError) {
			error = timeError
			return
		}

		submitting = true
		error = null

		try {
			const locationName = selectedLocation?.name || 'Unknown Location'
			const facilityName = selectedLocation?.facility?.name || ''
			const locationDisplay = facilityName ? `${locationName} (${facilityName})` : locationName
			const program = programs.find(p => p.id === programId)
			let finalTitle = title.trim()

			if (!finalTitle) {
				const selectedArtistNames = artistAssignments
					.map(assignment => assignment.artist_name)
					.filter(name => name && name !== 'Unknown')

				if (selectedArtistNames.length === 0) {
					finalTitle = `Event @ ${locationDisplay}`
				} else if (selectedArtistNames.length === 1) {
					finalTitle = `${selectedArtistNames[0]} @ ${locationDisplay}`
				} else if (selectedArtistNames.length === 2) {
					finalTitle = `${selectedArtistNames[0]} & ${selectedArtistNames[1]} @ ${locationDisplay}`
				} else {
					finalTitle = `${selectedArtistNames[0]} +${selectedArtistNames.length - 1} @ ${locationDisplay}`
				}
			}

			// Use existing artistAssignments, no need to convert

			const eventData = {
				title: finalTitle,
				date,
				...(startTime && { start_time: startTime }),
				...(endTime && { end_time: endTime }),
				status,
				location_id: locationId,
				program_id: programId,
				notes: '',
				...(artistAssignments.length > 0 && {
					artists: { assignments: artistAssignments }
				})
			}

			const createdEvent = await eventsStore.create(eventData)
			// Add program_name to the returned event for calendar display
			if (createdEvent) {
				(createdEvent as any).program_name = program?.title || null
			}
			onSuccess?.(createdEvent)

		} catch (err) {
			console.error('Error creating event:', err)
			error = err instanceof Error ? err.message : 'Failed to create event'
		} finally {
			submitting = false
		}
	}

	// Tour functionality
	function startTour() {
		const tour = startCreateEventTour()
		return tour
	}
</script>

<div class="flex flex-col h-full overflow-hidden">
	<!-- Header -->
	<div class="flex-none p-4 border-b border-base-300 bg-base-100" data-tour="modal-header">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-bold">Create New Event</h2>
			<div class="flex items-center gap-2">
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={startTour}
					title="Take a guided tour"
				>
					<HelpCircle class="w-4 h-4" />
					Tour
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-sm btn-circle"
					onclick={() => onCancel?.()}
				>
					<X class="w-4 h-4" />
				</button>
			</div>
		</div>
	</div>

	<!-- Scrollable Form Content -->
	<div class="flex-1 overflow-y-auto p-4">
		{#if error}
			<div class="alert alert-error mb-4">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{error}</span>
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="space-y-6">
			<!-- Event Title -->
			<div class="form-control" data-tour="event-title">
				<label class="label">
					<span class="label-text">Event Title (Optional)</span>
				</label>
				<input
					type="text"
					bind:value={title}
					placeholder="Leave blank to auto-generate"
					class="input input-bordered input-sm"
					maxlength="200"
					disabled={submitting}
				/>
				<label class="label">
					<span class="label-text-alt text-info flex items-center gap-1">
						<Lightbulb class="w-3 h-3" />
						Auto-generates as "Artist @ Location"
					</span>
				</label>
			</div>

			<!-- Program -->
			<div class="form-control" data-tour="program-selector">
				<label class="label">
					<span class="label-text">Program <span class="text-error">*</span></span>
				</label>
				<select
					bind:value={programId}
					class="select select-bordered h-10 min-h-[2.5rem]"
					disabled={submitting || loadingPrograms}
					required
				>
					<option value={null}>Select a program...</option>
					{#each programs as program}
						<option value={program.id}>{program.title}</option>
					{/each}
				</select>
				{#if loadingPrograms}
					<label class="label">
						<span class="label-text-alt">Loading programs...</span>
					</label>
				{/if}
			</div>

			<!-- Location -->
			<div class="form-control" data-tour="location-selector">
				<div class="flex gap-2">
					<div class="flex-1">
						<FacilityLocationSelector
							bind:this={locationSelectorRef}
							value={locationId}
							placeholder="Select facility and location"
							disabled={submitting}
							required
							onchange={handleLocationChange}
						/>
					</div>
					<button
						type="button"
						class="btn btn-outline btn-sm"
						onclick={() => isCreateLocationModalOpen = true}
						disabled={submitting}
						title="Create new location"
					>
						<Plus class="w-4 h-4" />
					</button>
					<button
						type="button"
						class="btn btn-outline btn-sm"
						onclick={() => isCreateFacilityModalOpen = true}
						disabled={submitting}
						title="Create new facility"
					>
						<Plus class="w-4 h-4" />
						<span class="hidden sm:inline">Facility</span>
					</button>
				</div>
			</div>

			<!-- Date and Times -->
			<div class="grid grid-cols-3 gap-2" data-tour="date-time">
				<div class="form-control">
					<label class="label">
						<span class="label-text">Date <span class="text-error">*</span></span>
					</label>
					<input
						type="date"
						bind:value={date}
						class="input input-bordered input-sm"
						required
						disabled={submitting}
					/>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text">Start Time</span>
					</label>
					<input
						type="time"
						bind:value={startTime}
						class="input input-bordered input-sm {timeError ? 'input-error' : ''}"
						disabled={submitting}
					/>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text">End Time</span>
					</label>
					<input
						type="time"
						bind:value={endTime}
						min={minEndTime}
						class="input input-bordered input-sm {timeError ? 'input-error' : ''}"
						disabled={submitting || !startTime}
					/>
					{#if timeError}
						<label class="label">
							<span class="label-text-alt text-error">{timeError}</span>
						</label>
					{:else if !startTime}
						<label class="label">
							<span class="label-text-alt">Select a start time first</span>
						</label>
					{/if}
				</div>
			</div>

			<!-- Status -->
			<div class="form-control" data-tour="status-selector">
				<label class="label">
					<span class="label-text">Status</span>
				</label>
				<select
					bind:value={status}
					class="select select-bordered h-10 min-h-[2.5rem]"
					disabled={submitting}
				>
					{#each statusOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<!-- Artist Assignment -->
			<div class="space-y-4">
				<div class="border-b pb-2">
					<h4 class="font-semibold text-base">Artist Assignment</h4>
				</div>

				<UnifiedArtistAssignment
					assignments={artistAssignments}
					onAssignmentsUpdate={handleAssignmentsUpdate}
					mode="create"
					readonly={submitting}
				/>
			</div>

			<!-- Form Actions -->
			<div class="flex justify-end gap-2 pt-4 border-t" data-tour="form-actions">
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={() => onCancel?.()}
					disabled={submitting}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={handleSaveDraft}
					disabled={submitting}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					Save as Draft
				</button>
				<button
					type="submit"
					class="btn btn-primary btn-sm"
					disabled={submitting || !locationId || !programId}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-xs"></span>
						Creating...
					{:else}
						Create Event
					{/if}
				</button>
			</div>
		</form>
	</div>

	<!-- Create Facility Modal -->
	<CreateFacility
		open={isCreateFacilityModalOpen}
		on:close={() => {
			isCreateFacilityModalOpen = false
			newlyCreatedFacilityId = null
		}}
		on:success={handleFacilityCreated}
	/>

	<!-- Create Location Modal -->
	<CreateLocation
		open={isCreateLocationModalOpen}
		facilityId={newlyCreatedFacilityId || undefined}
		on:close={() => {
			isCreateLocationModalOpen = false
			newlyCreatedFacilityId = null
		}}
		on:success={handleLocationCreated}
	/>
</div>
