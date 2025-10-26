<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import Modal from '$lib/components/ui/Modal.svelte'
	import { createPartnerSchema, type CreatePartner, type ContactPerson } from '$lib/schemas/partner'
	import { partnersStore } from '$lib/stores/partners'
	import { z } from 'zod'

	interface Props {
		open?: boolean
	}

	let { open = false }: Props = $props()

	const dispatch = createEventDispatcher<{
		close: void
		submit: { partner: any }
	}>()

	let formData = $state<CreatePartner>({
		name: '',
		organization: '',
		description: '',
		website: '',
		logo: '',
		contacts: [],
		history: {}
	})

	let errors = $state<Record<string, string>>({})
	let contactErrors = $state<Record<number, Record<string, string>>>({})
	let isSubmitting = $state(false)
	let submitError = $state<string | null>(null)

	function addContact() {
		if (!formData.contacts) {
			formData.contacts = []
		}
		formData.contacts.push({
			name: '',
			title: '',
			email: '',
			phone: '',
			address: '',
			isPrimary: formData.contacts.length === 0
		})
		formData = { ...formData }
	}

	function removeContact(index: number) {
		if (formData.contacts) {
			formData.contacts.splice(index, 1)

			// If we removed the primary contact and there are others, make the first one primary
			if (formData.contacts.length > 0 && !formData.contacts.some(c => c.isPrimary)) {
				formData.contacts[0].isPrimary = true
			}

			formData = { ...formData }

			// Clear errors for this contact
			if (contactErrors[index]) {
				delete contactErrors[index]
				contactErrors = { ...contactErrors }
			}
		}
	}

	function setPrimaryContact(index: number) {
		if (formData.contacts) {
			formData.contacts.forEach((contact, i) => {
				contact.isPrimary = i === index
			})
			formData = { ...formData }
		}
	}

	function validateForm() {
		errors = {}
		contactErrors = {}
		submitError = null

		try {
			createPartnerSchema.parse(formData)
		} catch (error) {
			if (error instanceof z.ZodError) {
				error.errors.forEach(err => {
					if (err.path.length > 0) {
						// Handle contact-specific errors
						if (err.path[0] === 'contacts' && err.path.length > 2) {
							const contactIndex = err.path[1] as number
							const field = err.path[2] as string
							if (!contactErrors[contactIndex]) {
								contactErrors[contactIndex] = {}
							}
							contactErrors[contactIndex][field] = err.message
						} else {
							errors[err.path[0] as string] = err.message
						}
					}
				})
				errors = { ...errors }
				contactErrors = { ...contactErrors }
				return false
			}
		}

		if (!formData.name?.trim()) {
			errors.name = 'Partner name is required'
			errors = { ...errors }
			return false
		}

		return true
	}

	function handleInputChange(field: keyof CreatePartner, value: string) {
		formData[field] = value as any
		if (errors[field]) {
			delete errors[field]
			errors = { ...errors }
		}
	}

	function handleContactChange(index: number, field: keyof ContactPerson, value: string | boolean) {
		if (formData.contacts && formData.contacts[index]) {
			(formData.contacts[index] as any)[field] = value
			formData = { ...formData }

			// Clear error for this field
			if (contactErrors[index]?.[field as string]) {
				delete contactErrors[index][field as string]
				contactErrors = { ...contactErrors }
			}
		}
	}

	function resetForm() {
		formData = {
			name: '',
			organization: '',
			description: '',
			website: '',
			logo: '',
			contacts: [],
			history: {}
		}
		errors = {}
		contactErrors = {}
		submitError = null
	}

