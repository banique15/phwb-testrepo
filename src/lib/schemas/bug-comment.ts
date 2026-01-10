import { z } from 'zod'

export const bugCommentSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	bug_id: z.number(),
	user_id: z.string().uuid('Invalid user ID').optional(),
	content: z.string().min(1, 'Comment cannot be empty').max(5000, 'Comment must be less than 5000 characters'),
	is_internal: z.boolean().default(false),
	edited_at: z.string().optional().nullable(),
})

export const createBugCommentSchema = bugCommentSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
	edited_at: true,
})

export const updateBugCommentSchema = bugCommentSchema.partial().required({
	content: true,
})

export type BugComment = z.infer<typeof bugCommentSchema>
export type CreateBugComment = z.infer<typeof createBugCommentSchema>
export type UpdateBugComment = z.infer<typeof updateBugCommentSchema>
