<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import Modal from '$lib/components/ui/Modal.svelte'
	import { updateVenueSchema, type Venue, type UpdateVenue } from '$lib/schemas/venue'
	import { venuesStore } from '$lib/stores/venues'
	import { z } from 'zod'

	interface Props {
		open?: boolean
		venue?: Venue | null
	}

	let { open = false, venue = null }: Props = $props()

	const dispatch = createEventDispatcher<{
		close: void
		success: { venue: Venue }
	}>()

	// Form state
	let formData = $state<UpdateVenue>({})
	let isLoading = $state(false)
	let formErrors = $state<Record<string, string>>({})
	let submitError = $state<string | null>(null)

	// Contact and parking fields state
	let contactFields = $state<Array<{ key: string; value: string }>>([])
	let parkingFields = $state<Array<{ key: string; value: string }>>([])

	// Initialize form when venue changes
	$effect(() => {
		if (venue && open) {
			formData = {
				name: venue.name || '',
				address: venue.address || '',
				type: venue.type || '',
				reference: venue.reference || '',
				description: venue.description || '',
				image: venue.image || '',
				contacts: venue.contacts,
				parking: venue.parking
			}

			// Initialize contact fields
			if (venue.contacts && typeof venue.contacts === 'object') {
				contactFields = Object.entries(venue.contacts).map(([key, value]) => ({ key, value: String(value) }))
			} else {
				contactFields = [{ key: '', value: '' }]
			}

			// Initialize parking fields
			if (venue.parking && typeof venue.parking === 'object') {
				parkingFields = Object.entries(venue.parking).map(([key, value]) => ({ key, value: String(value) }))
			} else {
				parkingFields = [{ key: '', value: '' }]
			}
		}
	})

	// Validation helper
	function validateField(field: keyof UpdateVenue, value: any) {
		try {
			const fieldSchema = updateVenueSchema.shape[field]
			if (fieldSchema) {
				fieldSchema.parse(value)
				delete formErrors[field]
				formErrors = { ...formErrors }
			}
		} catch (error) {
			if (error instanceof z.ZodError) {
				formErrors[field] = error.errors[0]?.message || 'Invalid value'
				formErrors = { ...formErrors }
			}
		}
	}

	// Form handlers
	function handleInputChange(field: keyof UpdateVenue, value: any) {
		formData[field] = value
		validateField(field, value)
		submitError = null
	}

	function addContactField() {
		contactFields = [...contactFields, { key: '', value: '' }]
	}

	function removeContactField(index: number) {
		contactFields = contactFields.filter((_, i) => i !== index)
	}

	function addParkingField() {
		parkingFields = [...parkingFields, { key: '', value: '' }]
	}

	function removeParkingField(index: number) {
		parkingFields = parkingFields.filter((_, i) => i !== index)
	}

	function resetForm() {
		formData = {}
		contactFields = [{ key: '', value: '' }]
		parkingFields = [{ key: '', value: '' }]
		formErrors = {}
		submitError = null
		isLoading = false
	}

	async function handleSubmit(event?: SubmitEvent | MouseEvent) {
		event?.preventDefault()
		if (!venue?.id) return

		// Reset previous errors
		formErrors = {}
		submitError = null

		// Validate the entire form
		try {
			updateVenueSchema.parse(formData)
		} catch (error) {
			if (error instanceof z.ZodError) {
				error.errors.forEach(err => {
					if (err.path.length > 0) {
						formErrors[err.path[0] as string] = err.message
					}
				})
				formErrors = { ...formErrors }
				return
			}
		}

		// Check required fields
		if (!formData.name?.trim()) {
			formErrors.name = 'Venue name is required'
			formErrors = { ...formErrors }
			return
		}

		isLoading = true

		try {
			// Clean up data before submission
			const cleanData = { ...formData }
			
			// Process contacts
			const contacts: Record<string, string> = {}
			contactFields.forEach(field => {
				if (field.key.trim() && field.value.trim()) {
					contacts[field.key.trim()] = field.value.trim()
				}
			})
			cleanData.contacts = Object.keys(contacts).length > 0 ? contacts : undefined

			// Process parking
			const parking: Record<string, string> = {}
			parkingFields.forEach(field => {
				if (field.key.trim() && field.value.trim()) {
					parking[field.key.trim()] = field.value.trim()
				}
			})
			cleanData.parking = Object.keys(parking).length > 0 ? parking : undefined
			
			// Remove empty strings and convert to null/undefined where appropriate
			Object.keys(cleanData).forEach(key => {
				const value = cleanData[key as keyof UpdateVenue]
				if (typeof value === 'string' && value.trim() === '') {
					delete cleanData[key as keyof UpdateVenue]
				}
			})

			const updatedVenue = await venuesStore.update(venue.id, cleanData)
			
			dispatch('success', { venue: updatedVenue })
			dispatch('close')
		} catch (error) {
			console.error('Failed to update venue:', error)
			submitError = error instanceof Error ? error.message : 'Failed to update venue. Please try again.'
		} finally {
			isLoading = false
		}
	}

	function handleClose() {
		if (!isLoading) {
			resetForm()
			dispatch('close')
		}
	}

	// Venue type options
	const venueTypes = [
		'Healing Arts',
		'Performance',
		'Community',
		'Education',
		'Conference',
		'Workshop',
		'Other'
	]
