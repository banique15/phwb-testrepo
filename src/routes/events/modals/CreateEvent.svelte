<script lang="ts">
	import { Lightbulb, HelpCircle } from 'lucide-svelte'
	import { eventsStore } from '$lib/stores/events'
	import { onMount } from 'svelte'
	import type { Artist } from '$lib/schemas/artist'
	import type { LocationWithFacility } from '$lib/schemas/location'
	import { supabase } from '$lib/supabase'
	import type { EnhancedEvent } from '$lib/stores/events'
	import 'driver.js/dist/driver.css'
	import { startCreateEventTour } from '$lib/tours/createEventTour'
	import LocationContactSelector from '$lib/components/ui/LocationContactSelector.svelte'
	import FacilityLocationSelector from '$lib/components/ui/FacilityLocationSelector.svelte'
	import UnifiedArtistAssignment, { type ArtistAssignment } from '$lib/components/UnifiedArtistAssignment.svelte'
	import CreateLocationContact from '../../facilities/components/modals/contacts/CreateLocationContact.svelte'
	import { Plus } from 'lucide-svelte'
	import { toast } from '$lib/stores/toast'
	import type { LocationContact } from '$lib/schemas/locationContact'

	interface Props {
		open?: boolean
		onClose?: () => void
		onSuccess?: (createdEvent?: EnhancedEvent) => void
	}

	let { open = false, onClose, onSuccess }: Props = $props()

	// Modal reference
	let modalElement: HTMLDialogElement

	// Form state
	let title = $state('')
	let date = $state(new Date().toISOString().split('T')[0])
	let startTime = $state('')
	let endTime = $state('')
	let status = $state('planned')
	let locationId = $state<number | null>(null)
	let selectedLocation = $state<LocationWithFacility | null>(null)
	let artistAssignments = $state<ArtistAssignment[]>([])
	let productionManagerContactId = $state<number | null>(null)
	let numberOfAttendees = $state<number | undefined>(undefined)
	let showCreateContactModal = $state(false)

	// UI state
	let submitting = $state(false)
	let error = $state<string | null>(null)

	const statusOptions = [
		{ value: 'planned', label: 'Planned' },
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' },
		{ value: 'draft', label: 'Draft' }
	]

	// Display-only options (for demo purposes)


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


	// Control modal visibility
	$effect(() => {
		if (modalElement) {
			if (open) {
				modalElement.showModal()
			} else {
				modalElement.close()
			}
		}
	})

	function handleAssignmentsUpdate(assignments: ArtistAssignment[]) {
		artistAssignments = assignments
	}

	function handleLocationChange(newLocationId: number | null, location?: LocationWithFacility | null) {
		locationId = newLocationId
		selectedLocation = location || null
		// If we have a location, try to get facility info
		if (location && !selectedLocation?.facility) {
			// Location might not have facility info, so we'll fetch it if needed
			selectedLocation = location as LocationWithFacility
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
			const artistsArray = Array.isArray(artists) ? [...artists] : []
			
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

			// Create event data as draft
			const eventData = {
				title: finalTitle,
				date: eventDate,
				...(startTime && { start_time: startTime }),
				...(endTime && { end_time: endTime }),
				status: 'draft',
				...(locationId && { location_id: locationId }),
				notes: '',
				...(numberOfAttendees !== undefined && { number_of_attendees: numberOfAttendees }),
				...(productionManagerContactId && { production_manager_contact_id: productionManagerContactId }),
				...(artistAssignments.length > 0 && {
					artists: { assignments: artistAssignments }
				})
			}

			const createdEvent = await eventsStore.create(eventData)

			// Reset form
			resetForm()

			// Close modal and notify parent with the created event
			onSuccess?.(createdEvent)
			onClose?.()

		} catch (err) {
			console.error('Error saving draft:', err)
			error = err instanceof Error ? err.message : 'Failed to save draft'
		} finally {
			submitting = false
		}
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault()

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
			// Get location display name for title generation
			const locationName = selectedLocation?.name || 'Unknown Location'
			const facilityName = selectedLocation?.facility?.name || ''
			const locationDisplay = facilityName ? `${locationName} (${facilityName})` : locationName
			let finalTitle = title.trim()

			// Generate title automatically: "Artist @ Location" or "Artist1 & Artist2 @ Location"
			if (!finalTitle) {
				const selectedArtistNames = artistAssignments
					.map(assignment => assignment.artist_name)
					.filter(name => name && name !== 'Unknown')

				if (selectedArtistNames.length === 0) {
					// No artists selected
					finalTitle = `Event @ ${locationDisplay}`
				} else if (selectedArtistNames.length === 1) {
					// Single artist
					finalTitle = `${selectedArtistNames[0]} @ ${locationDisplay}`
				} else if (selectedArtistNames.length === 2) {
					// Two artists
					finalTitle = `${selectedArtistNames[0]} & ${selectedArtistNames[1]} @ ${locationDisplay}`
				} else {
					// Multiple artists - show first and count
					finalTitle = `${selectedArtistNames[0]} +${selectedArtistNames.length - 1} @ ${locationDisplay}`
				}
			}

			// Create event data
			const eventData = {
				title: finalTitle,
				date,
				...(startTime && { start_time: startTime }),
				...(endTime && { end_time: endTime }),
				status,
				location_id: locationId,
				notes: '',
				...(numberOfAttendees !== undefined && { number_of_attendees: numberOfAttendees }),
				...(productionManagerContactId && { production_manager_contact_id: productionManagerContactId }),
				...(artistAssignments.length > 0 && {
					artists: { assignments: artistAssignments }
				})
			}

			const createdEvent = await eventsStore.create(eventData)

			// Reset form
			resetForm()

			// Close modal and notify parent with the created event
			onSuccess?.(createdEvent)
			onClose?.()

		} catch (err) {
			console.error('Error creating event:', err)
			error = err instanceof Error ? err.message : 'Failed to create event'
		} finally {
			submitting = false
		}
	}

	function resetForm() {
		title = ''
		date = new Date().toISOString().split('T')[0]
		startTime = ''
		endTime = ''
		status = 'planned'
		locationId = null
		selectedLocation = null
		artistAssignments = []
		productionManagerContactId = null
		numberOfAttendees = undefined
		error = null
	}

	function handleClose() {
		resetForm()
		onClose?.()
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === modalElement) {
			handleClose()
		}
	}

	// Tour functionality
	let tourInstance: ReturnType<typeof startCreateEventTour> | null = null

	function startTour() {
		// Small delay to ensure modal is fully rendered
		setTimeout(() => {
			tourInstance = startCreateEventTour()
		}, 100)
	}

	// Cleanup tour when modal closes
	$effect(() => {
		if (!open && tourInstance) {
			tourInstance.destroy()
			tourInstance = null
		}
	})
