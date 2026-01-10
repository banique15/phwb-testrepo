import { z } from 'zod'

export const facilityTypeSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	name: z.string().min(1, 'Type name is required').max(100, 'Name must be less than 100 characters'),
	description: z.string().max(500, 'Description must be less than 500 characters').optional().nullable(),
	active: z.boolean().default(true),
})

export const createFacilityTypeSchema = facilityTypeSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
})

export const updateFacilityTypeSchema = createFacilityTypeSchema.partial()

export type FacilityType = z.infer<typeof facilityTypeSchema>
export type CreateFacilityType = z.infer<typeof createFacilityTypeSchema>
export type UpdateFacilityType = z.infer<typeof updateFacilityTypeSchema>