</script>

<Modal 
	{open}
	title="Edit Venue"
	size="xl"
	loading={isLoading}
	closeable={!isLoading}
	on:close={handleClose}
>
	{#if venue}
		<form onsubmit={handleSubmit} class="space-y-6">
			{#if submitError}
				<div class="alert alert-error">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>{submitError}</span>
				</div>
			{/if}

			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<!-- Basic Information -->
				<div class="space-y-4">
					<h3 class="text-lg font-semibold border-b pb-2">Venue Information</h3>
					
					<div class="form-control">
						<label class="label" for="edit-venue-name">
							<span class="label-text">Venue Name <span class="text-error">*</span></span>
						</label>
						<input 
							id="edit-venue-name"
							type="text" 
							class="input input-bordered {formErrors.name ? 'input-error' : ''}"
							value={formData.name || ''}
							oninput={(e) => handleInputChange('name', e.currentTarget.value)}
							placeholder="Enter venue name"
							required
						/>
						{#if formErrors.name}
							<label class="label">
								<span class="label-text-alt text-error">{formErrors.name}</span>
							</label>
						{/if}
					</div>

					<div class="form-control">
						<label class="label" for="edit-venue-type">
							<span class="label-text">Venue Type</span>
						</label>
						<select 
							id="edit-venue-type"
							class="select select-bordered {formErrors.type ? 'select-error' : ''}"
							value={formData.type || ''}
							onchange={(e) => handleInputChange('type', e.currentTarget.value)}
						>
							<option value="">Select venue type</option>
							{#each venueTypes as type}
								<option value={type}>{type}</option>
							{/each}
						</select>
						{#if formErrors.type}
							<label class="label">
								<span class="label-text-alt text-error">{formErrors.type}</span>
							</label>
						{/if}
					</div>

					<div class="form-control">
						<label class="label" for="edit-venue-reference">
							<span class="label-text">Reference</span>
						</label>
						<input 
							id="edit-venue-reference"
							type="text" 
							class="input input-bordered {formErrors.reference ? 'input-error' : ''}"
							value={formData.reference || ''}
							oninput={(e) => handleInputChange('reference', e.currentTarget.value)}
							placeholder="Reference code or identifier"
						/>
						{#if formErrors.reference}
							<label class="label">
								<span class="label-text-alt text-error">{formErrors.reference}</span>
							</label>
						{/if}
					</div>

					<div class="form-control">
						<label class="label" for="edit-venue-image">
							<span class="label-text">Image URL</span>
						</label>
						<input 
							id="edit-venue-image"
							type="url" 
							class="input input-bordered {formErrors.image ? 'input-error' : ''}"
							value={formData.image || ''}
							oninput={(e) => handleInputChange('image', e.currentTarget.value)}
							placeholder="https://example.com/venue-image.jpg"
						/>
						{#if formErrors.image}
							<label class="label">
								<span class="label-text-alt text-error">{formErrors.image}</span>
							</label>
						{/if}
					</div>
				</div>

				<!-- Location Information -->
				<div class="space-y-4">
					<h3 class="text-lg font-semibold border-b pb-2">Location</h3>

					<div class="form-control">
						<label class="label" for="edit-venue-address">
							<span class="label-text">Address</span>
						</label>
						<textarea 
							id="edit-venue-address"
							class="textarea textarea-bordered h-24 {formErrors.address ? 'textarea-error' : ''}"
							value={formData.address || ''}
							oninput={(e) => handleInputChange('address', e.currentTarget.value)}
							placeholder="Enter full address..."
							maxlength="500"
						></textarea>
						<label class="label">
							<span class="label-text-alt">Maximum 500 characters</span>
						</label>
						{#if formErrors.address}
							<label class="label">
								<span class="label-text-alt text-error">{formErrors.address}</span>
							</label>
						{/if}
					</div>

					<!-- Contact Information -->
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<h4 class="font-medium">Contact Information</h4>
							<button 
								type="button" 
								class="btn btn-sm btn-outline"
								onclick={addContactField}
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
								</svg>
								Add Contact
							</button>
						</div>
						{#each contactFields as field, index}
							<div class="flex gap-2">
								<input 
									type="text" 
									class="input input-bordered input-sm flex-1"
									bind:value={field.key}
									placeholder="Contact type (e.g., phone, email)"
								/>
								<input 
									type="text" 
									class="input input-bordered input-sm flex-1"
									bind:value={field.value}
									placeholder="Contact value"
								/>
								{#if contactFields.length > 1}
									<button 
										type="button" 
										class="btn btn-sm btn-outline btn-error"
										onclick={() => removeContactField(index)}
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
									</button>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Description -->
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Description</h3>
				
				<div class="form-control">
					<label class="label" for="edit-venue-description">
						<span class="label-text">Venue Description</span>
					</label>
					<textarea 
						id="edit-venue-description"
						class="textarea textarea-bordered h-24 {formErrors.description ? 'textarea-error' : ''}"
						value={formData.description || ''}
						oninput={(e) => handleInputChange('description', e.currentTarget.value)}
						placeholder="Describe the venue, its features, capacity, and amenities..."
						maxlength="2000"
					></textarea>
					<label class="label">
						<span class="label-text-alt">Maximum 2000 characters</span>
					</label>
					{#if formErrors.description}
						<label class="label">
							<span class="label-text-alt text-error">{formErrors.description}</span>
						</label>
					{/if}
				</div>
			</div>

			<!-- Parking Information -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-semibold border-b pb-2">Parking Information</h3>
					<button 
						type="button" 
						class="btn btn-sm btn-outline"
						onclick={addParkingField}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Add Parking Info
					</button>
				</div>
				{#each parkingFields as field, index}
					<div class="flex gap-2">
						<input 
							type="text" 
							class="input input-bordered input-sm flex-1"
							bind:value={field.key}
							placeholder="Parking type (e.g., street, garage, lot)"
						/>
						<input 
							type="text" 
							class="input input-bordered input-sm flex-1"
							bind:value={field.value}
							placeholder="Details (e.g., free, $5/hour, 50 spaces)"
						/>
						{#if parkingFields.length > 1}
							<button 
								type="button" 
								class="btn btn-sm btn-outline btn-error"
								onclick={() => removeParkingField(index)}
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
							</button>
						{/if}
					</div>
				{/each}
			</div>
		</form>
	{:else}
		<div class="text-center py-8">
			<p class="text-lg">No venue selected</p>
			<p class="text-sm opacity-60">Please select a venue to edit</p>
		</div>
	{/if}

	<svelte:fragment slot="actions" let:closeModal>
		<button 
			type="button" 
			class="btn btn-ghost" 
			onclick={closeModal}
			disabled={isLoading}
		>
			Cancel
		</button>
		<button 
			type="button"
			class="btn btn-primary"
			onclick={handleSubmit}
			disabled={isLoading || !formData.name?.trim() || !venue}
		>
			{#if isLoading}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
				</svg>
			{/if}
			Update Venue
		</button>
	</svelte:fragment>
</Modal>