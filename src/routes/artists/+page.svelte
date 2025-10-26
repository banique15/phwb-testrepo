<script lang="ts">
	import { onMount } from 'svelte'
	import { artistsStore } from '$lib/stores/artists'
	import { ensemblesStore } from '$lib/stores/ensembles'
	import type { Artist } from '$lib/schemas/artist'
	import type { Ensemble } from '$lib/schemas/ensemble'
	import type { PageData } from './$types'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import PageHeader from '$lib/components/ui/PageHeader.svelte'
	import MasterDetail from '$lib/components/ui/MasterDetail.svelte'
	import ArtistDetailView from './components/ArtistDetailView.svelte'
	import EnsembleDetailView from './components/EnsembleDetailView.svelte'
	import CreateArtist from './components/modals/CreateArtist.svelte'
	import CreateEnsemble from './components/modals/CreateEnsemble.svelte'
	import DeleteArtist from './components/modals/DeleteArtist.svelte'
	import DeleteEnsemble from './components/modals/DeleteEnsemble.svelte'

	interface Props {
		data: PageData
	}

	let { data }: Props = $props()

	// Tab state - restore from localStorage or default to 'artists'
	let activeTab = $state<'artists' | 'ensembles'>(
		(typeof window !== 'undefined' ? localStorage.getItem('phwb-active-artists-tab') as 'artists' | 'ensembles' : null) || 'artists'
	)

	// Separate selection states
	let selectedArtist = $state<Artist | null>(null)
	let selectedEnsemble = $state<Ensemble | null>(null)
	let clientLoading = $state(false)
	let ensembles = $state<Ensemble[]>([])

	// Modal state
	let isCreateArtistModalOpen = $state(false)
	let isCreateEnsembleModalOpen = $state(false)
	let isDeleteArtistModalOpen = $state(false)
	let isDeleteEnsembleModalOpen = $state(false)

	// Search state
	let searchQuery = $state('')

	// Artist filter state
	let artistFilters = $state({
		genres: [] as string[],
		instruments: [] as string[],
		canBeSoloist: null as boolean | null,
		sightReads: null as boolean | null,
		hideIncomplete: false as boolean
	})

	// Ensemble filter state
	let ensembleFilters = $state({
		status: 'all' as string
	})

	// Use derived state to avoid infinite loops
	let artists = $derived(data.artists)

	// Filter artists based on search and filters
	let filteredArtists = $derived.by(() => {
		let result = [...artists]

		// Hide incomplete contacts filter
		if (artistFilters.hideIncomplete) {
			result = result.filter(artist => {
				const hasPlaceholderEmail =
					!artist.email ||
					artist.email.includes('@placeholder.local') ||
					artist.email.includes('@example.com') ||
					artist.email.includes('test@')

				const hasValidPhone =
					artist.phone &&
					artist.phone !== '000-000-0000' &&
					artist.phone.trim() !== ''

				return !hasPlaceholderEmail && hasValidPhone
			})
		}

		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase()
			result = result.filter(artist =>
				artist.full_name?.toLowerCase().includes(query) ||
				artist.artist_name?.toLowerCase().includes(query) ||
				artist.email?.toLowerCase().includes(query) ||
				artist.location?.toLowerCase().includes(query)
			)
		}

		// Genres filter
		if (artistFilters.genres.length > 0) {
			result = result.filter(artist =>
				artist.genres && artistFilters.genres.some(g => artist.genres.includes(g))
			)
		}

		// Instruments filter
		if (artistFilters.instruments.length > 0) {
			result = result.filter(artist =>
				artist.instruments && artistFilters.instruments.some(i => artist.instruments.includes(i))
			)
		}

		// Can be soloist filter
		if (artistFilters.canBeSoloist !== null) {
			result = result.filter(artist => artist.can_be_soloist === artistFilters.canBeSoloist)
		}

		// Sight reads filter
		if (artistFilters.sightReads !== null) {
			result = result.filter(artist => artist.sightreads === artistFilters.sightReads)
		}

		return result
	})

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

	// Check if filters are active
	let hasActiveArtistFilters = $derived(
		artistFilters.genres.length > 0 ||
		artistFilters.instruments.length > 0 ||
		artistFilters.canBeSoloist !== null ||
		artistFilters.sightReads !== null ||
		artistFilters.hideIncomplete
	)

	let hasActiveEnsembleFilters = $derived(
		ensembleFilters.status !== 'all'
	)

	// Persist active tab to localStorage whenever it changes
	$effect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('phwb-active-artists-tab', activeTab)
		}
	})

	onMount(() => {
		// Restore selected artist from localStorage on initial client-side mount
		const artistStorageKey = 'phwb-selected-artist'
		const savedArtistId = localStorage.getItem(artistStorageKey)
		if (savedArtistId && data.artists.length > 0) {
			const savedArtist = data.artists.find(artist => String(artist.id) === savedArtistId)
			if (savedArtist) {
				selectedArtist = savedArtist
			}
		}

		// Load ensembles and restore selection
		loadEnsembles().then(() => {
			const ensembleStorageKey = 'phwb-selected-ensemble'
			const savedEnsembleId = localStorage.getItem(ensembleStorageKey)
			if (savedEnsembleId && ensembles.length > 0) {
				const savedEnsemble = ensembles.find(e => String(e.id) === savedEnsembleId)
				if (savedEnsemble) {
					selectedEnsemble = savedEnsemble
				}
			}
		})

		// Subscribe to real-time changes
		artistsStore.subscribeToChanges()
		ensemblesStore.subscribeToChanges()

		return () => {
			artistsStore.unsubscribeFromChanges()
			ensemblesStore.unsubscribeFromChanges()
		}
	})

	async function loadEnsembles() {
		try {
			const result = await ensemblesStore.fetchAll()
			ensembles = (result.data as Ensemble[]) || []
		} catch (error) {
			console.error('Failed to load ensembles:', error)
		}
	}

	function handleSelectArtist(event: CustomEvent<{ item: Artist }>) {
		selectedArtist = event.detail.item
	}

	function handleSelectEnsemble(event: CustomEvent<{ item: Ensemble }>) {
		selectedEnsemble = event.detail.item
	}

	function handleSearch(event: CustomEvent<{ value: string }>) {
		searchQuery = event.detail.value
	}

	function openCreateModal() {
		if (activeTab === 'artists') {
			isCreateArtistModalOpen = true
		} else {
			isCreateEnsembleModalOpen = true
		}
	}

	function handleArtistCreated(event: CustomEvent<{ artist: any }>) {
		selectedArtist = event.detail.artist
		isCreateArtistModalOpen = false
		console.log('Artist created successfully:', event.detail.artist.full_name)
	}

	function handleEnsembleCreated(event: CustomEvent<{ ensemble: any }>) {
		selectedEnsemble = event.detail.ensemble
		isCreateEnsembleModalOpen = false
		loadEnsembles()
		console.log('Ensemble created successfully:', event.detail.ensemble.name)
	}

	function handleDeleteArtist() {
		selectedArtist = null
		isDeleteArtistModalOpen = false
	}

	function handleDeleteEnsemble() {
		selectedEnsemble = null
		isDeleteEnsembleModalOpen = false
		loadEnsembles()
	}

	function openDeleteArtist() {
		if (selectedArtist) {
			isDeleteArtistModalOpen = true
		}
	}

	function openDeleteEnsemble() {
		if (selectedEnsemble) {
			isDeleteEnsembleModalOpen = true
		}
	}

	// MasterDetail configuration functions for Artists
	function getArtistTitle(item: any): string {
		return item.full_name ||
			   (item.legal_first_name && item.legal_last_name
				? `${item.legal_first_name} ${item.legal_last_name}`
				: item.legal_first_name) ||
			   item.artist_name ||
			   'No name'
	}

	function getArtistSubtitle(item: any): string {
		return item.artist_name || item.email || ''
	}

	function getArtistDetail(item: any): string {
		const details = []
		if (item.location) details.push(item.location)
		if (item.instruments && item.instruments.length > 0) {
			details.push(item.instruments[0])
		}
		return details.join(' • ')
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
	<div class="flex flex-col h-full">
		<!-- Fixed Page Header -->
		<div class="sticky top-0 z-30 flex-none bg-base-100 border-b border-base-200 shadow-sm">
			<div class="px-4 py-2">
				<PageHeader
					title="Artists & Ensembles"
					subtitle="Manage individual artists and musical ensembles"
				>
					{#snippet actions()}
						<button class="btn btn-primary btn-sm" onclick={openCreateModal}>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
							</svg>
							{activeTab === 'artists' ? 'Add Artist' : 'Add Ensemble'}
						</button>
					{/snippet}
				</PageHeader>
			</div>

			<!-- Tabs -->
			<div role="tablist" class="tabs tabs-bordered px-4 pb-1">
				<button
					role="tab"
					class="tab"
					class:tab-active={activeTab === 'artists'}
					onclick={() => {
						activeTab = 'artists'
						selectedEnsemble = null
					}}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
					</svg>
					Individual Artists
					<span class="badge badge-sm ml-2">{filteredArtists.length}</span>
				</button>
				<button
					role="tab"
					class="tab"
					class:tab-active={activeTab === 'ensembles'}
					onclick={() => {
						activeTab = 'ensembles'
						selectedArtist = null
					}}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
					</svg>
					Ensembles
					<span class="badge badge-sm ml-2">{filteredEnsembles.length}</span>
				</button>
			</div>
		</div>

		<!-- Main Content Area -->
		<div class="flex-1 p-6 min-h-0">
			{#if activeTab === 'artists'}
				<MasterDetail
					items={filteredArtists as any}
					selectedItem={selectedArtist as any}
					loading={clientLoading}
					searchPlaceholder="Search artists..."
					searchValue={searchQuery}
					masterTitle="Artists"
					getItemTitle={getArtistTitle}
					getItemSubtitle={getArtistSubtitle}
					getItemDetail={getArtistDetail}
					detailEmptyIcon="👤"
					detailEmptyTitle="Select an artist"
					detailEmptyMessage="Choose an artist from the list to view their full profile"
					storageKey="phwb-selected-artist"
					on:search={handleSearch}
					on:select={handleSelectArtist}
				>
					{#snippet filters()}
						<div class="dropdown dropdown-end">
							<button tabindex="0" class="btn btn-sm btn-outline" class:btn-active={hasActiveArtistFilters}>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
								</svg>
								Filters
								{#if hasActiveArtistFilters}
									<span class="badge badge-sm badge-primary">•</span>
								{/if}
							</button>
							<div tabindex="0" class="dropdown-content z-[1] card card-compact w-80 p-4 shadow bg-base-100 border border-base-300 mt-2">
								<div class="space-y-3">
									<div class="flex items-center justify-between">
										<h3 class="font-semibold text-sm">Filter Artists</h3>
										{#if hasActiveArtistFilters}
											<button
												class="btn btn-ghost btn-xs"
												onclick={() => {
													artistFilters = {
														genres: [],
														instruments: [],
														canBeSoloist: null,
														sightReads: null,
														hideIncomplete: false
													}
												}}
											>
												Clear all
											</button>
										{/if}
									</div>

									<div class="divider my-1"></div>

									<div class="form-control">
										<label class="label cursor-pointer justify-start gap-2 py-1">
											<input
												type="checkbox"
												class="checkbox checkbox-sm checkbox-primary"
												bind:checked={artistFilters.hideIncomplete}
											/>
											<span class="label-text text-sm font-medium">Hide incomplete contacts</span>
										</label>
										<p class="text-xs opacity-60 ml-6">Excludes placeholder emails & missing phone numbers</p>
									</div>

									<div class="divider my-1"></div>

									<div class="form-control">
										<label class="label cursor-pointer justify-start gap-2 py-1">
											<input
												type="checkbox"
												class="checkbox checkbox-sm"
												checked={artistFilters.canBeSoloist === true}
												onchange={(e) => {
													artistFilters.canBeSoloist = e.currentTarget.checked ? true : null
												}}
											/>
											<span class="label-text text-sm">Can be soloist</span>
										</label>
									</div>

									<div class="form-control">
										<label class="label cursor-pointer justify-start gap-2 py-1">
											<input
												type="checkbox"
												class="checkbox checkbox-sm"
												checked={artistFilters.sightReads === true}
												onchange={(e) => {
													artistFilters.sightReads = e.currentTarget.checked ? true : null
												}}
											/>
											<span class="label-text text-sm">Sight reads</span>
										</label>
									</div>
								</div>
							</div>
						</div>
					{/snippet}

					{#snippet children(props)}
						{@const artist = props.item as Artist}
						{#if artist}
							<ArtistDetailView
								artist={artist}
								on:delete={openDeleteArtist}
							/>
						{/if}
					{/snippet}
				</MasterDetail>
			{:else}
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
					detailEmptyIcon="🎭"
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
			{/if}
		</div>
	</div>

	<!-- Create Artist Modal -->
	<CreateArtist
		open={isCreateArtistModalOpen}
		on:close={() => isCreateArtistModalOpen = false}
		on:success={handleArtistCreated}
	/>

	<!-- Create Ensemble Modal -->
	<CreateEnsemble
		open={isCreateEnsembleModalOpen}
		on:close={() => isCreateEnsembleModalOpen = false}
		on:success={handleEnsembleCreated}
	/>

	<!-- Delete Artist Modal -->
	<DeleteArtist
		open={isDeleteArtistModalOpen}
		artist={selectedArtist}
		onClose={() => isDeleteArtistModalOpen = false}
		onSuccess={handleDeleteArtist}
	/>

	<!-- Delete Ensemble Modal -->
	<DeleteEnsemble
		open={isDeleteEnsembleModalOpen}
		ensemble={selectedEnsemble}
		onClose={() => isDeleteEnsembleModalOpen = false}
		onSuccess={handleDeleteEnsemble}
	/>
</ErrorBoundary>
