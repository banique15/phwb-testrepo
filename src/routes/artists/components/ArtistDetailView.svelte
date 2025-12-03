<script lang="ts">
	import MultiSelect from '$lib/components/ui/MultiSelect.svelte'
	import { GENRE_OPTIONS, INSTRUMENT_OPTIONS } from '$lib/utils/artist-options'
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

	// Availability modal state
	let isAvailabilityModalOpen = $state(false)
	let availabilityPeriod = $state('7') // days
	let availabilityStartDate = $state(new Date().toISOString().split('T')[0])
	let availabilityEndDate = $state('')
	let checkingAvailability = $state(false)

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

	// Availability functions
	function openAvailabilityModal() {
		isAvailabilityModalOpen = true
		availabilityPeriod = '7'
		availabilityStartDate = new Date().toISOString().split('T')[0]
		availabilityEndDate = ''
	}

	function closeAvailabilityModal() {
		isAvailabilityModalOpen = false
	}

	async function checkAvailability() {
		checkingAvailability = true

		// Mock AI check - just simulate a delay
		await new Promise(resolve => setTimeout(resolve, 2000))

		// In a real implementation, this would call an API to trigger AI to reach out
		console.log('Checking availability for:', {
			artist: displayName,
			period: availabilityPeriod,
			startDate: availabilityStartDate,
			endDate: availabilityEndDate
		})

		checkingAvailability = false
		closeAvailabilityModal()

		// Show success message (could use a toast notification in real implementation)
		alert(`🤖 AI is reaching out to ${displayName} to check their availability!`)
	}

	// Update end date when period changes
	$effect(() => {
		if (availabilityPeriod && availabilityPeriod !== 'custom') {
			const start = new Date(availabilityStartDate)
			const days = parseInt(availabilityPeriod)
			const end = new Date(start)
			end.setDate(end.getDate() + days)
			availabilityEndDate = end.toISOString().split('T')[0]
		}
	})
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
						class="btn btn-sm btn-secondary"
						onclick={openAvailabilityModal}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
						Get Availability
					</button>
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
							<option value="Employee">Employee</option>
							<option value="1099">1099</option>
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
						<MultiSelect
							options={GENRE_OPTIONS}
							selected={Array.isArray(editData.genres) ? editData.genres : []}
							onChange={(selected) => {
								editData.genres = selected
							}}
							placeholder="Select genres..."
						/>
					{:else}
						{#if artist.genres && Array.isArray(artist.genres) && artist.genres.length > 0}
							<div class="flex flex-wrap gap-1">
								{#each artist.genres as genre}
									<span class="badge badge-sm badge-outline">{genre}</span>
								{/each}
							</div>
						{:else}
							<p class="text-sm">-</p>
						{/if}
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Instruments</span>
					</label>
					{#if isEditing}
						<MultiSelect
							options={INSTRUMENT_OPTIONS}
							selected={Array.isArray(editData.instruments) ? editData.instruments : []}
							onChange={(selected) => {
								editData.instruments = selected
							}}
							placeholder="Select instruments..."
						/>
					{:else}
						{#if artist.instruments && Array.isArray(artist.instruments) && artist.instruments.length > 0}
							<div class="flex flex-wrap gap-1">
								{#each artist.instruments as instrument}
									<span class="badge badge-sm badge-outline">{instrument}</span>
								{/each}
							</div>
						{:else}
							<p class="text-sm">-</p>
						{/if}
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

<!-- Get Availability Modal -->
{#if isAvailabilityModalOpen}
	<dialog class="modal" open>
		<div class="modal-box">
			<h3 class="font-bold text-lg mb-4">Check Artist Availability</h3>

			<div class="space-y-4">
				<div class="bg-secondary/10 p-3 rounded-lg flex items-start gap-3">
					<div class="flex gap-0.5 mt-1">
						<span class="inline-block w-1.5 h-1.5 bg-secondary rounded-full animate-pulse" style="animation-delay: 0ms;"></span>
						<span class="inline-block w-1.5 h-1.5 bg-secondary rounded-full animate-pulse" style="animation-delay: 150ms;"></span>
						<span class="inline-block w-1.5 h-1.5 bg-secondary rounded-full animate-pulse" style="animation-delay: 300ms;"></span>
					</div>
					<p class="text-sm text-secondary flex-1">
						AI will reach out to <strong>{displayName}</strong> via their preferred contact method to check their availability.
					</p>
				</div>

				<!-- Period Selection -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Time Period</span>
					</label>
					<select
						bind:value={availabilityPeriod}
						class="select select-bordered w-full"
						disabled={checkingAvailability}
					>
						<option value="7">Next 7 days</option>
						<option value="14">Next 2 weeks</option>
						<option value="30">Next month</option>
						<option value="60">Next 2 months</option>
						<option value="90">Next 3 months</option>
						<option value="custom">Custom date range</option>
					</select>
				</div>

				<!-- Start Date -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Start Date</span>
					</label>
					<input
						type="date"
						bind:value={availabilityStartDate}
						class="input input-bordered w-full"
						disabled={checkingAvailability}
					/>
				</div>

				<!-- End Date (shown when custom or auto-calculated) -->
				{#if availabilityEndDate}
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">End Date</span>
						</label>
						<input
							type="date"
							bind:value={availabilityEndDate}
							class="input input-bordered w-full"
							disabled={availabilityPeriod !== 'custom' || checkingAvailability}
						/>
					</div>
				{/if}

				<!-- Summary -->
				<div class="bg-base-200 p-3 rounded-lg">
					<p class="text-sm">
						<strong>Summary:</strong> AI will check {displayName}'s availability from
						<strong>{new Date(availabilityStartDate).toLocaleDateString()}</strong>
						{#if availabilityEndDate}
							to <strong>{new Date(availabilityEndDate).toLocaleDateString()}</strong>
						{/if}
					</p>
				</div>
			</div>

			<div class="modal-action">
				<button
					class="btn btn-ghost"
					onclick={closeAvailabilityModal}
					disabled={checkingAvailability}
				>
					Cancel
				</button>
				<button
					class="btn btn-secondary"
					onclick={checkAvailability}
					disabled={checkingAvailability}
				>
					{#if checkingAvailability}
						<span class="loading loading-spinner loading-sm"></span>
						Sending Request...
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
						Check Availability
					{/if}
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={closeAvailabilityModal}>close</button>
		</form>
	</dialog>
{/if}
