<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { payrollStore } from '$lib/stores/payroll'
	import { user } from '$lib/auth'
	import type { Payroll } from '$lib/schemas/payroll'
	import { PaymentStatus } from '$lib/schemas/payroll'

	export let isOpen: boolean = false
	export let payments: Payroll[] = []

	const dispatch = createEventDispatcher<{
		reconciled: { payments: Payroll[] }
		close: void
	}>()

	let isLoading = false
	let searchTerm = ''
	let selectedPayments = new Set<number>()
	let externalPaymentIds: Record<number, string> = {}
	let reconciliationNotes: Record<number, string> = {}
	let showBulkMode = false

	$: filteredPayments = payments.filter(p => 
		p.status === PaymentStatus.PAID && 
		!p.reconciled &&
		(p.artist_id?.toLowerCase().includes(searchTerm.toLowerCase()) || 
		 p.payment_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
		 p.batch_id?.toLowerCase().includes(searchTerm.toLowerCase()))
	)

	$: selectedPaymentsList = Array.from(selectedPayments).map(id => 
		filteredPayments.find(p => p.id === id)
	).filter(Boolean) as Payroll[]

	$: totalAmount = selectedPaymentsList.reduce((sum, payment) => sum + (payment.total_pay || 0), 0)

	async function handleReconcile(payment: Payroll) {
		if (!$user || !payment.id) return

		isLoading = true
		try {
			const externalId = externalPaymentIds[payment.id]
			const notes = reconciliationNotes[payment.id] || ''

			await payrollStore.reconcile(payment.id, $user.id, externalId, notes)
			
			// Remove from selected payments
			selectedPayments.delete(payment.id)
			delete externalPaymentIds[payment.id]
			delete reconciliationNotes[payment.id]

			// Update selected payments reactivity
			selectedPayments = new Set(selectedPayments)
		} catch (error) {
			console.error('Failed to reconcile payment:', error)
		} finally {
			isLoading = false
		}
	}

	async function handleBulkReconcile() {
		if (!$user || selectedPaymentsList.length === 0) return

		isLoading = true
		try {
			const reconciledPayments = []
			
			for (const payment of selectedPaymentsList) {
				if (payment.id) {
					const externalId = externalPaymentIds[payment.id]
					const notes = reconciliationNotes[payment.id] || 'Bulk reconciliation'
					
					const reconciled = await payrollStore.reconcile(payment.id, $user.id, externalId, notes)
					reconciledPayments.push(reconciled)
				}
			}

			// Clear bulk selections
			selectedPayments.clear()
			externalPaymentIds = {}
			reconciliationNotes = {}

			dispatch('reconciled', { payments: reconciledPayments })
		} catch (error) {
			console.error('Failed to bulk reconcile payments:', error)
		} finally {
			isLoading = false
		}
	}

	function togglePaymentSelection(paymentId: number) {
		if (selectedPayments.has(paymentId)) {
			selectedPayments.delete(paymentId)
		} else {
			selectedPayments.add(paymentId)
		}
		selectedPayments = new Set(selectedPayments)
	}

	function handleClose() {
		selectedPayments.clear()
		externalPaymentIds = {}
		reconciliationNotes = {}
		searchTerm = ''
		showBulkMode = false
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
		<div class="modal-box w-11/12 max-w-6xl">
			<div class="flex items-center justify-between mb-6">
				<h3 class="font-bold text-lg">Payment Reconciliation</h3>
				<button class="btn btn-sm btn-circle btn-ghost" onclick={handleClose}>✕</button>
			</div>

			{#if filteredPayments.length === 0}
				<div class="text-center py-8">
					<div class="text-6xl mb-4">🔄</div>
					<h4 class="text-lg font-medium mb-2">No Payments to Reconcile</h4>
					<p class="text-gray-500">All paid payments have been reconciled or no paid payments are available.</p>
				</div>
			{:else}
				<!-- Controls -->
				<div class="flex flex-wrap gap-4 mb-6">
					<div class="form-control flex-1 min-w-64">
						<input
							type="text"
							placeholder="Search by artist, reference, or batch ID..."
							class="input input-bordered"
							bind:value={searchTerm}
						/>
					</div>
					
					<div class="flex gap-2">
						<button 
							class="btn btn-outline"
							class:btn-active={showBulkMode}
							onclick={() => showBulkMode = !showBulkMode}
						>
							{showBulkMode ? 'Single Mode' : 'Bulk Mode'}
						</button>
						
						{#if showBulkMode && selectedPayments.size > 0}
							<button
								class="btn btn-primary"
								onclick={handleBulkReconcile}
								disabled={isLoading}
							>
								{#if isLoading}
									<span class="loading loading-spinner loading-sm"></span>
								{/if}
								Reconcile {selectedPayments.size} Selected
							</button>
						{/if}
					</div>
				</div>

				<!-- Bulk Summary -->
				{#if showBulkMode && selectedPayments.size > 0}
					<div class="alert alert-info mb-6">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
						<span>
							<strong>{selectedPayments.size} payments</strong> selected for reconciliation 
							(Total: <strong>{formatCurrency(totalAmount)}</strong>)
						</span>
					</div>
				{/if}

				<!-- Payments List -->
				<div class="overflow-x-auto">
					<table class="table table-zebra w-full">
						<thead>
							<tr>
								{#if showBulkMode}
									<th>
										<input 
											type="checkbox" 
											class="checkbox checkbox-sm"
											checked={selectedPayments.size === filteredPayments.length && filteredPayments.length > 0}
											onchange={() => {
												if (selectedPayments.size === filteredPayments.length) {
													selectedPayments.clear()
												} else {
													selectedPayments = new Set(filteredPayments.map(p => p.id!))
												}
											}}
										/>
									</th>
								{/if}
								<th>Artist/Recipient</th>
								<th>Event Date</th>
								<th>Amount</th>
								<th>Payment Method</th>
								<th>Batch ID</th>
								<th>Paid Date</th>
								<th>External ID</th>
								<th>Notes</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredPayments as payment}
								<tr>
									{#if showBulkMode}
										<td>
											<input 
												type="checkbox" 
												class="checkbox checkbox-sm"
												checked={selectedPayments.has(payment.id!)}
												onchange={() => togglePaymentSelection(payment.id!)}
											/>
										</td>
									{/if}
									<td>
										<div class="font-medium">
											{payment.artist_id || 'Unknown Artist'}
										</div>
									</td>
									<td>{formatDate(payment.event_date)}</td>
									<td class="font-bold">{formatCurrency(payment.total_pay || 0)}</td>
									<td>
										<span class="badge badge-outline">
											{payment.payment_method?.replace('_', ' ') || 'N/A'}
										</span>
									</td>
									<td>
										{#if payment.batch_id}
											<span class="font-mono text-sm">{payment.batch_id}</span>
										{:else}
											<span class="text-gray-400">—</span>
										{/if}
									</td>
									<td>{payment.paid_date ? formatDate(payment.paid_date) : '—'}</td>
									<td>
										<input
											type="text"
											class="input input-xs input-bordered w-24"
											placeholder="External ID"
											bind:value={externalPaymentIds[payment.id!]}
										/>
									</td>
									<td>
										<input
											type="text"
											class="input input-xs input-bordered w-32"
											placeholder="Notes..."
											bind:value={reconciliationNotes[payment.id!]}
										/>
									</td>
									<td>
										{#if !showBulkMode}
											<button
												class="btn btn-success btn-xs"
												onclick={() => handleReconcile(payment)}
												disabled={isLoading}
											>
												{#if isLoading}
													<span class="loading loading-spinner loading-xs"></span>
												{:else}
													Reconcile
												{/if}
											</button>
										{:else}
											<span class="text-gray-400 text-xs">Bulk mode</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Summary Stats -->
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">Unreconciled Payments</div>
						<div class="stat-value text-2xl">{filteredPayments.length}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">Total Unreconciled</div>
						<div class="stat-value text-xl text-warning">
							{formatCurrency(filteredPayments.reduce((sum, p) => sum + (p.total_pay || 0), 0))}
						</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">Selected for Reconciliation</div>
						<div class="stat-value text-lg">
							{showBulkMode ? selectedPayments.size : 'Single mode'}
						</div>
					</div>
				</div>
			{/if}

			<!-- Actions -->
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={handleClose} disabled={isLoading}>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}