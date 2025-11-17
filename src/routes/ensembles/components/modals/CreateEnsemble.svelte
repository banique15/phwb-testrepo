<script lang="ts">
	import { Lightbulb, Search, Users } from 'lucide-svelte'
	import { createEventDispatcher, onMount } from 'svelte'
	import { createEnsemble } from '$lib/stores/ensembles'
	import { createEnsembleSchema, type CreateEnsemble } from '$lib/schemas/ensemble'
	import { supabase } from '$lib/supabase'
	import { z } from 'zod'
	import type { Artist } from '$lib/schemas/artist'

	interface Props {
		open?: boolean
	}

	let { open = false }: Props = $props()

	const dispatch = createEventDispatcher<{
		close: void
		success: { ensemble: any }
	}>()

	// Form state
	let formData = $state<CreateEnsemble>({
		name: '',
		ensemble_type: '',
		description: '',
		website: '',
		status: 'active'
	})

	let isLoading = $state(false)
	let formErrors = $state<Record<string, string>>({})
	let submitError = $state<string | null>(null)

	// Artist selection state
	let artists = $state<Artist[]>([])
	let loadingArtists = $state(true)
	let artistSearchTerm = $state('')
	let selectedArtistIds = $state<Set<string>>(new Set())
	let artistRoles = $state<Record<string, string>>({})

	// Load artists on mount
	onMount(async () => {
		await loadArtists()
	})

	async function loadArtists() {
		loadingArtists = true
		try {
			const { data, error: supabaseError } = await supabase
				.from('phwb_artists')
				.select('id, full_name, legal_first_name, artist_name, email')
				.order('full_name')

			if (supabaseError) throw supabaseError
			artists = data || []
		} catch (err: any) {
			console.error('Failed to load artists:', err)
		} finally {
			loadingArtists = false
		}
	}

	// Filter artists based on search
	let displayedArtists = $derived.by(() => {
		if (!artistSearchTerm.trim()) return artists

		const searchLower = artistSearchTerm.toLowerCase()
		return artists.filter(artist =>
			artist.full_name?.toLowerCase().includes(searchLower) ||
			artist.legal_first_name?.toLowerCase().includes(searchLower) ||
			artist.artist_name?.toLowerCase().includes(searchLower) ||
			artist.email?.toLowerCase().includes(searchLower)
		)
	})

	function toggleArtist(artistId: string) {
		if (selectedArtistIds.has(artistId)) {
			selectedArtistIds.delete(artistId)
			delete artistRoles[artistId]
		} else {
			selectedArtistIds.add(artistId)
		}
		selectedArtistIds = new Set(selectedArtistIds)
		artistRoles = { ...artistRoles }
	}

	function selectAllVisibleArtists() {
		displayedArtists.forEach(artist => {
			if (artist.id) selectedArtistIds.add(artist.id)
		})
		selectedArtistIds = new Set(selectedArtistIds)
	}

	function clearAllArtists() {
		selectedArtistIds.clear()
		selectedArtistIds = new Set()
		artistRoles = {}
	}

	function getArtistDisplayName(artist: Artist) {
		return artist.full_name || artist.artist_name || artist.legal_first_name || 'Unknown'
	}

	// Validation helper
	function validateField(field: keyof CreateEnsemble, value: any) {
		try {
			const fieldSchema = createEnsembleSchema.shape[field]
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
	function handleInputChange(field: keyof CreateEnsemble, value: any) {
		formData[field] = value as any
		validateField(field, value)
		submitError = null
	}

	function resetForm() {
		formData = {
			name: '',
			ensemble_type: '',
			description: '',
			website: '',
			status: 'active'
		}
		formErrors = {}
		submitError = null
		isLoading = false
		selectedArtistIds.clear()
		selectedArtistIds = new Set()
		artistRoles = {}
		artistSearchTerm = ''
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault()

		// Reset previous errors
		formErrors = {}
		submitError = null

		// Validate the entire form
		try {
			createEnsembleSchema.parse(formData)
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
			formErrors.name = 'Name is required'
			formErrors = { ...formErrors }
			return
		}

		if (!formData.ensemble_type?.trim()) {
			formErrors.ensemble_type = 'Ensemble type is required'
			formErrors = { ...formErrors }
			return
		}

		isLoading = true

		try {
			// Create a clean data object
			const cleanData = createEnsembleSchema.parse(formData)

			// Remove empty strings
			Object.keys(cleanData).forEach(key => {
				const value = cleanData[key as keyof CreateEnsemble]
				if (typeof value === 'string' && value.trim() === '') {
					delete cleanData[key as keyof CreateEnsemble]
				}
			})

			const newEnsemble = await createEnsemble(cleanData)

			// Add members if any are selected
			if (selectedArtistIds.size > 0 && newEnsemble.id) {
				const memberInserts = Array.from(selectedArtistIds).map(artistId => ({
					ensemble_id: newEnsemble.id,
					artist_id: artistId,
					role: artistRoles[artistId] || null,
					joined_at: new Date().toISOString(),
					is_active: true
				}))

				const { error: membersError } = await supabase
					.from('phwb_ensemble_members')
					.insert(memberInserts)

				if (membersError) {
					console.error('Failed to add members:', membersError)
					// Don't fail the entire operation, just log it
					submitError = 'Ensemble created, but some members could not be added.'
				}
			}

			dispatch('success', { ensemble: newEnsemble })
			dispatch('close')
			resetForm()
		} catch (error) {
			console.error('Failed to create ensemble:', error)
			submitError = error instanceof Error ? error.message : 'Failed to create ensemble. Please try again.'
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

<div class="modal" class:modal-open={open}>
	<div class="modal-box w-full max-w-4xl max-h-[90vh] overflow-y-auto">
		<!-- Header -->
		<div class="flex items-center justify-between mb-6">
			<h3 class="text-lg font-semibold">Add New Ensemble</h3>
			<button
				class="btn btn-sm btn-circle btn-ghost"
				onclick={handleClose}
				disabled={isLoading}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Form Content -->
		<form onsubmit={handleSubmit} class="space-y-4">
			{#if submitError}
				<div class="alert alert-error">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>{submitError}</span>
				</div>
			{/if}

			<div class="form-control">
				<label class="label">
					<span class="label-text">Name <span class="text-error">*</span></span>
				</label>
				<input
					type="text"
					class="input input-bordered {formErrors.name ? 'input-error' : ''}"
					value={formData.name || ''}
					oninput={(e) => handleInputChange('name', e.currentTarget.value)}
					placeholder="Enter ensemble name"
					required
				/>
				{#if formErrors.name}
					<label class="label">
						<span class="label-text-alt text-error">{formErrors.name}</span>
					</label>
				{/if}
			</div>

			<div class="form-control">
				<label class="label">
					<span class="label-text">Ensemble Type <span class="text-error">*</span></span>
				</label>
				<select
					class="select select-bordered {formErrors.ensemble_type ? 'select-error' : ''}"
					value={formData.ensemble_type || ''}
					onchange={(e) => handleInputChange('ensemble_type', e.currentTarget.value)}
					required
				>
					<option value="">Select ensemble type</option>
					<option value="Choir">Choir</option>
					<option value="Orchestra">Orchestra</option>
					<option value="Band">Band</option>
					<option value="Chamber Group">Chamber Group</option>
					<option value="Quartet">Quartet</option>
					<option value="Trio">Trio</option>
					<option value="Duo">Duo</option>
					<option value="Jazz Ensemble">Jazz Ensemble</option>
					<option value="Opera Company">Opera Company</option>
					<option value="Other">Other</option>
				</select>
				{#if formErrors.ensemble_type}
					<label class="label">
						<span class="label-text-alt text-error">{formErrors.ensemble_type}</span>
					</label>
				{/if}
			</div>

			<div class="form-control">
				<label class="label">
					<span class="label-text">Status</span>
				</label>
				<select
					class="select select-bordered {formErrors.status ? 'select-error' : ''}"
					value={formData.status || 'active'}
					onchange={(e) => handleInputChange('status', e.currentTarget.value)}
				>
					<option value="active">Active</option>
					<option value="inactive">Inactive</option>
					<option value="archived">Archived</option>
				</select>
				{#if formErrors.status}
					<label class="label">
						<span class="label-text-alt text-error">{formErrors.status}</span>
					</label>
				{/if}
			</div>

			<div class="form-control">
				<label class="label">
					<span class="label-text">Website</span>
				</label>
				<input
					type="url"
					class="input input-bordered {formErrors.website ? 'input-error' : ''}"
					value={formData.website || ''}
					oninput={(e) => handleInputChange('website', e.currentTarget.value)}
					placeholder="https://ensemble-website.com"
				/>
				{#if formErrors.website}
					<label class="label">
						<span class="label-text-alt text-error">{formErrors.website}</span>
					</label>
				{/if}
			</div>

			<div class="form-control">
				<label class="label">
					<span class="label-text">Description</span>
				</label>
				<textarea
					class="textarea textarea-bordered h-24 {formErrors.description ? 'textarea-error' : ''}"
					value={formData.description || ''}
					oninput={(e) => handleInputChange('description', e.currentTarget.value)}
					placeholder="Brief description of the ensemble"
				></textarea>
				{#if formErrors.description}
					<label class="label">
						<span class="label-text-alt text-error">{formErrors.description}</span>
					</label>
				{/if}
			</div>

			<div class="divider">Add Members (Optional)</div>

			<!-- Artist Assignment Section -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<label class="label">
						<span class="label-text font-semibold">Select Artists</span>
					</label>
					{#if selectedArtistIds.size > 0}
						<span class="badge badge-primary">{selectedArtistIds.size} selected</span>
					{/if}
				</div>

				<!-- Artist Search -->
				<div class="form-control">
					<input
						type="text"
						bind:value={artistSearchTerm}
						placeholder="Search artists by name or email..."
						class="input input-bordered input-sm"
						disabled={isLoading}
					/>
				</div>

				<!-- Artist List -->
				{#if loadingArtists}
					<div class="text-center py-8">
						<span class="loading loading-spinner loading-md"></span>
						<p class="mt-2 text-sm">Loading artists...</p>
					</div>
				{:else if displayedArtists.length > 0}
					<div class="border border-base-300 rounded-lg">
						<!-- Header with bulk actions -->
						<div class="bg-base-200 px-4 py-2 border-b border-base-300 flex items-center justify-between">
							<span class="text-sm font-medium">
								{displayedArtists.length} artists available
							</span>
							<div class="flex gap-2">
								{#if displayedArtists.length > 1}
									<button
										type="button"
										class="btn btn-outline btn-xs"
										onclick={selectAllVisibleArtists}
										disabled={isLoading}
									>
										Select All
									</button>
								{/if}
								{#if selectedArtistIds.size > 0}
									<button
										type="button"
										class="btn btn-outline btn-xs"
										onclick={clearAllArtists}
										disabled={isLoading}
									>
										Clear All
									</button>
								{/if}
							</div>
						</div>

						<!-- Artist list -->
						<div class="max-h-64 overflow-y-auto">
							{#each displayedArtists as artist}
								<label class="flex items-center p-3 hover:bg-base-100 border-b border-base-300 last:border-b-0 cursor-pointer">
									<input
										type="checkbox"
										class="checkbox checkbox-primary checkbox-sm mr-3"
										checked={selectedArtistIds.has(artist.id!)}
										onchange={() => toggleArtist(artist.id!)}
										disabled={isLoading}
									/>
									<div class="flex-1">
										<div class="font-medium text-sm">
											{getArtistDisplayName(artist)}
										</div>
										{#if artist.email}
											<div class="text-xs text-base-content/60">
												{artist.email}
											</div>
										{/if}
									</div>
								</label>
							{/each}
						</div>
					</div>
				{:else if artistSearchTerm}
					<div class="text-center py-6 bg-base-200 rounded-lg">
						<Search class="w-12 h-12 mx-auto text-base-content/70" />
						<p class="mt-2 text-sm">No artists found</p>
						<p class="text-xs opacity-60">Try adjusting your search terms</p>
					</div>
				{:else}
					<div class="text-center py-6 bg-base-200 rounded-lg">
						<Users class="w-12 h-12 mx-auto text-base-content/70" />
						<p class="mt-2 text-sm">No artists available</p>
					</div>
				{/if}

				<!-- Selected Artists Preview with Roles -->
				{#if selectedArtistIds.size > 0}
					<div class="border border-primary/20 bg-primary/5 rounded-lg p-3">
						<h5 class="text-sm font-medium text-primary mb-2">
							Selected Members ({selectedArtistIds.size})
						</h5>
						<div class="space-y-2">
							{#each Array.from(selectedArtistIds) as artistId}
								{@const artist = artists.find(a => a.id === artistId)}
								{#if artist}
									<div class="flex items-center gap-2">
										<span class="badge badge-primary badge-sm">
											{getArtistDisplayName(artist)}
										</span>
										<input
											type="text"
											placeholder="Role (optional)"
											class="input input-xs input-bordered flex-1"
											value={artistRoles[artistId] || ''}
											oninput={(e) => artistRoles[artistId] = e.currentTarget.value}
											disabled={isLoading}
										/>
										<button
											type="button"
											class="btn btn-xs btn-ghost btn-circle"
											onclick={() => toggleArtist(artistId)}
											disabled={isLoading}
										>
											✕
										</button>
									</div>
								{/if}
							{/each}
						</div>
						<p class="text-xs text-base-content/60 mt-2 flex items-center gap-1">
							<Lightbulb class="w-3 h-3" />
							You can specify roles like "Lead Vocalist", "Pianist", etc.
						</p>
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-2 pt-4">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={handleClose}
					disabled={isLoading}
				>
					Cancel
				</button>
				<button
					type="submit"
					class="btn btn-primary"
					disabled={isLoading || !formData.name?.trim() || !formData.ensemble_type?.trim()}
				>
					{#if isLoading}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
					{/if}
					Create Ensemble
				</button>
			</div>
		</form>
	</div>
</div>
