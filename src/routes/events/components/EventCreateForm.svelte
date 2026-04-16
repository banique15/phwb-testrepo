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
	import ProductionManagerSelector from '$lib/components/ui/ProductionManagerSelector.svelte'
	import UnifiedArtistAssignment, { type ArtistAssignment } from '$lib/components/UnifiedArtistAssignment.svelte'
	import TimePicker from '$lib/components/ui/TimePicker.svelte'

	interface Props {
		onSuccess?: (createdEvent?: EnhancedEvent) => void
		onCancel?: () => void
		initialDate?: string
		initialTime?: string
		initialProgramId?: number
		onFieldFocus?: () => void
	}

	let { onSuccess, onCancel, initialDate, initialTime, initialProgramId, onFieldFocus }: Props = $props()

	// Form state
	let title = $state('')
	let date = $state(initialDate || new Date().toISOString().split('T')[0])
	let startTime = $state(initialTime || '')
	let endTime = $state('')
	let status = $state('planned')
	let locationId = $state<number | null>(null)
	let selectedLocation = $state<LocationWithFacility | null>(null)
	let programId = $state<number | null>(initialProgramId ?? null)
	let artistAssignments = $state<ArtistAssignment[]>([])
	let notes = $state('')
	let numberOfAttendees = $state<number | null>(null)
	let numberOfMusicians = $state<number | null>(null)
	let productionManagerArtistId = $state<string | null>(null)
	let productionManagerId = $state<string | null>(null)
	let setlistReviewNotes = $state('')

	// Data state
	let programs = $state<Program[]>([])
	let loadingPrograms = $state(true)

	// UI state
	let submitting = $state(false)
	let error = $state<string | null>(null)
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

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault()

		// For drafts, allow minimal data - skip required field validation
		if (status !== 'draft') {
			if (!programId) {
				error = 'Please select a program'
				return
			}

			if (!locationId) {
				error = 'Please select a location'
				return
			}
		}

		if (timeError) {
			error = timeError
			return
		}

		submitting = true
		error = null

		try {
			let finalTitle = title.trim()
			
			// For drafts, generate a simple title if missing
		if (!finalTitle) {
			const facilityName = selectedLocation?.facility?.name || ''

			if (status === 'draft') {
				if (facilityName) {
					finalTitle = `Draft Event - ${facilityName}`
				} else {
					finalTitle = 'Draft Event'
				}
			} else {
				const locationDisplay = facilityName || 'Unknown Facility'
				const selectedArtistNames = artistAssignments
					.map(assignment => assignment.artist_name)
					.filter(name => name && name !== 'Unknown')

				if (selectedArtistNames.length === 0) {
					finalTitle = `Event - ${locationDisplay}`
				} else if (selectedArtistNames.length === 1) {
					finalTitle = `${selectedArtistNames[0]} - ${locationDisplay}`
				} else if (selectedArtistNames.length === 2) {
					finalTitle = `${selectedArtistNames[0]} & ${selectedArtistNames[1]} - ${locationDisplay}`
				} else {
					finalTitle = `${selectedArtistNames[0]} +${selectedArtistNames.length - 1} - ${locationDisplay}`
				}
			}
		}

			// Ensure date exists (required for all events)
			const eventDate = date || new Date().toISOString().split('T')[0]

			const program = programId ? programs.find(p => p.id === programId) : null

			const eventData = {
				title: finalTitle,
				date: eventDate,
				...(startTime && { start_time: startTime }),
				...(endTime && { end_time: endTime }),
				status,
				...(locationId && { location_id: locationId }),
				...(programId && { program: programId }),
				...(notes && { notes }),
				...(numberOfAttendees !== null && { number_of_attendees: numberOfAttendees }),
				...(numberOfMusicians !== null && { number_of_musicians: numberOfMusicians }),
				...(productionManagerId && { production_manager_id: productionManagerId }),
				...(productionManagerArtistId && { production_manager_artist_id: productionManagerArtistId }),
				...(artistAssignments.length > 0 && {
					artists: { assignments: artistAssignments }
				}),
				...(setlistReviewNotes.trim() && { setlist_review_notes: setlistReviewNotes.trim() })
			}

			const createdEvent = await eventsStore.create(eventData)
			// Add program_name to the returned event for calendar display
			if (createdEvent && programId) {
				(createdEvent as any).program_name = program?.title || null
			}
			
			// Preserve location, facility, and start time for next event creation
			// Only reset title, end time, status, and artist assignments
			title = ''
			endTime = ''
			status = 'planned'
			artistAssignments = []
			setlistReviewNotes = ''
			// Keep: date, startTime, locationId, selectedLocation, programId
			
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
					class="input input-bordered input-sm w-full"
					maxlength="200"
					disabled={submitting}
					onfocus={() => onFieldFocus?.()}
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
					class="select select-bordered h-10 min-h-[2.5rem] w-full"
					disabled={submitting || loadingPrograms}
					required
					onfocus={() => onFieldFocus?.()}
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
			<FacilityLocationSelector
				bind:this={locationSelectorRef}
				value={locationId}
				placeholder="Select facility and location"
				disabled={submitting}
				required
				onchange={handleLocationChange}
			/>
		</div>

		<!-- Date and Times -->
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-2" data-tour="date-time">
			<div class="form-control min-w-0">
				<label class="label">
					<span class="label-text">Date <span class="text-error">*</span></span>
				</label>
				<input
					type="date"
					bind:value={date}
					class="input input-bordered input-sm w-full"
					required
					disabled={submitting}
					onfocus={() => onFieldFocus?.()}
				/>
			</div>

			<div class="form-control min-w-0">
				<label class="label">
					<span class="label-text">Start Time</span>
				</label>
				<TimePicker
					bind:value={startTime}
					disabled={submitting}
					onfocus={() => onFieldFocus?.()}
					error={!!timeError}
				/>
			</div>

			<div class="form-control min-w-0">
				<label class="label">
					<span class="label-text">End Time</span>
				</label>
				<TimePicker
					bind:value={endTime}
					disabled={submitting || !startTime}
					onfocus={() => onFieldFocus?.()}
					error={!!timeError}
					defaultPeriod="PM"
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
					class="select select-bordered h-10 min-h-[2.5rem] w-full"
					disabled={submitting}
					onfocus={() => onFieldFocus?.()}
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
					eventStartTime={startTime}
					eventEndTime={endTime}
				/>
			</div>

			<!-- Notes and Attendees -->
			<div class="space-y-4">
				<div class="border-b pb-2">
					<h4 class="font-semibold text-base">Notes</h4>
				</div>
				
				<div class="form-control">
					<label class="label">
						<span class="label-text">Number of Attendees</span>
					</label>
					<input
						type="number"
						bind:value={numberOfAttendees}
						placeholder="Enter number of attendees"
						class="input input-bordered input-sm w-full"
						min="0"
						step="1"
						disabled={submitting}
						onfocus={() => onFieldFocus?.()}
					/>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text">Number of Artists/Musicians</span>
					</label>
					<input
						type="number"
						bind:value={numberOfMusicians}
						placeholder="Enter number of artists/musicians performing"
						class="input input-bordered input-sm w-full"
						min="0"
						step="1"
						disabled={submitting}
						onfocus={() => onFieldFocus?.()}
					/>
				</div>

			<!-- Production Manager (artist with is_production_manager) -->
			<div class="border-t border-base-300 pt-4 mt-4">
				<h4 class="font-medium text-sm mb-3">Production Manager</h4>
				<ProductionManagerSelector
					value={productionManagerId}
					placeholder="Select a production manager (optional)"
					disabled={submitting}
					onchange={(selectedProductionManagerId, productionManager) => {
						productionManagerId = selectedProductionManagerId
						productionManagerArtistId = productionManager?.artist_id ?? null
					}}
				/>
			</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text">Notes</span>
					</label>
					<textarea
						bind:value={notes}
						placeholder="Add any additional notes about this event..."
						class="textarea textarea-bordered textarea-sm w-full"
						rows="4"
						disabled={submitting}
						onfocus={() => onFieldFocus?.()}
					></textarea>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text">Setlist review notes</span>
					</label>
					<textarea
						bind:value={setlistReviewNotes}
						placeholder="Add notes from the setlist review..."
						class="textarea textarea-bordered textarea-sm w-full"
						rows="4"
						disabled={submitting}
						onfocus={() => onFieldFocus?.()}
					></textarea>
				</div>
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
					type="submit"
					class="btn btn-primary btn-sm"
					disabled={submitting || (status !== 'draft' && (!locationId || !programId))}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-xs"></span>
						{status === 'draft' ? 'Saving...' : 'Creating...'}
					{:else}
						{status === 'draft' ? 'Save as Draft' : 'Create Event'}
					{/if}
				</button>
			</div>
		</form>
	</div>

</div>
