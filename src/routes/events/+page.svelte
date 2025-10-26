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
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import PageHeader from '$lib/components/ui/PageHeader.svelte'
	import VenueSelector from '$lib/components/ui/VenueSelector.svelte'
	import ProgramSelector from '$lib/components/ui/ProgramSelector.svelte'
	import EventPerformers from '$lib/components/EventPerformers.svelte'

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
	
	// Inline editing state
	let isInlineEditing = $state(false)
	let editFormData = $state<any>({})
	let isSubmittingEdit = $state(false)
	let editErrors = $state<Record<string, string>>({})

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

	function selectEvent(event: EnhancedEvent) {
		selectedEvent = event
		// Persist selection to localStorage
		if (browser && event.id) {
			localStorage.setItem(STORAGE_KEY, event.id.toString())
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
	
	// Inline editing functions
	function startInlineEdit() {
		if (selectedEvent) {
			isInlineEditing = true
			editFormData = {
				title: selectedEvent.title || '',
				date: selectedEvent.date || '',
				start_time: selectedEvent.start_time || '',
				end_time: selectedEvent.end_time || '',
				status: selectedEvent.status || 'planned',
				notes: selectedEvent.notes || '',
				venue: selectedEvent.venue || undefined,
				program: selectedEvent.program || undefined
			}
			editErrors = {}
		}
	}
	
	function cancelInlineEdit() {
		isInlineEditing = false
		editFormData = {}
		editErrors = {}
	}
	
	async function saveInlineEdit() {
		if (!selectedEvent) return
		
		isSubmittingEdit = true
		editErrors = {}
		
		try {
			// Prepare clean update data with only changed fields
			const updateData: Record<string, any> = {}
			
			// Only include fields that have actually changed
			if (editFormData.title !== selectedEvent.title) {
				updateData.title = editFormData.title?.trim() || null
			}
			if (editFormData.date !== selectedEvent.date) {
				updateData.date = editFormData.date || null
			}
			if (editFormData.start_time !== selectedEvent.start_time) {
				updateData.start_time = editFormData.start_time ? editFormData.start_time.substring(0, 5) : null
			}
			if (editFormData.end_time !== selectedEvent.end_time) {
				updateData.end_time = editFormData.end_time ? editFormData.end_time.substring(0, 5) : null
			}
			if (editFormData.status !== selectedEvent.status) {
				updateData.status = editFormData.status || 'planned'
			}
			if (editFormData.venue !== selectedEvent.venue) {
				updateData.venue = editFormData.venue || null
			}
			if (editFormData.program !== selectedEvent.program) {
				updateData.program = editFormData.program || null
			}
			if (editFormData.notes !== selectedEvent.notes) {
				updateData.notes = editFormData.notes?.trim() || null
			}
			
			// Only proceed if there are actual changes
			if (Object.keys(updateData).length === 0) {
				logger.debug('No changes detected, skipping update')
				isInlineEditing = false
				return
			}

			logger.debug('Component: Updating event', selectedEvent.id, 'with data:', updateData)
			
			// Use the event ID as-is, let the store handle normalization
			const eventId = selectedEvent.id
			if (!eventId) {
				throw new Error('Invalid event ID')
			}
			
			const updatedEvent = await eventsStore.enhanced.update(eventId, updateData)
			selectedEvent = updatedEvent
			isInlineEditing = false

			logger.debug('Event updated successfully:', updatedEvent.title)
		} catch (error) {
			logger.error('Failed to update event:', error)
			editErrors.general = error instanceof Error ? error.message : 'Failed to update event. Please try again.'
		} finally {
			isSubmittingEdit = false
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
									<div class="flex items-start justify-between mb-4">
										<h2 class="card-title text-xl">
											{selectedEvent.title || 'Unnamed Event'}
										</h2>
										<button
											class="btn btn-sm btn-ghost"
											onclick={() => selectedEvent = null}
											title="Close details"
										>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
									<div class="space-y-3">
										<div>
											<span class="badge {getStatusBadgeClass(selectedEvent.status)}">
												{selectedEvent.status || 'Unknown Status'}
											</span>
										</div>
										<div>
											<label class="text-sm font-medium opacity-70">Date</label>
											<p class="text-base">{formatDate(selectedEvent.date)}</p>
										</div>
										<div>
											<label class="text-sm font-medium opacity-70">Time</label>
											<p class="text-base">
												{formatTime(selectedEvent.start_time)} - {formatTime(selectedEvent.end_time)}
											</p>
										</div>
										{#if selectedEvent.venue_name}
											<div>
												<label class="text-sm font-medium opacity-70">Venue</label>
												<p class="text-base">{selectedEvent.venue_name}</p>
											</div>
										{/if}
										{#if selectedEvent.notes}
											<div>
												<label class="text-sm font-medium opacity-70">Notes</label>
												<p class="text-base whitespace-pre-wrap">{selectedEvent.notes}</p>
											</div>
										{/if}
										<div class="pt-4 flex gap-2">
											<button
												class="btn btn-sm btn-outline flex-1"
												onclick={startInlineEdit}
											>
												Edit
											</button>
											<button
												class="btn btn-sm btn-outline btn-error"
												onclick={openDeleteModal}
											>
												Delete
											</button>
										</div>
									</div>
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
								<div class="flex items-start justify-between mb-6">
									<div>
										<h2 class="card-title text-2xl">
											{selectedEvent.title || 'Unnamed Event'}
										</h2>
										<div class="flex items-center gap-3 mt-2">
											<span class="badge {getStatusBadgeClass(selectedEvent.status)}">
												{selectedEvent.status || 'Unknown Status'}
											</span>
											<span class="text-sm opacity-70">
												{formatDate(selectedEvent.date)}
											</span>
											{#if selectedEvent.start_time || selectedEvent.end_time}
												<span class="text-sm opacity-70">
													{formatTime(selectedEvent.start_time)} - {formatTime(selectedEvent.end_time)}
												</span>
											{/if}
										</div>
									</div>
									<div class="flex gap-2">
										{#if isInlineEditing}
											<button 
												class="btn btn-sm btn-primary"
												onclick={saveInlineEdit}
												disabled={isSubmittingEdit}
												title="Save changes"
											>
												{#if isSubmittingEdit}
													<span class="loading loading-spinner loading-sm"></span>
												{:else}
													<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
													</svg>
												{/if}
												Save
											</button>
											<button 
												class="btn btn-sm btn-outline"
												onclick={cancelInlineEdit}
												disabled={isSubmittingEdit}
												title="Cancel editing"
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
												</svg>
												Cancel
											</button>
										{:else}
											<button 
												class="btn btn-sm btn-outline"
												onclick={startInlineEdit}
												disabled={!selectedEvent}
												title="Edit event information"
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
												</svg>
												Edit
											</button>
											<button 
												class="btn btn-sm btn-outline btn-error"
												onclick={openDeleteModal}
												disabled={!selectedEvent}
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
												</svg>
												Delete
											</button>
										{/if}
									</div>
								</div>

								{#if editErrors.general}
									<div class="alert alert-error mb-4">
										<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
										<span>{editErrors.general}</span>
									</div>
								{/if}

								<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
									<!-- Event Details -->
									<div class="space-y-4">
										<h3 class="text-lg font-semibold border-b pb-2">Event Details</h3>
										<div class="space-y-3">
											<div>
												<label class="text-sm font-medium opacity-70">Event Title</label>
												{#if isInlineEditing}
													<input 
														type="text" 
														class="input input-bordered input-sm w-full"
														bind:value={editFormData.title}
														placeholder="Enter event title"
													/>
												{:else}
													<p class="text-base">{selectedEvent.title || 'Not specified'}</p>
												{/if}
											</div>
											<div>
												<label class="text-sm font-medium opacity-70">Date</label>
												{#if isInlineEditing}
													<input 
														type="date" 
														class="input input-bordered input-sm w-full"
														bind:value={editFormData.date}
													/>
												{:else}
													<p class="text-base">{formatDate(selectedEvent.date)}</p>
												{/if}
											</div>
											<div>
												<label class="text-sm font-medium opacity-70">Start Time</label>
												{#if isInlineEditing}
													<input 
														type="time" 
														class="input input-bordered input-sm w-full"
														bind:value={editFormData.start_time}
													/>
												{:else}
													<p class="text-base">{formatTime(selectedEvent.start_time)}</p>
												{/if}
											</div>
											<div>
												<label class="text-sm font-medium opacity-70">End Time</label>
												{#if isInlineEditing}
													<input 
														type="time" 
														class="input input-bordered input-sm w-full"
														bind:value={editFormData.end_time}
													/>
												{:else}
													<p class="text-base">{formatTime(selectedEvent.end_time)}</p>
												{/if}
											</div>
											<div>
												<label class="text-sm font-medium opacity-70">Status</label>
												{#if isInlineEditing}
													<select 
														class="select select-bordered select-sm w-full"
														bind:value={editFormData.status}
													>
														<option value="planned">Planned</option>
														<option value="confirmed">Confirmed</option>
														<option value="in_progress">In Progress</option>
														<option value="completed">Completed</option>
														<option value="cancelled">Cancelled</option>
													</select>
												{:else}
													<span class="badge {getStatusBadgeClass(selectedEvent.status)}">
														{selectedEvent.status || 'Unknown'}
													</span>
												{/if}
											</div>
										</div>
									</div>

									<!-- Location & References -->
									<div class="space-y-4">
										<h3 class="text-lg font-semibold border-b pb-2">Location & References</h3>
										<div class="space-y-3">
											<div>
												<label class="text-sm font-medium opacity-70">Venue</label>
												{#if isInlineEditing}
													<VenueSelector
														value={editFormData.venue}
														placeholder="Search for a venue..."
														onchange={(e) => editFormData.venue = e.detail.value}
													/>
												{:else}
													<p class="text-base">
														{selectedEvent.venue_name || 'Not assigned'}
														{#if selectedEvent.venue}
															<span class="text-xs opacity-50 ml-2">(ID: {selectedEvent.venue})</span>
														{/if}
													</p>
												{/if}
											</div>
											<div>
												<label class="text-sm font-medium opacity-70">Program</label>
												{#if isInlineEditing}
													<ProgramSelector
														value={editFormData.program}
														placeholder="Search for a program..."
														onchange={(e) => editFormData.program = e.detail.value}
													/>
												{:else}
													<p class="text-base">
														{selectedEvent.program_name || 'Not assigned'}
														{#if selectedEvent.program}
															<span class="text-xs opacity-50 ml-2">(ID: {selectedEvent.program})</span>
														{/if}
													</p>
												{/if}
											</div>
											<div>
												<label class="text-sm font-medium opacity-70">Created</label>
												<p class="text-base">{formatDate(selectedEvent.created_at)}</p>
											</div>
										</div>
									</div>

									<!-- Notes -->
									<div class="md:col-span-2 space-y-4">
										<h3 class="text-lg font-semibold border-b pb-2">Notes</h3>
										<div>
											{#if isInlineEditing}
												<textarea
													class="textarea textarea-bordered textarea-sm w-full h-20"
													bind:value={editFormData.notes}
													placeholder="Additional notes or details..."
												></textarea>
											{:else}
												<p class="text-base whitespace-pre-wrap">{selectedEvent.notes || 'No notes provided'}</p>
											{/if}
										</div>
									</div>

									<!-- Performers Section -->
									{#if !isInlineEditing && selectedEvent.id}
										<div class="md:col-span-2">
											<EventPerformers eventId={selectedEvent.id} showDetails={true} />
										</div>
									{/if}

									<!-- Artists Assigned -->
									{#if selectedEvent.artist_assignments && selectedEvent.artist_assignments.length > 0}
										<!-- Enhanced artist assignments with full artist data -->
										<div class="md:col-span-2 space-y-4">
											<h3 class="text-lg font-semibold border-b pb-2">Assigned Artists</h3>
											<div class="overflow-x-auto">
												<table class="table table-zebra table-sm">
													<thead>
														<tr>
															<th>Artist</th>
															<th>Role</th>
															<th>Status</th>
															<th>Hours</th>
															<th>Rate</th>
														</tr>
													</thead>
													<tbody>
														{#each selectedEvent.artist_assignments as assignment}
															<tr>
																<td>
																	<span class="font-medium">{assignment.artist_name}</span>
																</td>
																<td>{assignment.role || 'Not specified'}</td>
																<td>
																	<span class="badge badge-sm {assignment.status === 'confirmed' ? 'badge-success' : assignment.status === 'pending' ? 'badge-warning' : 'badge-outline'}">
																		{assignment.status || 'Unknown'}
																	</span>
																</td>
																<td>{assignment.num_hours || 0}</td>
																<td>${assignment.hourly_rate || 0}</td>
															</tr>
														{/each}
													</tbody>
												</table>
											</div>
										</div>
									{:else if selectedEvent.artists && formatArtists(selectedEvent.artists).length > 0}
										<!-- Timesheet-imported data format -->
										<div class="md:col-span-2 space-y-4">
											<h3 class="text-lg font-semibold border-b pb-2">Assigned Artists</h3>
											<div class="overflow-x-auto">
												<table class="table table-zebra table-sm">
													<thead>
														<tr>
															<th>Artist Name</th>
															<th>Role</th>
															<th>Hours</th>
															<th>Rate</th>
															<th>Total</th>
															<th>Notes</th>
														</tr>
													</thead>
													<tbody>
														{#each formatArtists(selectedEvent.artists) as artist}
															<tr>
																<td class="font-medium">{artist.name || 'Unknown Artist'}</td>
																<td>{artist.role || 'performer'}</td>
																<td>{artist.hours || 0}</td>
																<td>{artist.rate || 'N/A'}</td>
																<td>{artist.total || '$0.00'}</td>
																<td class="text-xs">{artist.notes || ''}</td>
															</tr>
														{/each}
													</tbody>
												</table>
											</div>
										</div>
									{/if}

									<!-- Schedule -->
									{#if selectedEvent.schedule}
										<div class="md:col-span-2 space-y-4">
											<h3 class="text-lg font-semibold border-b pb-2">Event Schedule</h3>
											<ScheduleDisplay schedule={selectedEvent.schedule} />
										</div>
									{/if}

									<!-- Requirements -->
									{#if selectedEvent.requirements}
										<div class="md:col-span-2 space-y-4">
											<h3 class="text-lg font-semibold border-b pb-2">Event Requirements</h3>
											<RequirementsDisplay requirements={selectedEvent.requirements} />
										</div>
									{/if}

									<!-- Feedback -->
									{#if selectedEvent.feedback && selectedEvent.feedback.internal_notes && selectedEvent.feedback.internal_notes.length > 0}
										<div class="md:col-span-2 space-y-4">
											<h3 class="text-lg font-semibold border-b pb-2">Internal Notes</h3>
											<div class="space-y-3">
												{#each selectedEvent.feedback.internal_notes as note, index}
													<div class="bg-base-200 p-4 rounded-lg border-l-4 border-warning">
														<div class="flex items-start gap-3">
															<span class="badge badge-warning badge-sm">#{index + 1}</span>
															<div class="flex-1">
																{#if typeof note === 'string'}
																	<p class="text-base whitespace-pre-wrap">{note}</p>
																{:else if note.content || note.note || note.text}
																	<p class="text-base whitespace-pre-wrap">{note.content || note.note || note.text}</p>
																	{#if note.author}
																		<div class="text-xs opacity-60 mt-2">— {note.author}</div>
																	{/if}
																	{#if note.timestamp || note.date}
																		<div class="text-xs opacity-60 mt-1">
																			{formatDate(note.timestamp || note.date)}
																		</div>
																	{/if}
																{:else}
																	<pre class="text-sm bg-base-300 p-2 rounded overflow-x-auto">
{JSON.stringify(note, null, 2)}
																	</pre>
																{/if}
															</div>
														</div>
													</div>
												{/each}
											</div>
										</div>
									{/if}

									<!-- Event Summary Stats -->
									<div class="md:col-span-2 space-y-4">
										<h3 class="text-lg font-semibold border-b pb-2">Event Summary</h3>
										<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
											<div class="stat bg-base-200 rounded-lg p-4">
												<div class="stat-title text-xs">Status</div>
												<div class="stat-value text-sm">{selectedEvent.status || 'Unknown'}</div>
											</div>
											<div class="stat bg-base-200 rounded-lg p-4">
												<div class="stat-title text-xs">Artists</div>
												<div class="stat-value text-sm">
												{selectedEvent.artist_assignments?.length || formatArtists(selectedEvent.artists).length || 0}
												</div>
											</div>
											<div class="stat bg-base-200 rounded-lg p-4">
												<div class="stat-title text-xs">Venue</div>
												<div class="stat-value text-sm">{selectedEvent.venue_name || 'TBD'}</div>
											</div>
											<div class="stat bg-base-200 rounded-lg p-4">
												<div class="stat-title text-xs">Program</div>
												<div class="stat-value text-sm">{selectedEvent.program_name || 'None'}</div>
											</div>
										</div>
									</div>
								</div>
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