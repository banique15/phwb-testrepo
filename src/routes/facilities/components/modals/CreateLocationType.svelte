<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import Modal from '$lib/components/ui/Modal.svelte'
	import { locationTypesStore } from '$lib/stores/locationTypes'
	import { createLocationTypeSchema, type LocationType, type CreateLocationType, type UpdateLocationType } from '$lib/schemas/locationType'
	import { z } from 'zod'

	interface Props {
		open?: boolean
		locationType?: LocationType | null
	}

	let { open = false, locationType = null }: Props = $props()

	const dispatch = createEventDispatcher<{
		close: void
		success: { locationType: LocationType }
	}>()

	// Form state
	let formData = $state<CreateLocationType | UpdateLocationType>({
		name: '',
		description: '',
		active: true
	})

	let isLoading = $state(false)
	let formErrors = $state<Record<string, string>>({})
	let submitError = $state<string | null>(null)

	const isEditing = $derived(locationType !== null)
	const title = $derived(isEditing ? 'Edit Location Type' : 'Add Location Type')

	// Initialize form when locationType changes
	$effect(() => {
		if (locationType && open) {
			formData = {
				name: locationType.name || '',
				description: locationType.description || '',
				active: locationType.active ?? true
			}
		} else if (open && !locationType) {
			formData = {
				name: '',
				description: '',
				active: true
			}
		}
		formErrors = {}
		submitError = null
	})

	// Validation helper
	function validateField(field: keyof (CreateLocationType | UpdateLocationType), value: any) {
		try {
			const schema = isEditing ? createLocationTypeSchema : createLocationTypeSchema
			const fieldSchema = schema.shape[field]
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
	function handleInputChange(field: keyof (CreateLocationType | UpdateLocationType), value: any) {
		formData[field] = value
		validateField(field, value)
		submitError = null
	}

	function resetForm() {
		formData = {
			name: '',
			description: '',
			active: true
		}
		formErrors = {}
		submitError = null
		isLoading = false
	}

	async function handleSubmit(event?: SubmitEvent | MouseEvent) {
		event?.preventDefault()
		formErrors = {}
		submitError = null

		// Validate the entire form
		try {
			if (isEditing && locationType?.id) {
				createLocationTypeSchema.parse(formData)
			} else {
				createLocationTypeSchema.parse(formData)
			}
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
			formErrors.name = 'Type name is required'
			formErrors = { ...formErrors }
			return
		}

		isLoading = true

		try {
			let result: LocationType
			if (isEditing && locationType?.id) {
				result = await locationTypesStore.update(locationType.id, formData)
			} else {
				result = await locationTypesStore.create(formData as CreateLocationType)
			}

			dispatch('success', { locationType: result })
			dispatch('close')
			resetForm()
		} catch (error) {
			console.error('Failed to save location type:', error)
			submitError = error instanceof Error ? error.message : 'Failed to save location type. Please try again.'
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
	title={title}
	size="md"
	loading={isLoading}
	closeable={!isLoading}
	on:close={handleClose}
>
	<form onsubmit={handleSubmit} class="space-y-4">
		{#if submitError}
			<div class="alert alert-error">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{submitError}</span>
			</div>
		{/if}

		<div class="form-control w-full">
			<label class="label" for="type-name">
				<span class="label-text">Name <span class="text-error">*</span></span>
			</label>
			<input
				id="type-name"
				type="text"
				class="input input-bordered w-full {formErrors.name ? 'input-error' : ''}"
				value={formData.name || ''}
				oninput={(e) => handleInputChange('name', e.currentTarget.value)}
				placeholder="Enter type name"
				required
			/>
			{#if formErrors.name}
				<label class="label">
					<span class="label-text-alt text-error">{formErrors.name}</span>
				</label>
			{/if}
		</div>

		<div class="form-control w-full">
			<label class="label" for="type-description">
				<span class="label-text">Description</span>
			</label>
			<textarea
				id="type-description"
				class="textarea textarea-bordered w-full h-24 {formErrors.description ? 'textarea-error' : ''}"
				value={formData.description || ''}
				oninput={(e) => handleInputChange('description', e.currentTarget.value)}
				placeholder="Enter description (optional)"
				maxlength="500"
			></textarea>
			{#if formErrors.description}
				<label class="label">
					<span class="label-text-alt text-error">{formErrors.description}</span>
				</label>
			{/if}
		</div>

		<div class="form-control w-full">
			<label class="label cursor-pointer justify-start gap-4">
				<input
					type="checkbox"
					class="checkbox"
					checked={formData.active ?? true}
					onchange={(e) => handleInputChange('active', e.currentTarget.checked)}
				/>
				<span class="label-text">Active (available for selection)</span>
			</label>
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
				{isEditing ? 'Update' : 'Create'}
			{/if}
		</button>
	</svelte:fragment>
</Modal>
