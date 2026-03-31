<script lang="ts">
	import { onMount } from 'svelte'
	import { supabase } from '$lib/supabase'
	import { payrollStore } from '$lib/stores/payroll'
	import type { Payroll } from '$lib/schemas/payroll'
	import { PaymentStatus } from '$lib/schemas/payroll'
	import { Calendar, DollarSign, Users, AlertTriangle, CheckCircle2, Clock, Download, ChevronDown, ChevronRight, FileSpreadsheet, FileText } from 'lucide-svelte'
	import { exportPayroll, exportPayrollByWeek } from '$lib/services/payroll-export'

	interface Props {
		onMarkPaid?: (entryIds: number[]) => Promise<void>
		onExport?: (entries: Payroll[]) => void
	}

	let { onMarkPaid, onExport }: Props = $props()

	let showExportMenu = $state<string | null>(null)

	interface WeekBatch {
		weekStart: Date
		weekEnd: Date
		label: string
		entries: Payroll[]
		totalAmount: number
		artistCount: number
		isAging: boolean
		ageInWeeks: number
		isExpanded: boolean
	}

	let loading = $state(true)
	let error = $state<string | null>(null)
	let approvedEntries = $state<Payroll[]>([])
	let weeklyBatches = $state<WeekBatch[]>([])
	let selectedBatchIds = $state<Set<number>>(new Set())
	let processingBatch = $state<string | null>(null)

	onMount(async () => {
		await loadApprovedEntries()
	})

	async function loadApprovedEntries() {
		loading = true
		error = null

		try {
			// Fetch approved but unpaid entries
			const { data, error: fetchError } = await supabase
				.from('phwb_payroll')
				.select(`
					*,
					artists:artist_id(id, full_name, legal_first_name, legal_last_name),
					venues:venue_id(id, name),
					programs:program_id(id, title, program_type)
				`)
				.eq('status', PaymentStatus.APPROVED)
				.order('created_at', { ascending: false })

			if (fetchError) throw fetchError

			const entries = data || []
			const facilityIds = Array.from(
				new Set(
					entries
						.map((entry: any) => entry?.facility_id)
						.filter((id: unknown): id is number => typeof id === 'number')
				)
			)

			if (facilityIds.length > 0) {
				const { data: facilitiesData } = await supabase
					.from('phwb_facilities')
					.select('id, name')
					.in('id', facilityIds)

				const facilitiesMap = new Map<number, { id: number; name: string }>(
					(facilitiesData || []).map((f: any) => [f.id, { id: f.id, name: f.name }])
				)

				approvedEntries = entries.map((entry: any) => ({
					...entry,
					facilities:
						typeof entry.facility_id === 'number'
							? (facilitiesMap.get(entry.facility_id) ?? null)
							: null
				}))
			} else {
				approvedEntries = entries
			}
			groupByWeek()
		} catch (err: any) {
			error = err.message || 'Failed to load approved entries'
			console.error('Error loading approved entries:', err)
		} finally {
			loading = false
		}
	}

	function getWeekMonday(date: Date): Date {
		const d = new Date(date)
		const day = d.getDay()
		const diff = d.getDate() - day + (day === 0 ? -6 : 1)
		d.setDate(diff)
		d.setHours(0, 0, 0, 0)
		return d
	}

	function getWeekSunday(monday: Date): Date {
		const sunday = new Date(monday)
		sunday.setDate(monday.getDate() + 6)
		sunday.setHours(23, 59, 59, 999)
		return sunday
	}

	function getWeekKey(date: Date): string {
		const monday = getWeekMonday(date)
		return monday.toISOString().split('T')[0]
	}

	function groupByWeek() {
		const grouped = new Map<string, Payroll[]>()

		for (const entry of approvedEntries) {
			const eventDate = new Date(entry.event_date)
			const weekKey = getWeekKey(eventDate)

			if (!grouped.has(weekKey)) {
				grouped.set(weekKey, [])
			}
			grouped.get(weekKey)!.push(entry)
		}

		const today = new Date()
		const currentMonday = getWeekMonday(today)

		const batches: WeekBatch[] = Array.from(grouped.entries()).map(([weekKey, entries]) => {
			const weekStart = new Date(weekKey)
			const weekEnd = getWeekSunday(weekStart)
			
			// Calculate age in weeks
			const diffTime = currentMonday.getTime() - weekStart.getTime()
			const ageInWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000))

			// Calculate totals
			const totalAmount = entries.reduce((sum, e) => sum + (e.total_pay || 0), 0)
			const uniqueArtists = new Set(entries.map(e => e.artist_id).filter(Boolean))
			const sortedEntries = sortEntriesByGeneration(entries)

			return {
				weekStart,
				weekEnd,
				label: formatWeekLabel(weekStart, weekEnd),
				entries: sortedEntries,
				totalAmount,
				artistCount: uniqueArtists.size,
				isAging: ageInWeeks > 0,
				ageInWeeks,
				isExpanded: false
			}
		})

		// Sort by week (oldest first - aging payables at top)
		batches.sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())

		weeklyBatches = batches
	}

	function sortEntriesByGeneration(entries: Payroll[]): Payroll[] {
		const groupedByEvent = new Map<string, Payroll[]>()

		for (const entry of entries) {
			const eventKey = String(entry.source_event_id ?? entry.event_id ?? `entry-${entry.id ?? `${entry.artist_id || 'unknown'}-${entry.created_at || entry.event_date}`}`)
			if (!groupedByEvent.has(eventKey)) {
				groupedByEvent.set(eventKey, [])
			}
			groupedByEvent.get(eventKey)!.push(entry)
		}

		const eventGroups = Array.from(groupedByEvent.values()).sort((a, b) => {
			const latestA = Math.max(...a.map((entry) => new Date(entry.created_at || entry.event_date).getTime()))
			const latestB = Math.max(...b.map((entry) => new Date(entry.created_at || entry.event_date).getTime()))
			return latestB - latestA
		})

		return eventGroups.flatMap((group) =>
			group.sort((a, b) => {
				const createdA = new Date(a.created_at || a.event_date).getTime()
				const createdB = new Date(b.created_at || b.event_date).getTime()
				if (createdA !== createdB) return createdB - createdA
				return getArtistName(a).localeCompare(getArtistName(b))
			})
		)
	}

	function formatWeekLabel(start: Date, end: Date): string {
		const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
		const startStr = start.toLocaleDateString('en-US', options)
		const endStr = end.toLocaleDateString('en-US', { ...options, year: 'numeric' })
		return `${startStr} - ${endStr}`
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
	}

	function getArtistName(entry: Payroll): string {
		const artist = entry.artists as any
		if (!artist) return 'Unknown Artist'
		return artist.full_name || `${artist.legal_first_name || ''} ${artist.legal_last_name || ''}`.trim() || 'Unknown Artist'
	}

	function toggleBatchExpansion(index: number) {
		weeklyBatches = weeklyBatches.map((batch, i) => 
			i === index ? { ...batch, isExpanded: !batch.isExpanded } : batch
		)
	}

	function selectAllInBatch(batch: WeekBatch, selected: boolean) {
		const newSelected = new Set(selectedBatchIds)
		for (const entry of batch.entries) {
			if (entry.id) {
				if (selected) {
					newSelected.add(entry.id)
				} else {
					newSelected.delete(entry.id)
				}
			}
		}
		selectedBatchIds = newSelected
	}

	function isEntrySelected(entryId: number): boolean {
		return selectedBatchIds.has(entryId)
	}

	function toggleEntrySelection(entryId: number) {
		const newSelected = new Set(selectedBatchIds)
		if (newSelected.has(entryId)) {
			newSelected.delete(entryId)
		} else {
			newSelected.add(entryId)
		}
		selectedBatchIds = newSelected
	}

	function isBatchFullySelected(batch: WeekBatch): boolean {
		return batch.entries.every(e => e.id && selectedBatchIds.has(e.id))
	}

	async function handleMarkBatchPaid(batch: WeekBatch) {
		if (!onMarkPaid) return

		const entryIds = batch.entries.map(e => e.id).filter((id): id is number => id !== undefined)
		if (entryIds.length === 0) return

		processingBatch = batch.label
		try {
			await onMarkPaid(entryIds)
			await loadApprovedEntries()
		} catch (err: any) {
			error = err.message || 'Failed to mark batch as paid'
		} finally {
			processingBatch = null
		}
	}

	async function handleMarkSelectedPaid() {
		if (!onMarkPaid || selectedBatchIds.size === 0) return

		processingBatch = 'selected'
		try {
			await onMarkPaid(Array.from(selectedBatchIds))
			selectedBatchIds = new Set()
			await loadApprovedEntries()
		} catch (err: any) {
			error = err.message || 'Failed to mark as paid'
		} finally {
			processingBatch = null
		}
	}

	function handleExportBatch(batch: WeekBatch, format: 'csv' | 'xlsx' = 'csv') {
		exportPayrollByWeek(batch.entries, {
			format,
			weekLabel: batch.label
		})
		showExportMenu = null
	}

	function handleExportSelected(format: 'csv' | 'xlsx' = 'csv') {
		if (selectedBatchIds.size > 0) {
			const selectedEntries = approvedEntries.filter(e => e.id && selectedBatchIds.has(e.id))
			exportPayroll(selectedEntries, { format })
		}
		showExportMenu = null
	}

	function handleExportAll(format: 'csv' | 'xlsx' = 'csv') {
		exportPayroll(approvedEntries, { format, filename: 'all_pending_payments' })
		showExportMenu = null
	}

	function toggleExportMenu(menuId: string) {
		showExportMenu = showExportMenu === menuId ? null : menuId
	}

	// Summary stats
	let totalPending = $derived(approvedEntries.length)
	let totalAmount = $derived(approvedEntries.reduce((sum, e) => sum + (e.total_pay || 0), 0))
	let agingCount = $derived(weeklyBatches.filter(b => b.isAging).reduce((sum, b) => sum + b.entries.length, 0))
