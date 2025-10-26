<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { onMount } from 'svelte'

	interface Props {
		open?: boolean
		title?: string
		size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
		closeable?: boolean
		showCloseButton?: boolean
		closeOnBackdrop?: boolean
		closeOnEscape?: boolean
		persistent?: boolean
		loading?: boolean
	}

	let {
		open = false,
		title,
		size = 'md',
		closeable = true,
		showCloseButton = true,
		closeOnBackdrop = true,
		closeOnEscape = true,
		persistent = false,
		loading = false
	}: Props = $props()

	const dispatch = createEventDispatcher<{
		close: void
		open: void
		confirm: void
		cancel: void
	}>()

	let dialogElement: HTMLDialogElement
	let isOpen = $state(open)

	// Watch for open prop changes
	$effect(() => {
		if (open !== isOpen) {
			isOpen = open
			if (isOpen) {
				showModal()
			} else {
				closeModal()
			}
		}
	})

	function showModal() {
		if (dialogElement && !dialogElement.open) {
			dialogElement.showModal()
			dispatch('open')
		}
	}

	function closeModal() {
		if (!closeable && !persistent) return
		
		if (dialogElement && dialogElement.open) {
			dialogElement.close()
			isOpen = false
			dispatch('close')
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (!closeOnBackdrop || !closeable) return
		
		const rect = dialogElement.getBoundingClientRect()
		const isInDialog = (
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom
		)
		
		if (!isInDialog) {
			closeModal()
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && closeOnEscape && closeable) {
			event.preventDefault()
			closeModal()
		}
	}

	function handleConfirm() {
		dispatch('confirm')
	}

	function handleCancel() {
		dispatch('cancel')
		closeModal()
	}

	const sizeClasses = {
		sm: 'modal-box w-11/12 max-w-md',
		md: 'modal-box w-11/12 max-w-2xl',
		lg: 'modal-box w-11/12 max-w-4xl',
		xl: 'modal-box w-11/12 max-w-6xl',
		full: 'modal-box w-11/12 max-w-7xl h-full max-h-[90vh]'
	}

	onMount(() => {
		if (isOpen) {
			showModal()
		}
	})
</script>

<svelte:window onkeydown={handleKeydown} />

<dialog 
	bind:this={dialogElement}
	class="modal modal-bottom sm:modal-middle"
	onclick={handleBackdropClick}
>
	<div class="{sizeClasses[size]} relative">
		{#if loading}
			<div class="absolute inset-0 bg-base-100/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{/if}

		{#if title}
			<div class="modal-header border-b border-base-300 pb-4 mb-4">
				<h3 class="font-bold text-lg flex items-center justify-between">
					{title}
					{#if showCloseButton && closeable}
						<button 
							class="btn btn-sm btn-circle btn-ghost"
							onclick={closeModal}
							disabled={!closeable}
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					{/if}
				</h3>
			</div>
		{:else if showCloseButton && closeable}
			<div class="absolute right-4 top-4 z-10">
				<button 
					class="btn btn-sm btn-circle btn-ghost"
					onclick={closeModal}
					disabled={!closeable}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		{/if}

		<div class="modal-body">
			<slot />
		</div>

		{#if $$slots.actions}
			<div class="modal-action border-t border-base-300 pt-4 mt-4">
				<slot name="actions" {handleConfirm} {handleCancel} {closeModal} />
			</div>
		{/if}
	</div>
</dialog>

<style>
	.modal-box {
		scrollbar-width: thin;
		scrollbar-color: hsl(var(--bc) / 0.2) transparent;
	}

	.modal-box::-webkit-scrollbar {
		width: 6px;
	}

	.modal-box::-webkit-scrollbar-track {
		background: transparent;
	}

	.modal-box::-webkit-scrollbar-thumb {
		background-color: hsl(var(--bc) / 0.2);
		border-radius: 3px;
	}

	.modal-box::-webkit-scrollbar-thumb:hover {
		background-color: hsl(var(--bc) / 0.3);
	}
</style>