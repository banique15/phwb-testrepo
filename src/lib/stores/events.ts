import { writable, derived } from 'svelte/store'
import { createBaseStore } from './base'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'
import { logger } from '$lib/utils/logger'
import { eventSchema, type Event, type CreateEvent, type UpdateEvent } from '$lib/schemas/event'
import type { PaginationOptions, StoreState } from '$lib/types'
import { lookupUtils, enhancedLookup } from './lookup'

// Enhanced event type with resolved names
export interface EnhancedEvent extends Event {
	venue_name?: string
	program_name?: string
	venue_object?: any
	program_object?: any
	artist_assignments?: {
		artist_id: string
		artist_name: string
		role?: string
		status?: string
		num_hours?: number
		hourly_rate?: number
	}[]
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

// Function to enhance events with related data
function enhanceEvents(events: Event[]): EnhancedEvent[] {
	return events.map(event => {
		const enhanced: EnhancedEvent = { ...event }
		
		// Add venue information
		if (event.venue) {
			enhanced.venue_name = lookupUtils.getVenueName(event.venue, 'Venue Not Found')
			enhanced.venue_object = enhancedLookup.getVenue(event.venue)
		}
		
		// Add program information
		if (event.program) {
			enhanced.program_name = lookupUtils.getProgramName(event.program, 'Program Not Found')
			enhanced.program_object = enhancedLookup.getProgram(event.program)
		}
		
		// Enhance artist assignments
		if (event.artists && typeof event.artists === 'object' && event.artists.assignments) {
			enhanced.artist_assignments = event.artists.assignments.map((assignment: any) => ({
				...assignment,
				// Use existing artist_name if available, otherwise look it up
				artist_name: assignment.artist_name || lookupUtils.getArtistName(assignment.artist_id, 'Unknown Artist')
			}))
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
	update: baseStore.update,
	delete: baseStore.delete,
	getById: baseStore.getById,
	subscribeToChanges: baseStore.subscribeToChanges,
	unsubscribeFromChanges: baseStore.unsubscribeFromChanges,
	clearError: baseStore.clearError,
	reset: baseStore.reset,

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
						await supabase.from('phwb_events').select('id').order('id', { ascending: false }).limit(1).single()
							.then(({ data }) => {
								if (data) {
									return supabase.rpc('setval', { sequence_name: 'phwb_events_id_seq', new_value: data.id + 1 })
								}
							})
							.catch(logger.error)
					}
					
					const { data: retryData, error: retryError } = await supabase
						.from('phwb_events')
						.insert([validatedData])
						.select()
						.single()
					
					if (retryError) throw retryError
					return this.handleCreateSuccess(retryData)
				}
				
				if (error) {
					logger.error('Enhanced store create error:', error)
					throw error
				}

				logger.debug('Enhanced store: Event created successfully:', data)
				return this.handleCreateSuccess(data)
			} catch (error) {
				logger.error('Enhanced store create error:', error)
				const errorId = errorStore.handleError(error, 'Failed to create event')
				enhancedState.update(state => ({ ...state, loading: false, error: errorId }))
				throw error
			}
		},
		
		// Helper method to handle successful creation
		handleCreateSuccess(data: Event) {
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

				// Use the base store update method instead of custom logic
				const updatedEvent = await baseStore.update(normalizedId, updates)

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
				
				const { data, error } = await supabase
					.from('phwb_events')
					.select('*')
					.eq('id', id)
					.single()
				
				if (error) throw error
				
				return enhanceEvents([data])[0]
			} catch (error) {
				errorStore.handleError(error, 'Failed to fetch event')
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