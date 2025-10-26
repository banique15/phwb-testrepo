import { z } from 'zod'

export const programSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	title: z.string().min(1, 'Program title is required').max(200, 'Title must be less than 200 characters').optional(),
	description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
	geo_coverage: z.string().max(200, 'Geographic coverage must be less than 200 characters').optional(),
	start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional(),
	end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional(),
	partner: z.number().optional(),
	programmer: z.string().max(200, 'Programmer must be less than 200 characters').optional(),
	funder: z.string().max(200, 'Funder must be less than 200 characters').optional(),
	notes: z.any().optional(),
})

export const createProgramSchema = programSchema.omit({
	id: true,
	created_at: true,
})

export const updateProgramSchema = createProgramSchema.partial()

export type Program = z.infer<typeof programSchema>
export type CreateProgram = z.infer<typeof createProgramSchema>
export type UpdateProgram = z.infer<typeof updateProgramSchema>