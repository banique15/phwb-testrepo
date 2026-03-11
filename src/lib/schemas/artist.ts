import { z } from 'zod'

export const artistSchema = z.object({
	id: z.string().uuid().optional(),
	created_at: z.string().optional(),
	full_name: z.string().optional(),
	artist_name: z.string().optional(),
	legal_name: z.string().optional(),
	legal_first_name: z.string().min(1, 'Legal first name is required'),
	legal_last_name: z.string().optional(),
	middle_name: z.string().optional(),
	public_first_name: z.string().optional(),
	public_last_name: z.string().optional(),
	dob: z.string().optional(),
	email: z.string().email('Invalid email format').optional(),
	work_email: z.string().email('Invalid email format').optional(),
	phone: z.string().optional(),
	location: z.string().optional(),
	employment_status: z.string().optional(),
	profile_photo: z.string().url('Invalid URL format').optional(),
	address: z.string().optional(),
	address_line_2: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	zip_code: z.string().optional(),
	lived_in_state: z.string().optional(),
	worked_in_state: z.string().optional(),
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
	sight_reading_level: z.string().optional(),
	can_be_soloist: z.boolean().optional(),
	anti_harassment_training_date: z.string().optional(),
	social_security_number: z.string().optional(),
	instagram: z.string().optional(),
	website: z.union([z.string().url('Invalid URL format'), z.literal('')]).optional(),
	metropolitan_hub: z.string().optional(),
	one_sentence_bio: z.string().max(200, 'One sentence bio must be less than 200 characters').optional(),
	facebook: z.string().optional(),
	// HR System Fields
	associate_id: z.string().optional(),
	job_title: z.string().optional(),
	is_production_manager: z.boolean().optional(),
	worker_category: z.string().optional(),
	position_status: z.enum(['active', 'terminated', 'on_leave']).optional(),
	hire_date: z.string().optional(),
	termination_date: z.string().optional(),
	llc_name: z.string().optional(),
	onboarding_complete: z.boolean().optional(),
	ensembles_text: z.string().optional(),
	// Demographics
	gender: z.string().optional(),
	ethnicity: z.string().optional(),
	race: z.string().optional(),
	marital_status: z.string().optional(),
})

export const createArtistSchema = artistSchema.omit({
	id: true,
	created_at: true,
})

export const updateArtistSchema = createArtistSchema.partial()

export type Artist = z.infer<typeof artistSchema>
export type CreateArtist = z.infer<typeof createArtistSchema>
export type UpdateArtist = z.infer<typeof updateArtistSchema>