<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import type { EnhancedEvent } from '$lib/stores/events'
	import type { GeneratedPayrollEntry } from '$lib/schemas/rate-card'
	import { DollarSign, Edit, X, CheckCircle } from 'lucide-svelte'
	
	interface Props {
		event: EnhancedEvent
		payrollEntries: GeneratedPayrollEntry[]
		open: boolean
	}
	
	let { event, payrollEntries, open = false }: Props = $props()
	
	const dispatch = createEventDispatcher<{
		confirm: { entries: GeneratedPayrollEntry[] }
		skip: void
		cancel: void
	}>()
	
	// State for the review decision
	let reviewStep = $state<'ask' | 'review'>('ask')
	
	// Editable copies of payroll entries
	let editableEntries = $state<GeneratedPayrollEntry[]>([])
	
	// Initialize editable entries when payrollEntries change
	$effect(() => {
		if (payrollEntries) {
			editableEntries = payrollEntries.map(entry => ({ ...entry }))
		}
	})
	
	// Calculate total for an entry
	function calculateTotal(entry: GeneratedPayrollEntry): number {
		const base = entry.hours * entry.rate
		const additional = entry.additional_pay || 0
		return base + additional
	}
	
	// Update total when hours or rate changes
	function updateEntryTotal(index: number) {
		const entry = editableEntries[index]
		entry.total_pay = calculateTotal(entry)
		editableEntries = [...editableEntries]
	}
	
	function handleYesReview() {
		reviewStep = 'review'
	}
	
	function handleNoReview() {
		dispatch('skip')
	}
	
	function handleCancel() {
		reviewStep = 'ask'
		dispatch('cancel')
	}
	
	function handleConfirm() {
		dispatch('confirm', { entries: editableEntries })
	}
	
	function formatCurrency(value: number): string {
		return `$${value.toFixed(2)}`
	}
</script>

{#if open}
	<div class="modal modal-open">
		<div class="modal-box max-w-5xl">
			{#if reviewStep === 'ask'}
				<!-- Step 1: Ask if user wants to review payroll -->
				<div class="flex items-start gap-4 mb-6">
					<div class="flex-shrink-0">
						<div class="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
							<DollarSign class="w-6 h-6 text-primary" />
						</div>
					</div>
					<div class="flex-1">
						<h3 class="font-bold text-lg mb-2">Complete Event & Generate Payroll</h3>
						<p class="text-base-content/70 mb-4">
							This event will be marked as completed and payroll entries will be automatically generated 
							for {payrollEntries.length} {payrollEntries.length === 1 ? 'artist' : 'artists'}.
						</p>
						<p class="text-base-content/70 font-medium">
							Would you like to review and edit the payroll details before generating?
						</p>
					</div>
				</div>
				
				<!-- Preview Summary -->
				<div class="bg-base-200 rounded-lg p-4 mb-6">
					<h4 class="font-semibold text-sm mb-3">Payroll Preview</h4>
					<div class="space-y-2">
						{#each payrollEntries.slice(0, 3) as entry}
							<div class="flex justify-between text-sm">
								<span>{entry.artist_name || 'Unknown Artist'}</span>
								<span class="font-mono">{formatCurrency(entry.total_pay)}</span>
							</div>
						{/each}
						{#if payrollEntries.length > 3}
							<div class="text-sm opacity-70">
								... and {payrollEntries.length - 3} more
							</div>
						{/if}
						<div class="divider my-2"></div>
						<div class="flex justify-between font-semibold">
							<span>Total</span>
							<span class="font-mono">{formatCurrency(payrollEntries.reduce((sum, e) => sum + e.total_pay, 0))}</span>
						</div>
					</div>
				</div>
				
				<!-- Action Buttons -->
				<div class="modal-action">
					<button class="btn btn-outline" onclick={handleCancel}>
						Cancel
					</button>
					<button class="btn btn-primary" onclick={handleNoReview}>
						<CheckCircle class="w-4 h-4 mr-2" />
						No, Generate Automatically
					</button>
					<button class="btn btn-secondary" onclick={handleYesReview}>
						<Edit class="w-4 h-4 mr-2" />
						Yes, Review Details
					</button>
				</div>
			{:else if reviewStep === 'review'}
				<!-- Step 2: Review and edit payroll entries -->
				<div class="mb-4">
					<h3 class="font-bold text-lg mb-2">Review Payroll Details</h3>
					<p class="text-base-content/70 text-sm">
						Review and edit the payroll entries below. Changes will be applied when you confirm.
					</p>
				</div>
				
				<!-- Editable Payroll Entries Table -->
				<div class="overflow-x-auto max-h-[60vh] overflow-y-auto">
					<table class="table table-sm table-pin-rows">
						<thead>
							<tr>
								<th>Artist</th>
								<th>Hours</th>
								<th>Rate</th>
								<th>Additional Pay</th>
								<th>Total</th>
								<th>Notes</th>
							</tr>
						</thead>
						<tbody>
							{#each editableEntries as entry, index}
								<tr>
									<td class="font-medium">{entry.artist_name || 'Unknown Artist'}</td>
									<td>
										<input
											type="number"
											step="0.5"
											min="0"
											class="input input-sm input-bordered w-20"
											bind:value={entry.hours}
											oninput={() => updateEntryTotal(index)}
										/>
									</td>
									<td>
										<div class="flex items-center gap-1">
											<span class="text-sm">$</span>
											<input
												type="number"
												step="0.01"
												min="0"
												class="input input-sm input-bordered w-24"
												bind:value={entry.rate}
												oninput={() => updateEntryTotal(index)}
											/>
										</div>
									</td>
									<td>
										<div class="flex items-center gap-1">
											<span class="text-sm">$</span>
											<input
												type="number"
												step="0.01"
												min="0"
												class="input input-sm input-bordered w-24"
												bind:value={entry.additional_pay}
												oninput={() => updateEntryTotal(index)}
											/>
										</div>
									</td>
									<td class="font-mono font-semibold">
										{formatCurrency(entry.total_pay)}
									</td>
									<td>
										<input
											type="text"
											class="input input-sm input-bordered w-full"
											bind:value={entry.notes}
											placeholder="Optional notes"
										/>
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr class="font-bold">
								<td colspan="4" class="text-right">Total:</td>
								<td class="font-mono">
									{formatCurrency(editableEntries.reduce((sum, e) => sum + e.total_pay, 0))}
								</td>
								<td></td>
							</tr>
						</tfoot>
					</table>
				</div>
				
				<!-- Action Buttons -->
				<div class="modal-action">
					<button class="btn btn-outline" onclick={handleCancel}>
						Cancel
					</button>
					<button class="btn btn-primary" onclick={handleConfirm}>
						<CheckCircle class="w-4 h-4 mr-2" />
						Confirm & Generate Payroll
					</button>
				</div>
			{/if}
		</div>
		<div class="modal-backdrop" onclick={handleCancel}></div>
	</div>
{/if}
