import { writable } from 'svelte/store'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'
import { reportSchema, type Report, type CreateReport, type UpdateReport } from '$lib/schemas/report'
import type { PaginationOptions, StoreState } from '$lib/types'

const initialState: StoreState<Report> = {
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

export const reportsState = writable<StoreState<Report>>(initialState)

export const reportsStore = {
	subscribe: reportsState.subscribe,
	
	async fetchPaginated(options: PaginationOptions) {
		reportsState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			let query = supabase
				.from('phwb_reports')
				.select('*', { count: 'exact' })
			
			// Add search filter
			if (options.search) {
				query = query.or(`title.ilike.%${options.search}%,type.ilike.%${options.search}%,summary.ilike.%${options.search}%`)
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
			
			reportsState.update(state => ({
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
			const errorId = errorStore.handleError(error, 'Failed to fetch reports')
			reportsState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async fetchAll() {
		return this.fetchPaginated({ page: 1, limit: 1000 })
	},
	
	async create(reportData: CreateReport) {
		reportsState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			// Validate data
			const validatedData = reportSchema.omit({ id: true, created_at: true }).parse(reportData)
			
			const { data, error } = await supabase
				.from('phwb_reports')
				.insert([validatedData])
				.select()
				.single()
			
			if (error) throw error
			
			reportsState.update(state => ({
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
			const errorId = errorStore.handleError(error, 'Failed to create report')
			reportsState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async update(id: number, updates: UpdateReport) {
		reportsState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			// Validate data
			const validatedData = reportSchema.omit({ id: true, created_at: true }).partial().parse(updates)
			
			const { data, error } = await supabase
				.from('phwb_reports')
				.update(validatedData)
				.eq('id', id)
				.select()
				.single()
			
			if (error) throw error
			
			reportsState.update(state => ({
				...state,
				items: state.items.map(report => report.id === id ? data : report),
				loading: false
			}))
			
			return data
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to update report')
			reportsState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async delete(id: number) {
		reportsState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			const { error } = await supabase
				.from('phwb_reports')
				.delete()
				.eq('id', id)
			
			if (error) throw error
			
			reportsState.update(state => ({
				...state,
				items: state.items.filter(report => report.id !== id),
				loading: false,
				pagination: {
					...state.pagination,
					total: state.pagination.total - 1
				}
			}))
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to delete report')
			reportsState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	}
}