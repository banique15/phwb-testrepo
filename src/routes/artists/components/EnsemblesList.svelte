<script lang="ts">
	import { Search } from 'lucide-svelte'
	import { createEventDispatcher, onMount } from 'svelte'
	import { ensemblesStore } from '$lib/stores/ensembles'
	import type { Ensemble } from '$lib/schemas/ensemble'

	interface Props {
		selectedItem: Ensemble | null
		loading?: boolean
		searchQuery?: string
		filters?: {
			type: string
			status: string
		}
	}

	let {
		selectedItem,
		loading = false,
		searchQuery = $bindable(''),
		filters = $bindable({
			type: 'all',
			status: 'active'
		})
	}: Props = $props()

	const dispatch = createEventDispatcher()

	let ensembles = $state<Ensemble[]>([])
	let isLoading = $state(true)

	onMount(async () => {
		await loadEnsembles()
	})

	async function loadEnsembles() {
		isLoading = true
		try {
			const result = await ensemblesStore.fetchAll()
			ensembles = (result.data as Ensemble[]) || []
			console.log('Loaded ensembles:', ensembles.length)
		} catch (error) {
			console.error('Failed to load ensembles:', error)
		} finally {
			isLoading = false
		}
	}

	// Filter items based on search and filters
	let filteredItems = $derived.by(() => {
		let result = [...ensembles]

		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase()
			result = result.filter(ensemble =>
				ensemble.name?.toLowerCase().includes(query) ||
				ensemble.description?.toLowerCase().includes(query) ||
				ensemble.ensemble_type?.toLowerCase().includes(query)
			)
		}

		// Type filter
		if (filters.type !== 'all') {
			result = result.filter(ensemble => ensemble.ensemble_type === filters.type)
		}

		// Status filter
		if (filters.status !== 'all') {
			result = result.filter(ensemble => ensemble.status === filters.status)
		}

		return result
	})

	function selectEnsemble(ensemble: Ensemble) {
		dispatch('select', { item: ensemble })
	}

	function clearFilters() {
		searchQuery = ''
		filters = {
			type: 'all',
			status: 'active'
		}
	}

	let hasActiveFilters = $derived(
		searchQuery.trim() !== '' ||
		filters.type !== 'all' ||
		filters.status !== 'active'
	)
</script>

<div class="flex flex-col h-full bg-base-200/30">
	<!-- Search and Filter Bar -->
	<div class="p-4 lg:p-6 border-b border-base-300 bg-base-100 space-y-3">
		<div class="flex gap-3">
			<div class="flex-1 relative">
				<input
					type="text"
					placeholder="Search ensembles by name or type..."
					class="input input-bordered w-full pr-10"
					bind:value={searchQuery}
				/>
				{#if searchQuery}
					<button
						class="absolute right-3 top-1/2 -translate-y-1/2 btn btn-ghost btn-sm btn-circle"
						onclick={() => searchQuery = ''}
						aria-label="Clear search"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				{/if}
			</div>
		</div>

		<div class="flex gap-3">
			<select class="select select-bordered flex-1" bind:value={filters.status}>
				<option value="all">All statuses</option>
				<option value="active">Active</option>
				<option value="inactive">Inactive</option>
				<option value="archived">Archived</option>
			</select>

			{#if hasActiveFilters}
				<button class="btn btn-outline" onclick={clearFilters}>Clear filters</button>
			{/if}
		</div>
	</div>

	<!-- Results Count -->
	<div class="px-4 lg:px-6 py-3 text-sm text-base-content/70 border-b border-base-300 bg-base-100">
		<span class="font-semibold">{filteredItems.length}</span> {filteredItems.length === 1 ? 'ensemble' : 'ensembles'}
		{#if hasActiveFilters}
			<span class="opacity-60 ml-1">(filtered from {ensembles.length})</span>
		{/if}
	</div>

	<!-- Ensembles Grid -->
	<div class="flex-1 overflow-y-auto p-4 lg:p-6">
		{#if isLoading || loading}
			<div class="flex items-center justify-center p-12">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{:else if filteredItems.length === 0}
			<div class="text-center p-12">
				<Search class="w-16 h-16 mx-auto mb-4 text-base-content/70" />
				<p class="text-lg font-medium text-base-content/90 mb-2">No ensembles found</p>
				<p class="text-sm text-base-content/60 mb-4">Try adjusting your search or filters</p>
				{#if hasActiveFilters}
					<button class="btn btn-primary btn-sm" onclick={clearFilters}>Clear all filters</button>
				{/if}
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-6">
				{#each filteredItems as ensemble (ensemble.id)}
					<button
						class="card bg-gradient-to-br from-base-100 to-base-200 shadow-depth-1 border border-base-300 transition-all duration-300 hover:scale-105 cursor-pointer group text-left"
						onclick={() => selectEnsemble(ensemble)}
					>
						<div class="card-body p-4 lg:p-5">
							<!-- Ensemble Name & Icon -->
							<div class="flex items-start justify-between mb-3">
								<div class="flex-1 min-w-0">
									<h3 class="font-bold text-base lg:text-lg text-base-content truncate group-hover:text-secondary transition-colors">
										{ensemble.name}
									</h3>
									{#if ensemble.ensemble_type}
										<p class="text-xs text-base-content/60 truncate mt-0.5">
											{ensemble.ensemble_type}
										</p>
									{/if}
								</div>
								<div class="text-secondary/20 group-hover:text-secondary/40 transition-colors ml-2 flex-shrink-0">
									<svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
										<path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
									</svg>
								</div>
							</div>

							<!-- Description -->
							{#if ensemble.description}
								<div class="mb-3">
									<p class="text-xs text-base-content/70 line-clamp-2">
										{ensemble.description}
									</p>
								</div>
							{/if}

							<!-- Status Badge -->
							<div class="flex items-center gap-2 mt-auto">
								<span
									class="badge badge-sm"
									class:badge-success={ensemble.status === 'active'}
									class:badge-warning={ensemble.status === 'inactive'}
									class:badge-ghost={ensemble.status === 'archived'}
								>
									{ensemble.status || 'unknown'}
								</span>
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
