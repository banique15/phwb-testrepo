<script lang="ts">
	import { onMount } from 'svelte'
	import { Theater } from 'lucide-svelte'
	import { ensemblesStore } from '$lib/stores/ensembles'
	import type { Ensemble } from '$lib/schemas/ensemble'
	import type { PageData } from './$types'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import MasterDetail from '$lib/components/ui/MasterDetail.svelte'
	import EnsembleDetailView from './components/EnsembleDetailView.svelte'
	import CreateEnsemble from './components/modals/CreateEnsemble.svelte'
	import DeleteEnsemble from './components/modals/DeleteEnsemble.svelte'

	interface Props {
		data: PageData
	}

	let { data }: Props = $props()

	let selectedEnsemble = $state<Ensemble | null>(null)
	let clientLoading = $state(false)
	let isCreateEnsembleModalOpen = $state(false)
	let isDeleteEnsembleModalOpen = $state(false)

	// Search state
	let searchQuery = $state('')

	// Ensemble filter state
	let ensembleFilters = $state({
		status: 'all' as string
	})

	// Use derived state to avoid infinite loops
	let ensembles = $derived(data.ensembles)

	// Filter ensembles based on search and filters
	let filteredEnsembles = $derived.by(() => {
		let result = [...ensembles]

		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase()
			result = result.filter(ensemble =>
				ensemble.name?.toLowerCase().includes(query) ||
				ensemble.ensemble_type?.toLowerCase().includes(query) ||
				ensemble.description?.toLowerCase().includes(query)
			)
		}

		// Status filter
		if (ensembleFilters.status !== 'all') {
			result = result.filter(ensemble => ensemble.status === ensembleFilters.status)
		}

		return result
	})

	// Keep selected ensemble in sync with updated data
	$effect(() => {
		if (selectedEnsemble?.id && ensembles.length > 0) {
			const ensembleId = selectedEnsemble.id
			const updatedEnsemble = ensembles.find(e => e.id === ensembleId)
			if (updatedEnsemble && updatedEnsemble !== selectedEnsemble) {
				selectedEnsemble = updatedEnsemble
			}
		}
	})

	// Check if filters are active
	let hasActiveEnsembleFilters = $derived(
		ensembleFilters.status !== 'all'
	)

	onMount(() => {
		// Check for ID in URL query params first (e.g., from artist profile link)
		const urlParams = new URLSearchParams(window.location.search)
		const urlEnsembleId = urlParams.get('id')

		if (urlEnsembleId && ensembles.length > 0) {
			const ensembleFromUrl = ensembles.find(e => String(e.id) === urlEnsembleId)
			if (ensembleFromUrl) {
				selectedEnsemble = ensembleFromUrl
				// Save to localStorage for consistency
				localStorage.setItem('phwb-selected-ensemble', urlEnsembleId)
			}
		} else {
			// Restore selected ensemble from localStorage if no URL param
			const ensembleStorageKey = 'phwb-selected-ensemble'
			const savedEnsembleId = localStorage.getItem(ensembleStorageKey)
			if (savedEnsembleId && ensembles.length > 0) {
				const savedEnsemble = ensembles.find(e => String(e.id) === savedEnsembleId)
				if (savedEnsemble) {
					selectedEnsemble = savedEnsemble
				}
			}
		}

		// Subscribe to real-time changes
		ensemblesStore.subscribeToChanges()

		return () => {
			ensemblesStore.unsubscribeFromChanges()
		}
	})

	async function reloadEnsembles() {
		try {
			const result = await ensemblesStore.fetchAll()
			// Update the data by navigating to refresh
			// The store will update automatically via real-time subscription
		} catch (error) {
			console.error('Failed to reload ensembles:', error)
		}
	}

	function handleSelectEnsemble(event: CustomEvent<{ item: Ensemble }>) {
		selectedEnsemble = event.detail.item
	}

	function handleSearch(event: CustomEvent<{ value: string }>) {
		searchQuery = event.detail.value
	}

	function openCreateModal() {
		isCreateEnsembleModalOpen = true
	}

	function closeCreateModal() {
		isCreateEnsembleModalOpen = false
	}

	function handleEnsembleCreated(event: CustomEvent<{ ensemble: any }>) {
		selectedEnsemble = event.detail.ensemble
		isCreateEnsembleModalOpen = false
		reloadEnsembles()
		console.log('Ensemble created successfully:', event.detail.ensemble.name)
	}

	function handleDeleteEnsemble() {
		selectedEnsemble = null
		isDeleteEnsembleModalOpen = false
		reloadEnsembles()
	}

	function openDeleteEnsemble() {
		if (selectedEnsemble) {
			isDeleteEnsembleModalOpen = true
		}
	}

	// MasterDetail configuration functions for Ensembles
	function getEnsembleTitle(item: any): string {
		return item.name || 'Unnamed Ensemble'
	}

	function getEnsembleSubtitle(item: any): string {
		return item.ensemble_type || ''
	}

	function getEnsembleDetail(item: any): string {
		return item.status || 'active'
	}