</script>

<div class="space-y-4">
	<!-- Summary Header -->
	<div class="stats stats-vertical lg:stats-horizontal shadow w-full bg-base-100">
		<div class="stat">
			<div class="stat-figure text-primary">
				<Clock class="w-8 h-8" />
			</div>
			<div class="stat-title">Pending Payments</div>
			<div class="stat-value text-primary">{totalPending}</div>
			<div class="stat-desc">Approved, awaiting processing</div>
		</div>

		<div class="stat">
			<div class="stat-figure text-success">
				<DollarSign class="w-8 h-8" />
			</div>
			<div class="stat-title">Total Amount</div>
			<div class="stat-value text-success">{formatCurrency(totalAmount)}</div>
			<div class="stat-desc">To be paid</div>
		</div>

		<div class="stat">
			<div class="stat-figure text-warning">
				<AlertTriangle class="w-8 h-8" />
			</div>
			<div class="stat-title">Aging Payables</div>
			<div class="stat-value text-warning">{agingCount}</div>
			<div class="stat-desc">Older than 1 week</div>
		</div>

		<div class="stat">
			<div class="stat-figure">
				<div class="dropdown dropdown-end">
					<button class="btn btn-primary btn-sm" onclick={() => toggleExportMenu('all')}>
						<Download class="w-4 h-4" />
						Export All
					</button>
					{#if showExportMenu === 'all'}
						<ul class="dropdown-content menu bg-base-200 rounded-box w-40 p-2 shadow z-50">
							<li><button onclick={() => handleExportAll('csv')}>
								<FileText class="w-4 h-4" /> CSV
							</button></li>
							<li><button onclick={() => handleExportAll('xlsx')}>
								<FileSpreadsheet class="w-4 h-4" /> Excel
							</button></li>
						</ul>
					{/if}
				</div>
			</div>
			<div class="stat-title">Quick Actions</div>
			<div class="stat-value text-base">&nbsp;</div>
			<div class="stat-desc">Export all pending</div>
		</div>
	</div>

	<!-- Selected Actions Bar -->
	{#if selectedBatchIds.size > 0}
		<div class="alert bg-primary/10 border-primary">
			<div class="flex justify-between items-center w-full">
				<span class="font-medium">
					{selectedBatchIds.size} payment{selectedBatchIds.size === 1 ? '' : 's'} selected
				</span>
				<div class="flex gap-2">
					<div class="dropdown dropdown-end">
						<button 
							class="btn btn-sm btn-ghost"
							onclick={() => toggleExportMenu('selected')}
						>
							<Download class="w-4 h-4" />
							Export Selected
						</button>
						{#if showExportMenu === 'selected'}
							<ul class="dropdown-content menu bg-base-200 rounded-box w-40 p-2 shadow z-50">
								<li><button onclick={() => handleExportSelected('csv')}>
									<FileText class="w-4 h-4" /> CSV
								</button></li>
								<li><button onclick={() => handleExportSelected('xlsx')}>
									<FileSpreadsheet class="w-4 h-4" /> Excel
								</button></li>
							</ul>
						{/if}
					</div>
					<button 
						class="btn btn-sm btn-primary"
						onclick={handleMarkSelectedPaid}
						disabled={processingBatch === 'selected'}
					>
						{#if processingBatch === 'selected'}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							<CheckCircle2 class="w-4 h-4" />
						{/if}
						Mark as Paid
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="flex justify-center py-8">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if error}
		<div class="alert alert-error">
			<AlertTriangle class="w-5 h-5" />
			<span>{error}</span>
			<button class="btn btn-sm btn-ghost" onclick={loadApprovedEntries}>Retry</button>
		</div>
	{:else if weeklyBatches.length === 0}
		<div class="card bg-base-200">
			<div class="card-body text-center">
				<CheckCircle2 class="w-12 h-12 mx-auto opacity-50" />
				<p class="opacity-70">No approved payments pending processing.</p>
				<p class="text-sm opacity-50">Payments will appear here once they are approved.</p>
			</div>
		</div>
	{:else}
		<!-- Weekly Batches -->
		<div class="space-y-3">
			{#each weeklyBatches as batch, index (batch.label)}
				<div class="card bg-base-100 shadow-sm border {batch.isAging ? 'border-warning' : 'border-base-300'}">
					<!-- Batch Header -->
					<div 
						class="card-body p-4 cursor-pointer"
						onclick={() => toggleBatchExpansion(index)}
						onkeypress={(e) => e.key === 'Enter' && toggleBatchExpansion(index)}
						role="button"
						tabindex="0"
					>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<!-- Expand/Collapse Icon -->
								{#if batch.isExpanded}
									<ChevronDown class="w-5 h-5 opacity-50" />
								{:else}
									<ChevronRight class="w-5 h-5 opacity-50" />
								{/if}

								<!-- Calendar Icon -->
								<div class="p-2 rounded-lg {batch.isAging ? 'bg-warning/20' : 'bg-base-200'}">
									<Calendar class="w-5 h-5 {batch.isAging ? 'text-warning' : 'opacity-70'}" />
								</div>

								<!-- Week Info -->
								<div>
									<div class="flex items-center gap-2">
										<span class="font-semibold">{batch.label}</span>
										{#if batch.isAging}
											<span class="badge badge-warning badge-sm">
												{batch.ageInWeeks} week{batch.ageInWeeks === 1 ? '' : 's'} old
											</span>
										{/if}
									</div>
									<div class="text-sm opacity-60">
										{batch.entries.length} payment{batch.entries.length === 1 ? '' : 's'} • {batch.artistCount} artist{batch.artistCount === 1 ? '' : 's'}
									</div>
								</div>
							</div>

							<!-- Amount and Actions -->
							<div class="flex items-center gap-4">
								<div class="text-right">
									<div class="text-lg font-bold {batch.isAging ? 'text-warning' : 'text-success'}">
										{formatCurrency(batch.totalAmount)}
									</div>
								</div>

								<!-- Quick Actions -->
								<div class="flex gap-1" role="group" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
									<div class="dropdown dropdown-end">
										<button 
											class="btn btn-ghost btn-sm"
											onclick={() => toggleExportMenu(batch.label)}
											title="Export batch"
										>
											<Download class="w-4 h-4" />
										</button>
										{#if showExportMenu === batch.label}
											<ul class="dropdown-content menu bg-base-200 rounded-box w-40 p-2 shadow z-50">
												<li><button onclick={() => handleExportBatch(batch, 'csv')}>
													<FileText class="w-4 h-4" /> CSV
												</button></li>
												<li><button onclick={() => handleExportBatch(batch, 'xlsx')}>
													<FileSpreadsheet class="w-4 h-4" /> Excel
												</button></li>
											</ul>
										{/if}
									</div>
									<button 
										class="btn btn-primary btn-sm"
										onclick={() => handleMarkBatchPaid(batch)}
										disabled={processingBatch === batch.label}
										title="Mark all as paid"
									>
										{#if processingBatch === batch.label}
											<span class="loading loading-spinner loading-xs"></span>
										{:else}
											<CheckCircle2 class="w-4 h-4" />
										{/if}
									</button>
								</div>
							</div>
						</div>
					</div>

					<!-- Expanded Content -->
					{#if batch.isExpanded}
						<div class="border-t border-base-300">
							<!-- Select All -->
							<div class="px-4 py-2 bg-base-200/50 flex items-center justify-between">
								<label class="label cursor-pointer gap-2">
									<input 
										type="checkbox" 
										class="checkbox checkbox-sm checkbox-primary" 
										checked={isBatchFullySelected(batch)}
										onchange={(e) => selectAllInBatch(batch, e.currentTarget.checked)}
									/>
									<span class="label-text text-sm">Select all in this batch</span>
								</label>
							</div>

							<!-- Entries List -->
							<div class="overflow-x-auto">
								<table class="table table-sm">
									<thead>
										<tr>
											<th class="w-10"></th>
											<th>Artist</th>
											<th>Date</th>
											<th>Program</th>
										<th>Facility</th>
											<th class="text-right">Duration</th>
											<th class="text-right">Rate</th>
											<th class="text-right">Amount</th>
										</tr>
									</thead>
									<tbody>
										{#each batch.entries as entry (entry.id)}
											<tr class="hover">
												<td>
													<input 
														type="checkbox" 
														class="checkbox checkbox-sm checkbox-primary"
														checked={entry.id ? isEntrySelected(entry.id) : false}
														onchange={() => entry.id && toggleEntrySelection(entry.id)}
													/>
												</td>
												<td>
													<span class="font-medium">{getArtistName(entry)}</span>
												</td>
												<td class="text-sm opacity-70">
													{new Date(entry.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
												</td>
												<td class="text-sm opacity-70">
													{(entry.programs as any)?.title || '-'}
												</td>
												<td class="text-sm opacity-70">
													{(entry.facilities as any)?.name || '-'}
												</td>
												<td class="text-right text-sm">{entry.hours || '-'}</td>
												<td class="text-right text-sm">{entry.rate ? formatCurrency(entry.rate) : '-'}</td>
												<td class="text-right font-medium">{formatCurrency(entry.total_pay || 0)}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
