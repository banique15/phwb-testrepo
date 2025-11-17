<script lang="ts">
	interface Props {
		stats: {
			totalPaid: number
			totalUnpaid: number
			totalPlanned: number
			totalApproved: number
			totalCompleted: number
			unreconciled: number
			averagePayment: number
		}
		dateRange?: string
		statusSummary?: string
	}

	let {
		stats,
		dateRange,
		statusSummary
	}: Props = $props()

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount)
	}
</script>

<div class="card bg-base-100 shadow-none mb-4">
	<div class="card-body p-4">
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Left Side: Summary Information (2 columns on large screens) -->
			<div class="lg:col-span-2 space-y-3">
				<!-- Title -->
				<div>
					<h2 class="text-3xl font-bold">Payroll Summary</h2>
					{#if dateRange}
						<p class="text-sm opacity-70 mt-1">{dateRange}</p>
					{/if}
				</div>

				<!-- Quick Stats -->
				<div class="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-base-300">
					<div class="stat stat-compact p-0">
						<div class="stat-title text-xs">Total Paid</div>
						<div class="stat-value text-lg text-success">{formatCurrency(stats.totalPaid)}</div>
					</div>
					<div class="stat stat-compact p-0">
						<div class="stat-title text-xs">Unpaid</div>
						<div class="stat-value text-lg text-warning">{formatCurrency(stats.totalUnpaid)}</div>
					</div>
					<div class="stat stat-compact p-0">
						<div class="stat-title text-xs">Approved</div>
						<div class="stat-value text-lg text-info">{formatCurrency(stats.totalApproved)}</div>
					</div>
					<div class="stat stat-compact p-0">
						<div class="stat-title text-xs">Unreconciled</div>
						<div class="stat-value text-lg text-error">{stats.unreconciled}</div>
					</div>
				</div>
			</div>

			<!-- Right Side: Action Buttons (1 column on large screens) -->
			<div class="lg:col-span-1">
				<div class="space-y-2">
					<h3 class="text-sm font-semibold opacity-70">Quick Actions</h3>
					<div class="space-y-2">
						<button class="btn btn-outline btn-sm w-full">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							Export
						</button>
						<button class="btn btn-outline btn-sm w-full">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
							</svg>
							Reconcile
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

