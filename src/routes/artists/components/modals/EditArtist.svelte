<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { updateArtistSchema, type Artist, type UpdateArtist } from '$lib/schemas/artist'
	import { updateArtist } from '$lib/stores/artists'
	import Modal from '$lib/components/ui/Modal.svelte'
	import FormField from '$lib/components/ui/FormField.svelte'

	interface Props {
		open?: boolean
		artist: Artist | null
	}

	let { open = false, artist }: Props = $props()

	const dispatch = createEventDispatcher<{
		close: void
		success: { artist: Artist }
	}>()

	// Form state
	let formData = $state<UpdateArtist>({})
	let isSubmitting = $state(false)
	let validationErrors = $state<Record<string, string[]>>({})

	// Initialize form data when artist changes
	$effect(() => {
		if (artist) {
			formData = {
				full_name: artist.full_name || '',
				artist_name: artist.artist_name || '',
				legal_name: artist.legal_name || '',
				legal_first_name: artist.legal_first_name || '',
				legal_last_name: artist.legal_last_name || '',
				public_first_name: artist.public_first_name || '',
				public_last_name: artist.public_last_name || '',
				email: artist.email || '',
				phone: artist.phone || '',
				dob: artist.dob || '',
				location: artist.location || '',
				address: artist.address || '',
				employment_status: artist.employment_status || '',
				metropolitan_hub: artist.metropolitan_hub || '',
				shirt_size: artist.shirt_size || '',
				bio: artist.bio || '',
				one_sentence_bio: artist.one_sentence_bio || '',
				website: artist.website || '',
				instagram: artist.instagram || '',
				facebook: artist.facebook || '',
				sightreads: artist.sightreads || false,
				can_be_soloist: artist.can_be_soloist || false,
				social_security_number: artist.social_security_number || '',
				anti_harassment_training_date: artist.anti_harassment_training_date || '',
				profile_photo: artist.profile_photo || ''
			}
			validationErrors = {}
		}
	})

	// Clear form when modal closes
	$effect(() => {
		if (!open) {
			validationErrors = {}
			isSubmitting = false
		}
	})

	function validateForm(): boolean {
		validationErrors = {}
		
		try {
			updateArtistSchema.parse(formData)
			return true
		} catch (error: any) {
			if (error.errors) {
				error.errors.forEach((err: any) => {
					const field = err.path[0]
					if (!validationErrors[field]) {
						validationErrors[field] = []
					}
					validationErrors[field].push(err.message)
				})
			}
			return false
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault()
		if (!artist?.id || !validateForm()) return

		isSubmitting = true

		try {
			// Remove empty strings and convert to undefined for optional fields
			const cleanedData = Object.fromEntries(
				Object.entries(formData).map(([key, value]) => [
					key, 
					value === '' ? undefined : value
				])
			) as UpdateArtist

			const updatedArtist = await updateArtist(artist.id, cleanedData)
			
			dispatch('success', { artist: updatedArtist })
			dispatch('close')
		} catch (error) {
			console.error('Failed to update artist:', error)
			// Error is handled by the store and error boundary
		} finally {
			isSubmitting = false
		}
	}

	function handleClose() {
		dispatch('close')
	}

	function handleFormChange(field: keyof UpdateArtist) {
		return (value: string | number | boolean) => {
			formData[field] = value as any
			// Clear validation error for this field
			if (validationErrors[field]) {
				delete validationErrors[field]
				validationErrors = { ...validationErrors }
			}
		}
	}

	// Employment status options
	const employmentStatusOptions = [
		{ value: 'full-time', label: 'Full-time' },
		{ value: 'part-time', label: 'Part-time' },
		{ value: 'contractor', label: 'Contractor' },
		{ value: 'volunteer', label: 'Volunteer' },
		{ value: 'student', label: 'Student' },
		{ value: 'unemployed', label: 'Unemployed' },
		{ value: 'retired', label: 'Retired' }
	]

	// Shirt size options
	const shirtSizeOptions = [
		{ value: 'XS', label: 'XS' },
		{ value: 'S', label: 'S' },
		{ value: 'M', label: 'M' },
		{ value: 'L', label: 'L' },
		{ value: 'XL', label: 'XL' },
		{ value: 'XXL', label: 'XXL' },
		{ value: '3XL', label: '3XL' }
	]
</script>

<Modal 
	{open} 
	title="Edit Artist" 
	size="xl" 
	loading={isSubmitting}
	closeable={!isSubmitting}
	on:close={handleClose}
>
	<form onsubmit={handleSubmit} class="space-y-6">
		{#if artist}
			<!-- Personal Information Section -->
			<div class="space-y-4">
				<h4 class="text-lg font-semibold text-base-content border-b border-base-300 pb-2">
					Personal Information
				</h4>
				
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<FormField
						label="Full Name"
						value={formData.full_name || ''}
						error={validationErrors.full_name}
						placeholder="Enter full name"
						onchange={handleFormChange('full_name')}
					/>
					
					<FormField
						label="Artist Name"
						value={formData.artist_name || ''}
						error={validationErrors.artist_name}
						placeholder="Stage or professional name"
						onchange={handleFormChange('artist_name')}
					/>
					
					<FormField
						label="Legal First Name"
						value={formData.legal_first_name || ''}
						error={validationErrors.legal_first_name}
						placeholder="Legal first name"
						required
						onchange={handleFormChange('legal_first_name')}
					/>
					
					<FormField
						label="Legal Last Name"
						value={formData.legal_last_name || ''}
						error={validationErrors.legal_last_name}
						placeholder="Legal last name"
						required
						onchange={handleFormChange('legal_last_name')}
					/>
					
					<FormField
						label="Public First Name"
						value={formData.public_first_name || ''}
						error={validationErrors.public_first_name}
						placeholder="Public first name"
						onchange={handleFormChange('public_first_name')}
					/>
					
					<FormField
						label="Public Last Name"
						value={formData.public_last_name || ''}
						error={validationErrors.public_last_name}
						placeholder="Public last name"
						onchange={handleFormChange('public_last_name')}
					/>
					
					<FormField
						label="Email"
						type="email"
						value={formData.email || ''}
						error={validationErrors.email}
						placeholder="email@example.com"
						onchange={handleFormChange('email')}
					/>
					
					<FormField
						label="Phone"
						type="tel"
						value={formData.phone || ''}
						error={validationErrors.phone}
						placeholder="+1 (555) 123-4567"
						onchange={handleFormChange('phone')}
					/>
					
					<FormField
						label="Date of Birth"
						type="date"
						value={formData.dob || ''}
						error={validationErrors.dob}
						onchange={handleFormChange('dob')}
					/>
					
					<FormField
						label="Shirt Size"
						type="select"
						value={formData.shirt_size || ''}
						error={validationErrors.shirt_size}
						options={shirtSizeOptions}
						onchange={handleFormChange('shirt_size')}
					/>
				</div>
				
				<FormField
					label="Location"
					value={formData.location || ''}
					error={validationErrors.location}
					placeholder="City, State"
					onchange={handleFormChange('location')}
				/>
				
				<FormField
					label="Address"
					type="textarea"
					value={formData.address || ''}
					error={validationErrors.address}
					placeholder="Full address"
					rows={2}
					onchange={handleFormChange('address')}
				/>
			</div>

			<!-- Professional Information Section -->
			<div class="space-y-4">
				<h4 class="text-lg font-semibold text-base-content border-b border-base-300 pb-2">
					Professional Information
				</h4>
				
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<FormField
						label="Employment Status"
						type="select"
						value={formData.employment_status || ''}
						error={validationErrors.employment_status}
						options={employmentStatusOptions}
						onchange={handleFormChange('employment_status')}
					/>
					
					<FormField
						label="Metropolitan Hub"
						value={formData.metropolitan_hub || ''}
						error={validationErrors.metropolitan_hub}
						placeholder="Primary metropolitan area"
						onchange={handleFormChange('metropolitan_hub')}
					/>
					
					<FormField
						label="Website"
						type="url"
						value={formData.website || ''}
						error={validationErrors.website}
						placeholder="https://example.com"
						onchange={handleFormChange('website')}
					/>
					
					<FormField
						label="Profile Photo URL"
						type="url"
						value={formData.profile_photo || ''}
						error={validationErrors.profile_photo}
						placeholder="https://example.com/photo.jpg"
						onchange={handleFormChange('profile_photo')}
					/>

					<FormField
						label="Anti-Harassment Training Date"
						type="date"
						value={formData.anti_harassment_training_date || ''}
						error={validationErrors.anti_harassment_training_date}
						onchange={handleFormChange('anti_harassment_training_date')}
					/>
					
					<FormField
						label="Social Security Number"
						value={formData.social_security_number || ''}
						error={validationErrors.social_security_number}
						placeholder="XXX-XX-XXXX"
						pattern="[0-9]{3}-[0-9]{2}-[0-9]{4}"
						onchange={handleFormChange('social_security_number')}
					/>
				</div>
				
				<!-- Boolean fields -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div class="form-control">
						<label class="label cursor-pointer justify-start gap-3">
							<input 
								type="checkbox" 
								class="checkbox checkbox-primary" 
								checked={formData.sightreads || false}
								onchange={(e) => handleFormChange('sightreads')(e.target.checked)}
							/>
							<span class="label-text">Can sight-read music</span>
						</label>
					</div>
					
					<div class="form-control">
						<label class="label cursor-pointer justify-start gap-3">
							<input 
								type="checkbox" 
								class="checkbox checkbox-primary" 
								checked={formData.can_be_soloist || false}
								onchange={(e) => handleFormChange('can_be_soloist')(e.target.checked)}
							/>
							<span class="label-text">Can perform as soloist</span>
						</label>
					</div>
				</div>
			</div>

			<!-- Biography Section -->
			<div class="space-y-4">
				<h4 class="text-lg font-semibold text-base-content border-b border-base-300 pb-2">
					Biography
				</h4>
				
				<FormField
					label="One Sentence Bio"
					value={formData.one_sentence_bio || ''}
					error={validationErrors.one_sentence_bio}
					placeholder="Brief professional summary (max 200 characters)"
					helpText="A concise description for programs and listings"
					onchange={handleFormChange('one_sentence_bio')}
				/>
				
				<FormField
					label="Full Biography"
					type="textarea"
					value={formData.bio || ''}
					error={validationErrors.bio}
					placeholder="Detailed biography and background"
					rows={4}
					helpText="Complete professional biography (max 2000 characters)"
					onchange={handleFormChange('bio')}
				/>
			</div>

			<!-- Social Links Section -->
			<div class="space-y-4">
				<h4 class="text-lg font-semibold text-base-content border-b border-base-300 pb-2">
					Social Links
				</h4>
				
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<FormField
						label="Instagram Username"
						value={formData.instagram || ''}
						error={validationErrors.instagram}
						placeholder="username (without @)"
						onchange={handleFormChange('instagram')}
					/>
					
					<FormField
						label="Facebook Profile/Page"
						type="url"
						value={formData.facebook || ''}
						error={validationErrors.facebook}
						placeholder="https://facebook.com/profile"
						onchange={handleFormChange('facebook')}
					/>
				</div>
			</div>
		{/if}
	</form>

	<svelte:fragment slot="actions" let:closeModal>
		<button 
			type="button" 
			class="btn btn-ghost" 
			onclick={closeModal}
			disabled={isSubmitting}
		>
			Cancel
		</button>
		<button 
			type="submit" 
			class="btn btn-primary" 
			onclick={handleSubmit}
			disabled={isSubmitting || !artist}
		>
			{#if isSubmitting}
				<span class="loading loading-spinner loading-sm"></span>
				Updating...
			{:else}
				Update Artist
			{/if}
		</button>
	</svelte:fragment>
</Modal>