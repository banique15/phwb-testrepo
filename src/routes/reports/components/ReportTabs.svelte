<script lang="ts">
	import PayrollPerArtistReport from '../components/PayrollPerArtistReport.svelte'
	import MonthlyPayrollReport from '../components/MonthlyPayrollReport.svelte'

	interface Props {
		selectedReport: string
		onSelectReport: (reportId: string) => void
	}

	let { selectedReport, onSelectReport }: Props = $props()

	const tabs = [
		{ id: 'payroll-per-artist', label: 'Payroll per Artist', icon: '👤' },
		{ id: 'monthly-payroll', label: 'Monthly Payroll', icon: '📅' },
		{ id: 'performance-summary', label: 'Performance Summary', icon: '🎭' },
		{ id: 'financial-overview', label: 'Financial Overview', icon: '💰' }
	]

	let activeTab = $state<string>(
		(typeof window !== 'undefined' ? localStorage.getItem('phwb-report-active-tab') : null) || selectedReport
	)

	function setActiveTab(tabId: string) {
		activeTab = tabId
		onSelectReport(tabId)
		if (typeof window !== 'undefined') {
			localStorage.setItem('phwb-report-active-tab', tabId)
		}
	}

	// Sync with prop changes
	$effect(() => {
		if (selectedReport && selectedReport !== activeTab) {
			activeTab = selectedReport
		}
	})
</script>

<div class="space-y-3">
	<!-- Tab Navigation -->
	<div class="tabs tabs-boxed">
		{#each tabs as tab}
			<button
				class="tab {activeTab === tab.id ? 'tab-active' : ''}"
				onclick={() => setActiveTab(tab.id)}
			>
				<span class="mr-2">{tab.icon}</span>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Tab Content -->
	<div class="tab-content">
		{#if activeTab === 'payroll-per-artist'}
			<PayrollPerArtistReport />
		{:else if activeTab === 'monthly-payroll'}
			<MonthlyPayrollReport />
		{:else if activeTab === 'performance-summary'}
			<div class="text-center py-12">
				<span class="text-4xl">🎭</span>
				<p class="mt-4 text-lg">Performance Summary Report</p>
				<p class="text-sm opacity-60">Coming soon - Database schema for programs relation needs to be designed</p>
			</div>
		{:else if activeTab === 'financial-overview'}
			<div class="text-center py-12">
				<span class="text-4xl">💰</span>
				<p class="mt-4 text-lg">Financial Overview Report</p>
				<p class="text-sm opacity-60">Coming soon - Revenue, expenses, and profit analysis</p>
			</div>
		{/if}
	</div>
</div>

