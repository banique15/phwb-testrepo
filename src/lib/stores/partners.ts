import { writable } from 'svelte/store'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'
import { partnerSchema, type Partner, type CreatePartner, type UpdatePartner } from '$lib/schemas/partner'
import type { PaginationOptions, StoreState } from '$lib/types'

const initialState: StoreState<Partner> = {
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

export const partnersState = writable<StoreState<Partner>>(initialState)

export const partnersStore = {
	subscribe: partnersState.subscribe,
	
	async fetchPaginated(options: PaginationOptions) {
		partnersState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			let query = supabase
				.from('phwb_partners')
				.select('*', { count: 'exact' })
			
			// Add search filter
			if (options.search) {
				query = query.or(`name.ilike.%${options.search}%,organization.ilike.%${options.search}%,description.ilike.%${options.search}%`)
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
			
			partnersState.update(state => ({
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
			const errorId = errorStore.handleError(error, 'Failed to fetch partners')
			partnersState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async fetchAll() {
		return this.fetchPaginated({ page: 1, limit: 1000 })
	},
	
	async create(partnerData: CreatePartner) {
		partnersState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			// Validate data
			const validatedData = partnerSchema.omit({ id: true, created_at: true }).parse(partnerData)
			
			const { data, error } = await supabase
				.from('phwb_partners')
				.insert([validatedData])
				.select()
				.single()
			
			if (error) throw error
			
			partnersState.update(state => ({
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
			const errorId = errorStore.handleError(error, 'Failed to create partner')
			partnersState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async update(id: number, updates: UpdatePartner) {
		partnersState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			// Validate data
			const validatedData = partnerSchema.omit({ id: true, created_at: true }).partial().parse(updates)
			
			const { data, error } = await supabase
				.from('phwb_partners')
				.update(validatedData)
				.eq('id', id)
				.select()
				.single()
			
			if (error) throw error
			
			partnersState.update(state => ({
				...state,
				items: state.items.map(partner => partner.id === id ? data : partner),
				loading: false
			}))
			
			return data
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to update partner')
			partnersState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async delete(id: number) {
		partnersState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			const { error } = await supabase
				.from('phwb_partners')
				.delete()
				.eq('id', id)
			
			if (error) throw error
			
			partnersState.update(state => ({
				...state,
				items: state.items.filter(partner => partner.id !== id),
				loading: false,
				pagination: {
					...state.pagination,
					total: state.pagination.total - 1
				}
			}))
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to delete partner')
			partnersState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	}
}