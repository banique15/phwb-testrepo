<script lang="ts">
	import type { ComponentType, SvelteComponent } from 'svelte'
	import { User, Calendar, Theater, DollarSign } from 'lucide-svelte'
	import PayrollPerArtistReport from '../components/PayrollPerArtistReport.svelte'
	import MonthlyPayrollReport from '../components/MonthlyPayrollReport.svelte'

	interface Props {
		selectedReport: string
		onSelectReport: (reportId: string) => void
	}

	let { selectedReport, onSelectReport }: Props = $props()

	const tabs: Array<{ id: string; label: string; icon: ComponentType<SvelteComponent> }> = [
		{ id: 'payroll-per-artist', label: 'Payroll per Artist', icon: User },
		{ id: 'monthly-payroll', label: 'Monthly Payroll', icon: Calendar },
		{ id: 'performance-summary', label: 'Performance Summary', icon: Theater },
		{ id: 'financial-overview', label: 'Financial Overview', icon: DollarSign }
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

<div class="flex flex-col h-full min-h-0">
	<!-- Tab Navigation -->
	<div class="flex-none mb-3">
		<div class="tabs tabs-boxed">
			{#each tabs as tab}
				<button
					class="tab {activeTab === tab.id ? 'tab-active' : ''}"
					onclick={() => setActiveTab(tab.id)}
				>
					<svelte:component this={tab.icon} class="w-4 h-4 mr-2" />
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Tab Content -->
	<div class="flex-1 min-h-0 overflow-y-auto">
		{#if activeTab === 'payroll-per-artist'}
			<PayrollPerArtistReport />
		{:else if activeTab === 'monthly-payroll'}
			<MonthlyPayrollReport />
		{:else if activeTab === 'performance-summary'}
			<div class="text-center py-12">
				<Theater class="w-16 h-16 mx-auto text-base-content/70" />
				<p class="mt-4 text-lg">Performance Summary Report</p>
				<p class="text-sm opacity-60">Coming soon - Database schema for programs relation needs to be designed</p>
			</div>
		{:else if activeTab === 'financial-overview'}
			<div class="text-center py-12">
				<DollarSign class="w-16 h-16 mx-auto text-base-content/70" />
				<p class="mt-4 text-lg">Financial Overview Report</p>
				<p class="text-sm opacity-60">Coming soon - Revenue, expenses, and profit analysis</p>
			</div>
		{/if}
	</div>
</div>

