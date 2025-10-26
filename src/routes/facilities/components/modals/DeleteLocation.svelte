<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import Modal from '$lib/components/ui/Modal.svelte'
	import type { Location } from '$lib/schemas/location'
	import { locationsStore } from '$lib/stores/locations'

	interface Props {
		open?: boolean
		location?: Location | null
	}

	let { open = false, location }: Props = $props()

	const dispatch = createEventDispatcher<{
		close: void
		success: void
	}>()

	let isLoading = $state(false)
	let deleteError = $state<string | null>(null)

	async function handleDelete() {
		if (!location?.id) return

		isLoading = true
		deleteError = null

		try {
			await locationsStore.delete(location.id)
			dispatch('success')
		} catch (error: any) {
			deleteError = error.message || 'Failed to delete location'
			console.error('Error deleting location:', error)
		} finally {
			isLoading = false
		}
	}

	function handleClose() {
		if (!isLoading) {
			deleteError = null
			dispatch('close')
		}
	}
</script>

<Modal {open} title="Delete Location" size="md" on:close={handleClose}>
	{#if location}
		<div class="space-y-4">
			{#if deleteError}
				<div class="alert alert-error">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>{deleteError}</span>
				</div>
			{/if}

			<div class="alert alert-warning">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
				<div>
					<h3 class="font-bold">Warning: This action cannot be undone</h3>
					<div class="text-sm">
						Are you sure you want to delete the location <strong>{location.name}</strong>?
					</div>
				</div>
			</div>

			<div class="bg-base-200 p-4 rounded-lg">
				<div class="space-y-2">
					<div>
						<span class="text-sm font-medium opacity-70">Location:</span>
						<p class="text-base">{location.name}</p>
					</div>
					{#if location.floor}
						<div>
							<span class="text-sm font-medium opacity-70">Floor:</span>
							<p class="text-base">{location.floor}</p>
						</div>
					{/if}
					{#if location.description}
						<div>
							<span class="text-sm font-medium opacity-70">Description:</span>
							<p class="text-base">{location.description}</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Actions -->
			<div class="modal-action">
				<button type="button" class="btn" onclick={handleClose} disabled={isLoading}>
					Cancel
				</button>
				<button type="button" class="btn btn-error" onclick={handleDelete} disabled={isLoading}>
					{#if isLoading}
						<span class="loading loading-spinner"></span>
						Deleting...
					{:else}
						Delete Location
					{/if}
				</button>
			</div>
		</div>
	{/if}
</Modal>
