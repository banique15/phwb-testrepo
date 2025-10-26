<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import Modal from '$lib/components/ui/Modal.svelte'
	import { updatePartnerSchema, type Partner, type UpdatePartner } from '$lib/schemas/partner'
	import { partnersStore } from '$lib/stores/partners'
	import { z } from 'zod'

	interface Props {
		open?: boolean
		partner?: Partner | null
	}

	let { open = false, partner = null }: Props = $props()

	const dispatch = createEventDispatcher<{
		close: void
		success: { partner: Partner }
	}>()

	// Form state
	let formData = $state<UpdatePartner>({})
	let isLoading = $state(false)
	let formErrors = $state<Record<string, string>>({})
	let submitError = $state<string | null>(null)

	// Contact fields for easier management
	let contactEmail = $state('')
	let contactPhone = $state('')
	let contactAddress = $state('')
	let contactPerson = $state('')

	// Initialize form when partner changes
	$effect(() => {
		if (partner && open) {
			formData = {
				name: partner.name || '',
				organization: partner.organization || '',
				description: partner.description || '',
				website: partner.website || '',
				logo: partner.logo || '',
				contacts: partner.contacts || {},
				history: partner.history || {}
			}

			// Initialize contact fields
			const contacts = partner.contacts || {}
			contactEmail = contacts.email || ''
			contactPhone = contacts.phone || ''
			contactAddress = contacts.address || ''
			contactPerson = contacts.contact_person || ''
		}
	})

	// Update contacts object when individual fields change
	$effect(() => {
		if (formData) {
			formData.contacts = {
				...(contactEmail && { email: contactEmail }),
				...(contactPhone && { phone: contactPhone }),
				...(contactAddress && { address: contactAddress }),
				...(contactPerson && { contact_person: contactPerson })
			}
		}
	})

	// Validation helper
	function validateField(field: keyof UpdatePartner, value: any) {
		try {
			const fieldSchema = updatePartnerSchema.shape[field]
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
	function handleInputChange(field: keyof UpdatePartner, value: any) {
		formData[field] = value
		validateField(field, value)
		submitError = null
	}

	function resetForm() {
		formData = {}
		contactEmail = ''
		contactPhone = ''
		contactAddress = ''
		contactPerson = ''
		formErrors = {}
		submitError = null
		isLoading = false
	}

	async function handleSubmit(event?: SubmitEvent | MouseEvent) {
		event?.preventDefault()
		if (!partner?.id) return

		// Reset previous errors
		formErrors = {}
		submitError = null

		// Validate the entire form
		try {
			updatePartnerSchema.parse(formData)
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
			formErrors.name = 'Partner name is required'
			formErrors = { ...formErrors }
			return
		}

		isLoading = true

		try {
			// Clean up data before submission
			const cleanData = { ...formData }
			
			// Remove empty strings and convert to null/undefined where appropriate
			Object.keys(cleanData).forEach(key => {
				const value = cleanData[key as keyof UpdatePartner]
				if (typeof value === 'string' && value.trim() === '') {
					delete cleanData[key as keyof UpdatePartner]
				}
			})

			// Clean up empty contacts object
			if (cleanData.contacts && Object.keys(cleanData.contacts).length === 0) {
				delete cleanData.contacts
			}

			// Clean up empty history object
			if (cleanData.history && Object.keys(cleanData.history).length === 0) {
				delete cleanData.history
			}

			const updatedPartner = await partnersStore.update(partner.id, cleanData)
			
			dispatch('success', { partner: updatedPartner })
			dispatch('close')
		} catch (error) {
			console.error('Failed to update partner:', error)
			submitError = error instanceof Error ? error.message : 'Failed to update partner. Please try again.'
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
	title="Edit Partner"
	size="xl"
	loading={isLoading}
	closeable={!isLoading}
	on:close={handleClose}
>
	{#if partner}
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
					<h3 class="text-lg font-semibold border-b pb-2">Basic Information</h3>
					
					<div class="form-control">
						<label class="label" for="edit-partner-name">
							<span class="label-text">Partner Name <span class="text-error">*</span></span>
						</label>
						<input 
							id="edit-partner-name"
							type="text" 
							class="input input-bordered {formErrors.name ? 'input-error' : ''}"
							value={formData.name || ''}
							oninput={(e) => handleInputChange('name', e.currentTarget.value)}
							placeholder="Enter partner name"
							required
						/>
						{#if formErrors.name}
							<label class="label">
								<span class="label-text-alt text-error">{formErrors.name}</span>
							</label>
						{/if}
					</div>

					<div class="form-control">
						<label class="label" for="edit-partner-organization">
							<span class="label-text">Organization</span>
						</label>
						<input 
							id="edit-partner-organization"
							type="text" 
							class="input input-bordered {formErrors.organization ? 'input-error' : ''}"
							value={formData.organization || ''}
							oninput={(e) => handleInputChange('organization', e.currentTarget.value)}
							placeholder="Enter organization name"
						/>
						{#if formErrors.organization}
							<label class="label">
								<span class="label-text-alt text-error">{formErrors.organization}</span>
							</label>
						{/if}
					</div>

					<div class="form-control">
						<label class="label" for="edit-partner-website">
							<span class="label-text">Website</span>
						</label>
						<input 
							id="edit-partner-website"
							type="url" 
							class="input input-bordered {formErrors.website ? 'input-error' : ''}"
							value={formData.website || ''}
							oninput={(e) => handleInputChange('website', e.currentTarget.value)}
							placeholder="https://partner-website.com"
						/>
						{#if formErrors.website}
							<label class="label">
								<span class="label-text-alt text-error">{formErrors.website}</span>
							</label>
						{/if}
					</div>

					<div class="form-control">
						<label class="label" for="edit-partner-logo">
							<span class="label-text">Logo URL</span>
						</label>
						<input 
							id="edit-partner-logo"
							type="url" 
							class="input input-bordered {formErrors.logo ? 'input-error' : ''}"
							value={formData.logo || ''}
							oninput={(e) => handleInputChange('logo', e.currentTarget.value)}
							placeholder="https://example.com/logo.png"
						/>
						{#if formErrors.logo}
							<label class="label">
								<span class="label-text-alt text-error">{formErrors.logo}</span>
							</label>
						{/if}
					</div>
				</div>

				<!-- Contact Information -->
				<div class="space-y-4">
					<h3 class="text-lg font-semibold border-b pb-2">Contact Information</h3>

					<div class="form-control">
						<label class="label" for="edit-contact-person">
							<span class="label-text">Contact Person</span>
						</label>
						<input 
							id="edit-contact-person"
							type="text" 
							class="input input-bordered"
							bind:value={contactPerson}
							placeholder="Primary contact name"
						/>
					</div>

					<div class="form-control">
						<label class="label" for="edit-contact-email">
							<span class="label-text">Email</span>
						</label>
						<input 
							id="edit-contact-email"
							type="email" 
							class="input input-bordered"
							bind:value={contactEmail}
							placeholder="contact@partner.com"
						/>
					</div>

					<div class="form-control">
						<label class="label" for="edit-contact-phone">
							<span class="label-text">Phone</span>
						</label>
						<input 
							id="edit-contact-phone"
							type="tel" 
							class="input input-bordered"
							bind:value={contactPhone}
							placeholder="+1 (555) 123-4567"
						/>
					</div>

					<div class="form-control">
						<label class="label" for="edit-contact-address">
							<span class="label-text">Address</span>
						</label>
						<textarea 
							id="edit-contact-address"
							class="textarea textarea-bordered h-20"
							bind:value={contactAddress}
							placeholder="Business address"
						></textarea>
					</div>
				</div>
			</div>

			<!-- Description -->
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Description</h3>
				
				<div class="form-control">
					<label class="label" for="edit-partner-description">
						<span class="label-text">Partnership Description</span>
					</label>
					<textarea 
						id="edit-partner-description"
						class="textarea textarea-bordered h-24 {formErrors.description ? 'textarea-error' : ''}"
						value={formData.description || ''}
						oninput={(e) => handleInputChange('description', e.currentTarget.value)}
						placeholder="Describe the partnership, collaboration details, etc."
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
	{:else}
		<div class="text-center py-8">
			<p class="text-lg">No partner selected</p>
			<p class="text-sm opacity-60">Please select a partner to edit</p>
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
			disabled={isLoading || !formData.name?.trim() || !partner}
		>
			{#if isLoading}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
				</svg>
			{/if}
			Update Partner
		</button>
	</svelte:fragment>
</Modal>