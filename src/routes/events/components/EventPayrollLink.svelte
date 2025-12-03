<script lang="ts">
	import { onMount } from 'svelte'
	import { DollarSign, ExternalLink, AlertCircle, CheckCircle } from 'lucide-svelte'
	import { supabase } from '$lib/supabase'

	interface Props {
		eventId: number
	}

	let { eventId }: Props = $props()

	let loading = $state(true)
	let error = $state('')
	let linkedPayroll = $state<any[]>([])
	let summary = $state({
		totalRecords: 0,
		totalPay: 0,
		totalHours: 0,
		artistCount: 0
	})

	onMount(() => {
		loadLinkedPayroll()
	})

	async function loadLinkedPayroll() {
		loading = true
		error = ''

		try {
			// Query payroll linked to this event via event_id or source_event_id
			const { data, error: queryError } = await supabase
				.from('phwb_payroll')
				.select(`
					*,
					artists:artist_id(id, full_name, email)
				`)
				.or(`event_id.eq.${eventId},source_event_id.eq.${eventId}`)
				.order('event_date', { ascending: false })

			if (queryError) throw queryError

			linkedPayroll = data || []

			// Calculate summary
			const artists = new Set<string>()
			let totalPay = 0
			let totalHours = 0

			linkedPayroll.forEach(p => {
				if (p.artist_id) artists.add(p.artist_id)
				totalPay += p.total_pay || (p.hours || 0) * (p.rate || 0) + (p.additional_pay || 0)
				totalHours += p.hours || 0
			})

			summary = {
				totalRecords: linkedPayroll.length,
				totalPay,
				totalHours,
				artistCount: artists.size
			}

		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load payroll data'
			console.error('Error loading linked payroll:', err)
		} finally {
			loading = false
		}
	}

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount)
	}

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})
	}

	function getStatusBadgeClass(status: string) {
		const classes: Record<string, string> = {
			'Planned': 'badge-warning',
			'Approved': 'badge-info',
			'Paid': 'badge-success',
			'Completed': 'badge-success',
			'Cancelled': 'badge-error'
		}
		return classes[status] || 'badge-ghost'
	}
</script>

<div class="space-y-4">
	{#if loading}
		<div class="text-center py-8">
			<span class="loading loading-spinner loading-lg"></span>
			<p class="mt-2 text-sm opacity-60">Loading payroll data...</p>
		</div>
	{:else if error}
		<div class="alert alert-error">
			<AlertCircle class="w-5 h-5" />
			<span>{error}</span>
		</div>
	{:else if linkedPayroll.length === 0}
		<div class="text-center py-8 border-2 border-dashed border-base-300 rounded-lg bg-base-50">
			<DollarSign class="w-12 h-12 mx-auto mb-3 text-base-content/40" />
			<p class="text-base opacity-70 mb-2">No payroll records linked to this event</p>
			<p class="text-sm opacity-50">Payroll entries are created when events are completed or manually linked</p>
		</div>
	{:else}
		<!-- Summary Stats -->
		<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
			<div class="stat bg-base-200 rounded-lg p-3">
				<div class="stat-title text-xs">Records</div>
				<div class="stat-value text-lg">{summary.totalRecords}</div>
			</div>
			<div class="stat bg-base-200 rounded-lg p-3">
				<div class="stat-title text-xs">Total Pay</div>
				<div class="stat-value text-lg">{formatCurrency(summary.totalPay)}</div>
			</div>
			<div class="stat bg-base-200 rounded-lg p-3">
				<div class="stat-title text-xs">Total Hours</div>
				<div class="stat-value text-lg">{summary.totalHours.toFixed(1)}</div>
			</div>
			<div class="stat bg-base-200 rounded-lg p-3">
				<div class="stat-title text-xs">Artists</div>
				<div class="stat-value text-lg">{summary.artistCount}</div>
			</div>
		</div>

		<!-- Payroll Records Table -->
		<div class="overflow-x-auto">
			<table class="table table-sm table-zebra">
				<thead>
					<tr>
						<th>Artist</th>
						<th>Date</th>
						<th>Hours</th>
						<th>Pay</th>
						<th>Status</th>
						<th>Source</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each linkedPayroll as record}
						<tr>
							<td>
								<div class="font-medium">{record.artists?.full_name || 'Unknown'}</div>
								{#if record.artists?.email}
									<div class="text-xs opacity-60">{record.artists.email}</div>
								{/if}
							</td>
							<td class="font-mono text-sm">{formatDate(record.event_date)}</td>
							<td class="font-mono">{record.hours?.toFixed(1) || '0.0'}</td>
							<td class="font-mono font-medium">
								{formatCurrency(record.total_pay || (record.hours || 0) * (record.rate || 0) + (record.additional_pay || 0))}
							</td>
							<td>
								<span class="badge badge-sm {getStatusBadgeClass(record.status)}">{record.status}</span>
							</td>
							<td>
								{#if record.creation_method === 'event-automation'}
									<span class="badge badge-ghost badge-sm">
										<CheckCircle class="w-3 h-3 mr-1" />
										Auto
									</span>
								{:else}
									<span class="badge badge-outline badge-sm">Manual</span>
								{/if}
							</td>
							<td>
								<a href="/payroll?id={record.id}" class="btn btn-ghost btn-xs">
									<ExternalLink class="w-3 h-3" />
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Link to Payroll Page -->
		<div class="flex justify-end">
			<a href="/payroll?event_id={eventId}" class="btn btn-outline btn-sm">
				<DollarSign class="w-4 h-4 mr-1" />
				View in Payroll
			</a>
		</div>
	{/if}
</div>
