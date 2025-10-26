import { writable } from 'svelte/store'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'
import { logger } from '$lib/utils/logger'
import type { PaginationOptions, StoreState } from '$lib/types'
import type { ZodSchema } from 'zod'

export interface BaseStoreConfig<T, TCreate, TUpdate> {
	tableName: string
	schema: any
	searchFields: string[]
	defaultSortBy?: string
	defaultSortOrder?: 'asc' | 'desc'
	searchTransform?: (searchTerm: string) => string
}

export interface RealtimeSubscriptionConfig {
	onInsert?: (payload: any) => void
	onUpdate?: (payload: any) => void 
	onDelete?: (payload: any) => void
}

export function createBaseStore<T extends Record<string, any>, TCreate, TUpdate>(
	config: BaseStoreConfig<T, TCreate, TUpdate>
) {
	const initialState: StoreState<T> = {
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

	const state = writable<StoreState<T>>(initialState)
	let realtimeSubscription: any = null

	const store = {
		subscribe: state.subscribe,

		async fetchPaginated(options: PaginationOptions) {
			state.update(s => ({ ...s, loading: true, error: null }))

			try {
				let query = supabase
					.from(config.tableName)
					.select('*', { count: 'exact' })

				// Add search filter
				if (options.search && config.searchFields.length > 0) {
					const searchTerm = config.searchTransform 
						? config.searchTransform(options.search)
						: options.search
					
					const searchQuery = config.searchFields
						.map(field => `${field}.ilike.%${searchTerm}%`)
						.join(',')
					query = query.or(searchQuery)
				}

				// Add sorting
				const sortBy = options.sortBy || config.defaultSortBy || 'created_at'
				const ascending = options.sortOrder 
					? options.sortOrder === 'asc'
					: config.defaultSortOrder === 'asc'
				query = query.order(sortBy, { ascending })

				// Add pagination
				const from = (options.page - 1) * options.limit
				const to = from + options.limit - 1
				query = query.range(from, to)

				const { data, error, count } = await query

				if (error) throw error

				const totalPages = Math.ceil((count || 0) / options.limit)

				state.update(s => ({
					...s,
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
				const errorId = errorStore.handleError(error, `Failed to fetch ${config.tableName}`)
				state.update(s => ({ ...s, loading: false, error: errorId }))
				throw error
			}
		},

		async fetchAll(options: Partial<PaginationOptions> = {}) {
			const paginationOptions: PaginationOptions = {
				page: options.page ?? 1,
				limit: options.limit ?? 1000,
				search: options.search,
				sortBy: options.sortBy,
				sortOrder: options.sortOrder,
				filters: options.filters
			}

			return this.fetchPaginated(paginationOptions)
		},

		async create(itemData: TCreate) {
			state.update(s => ({ ...s, loading: true, error: null }))

			try {
				// Generate UUID if not provided (temporary fix for database constraint)
				const dataWithId = {
					...itemData,
					id: crypto.randomUUID()
				}

				logger.debug(`Creating ${config.tableName} with data:`, dataWithId)
				const { data, error } = await supabase
					.from(config.tableName)
					.insert([dataWithId])
					.select()
					.single()

				if (error) {
					logger.error(`Error creating ${config.tableName}:`, error)
					throw error
				}

				state.update(s => ({
					...s,
					items: [data, ...s.items],
					loading: false,
					pagination: {
						...s.pagination,
						total: s.pagination.total + 1
					}
				}))

				return data
			} catch (error) {
				const errorId = errorStore.handleError(error, `Failed to create ${config.tableName}`)
				state.update(s => ({ ...s, loading: false, error: errorId }))
				throw error
			}
		},

		async update(id: string | number, updates: TUpdate) {
			state.update(s => ({ ...s, loading: true, error: null }))

			try {
				const { data, error } = await supabase
					.from(config.tableName)
					.update(updates)
					.eq('id', id)
					.select()
					.single()

				if (error) throw error

				state.update(s => ({
					...s,
					items: s.items.map(item => item.id === id ? data : item),
					loading: false
				}))

				return data
			} catch (error) {
				const errorId = errorStore.handleError(error, `Failed to update ${config.tableName}`)
				state.update(s => ({ ...s, loading: false, error: errorId }))
				throw error
			}
		},

		async delete(id: string | number) {
			state.update(s => ({ ...s, loading: true, error: null }))

			try {
				const { error } = await supabase
					.from(config.tableName)
					.delete()
					.eq('id', id)

				if (error) throw error

				state.update(s => ({
					...s,
					items: s.items.filter(item => item.id !== id),
					loading: false,
					pagination: {
						...s.pagination,
						total: s.pagination.total - 1
					}
				}))
			} catch (error) {
				const errorId = errorStore.handleError(error, `Failed to delete ${config.tableName}`)
				state.update(s => ({ ...s, loading: false, error: errorId }))
				throw error
			}
		},

		async getById(id: string | number) {
			try {
				const { data, error } = await supabase
					.from(config.tableName)
					.select('*')
					.eq('id', id)
					.single()

				if (error) throw error
				return data
			} catch (error) {
				const errorId = errorStore.handleError(error, `Failed to fetch ${config.tableName} by id`)
				throw error
			}
		},

		subscribeToChanges(realtimeConfig?: RealtimeSubscriptionConfig) {
			// Clean up existing subscription
			if (realtimeSubscription) {
				realtimeSubscription.unsubscribe()
			}

			realtimeSubscription = supabase
				.channel(`${config.tableName}_changes`)
				.on(
					'postgres_changes',
					{ 
						event: 'INSERT', 
						schema: 'public', 
						table: config.tableName 
					},
					(payload) => {
						if (realtimeConfig?.onInsert) {
							realtimeConfig.onInsert(payload)
						} else {
							// Default behavior: add to beginning of list only if not already present
							state.update(s => {
								const newItem = payload.new as T
								const exists = s.items.some(item => item.id === newItem.id)

								if (exists) {
									// Item already exists (likely added by create method), skip
									return s
								}

								return {
									...s,
									items: [newItem, ...s.items],
									pagination: {
										...s.pagination,
										total: s.pagination.total + 1
									}
								}
							})
						}
					}
				)
				.on(
					'postgres_changes',
					{ 
						event: 'UPDATE', 
						schema: 'public', 
						table: config.tableName 
					},
					(payload) => {
						if (realtimeConfig?.onUpdate) {
							realtimeConfig.onUpdate(payload)
						} else {
							// Default behavior: update existing item
							state.update(s => ({
								...s,
								items: s.items.map(item => 
									item.id === (payload.new as T).id ? payload.new as T : item
								)
							}))
						}
					}
				)
				.on(
					'postgres_changes',
					{ 
						event: 'DELETE', 
						schema: 'public', 
						table: config.tableName 
					},
					(payload) => {
						if (realtimeConfig?.onDelete) {
							realtimeConfig.onDelete(payload)
						} else {
							// Default behavior: remove from list
							state.update(s => ({
								...s,
								items: s.items.filter(item => item.id !== (payload.old as T).id),
								pagination: {
									...s.pagination,
									total: s.pagination.total - 1
								}
							}))
						}
					}
				)
				.subscribe()

			return realtimeSubscription
		},

		unsubscribeFromChanges() {
			if (realtimeSubscription) {
				realtimeSubscription.unsubscribe()
				realtimeSubscription = null
			}
		},

		// Utility methods
		clearError() {
			state.update(s => ({ ...s, error: null }))
		},

		reset() {
			state.set(initialState)
			this.unsubscribeFromChanges()
		}
	}

	return store
}

// Helper type for creating strongly typed stores
export type BaseStore<T extends Record<string, any>, TCreate, TUpdate> = ReturnType<typeof createBaseStore<T, TCreate, TUpdate>>
