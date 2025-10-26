import { z } from 'zod'

export const profileSchema = z.object({
	id: z.string().uuid('Invalid profile ID'),
	updated_at: z.string().optional(),
	username: z.string().min(3, 'Username must be at least 3 characters').max(50, 'Username must be less than 50 characters').optional(),
	full_name: z.string().max(200, 'Full name must be less than 200 characters').optional(),
	avatar_url: z.string().url('Invalid avatar URL format').optional(),
	website: z.string().url('Invalid website URL format').optional(),
})

export const createProfileSchema = profileSchema.omit({
	updated_at: true,
})

export const updateProfileSchema = profileSchema.omit({
	id: true,
	updated_at: true,
}).partial()

export type Profile = z.infer<typeof profileSchema>
export type CreateProfile = z.infer<typeof createProfileSchema>
export type UpdateProfile = z.infer<typeof updateProfileSchema>