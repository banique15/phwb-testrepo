import { createBaseStore } from './base'
import { facilityTypeSchema, type FacilityType, type CreateFacilityType, type UpdateFacilityType } from '$lib/schemas/facilityType'

export const facilityTypesStore = createBaseStore<FacilityType, CreateFacilityType, UpdateFacilityType>({
	tableName: 'phwb_facility_types',
	schema: facilityTypeSchema,
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
	delete: deleteFacilityType,
	getById,
	subscribeToChanges,
	unsubscribeFromChanges,
	clearError: clearFacilityTypeError,
	reset: resetFacilityTypesStore
} = facilityTypesStore
