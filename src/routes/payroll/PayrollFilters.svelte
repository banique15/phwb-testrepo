<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import FormField from '$lib/components/ui/FormField.svelte'

	interface Props {
		statusFilter: string
		paymentTypeFilter: string
		employeeContractorFilter: string
		dateRangeStart: string
		dateRangeEnd: string
	}

	let {
		statusFilter = '',
		paymentTypeFilter = '',
		employeeContractorFilter = '',
		dateRangeStart = '',
		dateRangeEnd = ''
	}: Props = $props()

	const dispatch = createEventDispatcher<{
		filtersChange: {
			status: string
			paymentType: string
			employeeContractor: string
			dateStart: string
			dateEnd: string
		}
	}>()

	// Local state for form values
	let localStatus = $state(statusFilter)
	let localPaymentType = $state(paymentTypeFilter)
	let localEmployeeContractor = $state(employeeContractorFilter)
	let localDateStart = $state(dateRangeStart)
	let localDateEnd = $state(dateRangeEnd)
	let isExpanded = $state(false)

	// Status options (matching PaymentStatus enum)
	const statusOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: 'Planned', label: 'Planned' },
		{ value: 'Approved', label: 'Approved' },
		{ value: 'Paid', label: 'Paid' },
		{ value: 'With Issues', label: 'With Issues' },
		{ value: 'Cancelled', label: 'Cancelled' }
	]

	// Payment type options
	const paymentTypeOptions = [
		{ value: '', label: 'All Types' },
		{ value: 'performance', label: 'Performance' },
		{ value: 'training', label: 'Training' },
		{ value: 'special_event', label: 'Special Event' },
		{ value: 'other', label: 'Other' }
	]

	// Employee contractor status options
	const employeeContractorOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: 'W-2', label: 'W-2' },
		{ value: '1099', label: '1099' }
	]

	// Apply filters
	function applyFilters() {
		dispatch('filtersChange', {
			status: localStatus,
			paymentType: localPaymentType,
			employeeContractor: localEmployeeContractor,
			dateStart: localDateStart,
			dateEnd: localDateEnd
		})
	}

	// Clear all filters
	function clearFilters() {
		localStatus = ''
		localPaymentType = ''
		localEmployeeContractor = ''
		localDateStart = ''
		localDateEnd = ''
		applyFilters()
	}

	// Check if any filters are active
	let hasActiveFilters = $derived(localStatus || localPaymentType || localEmployeeContractor || localDateStart || localDateEnd)

	// Update local state when props change
	$effect(() => {
		localStatus = statusFilter
		localPaymentType = paymentTypeFilter
		localEmployeeContractor = employeeContractorFilter
		localDateStart = dateRangeStart
		localDateEnd = dateRangeEnd
	})
</script>

