<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte'
	import FormField from '$lib/components/ui/FormField.svelte'

	interface Props {
		conflict: any
		onVenueAction: (action: 'create' | 'skip', venueData?: any) => void
		onCancel: () => void
	}

	let { conflict, onVenueAction, onCancel }: Props = $props()

	// Venue creation form
	let venueForm = $state({
		name: conflict.value || '',
		address: '',
		city: '',
		state: '',
		zip: '',
		country: 'United States',
		capacity: '',
		venue_type: 'Performance Space',
		contact_name: '',
		contact_email: '',
		contact_phone: '',
		notes: ''
	})

	let selectedAction: 'create' | 'skip' | null = $state(null)
	let showCreateForm = $state(false)
	let formErrors: Record<string, string> = $state({})

	function selectAction(action: 'create' | 'skip') {
		selectedAction = action
		if (action === 'create') {
			showCreateForm = true
		} else {
			showCreateForm = false
		}
	}

	function validateForm(): boolean {
		const errors: Record<string, string> = {}

		if (!venueForm.name.trim()) {
			errors.name = 'Venue name is required'
		}

		if (venueForm.capacity && isNaN(Number(venueForm.capacity))) {
			errors.capacity = 'Capacity must be a number'
		}

		formErrors = errors
		return Object.keys(errors).length === 0
	}

	function confirmAction() {
		if (selectedAction === 'create') {
			if (!validateForm()) return
			
			const venueData = {
				...venueForm,
				capacity: venueForm.capacity ? Number(venueForm.capacity) : null
			}
			onVenueAction('create', venueData)
		} else if (selectedAction === 'skip') {
			onVenueAction('skip')
		}
	}

	function skipVenue() {
		onVenueAction('skip')
	}

	// Venue type options
	const venueTypes = [
		'Performance Space',
		'Theater',
		'Concert Hall',
		'Community Center',
		'School',
		'Hospital',
		'Library',
		'Museum',
		'Church',
		'Park',
		'Outdoor Space',
		'Private Residence',
		'Corporate Office',
		'Other'
	]
</script>

