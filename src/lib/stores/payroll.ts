import { writable } from 'svelte/store'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'
import { payrollSchema, type Payroll, type CreatePayroll, type UpdatePayroll, PaymentStatus } from '$lib/schemas/payroll'
import { type CreatePayrollAudit, AuditAction } from '$lib/schemas/payroll-audit'
import { type PaymentBatch, type CreatePaymentBatch } from '$lib/schemas/payment-batch'
import type { PaginationOptions, StoreState } from '$lib/types'
import { queuePayoutProcessedNotifications } from '$lib/services/notification-producer'

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
					artists:artist_id(id, full_name, legal_first_name, legal_last_name, llc_name, employment_status),
					venues:venue_id(id, name),
					facilities:facility_id(id, name),
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

			// Deterministic tie-breakers:
			// 1) keep newest generation batches first when primary sort ties
			// 2) group event-automation rows by source event
			// 3) place PM row at top within each same-event group
			// 4) stable latest-id fallback
			if (sortBy !== 'created_at') {
				query = query.order('created_at', { ascending: false })
			}
			query = query
				.order('source_event_id', { ascending: false, nullsFirst: false })
				.order('event_id', { ascending: false, nullsFirst: false })
				.order('is_production_manager', { ascending: false })
				.order('id', { ascending: false })
			
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
					artists:artist_id(id, full_name, legal_first_name, legal_last_name, llc_name, employment_status),
					venues:venue_id(id, name),
					facilities:facility_id(id, name),
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
					artists:artist_id(id, full_name, legal_first_name, legal_last_name, llc_name, employment_status),
					venues:venue_id(id, name),
					facilities:facility_id(id, name),
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
					artists:artist_id(id, full_name, legal_first_name, legal_last_name, llc_name, employment_status),
					venues:venue_id(id, name),
					facilities:facility_id(id, name),
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
					artists:artist_id(id, full_name, legal_first_name, legal_last_name, llc_name, employment_status),
					venues:venue_id(id, name),
					facilities:facility_id(id, name),
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
				total_amount: totalAmount
			}

			const { error: batchError } = await supabase
				.from('phwb_payment_batches')
				.insert([batch])

			if (batchError) throw batchError

			// Update payroll entries with batch info
			const updates = {
				status: PaymentStatus.PAID,
				batch_id: batchId,
				processed_by: batchData.created_by,
				processed_at: new Date().toISOString(),
				payment_method: batchData.payment_method
			}

			const { data, error } = await supabase
				.from('phwb_payroll')
				.update(updates)
				.in('id', payrollIds)
				.select(`
					*,
					artists:artist_id(id, full_name, legal_first_name, legal_last_name, llc_name, employment_status),
					venues:venue_id(id, name),
					facilities:facility_id(id, name),
					programs:program_id(id, title, program_type)
				`)

			if (error) throw error

			// Create audit logs for each payment
			const auditPromises = payrollIds.map(id => 
				this.createAuditLog({
					payroll_id: id,
					user_id: batchData.created_by,
					action: AuditAction.PROCESS,
					notes: `Processed in batch: ${batch.batch_name}`
				})
			)
			await Promise.all(auditPromises)

			try {
				await queuePayoutProcessedNotifications(data || [], new Date().toISOString())
			} catch (notificationError) {
				console.error('Failed to queue payout processed notifications:', notificationError)
			}

			payrollState.update(state => ({
				...state,
				items: state.items.map(entry => 
					payrollIds.includes(entry.id!) ? 
						data.find(updated => updated.id === entry.id) || entry : 
						entry
				),
				loading: false
			}))

			return { batch: batchId, payments: data }
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to process payment batch')
			payrollState.update(state => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},

	async reconcile(id: number, userId: string, externalPaymentId?: string, notes?: string) {
		try {
			const updates = {
				reconciled: true,
				reconciled_at: new Date().toISOString(),
				external_payment_id: externalPaymentId,
				status: PaymentStatus.PAID
			}

			const { data, error } = await supabase
				.from('phwb_payroll')
				.update(updates)
				.eq('id', id)
				.select(`
					*,
					artists:artist_id(id, full_name, legal_first_name, legal_last_name, llc_name, employment_status),
					venues:venue_id(id, name),
					facilities:facility_id(id, name),
					programs:program_id(id, title, program_type)
				`)
				.single()

			if (error) throw error

			// Create audit log
			await this.createAuditLog({
				payroll_id: id,
				user_id: userId,
				action: AuditAction.RECONCILE,
				notes: notes || 'Payment reconciled'
			})

			payrollState.update(state => ({
				...state,
				items: state.items.map(entry => entry.id === id ? data : entry)
			}))

			return data
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to reconcile payment')
			throw error
		}
	},

	async getByIds(ids: number[]) {
		const { data, error } = await supabase
			.from('phwb_payroll')
			.select(`
				*,
				artists:artist_id(id, full_name, legal_first_name, legal_last_name, llc_name, employment_status),
				venues:venue_id(id, name),
				facilities:facility_id(id, name),
				programs:program_id(id, title, program_type)
			`)
			.in('id', ids)

		if (error) throw error
		return data || []
	},

	async getAuditLog(payrollId: number) {
		const { data, error } = await supabase
			.from('phwb_payroll_audit')
			.select(`
				*,
				users:user_id(id, email, full_name)
			`)
			.eq('payroll_id', payrollId)
			.order('created_at', { ascending: false })

		if (error) throw error
		return data || []
	},

	async createAuditLog(auditData: CreatePayrollAudit) {
		const { error } = await supabase
			.from('phwb_payroll_audit')
			.insert([auditData])

		if (error) throw error
	},

	async getBatches(userId?: string) {
		let query = supabase
			.from('phwb_payment_batches')
			.select('*')
			.order('created_at', { ascending: false })

		if (userId) {
			query = query.eq('created_by', userId)
		}

		const { data, error } = await query
		if (error) throw error
		return data || []
	},

	async getBatchPayments(batchId: string) {
		const { data, error } = await supabase
			.from('phwb_payroll')
			.select(`
				*,
				artists:artist_id(id, first_name, last_name),
				venues:venue_id(id, name),
				facilities:facility_id(id, name)
			`)
			.eq('batch_id', batchId)

		if (error) throw error
		return data || []
	},

	async exportPayments(filters: { 
		status?: string[], 
		dateFrom?: string, 
		dateTo?: string,
		paymentMethod?: string[]
	}) {
		let query = supabase
			.from('phwb_payroll')
			.select(`
				*,
				artists:artist_id(id, first_name, last_name, email),
				venues:venue_id(id, name),
				facilities:facility_id(id, name)
			`)

		if (filters.status?.length) {
			query = query.in('status', filters.status)
		}

		if (filters.dateFrom) {
			query = query.gte('event_date', filters.dateFrom)
		}

		if (filters.dateTo) {
			query = query.lte('event_date', filters.dateTo)
		}

		if (filters.paymentMethod?.length) {
			query = query.in('payment_method', filters.paymentMethod)
		}

		const { data, error } = await query.order('event_date', { ascending: false })

		if (error) throw error
		return data || []
	}
}