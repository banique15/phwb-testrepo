<script lang="ts">
	import { onMount, onDestroy } from 'svelte'
	import { browser } from '$app/environment'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { eventsStore, type EnhancedEvent } from '$lib/stores/events'
	import { logger } from '$lib/utils/logger'
	import type { PageData } from './$types'
	// Lazy load modals for better performance
	const CreateEvent = () => import('./modals/CreateEvent.svelte')
	const EditEvent = () => import('./modals/EditEvent.svelte')
	const DeleteConfirm = () => import('./modals/DeleteConfirm.svelte')
	import ScheduleDisplay from './components/ScheduleDisplay.svelte'
	import RequirementsDisplay from './components/RequirementsDisplay.svelte'
	import EventsSearchFilters from './components/EventsSearchFilters.svelte'
	import CalendarView from './components/CalendarView.svelte'
	import EventHeaderCard from './components/EventHeaderCard.svelte'
	import EventTabs from './components/EventTabs.svelte'
	import EventCreateForm from './components/EventCreateForm.svelte'
	import EventsBulkActions from './components/EventsBulkActions.svelte'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import MasterDetail from '$lib/components/ui/MasterDetail.svelte'
	import { Calendar } from 'lucide-svelte'
	import { updateEventSchema } from '$lib/schemas/event'
	import { z } from 'zod'

	interface Props {
		data: PageData
	}

	let { data }: Props = $props()

	let loading = $state(false) // Start with false since we have server data
	let error = $state('')
	let selectedEvent = $state<EnhancedEvent | null>(null)

	// View mode state
	let viewMode = $state<'list' | 'calendar'>('list')

	// Sort state
	type SortOption = 'upcoming' | 'recent' | 'title-asc' | 'title-desc' | 'status' | 'venue' | 'program' | 'created'
	let sortBy = $state<SortOption>('upcoming')

	const sortOptions: { value: SortOption; label: string }[] = [
		{ value: 'upcoming', label: 'Upcoming First' },
		{ value: 'recent', label: 'Most Recent First' },
		{ value: 'status', label: 'By Status' },
		{ value: 'venue', label: 'By Venue' },
		{ value: 'program', label: 'By Program' },
		{ value: 'title-asc', label: 'Title (A-Z)' },
		{ value: 'title-desc', label: 'Title (Z-A)' },
		{ value: 'created', label: 'Recently Created' }
	]

	// Modal states
	let showCreateModal = $state(false)
	let showCreateForm = $state(false)
	let showEditModal = $state(false)
	let showDeleteModal = $state(false)
	
	let eventArtistsCount = $state(0)

	// External tab switch for jumping to performers tab
	let externalActiveTab = $state<string | null>(null)

	// Bulk selection state
	let selectedEventIds = $state<Set<number>>(new Set())

	const STORAGE_KEY = 'phwb-selected-event'

	// Track newly created events that need to be merged with server data
	let newlyCreatedEvents = $state<EnhancedEvent[]>([])

	// Use server-loaded data merged with any newly created events
	let events = $derived.by(() => {
		const serverEvents = data.events || []

		// If we have newly created events, merge them with server data
		if (newlyCreatedEvents.length > 0) {
			// Get IDs of new events to avoid duplicates
			const newIds = new Set(newlyCreatedEvents.map(e => e.id))
			// Filter out any duplicates from server data and prepend new events
			const filteredServerEvents = serverEvents.filter((e: EnhancedEvent) => !newIds.has(e.id))
			return [...newlyCreatedEvents, ...filteredServerEvents]
		}

		return serverEvents
	})

	// Filter state from server data
	let currentFilters = $derived(data.filters || {})
	let currentStatistics = $derived(data.statistics || {})
	let venues = $derived(data.lookupData?.venues || [])
	let programs = $derived(data.lookupData?.programs || [])
	let partners = $derived(data.lookupData?.partners || [])

	// Restore selection from localStorage on mount (only once)
	let hasRestoredSelection = $state(false)

	$effect(() => {
		// Only run once when we have events and haven't restored yet
		if (browser && !hasRestoredSelection && data.events && data.events.length > 0) {
			hasRestoredSelection = true
			const savedId = localStorage.getItem(STORAGE_KEY)
			if (savedId && !selectedEvent) {
				const savedEvent = data.events.find((e: EnhancedEvent) => e.id === Number(savedId))
				if (savedEvent) {
					selectedEvent = savedEvent
				}
			}
		}
	})

	async function selectEvent(event: EnhancedEvent) {
		selectedEvent = event
		// Persist selection to localStorage
		if (browser && event.id) {
			localStorage.setItem(STORAGE_KEY, event.id.toString())
		}
		// Load artists count
		if (event.artists) {
			const artists = formatArtists(event.artists)
			eventArtistsCount = artists.length
		} else {
			eventArtistsCount = 0
		}
	}

	// MasterDetail helper functions
	function getEventTitle(item: any): string {
		return item.title || 'No title'
	}

	function getEventSubtitle(item: any): string {
		return formatDate(item.date)
	}

	function getEventDetail(item: any): string {
		const status = item.status || 'Unknown'
		const time = item.start_time || item.end_time 
			? `${formatTime(item.start_time)} - ${formatTime(item.end_time)}`
			: 'No time specified'
		return `${status} • ${time}`
	}

	async function handleSelectEvent(event: CustomEvent<{ item: EnhancedEvent }>) {
		showCreateForm = false
		await selectEvent(event.detail.item)
	}

	async function updateEventField(field: string, value: any) {
		if (!selectedEvent?.id) return

		try {
			// Validate the field
			const fieldSchema =
				updateEventSchema.shape[
					field as keyof typeof updateEventSchema.shape
				]
			if (fieldSchema) {
				fieldSchema.parse(value)
			}

			// Prepare update data
			const updateData: any = { [field]: value === "" ? null : value }

			// Update event
			const updatedEvent = await eventsStore.update(selectedEvent.id, updateData)
			
			// Enhance the updated event
			const enhanced = eventsStore.enhanceEvents([updatedEvent])[0]
			selectedEvent = enhanced
		} catch (error) {
			if (error instanceof z.ZodError) {
				throw new Error(
					error.errors[0]?.message || "Validation failed",
				)
			}
			throw error
		}
	}

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		const date = new Date(dateStr)
		return date.toLocaleDateString('en-US', {
			month: '2-digit',
			day: '2-digit',
			year: 'numeric'
		})
	}

	function formatTime(timeStr: string | undefined) {
		if (!timeStr) return 'Not specified'
		return timeStr.slice(0, 5) // Remove seconds
	}

	function getStatusBadgeClass(status: string | undefined) {
		switch (status?.toLowerCase()) {
			case 'scheduled':
				return 'badge-info'
			case 'completed':
				return 'badge-success'
			case 'cancelled':
				return 'badge-error'
			case 'confirmed':
				return 'badge-primary'
			default:
				return 'badge-outline'
		}
	}

	function formatArtists(artists: any) {
		// Handle direct array format (new structure)
		if (Array.isArray(artists)) return artists
		// Handle assignments structure (legacy format)
		if (artists && artists.assignments && Array.isArray(artists.assignments)) return artists.assignments
		return []
	}

	function formatSchedule(schedule: any) {
		if (!schedule || !schedule.blocks || !Array.isArray(schedule.blocks)) return []
		return schedule.blocks
	}

	function formatRequirements(requirements: any) {
		if (!requirements || typeof requirements !== 'object') return []
		return Object.entries(requirements).map(([key, value]) => ({ key, value }))
	}

	function isUpcoming(dateStr: string | undefined) {
		if (!dateStr) return false
		return new Date(dateStr) > new Date()
	}

	function isPast(dateStr: string | undefined) {
		if (!dateStr) return false
		return new Date(dateStr) < new Date()
	}

	// Client-side filter state - initialized from URL params with fallback to server data
	let clientFilters = $state({
		search: $page.url.searchParams.get('search') || currentFilters.search || '',
		status: $page.url.searchParams.get('status') || currentFilters.status || '',
		venue: $page.url.searchParams.get('venue') || currentFilters.venue || '',
		program: $page.url.searchParams.get('program') || currentFilters.program || '',
		partner: $page.url.searchParams.get('partner') || currentFilters.partner || '',
		dateFilter: $page.url.searchParams.get('dateFilter') || currentFilters.dateFilter || '',
		dateFrom: $page.url.searchParams.get('dateFrom') || currentFilters.dateFrom || '',
		dateTo: $page.url.searchParams.get('dateTo') || currentFilters.dateTo || ''
	})

	// Debounce timer for search
	let searchDebounceTimer: ReturnType<typeof setTimeout>

	// Sync filters to URL for bookmarking/sharing
	async function syncFiltersToUrl() {
		if (!browser) return

		const params = new URLSearchParams()
		if (clientFilters.search) params.set('search', clientFilters.search)
		if (clientFilters.status) params.set('status', clientFilters.status)
		if (clientFilters.venue) params.set('venue', clientFilters.venue)
		if (clientFilters.program) params.set('program', clientFilters.program)
		if (clientFilters.partner) params.set('partner', clientFilters.partner)
		if (clientFilters.dateFilter) params.set('dateFilter', clientFilters.dateFilter)
		if (clientFilters.dateFrom) params.set('dateFrom', clientFilters.dateFrom)
		if (clientFilters.dateTo) params.set('dateTo', clientFilters.dateTo)

		await goto(params.toString() ? `?${params}` : '?', {
			keepFocus: true,
			replaceState: true,
			noScroll: true
		})
	}

	// Client-side filtered events
	let filteredEvents = $derived.by(() => {
		let result = events

		// Apply search filter
		if (clientFilters.search) {
			const searchLower = clientFilters.search.toLowerCase()
			result = result.filter((e: EnhancedEvent) =>
				e.title?.toLowerCase().includes(searchLower) ||
				e.notes?.toLowerCase().includes(searchLower)
			)
		}

		// Apply status filter
		if (clientFilters.status) {
			result = result.filter((e: EnhancedEvent) => e.status === clientFilters.status)
		}

		// Apply venue filter
		if (clientFilters.venue) {
			result = result.filter((e: EnhancedEvent) => e.venue === parseInt(clientFilters.venue))
		}

		// Apply program filter
		if (clientFilters.program) {
			result = result.filter((e: EnhancedEvent) => e.program === parseInt(clientFilters.program))
		}

		// Apply partner filter (uses partner_id from enhanced event)
		if (clientFilters.partner) {
			result = result.filter((e: any) => e.partner_id === parseInt(clientFilters.partner))
		}

		// Apply date filters
		if (clientFilters.dateFilter) {
			const today = new Date()
			today.setHours(0, 0, 0, 0)

			switch (clientFilters.dateFilter) {
				case 'upcoming':
					result = result.filter((e: EnhancedEvent) => e.date && new Date(e.date) >= today)
					break
				case 'past':
					result = result.filter((e: EnhancedEvent) => e.date && new Date(e.date) < today)
					break
				case 'this_week':
					const weekStart = new Date(today)
					weekStart.setDate(weekStart.getDate() - weekStart.getDay())
					const weekEnd = new Date(weekStart)
					weekEnd.setDate(weekEnd.getDate() + 6)
					result = result.filter((e: EnhancedEvent) => {
						if (!e.date) return false
						const eventDate = new Date(e.date)
						return eventDate >= weekStart && eventDate <= weekEnd
					})
					break
				case 'this_month':
					const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
					const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
					result = result.filter((e: EnhancedEvent) => {
						if (!e.date) return false
						const eventDate = new Date(e.date)
						return eventDate >= monthStart && eventDate <= monthEnd
					})
					break
				case 'custom':
					if (clientFilters.dateFrom) {
						const fromDate = new Date(clientFilters.dateFrom)
						result = result.filter((e: EnhancedEvent) => e.date && new Date(e.date) >= fromDate)
					}
					if (clientFilters.dateTo) {
						const toDate = new Date(clientFilters.dateTo)
						result = result.filter((e: EnhancedEvent) => e.date && new Date(e.date) <= toDate)
					}
					break
			}
		}

		return result
	})

	// Derive selected events from filtered events (must be after filteredEvents is defined)
	let selectedEvents = $derived(filteredEvents.filter(e => selectedEventIds.has(e.id!)))

	// Recalculate statistics based on filtered events
	let filteredStatistics = $derived.by(() => {
		return {
			total: filteredEvents.length,
			scheduled: filteredEvents.filter((e: EnhancedEvent) => e.status === 'scheduled').length,
			confirmed: filteredEvents.filter((e: EnhancedEvent) => e.status === 'confirmed').length,
			completed: filteredEvents.filter((e: EnhancedEvent) => e.status === 'completed').length,
			cancelled: filteredEvents.filter((e: EnhancedEvent) => e.status === 'cancelled').length,
			upcoming: filteredEvents.filter((e: EnhancedEvent) => e.date && new Date(e.date) > new Date()).length,
			past: filteredEvents.filter((e: EnhancedEvent) => e.date && new Date(e.date) < new Date()).length
		}
	})

	// Filter event handlers - update client-side state and sync to URL
	function handleSearch(event: CustomEvent<{ value: string }>) {
		clientFilters.search = event.detail.value
		// Debounce URL sync for search to avoid excessive history entries
		clearTimeout(searchDebounceTimer)
		searchDebounceTimer = setTimeout(() => {
			syncFiltersToUrl()
		}, 300)
	}

	function handleStatusChange(event: CustomEvent<{ value: string }>) {
		clientFilters.status = event.detail.value
		syncFiltersToUrl()
	}

	function handleVenueChange(event: CustomEvent<{ value: string }>) {
		clientFilters.venue = event.detail.value
		syncFiltersToUrl()
	}

	function handleProgramChange(event: CustomEvent<{ value: string }>) {
		clientFilters.program = event.detail.value
		syncFiltersToUrl()
	}

	function handlePartnerChange(event: CustomEvent<{ value: string }>) {
		clientFilters.partner = event.detail.value
		syncFiltersToUrl()
	}

	function handleDateFilterChange(event: CustomEvent<{ value: string }>) {
		clientFilters.dateFilter = event.detail.value
		// Clear custom dates when changing filter type
		if (event.detail.value !== 'custom') {
			clientFilters.dateFrom = ''
			clientFilters.dateTo = ''
		}
		syncFiltersToUrl()
	}

	function handleDateFromChange(event: CustomEvent<{ value: string }>) {
		clientFilters.dateFrom = event.detail.value
		syncFiltersToUrl()
	}

	function handleDateToChange(event: CustomEvent<{ value: string }>) {
		clientFilters.dateTo = event.detail.value
		syncFiltersToUrl()
	}

	function handleClearFilters() {
		clientFilters.search = ''
		clientFilters.status = ''
		clientFilters.venue = ''
		clientFilters.program = ''
		clientFilters.partner = ''
		clientFilters.dateFilter = ''
		clientFilters.dateFrom = ''
		clientFilters.dateTo = ''
		syncFiltersToUrl()
	}

	// View mode handlers
	function toggleViewMode() {
		viewMode = viewMode === 'list' ? 'calendar' : 'list'
	}

	// Modal handlers
	function openCreateModal() {
		selectedEvent = null
		showCreateForm = true
	}
	
	function closeCreateModal() {
		showCreateModal = false
	}
	
	function openEditModal() {
		if (selectedEvent) {
			showEditModal = true
		}
	}
	
	function closeEditModal() {
		showEditModal = false
	}
	
	function openDeleteModal() {
		if (selectedEvent) {
			showDeleteModal = true
		}
	}
	
	function closeDeleteModal() {
		showDeleteModal = false
	}
	
	async function handleModalSuccess(createdEvent?: EnhancedEvent) {
		// If a new event was created, add it to the list and select it
		if (createdEvent && showCreateModal) {
			newlyCreatedEvents = [createdEvent, ...newlyCreatedEvents]
			await selectEvent(createdEvent)
		}

		// Clear selection if event was deleted
		if (showDeleteModal && selectedEvent) {
			selectedEvent = null
			if (browser) {
				localStorage.removeItem(STORAGE_KEY)
			}
		}
	}

	async function handleCreateFormSuccess(createdEvent?: EnhancedEvent) {
		showCreateForm = false
		if (createdEvent) {
			newlyCreatedEvents = [createdEvent, ...newlyCreatedEvents]
			await selectEvent(createdEvent)
		}
	}

	function handleCreateFormCancel() {
		showCreateForm = false
	}

	function handleArtistCountClick() {
		// Switch to performers tab - need to use a unique value to trigger the effect
		externalActiveTab = null
		setTimeout(() => {
			externalActiveTab = 'performers'
		}, 0)
	}

	// Bulk selection handlers
	function toggleSelectAll() {
		if (selectedEventIds.size === filteredEvents.length) {
			selectedEventIds = new Set()
		} else {
			selectedEventIds = new Set(filteredEvents.map(e => e.id!))
		}
	}

	function clearSelection() {
		selectedEventIds = new Set()
	}

	async function handleBulkAction(event: CustomEvent<{ action: string; eventIds: number[]; newStatus?: string }>) {
		const { action, eventIds, newStatus } = event.detail

		try {
			if (action === 'changeStatus' && newStatus) {
				await eventsStore.enhanced.bulkUpdate(eventIds, { status: newStatus })
			} else if (action === 'delete') {
				await eventsStore.enhanced.bulkDelete(eventIds)
			}
			clearSelection()
		} catch (err) {
			console.error('Bulk action failed:', err)
		}
	}

	// Real-time subscription management
	let realtimeSubscription: any

	onMount(() => {
		// Enable real-time subscriptions for automatic UI updates
		realtimeSubscription = eventsStore.enhanced.subscribeToChanges()
	})
	
	// Cleanup subscription on component destroy
	onDestroy(() => {
		if (realtimeSubscription) {
			eventsStore.unsubscribeFromChanges()
		}
	})
