import { createBaseStore } from './base'
import { locationSchema, type Location, type CreateLocation, type UpdateLocation } from '$lib/schemas/location'

export const locationsStore = createBaseStore<Location, CreateLocation, UpdateLocation>({
	tableName: 'phwb_locations',
	schema: locationSchema,
	searchFields: ['name', 'description', 'floor'],
	defaultSortBy: 'name',
	defaultSortOrder: 'asc'
})

// Export the base store functionality
export const {
	subscribe,
	fetchPaginated,
	fetchAll,
	create: createLocation,
	update: updateLocation,
	delete: deleteLocation,
	getById: getLocationById,
	subscribeToChanges: subscribeToLocationChanges,
	unsubscribeFromChanges: unsubscribeFromLocationChanges,
	clearError: clearLocationError,
	reset: resetLocationsStore
} = locationsStore

// Additional helper methods using the base store's supabase client
import { supabase } from '$lib/supabase'

export async function getLocationsByFacility(facilityId: number): Promise<Location[]> {
	const { data, error } = await supabase
		.from('phwb_locations')
		.select('*')
		.eq('facility_id', facilityId)
		.eq('active', true)
		.order('name', { ascending: true })

	if (error) {
		console.error('Error fetching locations by facility:', error)
		throw error
	}

	return data
}
