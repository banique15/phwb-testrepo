import { writable } from 'svelte/store'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'
import { configOptionSchema, type ConfigOption, type CreateConfigOption, type UpdateConfigOption } from '$lib/schemas/config'
import type { PaginationOptions, StoreState } from '$lib/types'

const initialState: StoreState<ConfigOption> = {
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

export const configState = writable<StoreState<ConfigOption>>(initialState)

export const configStore = {
	subscribe: configState.subscribe,
	
	async fetchPaginated(options: PaginationOptions) {
		configState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			let query = supabase
				.from('phwb_config_options')
				.select('*', { count: 'exact' })
			
			// Add search filter
			if (options.search) {
				query = query.or(`entity.ilike.%${options.search}%,field.ilike.%${options.search}%,value.ilike.%${options.search}%`)
			}
			
			// Add sorting
			const sortBy = options.sortBy || 'entity'
			const ascending = options.sortOrder === 'asc'
			query = query.order(sortBy, { ascending })
			
			// Add pagination
			const from = (options.page - 1) * options.limit
			const to = from + options.limit - 1
			query = query.range(from, to)
			
			const { data, error, count } = await query
			
			if (error) throw error
			
			const totalPages = Math.ceil((count || 0) / options.limit)
			
			configState.update(state => ({
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
			const errorId = errorStore.handleError(error, 'Failed to fetch config options')
			configState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async fetchAll() {
		return this.fetchPaginated({ page: 1, limit: 1000 })
	},
	
	async fetchByEntity(entity: string) {
		configState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			const { data, error } = await supabase
				.from('phwb_config_options')
				.select('*')
				.eq('entity', entity)
				.eq('active', true)
				.order('order_num', { ascending: true })
			
			if (error) throw error
			
			configState.update(state => ({ ...state, loading: false }))
			return data
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to fetch config options by entity')
			configState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async create(optionData: CreateConfigOption) {
		configState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			// Validate data
			const validatedData = configOptionSchema.omit({ id: true, created_at: true, updated_at: true }).parse(optionData)
			
			const { data, error } = await supabase
				.from('phwb_config_options')
				.insert([validatedData])
				.select()
				.single()
			
			if (error) throw error
			
			configState.update(state => ({
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
			const errorId = errorStore.handleError(error, 'Failed to create config option')
			configState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async update(id: string, updates: UpdateConfigOption) {
		configState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			// Validate data
			const validatedData = configOptionSchema.omit({ id: true, created_at: true, updated_at: true }).partial().parse(updates)
			
			const { data, error } = await supabase
				.from('phwb_config_options')
				.update(validatedData)
				.eq('id', id)
				.select()
				.single()
			
			if (error) throw error
			
			configState.update(state => ({
				...state,
				items: state.items.map(option => option.id === id ? data : option),
				loading: false
			}))
			
			return data
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to update config option')
			configState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async delete(id: string) {
		configState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			const { error } = await supabase
				.from('phwb_config_options')
				.delete()
				.eq('id', id)
			
			if (error) throw error
			
			configState.update(state => ({
				...state,
				items: state.items.filter(option => option.id !== id),
				loading: false,
				pagination: {
					...state.pagination,
					total: state.pagination.total - 1
				}
			}))
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to delete config option')
			configState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	}
}