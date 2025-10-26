export interface PaginationOptions {
	page: number
	limit: number
	search?: string
	sortBy?: string
	sortOrder?: 'asc' | 'desc'
	filters?: Record<string, any>
}

export interface PaginatedResponse<T> {
	data: T[]
	total: number
	page: number
	limit: number
	totalPages: number
}

export interface StoreState<T> {
	items: T[]
	loading: boolean
	error: string | null
	pagination: {
		total: number
		page: number
		limit: number
		totalPages: number
	}
}