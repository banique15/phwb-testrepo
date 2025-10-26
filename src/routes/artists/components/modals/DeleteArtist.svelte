<script lang="ts">
	import { deleteArtist } from '$lib/stores/artists'
	import type { Artist } from '$lib/schemas/artist'
	
	interface Props {
		open?: boolean
		artist?: Artist | null
		onClose?: () => void
		onSuccess?: () => void
	}
	
	let { open = false, artist = null, onClose, onSuccess }: Props = $props()
	
	let modalElement: HTMLDialogElement
	let loading = $state(false)
	let confirmText = $state('')
	let error = $state('')
	
	// Watch for open prop changes to control modal
	$effect(() => {
		if (modalElement) {
			if (open) {
				modalElement.showModal()
				// Reset state when opening
				confirmText = ''
				error = ''
				loading = false
			} else {
				modalElement.close()
			}
		}
	})
	
	// Get the display name for the artist (matching the main page logic)
	let artistDisplayName = $derived(
		artist ? (artist.full_name || artist.legal_first_name || 'Unnamed Artist') : ''
	)
	
	// Check if confirmation text matches artist name
	let canDelete = $derived(
		artist && artistDisplayName && confirmText.toLowerCase() === artistDisplayName.toLowerCase()
	)
	
	async function handleDelete() {
		if (!artist || !canDelete) return
		
		loading = true
		error = ''
		
		try {
			await deleteArtist(artist.id!)
			onSuccess?.()
			onClose?.()
		} catch (err: any) {
			error = err.message || 'Failed to delete artist'
		} finally {
			loading = false
		}
	}
	
	function handleCancel() {
		onClose?.()
	}
	
	function handleBackdropClick(e: MouseEvent) {
		// Close modal when clicking backdrop
		if (e.target === modalElement) {
			onClose?.()
		}
	}
	
	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		return new Date(dateStr).toLocaleDateString()
	}
</script>

<dialog
	bind:this={modalElement}
	class="modal"
	onclick={handleBackdropClick}
>
	<div class="modal-box w-11/12 max-w-lg">
		<div class="flex items-center justify-between mb-6">
			<h3 class="font-bold text-lg text-error">Delete Artist</h3>
			<button
				class="btn btn-sm btn-circle btn-ghost"
				onclick={handleCancel}
				disabled={loading}
			>
				✕
			</button>
		</div>
		
		{#if artist}
			<div class="space-y-4">
				<!-- Warning -->
				<div class="alert alert-warning">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.99-.833-2.598 0L3.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
					</svg>
					<span>This action cannot be undone!</span>
				</div>
				
				<!-- Artist Details -->
				<div class="bg-base-200 p-4 rounded-lg">
					<h4 class="font-semibold mb-2">Artist to be deleted:</h4>
					<div class="space-y-1 text-sm">
						<p><span class="font-medium">Name:</span> {artistDisplayName}</p>
						{#if artist.artist_name}
							<p><span class="font-medium">Artist Name:</span> "{artist.artist_name}"</p>
						{/if}
						<p><span class="font-medium">Email:</span> {artist.email || 'Not specified'}</p>
						{#if artist.phone}
							<p><span class="font-medium">Phone:</span> {artist.phone}</p>
						{/if}
						{#if artist.location}
							<p><span class="font-medium">Location:</span> {artist.location}</p>
						{/if}
					</div>
				</div>
				
				{#if error}
					<div class="alert alert-error">
						<span>{error}</span>
					</div>
				{/if}
				
				<!-- Confirmation Input -->
				<div class="form-control">
					<label class="label" for="confirm-delete-input">
						<span class="label-text">
							Type <strong>"{artistDisplayName}"</strong> to confirm deletion:
						</span>
					</label>
					<input
						id="confirm-delete-input"
						type="text"
						bind:value={confirmText}
						class="input input-bordered"
						placeholder="Enter artist name exactly"
						disabled={loading}
					/>
				</div>
				
				<!-- Actions -->
				<div class="flex justify-end gap-2 pt-4">
					<button
						class="btn btn-outline"
						onclick={handleCancel}
						disabled={loading}
					>
						Cancel
					</button>
					<button
						class="btn btn-error"
						onclick={handleDelete}
						disabled={!canDelete || loading}
					>
						{#if loading}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						Delete Artist
					</button>
				</div>
			</div>
		{:else}
			<div class="text-center py-8">
				<p class="text-lg">No artist selected</p>
				<p class="text-sm opacity-60">Please select an artist to delete</p>
			</div>
		{/if}
	</div>
	
	<!-- Backdrop (for accessibility) -->
	<form method="dialog" class="modal-backdrop">
		<button onclick={handleCancel}>close</button>
	</form>
</dialog>