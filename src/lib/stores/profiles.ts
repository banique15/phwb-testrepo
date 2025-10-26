import { writable } from 'svelte/store'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'
import { profileSchema, type Profile, type CreateProfile, type UpdateProfile } from '$lib/schemas/profile'
import type { PaginationOptions, StoreState } from '$lib/types'

const initialState: StoreState<Profile> = {
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

export const profilesState = writable<StoreState<Profile>>(initialState)

export const profilesStore = {
	subscribe: profilesState.subscribe,
	
	async fetchPaginated(options: PaginationOptions) {
		profilesState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			let query = supabase
				.from('profiles')
				.select('*', { count: 'exact' })
			
			// Add search filter
			if (options.search) {
				query = query.or(`username.ilike.%${options.search}%,full_name.ilike.%${options.search}%`)
			}
			
			// Add sorting
			const sortBy = options.sortBy || 'updated_at'
			const ascending = options.sortOrder === 'asc'
			query = query.order(sortBy, { ascending })
			
			// Add pagination
			const from = (options.page - 1) * options.limit
			const to = from + options.limit - 1
			query = query.range(from, to)
			
			const { data, error, count } = await query
			
			if (error) throw error
			
			const totalPages = Math.ceil((count || 0) / options.limit)
			
			profilesState.update(state => ({
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
			const errorId = errorStore.handleError(error, 'Failed to fetch profiles')
			profilesState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async fetchAll() {
		return this.fetchPaginated({ page: 1, limit: 1000 })
	},
	
	async fetchById(id: string) {
		profilesState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			const { data, error } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', id)
				.single()
			
			if (error) throw error
			
			profilesState.update(state => ({ ...state, loading: false }))
			return data
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to fetch profile')
			profilesState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async create(profileData: CreateProfile) {
		profilesState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			// Validate data
			const validatedData = profileSchema.omit({ updated_at: true }).parse(profileData)
			
			const { data, error } = await supabase
				.from('profiles')
				.insert([validatedData])
				.select()
				.single()
			
			if (error) throw error
			
			profilesState.update(state => ({
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
			const errorId = errorStore.handleError(error, 'Failed to create profile')
			profilesState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async update(id: string, updates: UpdateProfile) {
		profilesState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			// Validate data
			const validatedData = profileSchema.omit({ id: true, updated_at: true }).partial().parse(updates)
			
			const { data, error } = await supabase
				.from('profiles')
				.update(validatedData)
				.eq('id', id)
				.select()
				.single()
			
			if (error) throw error
			
			profilesState.update(state => ({
				...state,
				items: state.items.map(profile => profile.id === id ? data : profile),
				loading: false
			}))
			
			return data
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to update profile')
			profilesState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async delete(id: string) {
		profilesState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			const { error } = await supabase
				.from('profiles')
				.delete()
				.eq('id', id)
			
			if (error) throw error
			
			profilesState.update(state => ({
				...state,
				items: state.items.filter(profile => profile.id !== id),
				loading: false,
				pagination: {
					...state.pagination,
					total: state.pagination.total - 1
				}
			}))
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to delete profile')
			profilesState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	}
}