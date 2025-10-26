<script lang="ts">
	import { onMount } from 'svelte'
	import { getArtistPerformanceHistory, getArtistPerformanceStats, type PerformanceRecord, type ArtistPerformanceStats } from '$lib/utils/performanceHistory'

	interface Props {
		artistId: string
		limit?: number
		showStats?: boolean
	}

	let { artistId, limit, showStats = true }: Props = $props()

	let performances = $state<PerformanceRecord[]>([])
	let stats = $state<ArtistPerformanceStats | null>(null)
	let isLoading = $state(true)
	let error = $state<string | null>(null)

	onMount(async () => {
		await loadPerformanceData()
	})

	async function loadPerformanceData() {
		isLoading = true
		error = null

		try {
			const [performanceData, statsData] = await Promise.all([
				getArtistPerformanceHistory(artistId, limit),
				showStats ? getArtistPerformanceStats(artistId) : Promise.resolve(null)
			])

			performances = performanceData
			stats = statsData
		} catch (err: any) {
			error = err.message || 'Failed to load performance history'
			console.error('Error loading performance history:', err)
		} finally {
			isLoading = false
		}
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString)
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		})
	}

	function getStatusBadgeClass(status: string): string {
		const statusMap: Record<string, string> = {
			completed: 'badge-success',
			confirmed: 'badge-info',
			planned: 'badge-warning',
			cancelled: 'badge-error',
			in_progress: 'badge-primary'
		}
		return statusMap[status] || 'badge-ghost'
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount)
	}
</script>

<div class="space-y-4">
	{#if showStats && stats}
		<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Total Events</div>
				<div class="stat-value text-2xl">{stats.total_events}</div>
			</div>

			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Completed</div>
				<div class="stat-value text-2xl text-success">{stats.completed_events}</div>
			</div>

			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Total Hours</div>
				<div class="stat-value text-2xl">{stats.total_hours.toFixed(1)}</div>
			</div>

			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Total Earned</div>
				<div class="stat-value text-2xl">{formatCurrency(stats.total_compensation)}</div>
			</div>
		</div>
	{/if}

	<div class="space-y-2">
		<h3 class="text-lg font-semibold border-b pb-2">Performance History</h3>

		{#if isLoading}
			<div class="flex justify-center items-center py-12">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{:else if error}
			<div class="alert alert-error">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{error}</span>
			</div>
		{:else if performances.length === 0}
			<div class="alert alert-info">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>No performance history found for this artist.</span>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="table table-zebra w-full">
					<thead>
						<tr>
							<th>Date</th>
							<th>Event</th>
							<th>Venue/Location</th>
							<th>Program</th>
							<th>Status</th>
							<th class="text-right">Hours</th>
							<th class="text-right">Compensation</th>
						</tr>
					</thead>
					<tbody>
						{#each performances as performance}
							<tr class="hover">
								<td class="whitespace-nowrap">
									{formatDate(performance.event_date)}
								</td>
								<td>
									<a href="/events/{performance.event_id}" class="link link-hover font-medium">
										{performance.event_title}
									</a>
									{#if performance.event_type}
										<div class="text-xs opacity-70">{performance.event_type}</div>
									{/if}
								</td>
								<td>
									{#if performance.location_name}
										<div>{performance.location_name}</div>
										{#if performance.venue_name}
											<div class="text-xs opacity-70">{performance.venue_name}</div>
										{/if}
									{:else if performance.venue_name}
										{performance.venue_name}
									{:else}
										<span class="opacity-50">Not specified</span>
									{/if}
								</td>
								<td>
									{#if performance.program_name}
										{performance.program_name}
									{:else}
										<span class="opacity-50">—</span>
									{/if}
								</td>
								<td>
									<span class="badge badge-sm {getStatusBadgeClass(performance.status)}">
										{performance.status}
									</span>
								</td>
								<td class="text-right">
									{#if performance.hours}
										{performance.hours}h
									{:else}
										<span class="opacity-50">—</span>
									{/if}
								</td>
								<td class="text-right font-medium">
									{#if performance.compensation}
										{formatCurrency(performance.compensation)}
									{:else}
										<span class="opacity-50">—</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
