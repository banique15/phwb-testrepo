<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import Modal from '$lib/components/ui/Modal.svelte'
	import { createProgramSchema, type CreateProgram } from '$lib/schemas/program'
	import { programsStore } from '$lib/stores/programs'
	import { z } from 'zod'

	interface Props {
		open?: boolean
	}

	let { open = false }: Props = $props()

	const dispatch = createEventDispatcher<{
		close: void
		success: { program: any }
	}>()

	// Form state
	let formData = $state<CreateProgram>({
		title: '',
		description: '',
		geo_coverage: '',
		start_date: '',
		end_date: '',
		partner: undefined
	})

	let isLoading = $state(false)
	let formErrors = $state<Record<string, string>>({})
	let submitError = $state<string | null>(null)

	// Validation helper
	function validateField(field: keyof CreateProgram, value: any) {
		try {
			const fieldSchema = createProgramSchema.shape[field]
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
	function handleInputChange(field: keyof CreateProgram, value: any) {
		formData[field] = value
		validateField(field, value)
		submitError = null
	}

	function resetForm() {
		formData = {
			title: '',
			description: '',
			geo_coverage: '',
			start_date: '',
			end_date: '',
			partner: undefined
		}
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
			createProgramSchema.parse(formData)
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
		if (!formData.title?.trim()) {
			formErrors.title = 'Program title is required'
			formErrors = { ...formErrors }
			return
		}

		// Validate date logic
		if (formData.start_date && formData.end_date) {
			const startDate = new Date(formData.start_date)
			const endDate = new Date(formData.end_date)
			if (endDate <= startDate) {
				formErrors.end_date = 'End date must be after start date'
				formErrors = { ...formErrors }
				return
			}
		}

		isLoading = true

		try {
			// Clean up data before submission
			const cleanData = { ...formData }
			
			// Remove empty strings and convert to null/undefined where appropriate
			Object.keys(cleanData).forEach(key => {
				const value = cleanData[key as keyof CreateProgram]
				if (typeof value === 'string' && value.trim() === '') {
					delete cleanData[key as keyof CreateProgram]
				}
			})

			const newProgram = await programsStore.create(cleanData)
			
			dispatch('success', { program: newProgram })
			dispatch('close')
			resetForm()
		} catch (error) {
			console.error('Failed to create program:', error)
			submitError = error instanceof Error ? error.message : 'Failed to create program. Please try again.'
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

	// Get today's date for min date validation
	const today = new Date().toISOString().split('T')[0]
</script>

<Modal 
	{open}
	title="Add New Program"
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

		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- Basic Information -->
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Program Information</h3>
				
				<div class="form-control">
					<label class="label" for="program-title">
						<span class="label-text">Program Title <span class="text-error">*</span></span>
					</label>
					<input 
						id="program-title"
						type="text" 
						class="input input-bordered {formErrors.title ? 'input-error' : ''}"
						value={formData.title || ''}
						oninput={(e) => handleInputChange('title', e.currentTarget.value)}
						placeholder="Enter program title"
						required
					/>
					{#if formErrors.title}
						<label class="label">
							<span class="label-text-alt text-error">{formErrors.title}</span>
						</label>
					{/if}
				</div>

				<div class="form-control">
					<label class="label" for="program-geo-coverage">
						<span class="label-text">Geographic Coverage</span>
					</label>
					<input 
						id="program-geo-coverage"
						type="text" 
						class="input input-bordered {formErrors.geo_coverage ? 'input-error' : ''}"
						value={formData.geo_coverage || ''}
						oninput={(e) => handleInputChange('geo_coverage', e.currentTarget.value)}
						placeholder="e.g., National, Regional, Local"
					/>
					{#if formErrors.geo_coverage}
						<label class="label">
							<span class="label-text-alt text-error">{formErrors.geo_coverage}</span>
						</label>
					{/if}
				</div>

				<div class="form-control">
					<label class="label" for="program-partner">
						<span class="label-text">Partner ID</span>
					</label>
					<input 
						id="program-partner"
						type="number" 
						class="input input-bordered {formErrors.partner ? 'input-error' : ''}"
						value={formData.partner || ''}
						oninput={(e) => handleInputChange('partner', e.currentTarget.value ? Number(e.currentTarget.value) : undefined)}
						placeholder="Enter partner ID (optional)"
					/>
					{#if formErrors.partner}
						<label class="label">
							<span class="label-text-alt text-error">{formErrors.partner}</span>
						</label>
					{/if}
					<label class="label">
						<span class="label-text-alt">Leave empty if no partner assigned</span>
					</label>
				</div>
			</div>

			<!-- Timeline Information -->
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Timeline</h3>

				<div class="form-control">
					<label class="label" for="program-start-date">
						<span class="label-text">Start Date</span>
					</label>
					<input 
						id="program-start-date"
						type="date" 
						class="input input-bordered {formErrors.start_date ? 'input-error' : ''}"
						value={formData.start_date || ''}
						oninput={(e) => handleInputChange('start_date', e.currentTarget.value)}
					/>
					{#if formErrors.start_date}
						<label class="label">
							<span class="label-text-alt text-error">{formErrors.start_date}</span>
						</label>
					{/if}
				</div>

				<div class="form-control">
					<label class="label" for="program-end-date">
						<span class="label-text">End Date</span>
					</label>
					<input 
						id="program-end-date"
						type="date" 
						class="input input-bordered {formErrors.end_date ? 'input-error' : ''}"
						value={formData.end_date || ''}
						oninput={(e) => handleInputChange('end_date', e.currentTarget.value)}
						min={formData.start_date || today}
					/>
					{#if formErrors.end_date}
						<label class="label">
							<span class="label-text-alt text-error">{formErrors.end_date}</span>
						</label>
					{/if}
				</div>

				<!-- Duration Preview -->
				{#if formData.start_date && formData.end_date}
					{@const startDate = new Date(formData.start_date)}
					{@const endDate = new Date(formData.end_date)}
					{@const diffTime = Math.abs(endDate.getTime() - startDate.getTime())}
					{@const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))}
					<div class="alert alert-info">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span>
							Duration: {diffDays} days
							{#if diffDays >= 30}
								({Math.round(diffDays / 30)} months)
							{/if}
						</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Description -->
		<div class="space-y-4">
			<h3 class="text-lg font-semibold border-b pb-2">Description</h3>
			
			<div class="form-control">
				<label class="label" for="program-description">
					<span class="label-text">Program Description</span>
				</label>
				<textarea 
					id="program-description"
					class="textarea textarea-bordered h-24 {formErrors.description ? 'textarea-error' : ''}"
					value={formData.description || ''}
					oninput={(e) => handleInputChange('description', e.currentTarget.value)}
					placeholder="Describe the program objectives, activities, and goals..."
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
			disabled={isLoading || !formData.title?.trim()}
		>
			{#if isLoading}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
			{/if}
			Create Program
		</button>
	</svelte:fragment>
</Modal>