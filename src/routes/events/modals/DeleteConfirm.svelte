<script lang="ts">
	import { eventsStore } from '$lib/stores/events'
	import type { Event } from '$lib/schemas/event'
	
	interface Props {
		open?: boolean
		event?: Event | null
		onClose?: () => void
		onSuccess?: () => void
	}
	
	let { open = false, event = null, onClose, onSuccess }: Props = $props()
	
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
	
	// Check if confirmation text matches event title
	let canDelete = $derived(
		event && confirmText.toLowerCase() === event.title?.toLowerCase()
	)
	
	async function handleDelete() {
		if (!event || !canDelete) return
		
		loading = true
		error = ''
		
		try {
			await eventsStore.delete(event.id!)
			onSuccess?.()
			onClose?.()
		} catch (err: any) {
			error = err.message || 'Failed to delete event'
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
		// Append 'T00:00:00' to treat date as local time, not UTC
		const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
		return date.toLocaleDateString()
	}
</script>

<dialog
	bind:this={modalElement}
	class="modal"
	onclick={handleBackdropClick}
>
	<div class="modal-box w-11/12 max-w-lg">
		<div class="flex items-center justify-between mb-6">
			<h3 class="font-bold text-lg text-error">Delete Event</h3>
			<button
				class="btn btn-sm btn-circle btn-ghost"
				onclick={handleCancel}
				disabled={loading}
			>
				✕
			</button>
		</div>
		
		{#if event}
			<div class="space-y-4">
				<!-- Warning -->
				<div class="alert alert-warning">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.99-.833-2.598 0L3.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
					</svg>
					<span>This action cannot be undone!</span>
				</div>
				
				<!-- Event Details -->
				<div class="bg-base-200 p-4 rounded-lg">
					<h4 class="font-semibold mb-2">Event to be deleted:</h4>
					<div class="space-y-1 text-sm">
						<p><span class="font-medium">Title:</span> {event.title || 'Unnamed Event'}</p>
						<p><span class="font-medium">Date:</span> {formatDate(event.date)}</p>
						<p><span class="font-medium">Status:</span> {event.status || 'Unknown'}</p>
						{#if event.venue}
							<p><span class="font-medium">Venue ID:</span> {event.venue}</p>
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
					<label class="label">
						<span class="label-text">
							Type <strong>"{event.title}"</strong> to confirm deletion:
						</span>
					</label>
					<input
						type="text"
						bind:value={confirmText}
						class="input input-bordered"
						placeholder="Enter event title exactly"
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
						Delete Event
					</button>
				</div>
			</div>
		{:else}
			<div class="text-center py-8">
				<p class="text-lg">No event selected</p>
				<p class="text-sm opacity-60">Please select an event to delete</p>
			</div>
		{/if}
	</div>
	
	<!-- Backdrop (for accessibility) -->
	<form method="dialog" class="modal-backdrop">
		<button onclick={handleCancel}>close</button>
	</form>
</dialog>