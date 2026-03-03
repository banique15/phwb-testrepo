<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte'
	import MultiSelect from '$lib/components/ui/MultiSelect.svelte'
	import { GENRE_OPTIONS, INSTRUMENT_OPTIONS } from '$lib/utils/artist-options'
	import { createArtistSchema, type CreateArtist } from '$lib/schemas/artist'
	import { createArtist } from '$lib/stores/artists'
	import { z } from 'zod'

	interface Props {
		open?: boolean
		onClose?: () => void
		onSuccess?: (data: { artist: any }) => void
	}

	let { open = false, onClose, onSuccess }: Props = $props()

	// Form state
	let formData = $state<CreateArtist>({
		legal_first_name: '',
		legal_last_name: '',
		full_name: '',
		artist_name: '',
		email: '',
		phone: '',
		location: '',
		employment_status: '',
		metropolitan_hub: '',
		genres: [],
		instruments: [],
		languages: ['English'],
		bio: '',
		one_sentence_bio: '',
		sightreads: false,
		can_be_soloist: false,
		shirt_size: undefined,
		website: '',
		instagram: '',
		facebook: ''
	})

	let isLoading = $state(false)
	let formErrors = $state<Record<string, string>>({})
	let submitError = $state<string | null>(null)
	let currentStep = $state(1)
	let hasUnsavedChanges = $state(false)
	let showUnsavedWarning = $state(false)

	// Track initial form state for unsaved changes detection
	let initialFormData = $state(JSON.stringify(formData))

	// Pre-populate full_name when legal names change
	$effect(() => {
		if (formData.legal_first_name || formData.legal_last_name) {
			const firstName = formData.legal_first_name?.trim() || ''
			const lastName = formData.legal_last_name?.trim() || ''
			formData.full_name = [firstName, lastName].filter(Boolean).join(' ')
		}
	})

	// Track unsaved changes
	$effect(() => {
		hasUnsavedChanges = JSON.stringify(formData) !== initialFormData
	})

	// Step navigation
	const steps = [
		{ id: 1, name: 'Basic Info', description: 'Personal details' },
		{ id: 2, name: 'Professional', description: 'Skills & background' },
		{ id: 3, name: 'Biography & Social', description: 'Bio & social links' }
	]

	function nextStep() {
		if (currentStep < steps.length) {
			currentStep += 1
		}
	}

	function prevStep() {
		if (currentStep > 1) {
			currentStep -= 1
		}
	}

	function goToStep(stepNumber: number) {
		currentStep = stepNumber
	}

	function isStepCompleted(stepNumber: number) {
		switch (stepNumber) {
			case 1:
				return !!(formData.legal_first_name?.trim())
			case 2:
				return formData.genres.length > 0 || formData.instruments.length > 0
			case 3:
				return true // Optional step
			default:
				return false
		}
	}

	// Validation helper
	function validateField(field: keyof CreateArtist, value: any) {
		try {
			const fieldSchema = createArtistSchema.shape[field]
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
	function handleInputChange(field: keyof CreateArtist, value: any) {
		formData[field] = value
		validateField(field, value)
		submitError = null
	}

	function handleArrayInput(field: keyof CreateArtist, value: string) {
		const items = value.split(',').map(item => item.trim()).filter(Boolean)
		formData[field] = items
		validateField(field, items)
		submitError = null
	}

	function resetForm() {
		formData = {
			legal_first_name: '',
			legal_last_name: '',
			full_name: '',
			artist_name: '',
			email: '',
			phone: '',
			location: '',
			employment_status: '',
			metropolitan_hub: '',
			genres: [],
			instruments: [],
			languages: ['English'],
			bio: '',
			one_sentence_bio: '',
			sightreads: false,
			can_be_soloist: false,
			shirt_size: undefined,
			website: '',
			instagram: '',
			facebook: ''
		}
		formErrors = {}
		submitError = null
		isLoading = false
		currentStep = 1
		hasUnsavedChanges = false
		showUnsavedWarning = false
		initialFormData = JSON.stringify(formData)
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault()
		// Reset previous errors
		formErrors = {}
		submitError = null

		// Validate the entire form
		try {
			createArtistSchema.parse(formData)
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
		if (!formData.legal_first_name?.trim()) {
			formErrors.legal_first_name = 'Legal first name is required'
			formErrors = { ...formErrors }
			return
		}

		if (!formData.employment_status?.trim()) {
			formErrors.employment_status = 'Employment status is required'
			formErrors = { ...formErrors }
			return
		}

		isLoading = true

		try {
			// Create a clean data object using only the schema fields
			const cleanData = createArtistSchema.parse(formData)
			
			// Remove empty strings and convert to null/undefined where appropriate
			Object.keys(cleanData).forEach(key => {
				const value = cleanData[key as keyof CreateArtist]
				if (typeof value === 'string' && value.trim() === '') {
					delete cleanData[key as keyof CreateArtist]
				}
			})

			// Ensure no forbidden fields are included (defensive programming)
			const { id, created_at, ...sanitizedData } = cleanData as any

			console.log('Sanitized data being sent to createArtist:', sanitizedData)

			const newArtist = await createArtist(sanitizedData)
			
			onSuccess?.({ artist: newArtist })
			onClose?.()
			resetForm()
		} catch (error) {
			console.error('Failed to create artist:', error)
			submitError = error instanceof Error ? error.message : 'Failed to create artist. Please try again.'
		} finally {
			isLoading = false
		}
	}

	function handleClose() {
		if (!isLoading) {
			if (hasUnsavedChanges) {
				showUnsavedWarning = true
			} else {
				resetForm()
				onClose?.()
			}
		}
	}

	function confirmClose() {
		showUnsavedWarning = false
		resetForm()
		onClose?.()
	}

	function cancelClose() {
		showUnsavedWarning = false
	}

	// Format arrays for display in inputs
	function getArrayDisplayValue(arr: any): string {
		if (!arr || !Array.isArray(arr)) return ''
		return arr.join(', ')
	}
</script>

<!-- Main Create Artist Modal -->
<div class="modal" class:modal-open={open}>
	<div class="modal-box w-full max-w-2xl max-h-[90vh] p-0 flex flex-col">
		<!-- Header -->
		<div class="flex items-center justify-between px-6 py-4 border-b border-base-200 flex-shrink-0">
			<div>
				<h3 class="text-lg font-semibold">Add New Artist</h3>
				<p class="text-sm text-base-content/60">Step {currentStep} of {steps.length}</p>
			</div>
			<button
				class="btn btn-sm btn-circle btn-ghost"
				onclick={handleClose}
				disabled={isLoading}
				aria-label="Close"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Steps Progress -->
		<div class="px-6 py-3 border-b border-base-200 flex-shrink-0">
			<ul class="steps steps-horizontal w-full">
				{#each steps as step}
					<li class="step" class:step-primary={currentStep >= step.id}>
						<div class="text-left">
							<div class="text-sm font-medium">{step.name}</div>
							<div class="text-xs text-base-content/60">{step.description}</div>
						</div>
					</li>
				{/each}
			</ul>
		</div>

		<!-- Form Content -->
		<div class="flex-1 overflow-y-auto px-6 py-5">
			<form onsubmit={handleSubmit}>
				{#if submitError}
					<div class="alert alert-error mb-5">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span>{submitError}</span>
					</div>
				{/if}

				<!-- Step 1: Basic Information -->
				{#if currentStep === 1}
					<div class="space-y-5">
						<div>
							<h2 class="text-lg font-bold">Basic Information</h2>
							<p class="text-sm text-base-content/60">Let's start with the essential details</p>
						</div>

						<div class="grid grid-cols-2 gap-x-4 gap-y-4">
							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium">Legal First Name <span class="text-error">*</span></span>
								<input
									type="text"
									class="input input-bordered w-full {formErrors.legal_first_name ? 'input-error' : ''}"
									value={formData.legal_first_name || ''}
									oninput={(e) => handleInputChange('legal_first_name', e.currentTarget.value)}
									placeholder="Enter legal first name"
									required
								/>
								{#if formErrors.legal_first_name}
									<span class="text-xs text-error">{formErrors.legal_first_name}</span>
								{/if}
							</div>

							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium">Legal Last Name</span>
								<input
									type="text"
									class="input input-bordered w-full {formErrors.legal_last_name ? 'input-error' : ''}"
									value={formData.legal_last_name || ''}
									oninput={(e) => handleInputChange('legal_last_name', e.currentTarget.value)}
									placeholder="Enter legal last name"
								/>
								{#if formErrors.legal_last_name}
									<span class="text-xs text-error">{formErrors.legal_last_name}</span>
								{/if}
							</div>

							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium">Full Name</span>
								<input
									type="text"
									class="input input-bordered w-full {formErrors.full_name ? 'input-error' : ''}"
									value={formData.full_name || ''}
									oninput={(e) => handleInputChange('full_name', e.currentTarget.value)}
									placeholder="Auto-filled from legal names"
								/>
								{#if formErrors.full_name}
									<span class="text-xs text-error">{formErrors.full_name}</span>
								{/if}
							</div>

							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium">Artist/Stage Name</span>
								<input
									type="text"
									class="input input-bordered w-full {formErrors.artist_name ? 'input-error' : ''}"
									value={formData.artist_name || ''}
									oninput={(e) => handleInputChange('artist_name', e.currentTarget.value)}
									placeholder="Enter stage or artist name"
								/>
								{#if formErrors.artist_name}
									<span class="text-xs text-error">{formErrors.artist_name}</span>
								{/if}
							</div>

							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium">Email</span>
								<input
									type="email"
									class="input input-bordered w-full {formErrors.email ? 'input-error' : ''}"
									value={formData.email || ''}
									oninput={(e) => handleInputChange('email', e.currentTarget.value)}
									placeholder="artist@example.com"
								/>
								{#if formErrors.email}
									<span class="text-xs text-error">{formErrors.email}</span>
								{/if}
							</div>

							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium">Phone</span>
								<input
									type="tel"
									class="input input-bordered w-full {formErrors.phone ? 'input-error' : ''}"
									value={formData.phone || ''}
									oninput={(e) => handleInputChange('phone', e.currentTarget.value)}
									placeholder="+1 (555) 123-4567"
								/>
								{#if formErrors.phone}
									<span class="text-xs text-error">{formErrors.phone}</span>
								{/if}
							</div>

							<div class="flex flex-col gap-1 col-span-2">
								<span class="text-sm font-medium">Location</span>
								<input
									type="text"
									class="input input-bordered w-full {formErrors.location ? 'input-error' : ''}"
									value={formData.location || ''}
									oninput={(e) => handleInputChange('location', e.currentTarget.value)}
									placeholder="City, State"
								/>
								{#if formErrors.location}
									<span class="text-xs text-error">{formErrors.location}</span>
								{/if}
							</div>
						</div>
					</div>
				{/if}

				<!-- Step 2: Professional Information -->
				{#if currentStep === 2}
					<div class="space-y-5">
						<div>
							<h2 class="text-lg font-bold">Professional Information</h2>
							<p class="text-sm text-base-content/60">Tell us about skills and background</p>
						</div>

						<div class="grid grid-cols-2 gap-x-4 gap-y-4">
							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium">Employment Status <span class="text-error">*</span></span>
								<select
									class="select select-bordered w-full {formErrors.employment_status ? 'select-error' : ''}"
									value={formData.employment_status || ''}
									onchange={(e) => handleInputChange('employment_status', e.currentTarget.value)}
									required
								>
									<option value="" disabled>Select employment status</option>
									<option value="Employee">Employee/W2</option>
									<option value="1099">LLC/1099</option>
									<option value="Trial">Trial</option>
								</select>
								{#if formErrors.employment_status}
									<span class="text-xs text-error">{formErrors.employment_status}</span>
								{/if}
							</div>

							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium">Metropolitan Hub</span>
								<select
									class="select select-bordered w-full {formErrors.metropolitan_hub ? 'select-error' : ''}"
									value={formData.metropolitan_hub || ''}
									onchange={(e) => handleInputChange('metropolitan_hub', e.currentTarget.value)}
								>
									<option value="">Select metropolitan hub</option>
									<option value="New York">New York</option>
									<option value="Los Angeles">Los Angeles</option>
									<option value="Chicago">Chicago</option>
									<option value="Houston">Houston</option>
									<option value="Philadelphia">Philadelphia</option>
									<option value="Phoenix">Phoenix</option>
									<option value="San Antonio">San Antonio</option>
									<option value="San Diego">San Diego</option>
									<option value="Dallas">Dallas</option>
									<option value="San Jose">San Jose</option>
								</select>
								{#if formErrors.metropolitan_hub}
									<span class="text-xs text-error">{formErrors.metropolitan_hub}</span>
								{/if}
							</div>

							<div class="flex flex-col gap-1">
								<MultiSelect
									options={GENRE_OPTIONS}
									selected={formData.genres || []}
									onChange={(selected) => {
										formData.genres = selected
										validateField('genres')
									}}
									placeholder="Select genres..."
									label="Genres"
								/>
								{#if formErrors.genres}
									<span class="text-xs text-error">{formErrors.genres}</span>
								{/if}
							</div>

							<div class="flex flex-col gap-1">
								<MultiSelect
									options={INSTRUMENT_OPTIONS}
									selected={formData.instruments || []}
									onChange={(selected) => {
										formData.instruments = selected
										validateField('instruments')
									}}
									placeholder="Select instruments..."
									label="Instruments"
								/>
								{#if formErrors.instruments}
									<span class="text-xs text-error">{formErrors.instruments}</span>
								{/if}
							</div>

							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium">Languages</span>
								<input
									type="text"
									class="input input-bordered w-full {formErrors.languages ? 'input-error' : ''}"
									value={getArrayDisplayValue(formData.languages)}
									oninput={(e) => handleArrayInput('languages', e.currentTarget.value)}
									placeholder="English, Spanish, French"
								/>
								<span class="text-xs text-base-content/50">Separate with commas</span>
								{#if formErrors.languages}
									<span class="text-xs text-error">{formErrors.languages}</span>
								{/if}
							</div>

							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium">Shirt Size</span>
								<select
									class="select select-bordered w-full {formErrors.shirt_size ? 'select-error' : ''}"
									value={formData.shirt_size || ''}
									onchange={(e) => handleInputChange('shirt_size', e.currentTarget.value || undefined)}
								>
									<option value="">Select shirt size</option>
									<option value="XS">XS</option>
									<option value="S">S</option>
									<option value="M">M</option>
									<option value="L">L</option>
									<option value="XL">XL</option>
									<option value="XXL">XXL</option>
									<option value="3XL">3XL</option>
								</select>
								{#if formErrors.shirt_size}
									<span class="text-xs text-error">{formErrors.shirt_size}</span>
								{/if}
							</div>
						</div>

						<div class="flex gap-6 pt-2 border-t border-base-200">
							<label class="flex items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									class="toggle toggle-primary toggle-sm"
									bind:checked={formData.sightreads}
								/>
								<span class="text-sm">Can Sight Read</span>
							</label>
							<label class="flex items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									class="toggle toggle-primary toggle-sm"
									bind:checked={formData.can_be_soloist}
								/>
								<span class="text-sm">Can Be Soloist</span>
							</label>
						</div>
					</div>
				{/if}

				<!-- Step 3: Biography & Social -->
				{#if currentStep === 3}
					<div class="space-y-5">
						<div>
							<h2 class="text-lg font-bold">Biography & Social</h2>
							<p class="text-sm text-base-content/60">Share the artist's story and online presence</p>
						</div>

						<div class="flex flex-col gap-4">
							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium">One Sentence Bio</span>
								<input
									type="text"
									class="input input-bordered w-full {formErrors.one_sentence_bio ? 'input-error' : ''}"
									value={formData.one_sentence_bio || ''}
									oninput={(e) => handleInputChange('one_sentence_bio', e.currentTarget.value)}
									placeholder="A brief one-sentence description of the artist"
									maxlength="200"
								/>
								<span class="text-xs text-base-content/50">Maximum 200 characters</span>
								{#if formErrors.one_sentence_bio}
									<span class="text-xs text-error">{formErrors.one_sentence_bio}</span>
								{/if}
							</div>

							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium">Full Bio</span>
								<textarea
									class="textarea textarea-bordered h-32 {formErrors.bio ? 'textarea-error' : ''}"
									value={formData.bio || ''}
									oninput={(e) => handleInputChange('bio', e.currentTarget.value)}
									placeholder="Detailed biography of the artist"
									maxlength="2000"
								></textarea>
								<span class="text-xs text-base-content/50">Maximum 2000 characters</span>
								{#if formErrors.bio}
									<span class="text-xs text-error">{formErrors.bio}</span>
								{/if}
							</div>
						</div>

						<div class="divider text-sm">Social & Web Presence</div>

						<div class="grid grid-cols-3 gap-4">
							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium">Website</span>
								<input
									type="url"
									class="input input-bordered w-full {formErrors.website ? 'input-error' : ''}"
									value={formData.website || ''}
									oninput={(e) => handleInputChange('website', e.currentTarget.value)}
									placeholder="https://..."
								/>
								{#if formErrors.website}
									<span class="text-xs text-error">{formErrors.website}</span>
								{/if}
							</div>

							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium">Instagram</span>
								<input
									type="text"
									class="input input-bordered w-full {formErrors.instagram ? 'input-error' : ''}"
									value={formData.instagram || ''}
									oninput={(e) => handleInputChange('instagram', e.currentTarget.value)}
									placeholder="username"
								/>
								{#if formErrors.instagram}
									<span class="text-xs text-error">{formErrors.instagram}</span>
								{/if}
							</div>

							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium">Facebook</span>
								<input
									type="url"
									class="input input-bordered w-full {formErrors.facebook ? 'input-error' : ''}"
									value={formData.facebook || ''}
									oninput={(e) => handleInputChange('facebook', e.currentTarget.value)}
									placeholder="https://..."
								/>
								{#if formErrors.facebook}
									<span class="text-xs text-error">{formErrors.facebook}</span>
								{/if}
							</div>
						</div>
					</div>
				{/if}
			</form>
		</div>

		<!-- Footer with Navigation -->
		<div class="flex items-center justify-between px-6 py-4 border-t border-base-200 flex-shrink-0">
			<div>
				{#if currentStep > 1}
					<button
						type="button"
						class="btn btn-outline btn-sm"
						onclick={prevStep}
						disabled={isLoading}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
						</svg>
						Previous
					</button>
				{/if}
			</div>

			<div class="flex items-center gap-3">
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={handleClose}
					disabled={isLoading}
				>
					Cancel
				</button>

				{#if currentStep < steps.length}
					<button
						type="button"
						class="btn btn-primary btn-sm"
						onclick={nextStep}
						disabled={isLoading || !isStepCompleted(currentStep)}
					>
						Next
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
					</button>
				{:else}
					<button
						type="button"
						class="btn btn-primary btn-sm"
						onclick={handleSubmit}
						disabled={isLoading || !formData.legal_first_name?.trim()}
					>
						{#if isLoading}
							<span class="loading loading-spinner loading-sm"></span>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
							</svg>
						{/if}
						Create Artist
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Unsaved Changes Warning Modal -->
<div class="modal" class:modal-open={showUnsavedWarning}>
	<div class="modal-box">
		<h3 class="font-bold text-lg mb-4">Unsaved Changes</h3>
		<p class="py-4">If you quit now, you'll lose all the artist data you've entered. Are you sure you want to continue?</p>
		<div class="modal-action">
			<button class="btn btn-ghost" onclick={cancelClose}>
				Keep Editing
			</button>
			<button class="btn btn-error" onclick={confirmClose}>
				Discard Changes
			</button>
		</div>
	</div>
</div>