import { writable, get } from 'svelte/store'
import { browser } from '$app/environment'
import type { EventFilters, FacilityFilters } from '$lib/utils/filters'

/**
 * Filter preferences storage keys
 */
const STORAGE_PREFIX = 'phwb_filter_prefs_'
const HISTORY_KEY = 'phwb_filter_history'
const MAX_HISTORY_ITEMS = 10

/**
 * Filter preset interface
 */
export interface FilterPreset {
	id: string
	name: string
	description?: string
	filters: EventFilters | FacilityFilters
	createdAt: string
	entityType: 'events' | 'facilities'
}

/**
 * Save filter preferences to localStorage
 */
export function saveFilterPreferences(key: string, filters: any): void {
	if (!browser) return

	try {
		const storageKey = `${STORAGE_PREFIX}${key}`
		localStorage.setItem(storageKey, JSON.stringify(filters))
	} catch (error) {
		console.error('Failed to save filter preferences:', error)
	}
}

/**
 * Load filter preferences from localStorage
 */
export function loadFilterPreferences<T = any>(key: string): T | null {
	if (!browser) return null

	try {
		const storageKey = `${STORAGE_PREFIX}${key}`
		const stored = localStorage.getItem(storageKey)
		return stored ? JSON.parse(stored) : null
	} catch (error) {
		console.error('Failed to load filter preferences:', error)
		return null
	}
}

/**
 * Clear filter preferences
 */
export function clearFilterPreferences(key: string): void {
	if (!browser) return

	try {
		const storageKey = `${STORAGE_PREFIX}${key}`
		localStorage.removeItem(storageKey)
	} catch (error) {
		console.error('Failed to clear filter preferences:', error)
	}
}

/**
 * Add filters to history
 */
export function addToFilterHistory(filters: any, entityType: 'events' | 'facilities'): void {
	if (!browser) return

	try {
		const history = getFilterHistory()
		const newEntry = {
			filters,
			entityType,
			timestamp: new Date().toISOString()
		}

		// Add to beginning and limit size
		const updatedHistory = [newEntry, ...history].slice(0, MAX_HISTORY_ITEMS)

		localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory))
	} catch (error) {
		console.error('Failed to add to filter history:', error)
	}
}

/**
 * Get filter history
 */
export function getFilterHistory(): any[] {
	if (!browser) return []

	try {
		const stored = localStorage.getItem(HISTORY_KEY)
		return stored ? JSON.parse(stored) : []
	} catch (error) {
		console.error('Failed to get filter history:', error)
		return []
	}
}

/**
 * Clear filter history
 */
export function clearFilterHistory(): void {
	if (!browser) return

	try {
		localStorage.removeItem(HISTORY_KEY)
	} catch (error) {
		console.error('Failed to clear filter history:', error)
	}
}

/**
 * Filter presets store
 */
const PRESETS_KEY = 'phwb_filter_presets'

function loadPresets(): FilterPreset[] {
	if (!browser) return []

	try {
		const stored = localStorage.getItem(PRESETS_KEY)
		return stored ? JSON.parse(stored) : []
	} catch (error) {
		console.error('Failed to load presets:', error)
		return []
	}
}

function savePresets(presets: FilterPreset[]): void {
	if (!browser) return

	try {
		localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
	} catch (error) {
		console.error('Failed to save presets:', error)
	}
}

/**
 * Create a writable store for filter presets
 */
function createPresetsStore() {
	const { subscribe, set, update } = writable<FilterPreset[]>(loadPresets())

	return {
		subscribe,

		/**
		 * Add a new preset
		 */
		add: (preset: Omit<FilterPreset, 'id' | 'createdAt'>) => {
			update(presets => {
				const newPreset: FilterPreset = {
					...preset,
					id: crypto.randomUUID(),
					createdAt: new Date().toISOString()
				}
				const updated = [...presets, newPreset]
				savePresets(updated)
				return updated
			})
		},

		/**
		 * Update an existing preset
		 */
		updatePreset: (id: string, updates: Partial<FilterPreset>) => {
			update(presets => {
				const updated = presets.map(p =>
					p.id === id ? { ...p, ...updates } : p
				)
				savePresets(updated)
				return updated
			})
		},

		/**
		 * Delete a preset
		 */
		delete: (id: string) => {
			update(presets => {
				const updated = presets.filter(p => p.id !== id)
				savePresets(updated)
				return updated
			})
		},

		/**
		 * Get preset by ID
		 */
		getById: (id: string): FilterPreset | undefined => {
			const presets = get({ subscribe })
			return presets.find(p => p.id === id)
		},

		/**
		 * Get presets by entity type
		 */
		getByEntityType: (entityType: 'events' | 'facilities'): FilterPreset[] => {
			const presets = get({ subscribe })
			return presets.filter(p => p.entityType === entityType)
		},

		/**
		 * Clear all presets
		 */
		clear: () => {
			set([])
			savePresets([])
		}
	}
}

export const filterPresetsStore = createPresetsStore()

/**
 * Create default event filter presets
 */
export function createDefaultEventPresets(): FilterPreset[] {
	return [
		{
			id: 'upcoming-confirmed',
			name: 'Upcoming Confirmed',
			description: 'Confirmed events happening in the future',
			filters: {
				status: 'confirmed',
				dateFilter: 'upcoming'
			},
			entityType: 'events',
			createdAt: new Date().toISOString()
		},
		{
			id: 'this-week',
			name: 'This Week',
			description: 'All events this week',
			filters: {
				dateFilter: 'this_week'
			},
			entityType: 'events',
			createdAt: new Date().toISOString()
		},
		{
			id: 'next-30-days',
			name: 'Next 30 Days',
			description: 'Events in the next month',
			filters: {
				dateFilter: 'next_30_days'
			},
			entityType: 'events',
			createdAt: new Date().toISOString()
		},
		{
			id: 'needs-artists',
			name: 'Needs Artists',
			description: 'Confirmed events without artist assignments',
			filters: {
				status: 'confirmed',
				has_artists: false,
				dateFilter: 'upcoming'
			},
			entityType: 'events',
			createdAt: new Date().toISOString()
		}
	]
}

/**
 * Create default facility filter presets
 */
export function createDefaultFacilityPresets(): FilterPreset[] {
	return [
		{
			id: 'active-facilities',
			name: 'Active Facilities',
			description: 'Facilities with locations',
			filters: {
				has_locations: true
			},
			entityType: 'facilities',
			createdAt: new Date().toISOString()
		},
		{
			id: 'needs-locations',
			name: 'Needs Locations',
			description: 'Facilities without any locations defined',
			filters: {
				has_locations: false
			},
			entityType: 'facilities',
			createdAt: new Date().toISOString()
		}
	]
}

/**
 * Initialize default presets if none exist
 */
export function initializeDefaultPresets(): void {
	const currentPresets = get(filterPresetsStore)

	if (currentPresets.length === 0) {
		const defaultPresets = [
			...createDefaultEventPresets(),
			...createDefaultFacilityPresets()
		]

		defaultPresets.forEach(preset => {
			filterPresetsStore.add(preset)
		})
	}
}
