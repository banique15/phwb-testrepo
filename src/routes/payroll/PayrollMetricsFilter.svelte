<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { artistsStore } from '$lib/stores/artists'
	import { onMount } from 'svelte'
	import type { Artist } from '$lib/schemas/artist'

	const dispatch = createEventDispatcher<{
		filterChange: {
			dateRange: string
			paymentType: string
			artistId: string
		}
	}>()

	interface Props {
		dateRange?: string
		paymentType?: string
		artistId?: string
	}

	let { dateRange = 'all', paymentType = 'all', artistId = 'all' }: Props = $props()

	// State
	let artists = $state<Artist[]>([])
	let loading = $state(true)

	// Date range options
	const dateRangeOptions = [
		{ value: 'all', label: 'All Time' },
		{ value: 'last30', label: 'Last 30 Days' },
		{ value: 'last90', label: 'Last 90 Days' },
		{ value: 'mtd', label: 'Month to Date' },
		{ value: 'ytd', label: 'Year to Date' }
	]

	// Payment type options (based on actual database values)
	const paymentTypeOptions = [
		{ value: 'all', label: 'All Types' },
		{ value: 'performance', label: 'Performance' },
		{ value: 'special_event', label: 'Special Event' },
		{ value: 'training', label: 'Training' },
		{ value: 'other', label: 'Other' }
	]

	// Load artists on mount
	onMount(async () => {
		try {
			await artistsStore.fetchAll()
			const state = artistsStore.getState()
			artists = state.items
		} catch (error) {
			console.error('Failed to load artists:', error)
		} finally {
			loading = false
		}
	})

	// Watch for changes and dispatch events
	$effect(() => {
		dispatch('filterChange', {
			dateRange,
			paymentType,
			artistId
		})
	})

	function handleDateRangeChange(e: Event) {
		const target = e.target as HTMLSelectElement
		dateRange = target.value
	}

	function handlePaymentTypeChange(e: Event) {
		const target = e.target as HTMLSelectElement
		paymentType = target.value
	}

	function handleArtistChange(e: Event) {
		const target = e.target as HTMLSelectElement
		artistId = target.value
	}
</script>

<div class="bg-base-100 p-4 rounded-lg border border-base-300">
	<div class="flex items-center justify-between mb-4">
		<h3 class="text-lg font-semibold">Metrics Filters</h3>
		<div class="text-sm text-base-content/60">
			Filter values shown in cards above
		</div>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<!-- Date Range Filter -->
		<div class="form-control">
			<label class="label">
				<span class="label-text font-medium">Date Range</span>
			</label>
			<select 
				class="select select-bordered select-sm"
				value={dateRange}
				onchange={handleDateRangeChange}
			>
				{#each dateRangeOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>

		<!-- Payment Type Filter -->
		<div class="form-control">
			<label class="label">
				<span class="label-text font-medium">Payment Type</span>
			</label>
			<select 
				class="select select-bordered select-sm"
				value={paymentType}
				onchange={handlePaymentTypeChange}
			>
				{#each paymentTypeOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>

		<!-- Artist Filter -->
		<div class="form-control">
			<label class="label">
				<span class="label-text font-medium">Artist</span>
			</label>
			<select 
				class="select select-bordered select-sm"
				value={artistId}
				onchange={handleArtistChange}
				disabled={loading}
			>
				<option value="all">All Artists</option>
				{#each artists as artist}
					<option value={artist.id}>
						{artist.full_name || artist.legal_first_name || 'Unknown Artist'}
					</option>
				{/each}
			</select>
		</div>
	</div>
</div>