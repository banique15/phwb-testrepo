<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import Modal from '$lib/components/ui/Modal.svelte'
	import type { Venue } from '$lib/schemas/venue'
	import { venuesStore } from '$lib/stores/venues'

	interface Props {
		open?: boolean
		venue?: Venue | null
	}

	let { open = false, venue = null }: Props = $props()

	const dispatch = createEventDispatcher<{
		close: void
		success: { venue: Venue }
	}>()

	// Form state
	let confirmationText = $state('')
	let isLoading = $state(false)
	let submitError = $state<string | null>(null)

	// Reset form when modal opens/closes
	$effect(() => {
		if (open) {
			confirmationText = ''
			submitError = null
		}
	})

	// Check if confirmation text matches venue name
	const isConfirmationValid = $derived.by(() => {
		if (!venue?.name) return false
		return confirmationText.trim().toLowerCase() === venue.name.toLowerCase()
	})

	function resetForm() {
		confirmationText = ''
		submitError = null
		isLoading = false
	}

	async function handleDelete(event?: SubmitEvent | MouseEvent) {
		event?.preventDefault()
		if (!venue?.id || !isConfirmationValid) return

		isLoading = true
		submitError = null

		try {
			await venuesStore.delete(venue.id)
			dispatch('success', { venue })
			dispatch('close')
		} catch (error) {
			console.error('Failed to delete venue:', error)
			submitError = error instanceof Error ? error.message : 'Failed to delete venue. Please try again.'
		} finally {
			isLoading = false
		}
	}

	function handleClose() {
		if (!isLoading) {
			resetForm()
			dispatch('close')
		}
	}
</script>

<Modal 
	{open}
	title="Delete Venue"
	size="lg"
	loading={isLoading}
	closeable={!isLoading}
	on:close={handleClose}
>
	{#if venue}
		<div class="space-y-6">
			{#if submitError}
				<div class="alert alert-error">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>{submitError}</span>
				</div>
			{/if}

			<!-- Warning Message -->
			<div class="alert alert-warning">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
				</svg>
				<div>
					<h3 class="font-bold">Warning: This action cannot be undone!</h3>
					<div class="text-xs">Deleting this venue will permanently remove all associated data.</div>
				</div>
			</div>

			<!-- Venue Information -->
			<div class="bg-base-200 rounded-lg p-4 space-y-3">
				<h3 class="font-semibold text-lg">Venue to be deleted:</h3>
				<div class="space-y-2">
					<div class="flex justify-between">
						<span class="font-medium">Name:</span>
						<span class="text-right">{venue.name}</span>
					</div>
					{#if venue.type}
						<div class="flex justify-between">
							<span class="font-medium">Type:</span>
							<span class="text-right">{venue.type}</span>
						</div>
					{/if}
					{#if venue.address}
						<div class="flex justify-between">
							<span class="font-medium">Address:</span>
							<span class="text-right max-w-xs truncate" title={venue.address}>
								{venue.address}
							</span>
						</div>
					{/if}
					{#if venue.reference}
						<div class="flex justify-between">
							<span class="font-medium">Reference:</span>
							<span class="text-right">{venue.reference}</span>
						</div>
					{/if}
					{#if venue.description}
						<div class="flex justify-between">
							<span class="font-medium">Description:</span>
							<span class="text-right max-w-xs truncate" title={venue.description}>
								{venue.description}
							</span>
						</div>
					{/if}
					{#if venue.contacts && typeof venue.contacts === 'object' && Object.keys(venue.contacts).length > 0}
						<div class="flex justify-between">
							<span class="font-medium">Contacts:</span>
							<span class="text-right">{Object.keys(venue.contacts).length} contact(s)</span>
						</div>
					{/if}
					{#if venue.parking && typeof venue.parking === 'object' && Object.keys(venue.parking).length > 0}
						<div class="flex justify-between">
							<span class="font-medium">Parking Info:</span>
							<span class="text-right">{Object.keys(venue.parking).length} parking option(s)</span>
						</div>
					{/if}
					{#if venue.created_at}
						<div class="flex justify-between">
							<span class="font-medium">Created:</span>
							<span class="text-right">{new Date(venue.created_at).toLocaleDateString()}</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Confirmation Input -->
			<div class="space-y-4">
				<div class="bg-error/10 border border-error/20 rounded-lg p-4">
					<p class="text-sm mb-3">
						To confirm deletion, please type the venue name exactly as shown:
					</p>
					<div class="bg-base-100 p-2 rounded border font-mono text-sm mb-3">
						{venue.name}
					</div>
					<div class="form-control">
						<label class="label" for="delete-venue-confirmation">
							<span class="label-text font-medium">Type venue name to confirm:</span>
						</label>
						<input 
							id="delete-venue-confirmation"
							type="text" 
							class="input input-bordered {isConfirmationValid ? 'input-success' : confirmationText ? 'input-error' : ''}"
							bind:value={confirmationText}
							placeholder="Type the venue name here"
							autocomplete="off"
							spellcheck="false"
						/>
						{#if confirmationText && !isConfirmationValid}
							<label class="label">
								<span class="label-text-alt text-error">Venue name does not match</span>
							</label>
						{:else if isConfirmationValid}
							<label class="label">
								<span class="label-text-alt text-success">✓ Confirmation text matches</span>
							</label>
						{/if}
					</div>
				</div>
			</div>

			<!-- Additional Warnings -->
			<div class="text-sm opacity-75 space-y-1">
				<p>• This will permanently delete the venue record</p>
				<p>• Any events or bookings associated with this venue may be affected</p>
				<p>• Contact information and parking details will be lost</p>
				<p>• This action cannot be reversed</p>
			</div>
		</div>
	{:else}
		<div class="text-center py-8">
			<p class="text-lg">No venue selected</p>
			<p class="text-sm opacity-60">Please select a venue to delete</p>
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
			disabled={isLoading || !isConfirmationValid || !venue}
		>
			{#if isLoading}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
				</svg>
			{/if}
			Delete Venue
		</button>
	</svelte:fragment>
</Modal>