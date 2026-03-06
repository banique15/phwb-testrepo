<script lang="ts">
	import { onMount } from 'svelte'
	import { invalidateAll, goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { User, Download, Upload } from 'lucide-svelte'
	import { artistsStore, updateArtist } from '$lib/stores/artists'
	import type { Artist } from '$lib/schemas/artist'
	import type { PageData } from './$types'
	import { updateArtistSchema } from '$lib/schemas/artist'
	import { z } from 'zod'
	import { supabase } from '$lib/supabase'
	import { normalizePhoneForDB } from '$lib/utils/phone'
	import { exportArtistsAsCSV } from '$lib/services/artist-export'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import MasterDetail from '$lib/components/ui/MasterDetail.svelte'
	import ExportArtistsModal from '$lib/components/artists/ExportArtistsModal.svelte'
	import { portal } from '$lib/actions/portal'
	import ArtistHeaderCard from './components/ArtistHeaderCard.svelte'
	import ArtistTabs from './components/ArtistTabs.svelte'
	import ArtistCreateForm from './components/ArtistCreateForm.svelte'
	import DeleteArtist from './components/modals/DeleteArtist.svelte'

	interface Props {
		data: PageData
	}

	let { data }: Props = $props()

	let selectedArtist = $state<Artist | null>(null)
	let clientLoading = $state(false)
	let artistEventsCount = $state(0)

	// Modal and form state
	let showCreateForm = $state(false)
	let isDeleteArtistModalOpen = $state(false)
	let showExportArtistsModal = $state(false)

	// Selection for export (checkbox in list)
	let selectedArtistIds = $state<Set<string>>(new Set())

	// Filter panel: portaled and fixed (like notification panel) so it renders above sidebar
	let showFilterPanel = $state(false)
	let filterPanelPosition = $state({ top: 80, left: 208 })
	let filterButtonRef = $state<HTMLButtonElement | null>(null)
	let filterPanelRef = $state<HTMLDivElement | null>(null)

	// Sort panel: same portaled pattern so it renders above sidebar
	let showSortPanel = $state(false)
	let sortPanelPosition = $state({ top: 80, left: 208 })
	let sortButtonRef = $state<HTMLButtonElement | null>(null)
	let sortPanelRef = $state<HTMLDivElement | null>(null)

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
		hasEnsemble: false as boolean,
		employmentStatus: null as string | null
	})

	// Track artist IDs that belong to ensembles
	let artistsWithEnsembles = $state<Set<string>>(new Set())

	// Track event counts per artist
	let artistEventCounts = $state<Map<string, { upcoming: number; past: number; total: number }>>(new Map())

	// Reactive artists list - initialized from server data, updated via realtime
	let artists = $state<Artist[]>(data.artists)

	// Keep artists in sync with server data on navigation
	$effect(() => {
		artists = data.artists
	})

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
			result = result.filter(artist => {
				// Search by full_name
				if (artist.full_name?.toLowerCase().includes(query)) return true
				// Search by artist_name
				if (artist.artist_name?.toLowerCase().includes(query)) return true
				// Search by legal first name
				if (artist.legal_first_name?.toLowerCase().includes(query)) return true
				// Search by legal last name
				if (artist.legal_last_name?.toLowerCase().includes(query)) return true
				// Search by combined legal name (first + last)
				const legalFullName = [artist.legal_first_name, artist.legal_last_name].filter(Boolean).join(' ')
				if (legalFullName.toLowerCase().includes(query)) return true
				// Search by email
				if (artist.email?.toLowerCase().includes(query)) return true
				// Search by location
				if (artist.location?.toLowerCase().includes(query)) return true
				return false
			})
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

		// Employment status filter
		if (artistFilters.employmentStatus) {
			if (artistFilters.employmentStatus === 'Employee') {
				// Employee includes those with status set to Employee OR not set
				result = result.filter(artist => artist.employment_status === 'Employee' || !artist.employment_status)
			} else {
				result = result.filter(artist => artist.employment_status === artistFilters.employmentStatus)
			}
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
		artistFilters.hasEnsemble ||
		artistFilters.employmentStatus !== null
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

		;(async () => {
			// Check for artist ID in URL first (e.g., /artists?id=xxx)
			const urlArtistId = $page.url.searchParams.get('id')
			if (urlArtistId && data.artists.length > 0) {
				let urlArtist = data.artists.find(artist => artist.id === urlArtistId)

				if (!urlArtist) {
					const { data: fetchedArtist } = await supabase
						.from('phwb_artists')
						.select('*')
						.eq('id', urlArtistId)
						.single()

					if (fetchedArtist) {
						urlArtist = fetchedArtist
					}
				}

				if (urlArtist) {
					selectedArtist = urlArtist
					if (urlArtist.id) {
						loadArtistEventsCount(urlArtist.id)
					}
					artistsStore.subscribeToChanges({
						onInsert: (payload) => {
							const newArtist = payload.new as Artist
							if (!artists.some(a => a.id === newArtist.id)) {
								artists = [newArtist, ...artists]
							}
						},
						onUpdate: (payload) => {
							const updatedArtist = payload.new as Artist
							artists = artists.map(a => a.id === updatedArtist.id ? updatedArtist : a)
							if (selectedArtist?.id === updatedArtist.id) {
								selectedArtist = updatedArtist
							}
						},
						onDelete: (payload) => {
							const deletedId = (payload.old as Artist).id
							artists = artists.filter(a => a.id !== deletedId)
							if (selectedArtist?.id === deletedId) {
								selectedArtist = null
							}
						}
					})
					return
				}
			}

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

			// Subscribe to real-time changes with callbacks to update local state
			artistsStore.subscribeToChanges({
				onInsert: (payload) => {
					const newArtist = payload.new as Artist
					if (!artists.some(a => a.id === newArtist.id)) {
						artists = [newArtist, ...artists]
					}
				},
				onUpdate: (payload) => {
					const updatedArtist = payload.new as Artist
					artists = artists.map(a => a.id === updatedArtist.id ? updatedArtist : a)
					if (selectedArtist?.id === updatedArtist.id) {
						selectedArtist = updatedArtist
					}
				},
				onDelete: (payload) => {
					const deletedId = (payload.old as Artist).id
					artists = artists.filter(a => a.id !== deletedId)
					if (selectedArtist?.id === deletedId) {
						selectedArtist = null
					}
				}
			})
		})()

		return () => {
			artistsStore.unsubscribeFromChanges()
		}
	})

	async function handleSelectArtist(event: CustomEvent<{ item: Artist }>) {
		showCreateForm = false
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

	function openCreateForm() {
		selectedArtist = null
		showCreateForm = true
	}

	async function handleCreateFormSuccess(artist: Artist) {
		showCreateForm = false
		selectedArtist = artist
		if (artist?.id) {
			await loadArtistEventsCount(artist.id)
		}
		// Refresh the list to include the new artist
		await invalidateAll()
	}

	function handleCreateFormCancel() {
		showCreateForm = false
	}

	async function handleDeleteArtist() {
		selectedArtist = null
		isDeleteArtistModalOpen = false
		// Refetch the artists list
		await invalidateAll()
	}

	function openDeleteArtist() {
		if (selectedArtist) {
			isDeleteArtistModalOpen = true
		}
	}

	function handleExportArtistsConfirm(event: CustomEvent<{ scope: 'all' | 'selected' }>) {
		const scope = event.detail.scope
		const toExport =
			scope === 'selected'
				? filteredArtists.filter((a) => a.id && selectedArtistIds.has(String(a.id)))
				: [...filteredArtists]
		exportArtistsAsCSV(toExport)
		showExportArtistsModal = false
	}

	function handleExportArtistsClose() {
		showExportArtistsModal = false
	}

	function openFilterPanel() {
		if (filterButtonRef) {
			const rect = filterButtonRef.getBoundingClientRect()
			filterPanelPosition = { top: rect.bottom + 4, left: rect.left }
		} else {
			filterPanelPosition = { top: 80, left: 208 }
		}
		showFilterPanel = true
	}

	function handleFilterPanelClickOutside(event: MouseEvent) {
		if (
			showFilterPanel &&
			filterButtonRef &&
			filterPanelRef &&
			!filterButtonRef.contains(event.target as Node) &&
			!filterPanelRef.contains(event.target as Node)
		) {
			showFilterPanel = false
		}
	}

	$effect(() => {
		if (!showFilterPanel) return
		document.addEventListener('click', handleFilterPanelClickOutside)
		return () => document.removeEventListener('click', handleFilterPanelClickOutside)
	})

	function toggleSortPanel() {
		if (showSortPanel) {
			showSortPanel = false
			return
		}
		if (sortButtonRef) {
			const rect = sortButtonRef.getBoundingClientRect()
			sortPanelPosition = { top: rect.bottom + 4, left: rect.left }
		} else {
			sortPanelPosition = { top: 80, left: 208 }
		}
		showSortPanel = true
	}

	function handleSortPanelClickOutside(event: MouseEvent) {
		if (
			showSortPanel &&
			sortButtonRef &&
			sortPanelRef &&
			!sortButtonRef.contains(event.target as Node) &&
			!sortPanelRef.contains(event.target as Node)
		) {
			showSortPanel = false
		}
	}

	$effect(() => {
		if (!showSortPanel) return
		document.addEventListener('click', handleSortPanelClickOutside)
		return () => document.removeEventListener('click', handleSortPanelClickOutside)
	})

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
					forceShowChildren={showCreateForm}
					selectionMode={true}
					bind:selectedIds={selectedArtistIds}
					on:search={handleSearch}
					on:select={handleSelectArtist}
				>
					{#snippet filters()}
						<button
							bind:this={filterButtonRef}
							type="button"
							class="btn btn-sm btn-outline"
							class:btn-active={hasActiveArtistFilters}
							onclick={openFilterPanel}
							aria-haspopup="true"
							aria-expanded={showFilterPanel}
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
							</svg>
							Filters
							{#if hasActiveArtistFilters}
								<span class="badge badge-sm badge-primary">•</span>
							{/if}
						</button>
					{/snippet}

					{#snippet masterActions()}
						<button
							bind:this={sortButtonRef}
							type="button"
							class="btn btn-xs border border-base-content/20 bg-base-100 hover:bg-base-200 text-base-content"
							title="Sort artists"
							onclick={toggleSortPanel}
							aria-haspopup="true"
							aria-expanded={showSortPanel}
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
							</svg>
							<span class="hidden sm:inline ml-1">{sortOptions.find(o => o.value === sortBy)?.label || 'Sort'}</span>
						</button>
						<button
							class="btn btn-ghost btn-xs"
							onclick={() => goto('/artists/import')}
							title="Import artists from CSV"
						>
							<Upload class="h-3 w-3 mr-1" />
							<span class="hidden sm:inline">Import CSV</span>
						</button>
						<button
							class="btn btn-ghost btn-xs"
							onclick={() => (showExportArtistsModal = true)}
							title="Export artists to CSV"
						>
							<Download class="h-3 w-3 mr-1" />
							<span class="hidden sm:inline">Export CSV</span>
						</button>
						<button
							class="btn btn-primary btn-xs"
							onclick={openCreateForm}
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
						{#if showCreateForm}
							<ArtistCreateForm
								onSuccess={handleCreateFormSuccess}
								onCancel={handleCreateFormCancel}
							/>
						{:else}
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
						{/if}
					{/snippet}
				</MasterDetail>
			</div>
		</div>
	</div>

	<!-- Filter panel: fixed + portaled so it renders above sidebar (same pattern as notification panel) -->
	{#if showFilterPanel}
		<div
			use:portal={'dropdown-portal'}
			bind:this={filterPanelRef}
			class="w-80 max-h-[90vh] overflow-y-auto bg-base-100 rounded-lg shadow-2xl border border-base-300 card card-compact p-4"
			style="position: fixed; top: {filterPanelPosition.top}px; left: {filterPanelPosition.left}px; z-index: 9999;"
			role="dialog"
			aria-label="Filter artists"
		>
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<h3 class="font-semibold text-sm">Filter Artists</h3>
					{#if hasActiveArtistFilters}
						<button
							type="button"
							class="btn btn-ghost btn-xs"
							onclick={() => {
								artistFilters = {
									genres: [],
									instruments: [],
									canBeSoloist: null,
									sightReads: null,
									hideIncomplete: false,
									hasEnsemble: false,
									employmentStatus: null
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

				<div class="divider my-1"></div>

				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-sm font-medium">Employment Status</span>
					</label>
					<select
						class="select select-sm select-bordered w-full"
						value={artistFilters.employmentStatus || ''}
						onchange={(e) => {
							artistFilters.employmentStatus = e.currentTarget.value || null
						}}
					>
						<option value="">All</option>
						<option value="Employee">Employee/W2</option>
						<option value="1099">LLC/1099</option>
						<option value="Trial">Trial</option>
					</select>
				</div>
			</div>
		</div>
	{/if}

	<!-- Sort panel: fixed + portaled so it renders above sidebar -->
	{#if showSortPanel}
		<div
			use:portal={'dropdown-portal'}
			bind:this={sortPanelRef}
			class="w-48 bg-base-100 rounded-lg shadow-2xl border border-base-300 p-2"
			style="position: fixed; top: {sortPanelPosition.top}px; left: {sortPanelPosition.left}px; z-index: 9999;"
			role="menu"
			aria-label="Sort artists"
		>
			<ul class="menu menu-sm p-0">
				{#each sortOptions as option}
					<li>
						<button
							type="button"
							class="text-sm"
							class:active={sortBy === option.value}
							role="menuitem"
							onclick={() => {
								sortBy = option.value
								showSortPanel = false
							}}
						>
							{option.label}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Delete Artist Modal -->
	<DeleteArtist
		open={isDeleteArtistModalOpen}
		artist={selectedArtist}
		onClose={() => isDeleteArtistModalOpen = false}
		onSuccess={handleDeleteArtist}
	/>

	<!-- Export Artists Modal -->
	<ExportArtistsModal
		open={showExportArtistsModal}
		totalCount={filteredArtists.length}
		selectedCount={selectedArtistIds.size}
		on:confirm={handleExportArtistsConfirm}
		on:close={handleExportArtistsClose}
	/>
</ErrorBoundary>
