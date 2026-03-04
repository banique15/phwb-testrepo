<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import Modal from '$lib/components/ui/Modal.svelte'
	import { createLocationContactSchema, type LocationContact, type CreateLocationContact, CONTACT_TYPES } from '$lib/schemas/locationContact'
	import { locationContactsStore } from '$lib/stores/locationContacts'
	import { z } from 'zod'

	interface Props {
		open?: boolean
		locationId?: number
	}

	let { open = false, locationId }: Props = $props()

	// Debug: log when locationId prop changes
	$effect(() => {
		if (locationId !== undefined) {
			console.log('CreateLocationContact received locationId:', locationId, 'type:', typeof locationId)
		}
	})

	const dispatch = createEventDispatcher<{
		close: void
		success: { contact: LocationContact }
	}>()

	// Ensure locationId is a number (convert from string if needed)
	const initialLocationId = locationId 
		? (typeof locationId === 'string' ? Number(locationId) : locationId)
		: 0

	let formData = $state<CreateLocationContact>({
		location_id: isNaN(initialLocationId) ? 0 : initialLocationId,
		name: '',
		title: null,
		role: null,
		email: null,
		phone: null,
		phone_ext: null,
		primary_contact: false,
		contact_type: 'general',
		availability_notes: null,
		active: true,
		notes: null,
	})

	let isLoading = $state(false)
	let formErrors = $state<Record<string, string>>({})
	let submitError = $state<string | null>(null)

	$effect(() => {
		if (locationId) {
			// Ensure locationId is a number (convert from string if needed)
			const numLocationId = typeof locationId === 'string' ? Number(locationId) : locationId
			formData.location_id = isNaN(numLocationId) ? 0 : numLocationId
		} else {
			// Reset to 0 if locationId becomes undefined
			formData.location_id = 0
		}
	})

	function validateField(field: keyof CreateLocationContact, value: any) {
		try {
			const fieldSchema = createLocationContactSchema.shape[field]
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

	function handleInputChange(field: keyof CreateLocationContact, value: any) {
		// Trim string values and convert empty strings to null for optional fields
		let processedValue: any = value
		if (typeof value === 'string') {
			processedValue = value.trim()
			// Convert empty strings to null for optional fields (except name which is required)
			if (processedValue === '' && field !== 'name' && field !== 'location_id') {
				processedValue = null
			}
		}
		// Update formData - create new object to ensure reactivity
		formData = { ...formData, [field]: processedValue }
		validateField(field, processedValue)
		submitError = null
	}

	async function handleSubmit(event?: SubmitEvent | MouseEvent) {
		event?.preventDefault()

		formErrors = {}
		submitError = null
		isLoading = true

		// Validate location_id first
		if (!formData.location_id || formData.location_id < 1 || isNaN(formData.location_id)) {
			formErrors.location_id = 'Location is required'
			submitError = 'Please select a valid location before creating a contact'
			isLoading = false
			return
		}

		// Prepare data for validation - ensure empty strings are null for optional fields
		// CRITICAL: Ensure location_id is a number, not a string or UUID
		// Check if location_id is a UUID string (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
		let locationIdNum: number
		
		if (typeof formData.location_id === 'string') {
			// If it's a UUID string, it's invalid - location_id must be a number
			if (uuidRegex.test(formData.location_id)) {
				console.error('Invalid location_id: received UUID string instead of number:', formData.location_id)
				formErrors.location_id = 'Invalid location: location ID must be a number, not a UUID'
				submitError = 'Invalid location ID. Please select a location again.'
				isLoading = false
				return
			}
			locationIdNum = Number(formData.location_id)
		} else {
			locationIdNum = formData.location_id
		}
		
		if (isNaN(locationIdNum) || locationIdNum < 1) {
			formErrors.location_id = 'Location is required'
			submitError = 'Please select a valid location before creating a contact'
			isLoading = false
			return
		}

		const dataToValidate: CreateLocationContact = {
			...formData,
			location_id: locationIdNum, // Explicitly set as number
			name: formData.name.trim(),
			title: formData.title?.trim() || null,
			role: formData.role?.trim() || null,
			email: formData.email?.trim() || null,
			phone: formData.phone?.trim() || null,
			phone_ext: formData.phone_ext?.trim() || null,
			availability_notes: formData.availability_notes?.trim() || null,
			notes: formData.notes?.trim() || null,
		}

		try {
			createLocationContactSchema.parse(dataToValidate)
		} catch (error) {
			if (error instanceof z.ZodError) {
				error.errors.forEach((err) => {
					const path = err.path[0] as string
					formErrors[path] = err.message
				})
				formErrors = { ...formErrors }
				// Show a general error message if validation fails
				if (error.errors.length > 0) {
					const firstError = error.errors[0]
					submitError = `${firstError.path.join('.')}: ${firstError.message}`
				}
			}
			isLoading = false
			return
		}

		try {
			// Final safety check: ensure location_id is definitely a number before sending
			// Check for UUID strings one more time
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
			let finalLocationId: number
			
			if (typeof dataToValidate.location_id === 'string') {
				if (uuidRegex.test(dataToValidate.location_id)) {
					throw new Error(`Invalid location_id: received UUID string "${dataToValidate.location_id}" instead of a number. Please select a location again.`)
				}
				finalLocationId = Number(dataToValidate.location_id)
			} else {
				finalLocationId = dataToValidate.location_id
			}
			
			// Double-check it's valid
			if (isNaN(finalLocationId) || finalLocationId < 1) {
				throw new Error('Invalid location_id: must be a positive number')
			}
			
			// Ensure id is not included (should be omitted by schema, but double-check)
			const { id, created_at, updated_at, ...dataWithoutId } = dataToValidate
			const finalData: CreateLocationContact = {
				...dataWithoutId,
				location_id: finalLocationId
			}
			
			console.log('Creating location contact with data:', { 
				...finalData, 
				location_id: finalData.location_id, 
				location_id_type: typeof finalData.location_id,
				has_id_field: 'id' in finalData
			})
			
			const newContact = await locationContactsStore.create(finalData)
			dispatch('success', { contact: newContact })
			resetForm()
		} catch (error: any) {
			submitError = error.message || 'Failed to create location contact'
			console.error('Error creating location contact:', error)
		} finally {
			isLoading = false
		}
	}

	function resetForm() {
		// Ensure locationId is a number (convert from string if needed)
		const numLocationId = locationId 
			? (typeof locationId === 'string' ? Number(locationId) : locationId)
			: 0
		formData = {
			location_id: isNaN(numLocationId) ? 0 : numLocationId,
			name: '',
			title: null,
			role: null,
			email: null,
			phone: null,
			phone_ext: null,
			primary_contact: false,
			contact_type: 'general',
			availability_notes: null,
			active: true,
			notes: null,
		}
		formErrors = {}
		submitError = null
	}

	function handleClose() {
		if (!isLoading) {
			resetForm()
			dispatch('close')
		}
	}
</script>

<Modal {open} title="Add Location Contact" size="lg" on:close={handleClose}>
	<form onsubmit={handleSubmit} class="space-y-4">
		{#if submitError}
			<div class="alert alert-error">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{submitError}</span>
			</div>
		{/if}

		<!-- Location ID validation error (if no location selected) -->
		{#if formErrors.location_id}
			<div class="alert alert-warning">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
				<span>{formErrors.location_id}</span>
			</div>
		{/if}

		<!-- Contact Name -->
		<div class="form-control w-full">
			<label class="label">
				<span class="label-text">Contact Name <span class="text-error">*</span></span>
			</label>
			<input
				type="text"
				placeholder="e.g., John Smith"
				class="input input-bordered w-full"
				class:input-error={formErrors.name}
				value={formData.name}
				oninput={(e) => handleInputChange('name', e.currentTarget.value)}
				disabled={isLoading}
				required
			/>
			{#if formErrors.name}
				<label class="label">
					<span class="label-text-alt text-error">{formErrors.name}</span>
				</label>
			{/if}
		</div>

		<!-- Title and Role -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div class="form-control w-full">
				<label class="label">
					<span class="label-text">Title</span>
				</label>
				<input
					type="text"
					placeholder="e.g., Facility Manager"
					class="input input-bordered w-full"
					class:input-error={formErrors.title}
					value={formData.title || ''}
					oninput={(e) => handleInputChange('title', e.currentTarget.value)}
					disabled={isLoading}
				/>
			</div>

			<div class="form-control w-full">
				<label class="label">
					<span class="label-text">Role</span>
				</label>
				<input
					type="text"
					placeholder="e.g., Site Coordinator"
					class="input input-bordered w-full"
					class:input-error={formErrors.role}
					value={formData.role || ''}
					oninput={(e) => handleInputChange('role', e.currentTarget.value)}
					disabled={isLoading}
				/>
			</div>
		</div>

		<!-- Email and Phone -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div class="form-control w-full">
				<label class="label">
					<span class="label-text">Email</span>
				</label>
				<input
					type="email"
					placeholder="contact@example.com"
					class="input input-bordered w-full"
					class:input-error={formErrors.email}
					value={formData.email || ''}
					oninput={(e) => handleInputChange('email', e.currentTarget.value)}
					disabled={isLoading}
				/>
				{#if formErrors.email}
					<label class="label">
						<span class="label-text-alt text-error">{formErrors.email}</span>
					</label>
				{/if}
			</div>

			<div class="form-control w-full">
				<label class="label">
					<span class="label-text">Phone</span>
				</label>
				<div class="flex gap-2">
					<input
						type="tel"
						placeholder="(555) 123-4567"
						class="input input-bordered w-full"
						class:input-error={formErrors.phone}
						value={formData.phone || ''}
						oninput={(e) => handleInputChange('phone', e.currentTarget.value)}
						disabled={isLoading}
					/>
					<input
						type="text"
						placeholder="Ext"
						class="input input-bordered w-20"
						value={formData.phone_ext || ''}
						oninput={(e) => handleInputChange('phone_ext', e.currentTarget.value)}
						disabled={isLoading}
					/>
				</div>
			</div>
		</div>

		<!-- Contact Type -->
		<div class="form-control w-full">
			<label class="label">
				<span class="label-text">Contact Type</span>
			</label>
			<select
				class="select select-bordered w-full"
				value={formData.contact_type}
				onchange={(e) => handleInputChange('contact_type', e.currentTarget.value)}
				disabled={isLoading}
			>
				{#each CONTACT_TYPES as type}
				<option value={type}>{type === 'production_manager' ? 'Production Manager' : type.charAt(0).toUpperCase() + type.slice(1)}</option>
				{/each}
			</select>
		</div>

		<!-- Availability Notes -->
		<div class="form-control w-full">
			<label class="label">
				<span class="label-text">Availability Notes</span>
			</label>
			<textarea
				class="textarea textarea-bordered w-full h-20"
				placeholder="e.g., Available Monday-Friday 9am-5pm"
				value={formData.availability_notes || ''}
				oninput={(e) => handleInputChange('availability_notes', e.currentTarget.value)}
				disabled={isLoading}
			></textarea>
		</div>

		<!-- Notes -->
		<div class="form-control w-full">
			<label class="label">
				<span class="label-text">Notes</span>
			</label>
			<textarea
				class="textarea textarea-bordered w-full h-20"
				placeholder="Additional notes..."
				value={formData.notes || ''}
				oninput={(e) => handleInputChange('notes', e.currentTarget.value)}
				disabled={isLoading}
			></textarea>
		</div>

		<!-- Checkboxes -->
		<div class="space-y-2">
			<div class="form-control w-full">
				<label class="label cursor-pointer justify-start gap-4">
					<input
						type="checkbox"
						class="checkbox"
						checked={formData.primary_contact}
						onchange={(e) => handleInputChange('primary_contact', e.currentTarget.checked)}
						disabled={isLoading}
					/>
					<span class="label-text">Primary Contact (main point of contact for this location)</span>
				</label>
			</div>

			<div class="form-control w-full">
				<label class="label cursor-pointer justify-start gap-4">
					<input
						type="checkbox"
						class="checkbox"
						checked={formData.active}
						onchange={(e) => handleInputChange('active', e.currentTarget.checked)}
						disabled={isLoading}
					/>
					<span class="label-text">Active</span>
				</label>
			</div>
		</div>

		<!-- Actions -->
		<div class="modal-action">
			<button type="button" class="btn" onclick={handleClose} disabled={isLoading}>
				Cancel
			</button>
			<button type="submit" class="btn btn-primary" disabled={isLoading}>
				{#if isLoading}
					<span class="loading loading-spinner"></span>
					Creating...
				{:else}
					Add Contact
				{/if}
			</button>
		</div>
	</form>
</Modal>
