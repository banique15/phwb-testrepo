import { z } from 'zod'

export const venueSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	name: z.string().min(1, 'Venue name is required').max(200, 'Name must be less than 200 characters').optional(),
	image: z.string().url('Invalid image URL format').optional(),
	address: z.string().max(500, 'Address must be less than 500 characters').optional(),
	type: z.string().max(100, 'Type must be less than 100 characters').optional(),
	reference: z.string().max(200, 'Reference must be less than 200 characters').optional(),
	description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
	parking: z.any().optional(),
	contacts: z.any().optional(),
})

export const createVenueSchema = venueSchema.omit({
	id: true,
	created_at: true,
})

export const updateVenueSchema = createVenueSchema.partial()

export type Venue = z.infer<typeof venueSchema>
export type CreateVenue = z.infer<typeof createVenueSchema>
export type UpdateVenue = z.infer<typeof updateVenueSchema>