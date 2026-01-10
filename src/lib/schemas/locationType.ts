import { z } from 'zod'

export const locationTypeSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	name: z.string().min(1, 'Type name is required').max(100, 'Name must be less than 100 characters'),
	description: z.string().max(500, 'Description must be less than 500 characters').optional().nullable(),
	active: z.boolean().default(true),
})

export const createLocationTypeSchema = locationTypeSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
})

export const updateLocationTypeSchema = createLocationTypeSchema.partial()

export type LocationType = z.infer<typeof locationTypeSchema>
export type CreateLocationType = z.infer<typeof createLocationTypeSchema>
export type UpdateLocationType = z.infer<typeof updateLocationTypeSchema>
