<script lang="ts">
	import { supabase } from '$lib/supabase'
	import type { Ensemble } from '$lib/schemas/ensemble'
	import type { Artist } from '$lib/schemas/artist'

	interface Props {
		open?: boolean
		ensemble: Ensemble
		onClose?: () => void
		onSuccess?: () => void
	}

	let { open = false, ensemble, onClose, onSuccess }: Props = $props()

	let modalElement: HTMLDialogElement
	let artistSearch = $state('')
	let selectedArtistId = $state<string | null>(null)
	let role = $state('')
	let artists = $state<Artist[]>([])
	let loadingArtists = $state(true)
	let submitting = $state(false)
	let error = $state<string | null>(null)

	// Load artists on mount
	$effect(() => {
		if (open) {
			loadArtists()
		}
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
			error = 'Failed to load artists'
		} finally {
			loadingArtists = false
		}
	}

	// Control modal visibility
	$effect(() => {
		if (modalElement) {
			if (open) {
				modalElement.showModal()
			} else {
				modalElement.close()
			}
		}
	})

	// Filter artists based on search
	let filteredArtists = $derived.by(() => {
		if (!artistSearch.trim()) return artists

		const searchLower = artistSearch.toLowerCase()
		return artists.filter(artist =>
			artist.full_name?.toLowerCase().includes(searchLower) ||
			artist.legal_first_name?.toLowerCase().includes(searchLower) ||
			artist.artist_name?.toLowerCase().includes(searchLower) ||
			artist.email?.toLowerCase().includes(searchLower)
		)
	})

	// Get selected artist name
	let selectedArtistName = $derived.by(() => {
		if (!selectedArtistId) return ''
		const artist = artists.find(a => a.id === selectedArtistId)
		return artist?.full_name || artist?.artist_name || artist?.legal_first_name || ''
	})

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault()

		if (!selectedArtistId) {
			error = 'Please select an artist'
			return
		}

		if (!ensemble.id) {
			error = 'Invalid ensemble'
			return
		}

		submitting = true
		error = null

		try {
			// Check if artist is already a member
			const { data: existing, error: checkError } = await supabase
				.from('phwb_ensemble_members')
				.select('id')
				.eq('ensemble_id', ensemble.id)
				.eq('artist_id', selectedArtistId)
				.eq('is_active', true)
				.single()

			if (existing) {
				error = 'This artist is already a member of this ensemble'
				submitting = false
				return
			}

			// Add the member
			const { error: insertError } = await supabase
				.from('phwb_ensemble_members')
				.insert({
					ensemble_id: ensemble.id,
					artist_id: selectedArtistId,
					role: role.trim() || null,
					joined_at: new Date().toISOString(),
					is_active: true
				})

			if (insertError) throw insertError

			// Success - reset form and notify parent
			resetForm()
			onSuccess?.()
			onClose?.()

		} catch (err: any) {
			console.error('Error adding member:', err)
			error = err.message || 'Failed to add member'
		} finally {
			submitting = false
		}
	}

	function resetForm() {
		selectedArtistId = null
		role = ''
		artistSearch = ''
		error = null
	}

	function handleClose() {
		resetForm()
		onClose?.()
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === modalElement) {
			handleClose()
		}
	}

	function selectArtist(artistId: string) {
		selectedArtistId = artistId
		artistSearch = ''
	}

	function clearArtistSelection() {
		selectedArtistId = null
		artistSearch = ''
	}

	function getArtistDisplayName(artist: Artist) {
		return artist.full_name || artist.artist_name || artist.legal_first_name || 'Unknown'
	}
</script>

<dialog
	bind:this={modalElement}
	class="modal"
	onclick={handleBackdropClick}
>
	<div class="modal-box max-w-lg">
		<div class="flex items-center justify-between mb-6">
			<h3 class="font-bold text-lg">Add Member to {ensemble.name}</h3>
			<button
				class="btn btn-sm btn-circle btn-ghost"
				onclick={handleClose}
				disabled={submitting}
			>
				✕
			</button>
		</div>

		{#if error}
			<div class="alert alert-error mb-4">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{error}</span>
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="space-y-4">
			<!-- Artist Selection -->
			<div class="form-control">
				<label class="label">
					<span class="label-text">Artist <span class="text-error">*</span></span>
				</label>

				{#if selectedArtistId && selectedArtistName}
					<!-- Display selected artist -->
					<div class="flex gap-2">
						<input
							type="text"
							value={selectedArtistName}
							class="input input-bordered flex-1"
							disabled
						/>
						<button
							type="button"
							class="btn btn-outline"
							onclick={clearArtistSelection}
							disabled={submitting}
						>
							Change
						</button>
					</div>
				{:else}
					<!-- Search input -->
					<input
						type="text"
						bind:value={artistSearch}
						placeholder="Search artists by name or email..."
						class="input input-bordered"
						disabled={submitting || loadingArtists}
						autocomplete="off"
					/>

					<!-- Artist list -->
					{#if loadingArtists}
						<div class="text-center py-4">
							<span class="loading loading-spinner loading-sm"></span>
						</div>
					{:else if filteredArtists.length > 0}
						<div class="border border-base-300 rounded-lg mt-2 max-h-64 overflow-y-auto">
							{#each filteredArtists as artist}
								<button
									type="button"
									class="w-full text-left px-4 py-3 hover:bg-base-200 border-b border-base-300 last:border-b-0"
									onclick={() => selectArtist(artist.id!)}
									disabled={submitting}
								>
									<div class="font-medium text-sm">{getArtistDisplayName(artist)}</div>
									{#if artist.email}
										<div class="text-xs text-base-content/60 mt-1">
											{artist.email}
										</div>
									{/if}
								</button>
							{/each}
						</div>
					{:else if artistSearch}
						<div class="text-center py-4 text-sm text-base-content/60">
							No artists found
						</div>
					{/if}
				{/if}
			</div>

			<!-- Role (Optional) -->
			<div class="form-control">
				<label class="label">
					<span class="label-text">Role (Optional)</span>
				</label>
				<input
					type="text"
					bind:value={role}
					placeholder="e.g., Lead Vocalist, Pianist, etc."
					class="input input-bordered"
					maxlength="100"
					disabled={submitting}
				/>
				<label class="label">
					<span class="label-text-alt">Specify the member's role or instrument</span>
				</label>
			</div>

			<!-- Form Actions -->
			<div class="modal-action">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={handleClose}
					disabled={submitting}
				>
					Cancel
				</button>
				<button
					type="submit"
					class="btn btn-primary"
					disabled={submitting || !selectedArtistId}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-sm"></span>
						Adding...
					{:else}
						Add Member
					{/if}
				</button>
			</div>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button onclick={handleClose}>close</button>
	</form>
</dialog>
