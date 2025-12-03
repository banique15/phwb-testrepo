import { z } from 'zod'

export const artistPhotoSchema = z.object({
	id: z.string().uuid().optional(),
	artist_id: z.string().uuid(),
	photo_url: z.string().url(),
	storage_path: z.string(),
	title: z.string().max(200).optional().nullable(),
	sort_order: z.number().int().min(0).default(0),
	created_at: z.string().optional()
})

export const createArtistPhotoSchema = artistPhotoSchema.omit({
	id: true,
	created_at: true
})

export const updateArtistPhotoSchema = z.object({
	title: z.string().max(200).optional().nullable(),
	sort_order: z.number().int().min(0).optional()
})

export type ArtistPhoto = z.infer<typeof artistPhotoSchema>
export type CreateArtistPhoto = z.infer<typeof createArtistPhotoSchema>
export type UpdateArtistPhoto = z.infer<typeof updateArtistPhotoSchema>
