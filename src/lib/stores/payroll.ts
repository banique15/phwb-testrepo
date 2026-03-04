import { writable } from 'svelte/store'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'
import { payrollSchema, type Payroll, type CreatePayroll, type UpdatePayroll, PaymentStatus } from '$lib/schemas/payroll'
import { type CreatePayrollAudit, AuditAction } from '$lib/schemas/payroll-audit'
import { type PaymentBatch, type CreatePaymentBatch } from '$lib/schemas/payment-batch'
import type { PaginationOptions, StoreState } from '$lib/types'

const initialState: StoreState<Payroll> = {
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

export const payrollState = writable<StoreState<Payroll>>(initialState)

export const payrollStore = {
	subscribe: payrollState.subscribe,
	
	async fetchPaginated(options: PaginationOptions) {
		payrollState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			let query = supabase
				.from('phwb_payroll')
				.select(`
					*,
					artists:artist_id(id, full_name, legal_first_name, legal_last_name),
					venues:venue_id(id, name),
					programs:program_id(id, title, program_type)
				`, { count: 'exact' })
			
			// Add search filter - search artists, venues, programs, and amounts
			if (options.search) {
				const searchTerm = options.search.trim()
				
				// Check if search is a number (for amount search)
				const isNumericSearch = !isNaN(parseFloat(searchTerm))
				
				// Get artist IDs that match the search
				const { data: matchingArtists } = await supabase
					.from('phwb_artists')
					.select('id')
					.or(`full_name.ilike.%${searchTerm}%,legal_first_name.ilike.%${searchTerm}%,legal_last_name.ilike.%${searchTerm}%`)
				
				// Get venue IDs that match the search
				const { data: matchingVenues } = await supabase
					.from('phwb_venues')
					.select('id')
					.ilike('name', `%${searchTerm}%`)
				
				// Get program IDs that match the search
				const { data: matchingPrograms } = await supabase
					.from('phwb_programs')
					.select('id')
					.ilike('title', `%${searchTerm}%`)
				
				// Build OR conditions
				const orConditions: string[] = []
				
				if (matchingArtists && matchingArtists.length > 0) {
					const artistIds = matchingArtists.map(a => a.id)
					orConditions.push(`artist_id.in.(${artistIds.join(',')})`)
				}
				
				if (matchingVenues && matchingVenues.length > 0) {
					const venueIds = matchingVenues.map(v => v.id)
					orConditions.push(`venue_id.in.(${venueIds.join(',')})`)
				}
				
				if (matchingPrograms && matchingPrograms.length > 0) {
					const programIds = matchingPrograms.map(p => p.id)
					orConditions.push(`program_id.in.(${programIds.join(',')})`)
				}
				
				// Search by amount if numeric
				if (isNumericSearch) {
					const amount = parseFloat(searchTerm)
					// Search for total_pay that matches (with some tolerance)
					orConditions.push(`total_pay.eq.${amount}`)
				}
				
				// Search by notes
				orConditions.push(`notes.ilike.%${searchTerm}%`)
				
				if (orConditions.length > 0) {
					query = query.or(orConditions.join(','))
				} else {
					// If nothing matches, return empty results
					query = query.eq('id', -1)
				}
			}
			
			// Add filters
			if (options.filters) {
				const filters = options.filters
				
				if (filters.status) {
					query = query.eq('status', filters.status)
				}
				
				if (filters.payment_type) {
					query = query.eq('payment_type', filters.payment_type)
				}
				
				if (filters.employee_contractor_status) {
					query = query.eq('employee_contractor_status', filters.employee_contractor_status)
				}
				
				if (filters.date_start) {
					query = query.gte('event_date', filters.date_start)
				}
				
				if (filters.date_end) {
					query = query.lte('event_date', filters.date_end)
				}
				
				if (filters.artist_id) {
					query = query.eq('artist_id', filters.artist_id)
				}
				
				if (filters.venue_id) {
					query = query.eq('venue_id', filters.venue_id)
				}
			}
			
			// Add sorting
			const sortBy = options.sortBy || 'event_date'
			const ascending = options.sortOrder === 'asc'
			query = query.order(sortBy, { ascending })
			
			// Add pagination
			const from = (options.page - 1) * options.limit
			const to = from + options.limit - 1
			query = query.range(from, to)
			
			const { data, error, count } = await query
			
			if (error) throw error
			
			const totalPages = Math.ceil((count || 0) / options.limit)
			
			payrollState.update(state => ({
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
			const errorId = errorStore.handleError(error, 'Failed to fetch payroll')
			payrollState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async fetchAll() {
		try {
			// Fetch all records without pagination for metrics calculation
			const { data, error } = await supabase
				.from('phwb_payroll')
				.select(`
					*,
					artists:artist_id(id, full_name, legal_first_name, legal_last_name),
					venues:venue_id(id, name),
					programs:program_id(id, title, program_type)
				`)
				.order('event_date', { ascending: false })
			
			if (error) throw error
			
			return { data: data || [], total: data?.length || 0, totalPages: 1 }
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to fetch all payroll records')
			throw error
		}
	},
	
	async create(payrollData: CreatePayroll) {
		payrollState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			// Validate data
			const validatedData = payrollSchema.omit({ id: true, created_at: true, total_pay: true }).parse(payrollData)
			
			const { data, error } = await supabase
				.from('phwb_payroll')
				.insert([validatedData])
				.select(`
					*,
					artists:artist_id(id, full_name, legal_first_name, legal_last_name),
					venues:venue_id(id, name),
					programs:program_id(id, title, program_type)
				`)
				.single()
			
			if (error) throw error
			
			payrollState.update(state => ({
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
			const errorId = errorStore.handleError(error, 'Failed to create payroll entry')
			payrollState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async update(id: number, updates: UpdatePayroll) {
		payrollState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			// Validate data
			const validatedData = payrollSchema.omit({ id: true, created_at: true, total_pay: true }).partial().parse(updates)
			
			const { data, error } = await supabase
				.from('phwb_payroll')
				.update(validatedData)
				.eq('id', id)
				.select(`
					*,
					artists:artist_id(id, full_name, legal_first_name, legal_last_name),
					venues:venue_id(id, name),
					programs:program_id(id, title, program_type)
				`)
				.single()
			
			if (error) throw error
			
			payrollState.update(state => ({
				...state,
				items: state.items.map(entry => entry.id === id ? data : entry),
				loading: false
			}))
			
			return data
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to update payroll entry')
			payrollState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},
	
	async delete(id: number) {
		payrollState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			const { error } = await supabase
				.from('phwb_payroll')
				.delete()
				.eq('id', id)
			
			if (error) throw error
			
			payrollState.update(state => ({
				...state,
				items: state.items.filter(entry => entry.id !== id),
				loading: false,
				pagination: {
					...state.pagination,
					total: state.pagination.total - 1
				}
			}))
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to delete payroll entry')
			payrollState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},

	// Payment workflow methods
	async approve(id: number, userId: string, notes?: string) {
		payrollState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			const updates = {
				status: PaymentStatus.APPROVED,
				approved_by: userId,
				approved_at: new Date().toISOString()
			}

			const { data, error } = await supabase
				.from('phwb_payroll')
				.update(updates)
				.eq('id', id)
				.select(`
					*,
					artists:artist_id(id, full_name, legal_first_name, legal_last_name),
					venues:venue_id(id, name),
					programs:program_id(id, title, program_type)
				`)
				.single()

			if (error) throw error

			// Create audit log
			await this.createAuditLog({
				payroll_id: id,
				user_id: userId,
				action: AuditAction.APPROVE,
				notes: notes || 'Payment approved'
			})

			payrollState.update(state => ({
				...state,
				items: state.items.map(entry => entry.id === id ? data : entry),
				loading: false
			}))

			return data
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to approve payment')
			payrollState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},

	async processBatch(payrollIds: number[], batchData: Omit<CreatePaymentBatch, 'payment_count' | 'total_amount'>) {
		payrollState.update(state => ({ ...state, loading: true, error: null }))
		
		try {
			// Calculate batch totals
			const payrollEntries = await this.getByIds(payrollIds)
			const totalAmount = payrollEntries.reduce((sum, entry) => sum + (entry.total_pay || 0), 0)
			
			// Create payment batch
			const batchId = crypto.randomUUID()
			const batch: CreatePaymentBatch = {
				...batchData,
				payment_count: payrollIds.length,
				total_amount: totalAmount,
				batch_id: batchId
			}
			
			// Insert batch into database
			const { error } = await supabase
				.from('phwb_payment_batches')
				.insert([batch])
			
			if (error) throw error
			
			// Update payroll entries to mark them as processed
			await Promise.all(payrollIds.map(id => this.update(id, { status: PaymentStatus.PAID })))
			
			payrollState.update(state => ({
				...state,
				loading: false
			}))
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to process payment batch')
			payrollState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	}
}
