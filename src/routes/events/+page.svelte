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
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import PageHeader from '$lib/components/ui/PageHeader.svelte'
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

	// Modal states
	let showCreateModal = $state(false)
	let showEditModal = $state(false)
	let showDeleteModal = $state(false)
	
	let eventArtistsCount = $state(0)

	const STORAGE_KEY = 'phwb-selected-event'

	// Get reactive reference to the store state for updates after mutations
	let storeState = $state<any>()

	// Subscribe to store changes for real-time updates
	eventsStore.enhanced.subscribe(state => {
		storeState = state
	})

	// Use server-loaded data initially, then client-side store updates after mutations
	// Only use store data if it has actually loaded (items.length > 0 or explicitly set)
	let events = $derived(
		storeState?.items !== undefined && storeState.items.length > 0
			? storeState.items
			: data.events || []
	)

	// Filter state from server data
	let currentFilters = $derived(data.filters || {})
	let currentStatistics = $derived(data.statistics || {})
	let venues = $derived(data.lookupData?.venues || [])
	let programs = $derived(data.lookupData?.programs || [])
	let partners = $derived(data.lookupData?.partners || [])

	// Watch for store changes to restore selection
	$effect(() => {
		if (browser && events.length > 0) {
			const savedId = localStorage.getItem(STORAGE_KEY)
			if (savedId && !selectedEvent) {
				const savedEvent = events.find((e: EnhancedEvent) => e.id === Number(savedId))
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
		return new Date(dateStr).toLocaleDateString()
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

	// Client-side filter state
	let clientFilters = $state({
		search: currentFilters.search || '',
		status: currentFilters.status || '',
		venue: currentFilters.venue || '',
		program: currentFilters.program || '',
		partner: currentFilters.partner || '',
		dateFilter: currentFilters.dateFilter || '',
		dateFrom: currentFilters.dateFrom || '',
		dateTo: currentFilters.dateTo || ''
	})

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

	// Filter event handlers - update client-side state only
	function handleSearch(event: CustomEvent<{ value: string }>) {
		clientFilters.search = event.detail.value
	}

	function handleStatusChange(event: CustomEvent<{ value: string }>) {
		clientFilters.status = event.detail.value
	}

	function handleVenueChange(event: CustomEvent<{ value: string }>) {
		clientFilters.venue = event.detail.value
	}

	function handleProgramChange(event: CustomEvent<{ value: string }>) {
		clientFilters.program = event.detail.value
	}

	function handlePartnerChange(event: CustomEvent<{ value: string }>) {
		clientFilters.partner = event.detail.value
	}

	function handleDateFilterChange(event: CustomEvent<{ value: string }>) {
		clientFilters.dateFilter = event.detail.value
		// Clear custom dates when changing filter type
		if (event.detail.value !== 'custom') {
			clientFilters.dateFrom = ''
			clientFilters.dateTo = ''
		}
	}

	function handleDateFromChange(event: CustomEvent<{ value: string }>) {
		clientFilters.dateFrom = event.detail.value
	}

	function handleDateToChange(event: CustomEvent<{ value: string }>) {
		clientFilters.dateTo = event.detail.value
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
	}

	// View mode handlers
	function toggleViewMode() {
		viewMode = viewMode === 'list' ? 'calendar' : 'list'
	}

	// Modal handlers
	function openCreateModal() {
		showCreateModal = true
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
	
	async function handleModalSuccess() {
		// No need to manually refresh - real-time subscriptions will handle updates
		// Clear selection if event was deleted
		if (showDeleteModal && selectedEvent) {
			selectedEvent = null
			if (browser) {
				localStorage.removeItem(STORAGE_KEY)
			}
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
		<!-- Fixed Page Header with Inline Controls -->
		<div class="sticky top-0 z-30 flex-none px-4 py-2 bg-base-100 border-b border-base-200 shadow-sm">
			<div class="flex flex-col gap-2">
				<!-- Title and Action Buttons Row -->
				<div class="flex items-start justify-between">
					<div>
						<h1 class="text-xl font-bold leading-tight">Events</h1>
						<p class="text-sm opacity-70">Manage event scheduling and coordination</p>
					</div>
					<div class="flex gap-2">
						<button
							class="btn btn-outline btn-sm"
							onclick={toggleViewMode}
							title={viewMode === 'list' ? 'Switch to Calendar View' : 'Switch to List View'}
						>
							{#if viewMode === 'list'}
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								Calendar View
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
								</svg>
								List View
							{/if}
						</button>
						<button class="btn btn-primary btn-sm" onclick={openCreateModal}>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
							</svg>
							Create Event
						</button>
					</div>
				</div>

				<!-- Inline Search and Filters Row -->
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
			</div>
		</div>

		<!-- Content Area -->
		<div class="flex-1 p-6 min-h-0">
			<div class="h-full">
	
	{#if loading}
		<div class="text-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
			<p class="mt-4">Loading events...</p>
		</div>
	{:else if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{:else if filteredEvents.length === 0}
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<div class="text-center py-12">
					{#if events.length === 0}
						<p class="mt-4 text-lg">No events scheduled yet</p>
						<p class="text-sm opacity-60">Create your first event to get started</p>
					{:else}
						<p class="mt-4 text-lg">No events match your filters</p>
						<p class="text-sm opacity-60">Try adjusting your search or filter criteria</p>
						<button class="btn btn-sm btn-outline mt-4" onclick={handleClearFilters}>
							Clear Filters
						</button>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		{#if viewMode === 'calendar'}
			<!-- Calendar View -->
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
									/>

									<!-- Tabs Section -->
									<EventTabs
										event={selectedEvent}
										onUpdateField={updateEventField}
										onDelete={openDeleteModal}
									/>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<!-- List View (existing) -->
			<div class="flex flex-col lg:flex-row gap-6 h-full min-h-0">
				<!-- Master List -->
				<div class="lg:w-1/3 lg:flex-none h-full">
					<div class="card bg-base-100 shadow-xl h-full flex flex-col min-h-0">
						<div class="card-body p-4 flex flex-col h-full min-h-0">
							<h2 class="card-title text-lg mb-4 flex-none">Events ({filteredEvents.length})</h2>
							<div class="overflow-y-auto flex-1 space-y-2 min-h-0 pr-2">
								{#each filteredEvents as event (event.id)}
									<div
										class="p-3 rounded-lg border cursor-pointer transition-colors hover:bg-base-200 {selectedEvent?.id === event.id ? 'bg-primary/10 border-primary' : 'border-base-300'}"
										onclick={() => selectEvent(event)}
										role="button"
										tabindex="0"
										onkeydown={(e) => e.key === 'Enter' && selectEvent(event)}
									>
										<div class="font-medium">
											{event.title || 'No title'}
										</div>
										<div class="text-sm opacity-70">
											{formatDate(event.date)}
										</div>
										<div class="flex items-center gap-2 mt-2">
											<span class="badge {getStatusBadgeClass(event.status)} badge-sm">
												{event.status || 'Unknown'}
											</span>
											{#if isUpcoming(event.date)}
												<span class="text-xs text-info">Upcoming</span>
											{:else if isPast(event.date)}
												<span class="text-xs opacity-50">Past</span>
											{/if}
										</div>
										{#if event.start_time || event.end_time}
											<div class="text-xs opacity-50 mt-1">
												{formatTime(event.start_time)} - {formatTime(event.end_time)}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					</div>
				</div>

				<!-- Detail View -->
				<div class="lg:flex-1 lg:min-w-0 h-full">
				<div class="card bg-base-100 shadow-xl h-full flex flex-col min-h-0">
					<div class="card-body flex flex-col h-full min-h-0">
						{#if selectedEvent}
							<div class="overflow-y-auto flex-1 min-h-0">
								<!-- Header Card -->
								<EventHeaderCard
									event={selectedEvent}
									artistsCount={eventArtistsCount}
									onUpdateField={updateEventField}
								/>

								<!-- Tabs Section -->
								<EventTabs
									event={selectedEvent}
									onUpdateField={updateEventField}
									onDelete={openDeleteModal}
								/>
							</div>
						{:else}
							<div class="text-center py-12">
								<p class="mt-4 text-lg">Select an event to view details</p>
								<p class="text-sm opacity-60">Choose an event from the list to see its full information</p>
							</div>
						{/if}
					</div>
				</div>
				</div>
			</div>
		{/if}
	{/if}
			</div>
		</div>
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