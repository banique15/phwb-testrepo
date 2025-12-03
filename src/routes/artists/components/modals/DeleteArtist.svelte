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
	let error = $state('')

	// Watch for open prop changes to control modal
	$effect(() => {
		if (modalElement) {
			if (open) {
				modalElement.showModal()
				// Reset state when opening
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

	async function handleDelete() {
		if (!artist) return

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
</script>

<dialog
	bind:this={modalElement}
	class="modal"
	onclick={handleBackdropClick}
>
	<div class="modal-box w-11/12 max-w-md">
		<div class="flex items-center justify-between mb-4">
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
				<!-- Artist Details -->
				<p class="text-sm">
					Are you sure you want to delete <strong>{artistDisplayName}</strong>?
					{#if artist.artist_name && artist.artist_name !== artistDisplayName}
						<span class="opacity-70">({artist.artist_name})</span>
					{/if}
				</p>

				<!-- Warning -->
				<div class="alert alert-warning text-sm py-2">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.99-.833-2.598 0L3.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
					</svg>
					<span>This action cannot be undone.</span>
				</div>

				{#if error}
					<div class="alert alert-error text-sm py-2">
						<span>{error}</span>
					</div>
				{/if}

				<!-- Actions -->
				<div class="flex justify-end gap-2 pt-2">
					<button
						class="btn btn-outline btn-sm"
						onclick={handleCancel}
						disabled={loading}
					>
						Cancel
					</button>
					<button
						class="btn btn-error btn-sm"
						onclick={handleDelete}
						disabled={loading}
					>
						{#if loading}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						Delete
					</button>
				</div>
			</div>
		{:else}
			<div class="text-center py-4">
				<p class="text-sm opacity-60">No artist selected</p>
			</div>
		{/if}
	</div>

	<!-- Backdrop (for accessibility) -->
	<form method="dialog" class="modal-backdrop">
		<button onclick={handleCancel}>close</button>
	</form>
</dialog>
