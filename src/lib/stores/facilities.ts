import { createBaseStore } from './base'
import { facilitySchema, type Facility, type CreateFacility, type UpdateFacility } from '$lib/schemas/facility'

export const facilitiesStore = createBaseStore<Facility, CreateFacility, UpdateFacility>({
	tableName: 'phwb_facilities',
	schema: facilitySchema,
	searchFields: ['name', 'address', 'type', 'description'],
	defaultSortBy: 'name',
	defaultSortOrder: 'asc'
})

// Export the base store functionality
export const {
	subscribe,
	fetchPaginated,
	fetchAll,
	create: createFacility,
	update: updateFacility,
	delete: deleteFacility,
	getById: getFacilityById,
	subscribeToChanges: subscribeToFacilityChanges,
	unsubscribeFromChanges: unsubscribeFromFacilityChanges,
	clearError: clearFacilityError,
	reset: resetFacilitiesStore
} = facilitiesStore
