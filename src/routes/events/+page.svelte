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
	const DeleteConfirm = () => import('./modals/DeleteConfirm.svelte')
	import ScheduleDisplay from './components/ScheduleDisplay.svelte'
	import RequirementsDisplay from './components/RequirementsDisplay.svelte'
	import EventsSearchFilters from './components/EventsSearchFilters.svelte'
	import UiCalendar from '$lib/components/ui/Calendar.svelte'
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
		{ value: 'upcoming', label: 'Upcoming' },
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
	let showDeleteModal = $state(false)
	let createFormInitialDate = $state<string | undefined>(undefined)
	
	let eventArtistsCount = $state(0)

	// External tab switch for jumping to performers tab
	let externalActiveTab = $state<string | null>(null)

	// Bulk selection state
	let selectedEventIds = $state<Set<number>>(new Set())

	// Calendar view panel state for resizable layout
	let rightPanelExpanded = $state(false)
	let rightPanelWidth = $state(33) // Percentage, default 33% (1/3)
	const MIN_PANEL_WIDTH = 400 // Minimum width in pixels
	const MAX_PANEL_WIDTH = 60 // Maximum percentage
	const DEFAULT_PANEL_WIDTH = 33 // Default percentage

	const STORAGE_KEY = 'phwb-selected-event'

	// Track newly created events that need to be merged with server data
	let newlyCreatedEvents = $state<EnhancedEvent[]>([])
	
	// Track updated events to merge with server data
	let updatedEvents = $state<Map<number, EnhancedEvent>>(new Map())
	
	// Track deleted event IDs to filter them out from the list
	let deletedEventIds = $state<Set<number>>(new Set())

	// Use server-loaded data merged with any newly created or updated events
	let events = $derived.by(() => {
		const serverEvents = data.events || []

		// Start with server events and apply updates
		let mergedEvents = serverEvents.map((e: EnhancedEvent) => {
			const updated = updatedEvents.get(e.id!)
			return updated || e
		})

		// Filter out deleted events
		if (deletedEventIds.size > 0) {
			mergedEvents = mergedEvents.filter((e: EnhancedEvent) => !deletedEventIds.has(e.id!))
		}

		// If we have newly created events, merge them with server data
		if (newlyCreatedEvents.length > 0) {
			// Get IDs of new events to avoid duplicates
			const newIds = new Set(newlyCreatedEvents.map(e => e.id))
			// Filter out any duplicates from merged events and prepend new events
			const filteredMergedEvents = mergedEvents.filter((e: EnhancedEvent) => !newIds.has(e.id))
			return [...newlyCreatedEvents, ...filteredMergedEvents]
		}

		return mergedEvents
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
		if (browser && !hasRestoredSelection && events && events.length > 0) {
			hasRestoredSelection = true

			// URL parameters take priority over localStorage
			const urlId = $page.url.searchParams.get('id')

			if (urlId) {
				const urlEvent = events.find((e: EnhancedEvent) => e.id === Number(urlId))
				if (urlEvent) {
					selectedEvent = urlEvent
					// If edit=true, switch to settings tab (where edit mode is)
					const shouldEdit = $page.url.searchParams.get('edit') === 'true'
					if (shouldEdit) {
						externalActiveTab = 'settings'
					}
					// Preserve URL params - don't clear them
					// This allows direct links to work and be shareable
					return
				}
			}

			// Fall back to localStorage if no URL param
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
		showCreateForm = false
		// Use updated event from cache if available, otherwise use the passed event
		const eventToSelect = updatedEvents.get(event.id!) || event
		selectedEvent = eventToSelect
		// Persist selection to localStorage
		if (browser && eventToSelect.id) {
			localStorage.setItem(STORAGE_KEY, eventToSelect.id.toString())
			// Update URL to reflect selected event
			const searchParams = new URLSearchParams($page.url.searchParams)
			searchParams.set('id', eventToSelect.id.toString())
			// Preserve other query params like filters
			await goto(`/events?${searchParams.toString()}`, { replaceState: true, keepFocus: true })
		}
		// Load artists count
		if (eventToSelect.artists) {
			const artists = formatArtists(eventToSelect.artists)
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
		return formatDateWithRelative(item.date, item.start_time, item.end_time)
	}

	function getEventDetail(item: any): string {
		return item.status || ''
	}

	async function handleSelectEvent(event: CustomEvent<{ item: EnhancedEvent }>) {
		showCreateForm = false
		await selectEvent(event.detail.item)
	}

	async function updateEventField(field: string, value: any) {
		if (!selectedEvent?.id) return

		try {
			// Prepare update data - handle null/empty values
			const finalValue = value === "" || value === null ? null : value
			const updateData: any = { [field]: finalValue }

			// Validate the field only if value is not null (for optional fields)
			if (finalValue !== null) {
				const fieldSchema =
					updateEventSchema.shape[
						field as keyof typeof updateEventSchema.shape
					]
				if (fieldSchema) {
					fieldSchema.parse(finalValue)
				}
			}

			// Update event
			const updatedEvent = await eventsStore.update(selectedEvent.id, updateData)
			
			// Enhance the updated event
			const enhanced = eventsStore.enhanceEvents([updatedEvent])[0]
			
			// Update selectedEvent
			selectedEvent = enhanced
			
			// Also update the event in the updatedEvents cache so it persists when navigating
			updatedEvents.set(enhanced.id!, enhanced)
			updatedEvents = new Map(updatedEvents) // Trigger reactivity
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
		// Append 'T00:00:00' to treat date as local time, not UTC
		const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
		return date.toLocaleDateString('en-US', {
			month: '2-digit',
			day: '2-digit',
			year: 'numeric'
		})
	}

	function formatDateWithRelative(dateStr: string | undefined, startTime?: string, endTime?: string): string {
		if (!dateStr) return 'No date specified'

		// Append 'T00:00:00' to treat date as local time, not UTC
		const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
		const today = new Date()
		const now = new Date()
		today.setHours(0, 0, 0, 0)
		const dateOnly = new Date(date)
		dateOnly.setHours(0, 0, 0, 0)

		// Format date as "Dec 3, 2025"
		const formattedDate = date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})

		// Calculate difference in days
		const diffTime = dateOnly.getTime() - today.getTime()
		const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

		let relativeText: string

		if (diffDays === 0) {
			relativeText = 'Today'
		} else if (diffDays === 1) {
			relativeText = 'Tomorrow'
		} else if (diffDays === -1) {
			relativeText = 'Yesterday'
		} else if (diffDays > 1 && diffDays <= 7) {
			relativeText = `In ${diffDays} days`
		} else if (diffDays > 7 && diffDays <= 14) {
			relativeText = 'Next week'
		} else if (diffDays > 14 && diffDays <= 30) {
			relativeText = `In ${Math.round(diffDays / 7)} weeks`
		} else if (diffDays > 30 && diffDays <= 60) {
			relativeText = 'Next month'
		} else if (diffDays > 60 && diffDays <= 365) {
			const months = Math.round(diffDays / 30)
			relativeText = `In ${months} months`
		} else if (diffDays > 365) {
			relativeText = 'Over a year away'
		} else if (diffDays < -1 && diffDays >= -7) {
			relativeText = `${Math.abs(diffDays)} days ago`
		} else if (diffDays < -7 && diffDays >= -14) {
			relativeText = 'Last week'
		} else if (diffDays < -14 && diffDays >= -30) {
			relativeText = `${Math.round(Math.abs(diffDays) / 7)} weeks ago`
		} else if (diffDays < -30 && diffDays >= -60) {
			relativeText = 'Last month'
		} else if (diffDays < -60 && diffDays >= -365) {
			const months = Math.round(Math.abs(diffDays) / 30)
			relativeText = `${months} months ago`
		} else {
			relativeText = 'Over a year ago'
		}

		// Format time range
		let timeStr = ''
		if (startTime) {
			const formatTimeShort = (t: string) => {
				const [hours, minutes] = t.split(':').map(Number)
				const period = hours >= 12 ? 'pm' : 'am'
				const hour12 = hours % 12 || 12
				return minutes === 0 ? `${hour12}${period}` : `${hour12}:${minutes.toString().padStart(2, '0')}${period}`
			}

			timeStr = formatTimeShort(startTime)
			if (endTime) {
				timeStr += `-${formatTimeShort(endTime)}`
			}
		}

		// Calculate relative time for today's events
		let timeRelative = ''
		if (diffDays === 0 && startTime) {
			const [startHours, startMinutes] = startTime.split(':').map(Number)
			const eventStart = new Date(date)
			eventStart.setHours(startHours, startMinutes, 0, 0)

			const diffMs = eventStart.getTime() - now.getTime()
			const diffMins = Math.round(diffMs / (1000 * 60))

			if (diffMins > 0 && diffMins <= 60) {
				timeRelative = `in ${diffMins} min`
			} else if (diffMins > 60 && diffMins <= 180) {
				const hours = Math.round(diffMins / 60)
				timeRelative = `in ${hours} hr${hours > 1 ? 's' : ''}`
			} else if (diffMins < 0 && diffMins >= -180) {
				const minsAgo = Math.abs(diffMins)
				if (minsAgo <= 60) {
					timeRelative = `${minsAgo} min ago`
				} else {
					const hours = Math.round(minsAgo / 60)
					timeRelative = `${hours} hr${hours > 1 ? 's' : ''} ago`
				}
			}
		}

		// Build final string
		let result = `${formattedDate} · ${relativeText}`
		if (timeStr) {
			result += ` · ${timeStr}`
			if (timeRelative) {
				result += ` (${timeRelative})`
			}
		}

		return result
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
			case 'draft':
				return 'badge-ghost'
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
		// Append 'T00:00:00' to treat date as local time, not UTC
		const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
		return date > new Date()
	}

	function isPast(dateStr: string | undefined) {
		if (!dateStr) return false
		// Append 'T00:00:00' to treat date as local time, not UTC
		const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
		return date < new Date()
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
			result = result.filter((e: EnhancedEvent) => {
				const titleMatch = typeof e.title === 'string' && e.title.toLowerCase().includes(searchLower)
				const notesMatch = typeof e.notes === 'string' && e.notes.toLowerCase().includes(searchLower)
				return titleMatch || notesMatch
			})
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

			// Helper to parse date as local time
			const parseLocalDate = (dateStr: string) => {
				return new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
			}

			switch (clientFilters.dateFilter) {
				case 'upcoming':
					result = result.filter((e: EnhancedEvent) => e.date && parseLocalDate(e.date) >= today)
					break
				case 'past':
					result = result.filter((e: EnhancedEvent) => e.date && parseLocalDate(e.date) < today)
					break
				case 'this_week':
					const weekStart = new Date(today)
					weekStart.setDate(weekStart.getDate() - weekStart.getDay())
					const weekEnd = new Date(weekStart)
					weekEnd.setDate(weekEnd.getDate() + 6)
					result = result.filter((e: EnhancedEvent) => {
						if (!e.date) return false
						const eventDate = parseLocalDate(e.date)
						return eventDate >= weekStart && eventDate <= weekEnd
					})
					break
				case 'this_month':
					const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
					const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
					result = result.filter((e: EnhancedEvent) => {
						if (!e.date) return false
						const eventDate = parseLocalDate(e.date)
						return eventDate >= monthStart && eventDate <= monthEnd
					})
					break
				case 'custom':
					if (clientFilters.dateFrom) {
						const fromDate = parseLocalDate(clientFilters.dateFrom)
						result = result.filter((e: EnhancedEvent) => e.date && parseLocalDate(e.date) >= fromDate)
					}
					if (clientFilters.dateTo) {
						const toDate = parseLocalDate(clientFilters.dateTo)
						result = result.filter((e: EnhancedEvent) => e.date && parseLocalDate(e.date) <= toDate)
					}
					break
			}
		}

		// Apply sorting
		const today = new Date()
		today.setHours(0, 0, 0, 0)

		// Helper to parse date as local time
		const parseLocalDate = (dateStr: string) => {
			return new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
		}

		result = [...result].sort((a: EnhancedEvent, b: EnhancedEvent) => {
			switch (sortBy) {
				case 'upcoming':
					// Future events first (sorted by date asc), then past events (sorted by date desc)
					const aDate = a.date ? parseLocalDate(a.date) : new Date(0)
					const bDate = b.date ? parseLocalDate(b.date) : new Date(0)
					const aIsFuture = aDate >= today
					const bIsFuture = bDate >= today
					if (aIsFuture && !bIsFuture) return -1
					if (!aIsFuture && bIsFuture) return 1
					if (aIsFuture && bIsFuture) return aDate.getTime() - bDate.getTime()
					return bDate.getTime() - aDate.getTime()
				case 'recent':
					return (b.date || '').localeCompare(a.date || '')
				case 'title-asc':
					return (a.title || '').localeCompare(b.title || '')
				case 'title-desc':
					return (b.title || '').localeCompare(a.title || '')
				case 'status':
					const statusOrder = ['in_progress', 'confirmed', 'planned', 'completed', 'cancelled']
					const aIndex = statusOrder.indexOf(a.status || '')
					const bIndex = statusOrder.indexOf(b.status || '')
					if (aIndex !== bIndex) return aIndex - bIndex
					return (a.date || '').localeCompare(b.date || '')
				case 'venue':
					const aVenue = a.venue_name || ''
					const bVenue = b.venue_name || ''
					if (aVenue !== bVenue) return aVenue.localeCompare(bVenue)
					return (a.date || '').localeCompare(b.date || '')
				case 'program':
					const aProgram = a.program_name || ''
					const bProgram = b.program_name || ''
					if (aProgram !== bProgram) return aProgram.localeCompare(bProgram)
					return (a.date || '').localeCompare(b.date || '')
				case 'created':
					return (b.created_at || '').localeCompare(a.created_at || '')
				default:
					return 0
			}
		})

		return result
	})

	// Derive selected events from filtered events (must be after filteredEvents is defined)
	let selectedEvents = $derived(filteredEvents.filter(e => selectedEventIds.has(e.id!)))

	// Convert to CalendarEvent[] for the dashboard calendar component
	let calendarEvents = $derived(filteredEvents.map((e: EnhancedEvent) => ({
		id: e.id!,
		title: e.title || 'Untitled',
		date: e.date || '',
		start_time: e.start_time || null,
		end_time: e.end_time || null,
		status: e.status || 'planned',
		program_id: e.program ?? null,
		program_name: e.program_name || null
	})))

	// Recalculate statistics based on filtered events
	let filteredStatistics = $derived.by(() => {
		const parseLocalDate = (dateStr: string) => {
			return new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
		}
		const now = new Date()
		return {
			total: filteredEvents.length,
			scheduled: filteredEvents.filter((e: EnhancedEvent) => e.status === 'scheduled').length,
			confirmed: filteredEvents.filter((e: EnhancedEvent) => e.status === 'confirmed').length,
			completed: filteredEvents.filter((e: EnhancedEvent) => e.status === 'completed').length,
			cancelled: filteredEvents.filter((e: EnhancedEvent) => e.status === 'cancelled').length,
			upcoming: filteredEvents.filter((e: EnhancedEvent) => e.date && parseLocalDate(e.date) > now).length,
			past: filteredEvents.filter((e: EnhancedEvent) => e.date && parseLocalDate(e.date) < now).length
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
		createFormInitialDate = undefined
		showCreateForm = true
	}

	function openCreateModalForDate(dateStr: string) {
		selectedEvent = null
		createFormInitialDate = dateStr
		showCreateForm = true
	}

	function closeCalendarPanel() {
		selectedEvent = null
		showCreateForm = false
		createFormInitialDate = undefined
		rightPanelWidth = DEFAULT_PANEL_WIDTH
		rightPanelExpanded = false
	}
	
	function closeCreateModal() {
		showCreateModal = false
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
			const deletedId = selectedEvent.id
			// Add deleted event ID to the set to filter it out from the list
			if (deletedId) {
				deletedEventIds = new Set([...deletedEventIds, deletedId])
			}
			selectedEvent = null
			if (browser) {
				localStorage.removeItem(STORAGE_KEY)
			}
		}
	}

	async function handleEventUpdated(updatedEvent: EnhancedEvent) {
		// Update the selected event with the new data
		selectedEvent = updatedEvent
		// Also update in the events list if it exists there
		const eventIndex = events.findIndex((e: EnhancedEvent) => e.id === updatedEvent.id)
		if (eventIndex >= 0) {
			// Update the event in the list
			const updatedEvents = [...events]
			updatedEvents[eventIndex] = updatedEvent
			// Note: We can't directly update the derived store, but the next fetch will get the updated data
		}
	}

	async function handleCreateFormSuccess(createdEvent?: EnhancedEvent) {
		showCreateForm = false
		if (createdEvent) {
			newlyCreatedEvents = [createdEvent, ...newlyCreatedEvents]
			await selectEvent(createdEvent)
		}
	}

	function handleCalendarEventCreated(createdEvent: EnhancedEvent) {
		newlyCreatedEvents = [createdEvent, ...newlyCreatedEvents]
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
				// Add deleted event IDs to the set to filter them out from the list
				deletedEventIds = new Set([...deletedEventIds, ...eventIds])
				// Clear selected event if it was deleted
				if (selectedEvent && eventIds.includes(selectedEvent.id!)) {
					selectedEvent = null
					if (browser) {
						localStorage.removeItem(STORAGE_KEY)
					}
				}
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
			<!-- Calendar View - Same layout as Dashboard: scrollable content + Calendar -->
			<div class="flex-1 min-h-0 flex flex-col">
				<div class="flex-none px-4 py-2 bg-base-100 border-b border-base-200">
					<div class="flex items-center justify-between">
						<h1 class="text-xl font-bold leading-tight">Events - Calendar</h1>
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
					</div>
				</div>
				<div class="flex-1 overflow-y-auto p-4 lg:p-6">
					<UiCalendar
						events={calendarEvents}
						onEventCreated={handleCalendarEventCreated}
					/>
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
							<div class="dropdown dropdown-end">
								<button
									tabindex="0"
									class="btn btn-xs border border-base-content/20 bg-base-100 hover:bg-base-200 text-base-content"
									title="Sort events"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
									</svg>
									<span class="hidden sm:inline ml-1 whitespace-nowrap truncate max-w-[100px]">{sortOptions.find(o => o.value === sortBy)?.label || 'Sort'}</span>
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
											onDelete={openDeleteModal}
										/>
										</div>

										<!-- Tabs Section -->
										<div class="flex-1 min-h-0 overflow-y-auto">
											<EventTabs
												event={event}
												onUpdateField={updateEventField}
												onDelete={openDeleteModal}
												{externalActiveTab}
												onEventUpdated={handleEventUpdated}
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