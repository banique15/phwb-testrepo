<script lang="ts">
	import EventForm from '../components/EventForm.svelte'
	import type { Event } from '$lib/schemas/event'
	
	interface Props {
		open?: boolean
		event?: Event | null
		onClose?: () => void
		onSuccess?: () => void
	}
	
	let { open = false, event = null, onClose, onSuccess }: Props = $props()
	
	let modalElement: HTMLDialogElement
	
	// Watch for open prop changes to control modal
	$effect(() => {
		if (modalElement) {
			if (open) {
				modalElement.showModal()
			} else {
				modalElement.close()
			}
		}
	})
	
	function handleSuccess() {
		onSuccess?.()
		onClose?.()
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
	<div class="modal-box w-11/12 max-w-4xl">
		<div class="flex items-center justify-between mb-6">
			<h3 class="font-bold text-lg">
				Edit Event: {event?.title || 'Unnamed Event'}
			</h3>
			<button
				class="btn btn-sm btn-circle btn-ghost"
				onclick={handleCancel}
			>
				✕
			</button>
		</div>
		
		{#if event}
			<EventForm
				{event}
				isEdit={true}
				onSuccess={handleSuccess}
				onCancel={handleCancel}
			/>
		{:else}
			<div class="text-center py-8">
				<p class="text-lg">No event selected</p>
				<p class="text-sm opacity-60">Please select an event to edit</p>
			</div>
		{/if}
	</div>
	
	<!-- Backdrop (for accessibility) -->
	<form method="dialog" class="modal-backdrop">
		<button onclick={handleCancel}>close</button>
	</form>
</dialog>