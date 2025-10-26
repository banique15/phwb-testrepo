<script lang="ts">
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import PageHeader from '$lib/components/ui/PageHeader.svelte'
	import PayrollPerArtistReport from './components/PayrollPerArtistReport.svelte'
	import MonthlyPayrollReport from './components/MonthlyPayrollReport.svelte'
	// import PerformanceSummaryReport from './components/PerformanceSummaryReport.svelte' // Commented out until programs schema is ready
	
	// Report type state
	let selectedReport = $state<string>('payroll-per-artist')
	
	const reportTypes = [
		{ id: 'payroll-per-artist', label: 'Payroll per Artist', icon: '👤' },
		{ id: 'monthly-payroll', label: 'Monthly Payroll', icon: '📅' },
		{ id: 'performance-summary', label: 'Performance Summary', icon: '🎭' },
		{ id: 'financial-overview', label: 'Financial Overview', icon: '💰' }
	]
</script>

<ErrorBoundary>
	<div class="flex flex-col h-full">
		<!-- Fixed Page Header -->
		<div class="flex-none px-6 pt-4 pb-4 bg-base-100 border-b border-base-200">
			<PageHeader
				title="Reports"
				subtitle="Analytics and reporting dashboard"
			>
				{#snippet actions()}
					<button class="btn btn-primary">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Generate Report
					</button>
				{/snippet}
			</PageHeader>
		</div>
		
		<!-- Scrollable Content Area -->
		<div class="flex-1 p-6 overflow-y-auto">
			<div class="space-y-6">
				
				<!-- Report Type Selection -->
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<h2 class="card-title text-lg mb-4">Select Report Type</h2>
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
							{#each reportTypes as reportType}
								<button
									class="btn btn-outline h-20 flex-col {selectedReport === reportType.id ? 'btn-primary' : ''}"
									onclick={() => selectedReport = reportType.id}
								>
									<span class="text-2xl">{reportType.icon}</span>
									<span class="text-sm">{reportType.label}</span>
								</button>
							{/each}
						</div>
					</div>
				</div>
				
				<!-- Report Content -->
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						{#if selectedReport === 'payroll-per-artist'}
							<PayrollPerArtistReport />
						{:else if selectedReport === 'monthly-payroll'}
							<MonthlyPayrollReport />
						{:else if selectedReport === 'performance-summary'}
							<!-- <PerformanceSummaryReport /> -->
							<div class="text-center py-12">
								<span class="text-4xl">🎭</span>
								<p class="mt-4 text-lg">Performance Summary Report</p>
								<p class="text-sm opacity-60">Coming soon - Database schema for programs relation needs to be designed</p>
							</div>
						{:else if selectedReport === 'financial-overview'}
							<div class="text-center py-12">
								<span class="text-4xl">💰</span>
								<p class="mt-4 text-lg">Financial Overview Report</p>
								<p class="text-sm opacity-60">Coming soon - Revenue, expenses, and profit analysis</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</ErrorBoundary>