</script>

<ErrorBoundary>
	<div class="h-full flex flex-col overflow-hidden">
		<!-- Scrollable Content Area -->
		<div class="flex-1 min-h-0 flex flex-col">
			<div class="flex-1 min-h-0">
				<MasterDetail
					items={filteredEnsembles as any}
					selectedItem={selectedEnsemble as any}
					loading={clientLoading}
					searchPlaceholder="Search ensembles..."
					searchValue={searchQuery}
					masterTitle="Ensembles"
					getItemTitle={getEnsembleTitle}
					getItemSubtitle={getEnsembleSubtitle}
					getItemDetail={getEnsembleDetail}
					detailEmptyIcon={Theater}
					detailEmptyTitle="Select an ensemble"
					detailEmptyMessage="Choose an ensemble from the list to view details and members"
					storageKey="phwb-selected-ensemble"
					on:search={handleSearch}
					on:select={handleSelectEnsemble}
				>
					{#snippet filters()}
						<div class="dropdown dropdown-end">
							<button tabindex="0" class="btn btn-sm btn-outline" class:btn-active={hasActiveEnsembleFilters}>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
								</svg>
								Filters
								{#if hasActiveEnsembleFilters}
									<span class="badge badge-sm badge-primary">•</span>
								{/if}
							</button>
							<div tabindex="0" class="dropdown-content z-[1] card card-compact w-64 p-4 shadow bg-base-100 border border-base-300 mt-2">
								<div class="space-y-3">
									<div class="flex items-center justify-between">
										<h3 class="font-semibold text-sm">Filter Ensembles</h3>
										{#if hasActiveEnsembleFilters}
											<button
												class="btn btn-ghost btn-xs"
												onclick={() => {
													ensembleFilters = {
														status: 'all'
													}
												}}
											>
												Clear all
											</button>
										{/if}
									</div>

									<div class="divider my-1"></div>

									<div class="form-control">
										<label class="label">
											<span class="label-text text-sm font-medium">Status</span>
										</label>
										<select class="select select-sm select-bordered w-full" bind:value={ensembleFilters.status}>
											<option value="all">All statuses</option>
											<option value="active">Active</option>
											<option value="inactive">Inactive</option>
											<option value="archived">Archived</option>
										</select>
									</div>
								</div>
							</div>
						</div>
					{/snippet}

					{#snippet masterActions()}
						<button
							class="btn btn-primary btn-xs"
							onclick={openCreateModal}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-3 w-3 mr-1"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 4v16m8-8H4"
								/>
							</svg>
							Add
						</button>
					{/snippet}

					{#snippet children(props)}
						{@const ensemble = props.item as Ensemble}
						{#if ensemble}
							<EnsembleDetailView
								ensemble={ensemble}
								on:delete={openDeleteEnsemble}
							/>
						{/if}
					{/snippet}
				</MasterDetail>
			</div>
		</div>
	</div>

	<!-- Create Ensemble Modal -->
	<CreateEnsemble
		open={isCreateEnsembleModalOpen}
		on:close={() => isCreateEnsembleModalOpen = false}
		on:success={handleEnsembleCreated}
	/>

	<!-- Delete Ensemble Modal -->
	<DeleteEnsemble
		open={isDeleteEnsembleModalOpen}
		ensemble={selectedEnsemble}
		onClose={() => isDeleteEnsembleModalOpen = false}
		onSuccess={handleDeleteEnsemble}
	/>
</ErrorBoundary>

