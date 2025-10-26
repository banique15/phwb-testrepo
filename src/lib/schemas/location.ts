import { z } from 'zod'

export const locationSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	facility_id: z.number().min(1, 'Facility is required'),
	name: z.string().min(1, 'Location name is required').max(200, 'Name must be less than 200 characters'),
	description: z.string().max(1000, 'Description must be less than 1000 characters').optional().nullable(),
	floor: z.string().max(50, 'Floor must be less than 50 characters').optional().nullable(),
	capacity: z.number().int().min(0, 'Capacity must be non-negative').optional().nullable(),
	accessibility_features: z.any().optional().nullable(),
	equipment_available: z.any().optional().nullable(),
	attributes: z.any().optional().nullable(),
	notes: z.string().optional().nullable(),
	active: z.boolean().default(true),
})

export const createLocationSchema = locationSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
})

export const updateLocationSchema = createLocationSchema.partial()

export type Location = z.infer<typeof locationSchema>
export type CreateLocation = z.infer<typeof createLocationSchema>
export type UpdateLocation = z.infer<typeof updateLocationSchema>

// Extended type that includes facility information
export type LocationWithFacility = Location & {
	facility?: {
		id: number
		name: string
		address?: string
		type?: string
	}
}
