import { z } from 'zod'

export const facilitySchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	name: z.string().min(1, 'Facility name is required').max(200, 'Name must be less than 200 characters'),
	image: z.string().url('Invalid image URL format').optional().nullable(),
	address: z.string().max(500, 'Address must be less than 500 characters').optional().nullable(),
	type: z.string().max(100, 'Type must be less than 100 characters').optional().nullable(),
	reference: z.string().max(200, 'Reference must be less than 200 characters').optional().nullable(),
	description: z.string().max(2000, 'Description must be less than 2000 characters').optional().nullable(),
	parking: z.any().optional().nullable(),
	contacts: z.any().optional().nullable(),
	partner: z.number().optional().nullable(),
	notes: z.string().optional().nullable(),
})

export const createFacilitySchema = facilitySchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
})

export const updateFacilitySchema = createFacilitySchema.partial()

export type Facility = z.infer<typeof facilitySchema>
export type CreateFacility = z.infer<typeof createFacilitySchema>
export type UpdateFacility = z.infer<typeof updateFacilitySchema>
