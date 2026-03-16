import { createBaseStore } from './base'
import { artistSchema, type Artist, type CreateArtist, type UpdateArtist } from '$lib/schemas/artist'
import { supabase } from '$lib/supabase'

export const artistsStore = createBaseStore<Artist, CreateArtist, UpdateArtist>({
	tableName: 'phwb_artists',
	schema: artistSchema,
	searchFields: ['artist_name'],
	defaultSortBy: 'created_at',
	defaultSortOrder: 'desc'
})

async function syncProductionManagerRecord(artist: Artist) {
	if (!artist?.id) return

	if (artist.is_production_manager) {
		const payload = {
			artist_id: artist.id,
			source_type: 'artist',
			full_name: artist.full_name || null,
			legal_first_name: artist.legal_first_name || null,
			legal_last_name: artist.legal_last_name || null,
			email: artist.email || null,
			phone: artist.phone || null,
			location: artist.location || null,
			address: artist.address || null,
			address_line_2: artist.address_line_2 || null,
			city: artist.city || null,
			state: artist.state || null,
			zip_code: artist.zip_code || null
		}

		const { error } = await supabase
			.from('phwb_production_managers')
			.upsert(payload, { onConflict: 'artist_id' })

		if (error) {
			console.error('Failed syncing production manager row for artist:', error)
		}
		return
	}

	const { error } = await supabase
		.from('phwb_production_managers')
		.delete()
		.eq('artist_id', artist.id)

	if (error) {
		console.error('Failed removing production manager row for artist:', error)
	}
}

export async function createArtist(data: CreateArtist) {
	const created = await artistsStore.create(data)
	await syncProductionManagerRecord(created)
	return created
}

export async function updateArtist(id: string, data: UpdateArtist) {
	const updated = await artistsStore.update(id, data)
	await syncProductionManagerRecord(updated)
	return updated
}

// Export the base store functionality
export const {
	subscribe,
	fetchPaginated,
	fetchAll,
	delete: deleteArtist,
	getById: getArtistById,
	subscribeToChanges: subscribeToArtistChanges,
	unsubscribeFromChanges: unsubscribeFromArtistChanges,
	clearError: clearArtistError,
	reset: resetArtistsStore
} = artistsStore