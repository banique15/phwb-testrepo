import { createBaseStore } from './base'
import { locationTypeSchema, type LocationType, type CreateLocationType, type UpdateLocationType } from '$lib/schemas/locationType'

export const locationTypesStore = createBaseStore<LocationType, CreateLocationType, UpdateLocationType>({
	tableName: 'phwb_location_types',
	schema: locationTypeSchema,
	searchFields: ['name', 'description'],
	defaultSortBy: 'name',
	defaultSortOrder: 'asc'
})

// Export the base store functionality
export const {
	subscribe,
	fetchPaginated,
	fetchAll,
	create,
	update,
	delete: deleteLocationType,
	getById,
	subscribeToChanges,
	unsubscribeFromChanges,
	clearError: clearLocationTypeError,
	reset: resetLocationTypesStore
} = locationTypesStore
