<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import type { EnhancedEvent } from '$lib/stores/events'

	interface Props {
		selectedCount: number
		selectedEvents: EnhancedEvent[]
		onClearSelection: () => void
	}

	let {
		selectedCount = 0,
		selectedEvents = [],
		onClearSelection
	}: Props = $props()

	const dispatch = createEventDispatcher<{
		bulkAction: {
			action: string
			eventIds: number[]
			newStatus?: string
		}
	}>()

	const statusOptions = [
		{ value: 'planned', label: 'Planned' },
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' }
	]

	let isProcessing = $state(false)

	function handleStatusChange(newStatus: string) {
		if (selectedEvents.length === 0) return

		const confirmMessage = `Change status of ${selectedCount} event${selectedCount === 1 ? '' : 's'} to "${newStatus}"?`

		if (confirm(confirmMessage)) {
			isProcessing = true
			dispatch('bulkAction', {
				action: 'changeStatus',
				eventIds: selectedEvents.map(e => e.id!),
				newStatus
			})
			isProcessing = false
		}
	}

	function handleDelete() {
		if (selectedEvents.length === 0) return

		const confirmMessage = `Delete ${selectedCount} event${selectedCount === 1 ? '' : 's'}? This action cannot be undone.`

		if (confirm(confirmMessage)) {
			isProcessing = true
			dispatch('bulkAction', {
				action: 'delete',
				eventIds: selectedEvents.map(e => e.id!)
			})
			isProcessing = false
		}
	}
</script>

{#if selectedCount > 0}
	<div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
		<div class="card bg-base-100 shadow-lg border border-primary/30">
			<div class="card-body p-3 flex-row items-center gap-4">
				<!-- Selected count -->
				<div class="flex items-center gap-2">
					<div class="badge badge-primary badge-lg">{selectedCount}</div>
					<span class="text-sm font-medium">
						event{selectedCount === 1 ? '' : 's'} selected
					</span>
				</div>

				<div class="divider divider-horizontal m-0"></div>

				<!-- Status change dropdown -->
				<div class="dropdown dropdown-top">
					<div tabindex="0" role="button" class="btn btn-sm btn-outline" class:btn-disabled={isProcessing}>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						Change Status
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
						</svg>
					</div>
					<ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-48 z-50 mb-2">
						{#each statusOptions as option}
							<li>
								<button onclick={() => handleStatusChange(option.value)} class="text-sm">
									{option.label}
								</button>
							</li>
						{/each}
					</ul>
				</div>

				<!-- Delete button -->
				<button
					class="btn btn-sm btn-error btn-outline"
					onclick={handleDelete}
					disabled={isProcessing}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
					</svg>
					Delete
				</button>

				<div class="divider divider-horizontal m-0"></div>

				<!-- Clear selection -->
				<button
					class="btn btn-sm btn-ghost"
					onclick={onClearSelection}
					disabled={isProcessing}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>
	</div>
{/if}