<div class="card bg-base-100 shadow-sm border min-w-0">
	<div class="card-body p-3 sm:p-4">
		<!-- Filter header -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
			<div class="flex items-center gap-3 min-w-0">
				<h3 class="font-semibold text-base flex-shrink-0">Filters</h3>
				{#if hasActiveFilters}
					<span class="badge badge-primary badge-sm flex-shrink-0">{[localStatus, localPaymentType, localEmployeeContractor, localDateStart, localDateEnd].filter(Boolean).length}</span>
				{/if}
			</div>
			<div class="flex items-center gap-2 flex-shrink-0">
				{#if hasActiveFilters}
					<button 
						class="btn btn-ghost btn-xs flex-shrink-0"
						onclick={clearFilters}
					>
						Clear All
					</button>
				{/if}
				<button 
					class="btn btn-ghost btn-sm flex-shrink-0"
					onclick={() => isExpanded = !isExpanded}
				>
					<span class="hidden sm:inline">{isExpanded ? 'Collapse' : 'Expand'}</span>
					<svg 
						xmlns="http://www.w3.org/2000/svg" 
						class="h-4 w-4 transition-transform flex-shrink-0"
						class:rotate-180={isExpanded}
						fill="none" 
						viewBox="0 0 24 24" 
						stroke="currentColor"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Quick filters (always visible) - Responsive grid -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mt-3">
			<div class="min-w-0">
				<label class="block text-xs font-medium mb-1 text-base-content/70 truncate">Status</label>
				<select 
					class="select select-bordered select-sm w-full min-w-0 text-sm"
					bind:value={localStatus}
					onchange={applyFilters}
				>
					{#each statusOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>
			<div class="min-w-0">
				<label class="block text-xs font-medium mb-1 text-base-content/70 truncate">Type</label>
				<select 
					class="select select-bordered select-sm w-full min-w-0 text-sm"
					bind:value={localPaymentType}
					onchange={applyFilters}
				>
					{#each paymentTypeOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>
			<div class="min-w-0">
				<label class="block text-xs font-medium mb-1 text-base-content/70 truncate">Employee Status</label>
				<select 
					class="select select-bordered select-sm w-full min-w-0 text-sm"
					bind:value={localEmployeeContractor}
					onchange={applyFilters}
				>
					{#each employeeContractorOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Expanded filters -->
		{#if isExpanded}
			<div class="divider my-3"></div>
			<div class="space-y-4">
				<!-- Date Range -->
				<div class="min-w-0">
				<label class="block text-sm font-medium mb-2 truncate">Date Range</label>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
				<div class="min-w-0">
				<input 
				type="date"
				class="input input-bordered input-sm w-full min-w-0 text-sm"
				bind:value={localDateStart}
				onchange={applyFilters}
				placeholder="Start date"
				/>
				</div>
				<div class="min-w-0">
				<input 
				type="date"
				class="input input-bordered input-sm w-full min-w-0 text-sm"
				bind:value={localDateEnd}
				onchange={applyFilters}
				placeholder="End date"
				/>
				</div>
				</div>
				</div>

				<!-- Apply button for mobile -->
				<div class="flex justify-end sm:hidden">
					<button 
						class="btn btn-outline btn-sm"
						onclick={applyFilters}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
						Apply Filters
					</button>
				</div>
			</div>

			<!-- Quick Date Ranges -->
			<div class="mt-4">
				<label class="block text-sm font-medium mb-2">Quick Date Ranges</label>
				<div class="flex flex-wrap gap-2">
					<button 
						class="btn btn-outline btn-xs"
						onclick={() => {
							const now = new Date()
							localDateStart = now.toISOString().split('T')[0]
							localDateEnd = now.toISOString().split('T')[0]
							applyFilters()
						}}
					>
						Today
					</button>
					<button 
						class="btn btn-outline btn-xs"
						onclick={() => {
							const now = new Date()
							const day = now.getDay()
							const monday = new Date(now.getTime() - (day === 0 ? 6 : day - 1) * 24 * 60 * 60 * 1000)
							const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000)
							localDateStart = monday.toISOString().split('T')[0]
							localDateEnd = sunday.toISOString().split('T')[0]
							applyFilters()
						}}
					>
						This Week
					</button>
					<button 
						class="btn btn-outline btn-xs"
						onclick={() => {
							const now = new Date()
							const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
							const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
							localDateStart = firstDay.toISOString().split('T')[0]
							localDateEnd = lastDay.toISOString().split('T')[0]
							applyFilters()
						}}
					>
						This Month
					</button>
					<button 
						class="btn btn-outline btn-xs"
						onclick={() => {
							const now = new Date()
							const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
							localDateStart = sevenDaysAgo.toISOString().split('T')[0]
							localDateEnd = now.toISOString().split('T')[0]
							applyFilters()
						}}
					>
						Last 7 Days
					</button>
					<button 
						class="btn btn-outline btn-xs"
						onclick={() => {
							const now = new Date()
							const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
							localDateStart = thirtyDaysAgo.toISOString().split('T')[0]
							localDateEnd = now.toISOString().split('T')[0]
							applyFilters()
						}}
					>
						Last 30 Days
					</button>
					<button 
						class="btn btn-outline btn-xs"
						onclick={() => {
							const now = new Date()
							const firstDay = new Date(now.getFullYear(), 0, 1)
							localDateStart = firstDay.toISOString().split('T')[0]
							localDateEnd = now.toISOString().split('T')[0]
							applyFilters()
						}}
					>
						Year to Date
					</button>
				</div>
			</div>

			<!-- Status + Type Presets -->
			<div class="mt-4">
				<label class="block text-sm font-medium mb-2">Quick Filters</label>
				<div class="flex flex-wrap gap-2">
					<button 
						class="btn btn-outline btn-xs"
						onclick={() => {
							localStatus = 'With Issues'
							applyFilters()
						}}
					>
						With Issues
					</button>
					<button 
						class="btn btn-outline btn-xs"
						onclick={() => {
							localStatus = 'Approved'
							applyFilters()
						}}
					>
						Approved Only
					</button>
					<button 
						class="btn btn-outline btn-xs"
						onclick={() => {
							localStatus = 'Paid'
							const now = new Date()
							const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
							localDateStart = thirtyDaysAgo.toISOString().split('T')[0]
							localDateEnd = now.toISOString().split('T')[0]
							applyFilters()
						}}
					>
						Paid Last 30 Days
					</button>
					<button 
						class="btn btn-outline btn-xs"
						onclick={() => {
							localPaymentType = 'performance'
							applyFilters()
						}}
					>
						Performances Only
					</button>
					<button 
						class="btn btn-outline btn-xs"
						onclick={() => {
							localEmployeeContractor = '1099'
							applyFilters()
						}}
					>
						1099 Only
					</button>
					<button 
						class="btn btn-outline btn-xs"
						onclick={() => {
							localEmployeeContractor = 'W-2'
							applyFilters()
						}}
					>
						W-2 Only
					</button>
					<button 
						class="btn btn-outline btn-xs"
						onclick={() => {
							const now = new Date()
							const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
							localDateStart = now.toISOString().split('T')[0]
							localDateEnd = nextWeek.toISOString().split('T')[0]
							localStatus = 'Planned'
							applyFilters()
						}}
					>
						Upcoming This Week
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>