<script lang="ts">
	import { onMount } from 'svelte'
	import { invalidateAll } from '$app/navigation'
	import { User } from 'lucide-svelte'
	import { artistsStore, updateArtist } from '$lib/stores/artists'
	import type { Artist } from '$lib/schemas/artist'
	import type { PageData } from './$types'
	import { updateArtistSchema } from '$lib/schemas/artist'
	import { z } from 'zod'
	import { supabase } from '$lib/supabase'
	import { normalizePhoneForDB } from '$lib/utils/phone'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import MasterDetail from '$lib/components/ui/MasterDetail.svelte'
	import ArtistHeaderCard from './components/ArtistHeaderCard.svelte'
	import ArtistTabs from './components/ArtistTabs.svelte'
	import CreateArtist from './components/modals/CreateArtist.svelte'
	import DeleteArtist from './components/modals/DeleteArtist.svelte'

	interface Props {
		data: PageData
	}

	let { data }: Props = $props()

	let selectedArtist = $state<Artist | null>(null)
	let clientLoading = $state(false)
	let artistEventsCount = $state(0)

	// Modal state
	let isCreateArtistModalOpen = $state(false)
	let isDeleteArtistModalOpen = $state(false)

	// Search state
	let searchQuery = $state('')

	// Sort state
	type SortOption = 'name-asc' | 'name-desc' | 'artist-name-asc' | 'first-name-asc' | 'last-name-asc' | 'recent'
	let sortBy = $state<SortOption>('name-asc')

	const sortOptions: { value: SortOption; label: string }[] = [
		{ value: 'name-asc', label: 'Name (A-Z)' },
		{ value: 'name-desc', label: 'Name (Z-A)' },
		{ value: 'first-name-asc', label: 'First Name (A-Z)' },
		{ value: 'last-name-asc', label: 'Last Name (A-Z)' },
		{ value: 'artist-name-asc', label: 'Artist Name (A-Z)' },
		{ value: 'recent', label: 'Recently Added' }
	]

	// Artist filter state
	let artistFilters = $state({
		genres: [] as string[],
		instruments: [] as string[],
		canBeSoloist: null as boolean | null,
		sightReads: null as boolean | null,
		hideIncomplete: false as boolean,
		hasEnsemble: false as boolean
	})

	// Track artist IDs that belong to ensembles
	let artistsWithEnsembles = $state<Set<string>>(new Set())

	// Track event counts per artist
	let artistEventCounts = $state<Map<string, { upcoming: number; past: number; total: number }>>(new Map())

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

		// Has ensemble filter
		if (artistFilters.hasEnsemble) {
			result = result.filter(artist => artist.id && artistsWithEnsembles.has(artist.id))
		}

		// Apply sorting
		result = result.sort((a, b) => {
			switch (sortBy) {
				case 'name-asc':
					return (a.full_name || a.artist_name || '').localeCompare(b.full_name || b.artist_name || '')
				case 'name-desc':
					return (b.full_name || b.artist_name || '').localeCompare(a.full_name || a.artist_name || '')
				case 'first-name-asc':
					return (a.legal_first_name || a.full_name || '').localeCompare(b.legal_first_name || b.full_name || '')
				case 'last-name-asc':
					return (a.legal_last_name || '').localeCompare(b.legal_last_name || '')
				case 'artist-name-asc':
					return (a.artist_name || a.full_name || '').localeCompare(b.artist_name || b.full_name || '')
				case 'recent':
					return (b.created_at || '').localeCompare(a.created_at || '')
				default:
					return 0
			}
		})

		return result
	})

	// Check if filters are active
	let hasActiveArtistFilters = $derived(
		artistFilters.genres.length > 0 ||
		artistFilters.instruments.length > 0 ||
		artistFilters.canBeSoloist !== null ||
		artistFilters.sightReads !== null ||
		artistFilters.hideIncomplete ||
		artistFilters.hasEnsemble
	)

	// Load artist IDs that belong to ensembles
	async function loadArtistsWithEnsembles() {
		const { data, error } = await supabase
			.from('phwb_ensemble_members')
			.select('artist_id')
			.eq('is_active', true)

		if (!error && data) {
			artistsWithEnsembles = new Set(data.map(m => m.artist_id))
		}
	}

	// Load event counts for all artists
	async function loadArtistEventCounts() {
		const { data: events, error } = await supabase
			.from('phwb_events')
			.select('artists, date')

		if (!error && events) {
			const today = new Date()
			today.setHours(0, 0, 0, 0)
			const counts = new Map<string, { upcoming: number; past: number; total: number }>()

			events.forEach(event => {
				if (!event.artists) return

				// Handle both array format and legacy object format
				let artistIds: string[] = []
				if (Array.isArray(event.artists)) {
					artistIds = event.artists
				} else if (event.artists.assignments) {
					artistIds = event.artists.assignments.map((a: any) => a.artist_id)
				}

				const eventDate = event.date ? new Date(event.date) : null
				const isUpcoming = eventDate && eventDate >= today

				artistIds.forEach((artistId: string) => {
					const current = counts.get(artistId) || { upcoming: 0, past: 0, total: 0 }
					current.total++
					if (isUpcoming) {
						current.upcoming++
					} else {
						current.past++
					}
					counts.set(artistId, current)
				})
			})

			artistEventCounts = counts
		}
	}

	onMount(() => {
		// Load ensemble membership data for filtering
		loadArtistsWithEnsembles()

		// Load event counts for all artists
		loadArtistEventCounts()

		// Restore selected artist from localStorage on initial client-side mount
		const artistStorageKey = 'phwb-selected-artist'
		const savedArtistId = localStorage.getItem(artistStorageKey)
		if (savedArtistId && data.artists.length > 0) {
			const savedArtist = data.artists.find(artist => String(artist.id) === savedArtistId)
			if (savedArtist) {
				selectedArtist = savedArtist
				if (savedArtist.id) {
					loadArtistEventsCount(savedArtist.id)
				}
			}
		}

		// Subscribe to real-time changes
		artistsStore.subscribeToChanges()

		return () => {
			artistsStore.unsubscribeFromChanges()
		}
	})

	async function handleSelectArtist(event: CustomEvent<{ item: Artist }>) {
		selectedArtist = event.detail.item
		if (selectedArtist?.id) {
			await loadArtistEventsCount(selectedArtist.id)
		}
	}

	async function loadArtistEventsCount(artistId: string) {
		try {
			const { count, error } = await supabase
				.from('phwb_events')
				.select('*', { count: 'exact', head: true })
				.contains('artists', JSON.stringify([artistId]))
			
			if (error) {
				console.error('Error loading artist events count:', error)
				artistEventsCount = 0
			} else {
				artistEventsCount = count || 0
			}
		} catch (err) {
			console.error('Failed to load artist events count:', err)
			artistEventsCount = 0
		}
	}

	async function updateArtistField(field: string, value: any) {
		if (!selectedArtist?.id) return

		try {
			// Validate the field
			const fieldSchema =
				updateArtistSchema.shape[
					field as keyof typeof updateArtistSchema.shape
				]
			if (fieldSchema) {
				fieldSchema.parse(value)
			}

		// Prepare update data
		// For arrays, always save them (even if empty) - don't convert to null
		// For strings, convert empty strings to null
		let updateData: any
		if (Array.isArray(value)) {
			// Arrays should be saved as-is, even if empty
			updateData = { [field]: value }
		} else {
			updateData = { [field]: value === "" ? null : value }
		}

		// Special handling for phone
		if (field === 'phone' && value) {
			updateData.phone = normalizePhoneForDB(value)
		}

			// Update artist
			const updatedArtist = await updateArtist(selectedArtist.id, updateData)
			selectedArtist = updatedArtist
		} catch (error) {
			if (error instanceof z.ZodError) {
				throw new Error(
					error.errors[0]?.message || "Validation failed",
				)
			}
			throw error
		}
	}

	function handleSearch(event: CustomEvent<{ value: string }>) {
		searchQuery = event.detail.value
	}

	function openCreateModal() {
		isCreateArtistModalOpen = true
	}

	async function handleArtistCreated(event: CustomEvent<{ artist: any }>) {
		selectedArtist = event.detail.artist
		isCreateArtistModalOpen = false
		if (selectedArtist?.id) {
			await loadArtistEventsCount(selectedArtist.id)
		}
		console.log('Artist created successfully:', event.detail.artist.full_name)
	}

	function handleDeleteArtist() {
		selectedArtist = null
		isDeleteArtistModalOpen = false
	}

	function openDeleteArtist() {
		if (selectedArtist) {
			isDeleteArtistModalOpen = true
		}
	}

	// MasterDetail configuration functions for Artists
	function getArtistTitle(item: any): string {
		const fullName = item.full_name ||
			   (item.legal_first_name && item.legal_last_name
				? `${item.legal_first_name} ${item.legal_last_name}`
				: item.legal_first_name) ||
			   'No name'

		// Add artist name if different from full name
		if (item.artist_name && item.artist_name !== fullName) {
			return `${fullName} — ${item.artist_name}`
		}
		return fullName
	}

	function getArtistSubtitle(item: any): string {
		const parts = []

		// Metro area
		if (item.metropolitan_hub) {
			parts.push(item.metropolitan_hub)
		} else if (item.location) {
			parts.push(item.location)
		}

		// Event counts
		const counts = artistEventCounts.get(item.id)
		if (counts && counts.total > 0) {
			const eventParts = []
			if (counts.upcoming > 0) eventParts.push(`${counts.upcoming} upcoming`)
			if (counts.past > 0) eventParts.push(`${counts.past} past`)
			parts.push(`${counts.total} events (${eventParts.join(', ')})`)
		}

		return parts.join(' · ')
	}

	function getArtistDetail(item: any): string {
		// Return empty - we're not using the badge for artists
		return ''
	}
