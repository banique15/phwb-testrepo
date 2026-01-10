import { z } from 'zod'

export const bugLabelSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	name: z.string().min(1, 'Label name is required').max(100, 'Label name must be less than 100 characters'),
	color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color').default('#3b82f6'),
	description: z.string().max(500, 'Description must be less than 500 characters').optional(),
})

export const createBugLabelSchema = bugLabelSchema.omit({
	id: true,
	created_at: true,
})

export const updateBugLabelSchema = bugLabelSchema.partial().required({
	name: true,
})

export type BugLabel = z.infer<typeof bugLabelSchema>
export type CreateBugLabel = z.infer<typeof createBugLabelSchema>
export type UpdateBugLabel = z.infer<typeof updateBugLabelSchema>
