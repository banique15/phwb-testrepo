<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { payrollStore } from '$lib/stores/payroll'
	import { user } from '$lib/auth'
	import type { Payroll } from '$lib/schemas/payroll'
	import { PaymentStatus, PaymentMethod } from '$lib/schemas/payroll'

	export let isOpen: boolean = false
	export let payments: Payroll[] = []
	export let title: string = 'Approve Payments'

	const dispatch = createEventDispatcher<{
		approve: { payments: Payroll[], notes?: string }
		close: void
	}>()

	let notes = ''
	let isLoading = false
	let selectedPaymentMethod: string = PaymentMethod.CHECK

	$: totalAmount = payments.reduce((sum, payment) => sum + (payment.total_pay || 0), 0)
	$: canApprove = payments.length > 0 && payments.every(p => p.status === PaymentStatus.PLANNED)

	async function handleApprove() {
		if (!$user || !canApprove) return

		isLoading = true
		try {
			const approvedPayments = []
			
			for (const payment of payments) {
				if (payment.id) {
					const approved = await payrollStore.approve(payment.id, $user.id, notes)
					approvedPayments.push(approved)
				}
			}

			dispatch('approve', { payments: approvedPayments, notes })
			handleClose()
		} catch (error) {
			console.error('Failed to approve payments:', error)
		} finally {
			isLoading = false
		}
	}

	function handleClose() {
		notes = ''
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
</script>

{#if isOpen}
	<div class="modal modal-open">
		<div class="modal-box w-11/12 max-w-4xl">
			<div class="flex items-center justify-between mb-6">
				<h3 class="font-bold text-lg">{title}</h3>
				<button class="btn btn-sm btn-circle btn-ghost" on:click={handleClose}>✕</button>
			</div>

			{#if payments.length === 0}
				<div class="text-center py-8">
					<div class="text-gray-400 mb-2">📋</div>
					<p>No payments selected for approval</p>
				</div>
			{:else}
				<!-- Summary Card -->
				<div class="card bg-base-200 mb-6">
					<div class="card-body">
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div class="stat">
								<div class="stat-title">Total Payments</div>
								<div class="stat-value text-2xl">{payments.length}</div>
							</div>
							<div class="stat">
								<div class="stat-title">Total Amount</div>
								<div class="stat-value text-2xl text-success">{formatCurrency(totalAmount)}</div>
							</div>
							<div class="stat">
								<div class="stat-title">Status</div>
								<div class="stat-value text-xl">
									{#if canApprove}
										<span class="badge badge-warning">Ready for Approval</span>
									{:else}
										<span class="badge badge-error">Cannot Approve</span>
									{/if}
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Payment List -->
				<div class="overflow-x-auto mb-6">
					<table class="table table-zebra w-full">
						<thead>
							<tr>
								<th>Artist/Recipient</th>
								<th>Event Date</th>
								<th>Hours</th>
								<th>Rate</th>
								<th>Additional Pay</th>
								<th>Total</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{#each payments as payment}
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
											<div class="text-xs text-gray-500">{payment.additional_pay_reason}</div>
										{/if}
									</td>
									<td class="font-bold">{formatCurrency(payment.total_pay || 0)}</td>
									<td>
										<span class="badge badge-sm {payment.status === PaymentStatus.PLANNED ? 'badge-warning' : 'badge-success'}">
											{payment.status}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Approval Form -->
				<div class="space-y-4">
					<div class="form-control">
						<label class="label" for="approval-notes">
							<span class="label-text">Approval Notes</span>
						</label>
						<textarea
							id="approval-notes"
							class="textarea textarea-bordered"
							placeholder="Add any notes about this approval..."
							rows="3"
							bind:value={notes}
						></textarea>
					</div>

					<div class="form-control">
						<label class="label" for="payment-method">
							<span class="label-text">Preferred Payment Method</span>
						</label>
						<select
							id="payment-method"
							class="select select-bordered"
							bind:value={selectedPaymentMethod}
						>
							<option value={PaymentMethod.CHECK}>Check</option>
							<option value={PaymentMethod.ACH}>ACH Transfer</option>
							<option value={PaymentMethod.WIRE}>Wire Transfer</option>
							<option value={PaymentMethod.PAYROLL_SYSTEM}>Payroll System</option>
							<option value={PaymentMethod.OTHER}>Other</option>
						</select>
					</div>
				</div>

				<!-- Actions -->
				<div class="modal-action">
					<button class="btn btn-ghost" on:click={handleClose} disabled={isLoading}>
						Cancel
					</button>
					<button
						class="btn btn-success"
						on:click={handleApprove}
						disabled={!canApprove || isLoading}
					>
						{#if isLoading}
							<span class="loading loading-spinner loading-sm"></span>
							Approving...
						{:else}
							Approve {payments.length} Payment{payments.length !== 1 ? 's' : ''}
						{/if}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}