</script>

<dialog
	bind:this={modalElement}
	class="modal"
	onclick={handleBackdropClick}
>
	<div class="modal-box w-11/12 max-w-4xl max-h-[90vh]">
		<div class="flex items-center justify-between mb-6" data-tour="modal-header">
			<h3 class="font-bold text-lg">Create New Event</h3>
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
					class="btn btn-sm btn-circle btn-ghost"
					onclick={handleClose}
				>
					✕
				</button>
			</div>
		</div>

		{#if error}
			<div class="alert alert-error mb-4">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{error}</span>
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="space-y-6">
			<!-- Basic Info Section -->
			<div class="space-y-4">
				<h4 class="font-semibold text-base border-b pb-2">Event Information</h4>

				<!-- Event Title (Optional - auto-generated) -->
				<div class="form-control" data-tour="event-title">
					<label class="label">
						<span class="label-text">Event Title (Optional)</span>
					</label>
					<input
						type="text"
						bind:value={title}
						placeholder="Leave blank to auto-generate from artist(s) and location"
						class="input input-bordered"
						maxlength="200"
						disabled={submitting}
					/>
					<label class="label">
						<span class="label-text-alt text-info flex items-center gap-1">
							<Lightbulb class="w-3 h-3" />
							Will auto-generate as "Artist @ Location" if left blank
						</span>
					</label>
				</div>

				<!-- Location (Required) -->
				<div class="form-control" data-tour="location-selector">
					<FacilityLocationSelector
						value={locationId}
						placeholder="Select facility and location"
						disabled={submitting}
						required
						onchange={handleLocationChange}
					/>
				</div>

				<!-- Date, Times, and Attendees Row -->
				<div class="grid grid-cols-1 md:grid-cols-4 gap-4" data-tour="date-time">
					<!-- Date (Required) -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">
								Date <span class="text-error">*</span>
							</span>
						</label>
						<input
							type="date"
							bind:value={date}
							class="input input-bordered"
							required
							disabled={submitting}
						/>
					</div>

					<!-- Start Time -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Start Time</span>
						</label>
						<input
							type="time"
							bind:value={startTime}
							class="input input-bordered {timeError ? 'input-error' : ''}"
							disabled={submitting}
						/>
					</div>

					<!-- End Time -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">End Time</span>
						</label>
						<input
							type="time"
							bind:value={endTime}
							min={minEndTime}
							class="input input-bordered {timeError ? 'input-error' : ''}"
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

					<!-- Number of Attendees -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Number of Attendees</span>
						</label>
						<input
							type="number"
							bind:value={numberOfAttendees}
							placeholder="Enter number of attendees"
							class="input input-bordered"
							min="0"
							step="1"
							disabled={submitting}
						/>
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

				<!-- Production Manager Contact -->
				<div class="form-control">
					<div class="flex items-center justify-between mb-1">
						<label class="label">
							<span class="label-text">Production Manager Contact</span>
						</label>
						<button
							type="button"
							class="btn btn-xs btn-outline btn-primary"
							class:btn-disabled={!locationId}
							onclick={() => {
								if (!locationId) {
									toast.error('Please select a location first before adding a production manager contact')
									return
								}
								showCreateContactModal = true
							}}
							title={locationId ? "Create new production manager contact" : "Please select a location first"}
							disabled={!locationId || submitting}
						>
							<Plus class="w-3 h-3 mr-1" />
							Create New
						</button>
					</div>
					<LocationContactSelector
						value={productionManagerContactId}
						locationId={locationId}
						onchange={(contactId) => productionManagerContactId = contactId}
						placeholder="Select a production manager contact (optional)"
						disabled={submitting}
					/>
					{#if !locationId}
						<label class="label">
							<span class="label-text-alt text-warning">
								Please select a location first to add a production manager contact
							</span>
						</label>
					{/if}
				</div>
			</div>

			<!-- Artist Assignment Section -->
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
			<div class="modal-action" data-tour="form-actions">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={handleClose}
					disabled={submitting}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn-ghost"
					onclick={handleSaveDraft}
					disabled={submitting}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Save as Draft
				</button>
				<button
					type="submit"
					class="btn btn-primary"
					disabled={submitting || !locationId}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-sm"></span>
						Creating...
					{:else}
						Create Event
					{/if}
				</button>
			</div>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button onclick={handleClose}>close</button>
	</form>
</dialog>

<!-- Create Location Contact Modal -->
<CreateLocationContact
	open={showCreateContactModal}
	locationId={locationId ? Number(locationId) : undefined}
	on:close={() => showCreateContactModal = false}
	on:success={(e: CustomEvent<{ contact: LocationContact }>) => {
		const newContact = e.detail.contact
		productionManagerContactId = newContact.id
		showCreateContactModal = false
		toast.success('Production manager contact created and selected')
	}}
/>
