import { writable } from 'svelte/store'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'
import { programSchema, type Program, type CreateProgram, type UpdateProgram } from '$lib/schemas/program'
import type { PaginationOptions, StoreState } from '$lib/types'

const initialState: StoreState<Program> = {
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

export const programsState = writable<StoreState<Program>>(initialState)

export const programsStore = {
	subscribe: programsState.subscribe,
	
	async fetchPaginated(options: PaginationOptions) {
		programsState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			let query = supabase
				.from('phwb_programs')
				.select('*', { count: 'exact' })
			
			// Add search filter
			if (options.search) {
				query = query.or(`title.ilike.%${options.search}%,description.ilike.%${options.search}%`)
			}
			
			// Add sorting
			const sortBy = options.sortBy || 'created_at'
			const ascending = options.sortOrder === 'asc'
			query = query.order(sortBy, { ascending })
			
			// Add pagination
			const from = (options.page - 1) * options.limit
			const to = from + options.limit - 1
			query = query.range(from, to)
			
			const { data, error, count } = await query
			
			if (error) throw error
			
			const totalPages = Math.ceil((count || 0) / options.limit)
			
			programsState.update(state => ({
				...state,
				items: data || [],
				loading: false,
				pagination: {
					total: count || 0,
					page: options.page,
					limit: options.limit,
					totalPages
				}
			}))
			
			return { data: data || [], total: count || 0, totalPages }
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to fetch programs')
			programsState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async fetchAll() {
		return this.fetchPaginated({ page: 1, limit: 1000 })
	},
	
	async create(programData: CreateProgram) {
		programsState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			// Validate data
			const validatedData = programSchema.omit({ id: true, created_at: true }).parse(programData)
			
			const { data, error } = await supabase
				.from('phwb_programs')
				.insert([validatedData])
				.select()
				.single()
			
			if (error) throw error
			
			programsState.update(state => ({
				...state,
				items: [data, ...state.items],
				loading: false,
				pagination: {
					...state.pagination,
					total: state.pagination.total + 1
				}
			}))
			
			return data
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to create program')
			programsState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async update(id: number, updates: UpdateProgram) {
		programsState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			// Validate data
			const validatedData = programSchema.omit({ id: true, created_at: true }).partial().parse(updates)
			
			const { data, error } = await supabase
				.from('phwb_programs')
				.update(validatedData)
				.eq('id', id)
				.select()
				.single()
			
			if (error) throw error
			
			programsState.update(state => ({
				...state,
				items: state.items.map(program => program.id === id ? data : program),
				loading: false
			}))
			
			return data
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to update program')
			programsState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async delete(id: number) {
		programsState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			const { error } = await supabase
				.from('phwb_programs')
				.delete()
				.eq('id', id)
			
			if (error) throw error
			
			programsState.update(state => ({
				...state,
				items: state.items.filter(program => program.id !== id),
				loading: false,
				pagination: {
					...state.pagination,
					total: state.pagination.total - 1
				}
			}))
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to delete program')
			programsState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	}
}