<script lang="ts">
	import { createEventSchema, type Event, type CreateEvent, type UpdateEvent } from '$lib/schemas/event'
	import { eventsStore } from '$lib/stores/events'
	import ArtistSelection from './ArtistSelection.svelte'
	import ScheduleEditor from './ScheduleEditor.svelte'
	import RequirementsEditor from './RequirementsEditor.svelte'
	import StatusManager from './StatusManager.svelte'
	import VenueSelector from '$lib/components/ui/VenueSelector.svelte'
	import ProgramSelector from '$lib/components/ui/ProgramSelector.svelte'
	
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
		venue: event?.venue || undefined,
		program: event?.program || undefined,
		schedule: event?.schedule || null,
		requirements: event?.requirements || null,
		artist_assignments: event?.artists?.assignments || [],
		selected_artists: event?.artists?.assignments?.map(a => a.artist_id) || []
	})
	
	let loading = $state(false)
	let errors = $state<Record<string, string>>({})
	let submitError = $state('')
	
	const statusOptions = [
		{ value: 'planned', label: 'Planned' },
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' }
	]
	
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
			const dataToSave = { ...formData }
			
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
			venue: event?.venue || undefined,
			program: event?.program || undefined,
			schedule: event?.schedule || null,
			requirements: event?.requirements || null,
			artist_assignments: event?.artists?.assignments || [],
			selected_artists: event?.artists?.assignments?.map(a => a.artist_id) || []
		}
		errors = {}
		submitError = ''
	}
	
	// Tab management
	let activeTab = $state('basic')
	const tabs = [
		{ id: 'basic', label: 'Basic Info', icon: '📋' },
		{ id: 'schedule', label: 'Schedule', icon: '📅' },
		{ id: 'requirements', label: 'Requirements', icon: '✅' },
		{ id: 'artists', label: 'Artists', icon: '👥' },
		{ id: 'status', label: 'Status', icon: '📊' }
	]
	
	// Handle advanced component updates
	function handleScheduleUpdate(schedule: any) {
		formData.schedule = schedule
	}
	
	function handleRequirementsUpdate(requirements: any) {
		formData.requirements = requirements
	}
	
	function handleArtistSelectionUpdate(artistIds: string[]) {
		formData.selected_artists = artistIds
	}

	function handleArtistAssignmentsUpdate(assignments: any[]) {
		formData.artist_assignments = assignments
	}
	
	async function handleStatusChange(newStatus: string) {
		formData.status = newStatus
		// Auto-save status changes if editing
		if (isEdit && event?.id) {
			try {
				await eventsStore.update(event.id, { status: newStatus })
			} catch (error) {
				console.error('Failed to update status:', error)
			}
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
				<span class="mr-2">{tab.icon}</span>
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
				
				<!-- Date and Time Row -->
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
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
						<input
							id="start_time"
							type="time"
							bind:value={formData.start_time}
							class="input input-bordered {errors.start_time ? 'input-error' : ''}"
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
						<input
							id="end_time"
							type="time"
							bind:value={formData.end_time}
							class="input input-bordered {errors.end_time ? 'input-error' : ''}"
						/>
						{#if errors.end_time}
							<label class="label">
								<span class="label-text-alt text-error">{errors.end_time}</span>
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
					
					<!-- Venue -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Venue</span>
						</label>
						<VenueSelector
							value={formData.venue}
							placeholder="Search for a venue..."
							error={errors.venue}
							onchange={(e) => formData.venue = e.detail.value}
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
			<ArtistSelection 
				selectedArtists={formData.selected_artists}
				assignments={formData.artist_assignments}
				onUpdate={handleArtistSelectionUpdate}
				onAssignmentsUpdate={handleArtistAssignmentsUpdate}
			/>
		{:else if activeTab === 'status'}
			<!-- Status Tab -->
			{#if event}
				<StatusManager 
					event={event}
					onStatusChange={handleStatusChange}
				/>
			{:else}
				<div class="text-center py-8 bg-base-200 rounded-lg">
					<span class="text-4xl">📊</span>
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
</div>