<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import Modal from '$lib/components/ui/Modal.svelte'
	import { createFacilitySchema, type CreateFacility } from '$lib/schemas/facility'
	import { facilitiesStore } from '$lib/stores/facilities'
	import { facilityTypesStore } from '$lib/stores/facilityTypes'
	import { onMount } from 'svelte'
	import { z } from 'zod'
	import type { FacilityType } from '$lib/schemas/facilityType'

	interface Props {
		open?: boolean
	}

	let { open = false }: Props = $props()

	const dispatch = createEventDispatcher<{
		close: void
		success: { facility: any }
	}>()

	// Form state
	let formData = $state<CreateFacility>({
		name: '',
		address: '',
		type: '',
		reference: '',
		description: '',
		image: '',
		contacts: {},
		parking: {}
	})

	let isLoading = $state(false)
	let formErrors = $state<Record<string, string>>({})
	let submitError = $state<string | null>(null)

	// Contact fields state
	let contactFields = $state([{ key: '', value: '' }])
	let parkingFields = $state([{ key: '', value: '' }])

	// Facility types
	let facilityTypes = $state<FacilityType[]>([])
	let loadingTypes = $state(false)

	onMount(async () => {
		await loadFacilityTypes()
	})

	async function loadFacilityTypes() {
		loadingTypes = true
		try {
			const result = await facilityTypesStore.fetchAll({ limit: 1000 })
			facilityTypes = result.data.filter(type => type.active)
		} catch (error) {
			console.error('Failed to load facility types:', error)
		} finally {
			loadingTypes = false
		}
	}

	// Validation helper
	function validateField(field: keyof CreateFacility, value: any) {
		try {
			const fieldSchema = createFacilitySchema.shape[field]
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
	function handleInputChange(field: keyof CreateFacility, value: any) {
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
		formData = {
			name: '',
			address: '',
			facility_type_id: null,
			reference: '',
			description: '',
			image: '',
			contacts: {},
			parking: {}
		}
		contactFields = [{ key: '', value: '' }]
		parkingFields = [{ key: '', value: '' }]
		formErrors = {}
		submitError = null
		isLoading = false
	}

	async function handleSubmit(event?: SubmitEvent | MouseEvent) {
		event?.preventDefault()
		// Reset previous errors
		formErrors = {}
		submitError = null

		// Validate the entire form
		try {
			createFacilitySchema.parse(formData)
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
			formErrors.name = 'Facility name is required'
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
				const value = cleanData[key as keyof CreateFacility]
				if (typeof value === 'string' && value.trim() === '') {
					delete cleanData[key as keyof CreateFacility]
				}
			})

			const newFacility = await facilitiesStore.create(cleanData)
			
			dispatch('success', { facility: newFacility })
			dispatch('close')
			resetForm()
		} catch (error) {
			console.error('Failed to create facility:', error)
			submitError = error instanceof Error ? error.message : 'Failed to create facility. Please try again.'
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

</script>

<Modal 
	{open}
	title="Add New Facility"
	size="xl"
	loading={isLoading}
	closeable={!isLoading}
	on:close={handleClose}
>
	<form onsubmit={handleSubmit} class="space-y-6">
		{#if submitError}
			<div class="alert alert-error">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{submitError}</span>
			</div>
		{/if}

		<!-- Basic Information -->
		<div class="space-y-4">
			<h3 class="text-lg font-semibold border-b pb-2">Facility Information</h3>

			<div class="form-control w-full">
				<label class="label" for="facility-name">
					<span class="label-text">Facility Name <span class="text-error">*</span></span>
				</label>
				<input
					id="facility-name"
					type="text"
					class="input input-bordered w-full {formErrors.name ? 'input-error' : ''}"
					value={formData.name || ''}
					oninput={(e) => handleInputChange('name', e.currentTarget.value)}
					placeholder="Enter facility name"
					required
				/>
				{#if formErrors.name}
					<label class="label">
						<span class="label-text-alt text-error">{formErrors.name}</span>
					</label>
				{/if}
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div class="form-control w-full">
					<label class="label" for="facility-type">
						<span class="label-text">Facility Type</span>
					</label>
					{#if loadingTypes}
						<select
							id="facility-type"
							class="select select-bordered w-full"
							disabled
						>
							<option>Loading types...</option>
						</select>
					{:else}
						<select
							id="facility-type"
							class="select select-bordered w-full {formErrors.facility_type_id ? 'select-error' : ''}"
							value={formData.facility_type_id?.toString() || ''}
							onchange={(e) => handleInputChange('facility_type_id', e.currentTarget.value ? Number(e.currentTarget.value) : null)}
						>
							<option value="">Select facility type</option>
							{#each facilityTypes as type}
								<option value={type.id?.toString()}>{type.name}</option>
							{/each}
						</select>
					{/if}
					{#if formErrors.facility_type_id}
						<label class="label">
							<span class="label-text-alt text-error">{formErrors.facility_type_id}</span>
						</label>
					{/if}
				</div>

				<div class="form-control w-full">
					<label class="label" for="facility-reference">
						<span class="label-text">Reference</span>
					</label>
					<input
						id="facility-reference"
						type="text"
						class="input input-bordered w-full {formErrors.reference ? 'input-error' : ''}"
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
			</div>

			<div class="form-control w-full">
				<label class="label" for="facility-address">
					<span class="label-text">Address</span>
				</label>
				<textarea
					id="facility-address"
					class="textarea textarea-bordered w-full h-20 {formErrors.address ? 'textarea-error' : ''}"
					value={formData.address || ''}
					oninput={(e) => handleInputChange('address', e.currentTarget.value)}
					placeholder="Enter full address..."
					maxlength="500"
				></textarea>
				{#if formErrors.address}
					<label class="label">
						<span class="label-text-alt text-error">{formErrors.address}</span>
					</label>
				{/if}
			</div>

			<div class="form-control w-full">
				<label class="label" for="facility-image">
					<span class="label-text">Image URL</span>
				</label>
				<input
					id="facility-image"
					type="url"
					class="input input-bordered w-full {formErrors.image ? 'input-error' : ''}"
					value={formData.image || ''}
					oninput={(e) => handleInputChange('image', e.currentTarget.value)}
					placeholder="https://example.com/facility-image.jpg"
				/>
				{#if formErrors.image}
					<label class="label">
						<span class="label-text-alt text-error">{formErrors.image}</span>
					</label>
				{/if}
			</div>

			<div class="form-control w-full">
				<label class="label" for="facility-description">
					<span class="label-text">Facility Description</span>
				</label>
				<textarea
					id="facility-description"
					class="textarea textarea-bordered w-full h-24 {formErrors.description ? 'textarea-error' : ''}"
					value={formData.description || ''}
					oninput={(e) => handleInputChange('description', e.currentTarget.value)}
					placeholder="Describe the facility, its features, capacity, and amenities..."
					maxlength="2000"
				></textarea>
				{#if formErrors.description}
					<label class="label">
						<span class="label-text-alt text-error">{formErrors.description}</span>
					</label>
				{/if}
			</div>
		</div>

		<!-- Contact Information -->
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<h3 class="text-lg font-semibold border-b pb-2">Contact Information</h3>
				<button
					type="button"
					class="btn btn-sm btn-outline"
					onclick={addContactField}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
				</button>
			</div>
			{#each contactFields as field, index}
				<div class="grid grid-cols-5 gap-2">
					<input
						type="text"
						class="input input-bordered input-sm col-span-2"
						bind:value={field.key}
						placeholder="Type (e.g., phone)"
					/>
					<input
						type="text"
						class="input input-bordered input-sm col-span-2"
						bind:value={field.value}
						placeholder="Value"
					/>
					<button
						type="button"
						class="btn btn-sm btn-square btn-outline btn-error"
						onclick={() => removeContactField(index)}
						disabled={contactFields.length === 1}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/each}
		</div>

		<!-- Parking Information -->
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<h3 class="text-lg font-semibold border-b pb-2">Parking Information</h3>
				<button
					type="button"
					class="btn btn-sm btn-outline"
					onclick={addParkingField}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
				</button>
			</div>
			{#each parkingFields as field, index}
				<div class="grid grid-cols-5 gap-2">
					<input
						type="text"
						class="input input-bordered input-sm col-span-2"
						bind:value={field.key}
						placeholder="Type (e.g., street, garage)"
					/>
					<input
						type="text"
						class="input input-bordered input-sm col-span-2"
						bind:value={field.value}
						placeholder="Details (e.g., free, $5/hour)"
					/>
					<button
						type="button"
						class="btn btn-sm btn-square btn-outline btn-error"
						onclick={() => removeParkingField(index)}
						disabled={parkingFields.length === 1}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/each}
		</div>
	</form>

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
			disabled={isLoading || !formData.name?.trim()}
		>
			{#if isLoading}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
			{/if}
			Create Facility
		</button>
	</svelte:fragment>
</Modal>