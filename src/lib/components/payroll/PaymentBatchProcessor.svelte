<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { payrollStore } from '$lib/stores/payroll'
	import { user } from '$lib/auth'
	import type { Payroll } from '$lib/schemas/payroll'
	import { PaymentStatus, PaymentMethod } from '$lib/schemas/payroll'
	import { BatchStatus } from '$lib/schemas/payment-batch'

	export let isOpen: boolean = false
	export let payments: Payroll[] = []

	const dispatch = createEventDispatcher<{
		processed: { batchId: string, payments: Payroll[] }
		close: void
	}>()

	let batchName = ''
	let description = ''
	let paymentMethod: string = PaymentMethod.CHECK
	let externalReference = ''
	let isLoading = false

	$: totalAmount = payments.reduce((sum, payment) => sum + (payment.total_pay || 0), 0)
	$: approvedPayments = payments.filter(p => p.status === PaymentStatus.APPROVED)
	$: canProcess = approvedPayments.length > 0 && batchName.trim().length > 0 && $user

	function generateBatchName() {
		const today = new Date().toISOString().split('T')[0]
		const count = approvedPayments.length
		batchName = `Payment Batch ${today} (${count} payments)`
	}

	async function handleProcess() {
		if (!$user || !canProcess) return

		isLoading = true
		try {
			const batchData = {
				batch_name: batchName,
				created_by: $user.id,
				status: BatchStatus.SUBMITTED,
				payment_method: paymentMethod as any,
				description,
				external_reference: externalReference || undefined
			}

			const result = await payrollStore.processBatch(
				approvedPayments.map(p => p.id!), 
				batchData
			)

			dispatch('processed', { 
				batchId: result.batch, 
				payments: result.payments 
			})
			handleClose()
		} catch (error) {
			console.error('Failed to process payment batch:', error)
		} finally {
			isLoading = false
		}
	}

	function handleClose() {
		batchName = ''
		description = ''
		externalReference = ''
		dispatch('close')
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount)
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString()
	}

	// Auto-generate batch name when modal opens
	$: if (isOpen && !batchName && approvedPayments.length > 0) {
		generateBatchName()
	}
</script>

