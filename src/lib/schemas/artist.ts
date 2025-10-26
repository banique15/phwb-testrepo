import { z } from 'zod'

export const artistSchema = z.object({
	id: z.string().uuid().optional(),
	created_at: z.string().optional(),
	full_name: z.string().optional(),
	artist_name: z.string().optional(),
	legal_name: z.string().optional(),
	legal_first_name: z.string().min(1, 'Legal first name is required'),
	legal_last_name: z.string().optional(),
	public_first_name: z.string().optional(),
	public_last_name: z.string().optional(),
	dob: z.string().optional(),
	email: z.string().email('Invalid email format').optional(),
	phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone format').optional(),
	location: z.string().optional(),
	employment_status: z.string().optional(),
	profile_photo: z.string().url('Invalid URL format').optional(),
	address: z.string().optional(),
	shirt_size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']).optional(),
	genres: z.any().optional(),
	instruments: z.any().optional(),
	bio: z.string().max(2000, 'Bio must be less than 2000 characters').optional(),
	social_link: z.any().optional(),
	languages: z.any().optional(),
	availability: z.any().optional(),
	equipment_needs: z.any().optional(),
	history: z.any().optional(),
	special_requirements: z.any().optional(),
	training: z.any().optional(),
	sightreads: z.boolean().optional(),
	can_be_soloist: z.boolean().optional(),
	anti_harassment_training_date: z.string().optional(),
	social_security_number: z.string().regex(/^\d{3}-\d{2}-\d{4}$/, 'SSN must be in format XXX-XX-XXXX').optional(),
	instagram: z.string().optional(),
	website: z.string().url('Invalid URL format').optional(),
	metropolitan_hub: z.string().optional(),
	one_sentence_bio: z.string().max(200, 'One sentence bio must be less than 200 characters').optional(),
	facebook: z.string().optional(),
})

export const createArtistSchema = artistSchema.omit({
	id: true,
	created_at: true,
})

export const updateArtistSchema = createArtistSchema.partial()

export type Artist = z.infer<typeof artistSchema>
export type CreateArtist = z.infer<typeof createArtistSchema>
export type UpdateArtist = z.infer<typeof updateArtistSchema>