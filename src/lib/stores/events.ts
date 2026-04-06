import { writable, derived } from 'svelte/store'
import { createBaseStore } from './base'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'
import { logger } from '$lib/utils/logger'
import { eventSchema, type Event, type CreateEvent, type UpdateEvent } from '$lib/schemas/event'
import type { PaginationOptions, StoreState } from '$lib/types'
import { lookupUtils, enhancedLookup } from './lookup'
import type { Facility } from '$lib/schemas/facility'
import type { Location } from '$lib/schemas/location'
import type { Artist } from '$lib/schemas/artist'
import { generatePayrollForEvent, reconcilePayrollForCompletedEvent } from '$lib/services/payroll-generator'
import type { GeneratedPayrollEntry } from '$lib/schemas/rate-card'
import {
	queueBookingConfirmationNotificationsForEvent,
	queueEventCompletedNotifications,
	queueInvitationNotificationsForEvent
} from '$lib/services/notification-producer'

// Enhanced event type with resolved names
export interface EnhancedEvent extends Event {
	venue_name?: string
	program_name?: string
	venue_object?: any
	program_object?: any
	// Facility and location data
	facility_name?: string
	facility_object?: Facility | null
	location_name?: string
	location_object?: Location | null
	artist_assignments?: {
		artist_id: string
		artist_name: string
		role?: string
		status?: string
		num_hours?: number
		hourly_rate?: number
	}[]
	// Full artist objects for contact info and profile photos
	artist_details?: Artist[]
}

// Create base store for standard CRUD operations
const baseStore = createBaseStore<Event, CreateEvent, UpdateEvent>({
	tableName: 'phwb_events',
	schema: eventSchema,
	searchFields: ['title', 'notes'],
	defaultSortBy: 'date',
	defaultSortOrder: 'desc'
})

// Enhanced state for enhanced data operations
const initialEnhancedState: StoreState<EnhancedEvent> = {
	items: [],
	loading: false,
	error: null,
	pagination: {
		total: 0,
		page: 1,
		limit: 10,
		totalPages: 0
	}
}

const enhancedState = writable<StoreState<EnhancedEvent>>(initialEnhancedState)

