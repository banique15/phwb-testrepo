<script lang="ts">
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import ReportHeaderCard from './components/ReportHeaderCard.svelte'
	import ReportTabs from './components/ReportTabs.svelte'
	
	// Report type state
	let selectedReport = $state<string>(
		(typeof window !== 'undefined' ? localStorage.getItem('phwb-report-active-tab') : null) || 'payroll-per-artist'
	)
	
	function handleSelectReport(reportId: string) {
		selectedReport = reportId
	}
</script>

<ErrorBoundary>
	<div class="h-full flex flex-col overflow-hidden">
		<!-- Scrollable Content Area -->
		<div class="flex-1 p-4 min-h-0 flex flex-col">
			<div class="overflow-y-auto h-full">
				<!-- Header Card -->
				<ReportHeaderCard
					{selectedReport}
					generatedDate={new Date().toISOString()}
				/>

				<!-- Tabs Section -->
				<ReportTabs
					{selectedReport}
					onSelectReport={handleSelectReport}
				/>
			</div>
		</div>
	</div>
</ErrorBoundary>