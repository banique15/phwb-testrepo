import { writable, get } from 'svelte/store'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'
import type { ArtistPhoto, CreateArtistPhoto, UpdateArtistPhoto } from '$lib/schemas/artistPhoto'

const BUCKET_NAME = 'artist-photos'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

interface ArtistPhotosState {
	photos: ArtistPhoto[]
	loading: boolean
	uploading: boolean
	error: string | null
}

function createArtistPhotosStore() {
	const initialState: ArtistPhotosState = {
		photos: [],
		loading: false,
		uploading: false,
		error: null
	}

	const { subscribe, set, update } = writable<ArtistPhotosState>(initialState)

	return {
		subscribe,

		async fetchByArtistId(artistId: string) {
			update(s => ({ ...s, loading: true, error: null }))

			try {
				const { data, error } = await supabase
					.from('phwb_artist_photos')
					.select('*')
					.eq('artist_id', artistId)
					.order('sort_order', { ascending: true })

				if (error) throw error

				update(s => ({
					...s,
					photos: data || [],
					loading: false
				}))

				return data || []
			} catch (error) {
				const errorId = errorStore.handleError(error, 'Failed to fetch artist photos')
				update(s => ({ ...s, loading: false, error: errorId }))
				throw error
			}
		},

		validateFile(file: File): { valid: boolean; error?: string } {
			if (!ALLOWED_TYPES.includes(file.type)) {
				return {
					valid: false,
					error: `Invalid file type. Allowed: ${ALLOWED_TYPES.map(t => t.split('/')[1]).join(', ')}`
				}
			}
			if (file.size > MAX_FILE_SIZE) {
				return {
					valid: false,
					error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
				}
			}
			return { valid: true }
		},

		async uploadPhoto(artistId: string, file: File, title?: string) {
			const validation = this.validateFile(file)
			if (!validation.valid) {
				throw new Error(validation.error)
			}

			update(s => ({ ...s, uploading: true, error: null }))

			try {
				// Generate unique storage path
				const ext = file.name.split('.').pop() || 'jpg'
				const timestamp = Date.now()
				const random = Math.random().toString(36).substring(2, 8)
				const storagePath = `${artistId}/${timestamp}-${random}.${ext}`

				// Upload to Supabase Storage
				const { error: uploadError } = await supabase.storage
					.from(BUCKET_NAME)
					.upload(storagePath, file, {
						cacheControl: '3600',
						upsert: false
					})

				if (uploadError) throw uploadError

				// Get public URL
				const { data: urlData } = supabase.storage
					.from(BUCKET_NAME)
					.getPublicUrl(storagePath)

				const photoUrl = urlData.publicUrl

				// Get current max sort_order
				const currentPhotos = get({ subscribe }).photos
				const maxSortOrder = currentPhotos.length > 0
					? Math.max(...currentPhotos.map(p => p.sort_order))
					: -1

				// Create database record
				const photoData: CreateArtistPhoto = {
					artist_id: artistId,
					photo_url: photoUrl,
					storage_path: storagePath,
					title: title || null,
					sort_order: maxSortOrder + 1
				}

				const { data, error: dbError } = await supabase
					.from('phwb_artist_photos')
					.insert([{ ...photoData, id: crypto.randomUUID() }])
					.select()
					.single()

				if (dbError) {
					// Clean up uploaded file if DB insert fails
					await supabase.storage.from(BUCKET_NAME).remove([storagePath])
					throw dbError
				}

				update(s => ({
					...s,
					photos: [...s.photos, data],
					uploading: false
				}))

				return data
			} catch (error) {
				const errorId = errorStore.handleError(error, 'Failed to upload photo')
				update(s => ({ ...s, uploading: false, error: errorId }))
				throw error
			}
		},

		async deletePhoto(id: string, storagePath: string) {
			update(s => ({ ...s, loading: true, error: null }))

			try {
				// Delete from storage
				const { error: storageError } = await supabase.storage
					.from(BUCKET_NAME)
					.remove([storagePath])

				if (storageError) {
					console.warn('Failed to delete from storage:', storageError)
					// Continue with DB deletion even if storage fails
				}

				// Delete from database
				const { error: dbError } = await supabase
					.from('phwb_artist_photos')
					.delete()
					.eq('id', id)

				if (dbError) throw dbError

				update(s => ({
					...s,
					photos: s.photos.filter(p => p.id !== id),
					loading: false
				}))
			} catch (error) {
				const errorId = errorStore.handleError(error, 'Failed to delete photo')
				update(s => ({ ...s, loading: false, error: errorId }))
				throw error
			}
		},

		async updateTitle(id: string, title: string | null) {
			try {
				const { data, error } = await supabase
					.from('phwb_artist_photos')
					.update({ title })
					.eq('id', id)
					.select()
					.single()

				if (error) throw error

				update(s => ({
					...s,
					photos: s.photos.map(p => p.id === id ? data : p)
				}))

				return data
			} catch (error) {
				const errorId = errorStore.handleError(error, 'Failed to update photo title')
				throw error
			}
		},

		async updateOrder(photos: ArtistPhoto[]) {
			try {
				// Update each photo's sort_order
				const updates = photos.map((photo, index) => ({
					id: photo.id,
					sort_order: index
				}))

				for (const { id, sort_order } of updates) {
					const { error } = await supabase
						.from('phwb_artist_photos')
						.update({ sort_order })
						.eq('id', id)

					if (error) throw error
				}

				update(s => ({
					...s,
					photos: photos.map((p, i) => ({ ...p, sort_order: i }))
				}))
			} catch (error) {
				const errorId = errorStore.handleError(error, 'Failed to update photo order')
				throw error
			}
		},

		reset() {
			set(initialState)
		}
	}
}

export const artistPhotosStore = createArtistPhotosStore()
