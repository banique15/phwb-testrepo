<script lang="ts">
	import { type CreateArtist, type UpdateArtist, createArtistSchema, updateArtistSchema, type Artist } from '$lib/schemas/artist'
	import FormField from '$lib/components/ui/FormField.svelte'
	import { FormValidator, artistFieldSchemas, validationUtils } from '$lib/utils/validation'
	import { createEventDispatcher } from 'svelte'

	interface Props {
		artist?: Artist | null
		mode: 'create' | 'update'
		loading?: boolean
		disabled?: boolean
	}

	let { artist = null, mode, loading = false, disabled = false }: Props = $props()

	const dispatch = createEventDispatcher<{
		submit: { data: CreateArtist | UpdateArtist; isValid: boolean }
		cancel: void
		change: { field: string; value: any; isValid: boolean }
	}>()

	// Initialize form validator
	const validator = new FormValidator(mode === 'create' ? createArtistSchema : updateArtistSchema)

	// Form data state
	let formData = $state<Partial<CreateArtist | UpdateArtist>>({
		legal_first_name: artist?.legal_first_name || '',
		legal_last_name: artist?.legal_last_name || '',
		full_name: artist?.full_name || '',
		artist_name: artist?.artist_name || '',
		public_first_name: artist?.public_first_name || '',
		public_last_name: artist?.public_last_name || '',
		legal_name: artist?.legal_name || '',
		email: artist?.email || '',
		phone: artist?.phone || '',
		dob: artist?.dob || '',
		location: artist?.location || '',
		address: artist?.address || '',
		employment_status: artist?.employment_status || '',
		metropolitan_hub: artist?.metropolitan_hub || '',
		shirt_size: artist?.shirt_size || '',
		bio: artist?.bio || '',
		one_sentence_bio: artist?.one_sentence_bio || '',
		website: artist?.website || '',
		instagram: artist?.instagram || '',
		facebook: artist?.facebook || '',
		social_security_number: artist?.social_security_number || '',
		sightreads: artist?.sightreads || false,
		can_be_soloist: artist?.can_be_soloist || false,
		anti_harassment_training_date: artist?.anti_harassment_training_date || '',
		// Initialize arrays
		genres: artist?.genres || [],
		instruments: artist?.instruments || [],
		languages: artist?.languages || [],
		availability: artist?.availability || [],
		equipment_needs: artist?.equipment_needs || [],
		special_requirements: artist?.special_requirements || [],
		training: artist?.training || [],
		history: artist?.history || [],
		social_link: artist?.social_link || []
	})

	// Array input states for comma-separated fields
	let genresInput = $state(Array.isArray(formData.genres) ? formData.genres.join(', ') : '')
	let instrumentsInput = $state(Array.isArray(formData.instruments) ? formData.instruments.join(', ') : '')
	let languagesInput = $state(Array.isArray(formData.languages) ? formData.languages.join(', ') : '')

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

	// Employment status options (you can customize these based on your needs)
	const employmentStatusOptions = [
		{ value: 'Full-time', label: 'Full-time' },
		{ value: 'Part-time', label: 'Part-time' },
		{ value: 'Freelance', label: 'Freelance' },
		{ value: 'Student', label: 'Student' },
		{ value: 'Unemployed', label: 'Unemployed' },
		{ value: 'Retired', label: 'Retired' }
	]

	// Reactive validation state
	let isFormValid = $derived(validator.isValid && hasRequiredFields())
	let formErrors = $derived(validator.errors)

	function hasRequiredFields(): boolean {
		// Check if required fields have values (adjust based on your business rules)
		return !!(formData.legal_first_name && formData.legal_last_name)
	}

	function handleFieldChange(field: keyof typeof formData, value: any) {
		// Update form data
		formData = { ...formData, [field]: value }

		// Get the appropriate schema for the field
		const fieldSchema = artistFieldSchemas[field as keyof typeof artistFieldSchemas]
		
		// Validate the field
		const errors = fieldSchema ? validator.validateField(field, value, fieldSchema) : []

		// Special handling for certain fields
		if (field === 'email' && value) {
			// Additional email validation feedback
			if (!validationUtils.isValidEmailFormat(value)) {
				// The schema validation will catch this, but we can provide real-time feedback
			}
		}

		if (field === 'phone' && value) {
			// Format phone number on blur
			formData.phone = validationUtils.formatPhoneNumber(value)
		}

		if (field === 'instagram' && value) {
			// Remove @ symbol if user includes it
			formData.instagram = value.replace('@', '')
		}

		// Emit change event
		dispatch('change', { 
			field, 
			value, 
			isValid: errors.length === 0 
		})
	}

	function handleArrayFieldChange(field: 'genres' | 'instruments' | 'languages', inputValue: string) {
		const cleanedArray = validationUtils.cleanArray(inputValue)
		formData = { ...formData, [field]: cleanedArray }
		
		// Validate the array
		const errors = validator.validateField(field, cleanedArray, artistFieldSchemas[field])
		
		dispatch('change', { 
			field, 
			value: cleanedArray, 
			isValid: errors.length === 0 
		})
	}

	function handleSubmit() {
		// Validate entire form
		const validationResult = validator.validateForm(formData)
		
		dispatch('submit', { 
			data: formData as CreateArtist | UpdateArtist, 
			isValid: validationResult.valid 
		})
	}

	function handleCancel() {
		dispatch('cancel')
	}

	// Update arrays when input changes
	$effect(() => {
		handleArrayFieldChange('genres', genresInput)
	})

	$effect(() => {
		handleArrayFieldChange('instruments', instrumentsInput)
	})

	$effect(() => {
		handleArrayFieldChange('languages', languagesInput)
	})

	// Auto-generate full name from legal names
	$effect(() => {
		if (formData.legal_first_name || formData.legal_last_name) {
			const fullName = [formData.legal_first_name, formData.legal_last_name]
				.filter(Boolean)
				.join(' ')
			if (fullName !== formData.full_name) {
				formData.full_name = fullName
			}
		}
	})

	// Auto-generate legal name from legal first/last names
	$effect(() => {
		if (formData.legal_first_name || formData.legal_last_name) {
			const legalName = [formData.legal_first_name, formData.legal_last_name]
				.filter(Boolean)
				.join(' ')
			if (legalName !== formData.legal_name) {
				formData.legal_name = legalName
			}
		}
	})
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-6">
	<!-- Personal Information Section -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h3 class="card-title text-lg mb-4">Personal Information</h3>
			
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<FormField
					label="Legal First Name"
					type="text"
					value={formData.legal_first_name || ''}
					error={formErrors.legal_first_name}
					placeholder="Enter legal first name"
					required={true}
					disabled={disabled || loading}
					showValid={true}
					onchange={(value) => handleFieldChange('legal_first_name', value)}
					helpText="Legal name as it appears on official documents"
				/>

				<FormField
					label="Legal Last Name"
					type="text"
					value={formData.legal_last_name || ''}
					error={formErrors.legal_last_name}
					placeholder="Enter legal last name"
					required={true}
					disabled={disabled || loading}
					showValid={true}
					onchange={(value) => handleFieldChange('legal_last_name', value)}
					helpText="Legal surname as it appears on official documents"
				/>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<FormField
					label="Public First Name"
					type="text"
					value={formData.public_first_name || ''}
					error={formErrors.public_first_name}
					placeholder="Enter preferred first name"
					disabled={disabled || loading}
					onchange={(value) => handleFieldChange('public_first_name', value)}
					helpText="Name to use in public materials (if different from legal)"
				/>

				<FormField
					label="Public Last Name"
					type="text"
					value={formData.public_last_name || ''}
					error={formErrors.public_last_name}
					placeholder="Enter preferred last name"
					disabled={disabled || loading}
					onchange={(value) => handleFieldChange('public_last_name', value)}
					helpText="Surname to use in public materials (if different from legal)"
				/>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<FormField
					label="Artist/Stage Name"
					type="text"
					value={formData.artist_name || ''}
					error={formErrors.artist_name}
					placeholder="Enter stage or artist name"
					disabled={disabled || loading}
					onchange={(value) => handleFieldChange('artist_name', value)}
					helpText="Professional or stage name (optional)"
				/>

				<FormField
					label="Date of Birth"
					type="date"
					value={formData.dob || ''}
					error={formErrors.dob}
					disabled={disabled || loading}
					onchange={(value) => handleFieldChange('dob', value)}
					helpText="Used for age verification and demographics"
				/>
			</div>
		</div>
	</div>

	<!-- Contact Information Section -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h3 class="card-title text-lg mb-4">Contact Information</h3>
			
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<FormField
					label="Email Address"
					type="email"
					value={formData.email || ''}
					error={formErrors.email}
					placeholder="Enter email address"
					disabled={disabled || loading}
					showValid={true}
					onchange={(value) => handleFieldChange('email', value)}
					helpText="Primary contact email"
				/>

				<FormField
					label="Phone Number"
					type="tel"
					value={formData.phone || ''}
					error={formErrors.phone}
					placeholder="Enter phone number"
					disabled={disabled || loading}
					showValid={true}
					onchange={(value) => handleFieldChange('phone', value)}
					helpText="Include area code, international format supported"
				/>
			</div>

			<FormField
				label="Location/City"
				type="text"
				value={formData.location || ''}
				error={formErrors.location}
				placeholder="Enter city/location"
				disabled={disabled || loading}
				onchange={(value) => handleFieldChange('location', value)}
				helpText="Primary city or location"
			/>

			<FormField
				label="Full Address"
				type="textarea"
				value={formData.address || ''}
				error={formErrors.address}
				placeholder="Enter complete address"
				disabled={disabled || loading}
				rows={3}
				onchange={(value) => handleFieldChange('address', value)}
				helpText="Complete mailing address (optional)"
			/>
		</div>
	</div>

	<!-- Professional Information Section -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h3 class="card-title text-lg mb-4">Professional Information</h3>
			
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<FormField
					label="Employment Status"
					type="select"
					value={formData.employment_status || ''}
					error={formErrors.employment_status}
					options={employmentStatusOptions}
					disabled={disabled || loading}
					onchange={(value) => handleFieldChange('employment_status', value)}
					helpText="Current employment situation"
				/>

				<FormField
					label="Metropolitan Hub"
					type="text"
					value={formData.metropolitan_hub || ''}
					error={formErrors.metropolitan_hub}
					placeholder="Enter metropolitan area"
					disabled={disabled || loading}
					onchange={(value) => handleFieldChange('metropolitan_hub', value)}
					helpText="Primary metropolitan area for performances"
				/>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<FormField
					label="Musical Genres"
					type="text"
					value={genresInput}
					error={formErrors.genres}
					placeholder="e.g., Classical, Jazz, Pop"
					disabled={disabled || loading}
					onchange={(value) => { genresInput = value }}
					helpText="Separate multiple genres with commas"
				/>

				<FormField
					label="Instruments"
					type="text"
					value={instrumentsInput}
					error={formErrors.instruments}
					placeholder="e.g., Piano, Voice, Guitar"
					disabled={disabled || loading}
					onchange={(value) => { instrumentsInput = value }}
					helpText="Separate multiple instruments with commas"
				/>

				<FormField
					label="Languages"
					type="text"
					value={languagesInput}
					error={formErrors.languages}
					placeholder="e.g., English, Spanish, French"
					disabled={disabled || loading}
					onchange={(value) => { languagesInput = value }}
					helpText="Separate multiple languages with commas"
				/>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div class="form-control">
					<label class="label cursor-pointer">
						<span class="label-text">Can Sight Read</span>
						<input
							type="checkbox"
							class="checkbox checkbox-primary"
							checked={formData.sightreads || false}
							disabled={disabled || loading}
							onchange={(e) => handleFieldChange('sightreads', e.currentTarget.checked)}
						/>
					</label>
				</div>

				<div class="form-control">
					<label class="label cursor-pointer">
						<span class="label-text">Can Be Soloist</span>
						<input
							type="checkbox"
							class="checkbox checkbox-primary"
							checked={formData.can_be_soloist || false}
							disabled={disabled || loading}
							onchange={(e) => handleFieldChange('can_be_soloist', e.currentTarget.checked)}
						/>
					</label>
				</div>

				<FormField
					label="Shirt Size"
					type="select"
					value={formData.shirt_size || ''}
					error={formErrors.shirt_size}
					options={shirtSizeOptions}
					disabled={disabled || loading}
					onchange={(value) => handleFieldChange('shirt_size', value)}
					helpText="For event t-shirts and uniforms"
				/>
			</div>
		</div>
	</div>

	<!-- Biography Section -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h3 class="card-title text-lg mb-4">Biography & Description</h3>
			
			<FormField
				label="One Sentence Bio"
				type="textarea"
				value={formData.one_sentence_bio || ''}
				error={formErrors.one_sentence_bio}
				placeholder="A brief one-sentence description of the artist"
				disabled={disabled || loading}
				rows={2}
				onchange={(value) => handleFieldChange('one_sentence_bio', value)}
				helpText="Short bio for quick references (max 200 characters)"
			/>

			<FormField
				label="Full Biography"
				type="textarea"
				value={formData.bio || ''}
				error={formErrors.bio}
				placeholder="Enter detailed artist biography"
				disabled={disabled || loading}
				rows={6}
				onchange={(value) => handleFieldChange('bio', value)}
				helpText="Detailed biography for programs and marketing (max 2000 characters)"
			/>
		</div>
	</div>

	<!-- Social & Online Presence Section -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h3 class="card-title text-lg mb-4">Social & Online Presence</h3>
			
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<FormField
					label="Website"
					type="url"
					value={formData.website || ''}
					error={formErrors.website}
					placeholder="https://example.com"
					disabled={disabled || loading}
					showValid={true}
					onchange={(value) => handleFieldChange('website', value)}
					helpText="Professional website or portfolio"
				/>

				<FormField
					label="Instagram Handle"
					type="text"
					value={formData.instagram || ''}
					error={formErrors.instagram}
					placeholder="username (without @)"
					disabled={disabled || loading}
					showValid={true}
					onchange={(value) => handleFieldChange('instagram', value)}
					helpText="Instagram username without @ symbol"
				/>

				<FormField
					label="Facebook"
					type="url"
					value={formData.facebook || ''}
					error={formErrors.facebook}
					placeholder="https://facebook.com/username"
					disabled={disabled || loading}
					showValid={true}
					onchange={(value) => handleFieldChange('facebook', value)}
					helpText="Facebook profile or page URL"
				/>
			</div>
		</div>
	</div>

	<!-- Administrative Information Section -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h3 class="card-title text-lg mb-4">Administrative Information</h3>
			
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<FormField
					label="Social Security Number"
					type="text"
					value={formData.social_security_number || ''}
					error={formErrors.social_security_number}
					placeholder="XXX-XX-XXXX"
					disabled={disabled || loading}
					pattern="^\d{3}-\d{2}-\d{4}$"
					onchange={(value) => handleFieldChange('social_security_number', value)}
					helpText="Required for tax reporting (format: XXX-XX-XXXX)"
				/>

				<FormField
					label="Anti-Harassment Training Date"
					type="date"
					value={formData.anti_harassment_training_date || ''}
					error={formErrors.anti_harassment_training_date}
					disabled={disabled || loading}
					onchange={(value) => handleFieldChange('anti_harassment_training_date', value)}
					helpText="Date of completion of anti-harassment training"
				/>
			</div>
		</div>
	</div>

	<!-- Form Actions -->
	<div class="flex justify-end gap-3 pt-6 border-t border-base-200">
		<button
			type="button"
			class="btn btn-ghost"
			disabled={loading}
			onclick={handleCancel}
		>
			Cancel
		</button>
		
		<button
			type="submit"
			class="btn btn-primary"
			disabled={!isFormValid || loading}
			class:loading={loading}
		>
			{#if loading}
				<span class="loading loading-spinner loading-sm"></span>
			{/if}
			{mode === 'create' ? 'Create Artist' : 'Update Artist'}
		</button>
	</div>

	<!-- Form Validation Summary -->
	{#if validator.hasInteracted && !isFormValid}
		<div class="alert alert-warning">
			<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.182 16.5c-.77.833.192 2.5 1.732 2.5z" />
			</svg>
			<div>
				<h3 class="font-bold">Please fix the following issues:</h3>
				<div class="text-sm mt-2">
					{#if !formData.legal_first_name}
						<p>• Legal first name is required</p>
					{/if}
					{#if !formData.legal_last_name}
						<p>• Legal last name is required</p>
					{/if}
					{#each Object.entries(formErrors) as [field, errors]}
						{#each errors as error}
							<p>• {error}</p>
						{/each}
					{/each}
				</div>
			</div>
		</div>
	{/if}
</form>