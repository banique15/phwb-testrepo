<script lang="ts">
	interface Props {
		selectedReport: string
		totalRecords?: number
		generatedDate?: string
	}

	let {
		selectedReport,
		totalRecords = 0,
		generatedDate
	}: Props = $props()

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		return new Date(dateStr).toLocaleDateString()
	}

	function getReportName(reportId: string): string {
		const names: Record<string, string> = {
			'payroll-per-artist': 'Payroll per Artist',
			'monthly-payroll': 'Monthly Payroll',
			'performance-summary': 'Performance Summary',
			'financial-overview': 'Financial Overview'
		}
		return names[reportId] || 'Report'
	}
</script>

<div class="card bg-base-100 shadow-none mb-4">
	<div class="card-body p-4">
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Left Side: Report Information (2 columns on large screens) -->
			<div class="lg:col-span-2 space-y-3">
				<!-- Title -->
				<div>
					<h2 class="text-3xl font-bold">{getReportName(selectedReport)}</h2>
				</div>

				<!-- Quick Stats -->
				<div class="flex items-center gap-3 pt-2 border-t border-base-300">
					{#if totalRecords > 0}
						<div class="stat stat-compact p-0">
							<div class="stat-title text-xs">Total Records</div>
							<div class="stat-value text-lg">{totalRecords}</div>
						</div>
					{/if}
					<div class="stat stat-compact p-0">
						<div class="stat-title text-xs">Generated</div>
						<div class="stat-value text-sm">{formatDate(generatedDate)}</div>
					</div>
				</div>
			</div>

			<!-- Right Side: Export Options (1 column on large screens) -->
			<div class="lg:col-span-1">
				<div class="space-y-2">
					<h3 class="text-sm font-semibold opacity-70">Export Options</h3>
					<div class="space-y-2">
						<button class="btn btn-outline btn-sm w-full">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							Export CSV
						</button>
						<button class="btn btn-outline btn-sm w-full">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							Export PDF
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

