<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import Modal from '$lib/components/ui/Modal.svelte'
	import { locationTypesStore } from '$lib/stores/locationTypes'
	import { supabase } from '$lib/supabase'
	import type { LocationType } from '$lib/schemas/locationType'

	interface Props {
		open?: boolean
		locationType?: LocationType | null
	}

	let { open = false, locationType = null }: Props = $props()

	const dispatch = createEventDispatcher<{
		close: void
		success: { locationType: LocationType }
	}>()

	let isLoading = $state(false)
	let submitError = $state<string | null>(null)
	let usageCount = $state<number | null>(null)
	let checkingUsage = $state(false)

	// Check usage when modal opens
	$effect(() => {
		if (open && locationType?.id) {
			checkUsage()
		} else {
			usageCount = null
			submitError = null
		}
	})

	async function checkUsage() {
		if (!locationType?.id) return
		checkingUsage = true
		try {
			const { count, error } = await supabase
				.from('phwb_locations')
				.select('*', { count: 'exact', head: true })
				.eq('location_type_id', locationType.id)

			if (error) throw error
			usageCount = count || 0
		} catch (error) {
			console.error('Failed to check usage:', error)
			usageCount = null
		} finally {
			checkingUsage = false
		}
	}

	async function handleDelete(event?: SubmitEvent | MouseEvent) {
		event?.preventDefault()
		if (!locationType?.id) return

		// Prevent deletion if in use
		if (usageCount !== null && usageCount > 0) {
			submitError = `Cannot delete: This type is currently used by ${usageCount} location(s). Please reassign or remove those locations first.`
			return
		}

		isLoading = true
		submitError = null

		try {
			await locationTypesStore.delete(locationType.id)
			dispatch('success', { locationType })
			dispatch('close')
		} catch (error) {
			console.error('Failed to delete location type:', error)
			submitError = error instanceof Error ? error.message : 'Failed to delete location type. Please try again.'
		} finally {
			isLoading = false
		}
	}

	function handleClose() {
		if (!isLoading) {
			submitError = null
			usageCount = null
			dispatch('close')
		}
	}
</script>

<Modal 
	{open}
	title="Delete Location Type"
	size="lg"
	loading={isLoading}
	closeable={!isLoading}
	on:close={handleClose}
>
	{#if locationType}
		<div class="space-y-6">
			{#if submitError}
				<div class="alert alert-error">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>{submitError}</span>
				</div>
			{/if}

			{#if checkingUsage}
				<div class="flex justify-center py-4">
					<span class="loading loading-spinner"></span>
					<span class="ml-2">Checking usage...</span>
				</div>
			{:else if usageCount !== null && usageCount > 0}
				<div class="alert alert-warning">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
					</svg>
					<div>
						<h3 class="font-bold">Cannot Delete</h3>
						<div class="text-sm">This location type is currently used by <strong>{usageCount}</strong> location(s). Please reassign or remove those locations before deleting this type.</div>
					</div>
				</div>
			{:else}
				<div class="alert alert-warning">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
					</svg>
					<div>
						<h3 class="font-bold">Warning: This action cannot be undone!</h3>
						<div class="text-xs">Deleting this location type will permanently remove it from the system.</div>
					</div>
				</div>
			{/if}

			<div class="bg-base-200 rounded-lg p-4 space-y-3">
				<h3 class="font-semibold text-lg">Location Type to be deleted:</h3>
				<div class="space-y-2">
					<div class="flex justify-between">
						<span class="font-medium">Name:</span>
						<span class="text-right">{locationType.name}</span>
					</div>
					{#if locationType.description}
						<div class="flex justify-between">
							<span class="font-medium">Description:</span>
							<span class="text-right max-w-xs truncate" title={locationType.description}>
								{locationType.description}
							</span>
						</div>
					{/if}
					<div class="flex justify-between">
						<span class="font-medium">Status:</span>
						<span class="text-right">
							{#if locationType.active}
								<span class="badge badge-success badge-sm">Active</span>
							{:else}
								<span class="badge badge-error badge-sm">Inactive</span>
							{/if}
						</span>
					</div>
					{#if usageCount !== null}
						<div class="flex justify-between">
							<span class="font-medium">Usage:</span>
							<span class="text-right">{usageCount} location(s)</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<div class="text-center py-8">
			<p class="text-lg">No location type selected</p>
			<p class="text-sm opacity-60">Please select a location type to delete</p>
		</div>
	{/if}

	<svelte:fragment slot="actions" let:closeModal>
		<button 
			type="button" 
			class="btn btn-ghost" 
			onclick={closeModal}
			disabled={isLoading}
		>
			Cancel
		</button>
		<button 
			type="button"
			class="btn btn-error"
			onclick={handleDelete}
			disabled={isLoading || !locationType || (usageCount !== null && usageCount > 0)}
		>
			{#if isLoading}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
				</svg>
			{/if}
			Delete Location Type
		</button>
	</svelte:fragment>
</Modal>
