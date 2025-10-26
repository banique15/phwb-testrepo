import { z } from 'zod'

export const configOptionSchema = z.object({
	id: z.string().uuid('Invalid config option ID').optional(),
	entity: z.string().min(1, 'Entity is required').max(100, 'Entity must be less than 100 characters'),
	field: z.string().min(1, 'Field is required').max(100, 'Field must be less than 100 characters'),
	value: z.string().min(1, 'Value is required').max(500, 'Value must be less than 500 characters'),
	order_num: z.number().min(0, 'Order number must be non-negative').optional(),
	active: z.boolean().default(true).optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
})

export const createConfigOptionSchema = configOptionSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
})

export const updateConfigOptionSchema = createConfigOptionSchema.partial()

export type ConfigOption = z.infer<typeof configOptionSchema>
export type CreateConfigOption = z.infer<typeof createConfigOptionSchema>
export type UpdateConfigOption = z.infer<typeof updateConfigOptionSchema>