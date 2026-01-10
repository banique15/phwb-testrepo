import { z } from 'zod'

export const bugRelationSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	bug_id: z.number(),
	related_bug_id: z.number(),
	relation_type: z.enum(['duplicate', 'related', 'blocks', 'blocked_by', 'depends_on']),
	created_by: z.string().uuid('Invalid user ID').optional(),
})

export const createBugRelationSchema = bugRelationSchema.omit({
	id: true,
	created_at: true,
})

export type BugRelation = z.infer<typeof bugRelationSchema>
export type CreateBugRelation = z.infer<typeof createBugRelationSchema>
