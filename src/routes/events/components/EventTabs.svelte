<script lang="ts">
	import type { EnhancedEvent } from '$lib/stores/events'
	import type { ComponentType, SvelteComponent } from 'svelte'
	import { Calendar, ClipboardList, Theater, FileText, ScrollText, Settings, DollarSign, Edit, X, BarChart, Users, CheckCircle } from 'lucide-svelte'
	import InlineEditableField from '$lib/components/ui/InlineEditableField.svelte'
	import ScheduleDisplay from './ScheduleDisplay.svelte'
	import RequirementsDisplay from './RequirementsDisplay.svelte'
	import EventPayrollLink from './EventPayrollLink.svelte'
	import { eventsStore } from '$lib/stores/events'
	// Import form components
	import ScheduleEditor from './ScheduleEditor.svelte'
	import RequirementsEditor from './RequirementsEditor.svelte'
	import UnifiedArtistAssignment from '$lib/components/UnifiedArtistAssignment.svelte'
	import ProgramSelector from '$lib/components/ui/ProgramSelector.svelte'
	import LocationContactSelector from '$lib/components/ui/LocationContactSelector.svelte'
	import CreateEnsemble from '../../ensembles/components/modals/CreateEnsemble.svelte'
	import type { Ensemble } from '$lib/schemas/ensemble'
	import { supabase } from '$lib/supabase'
	import { onMount } from 'svelte'
	import { createEventSchema, type UpdateEvent } from '$lib/schemas/event'

	interface Props {
		event: EnhancedEvent
		onUpdateField: (field: string, value: any) => Promise<void>
		onDelete: () => void
		externalActiveTab?: string | null
		onTabChange?: (tabId: string) => void
		onEventUpdated?: (updatedEvent: EnhancedEvent) => void
	}

	let { event, onUpdateField, onDelete, externalActiveTab = null, onTabChange, onEventUpdated }: Props = $props()
	
	// Edit mode state - track which tab is being edited
	let editingTab = $state<string | null>(null)
	
	// Form state for editing
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
		artist_assignments: event?.artists?.assignments || [],
		selected_artists: event?.artists?.assignments?.map(a => a.artist_id) || [],
		number_of_attendees: event?.number_of_attendees || undefined,
		production_manager_contact_id: event?.production_manager_contact_id || null
	})

	// Update form data when event changes
	$effect(() => {
		if (event) {
			formData = {
				title: event.title || '',
				date: event.date || '',
				start_time: event.start_time || '',
				end_time: event.end_time || '',
				status: typeof event.status === 'string' ? event.status : 'planned',
				notes: typeof event.notes === 'string' ? event.notes : '',
				location_id: event.location_id || undefined,
				program: event.program || undefined,
				schedule: event.schedule || null,
				requirements: event.requirements || null,
				artist_assignments: event.artists?.assignments || [],
				selected_artists: event.artists?.assignments?.map(a => a.artist_id) || [],
				number_of_attendees: event.number_of_attendees || undefined,
				production_manager_contact_id: event.production_manager_contact_id || null
			}
		}
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

	const statusOptions = [
		{ value: 'planned', label: 'Planned' },
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' },
		{ value: 'draft', label: 'Draft' }
	]

	// Unified tabs - merge both systems
	const tabs: Array<{ id: string; label: string; icon: ComponentType<SvelteComponent>; editable?: boolean }> = [
		{ id: 'performers', label: 'Performers', icon: Theater, editable: true },
		{ id: 'schedule', label: 'Schedule', icon: Calendar, editable: true },
		{ id: 'requirements', label: 'Requirements', icon: CheckCircle, editable: true },
		{ id: 'payroll', label: 'Payroll', icon: DollarSign, editable: false },
		{ id: 'notes', label: 'Notes', icon: FileText, editable: true },
		{ id: 'history', label: 'History', icon: ScrollText, editable: false },
		{ id: 'settings', label: 'Settings', icon: Settings, editable: false }
	]

	let activeTab = $state<string>(
		(typeof window !== 'undefined' ? localStorage.getItem('phwb-event-active-tab') : null) || 'performers'
	)

	// Watch for external tab changes
	$effect(() => {
		if (externalActiveTab && tabs.some(t => t.id === externalActiveTab)) {
			activeTab = externalActiveTab
		}
	})

	function setActiveTab(tabId: string) {
		activeTab = tabId
		// Reset edit mode when switching tabs
		editingTab = null
		if (typeof window !== 'undefined') {
			localStorage.setItem('phwb-event-active-tab', tabId)
		}
		// Call the callback if provided
		onTabChange?.(tabId)
	}

	function startEdit(tabId: string) {
		editingTab = tabId
	}

	function cancelEdit() {
		editingTab = null
		// Reset form data to current event values
		if (event) {
			formData = {
				title: event.title || '',
				date: event.date || '',
				start_time: event.start_time || '',
				end_time: event.end_time || '',
				status: typeof event.status === 'string' ? event.status : 'planned',
				notes: typeof event.notes === 'string' ? event.notes : '',
				location_id: event.location_id || undefined,
				program: event.program || undefined,
				schedule: event.schedule || null,
				requirements: event.requirements || null,
				artist_assignments: event.artists?.assignments || [],
				selected_artists: event.artists?.assignments?.map(a => a.artist_id) || [],
				number_of_attendees: event.number_of_attendees || undefined,
				production_manager_contact_id: event.production_manager_contact_id || null
			}
		}
		errors = {}
		submitError = ''
	}

	async function saveEdit() {
		if (!event?.id) return

		loading = true
		submitError = ''
		errors = {}

		try {
			// Validate based on which tab is being edited
			const updateData: UpdateEvent = {}

			if (false) { // basic tab removed
				// Validate basic fields
				try {
					createEventSchema.partial().parse({
						title: formData.title,
						date: formData.date,
						start_time: formData.start_time,
						end_time: formData.end_time,
						status: formData.status,
						location_id: formData.location_id,
						program: formData.program,
						number_of_attendees: formData.number_of_attendees,
						production_manager_contact_id: formData.production_manager_contact_id,
						notes: formData.notes
					})
				} catch (error: any) {
					if (error.errors) {
						error.errors.forEach((err: any) => {
							errors[err.path[0]] = err.message
						})
					}
					throw error
				}

				// Build update data
				if (formData.title !== event.title) updateData.title = formData.title
				if (formData.date !== event.date) updateData.date = formData.date
				if (formData.start_time !== event.start_time) updateData.start_time = formData.start_time
				if (formData.end_time !== event.end_time) updateData.end_time = formData.end_time
				if (formData.status !== event.status) updateData.status = formData.status
				if (formData.location_id !== event.location_id) updateData.location_id = formData.location_id
				if (formData.program !== event.program) updateData.program = formData.program
				if (formData.number_of_attendees !== event.number_of_attendees) updateData.number_of_attendees = formData.number_of_attendees
				if (formData.production_manager_contact_id !== event.production_manager_contact_id) updateData.production_manager_contact_id = formData.production_manager_contact_id
				if (formData.notes !== event.notes) updateData.notes = formData.notes
			} else if (editingTab === 'schedule') {
				if (formData.schedule !== event.schedule) {
					updateData.schedule = formData.schedule
				}
			} else if (editingTab === 'requirements') {
				if (formData.requirements !== event.requirements) {
					updateData.requirements = formData.requirements
				}
			} else if (editingTab === 'performers') {
				if (formData.artist_assignments !== event.artists?.assignments) {
					updateData.artists = { assignments: formData.artist_assignments }
				}
			} else if (editingTab === 'notes') {
				if (formData.notes !== event.notes) {
					updateData.notes = formData.notes
				}
			}

			// Only update if there are changes
			if (Object.keys(updateData).length > 0) {
				await eventsStore.enhanced.update(event.id, updateData)
				
				// Refresh event data
				if (onEventUpdated && event.id) {
					const updated = await eventsStore.enhanced.getById(event.id)
					if (updated) {
						onEventUpdated(updated)
					}
				}
			}

			editingTab = null
		} catch (error: any) {
			submitError = error.message || 'Failed to save changes'
		} finally {
			loading = false
		}
	}

	// Ensemble functions
	onMount(async () => {
		await loadEnsembles()
	})

	async function loadEnsembles() {
		try {
			const { data: ensembleData, error: ensembleError } = await supabase
				.from('phwb_ensembles')
				.select('*')
				.eq('status', 'active')
				.order('name')

			if (ensembleError) throw ensembleError

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

	async function assignEnsemble(ensembleId: string) {
		if (assigningEnsemble) return
		
		assigningEnsemble = true
		selectedEnsembleId = ensembleId
		
		try {
			const { data: members, error: membersError } = await supabase
				.from('phwb_ensemble_members')
				.select('artist_id, role, phwb_artists(id, full_name, artist_name)')
				.eq('ensemble_id', ensembleId)
				.eq('is_active', true)

			if (membersError) {
				console.error('Failed to fetch ensemble members:', membersError)
				submitError = 'Failed to load ensemble members'
				return
			}

			if (members && members.length > 0) {
				const newAssignments = members.map((member: any) => {
					const artist = member.phwb_artists
					return {
						artist_id: member.artist_id,
						artist_name: artist?.full_name || artist?.artist_name || 'Unknown',
						role: member.role || 'Ensemble Member',
						status: 'pending',
						num_hours: 0,
						hourly_rate: 0,
						notes: ''
					}
				})

				const existingArtistIds = new Set(formData.artist_assignments.map(a => a.artist_id))
				const uniqueNewAssignments = newAssignments.filter(a => !existingArtistIds.has(a.artist_id))
				
				formData.artist_assignments = [...formData.artist_assignments, ...uniqueNewAssignments]
				formData.selected_artists = formData.artist_assignments.map(a => a.artist_id)
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
		loadEnsembles()
		if (newEnsemble?.id) {
			assignEnsemble(newEnsemble.id)
		}
		isCreateEnsembleModalOpen = false
	}

	let selectedEnsemble = $derived.by(() => {
		if (!selectedEnsembleId) return null
		return ensembles.find(e => e.id === selectedEnsembleId) || null
	})

	// Handle component updates
	function handleScheduleUpdate(schedule: any) {
		formData.schedule = schedule
	}

	function handleRequirementsUpdate(requirements: any) {
		formData.requirements = requirements
	}

	function handleArtistAssignmentsUpdate(assignments: any[]) {
		formData.artist_assignments = assignments
		formData.selected_artists = assignments.map(a => a.artist_id)
	}


	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		// Append 'T00:00:00' to treat date as local time, not UTC
		const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
		return date.toLocaleDateString('en-US', {
			month: '2-digit',
			day: '2-digit',
			year: 'numeric'
		})
	}
</script>

<div class="space-y-3">
	<!-- Tab Navigation -->
	<div class="tabs tabs-boxed">
		{#each tabs as tab}
			<button
				class="tab {activeTab === tab.id ? 'tab-active' : ''}"
				onclick={() => setActiveTab(tab.id)}
			>
				<svelte:component this={tab.icon} class="w-4 h-4 mr-2" />
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Tab Content -->
	<div class="tab-content block">
		{#if submitError}
			<div class="alert alert-error mb-4">
				<span>{submitError}</span>
			</div>
		{/if}

		{#if activeTab === 'performers'}
			<div class="space-y-4">
				{#if editingTab === 'performers'}
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
						</div>

						<UnifiedArtistAssignment
							assignments={formData.artist_assignments}
							onAssignmentsUpdate={handleArtistAssignmentsUpdate}
							eventId={event.id}
							mode="edit"
							readonly={loading}
						/>

						<div class="flex justify-end gap-2 pt-4">
							<button
								type="button"
								class="btn btn-outline"
								onclick={cancelEdit}
								disabled={loading}
							>
								Cancel
							</button>
							<button
								type="button"
								class="btn btn-primary"
								onclick={saveEdit}
								disabled={loading}
							>
								{#if loading}
									<span class="loading loading-spinner loading-sm"></span>
								{/if}
								Save Changes
							</button>
						</div>
					</div>
				{:else}
					{#if event.id}
						<UnifiedArtistAssignment
							eventId={event.id}
							mode="edit"
							readonly={true}
						/>
					{:else}
						<p class="text-base opacity-70">No performers assigned</p>
					{/if}
				{/if}
			</div>
		{:else if activeTab === 'requirements'}
			<div class="space-y-4">
				<div class="flex items-center justify-between border-b pb-2">
					<h3 class="text-lg font-semibold">Event Requirements</h3>
				</div>
				{#if editingTab === 'requirements'}
					<RequirementsEditor 
						requirements={formData.requirements}
						onUpdate={handleRequirementsUpdate}
					/>
					<div class="flex justify-end gap-2 pt-4">
						<button
							type="button"
							class="btn btn-outline"
							onclick={cancelEdit}
							disabled={loading}
						>
							Cancel
						</button>
						<button
							type="button"
							class="btn btn-primary"
							onclick={saveEdit}
							disabled={loading}
						>
							{#if loading}
								<span class="loading loading-spinner loading-sm"></span>
							{/if}
							Save Changes
						</button>
					</div>
				{:else}
					{#if event.requirements}
						<RequirementsDisplay requirements={event.requirements} />
					{:else}
						<p class="text-base opacity-70">No requirements specified</p>
					{/if}
				{/if}
			</div>
		{:else if activeTab === 'schedule'}
			<div class="space-y-4">
				<div class="flex items-center justify-between border-b pb-2">
					<h3 class="text-lg font-semibold">Event Schedule</h3>
					{#if !editingTab && tabs.find(t => t.id === 'schedule')?.editable}
						<button
							type="button"
							class="btn btn-sm btn-outline"
							onclick={() => startEdit('schedule')}
						>
							<Edit class="w-4 h-4 mr-1" />
							Edit
						</button>
					{/if}
				</div>
				{#if editingTab === 'schedule'}
					<ScheduleEditor 
						schedule={formData.schedule}
						onUpdate={handleScheduleUpdate}
						event={{
							start_time: formData.start_time,
							end_time: formData.end_time,
							artists: { assignments: formData.artist_assignments }
						}}
					/>
					<div class="flex justify-end gap-2 pt-4">
						<button
							type="button"
							class="btn btn-outline"
							onclick={cancelEdit}
							disabled={loading}
						>
							Cancel
						</button>
						<button
							type="button"
							class="btn btn-primary"
							onclick={saveEdit}
							disabled={loading}
						>
							{#if loading}
								<span class="loading loading-spinner loading-sm"></span>
							{/if}
							Save Changes
						</button>
					</div>
				{:else}
					<ScheduleDisplay 
						schedule={event.schedule}
						event={{
							start_time: event.start_time,
							end_time: event.end_time,
							artists: event.artists?.assignments ? { assignments: event.artists.assignments } : (event.artists || undefined)
						}}
					/>
				{/if}
			</div>
		{:else if activeTab === 'payroll'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Linked Payroll</h3>
				{#if event.id}
					<EventPayrollLink eventId={event.id} />
				{:else}
					<p class="text-base opacity-70">Save the event to view linked payroll</p>
				{/if}
			</div>
		{:else if activeTab === 'notes'}
			<div class="space-y-4">
				<div class="flex items-center justify-between border-b pb-2">
					<h3 class="text-lg font-semibold">Notes</h3>
				</div>
				{#if editingTab === 'notes'}
					<div class="form-control">
						<textarea
							bind:value={formData.notes}
							class="textarea textarea-bordered"
							placeholder="Enter event notes"
							rows="8"
						></textarea>
					</div>
					<div class="flex justify-end gap-2 pt-4">
						<button
							type="button"
							class="btn btn-outline"
							onclick={cancelEdit}
							disabled={loading}
						>
							Cancel
						</button>
						<button
							type="button"
							class="btn btn-primary"
							onclick={saveEdit}
							disabled={loading}
						>
							{#if loading}
								<span class="loading loading-spinner loading-sm"></span>
							{/if}
							Save Changes
						</button>
					</div>
				{:else}
					<InlineEditableField
						value={event.notes}
						field="notes"
						type="textarea"
						placeholder="Enter event notes"
						maxLength={2000}
						rows={8}
						onSave={(value) => onUpdateField('notes', value)}
					/>
				{/if}
			</div>
		{:else if activeTab === 'history'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Event History</h3>
				<div class="space-y-3">
					<div>
						<p class="text-sm font-medium opacity-70">Created</p>
						<p class="text-base">{formatDate(event.created_at)}</p>
					</div>
					{#if event.feedback && event.feedback.internal_notes && event.feedback.internal_notes.length > 0}
						<div class="space-y-3">
							<h4 class="text-md font-semibold">Internal Notes</h4>
							{#each event.feedback.internal_notes as note, index}
								<div class="bg-base-200 p-4 rounded-lg border-l-4 border-warning">
									<div class="flex items-start gap-3">
										<span class="badge badge-warning badge-sm">#{index + 1}</span>
										<div class="flex-1">
											{#if typeof note === 'string'}
												<p class="text-base whitespace-pre-wrap">{note}</p>
											{:else if note.content || note.note || note.text}
												<p class="text-base whitespace-pre-wrap">{note.content || note.note || note.text}</p>
												{#if note.author}
													<div class="text-xs opacity-60 mt-2">— {note.author}</div>
												{/if}
												{#if note.timestamp || note.date}
													<div class="text-xs opacity-60 mt-1">
														{formatDate(note.timestamp || note.date)}
													</div>
												{/if}
											{:else}
												<pre class="text-sm bg-base-300 p-2 rounded overflow-x-auto">
{JSON.stringify(note, null, 2)}
												</pre>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{:else if activeTab === 'settings'}
			<div class="space-y-4">
				<div class="flex items-center justify-between border-b pb-2">
					<h3 class="text-lg font-semibold">Settings</h3>
				</div>
				<div class="space-y-4">
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Created Date</span>
						</label>
						<div class="text-base opacity-70">
							{formatDate(event.created_at)}
						</div>
					</div>
					<div class="divider"></div>
					<button
						class="btn btn-outline btn-error"
						onclick={onDelete}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
						Delete Event
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Create Ensemble Modal -->
<CreateEnsemble
	open={isCreateEnsembleModalOpen}
	on:close={() => isCreateEnsembleModalOpen = false}
	on:success={handleEnsembleCreated}
/>