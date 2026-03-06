<script lang="ts">
	import { createEventDispatcher } from 'svelte'

	interface Props {
		open?: boolean
		// Number of entries matching current filters (all pages)
		totalCount?: number
		// Number of currently selected entries in the table
		selectedCount?: number
	}

	let { open = false, totalCount = 0, selectedCount = 0 }: Props = $props()

	const dispatch = createEventDispatcher<{
		confirm: { scope: 'all' | 'selected' }
		close: void
	}>()

	let exportScope = $state<'all' | 'selected'>(selectedCount > 0 ? 'selected' : 'all')
	let errorMessage = $state<string | null>(null)

	$effect(() => {
		// When counts change (e.g. different selection), reset scope and error
		if (selectedCount === 0 && exportScope === 'selected') {
			exportScope = 'all'
		}
		errorMessage = null
	})

	function handleConfirm() {
		if (exportScope === 'selected' && selectedCount === 0) {
			errorMessage = 'No entries are selected. Choose \"All filtered entries\" or select rows first.'
			return
		}

		dispatch('confirm', { scope: exportScope })
	}

	function handleClose() {
		errorMessage = null
		dispatch('close')
	}
</script>

{#if open}
	<div class="modal modal-open">
		<div class="modal-box max-w-xl">
			<div class="flex items-center justify-between mb-4">
				<h3 class="font-bold text-lg">Export Payroll Entries</h3>
				<button class="btn btn-sm btn-circle btn-ghost" onclick={handleClose}>✕</button>
			</div>

			<div class="space-y-4">
				<p class="text-sm text-base-content/70">
					Choose whether to export <span class="font-semibold">all entries matching the current filters</span> or
					only the <span class="font-semibold">selected entries</span>. The export will be a CSV file that can be
					used as a starting point for the payroll import workflow.
				</p>

				<div class="bg-base-200 rounded-lg p-3 text-sm flex items-center justify-between">
					<div>
						<p class="font-medium">
							{#if totalCount > 0}
								{totalCount} entries match current filters
							{:else}
								No entries match current filters
							{/if}
						</p>
						<p class="text-base-content/60">
							{#if selectedCount > 0}
								{selectedCount} entr{selectedCount === 1 ? 'y is' : 'ies are'} currently selected in the table.
							{:else}
								No entries are currently selected in the table.
							{/if}
						</p>
					</div>
				</div>

				<div class="space-y-2">
					<h4 class="font-semibold text-sm">Export scope</h4>
					<div class="space-y-1">
						<label class="label cursor-pointer justify-start gap-3">
							<input
								type="radio"
								name="export-scope"
								class="radio radio-primary"
								value="all"
								checked={exportScope === 'all'}
								onchange={() => (exportScope = 'all')}
							/>
							<span class="label-text text-sm">
								All filtered entries
								{#if totalCount > 0}
									<span class="opacity-60">({totalCount} rows)</span>
								{/if}
							</span>
						</label>

						<label class="label cursor-pointer justify-start gap-3">
							<input
								type="radio"
								name="export-scope"
								class="radio radio-primary"
								value="selected"
								checked={exportScope === 'selected'}
								onchange={() => (exportScope = 'selected')}
							/>
							<span class="label-text text-sm">
								Selected entries only
								<span class="opacity-60">
									({selectedCount} row{selectedCount === 1 ? '' : 's'} selected)
								</span>
							</span>
						</label>
					</div>
				</div>

				{#if errorMessage}
					<div class="alert alert-warning py-2 text-sm">
						<span>{errorMessage}</span>
					</div>
				{/if}

				<div class="bg-base-200 rounded-lg p-3 text-xs text-base-content/70">
					<p class="font-semibold mb-1">Format</p>
					<p>
						Exports as <span class="font-semibold">CSV (Comma-Separated Values)</span> using the same column
						layout as the payroll import template. You can open this file in spreadsheet tools or re-import it
						through the payroll import wizard.
					</p>
				</div>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={handleClose}>Cancel</button>
				<button
					class="btn btn-primary"
					onclick={handleConfirm}
					disabled={totalCount === 0 && selectedCount === 0}
				>
					Export CSV
				</button>
			</div>
		</div>
	</div>
{/if}