// Update events via server API route to avoid client-side RLS/singular-response issues.
async function updateEventViaApi(eventId: number, updates: UpdateEvent): Promise<Event> {
	const response = await fetch(`/api/events/${eventId}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(updates)
	})

	if (!response.ok) {
		const payload = await response.json().catch(() => ({ error: 'Unknown error' }))
		throw new Error(payload.error || `Failed to update event: ${response.statusText}`)
	}

	return response.json()
}

function normalizeArtistsPayloadForEvent(
	artists: any
): { assignments: Array<Record<string, any>> } | null {
	if (!artists) return null

	let assignments: Array<Record<string, any>> = []

	if (Array.isArray(artists)) {
		assignments = artists
			.filter((artistId) => typeof artistId === 'string' && artistId.length > 0)
			.map((artistId) => ({ artist_id: artistId, status: 'assigned', is_bandleader: false }))
	} else if (typeof artists === 'object' && Array.isArray(artists.assignments)) {
		assignments = artists.assignments
			.filter((assignment: any) => typeof assignment?.artist_id === 'string' && assignment.artist_id.length > 0)
			.map((assignment: any) => ({
				...assignment,
				is_bandleader: !!assignment?.is_bandleader
			}))
	} else {
		return null
	}

	let sawLeader = false
	const normalizedAssignments = assignments.map((assignment) => {
		if (assignment.is_bandleader && !sawLeader) {
			sawLeader = true
			return { ...assignment, is_bandleader: true }
		}
		return { ...assignment, is_bandleader: false }
	})

	return normalizedAssignments.length > 0 ? { assignments: normalizedAssignments } : null
}

// Function to enhance events with related data
function enhanceEvents(events: Event[]): EnhancedEvent[] {
	return events.map(event => {
		const enhanced: EnhancedEvent = { ...event }

		// Add venue information (legacy)
		if (event.venue) {
			enhanced.venue_name = lookupUtils.getVenueName(event.venue, 'Venue Not Found')
			enhanced.venue_object = enhancedLookup.getVenue(event.venue)
		}

		// Add facility and location information
		if (event.location_id) {
			const locationWithFacility = enhancedLookup.getLocationWithFacility(event.location_id)
			if (locationWithFacility) {
				enhanced.location_name = locationWithFacility.location.name
				enhanced.location_object = locationWithFacility.location
				if (locationWithFacility.facility) {
					enhanced.facility_name = locationWithFacility.facility.name
					enhanced.facility_object = locationWithFacility.facility
				}
			}
		} else if (event.venue) {
			// Fallback: treat venue as facility for backward compatibility
			enhanced.facility_name = enhanced.venue_name
			enhanced.facility_object = enhanced.venue_object as Facility | null
		}

		// Add program information
		if (event.program) {
			enhanced.program_name = lookupUtils.getProgramName(event.program, 'Program Not Found')
			enhanced.program_object = enhancedLookup.getProgram(event.program)
		}

		// Enhance artist assignments
		// Handle both new format (array of UUIDs) and legacy format (object with assignments)
		const artistIds: string[] = []

		if (event.artists) {
			// New format: Simple array of artist UUIDs
			if (Array.isArray(event.artists)) {
				enhanced.artist_assignments = event.artists.map((artistId: string) => {
					artistIds.push(artistId)
					return {
						artist_id: artistId,
						artist_name: lookupUtils.getArtistName(artistId, 'Unknown Artist'),
						role: 'performer'
					}
				})
			}
			// Legacy format: Object with assignments array
			else if (typeof event.artists === 'object' && event.artists.assignments) {
				enhanced.artist_assignments = event.artists.assignments.map((assignment: any) => {
					if (assignment.artist_id) artistIds.push(assignment.artist_id)
					return {
						...assignment,
						// Use existing artist_name if available, otherwise look it up
						artist_name: assignment.artist_name || lookupUtils.getArtistName(assignment.artist_id, 'Unknown Artist')
					}
				})
			}
		}

		// Get full artist objects for profile photos and contact info
		if (artistIds.length > 0) {
			enhanced.artist_details = artistIds
				.map(id => enhancedLookup.getArtist(id))
				.filter((a): a is Artist => a !== null)
		}

		return enhanced
	})
}

// Consolidated events store
export const eventsStore = {
	// Subscribe to basic store by default for backward compatibility
	subscribe: baseStore.subscribe,
	
	// Basic CRUD operations (delegate to base store, except create which is custom)
	fetchPaginated: baseStore.fetchPaginated,
	fetchAll: baseStore.fetchAll,
	create: async (eventData: CreateEvent) => {
		// Use enhanced create method that doesn't generate UUIDs
		return eventsStore.enhanced.create(eventData)
	},
	update: async (id: string | number, updates: UpdateEvent) => {
		const normalizedId = typeof id === 'string' ? parseInt(id, 10) : id
		if (!normalizedId || Number.isNaN(normalizedId)) {
			throw new Error(`Invalid event ID: ${id}`)
		}
		const reviewedPayrollEntries = (updates as any).__reviewedPayrollEntries as GeneratedPayrollEntry[] | undefined
		const sendInvitationNotifications =
			(updates as any).__sendInvitationNotifications === undefined
				? true
				: !!(updates as any).__sendInvitationNotifications
		const persistedUpdates = { ...(updates as any) }
		delete (persistedUpdates as any).__reviewedPayrollEntries
		delete (persistedUpdates as any).__sendInvitationNotifications
		if (Object.prototype.hasOwnProperty.call(persistedUpdates, 'artists')) {
			;(persistedUpdates as any).artists = normalizeArtistsPayloadForEvent((persistedUpdates as any).artists)
		}
		let previousEvent: Event | null = null
		try {
			previousEvent = await baseStore.getById(normalizedId)
		} catch {
			previousEvent = null
		}

		const updatedEvent = await updateEventViaApi(normalizedId, persistedUpdates)
		const hasArtistUpdates = Object.prototype.hasOwnProperty.call(updates, 'artists')
		const hasPayrollDriverUpdates =
			hasArtistUpdates ||
			Object.prototype.hasOwnProperty.call(updates, 'start_time') ||
			Object.prototype.hasOwnProperty.call(updates, 'end_time') ||
			Object.prototype.hasOwnProperty.call(updates, 'number_of_musicians') ||
			Object.prototype.hasOwnProperty.call(updates, 'pm_hours') ||
			Object.prototype.hasOwnProperty.call(updates, 'pm_rate') ||
			Object.prototype.hasOwnProperty.call(updates, 'production_manager_id') ||
			Object.prototype.hasOwnProperty.call(updates, 'production_manager_artist_id')
		if (hasArtistUpdates) {
			if (sendInvitationNotifications) {
				try {
					await queueInvitationNotificationsForEvent(
						updatedEvent,
						previousEvent?.artists,
						updatedEvent.artists
					)
				} catch (error) {
					logger.error('Failed queuing assignment invitation notifications:', error)
				}
			}
			try {
				await queueBookingConfirmationNotificationsForEvent(
					updatedEvent,
					previousEvent?.artists,
					updatedEvent.artists
				)
			} catch (error) {
				logger.error('Failed queuing booking confirmation notifications:', error)
			}
		}

		const isCompletedTransition = updates.status === 'completed' && updatedEvent.status === 'completed'
		if (isCompletedTransition) {
			try {
				const normalizedId = typeof updatedEvent.id === 'string'
					? parseInt(updatedEvent.id, 10)
					: updatedEvent.id
				if (normalizedId) {
					const generationResult = await generatePayrollForEvent(normalizedId, {
						dryRun: false,
						overriddenEntries: reviewedPayrollEntries
					})
					if (!generationResult.success || generationResult.errors.length > 0) {
						const reason = generationResult.errors.join('; ') || 'Unknown payroll generation failure'
						throw new Error(reason)
					}
					if (
						reviewedPayrollEntries &&
						reviewedPayrollEntries.length > 0 &&
						generationResult.entriesCreated === 0 &&
						generationResult.skippedEvents > 0
					) {
						throw new Error('Payroll was skipped because entries already exist for this event. Use reconciliation flow to adjust existing payroll.')
					}
				}
			} catch (error) {
				logger.error('Event completed but payroll generation failed:', error)
				throw error
			}
			try {
				await queueEventCompletedNotifications(updatedEvent, updatedEvent.artists)
			} catch (error) {
				logger.error('Failed queuing event completed notifications:', error)
			}
		}

		const isCompletedEventEdit = !isCompletedTransition && updatedEvent.status === 'completed' && hasPayrollDriverUpdates
		if (isCompletedEventEdit) {
			try {
				const normalizedId = typeof updatedEvent.id === 'string'
					? parseInt(updatedEvent.id, 10)
					: updatedEvent.id
				if (normalizedId) {
					const reconcileResult = await reconcilePayrollForCompletedEvent(normalizedId, { dryRun: false })
					if (!reconcileResult.success || reconcileResult.errors.length > 0) {
						const reason = reconcileResult.errors.join('; ') || 'Unknown payroll reconciliation failure'
						throw new Error(reason)
					}
				}
			} catch (error) {
				logger.error('Completed event payroll reconciliation failed:', error)
				throw error
			}
		}
		return updatedEvent
	},
	delete: baseStore.delete,
	getById: baseStore.getById,
	subscribeToChanges: baseStore.subscribeToChanges,
	unsubscribeFromChanges: baseStore.unsubscribeFromChanges,
	clearError: baseStore.clearError,
	reset: baseStore.reset,

	// Utility function to enhance events
	enhanceEvents,

	// Enhanced data operations
	enhanced: {
		subscribe: enhancedState.subscribe,
		
		async fetchPaginated(options: PaginationOptions) {
			enhancedState.update(state => ({ ...state, loading: true, error: null }))
			
			try {
				// Ensure lookup data is initialized
				await lookupUtils.initialize()
				
				let query = supabase
					.from('phwb_events')
					.select('*', { count: 'exact' })
				
				// Add search filter
				if (options.search) {
					query = query.or(`title.ilike.%${options.search}%,notes.ilike.%${options.search}%`)
				}
				
				// Add sorting
				const sortBy = options.sortBy || 'date'
				const ascending = options.sortOrder === 'asc'
				query = query.order(sortBy, { ascending })
				
				// Add pagination
				const from = (options.page - 1) * options.limit
				const to = from + options.limit - 1
				query = query.range(from, to)
				
				const { data, error, count } = await query
				
				if (error) throw error
				
				const totalPages = Math.ceil((count || 0) / options.limit)
				const enhancedEvents = enhanceEvents(data || [])
				
				enhancedState.update(state => ({
					...state,
					items: enhancedEvents,
					loading: false,
					pagination: {
						total: count || 0,
						page: options.page,
						limit: options.limit,
						totalPages
					}
				}))
				
				return { data: enhancedEvents, total: count || 0, totalPages }
			} catch (error) {
				const errorId = errorStore.handleError(error, 'Failed to fetch events')
				enhancedState.update(state => ({ ...state, loading: false, error: errorId }))
				throw error
			}
		},
		
		async fetchAll() {
			return this.fetchPaginated({ page: 1, limit: 1000 })
		},
		
		async create(eventData: CreateEvent) {
			enhancedState.update(state => ({ ...state, loading: true, error: null }))
			
			try {
				// Validate data
				const validatedData = eventSchema.omit({ id: true, created_at: true }).parse(eventData)
				if (Object.prototype.hasOwnProperty.call(validatedData, 'artists')) {
					;(validatedData as any).artists = normalizeArtistsPayloadForEvent((validatedData as any).artists)
				}

				logger.debug('Enhanced store: Creating event with data:', validatedData)

				// Insert without ID to let database generate it
				const { data, error } = await supabase
					.from('phwb_events')
					.insert([validatedData])
					.select()
					.single()

				// If we get a duplicate key error, sync the sequence and retry once
				if (error?.code === '23505' && error.message.includes('duplicate key')) {
					logger.warn('Duplicate key error detected, syncing sequence...')
					
					// Try to sync the sequence using RPC
					const { error: rpcError } = await supabase.rpc('sync_phwb_events_sequence')
					if (rpcError) {
						logger.error('RPC sync failed:', rpcError)
						// Fallback: manual sequence sync
						try {
							const { data } = await supabase
								.from('phwb_events')
								.select('id')
								.order('id', { ascending: false })
								.limit(1)
								.single()
							if (data) {
								await supabase.rpc('setval', {
									sequence_name: 'phwb_events_id_seq',
									new_value: data.id + 1
								})
							}
						} catch (e) {
							logger.error('Fallback sequence sync failed:', e)
						}
					}
					
					const { data: retryData, error: retryError } = await supabase
						.from('phwb_events')
						.insert([validatedData])
						.select()
						.single()
					
					if (retryError) throw retryError
					return await this.handleCreateSuccess(retryData)
				}
				
				if (error) {
					logger.error('Enhanced store create error:', error)
					throw error
				}

				logger.debug('Enhanced store: Event created successfully:', data)
				return await this.handleCreateSuccess(data)
			} catch (error) {
				logger.error('Enhanced store create error:', error)
				const errorId = errorStore.handleError(error, 'Failed to create event')
				enhancedState.update(state => ({ ...state, loading: false, error: errorId }))
				throw error
			}
		},
		
		// Helper method to handle successful creation
		async handleCreateSuccess(data: Event) {
			// Queue invitations for artists included during initial event creation
			// so create flow mirrors assignment updates on existing events.
			if (data.artists) {
				queueInvitationNotificationsForEvent(data, null, data.artists).catch((error) => {
					logger.error('Failed queuing assignment invitation notifications on event create:', error)
				})
			}

			// If an event is created directly as completed (e.g. backdated entry),
			// run the same completion automations that update-status flow runs.
			if (typeof data.status === 'string' && data.status.toLowerCase() === 'completed') {
				const normalizedId = typeof data.id === 'string' ? parseInt(data.id, 10) : data.id
				if (normalizedId && !Number.isNaN(normalizedId)) {
					try {
						const payrollResult = await generatePayrollForEvent(normalizedId, { dryRun: false })
						if (!payrollResult.success || payrollResult.errors.length > 0) {
							logger.error('Create-completed payroll generation failed:', {
								eventId: normalizedId,
								errors: payrollResult.errors
							})
						}
					} catch (error) {
						logger.error('Create-completed payroll generation threw an error:', error)
					}
				}

				try {
					await queueEventCompletedNotifications(data, data.artists)
				} catch (error) {
					logger.error('Create-completed notification queue failed:', error)
				}
			}

			const enhancedEvent = enhanceEvents([data])[0]
			
			enhancedState.update(state => ({
				...state,
				items: [enhancedEvent, ...state.items],
				loading: false,
				pagination: {
					...state.pagination,
					total: state.pagination.total + 1
				}
			}))
			
			return enhancedEvent
		},
		
		async update(id: string | number, updates: UpdateEvent) {
			enhancedState.update(state => ({ ...state, loading: true, error: null }))

			try {
				logger.debug('Enhanced store: Updating event', id, 'with data:', updates)

				// Normalize ID to the expected type
				const normalizedId = typeof id === 'string' ? parseInt(id, 10) : id
				if (!normalizedId || isNaN(normalizedId)) {
					throw new Error(`Invalid event ID: ${id}`)
				}

				// Use consolidated update method so status completion also triggers payroll automation
				const updatedEvent = await eventsStore.update(normalizedId, updates)

				logger.debug('Base store returned:', updatedEvent)
				
				// Apply enhancements to the updated event
				const enhancedEvent = enhanceEvents([updatedEvent])[0]
				
				enhancedState.update(state => ({
					...state,
					items: state.items.map(event => event.id === normalizedId ? enhancedEvent : event),
					loading: false
				}))
				
				return enhancedEvent
			} catch (error) {
				logger.error('Enhanced store update error:', error)
				const errorId = errorStore.handleError(error, 'Failed to update event')
				enhancedState.update(state => ({ ...state, loading: false, error: errorId }))
				throw error
			}
		},
		
		async delete(id: number) {
			enhancedState.update(state => ({ ...state, loading: true, error: null }))
			
			try {
				const { error } = await supabase
					.from('phwb_events')
					.delete()
					.eq('id', id)
				
				if (error) throw error
				
				enhancedState.update(state => ({
					...state,
					items: state.items.filter(event => event.id !== id),
					loading: false,
					pagination: {
						...state.pagination,
						total: state.pagination.total - 1
					}
				}))
			} catch (error) {
				const errorId = errorStore.handleError(error, 'Failed to delete event')
				enhancedState.update(state => ({ ...state, loading: false, error: errorId }))
				throw error
			}
		},
		
		// Get a single event by ID with enhancement
		async getById(id: number) {
			try {
				await lookupUtils.initialize()

				// Use maybeSingle() to handle cases where event doesn't exist
				const { data, error } = await supabase
					.from('phwb_events')
					.select('*')
					.eq('id', id)
					.maybeSingle()

				if (error) throw error
				if (!data) throw new Error('Event not found')

				return enhanceEvents([data])[0]
			} catch (error) {
				errorStore.handleError(error, 'Failed to fetch event')
				throw error
			}
		},

		// Bulk update multiple events
		async bulkUpdate(ids: number[], updates: UpdateEvent) {
			enhancedState.update(state => ({ ...state, loading: true, error: null }))

			try {
				logger.debug('Bulk updating events:', ids, 'with:', updates)

				const { data, error } = await supabase
					.from('phwb_events')
					.update(updates)
					.in('id', ids)
					.select()

				if (error) throw error

				const enhancedEvents = enhanceEvents(data || [])

				if (updates.status === 'completed') {
					await Promise.all(
						(data || []).map(async (event) => {
							try {
								await generatePayrollForEvent(event.id, { dryRun: false })
							} catch (error) {
								logger.error('Bulk complete payroll generation failed:', error)
							}
							try {
								await queueEventCompletedNotifications(event, event.artists)
							} catch (error) {
								logger.error('Bulk complete notification queue failed:', error)
							}
						})
					)
				}

				enhancedState.update(state => ({
					...state,
					items: state.items.map(event => {
						const updated = enhancedEvents.find(e => e.id === event.id)
						return updated || event
					}),
					loading: false
				}))

				return enhancedEvents
			} catch (error) {
				logger.error('Bulk update error:', error)
				const errorId = errorStore.handleError(error, 'Failed to bulk update events')
				enhancedState.update(state => ({ ...state, loading: false, error: errorId }))
				throw error
			}
		},

		// Bulk delete multiple events
		async bulkDelete(ids: number[]) {
			enhancedState.update(state => ({ ...state, loading: true, error: null }))

			try {
				logger.debug('Bulk deleting events:', ids)

				const { error } = await supabase
					.from('phwb_events')
					.delete()
					.in('id', ids)

				if (error) throw error

				enhancedState.update(state => ({
					...state,
					items: state.items.filter(event => !ids.includes(event.id!)),
					loading: false,
					pagination: {
						...state.pagination,
						total: state.pagination.total - ids.length
					}
				}))
			} catch (error) {
				logger.error('Bulk delete error:', error)
				const errorId = errorStore.handleError(error, 'Failed to bulk delete events')
				enhancedState.update(state => ({ ...state, loading: false, error: errorId }))
				throw error
			}
		},

		// Enhanced real-time subscriptions with lookups
		subscribeToChanges() {
			return baseStore.subscribeToChanges({
				onInsert: (payload) => {
					const enhancedEvent = enhanceEvents([payload.new as Event])[0]
					enhancedState.update(state => ({
						...state,
						items: [enhancedEvent, ...state.items],
						pagination: {
							...state.pagination,
							total: state.pagination.total + 1
						}
					}))
				},
				onUpdate: (payload) => {
					const enhancedEvent = enhanceEvents([payload.new as Event])[0]
					enhancedState.update(state => ({
						...state,
						items: state.items.map(event => 
							event.id === enhancedEvent.id ? enhancedEvent : event
						)
					}))
				},
				onDelete: (payload) => {
					enhancedState.update(state => ({
						...state,
						items: state.items.filter(event => event.id !== (payload.old as Event).id),
						pagination: {
							...state.pagination,
							total: state.pagination.total - 1
						}
					}))
				}
			})
		},

		clearError() {
			enhancedState.update(state => ({ ...state, error: null }))
		},

		reset() {
			enhancedState.set(initialEnhancedState)
		}
	}
}

// Export legacy interfaces for backward compatibility
export const {
	fetchPaginated,
	fetchAll,
	create: createEvent,
	update: updateEvent,
	delete: deleteEvent,
	getById: getEventById,
	subscribeToChanges: subscribeToEventChanges,
	unsubscribeFromChanges: unsubscribeFromEventChanges,
	clearError: clearEventError,
	reset: resetEventsStore
} = eventsStore

// Export enhanced store as a separate interface (for migration)
export const eventsEnhancedStore = eventsStore.enhanced

/**
 * Complete an event and auto-generate payroll entries
 * This should be called when an event is marked as completed
 */
export async function completeEventWithPayroll(
	eventId: number,
	userId?: string
): Promise<{ event: EnhancedEvent; payrollGenerated: boolean; payrollErrors: string[] }> {
	try {
		// First, update the event status to 'completed'
		const updatedEvent = await eventsStore.enhanced.update(eventId, { status: 'completed' })

		// Then, generate payroll for this event
		const payrollResult = await generatePayrollForEvent(eventId, { 
			dryRun: false, 
			userId 
		})

		logger.info('Payroll generation result:', payrollResult)

		return {
			event: updatedEvent,
			payrollGenerated: payrollResult.success && payrollResult.entriesCreated > 0,
			payrollErrors: payrollResult.errors
		}
	} catch (error) {
		logger.error('Failed to complete event with payroll:', error)
		throw error
	}
}