<Modal isOpen={true} onClose={onCancel} size="lg">
	<div class="p-6">
		<div class="flex justify-between items-center mb-6">
			<div>
				<h2 class="text-xl font-bold">Venue Not Found</h2>
				<p class="text-sm text-base-content/60">
					CSV contains: <strong>"{conflict.value}"</strong> (Row {conflict.row})
				</p>
			</div>
			<button class="btn btn-ghost btn-sm btn-circle" onclick={onCancel}>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Action Selection -->
		{#if !selectedAction}
			<div class="space-y-4 mb-6">
				<p class="text-base-content/80">
					This venue was not found in the system. What would you like to do?
				</p>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- Create New Venue -->
					<div 
						class="border-2 border-dashed border-base-300 rounded-lg p-6 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
						onclick={() => selectAction('create')}
					>
						<div class="text-center">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-primary mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-2m-2 0H5m2 0h2M9 7h6m-6 4h6m-2 4h2" />
							</svg>
							<h3 class="font-semibold text-lg mb-2">Create New Venue</h3>
							<p class="text-sm text-base-content/60">
								Add "{conflict.value}" as a new venue in the system
							</p>
						</div>
					</div>

					<!-- Skip Venue -->
					<div 
						class="border-2 border-dashed border-base-300 rounded-lg p-6 cursor-pointer hover:border-warning hover:bg-warning/5 transition-colors"
						onclick={() => selectAction('skip')}
					>
						<div class="text-center">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-warning mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
							</svg>
							<h3 class="font-semibold text-lg mb-2">Skip Venue</h3>
							<p class="text-sm text-base-content/60">
								Import without venue information for this row
							</p>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Create Venue Form -->
		{#if showCreateForm}
			<div class="space-y-6">
				<div class="flex items-center mb-4">
					<button 
						class="btn btn-ghost btn-sm mr-3"
						onclick={() => { selectedAction = null; showCreateForm = false }}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
						</svg>
						Back
					</button>
					<h3 class="text-lg font-semibold">Create New Venue</h3>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- Basic Information -->
					<div class="md:col-span-2">
						<FormField
							label="Venue Name"
							required
							error={formErrors.name}
						>
							<input
								type="text"
								class="input input-bordered w-full"
								bind:value={venueForm.name}
								placeholder="Enter venue name"
							/>
						</FormField>
					</div>

					<div class="md:col-span-2">
						<FormField label="Address">
							<input
								type="text"
								class="input input-bordered w-full"
								bind:value={venueForm.address}
								placeholder="Street address"
							/>
						</FormField>
					</div>

					<FormField label="City">
						<input
							type="text"
							class="input input-bordered w-full"
							bind:value={venueForm.city}
							placeholder="City"
						/>
					</FormField>

					<FormField label="State">
						<input
							type="text"
							class="input input-bordered w-full"
							bind:value={venueForm.state}
							placeholder="State"
						/>
					</FormField>

					<FormField label="ZIP Code">
						<input
							type="text"
							class="input input-bordered w-full"
							bind:value={venueForm.zip}
							placeholder="ZIP"
						/>
					</FormField>

					<FormField label="Country">
						<input
							type="text"
							class="input input-bordered w-full"
							bind:value={venueForm.country}
							placeholder="Country"
						/>
					</FormField>

					<FormField 
						label="Capacity" 
						error={formErrors.capacity}
					>
						<input
							type="number"
							class="input input-bordered w-full"
							bind:value={venueForm.capacity}
							placeholder="Maximum capacity"
						/>
					</FormField>

					<FormField label="Venue Type">
						<select
							class="select select-bordered w-full"
							bind:value={venueForm.venue_type}
						>
							{#each venueTypes as type}
								<option value={type}>{type}</option>
							{/each}
						</select>
					</FormField>

					<!-- Contact Information -->
					<div class="md:col-span-2">
						<h4 class="font-semibold mb-3 mt-4">Contact Information (Optional)</h4>
					</div>

					<FormField label="Contact Name">
						<input
							type="text"
							class="input input-bordered w-full"
							bind:value={venueForm.contact_name}
							placeholder="Contact person name"
						/>
					</FormField>

					<FormField label="Contact Email">
						<input
							type="email"
							class="input input-bordered w-full"
							bind:value={venueForm.contact_email}
							placeholder="Contact email"
						/>
					</FormField>

					<FormField label="Contact Phone">
						<input
							type="tel"
							class="input input-bordered w-full"
							bind:value={venueForm.contact_phone}
							placeholder="Contact phone"
						/>
					</FormField>

					<div></div> <!-- Spacer -->

					<div class="md:col-span-2">
						<FormField label="Notes">
							<textarea
								class="textarea textarea-bordered w-full"
								bind:value={venueForm.notes}
								placeholder="Additional notes about the venue"
								rows="3"
							></textarea>
						</FormField>
					</div>
				</div>
			</div>
		{/if}

		<!-- Skip Confirmation -->
		{#if selectedAction === 'skip' && !showCreateForm}
			<div class="text-center py-6">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-warning mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
				</svg>
				<h3 class="text-lg font-semibold mb-2">Skip Venue Assignment</h3>
				<p class="text-base-content/60 mb-4">
					The payroll record will be imported without venue information. You can add venue details later if needed.
				</p>
				<button 
					class="btn btn-ghost btn-sm"
					onclick={() => { selectedAction = null }}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
					</svg>
					Back to Options
				</button>
			</div>
		{/if}

		<!-- Actions -->
		{#if selectedAction}
			<div class="flex justify-between items-center mt-6 pt-6 border-t border-base-300">
				<div class="text-sm text-base-content/60">
					{#if selectedAction === 'create'}
						Creating new venue: <strong>{venueForm.name}</strong>
					{:else}
						Skipping venue for this row
					{/if}
				</div>
				<div class="flex space-x-3">
					<button class="btn btn-ghost" onclick={onCancel}>
						Cancel
					</button>
					<button 
						class="btn btn-primary"
						onclick={confirmAction}
					>
						{selectedAction === 'create' ? 'Create Venue' : 'Skip Venue'}
					</button>
				</div>
			</div>
		{:else}
			<div class="flex justify-end mt-6 pt-6 border-t border-base-300">
				<button class="btn btn-ghost" onclick={onCancel}>
					Cancel
				</button>
			</div>
		{/if}
	</div>
</Modal>