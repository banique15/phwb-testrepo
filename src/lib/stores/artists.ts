import { createBaseStore } from './base'
import { artistSchema, type Artist, type CreateArtist, type UpdateArtist } from '$lib/schemas/artist'
import { supabase } from '$lib/supabase'
import { queueArtistAddedNotification } from '$lib/services/notification-producer'

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

		// NOTE:
		// `onConflict: 'artist_id'` can be unreliable when environments use
		// a partial unique index on artist_id. Use explicit select->update/insert
		// so artist PM sync is deterministic across schemas.
		const { data: existing, error: lookupError } = await supabase
			.from('phwb_production_managers')
			.select('id')
			.eq('artist_id', artist.id)
			.maybeSingle()

		if (lookupError) {
			console.error('Failed looking up production manager row for artist:', lookupError)
			return
		}

		if (existing?.id) {
			const { error: updateError } = await supabase
				.from('phwb_production_managers')
				.update(payload)
				.eq('id', existing.id)

			if (updateError) {
				console.error('Failed updating production manager row for artist:', updateError)
			}
		} else {
			const { error: insertError } = await supabase
				.from('phwb_production_managers')
				.insert(payload)

			if (insertError) {
				console.error('Failed creating production manager row for artist:', insertError)
			}
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
	try {
		await queueArtistAddedNotification(created)
	} catch (error) {
		console.error('Failed to queue artist added notification:', error)
	}
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