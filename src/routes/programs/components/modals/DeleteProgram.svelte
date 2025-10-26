<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import Modal from '$lib/components/ui/Modal.svelte'
	import type { Program } from '$lib/schemas/program'
	import { programsStore } from '$lib/stores/programs'

	interface Props {
		open?: boolean
		program?: Program | null
	}

	let { open = false, program = null }: Props = $props()

	const dispatch = createEventDispatcher<{
		close: void
		success: { program: Program }
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

	// Check if confirmation text matches program title
	const isConfirmationValid = $derived(() => {
		if (!program?.title) return false
		return confirmationText.trim().toLowerCase() === program.title.toLowerCase()
	})

	function resetForm() {
		confirmationText = ''
		submitError = null
		isLoading = false
	}

	async function handleDelete(event?: SubmitEvent | MouseEvent) {
		event?.preventDefault()
		if (!program?.id || !isConfirmationValid()) return

		isLoading = true
		submitError = null

		try {
			await programsStore.delete(program.id)
			dispatch('success', { program })
			dispatch('close')
		} catch (error) {
			console.error('Failed to delete program:', error)
			submitError = error instanceof Error ? error.message : 'Failed to delete program. Please try again.'
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
	title="Delete Program"
	size="lg"
	loading={isLoading}
	closeable={!isLoading}
	on:close={handleClose}
>
	{#if program}
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
					<div class="text-xs">Deleting this program will permanently remove all associated data.</div>
				</div>
			</div>

			<!-- Program Information -->
			<div class="bg-base-200 rounded-lg p-4 space-y-3">
				<h3 class="font-semibold text-lg">Program to be deleted:</h3>
				<div class="space-y-2">
					<div class="flex justify-between">
						<span class="font-medium">Title:</span>
						<span class="text-right">{program.title}</span>
					</div>
					{#if program.description}
						<div class="flex justify-between">
							<span class="font-medium">Description:</span>
							<span class="text-right max-w-xs truncate" title={program.description}>
								{program.description}
							</span>
						</div>
					{/if}
					{#if program.geo_coverage}
						<div class="flex justify-between">
							<span class="font-medium">Coverage:</span>
							<span class="text-right">{program.geo_coverage}</span>
						</div>
					{/if}
					{#if program.start_date}
						<div class="flex justify-between">
							<span class="font-medium">Start Date:</span>
							<span class="text-right">{new Date(program.start_date).toLocaleDateString()}</span>
						</div>
					{/if}
					{#if program.end_date}
						<div class="flex justify-between">
							<span class="font-medium">End Date:</span>
							<span class="text-right">{new Date(program.end_date).toLocaleDateString()}</span>
						</div>
					{/if}
					{#if program.partner}
						<div class="flex justify-between">
							<span class="font-medium">Partner ID:</span>
							<span class="text-right">{program.partner}</span>
						</div>
					{/if}
					{#if program.created_at}
						<div class="flex justify-between">
							<span class="font-medium">Created:</span>
							<span class="text-right">{new Date(program.created_at).toLocaleDateString()}</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Confirmation Input -->
			<div class="space-y-4">
				<div class="bg-error/10 border border-error/20 rounded-lg p-4">
					<p class="text-sm mb-3">
						To confirm deletion, please type the program title exactly as shown:
					</p>
					<div class="bg-base-100 p-2 rounded border font-mono text-sm mb-3">
						{program.title}
					</div>
					<div class="form-control">
						<label class="label" for="delete-program-confirmation">
							<span class="label-text font-medium">Type program title to confirm:</span>
						</label>
						<input 
							id="delete-program-confirmation"
							type="text" 
							class="input input-bordered {isConfirmationValid() ? 'input-success' : confirmationText ? 'input-error' : ''}"
							bind:value={confirmationText}
							placeholder="Type the program title here"
							autocomplete="off"
							spellcheck="false"
						/>
						{#if confirmationText && !isConfirmationValid()}
							<label class="label">
								<span class="label-text-alt text-error">Program title does not match</span>
							</label>
						{:else if isConfirmationValid()}
							<label class="label">
								<span class="label-text-alt text-success">✓ Confirmation text matches</span>
							</label>
						{/if}
					</div>
				</div>
			</div>

			<!-- Additional Warnings -->
			<div class="text-sm opacity-75 space-y-1">
				<p>• This will permanently delete the program record</p>
				<p>• Any associated data or relationships will be affected</p>
				<p>• This action cannot be reversed</p>
			</div>
		</div>
	{:else}
		<div class="text-center py-8">
			<p class="text-lg">No program selected</p>
			<p class="text-sm opacity-60">Please select a program to delete</p>
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
			disabled={isLoading || !isConfirmationValid() || !program}
		>
			{#if isLoading}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
				</svg>
			{/if}
			Delete Program
		</button>
	</svelte:fragment>
</Modal>