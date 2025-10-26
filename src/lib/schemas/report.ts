import { z } from 'zod'

export const reportSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	title: z.string().min(1, 'Report title is required').max(200, 'Title must be less than 200 characters').optional(),
	type: z.string().max(100, 'Type must be less than 100 characters').optional(),
	summary: z.string().max(1000, 'Summary must be less than 1000 characters').optional(),
	content: z.string().optional(),
	sources: z.string().max(500, 'Sources must be less than 500 characters').optional(),
	pdf: z.string().url('Invalid PDF URL format').optional(),
	audit_log: z.any().optional(),
})

export const createReportSchema = reportSchema.omit({
	id: true,
	created_at: true,
})

export const updateReportSchema = createReportSchema.partial()

export type Report = z.infer<typeof reportSchema>
export type CreateReport = z.infer<typeof createReportSchema>
export type UpdateReport = z.infer<typeof updateReportSchema>