import { createBaseStore } from './base'
import { artistSchema, type Artist, type CreateArtist, type UpdateArtist } from '$lib/schemas/artist'

export const artistsStore = createBaseStore<Artist, CreateArtist, UpdateArtist>({
	tableName: 'phwb_artists',
	schema: artistSchema,
	searchFields: ['artist_name'],
	defaultSortBy: 'created_at',
	defaultSortOrder: 'desc'
})

// Export the base store functionality
export const {
	subscribe,
	fetchPaginated,
	fetchAll,
	create: createArtist,
	update: updateArtist,
	delete: deleteArtist,
	getById: getArtistById,
	subscribeToChanges: subscribeToArtistChanges,
	unsubscribeFromChanges: unsubscribeFromArtistChanges,
	clearError: clearArtistError,
	reset: resetArtistsStore
} = artistsStore