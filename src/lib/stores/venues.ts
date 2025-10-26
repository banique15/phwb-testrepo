import { createBaseStore } from './base'
import { venueSchema, type Venue, type CreateVenue, type UpdateVenue } from '$lib/schemas/venue'

export const venuesStore = createBaseStore<Venue, CreateVenue, UpdateVenue>({
	tableName: 'phwb_venues',
	schema: venueSchema,
	searchFields: ['name', 'address', 'description'],
	defaultSortBy: 'created_at',
	defaultSortOrder: 'desc'
})

// Export the base store functionality
export const {
	subscribe,
	fetchPaginated,
	fetchAll,
	create: createVenue,
	update: updateVenue,
	delete: deleteVenue,
	getById: getVenueById,
	subscribeToChanges: subscribeToVenueChanges,
	unsubscribeFromChanges: unsubscribeFromVenueChanges,
	clearError: clearVenueError,
	reset: resetVenuesStore
} = venuesStore