</script>

<ErrorBoundary>
	<div class="h-full flex flex-col overflow-hidden">
		<!-- Scrollable Content Area -->
		<div class="flex-1 min-h-0 flex flex-col">
			<div class="flex-1 min-h-0">
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
					detailEmptyIcon={User}
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
														hideIncomplete: false,
														hasEnsemble: false
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

									<div class="divider my-1"></div>

									<div class="form-control">
										<label class="label cursor-pointer justify-start gap-2 py-1">
											<input
												type="checkbox"
												class="checkbox checkbox-sm checkbox-primary"
												bind:checked={artistFilters.hasEnsemble}
											/>
											<span class="label-text text-sm font-medium">In an ensemble</span>
										</label>
										<p class="text-xs opacity-60 ml-6">Only show artists who belong to an ensemble</p>
									</div>
								</div>
							</div>
						</div>
					{/snippet}

					{#snippet masterActions()}
						<div class="dropdown dropdown-end">
							<button
								tabindex="0"
								class="btn btn-xs border border-base-content/20 bg-base-100 hover:bg-base-200 text-base-content"
								title="Sort artists"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
								</svg>
								<span class="hidden sm:inline ml-1">{sortOptions.find(o => o.value === sortBy)?.label || 'Sort'}</span>
							</button>
							<ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow-lg bg-base-100 border border-base-300 rounded-box w-48 mt-1">
								{#each sortOptions as option}
									<li>
										<button
											class="text-sm"
											class:active={sortBy === option.value}
											onclick={() => { sortBy = option.value; (document.activeElement as HTMLElement)?.blur() }}
										>
											{option.label}
										</button>
									</li>
								{/each}
							</ul>
						</div>
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
						{@const artist = props.item as Artist}
						{#if artist}
							<div class="overflow-y-auto h-full space-y-4">
								<!-- Header Card -->
								<ArtistHeaderCard
									{artist}
									eventsCount={artistEventsCount}
									onUpdateField={updateArtistField}
								/>

								<!-- Tabs Section -->
								<ArtistTabs
									{artist}
									onUpdateField={updateArtistField}
									onDelete={openDeleteArtist}
								/>
							</div>
						{/if}
					{/snippet}
				</MasterDetail>
			</div>
		</div>
	</div>

	<!-- Create Artist Modal -->
	<CreateArtist
		open={isCreateArtistModalOpen}
		on:close={() => isCreateArtistModalOpen = false}
		on:success={handleArtistCreated}
	/>

	<!-- Delete Artist Modal -->
	<DeleteArtist
		open={isDeleteArtistModalOpen}
		artist={selectedArtist}
		onClose={() => isDeleteArtistModalOpen = false}
		onSuccess={handleDeleteArtist}
	/>
</ErrorBoundary>