async function handleSubmit(event?: SubmitEvent) {
	event?.preventDefault()
	if (!validateForm()) {
		return
	}

	isSubmitting = true
	submitError = null

	try {
		const cleanData: Partial<CreatePartner> = { ...formData }

		Object.keys(cleanData).forEach(key => {
			const value = cleanData[key as keyof CreatePartner]
			if (typeof value === 'string' && value.trim() === '') {
				if (key === 'website' || key === 'logo') {
					cleanData[key as keyof CreatePartner] = '' as any
				} else {
					delete cleanData[key as keyof CreatePartner]
				}
			}
		})

		// Clean up empty contacts
		if (cleanData.contacts && Array.isArray(cleanData.contacts)) {
			cleanData.contacts = cleanData.contacts.filter(contact =>
				contact.name && contact.name.trim() !== ''
			)

			// Remove the contacts field if empty
			if (cleanData.contacts.length === 0) {
				delete cleanData.contacts
			}
		}

		if (cleanData.history && Object.keys(cleanData.history).length === 0) {
			delete cleanData.history
		}

		const newPartner = await partnersStore.create(cleanData as CreatePartner)
		dispatch('submit', { partner: newPartner })
		dispatch('close')
		resetForm()
	} catch (error) {
		console.error('Failed to create partner:', error)
		submitError = error instanceof Error ? error.message : 'Failed to create partner'
	} finally {
		isSubmitting = false
	}
}

	function handleClose() {
		if (isSubmitting) return
		resetForm()
		dispatch('close')
	}
</script>

