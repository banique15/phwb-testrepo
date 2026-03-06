<script lang="ts">
	import { createEventDispatcher } from 'svelte'

	interface Props {
		open?: boolean
		totalCount?: number
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
		if (selectedCount === 0 && exportScope === 'selected') {
			exportScope = 'all'
		}
		errorMessage = null
	})

	function handleConfirm() {
		if (exportScope === 'selected' && selectedCount === 0) {
			errorMessage = 'No artists are selected. Choose "All filtered artists" or select artists from the list first.'
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
				<h3 class="font-bold text-lg">Export Artists</h3>
				<button class="btn btn-sm btn-circle btn-ghost" onclick={handleClose} aria-label="Close">✕</button>
			</div>

			<div class="space-y-4">
				<p class="text-sm text-base-content/70">
					Choose whether to export <span class="font-semibold">all artists matching the current filters</span> or
					only <span class="font-semibold">selected artists</span>. The export will be a CSV file that you can
					open in a spreadsheet or re-import via the artists import page.
				</p>

				<div class="bg-base-200 rounded-lg p-3 text-sm flex items-center justify-between">
					<div>
						<p class="font-medium">
							{#if totalCount > 0}
								{totalCount} artist{totalCount === 1 ? '' : 's'} match current filters
							{:else}
								No artists match current filters
							{/if}
						</p>
						<p class="text-base-content/60">
							{#if selectedCount > 0}
								{selectedCount} artist{selectedCount === 1 ? ' is' : 's are'} currently selected in the list.
							{:else}
								No artists are currently selected. Use the checkboxes in the list to select artists.
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
								name="artist-export-scope"
								class="radio radio-primary"
								value="all"
								checked={exportScope === 'all'}
								onchange={() => (exportScope = 'all')}
							/>
							<span class="label-text text-sm">
								All filtered artists
								{#if totalCount > 0}
									<span class="opacity-60">({totalCount})</span>
								{/if}
							</span>
						</label>

						<label class="label cursor-pointer justify-start gap-3">
							<input
								type="radio"
								name="artist-export-scope"
								class="radio radio-primary"
								value="selected"
								checked={exportScope === 'selected'}
								onchange={() => (exportScope = 'selected')}
							/>
							<span class="label-text text-sm">
								Selected artists only
								<span class="opacity-60">
									({selectedCount} selected)
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
						Exports as <span class="font-semibold">CSV (Comma-Separated Values)</span> using the same columns
						as the artist import template. You can re-import this file on the Artists import page.
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
		<form method="dialog" class="modal-backdrop">
			<button type="button" onclick={handleClose}>close</button>
		</form>
	</div>
{/if}