{#if isOpen}
	<div class="modal modal-open">
		<div class="modal-box w-11/12 max-w-5xl">
			<div class="flex items-center justify-between mb-6">
				<h3 class="font-bold text-lg">Process Payment Batch</h3>
				<button class="btn btn-sm btn-circle btn-ghost" on:click={handleClose}>✕</button>
			</div>

			{#if approvedPayments.length === 0}
				<div class="alert alert-warning mb-6">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z" />
					</svg>
					<span>No approved payments available for processing. Payments must be approved before they can be processed.</span>
				</div>
			{:else}
				<!-- Batch Summary -->
				<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">Total Payments</div>
						<div class="stat-value text-2xl">{approvedPayments.length}</div>
						<div class="stat-desc">of {payments.length} selected</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">Total Amount</div>
						<div class="stat-value text-2xl text-success">{formatCurrency(totalAmount)}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">Payment Method</div>
						<div class="stat-value text-lg capitalize">{paymentMethod.replace('_', ' ')}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">Status</div>
						<div class="stat-value text-lg">
							<span class="badge badge-info">Ready to Process</span>
						</div>
					</div>
				</div>

				<!-- Batch Configuration -->
				<div class="card bg-base-100 border border-base-300 mb-6">
					<div class="card-body">
						<h4 class="card-title text-lg mb-4">Batch Configuration</h4>
						
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div class="form-control">
								<label class="label" for="batch-name">
									<span class="label-text">Batch Name <span class="text-error">*</span></span>
								</label>
								<input
									id="batch-name"
									type="text"
									class="input input-bordered"
									placeholder="Enter batch name..."
									bind:value={batchName}
									required
								/>
								<label class="label">
									<span class="label-text-alt">
										<button 
											type="button" 
											class="link link-primary text-xs"
											on:click={generateBatchName}
										>
											Generate automatic name
										</button>
									</span>
								</label>
							</div>

							<div class="form-control">
								<label class="label" for="payment-method">
									<span class="label-text">Payment Method <span class="text-error">*</span></span>
								</label>
								<select
									id="payment-method"
									class="select select-bordered"
									bind:value={paymentMethod}
									required
								>
									<option value={PaymentMethod.CHECK}>Check</option>
									<option value={PaymentMethod.ACH}>ACH Transfer</option>
									<option value={PaymentMethod.WIRE}>Wire Transfer</option>
									<option value={PaymentMethod.PAYROLL_SYSTEM}>Payroll System</option>
									<option value={PaymentMethod.OTHER}>Other</option>
								</select>
							</div>

							<div class="form-control">
								<label class="label" for="external-reference">
									<span class="label-text">External Reference</span>
								</label>
								<input
									id="external-reference"
									type="text"
									class="input input-bordered"
									placeholder="Reference number, PO, etc."
									bind:value={externalReference}
								/>
							</div>

							<div class="form-control md:col-span-1">
								<label class="label" for="description">
									<span class="label-text">Description</span>
								</label>
								<textarea
									id="description"
									class="textarea textarea-bordered"
									placeholder="Optional description for this batch..."
									rows="2"
									bind:value={description}
								></textarea>
							</div>
						</div>
					</div>
				</div>

				<!-- Payment Details -->
				<div class="card bg-base-100 border border-base-300 mb-6">
					<div class="card-body">
						<h4 class="card-title text-lg mb-4">Payments to Process</h4>
						
						<div class="overflow-x-auto">
							<table class="table table-zebra w-full">
								<thead>
									<tr>
										<th>Artist/Recipient</th>
										<th>Event Date</th>
										<th>Hours</th>
										<th>Rate</th>
										<th>Additional</th>
										<th>Total</th>
										<th>Status</th>
									</tr>
								</thead>
								<tbody>
									{#each approvedPayments as payment}
										<tr>
											<td>
												<div class="font-medium">
													{payment.artists?.full_name || payment.artists?.legal_first_name + ' ' + payment.artists?.legal_last_name || 'Unknown Artist'}
												</div>
											</td>
											<td>{formatDate(payment.event_date)}</td>
											<td>{payment.hours}</td>
											<td>{formatCurrency(payment.rate)}</td>
											<td>
												{formatCurrency(payment.additional_pay)}
												{#if payment.additional_pay_reason}
													<div class="text-xs text-gray-500 truncate max-w-24" title={payment.additional_pay_reason}>
														{payment.additional_pay_reason}
													</div>
												{/if}
											</td>
											<td class="font-bold">{formatCurrency(payment.total_pay || 0)}</td>
											<td>
												<span class="badge badge-sm badge-success">
													{payment.status}
												</span>
											</td>
										</tr>
									{/each}
								</tbody>
								<tfoot>
									<tr class="font-bold">
										<td colspan="5" class="text-right">Total:</td>
										<td>{formatCurrency(totalAmount)}</td>
										<td></td>
									</tr>
								</tfoot>
							</table>
						</div>
					</div>
				</div>

				<!-- Non-approved payments warning -->
				{#if payments.length > approvedPayments.length}
					<div class="alert alert-info mb-6">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
						<span>
							{payments.length - approvedPayments.length} payment(s) will be skipped as they are not in 'Approved' status.
						</span>
					</div>
				{/if}
			{/if}

			<!-- Actions -->
			<div class="modal-action">
				<button class="btn btn-ghost" on:click={handleClose} disabled={isLoading}>
					Cancel
				</button>
				<button
					class="btn btn-primary"
					on:click={handleProcess}
					disabled={!canProcess || isLoading}
				>
					{#if isLoading}
						<span class="loading loading-spinner loading-sm"></span>
						Processing...
					{:else}
						Process {approvedPayments.length} Payment{approvedPayments.length !== 1 ? 's' : ''}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}