import { writable, derived } from 'svelte/store'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'
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

const initialState: StoreState<EnhancedEvent> = {
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

export const eventsEnhancedState = writable<StoreState<EnhancedEvent>>(initialState)

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
				artist_name: lookupUtils.getArtistName(assignment.artist_id, 'Artist Not Found')
			}))
		}
		
		return enhanced
	})
}

export const eventsEnhancedStore = {
	subscribe: eventsEnhancedState.subscribe,
	
	async fetchPaginated(options: PaginationOptions) {
		eventsEnhancedState.update(state => ({ ...state, loading: true, error: null }))
		
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
			
			eventsEnhancedState.update(state => ({
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
			eventsEnhancedState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async fetchAll() {
		return this.fetchPaginated({ page: 1, limit: 1000 })
	},
	
	async create(eventData: CreateEvent) {
		eventsEnhancedState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			// Validate data
			const validatedData = eventSchema.omit({ id: true, created_at: true }).parse(eventData)
			
			const { data, error } = await supabase
				.from('phwb_events')
				.insert([validatedData])
				.select()
				.single()
			
			if (error) throw error
			
			const enhancedEvent = enhanceEvents([data])[0]
			
			eventsEnhancedState.update(state => ({
				...state,
				items: [enhancedEvent, ...state.items],
				loading: false,
				pagination: {
					...state.pagination,
					total: state.pagination.total + 1
				}
			}))
			
			return enhancedEvent
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to create event')
			eventsEnhancedState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async update(id: number, updates: UpdateEvent) {
		eventsEnhancedState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			// Validate data
			const validatedData = eventSchema.omit({ id: true, created_at: true }).partial().parse(updates)
			
			const { data, error } = await supabase
				.from('phwb_events')
				.update(validatedData)
				.eq('id', id)
				.select()
				.single()
			
			if (error) throw error
			
			const enhancedEvent = enhanceEvents([data])[0]
			
			eventsEnhancedState.update(state => ({
				...state,
				items: state.items.map(event => event.id === id ? enhancedEvent : event),
				loading: false
			}))
			
			return enhancedEvent
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to update event')
			eventsEnhancedState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async delete(id: number) {
		eventsEnhancedState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			const { error } = await supabase
				.from('phwb_events')
				.delete()
				.eq('id', id)
			
			if (error) throw error
			
			eventsEnhancedState.update(state => ({
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
			eventsEnhancedState.update(state => ({ ...state, loading: false, error: errorId }))
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
	}
}