import { z } from 'zod'

const productionManagerBaseSchema = z.object({
	id: z.string().uuid().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	full_name: z.string().optional(),
	legal_first_name: z.string().optional(),
	legal_last_name: z.string().optional(),
	email: z.string().email('Invalid email format').optional(),
	phone: z.string().optional(),
	location: z.string().optional(),
	address: z.string().optional(),
	address_line_2: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	zip_code: z.string().optional(),
	notes: z.string().optional(),
	user_id: z.string().uuid().optional().nullable(),
	facility_id: z.number().int().optional().nullable(),
	artist_id: z.string().uuid().optional().nullable(),
	source_type: z.enum(['artist', 'non_artist']).optional(),
})

export const productionManagerSchema = productionManagerBaseSchema.refine((data) => {
	return Boolean(data.full_name?.trim() || data.legal_first_name?.trim())
}, {
	message: 'Either full name or legal first name is required',
	path: ['full_name']
})

const createProductionManagerBaseSchema = productionManagerBaseSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
})

export const createProductionManagerSchema = createProductionManagerBaseSchema.refine((data) => {
	return Boolean(data.full_name?.trim() || data.legal_first_name?.trim())
}, {
	message: 'Either full name or legal first name is required',
	path: ['full_name']
})

export const updateProductionManagerSchema = createProductionManagerBaseSchema.partial()

export type ProductionManager = z.infer<typeof productionManagerSchema>
export type CreateProductionManager = z.infer<typeof createProductionManagerSchema>
export type UpdateProductionManager = z.infer<typeof updateProductionManagerSchema>