<Modal
	{open}
	title="Add New Partner"
	size="xl"
	loading={isSubmitting}
	closeable={!isSubmitting}
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

		<div class="space-y-4">
			<h3 class="text-lg font-semibold border-b pb-2">Partner Information</h3>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div class="form-control">
					<label class="label" for="partner-name">
						<span class="label-text">Partner Name <span class="text-error">*</span></span>
					</label>
					<input
						id="partner-name"
						type="text"
						class="input input-bordered {errors.name ? 'input-error' : ''}"
						value={formData.name || ''}
						oninput={(e) => handleInputChange('name', e.currentTarget.value)}
						placeholder="Sing for Hope"
						required
					/>
					{#if errors.name}
						<label class="label">
							<span class="label-text-alt text-error">{errors.name}</span>
						</label>
					{/if}
				</div>

				<div class="form-control">
					<label class="label" for="partner-organization">
						<span class="label-text">Organization</span>
					</label>
					<input
						id="partner-organization"
						type="text"
						class="input input-bordered"
						value={formData.organization || ''}
						oninput={(e) => handleInputChange('organization', e.currentTarget.value)}
						placeholder="Organization name"
					/>
				</div>

				<div class="form-control">
					<label class="label" for="partner-website">
						<span class="label-text">Website</span>
					</label>
					<input
						id="partner-website"
						type="url"
						class="input input-bordered"
						value={formData.website || ''}
						oninput={(e) => handleInputChange('website', e.currentTarget.value)}
						placeholder="https://example.org"
					/>
				</div>

				<div class="form-control">
					<label class="label" for="partner-logo">
						<span class="label-text">Logo URL</span>
					</label>
					<input
						id="partner-logo"
						type="url"
						class="input input-bordered"
						value={formData.logo || ''}
						oninput={(e) => handleInputChange('logo', e.currentTarget.value)}
						placeholder="https://example.org/logo.png"
					/>
				</div>
			</div>
		</div>

		<div class="space-y-4">
			<div class="flex items-center justify-between border-b pb-2">
				<h3 class="text-lg font-semibold">Contacts</h3>
				<button type="button" class="btn btn-sm btn-outline btn-primary" onclick={addContact}>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
					Add Contact
				</button>
			</div>

			{#if formData.contacts && formData.contacts.length > 0}
				<div class="space-y-4">
					{#each formData.contacts as contact, index}
						<div class="card bg-base-200 p-4">
							<div class="flex items-center justify-between mb-3">
								<div class="flex items-center gap-2">
									<span class="font-semibold text-sm">Contact {index + 1}</span>
									{#if contact.isPrimary}
										<span class="badge badge-primary badge-sm">Primary</span>
									{/if}
								</div>
								<div class="flex gap-2">
									{#if !contact.isPrimary && formData.contacts && formData.contacts.length > 1}
										<button
											type="button"
											class="btn btn-xs btn-outline"
											onclick={() => setPrimaryContact(index)}
											title="Set as primary contact"
										>
											Set Primary
										</button>
									{/if}
									<button
										type="button"
										class="btn btn-xs btn-error btn-outline"
										onclick={() => removeContact(index)}
										title="Remove contact"
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							</div>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
								<div class="form-control">
									<label class="label py-1" for={`contact-name-${index}`}>
										<span class="label-text text-xs">Name <span class="text-error">*</span></span>
									</label>
									<input
										id={`contact-name-${index}`}
										type="text"
										class="input input-bordered input-sm {contactErrors[index]?.name ? 'input-error' : ''}"
										value={contact.name || ''}
										oninput={(e) => handleContactChange(index, 'name', e.currentTarget.value)}
										placeholder="John Doe"
									/>
									{#if contactErrors[index]?.name}
										<label class="label py-0">
											<span class="label-text-alt text-error text-xs">{contactErrors[index].name}</span>
										</label>
									{/if}
								</div>

								<div class="form-control">
									<label class="label py-1" for={`contact-title-${index}`}>
										<span class="label-text text-xs">Title</span>
									</label>
									<input
										id={`contact-title-${index}`}
										type="text"
										class="input input-bordered input-sm"
										value={contact.title || ''}
										oninput={(e) => handleContactChange(index, 'title', e.currentTarget.value)}
										placeholder="General Manager"
									/>
								</div>

								<div class="form-control">
									<label class="label py-1" for={`contact-email-${index}`}>
										<span class="label-text text-xs">Email</span>
									</label>
									<input
										id={`contact-email-${index}`}
										type="email"
										class="input input-bordered input-sm {contactErrors[index]?.email ? 'input-error' : ''}"
										value={contact.email || ''}
										oninput={(e) => handleContactChange(index, 'email', e.currentTarget.value)}
										placeholder="john@example.org"
									/>
									{#if contactErrors[index]?.email}
										<label class="label py-0">
											<span class="label-text-alt text-error text-xs">{contactErrors[index].email}</span>
										</label>
									{/if}
								</div>

								<div class="form-control">
									<label class="label py-1" for={`contact-phone-${index}`}>
										<span class="label-text text-xs">Phone</span>
									</label>
									<input
										id={`contact-phone-${index}`}
										type="tel"
										class="input input-bordered input-sm"
										value={contact.phone || ''}
										oninput={(e) => handleContactChange(index, 'phone', e.currentTarget.value)}
										placeholder="(555) 123-4567"
									/>
								</div>

								<div class="form-control md:col-span-2">
									<label class="label py-1" for={`contact-address-${index}`}>
										<span class="label-text text-xs">Address</span>
									</label>
									<textarea
										id={`contact-address-${index}`}
										class="textarea textarea-bordered textarea-sm"
										value={contact.address || ''}
										oninput={(e) => handleContactChange(index, 'address', e.currentTarget.value)}
										rows={2}
										placeholder="123 Main St, City, State"
									></textarea>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-center py-8 text-base-content/60">
					<p class="text-sm">No contacts added yet. Click "Add Contact" to add one.</p>
				</div>
			{/if}
		</div>

		<div>
			<label class="label" for="partner-description">
				<span class="label-text">Description</span>
			</label>
			<textarea
				id="partner-description"
				class="textarea textarea-bordered w-full"
				rows={4}
				value={formData.description || ''}
				oninput={(e) => handleInputChange('description', e.currentTarget.value)}
				placeholder="Provide a brief description of the partner"
			></textarea>
		</div>

		<div class="modal-action">
			<button type="button" class="btn btn-ghost" onclick={handleClose} disabled={isSubmitting}>Cancel</button>
			<button type="submit" class="btn btn-primary" disabled={isSubmitting}>Create Partner</button>
		</div>
	</form>
</Modal>
