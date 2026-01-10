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
				// Prepare insert data
				const insertData: any = { ...itemData }
				
				// Helper function to check if a Zod schema field is numeric
				const isNumericField = (field: any): boolean => {
					if (!field || !field._def) return false
					const typeName = field._def.typeName
					
					// Direct ZodNumber
					if (typeName === 'ZodNumber') return true
					
					// ZodOptional wrapping ZodNumber
					if (typeName === 'ZodOptional' && field._def.innerType?._def?.typeName === 'ZodNumber') return true
					
					// ZodEffects/ZodRefinement wrapping ZodNumber
					if ((typeName === 'ZodEffects' || typeName === 'ZodRefinement') && 
						field._def.schema?._def?.typeName === 'ZodNumber') return true
					
					// ZodEffects wrapping ZodOptional wrapping ZodNumber
					if (typeName === 'ZodEffects' && field._def.schema?._def?.typeName === 'ZodOptional' &&
						field._def.schema?._def?.innerType?._def?.typeName === 'ZodNumber') return true
					
					return false
				}
				
				// Check if schema expects numeric ID
				const schemaIdField = (config.schema as any)?.shape?.id
				const expectsNumericId = isNumericField(schemaIdField)
				
				// Hardcoded list of tables that use numeric IDs (safety fallback)
				const numericIdTables = [
					'phwb_location_contacts',
					'phwb_locations',
					'phwb_facilities',
					'phwb_events',
					'phwb_programs',
					'phwb_venues',
					'phwb_partners'
				]
				const definitelyNumericId = numericIdTables.includes(config.tableName)
				
				// Use hardcoded check if schema detection fails
				const shouldUseNumericId = expectsNumericId || definitelyNumericId
				
				// Debug logging
				if (definitelyNumericId && !expectsNumericId) {
					logger.warn(`Schema detection failed for ${config.tableName}, using hardcoded numeric ID check`)
				}
				
				// UUID regex for detection
				const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
				
				// AGGRESSIVE: Remove ANY UUID from id field if table expects numeric ID
				// This handles cases where UUID might have been added before this check
				if (shouldUseNumericId && insertData.id) {
					if (typeof insertData.id === 'string' && uuidRegex.test(insertData.id)) {
						logger.warn(`Removing UUID from id field for numeric ID table ${config.tableName}. UUID: ${insertData.id}`)
						delete insertData.id
					} else if (typeof insertData.id !== 'number') {
						// If it's not a number and not a valid numeric string, remove it
						const numId = Number(insertData.id)
						if (isNaN(numId)) {
							logger.warn(`Removing invalid id value for numeric ID table ${config.tableName}. Value: ${insertData.id}`)
							delete insertData.id
						} else {
							insertData.id = numId
						}
					}
				}
				
				// Handle id field based on schema expectations
				if (!('id' in insertData) || (insertData as any).id === undefined || (insertData as any).id === null) {
					if (shouldUseNumericId) {
						// For numeric IDs, don't include id field - let database auto-generate
						delete insertData.id
					} else {
						// For UUID-based tables, generate UUID
						insertData.id = crypto.randomUUID()
					}
				}
				
				// FINAL SAFETY CHECK: Remove ANY UUID from id field if shouldUseNumericId
				// This is a last resort check before sending to database
				if (shouldUseNumericId && insertData.id) {
					if (typeof insertData.id === 'string' && uuidRegex.test(insertData.id)) {
						logger.error(`CRITICAL: UUID still present in id field for numeric ID table ${config.tableName} after cleanup. Removing it.`)
						delete insertData.id
					}
				}

				// Safety check: ensure no UUID strings are in numeric fields
				for (const [key, value] of Object.entries(insertData)) {
					if (typeof value === 'string' && uuidRegex.test(value)) {
						// Check if this field should be numeric based on schema
						const fieldSchema = (config.schema as any)?.shape?.[key]
						const expectsNumber = fieldSchema && (
							fieldSchema._def?.typeName === 'ZodNumber' ||
							fieldSchema._def?.typeName === 'ZodOptional' && fieldSchema._def?.innerType?._def?.typeName === 'ZodNumber' ||
							(fieldSchema._def?.typeName === 'ZodEffects' || fieldSchema._def?.typeName === 'ZodRefinement') && 
							fieldSchema._def?.schema?._def?.typeName === 'ZodNumber'
						)
						
						if (expectsNumber) {
							logger.error(`Invalid data: field ${key} is a UUID string but should be a number. Value: ${value}`)
							throw new Error(`Invalid ${key}: expected a number but received a UUID "${value}". Please check your data.`)
						}
					}
				}

				// Log the final data being sent (for debugging)
				logger.debug(`Creating ${config.tableName} with data:`, JSON.stringify(insertData, null, 2))
				logger.debug(`Data types:`, Object.entries(insertData).reduce((acc, [key, value]) => {
					acc[key] = typeof value
					return acc
				}, {} as Record<string, string>))
				
				const { data, error } = await supabase
					.from(config.tableName)
					.insert([insertData])
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
