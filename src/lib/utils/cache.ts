/**
 * Simple in-memory cache for data fetching
 * Reduces redundant API calls and speeds up navigation
 */

interface CacheEntry<T> {
	data: T
	timestamp: number
	expiresIn: number
}

class DataCache {
	private cache = new Map<string, CacheEntry<any>>()
	private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

	/**
	 * Get cached data if available and not expired
	 */
	get<T>(key: string): T | null {
		const entry = this.cache.get(key)

		if (!entry) return null

		const now = Date.now()
		const age = now - entry.timestamp

		if (age > entry.expiresIn) {
			this.cache.delete(key)
			return null
		}

		return entry.data as T
	}

	/**
	 * Set cached data with optional TTL
	 */
	set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
			expiresIn: ttl
		})
	}

	/**
	 * Invalidate specific cache entry
	 */
	invalidate(key: string): void {
		this.cache.delete(key)
	}

	/**
	 * Invalidate all cache entries matching pattern
	 */
	invalidatePattern(pattern: RegExp): void {
		for (const key of this.cache.keys()) {
			if (pattern.test(key)) {
				this.cache.delete(key)
			}
		}
	}

	/**
	 * Clear all cache
	 */
	clear(): void {
		this.cache.clear()
	}

	/**
	 * Get cache statistics
	 */
	getStats() {
		return {
			size: this.cache.size,
			keys: Array.from(this.cache.keys())
		}
	}
}

export const dataCache = new DataCache()

/**
 * Wrapper for fetch with caching
 */
export async function cachedFetch<T>(
	key: string,
	fetcher: () => Promise<T>,
	options?: {
		ttl?: number
		forceRefresh?: boolean
	}
): Promise<T> {
	const { ttl, forceRefresh = false } = options || {}

	// Check cache first
	if (!forceRefresh) {
		const cached = dataCache.get<T>(key)
		if (cached !== null) {
			return cached
		}
	}

	// Fetch fresh data
	const data = await fetcher()

	// Cache the result
	dataCache.set(key, data, ttl)

	return data
}

/**
 * Cache key generators for common patterns
 */
export const cacheKeys = {
	list: (entity: string, filters?: Record<string, any>) => {
		const filterStr = filters ? JSON.stringify(filters) : ''
		return `${entity}:list${filterStr ? ':' + filterStr : ''}`
	},

	detail: (entity: string, id: string | number) => {
		return `${entity}:detail:${id}`
	},

	lookup: (entity: string) => {
		return `${entity}:lookup`
	}
}
