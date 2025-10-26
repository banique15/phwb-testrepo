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
		close: void
	}>()

	interface Props {
		open?: boolean
		dateRange?: string
		paymentType?: string
		artistId?: string
	}

	let { open = false, dateRange = 'all', paymentType = 'all', artistId = 'all' }: Props = $props()

	// Local state for the modal
	let localDateRange = $state(dateRange)
	let localPaymentType = $state(paymentType)
	let localArtistId = $state(artistId)

	// Component state
	let artists = $state<Artist[]>([])
	let loading = $state(true)
	let modalElement: HTMLDialogElement

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
			const result = await artistsStore.fetchAll()
			artists = result.data
		} catch (error) {
			console.error('Failed to load artists:', error)
		} finally {
			loading = false
		}
	})

	// Watch for open prop changes to control modal
	$effect(() => {
		if (modalElement) {
			if (open) {
				// Reset local state to current values when opening
				localDateRange = dateRange
				localPaymentType = paymentType
				localArtistId = artistId
				modalElement.showModal()
			} else {
				modalElement.close()
			}
		}
	})

	function handleClose() {
		dispatch('close')
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === modalElement) {
			handleClose()
		}
	}

	function handleApply() {
		dispatch('filterChange', {
			dateRange: localDateRange,
			paymentType: localPaymentType,
			artistId: localArtistId
		})
		handleClose()
	}

	function handleReset() {
		localDateRange = 'all'
		localPaymentType = 'all'
		localArtistId = 'all'
		dispatch('filterChange', {
			dateRange: 'all',
			paymentType: 'all',
			artistId: 'all'
		})
		handleClose()
	}

	// Check if any filters are active
	let hasActiveFilters = $derived(
		dateRange !== 'all' || paymentType !== 'all' || artistId !== 'all'
	)
</script>

<dialog
	bind:this={modalElement}
	class="modal"
	onclick={handleBackdropClick}
>
	<div class="modal-box">
		<div class="flex items-center justify-between mb-6">
			<h3 class="font-bold text-lg">Filter Metrics</h3>
			<button
				class="btn btn-sm btn-circle btn-ghost"
				onclick={handleClose}
			>
				✕
			</button>
		</div>

		<div class="space-y-4">
			<!-- Date Range Filter -->
			<div class="form-control">
				<label class="label">
					<span class="label-text font-medium">Date Range</span>
				</label>
				<select 
					class="select select-bordered"
					bind:value={localDateRange}
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
					class="select select-bordered"
					bind:value={localPaymentType}
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
					class="select select-bordered"
					bind:value={localArtistId}
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

		<!-- Modal Actions -->
		<div class="modal-action">
			<button class="btn btn-outline" onclick={handleReset}>
				Reset All
			</button>
			<button class="btn btn-outline" onclick={handleClose}>
				Cancel
			</button>
			<button class="btn btn-primary" onclick={handleApply}>
				Apply Filters
			</button>
		</div>
	</div>

	<!-- Backdrop -->
	<form method="dialog" class="modal-backdrop">
		<button onclick={handleClose}>close</button>
	</form>
</dialog>