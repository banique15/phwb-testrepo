import { z } from 'zod'

export const productionManagerSchema = z.object({
	id: z.string().uuid().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	full_name: z.string().optional(),
	legal_first_name: z.string().min(1, 'First name is required'),
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
})

export const createProductionManagerSchema = productionManagerSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
})

export const updateProductionManagerSchema = createProductionManagerSchema.partial()

export type ProductionManager = z.infer<typeof productionManagerSchema>
export type CreateProductionManager = z.infer<typeof createProductionManagerSchema>
export type UpdateProductionManager = z.infer<typeof updateProductionManagerSchema>