</script>

<ErrorBoundary>
	<div class="h-full flex flex-col overflow-hidden">
		{#if viewMode === 'calendar'}
			<!-- Calendar View - Full Layout -->
			<div class="flex-1 min-h-0 flex flex-col">
				<!-- Calendar View Header -->
				<div class="flex-none px-4 py-2 bg-base-100 border-b border-base-200">
					<div class="flex items-center justify-between">
						<div>
							<h1 class="text-xl font-bold leading-tight">Events - Calendar View</h1>
							<p class="text-sm opacity-70">View events in calendar format</p>
						</div>
						<div class="flex gap-2">
							<button
								class="btn btn-outline btn-sm"
								onclick={toggleViewMode}
								title="Switch to List View"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
								</svg>
								List View
							</button>
							<button class="btn btn-primary btn-sm" onclick={openCreateModal}>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
								</svg>
								Create Event
							</button>
						</div>
					</div>
				</div>
				<div class="flex-1 min-h-0 p-6">
					<div class="flex flex-col lg:flex-row gap-6 h-full min-h-0">
						<!-- Calendar -->
						<div class="lg:flex-1 h-full">
							<div class="card bg-base-100 shadow-xl h-full">
								<div class="card-body">
									<CalendarView
										events={filteredEvents}
										{selectedEvent}
										onSelectEvent={selectEvent}
									/>
								</div>
							</div>
						</div>

						<!-- Detail View (if event selected) -->
						{#if selectedEvent}
							<div class="lg:w-1/3 lg:flex-none h-full">
								<div class="card bg-base-100 shadow-xl h-full flex flex-col min-h-0">
									<div class="card-body flex flex-col h-full min-h-0">
										<div class="overflow-y-auto flex-1 min-h-0">
											<!-- Header Card -->
											<EventHeaderCard
												event={selectedEvent}
												artistsCount={eventArtistsCount}
												onUpdateField={updateEventField}
												onArtistCountClick={handleArtistCountClick}
											/>

											<!-- Tabs Section -->
											<EventTabs
												event={selectedEvent}
												onUpdateField={updateEventField}
												onDelete={openDeleteModal}
												{externalActiveTab}
											/>
										</div>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{:else}
			<!-- List View - Using MasterDetail -->
			<div class="flex-1 min-h-0 flex flex-col">
				<div class="flex-1 min-h-0">
					<MasterDetail
						items={filteredEvents as any}
						selectedItem={selectedEvent as any}
						loading={loading}
						searchPlaceholder="Search events..."
						searchValue={clientFilters.search}
						masterTitle="Events"
						getItemTitle={getEventTitle}
						getItemSubtitle={getEventSubtitle}
						getItemDetail={getEventDetail}
						detailEmptyIcon={Calendar}
						detailEmptyTitle="Select an event"
						detailEmptyMessage="Choose an event from the list to view its full information"
						storageKey={STORAGE_KEY}
						forceShowChildren={showCreateForm}
						on:search={handleSearch}
						on:select={handleSelectEvent}
					>
						{#snippet masterActions()}
							<button
								class="btn btn-ghost btn-xs hover:bg-base-200"
								onclick={toggleSelectAll}
								title={selectedEventIds.size === filteredEvents.length ? "Deselect all" : "Select all"}
							>
								<input
									type="checkbox"
									class="checkbox checkbox-xs border-base-content/30 bg-transparent [--chkbg:theme(colors.primary)] [--chkfg:theme(colors.primary-content)]"
									checked={selectedEventIds.size > 0 && selectedEventIds.size === filteredEvents.length}
									indeterminate={selectedEventIds.size > 0 && selectedEventIds.size < filteredEvents.length}
									readonly
								/>
							</button>
							<button
								class="btn btn-xs border border-base-content/20 bg-base-100 hover:bg-base-200 text-base-content"
								onclick={toggleViewMode}
								title="Switch to Calendar View"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								Calendar
							</button>
							<button
								class="btn btn-primary btn-xs"
								onclick={openCreateModal}
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
								</svg>
								Add
							</button>
						{/snippet}
						{#snippet filters()}
							<EventsSearchFilters
								searchValue={clientFilters.search}
								statusFilter={clientFilters.status}
								venueFilter={clientFilters.venue}
								programFilter={clientFilters.program}
								partnerFilter={clientFilters.partner}
								dateFilter={clientFilters.dateFilter}
								dateFrom={clientFilters.dateFrom}
								dateTo={clientFilters.dateTo}
								{venues}
								{programs}
								{partners}
								statistics={filteredStatistics}
								{loading}
								hideSearch={true}
								on:search={handleSearch}
								on:statusChange={handleStatusChange}
								on:venueChange={handleVenueChange}
								on:programChange={handleProgramChange}
								on:partnerChange={handlePartnerChange}
								on:dateFilterChange={handleDateFilterChange}
								on:dateFromChange={handleDateFromChange}
								on:dateToChange={handleDateToChange}
								on:clearFilters={handleClearFilters}
							/>
							{#if filteredEvents.length !== events.length}
								<div class="text-xs text-base-content/60 mt-2">
									Showing {filteredEvents.length} of {events.length} events
								</div>
							{/if}
						{/snippet}
						{#snippet children(props)}
							{#if showCreateForm}
								<EventCreateForm
									onSuccess={handleCreateFormSuccess}
									onCancel={handleCreateFormCancel}
								/>
							{:else}
								{@const event = props.item as EnhancedEvent}
								{#if event}
									<div class="flex flex-col h-full overflow-hidden">
										<!-- Header Card -->
										<div class="flex-none">
											<EventHeaderCard
												event={event}
												artistsCount={eventArtistsCount}
												onUpdateField={updateEventField}
												onArtistCountClick={handleArtistCountClick}
											/>
										</div>

										<!-- Tabs Section -->
										<div class="flex-1 min-h-0 overflow-y-auto">
											<EventTabs
												event={event}
												onUpdateField={updateEventField}
												onDelete={openDeleteModal}
												{externalActiveTab}
											/>
										</div>
									</div>
								{/if}
							{/if}
						{/snippet}
					</MasterDetail>
				</div>
			</div>
		{/if}
	</div>
</ErrorBoundary>

<!-- Modals - Lazy loaded for better performance -->
{#if showCreateModal}
	{#await CreateEvent() then { default: CreateEventComponent }}
		<CreateEventComponent
			open={showCreateModal}
			onClose={closeCreateModal}
			onSuccess={handleModalSuccess}
		/>
	{/await}
{/if}

{#if showEditModal}
	{#await EditEvent() then { default: EditEventComponent }}
		<EditEventComponent
			open={showEditModal}
			event={selectedEvent}
			onClose={closeEditModal}
			onSuccess={handleModalSuccess}
		/>
	{/await}
{/if}

{#if showDeleteModal}
	{#await DeleteConfirm() then { default: DeleteConfirmComponent }}
		<DeleteConfirmComponent
			open={showDeleteModal}
			event={selectedEvent}
			onClose={closeDeleteModal}
			onSuccess={handleModalSuccess}
		/>
	{/await}
{/if}

<!-- Bulk Actions Toolbar -->
<EventsBulkActions
	selectedCount={selectedEventIds.size}
	{selectedEvents}
	onClearSelection={clearSelection}
	on:bulkAction={handleBulkAction}
/>