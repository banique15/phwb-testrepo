<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { updateArtist } from '$lib/stores/artists'
	import type { Artist } from '$lib/schemas/artist'
	import { formatPhone, normalizePhoneForDB } from '$lib/utils/phone'
	import PerformanceHistory from '$lib/components/PerformanceHistory.svelte'

	interface Props {
		artist: Artist
	}

	let { artist }: Props = $props()

	const dispatch = createEventDispatcher<{
		update: { artist: Artist }
		delete: void
	}>()

	let isEditing = $state(false)
	let editData = $state<Partial<Artist>>({})
	let isLoading = $state(false)
	let error = $state<string | null>(null)

	// Reset edit data when artist changes
	$effect(() => {
		if (artist) {
			editData = { ...artist }
			isEditing = false
			error = null
		}
	})

	function startEdit() {
		editData = { ...artist }
		isEditing = true
		error = null
	}

	function cancelEdit() {
		isEditing = false
		editData = { ...artist }
		error = null
	}

	async function saveEdit() {
		if (!artist.id) return

		isLoading = true
		error = null

		try {
			// Normalize phone number before saving
			const dataToSave = { ...editData }
			if (dataToSave.phone) {
				dataToSave.phone = normalizePhoneForDB(dataToSave.phone)
			}

			const updatedArtist = await updateArtist(artist.id, dataToSave)
			dispatch('update', { artist: updatedArtist })
			isEditing = false
		} catch (err: any) {
			error = err.message || 'Failed to update artist'
		} finally {
			isLoading = false
		}
	}

	function handleDelete() {
		dispatch('delete')
	}

	function handleArrayInput(field: keyof Artist, value: string) {
		const items = value.split(',').map(item => item.trim()).filter(Boolean)
		editData[field] = items as any
	}

	function getArrayDisplayValue(arr: any): string {
		if (!arr || !Array.isArray(arr)) return ''
		return arr.join(', ')
	}

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		return new Date(dateStr).toLocaleDateString()
	}

	// Get display name
	let displayName = $derived(artist.full_name || artist.legal_first_name || 'Unnamed Artist')
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="flex-none px-6 py-4 border-b border-base-200 bg-base-50">
		<div class="flex items-start justify-between">
			<div class="flex-1">
				<h2 class="text-2xl font-bold mb-1">{displayName}</h2>
				{#if artist.artist_name}
					<p class="text-base-content/70 mb-2">"{artist.artist_name}"</p>
				{/if}
				<div class="flex flex-wrap gap-2">
					{#if artist.genres && Array.isArray(artist.genres) && artist.genres.length > 0}
						{#each artist.genres.slice(0, 3) as genre}
							<span class="badge badge-primary badge-sm">{genre}</span>
						{/each}
					{/if}
					{#if artist.can_be_soloist}
						<span class="badge badge-accent badge-sm">Soloist</span>
					{/if}
					{#if artist.sightreads}
						<span class="badge badge-info badge-sm">Sight Reads</span>
					{/if}
				</div>
			</div>
			<div class="flex gap-2">
				{#if isEditing}
					<button
						class="btn btn-sm btn-ghost"
						onclick={cancelEdit}
						disabled={isLoading}
					>
						Cancel
					</button>
					<button
						class="btn btn-sm btn-primary"
						onclick={saveEdit}
						disabled={isLoading}
					>
						{#if isLoading}
							<span class="loading loading-spinner loading-xs"></span>
						{/if}
						Save
					</button>
				{:else}
					<button
						class="btn btn-sm btn-outline"
						onclick={startEdit}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
						</svg>
						Edit
					</button>
					<button
						class="btn btn-sm btn-error"
						onclick={handleDelete}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
						Delete
					</button>
				{/if}
			</div>
		</div>
		{#if error}
			<div class="alert alert-error mt-4">
				<span>{error}</span>
			</div>
		{/if}
	</div>

	<!-- All Content in One Scrollable View -->
	<div class="flex-1 overflow-y-auto px-6 py-6">
		<div class="space-y-8">
			<!-- Profile Section -->
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b border-base-300 pb-2">Profile Information</h3>
				<div class="grid grid-cols-2 gap-4">
					<div class="form-control">
						<label class="label">
							<span class="label-text text-xs font-semibold">Legal First Name</span>
						</label>
						{#if isEditing}
							<input
								type="text"
								class="input input-sm input-bordered"
								bind:value={editData.legal_first_name}
							/>
						{:else}
							<p class="text-sm">{artist.legal_first_name || '-'}</p>
						{/if}
					</div>
					<div class="form-control">
						<label class="label">
							<span class="label-text text-xs font-semibold">Legal Last Name</span>
						</label>
						{#if isEditing}
							<input
								type="text"
								class="input input-sm input-bordered"
								bind:value={editData.legal_last_name}
							/>
						{:else}
							<p class="text-sm">{artist.legal_last_name || '-'}</p>
						{/if}
					</div>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Email</span>
					</label>
					{#if isEditing}
						<input
							type="email"
							class="input input-sm input-bordered"
							bind:value={editData.email}
						/>
					{:else}
						<p class="text-sm">{artist.email || '-'}</p>
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Phone</span>
					</label>
					{#if isEditing}
						<input
							type="tel"
							class="input input-sm input-bordered"
							bind:value={editData.phone}
						/>
					{:else}
						<p class="text-sm">{formatPhone(artist.phone) || '-'}</p>
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Location</span>
					</label>
					{#if isEditing}
						<input
							type="text"
							class="input input-sm input-bordered"
							bind:value={editData.location}
						/>
					{:else}
						<p class="text-sm">{artist.location || '-'}</p>
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Metropolitan Hub</span>
					</label>
					{#if isEditing}
						<select
							class="select select-sm select-bordered"
							bind:value={editData.metropolitan_hub}
						>
							<option value="">Select hub</option>
							<option value="New York">New York</option>
							<option value="Los Angeles">Los Angeles</option>
							<option value="Chicago">Chicago</option>
							<option value="Houston">Houston</option>
							<option value="Philadelphia">Philadelphia</option>
						</select>
					{:else}
						<p class="text-sm">{artist.metropolitan_hub || '-'}</p>
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Shirt Size</span>
					</label>
					{#if isEditing}
						<select
							class="select select-sm select-bordered"
							bind:value={editData.shirt_size}
						>
							<option value="">Select size</option>
							<option value="XS">XS</option>
							<option value="S">S</option>
							<option value="M">M</option>
							<option value="L">L</option>
							<option value="XL">XL</option>
							<option value="XXL">XXL</option>
							<option value="3XL">3XL</option>
						</select>
					{:else}
						<p class="text-sm">{artist.shirt_size || '-'}</p>
					{/if}
				</div>
			</div>

			<!-- Professional Section -->
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b border-base-300 pb-2">Professional Details</h3>
				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Employment Status</span>
					</label>
					{#if isEditing}
						<select
							class="select select-sm select-bordered"
							bind:value={editData.employment_status}
						>
							<option value="">Select status</option>
							<option value="Full-time">Full-time</option>
							<option value="Part-time">Part-time</option>
							<option value="Freelance">Freelance</option>
							<option value="Student">Student</option>
							<option value="Retired">Retired</option>
						</select>
					{:else}
						<p class="text-sm">{artist.employment_status || '-'}</p>
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Genres</span>
					</label>
					{#if isEditing}
						<input
							type="text"
							class="input input-sm input-bordered"
							value={getArrayDisplayValue(editData.genres)}
							oninput={(e) => handleArrayInput('genres', e.currentTarget.value)}
							placeholder="Classical, Jazz, Pop (comma-separated)"
						/>
					{:else}
						<p class="text-sm">{getArrayDisplayValue(artist.genres) || '-'}</p>
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Instruments</span>
					</label>
					{#if isEditing}
						<input
							type="text"
							class="input input-sm input-bordered"
							value={getArrayDisplayValue(editData.instruments)}
							oninput={(e) => handleArrayInput('instruments', e.currentTarget.value)}
							placeholder="Piano, Violin, Voice (comma-separated)"
						/>
					{:else}
						<p class="text-sm">{getArrayDisplayValue(artist.instruments) || '-'}</p>
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Languages</span>
					</label>
					{#if isEditing}
						<input
							type="text"
							class="input input-sm input-bordered"
							value={getArrayDisplayValue(editData.languages)}
							oninput={(e) => handleArrayInput('languages', e.currentTarget.value)}
							placeholder="English, Spanish, French (comma-separated)"
						/>
					{:else}
						<p class="text-sm">{getArrayDisplayValue(artist.languages) || '-'}</p>
					{/if}
				</div>

				<div class="flex gap-4">
					<div class="form-control">
						<label class="label cursor-pointer gap-2">
							<span class="label-text text-xs font-semibold">Sight Reads</span>
							{#if isEditing}
								<input
									type="checkbox"
									class="toggle toggle-sm toggle-primary"
									bind:checked={editData.sightreads}
								/>
							{:else}
								<input
									type="checkbox"
									class="toggle toggle-sm toggle-primary"
									checked={artist.sightreads}
									disabled
								/>
							{/if}
						</label>
					</div>

					<div class="form-control">
						<label class="label cursor-pointer gap-2">
							<span class="label-text text-xs font-semibold">Can Be Soloist</span>
							{#if isEditing}
								<input
									type="checkbox"
									class="toggle toggle-sm toggle-primary"
									bind:checked={editData.can_be_soloist}
								/>
							{:else}
								<input
									type="checkbox"
									class="toggle toggle-sm toggle-primary"
									checked={artist.can_be_soloist}
									disabled
								/>
							{/if}
						</label>
					</div>
				</div>
			</div>

			<!-- Bio Section -->
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b border-base-300 pb-2">Biography</h3>
				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">One Sentence Bio</span>
					</label>
					{#if isEditing}
						<input
							type="text"
							class="input input-sm input-bordered"
							bind:value={editData.one_sentence_bio}
							maxlength="200"
						/>
					{:else}
						<p class="text-sm">{artist.one_sentence_bio || '-'}</p>
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Full Bio</span>
					</label>
					{#if isEditing}
						<textarea
							class="textarea textarea-bordered h-48 text-sm"
							bind:value={editData.bio}
							maxlength="2000"
						></textarea>
					{:else}
						<p class="text-sm whitespace-pre-wrap">{artist.bio || '-'}</p>
					{/if}
				</div>
			</div>

			<!-- Social Section -->
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b border-base-300 pb-2">Social Media & Web</h3>
				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Website</span>
					</label>
					{#if isEditing}
						<input
							type="url"
							class="input input-sm input-bordered"
							bind:value={editData.website}
							placeholder="https://example.com"
						/>
					{:else}
						{#if artist.website}
							<a href={artist.website} target="_blank" rel="noopener noreferrer" class="text-sm link link-primary">
								{artist.website}
							</a>
						{:else}
							<p class="text-sm">-</p>
						{/if}
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Instagram</span>
					</label>
					{#if isEditing}
						<input
							type="text"
							class="input input-sm input-bordered"
							bind:value={editData.instagram}
							placeholder="username (without @)"
						/>
					{:else}
						{#if artist.instagram}
							<a href="https://instagram.com/{artist.instagram}" target="_blank" rel="noopener noreferrer" class="text-sm link link-primary">
								@{artist.instagram}
							</a>
						{:else}
							<p class="text-sm">-</p>
						{/if}
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Facebook</span>
					</label>
					{#if isEditing}
						<input
							type="url"
							class="input input-sm input-bordered"
							bind:value={editData.facebook}
							placeholder="https://facebook.com/artist"
						/>
					{:else}
						{#if artist.facebook}
							<a href={artist.facebook} target="_blank" rel="noopener noreferrer" class="text-sm link link-primary">
								{artist.facebook}
							</a>
						{:else}
							<p class="text-sm">-</p>
						{/if}
					{/if}
				</div>
			</div>
		</div>

		<!-- Performance History Section -->
		{#if !isEditing && artist.id}
			<div class="divider my-6"></div>
			<div class="mt-6">
				<PerformanceHistory artistId={artist.id} showStats={true} />
			</div>
		{/if}
	</div>
</div>
