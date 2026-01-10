import { z } from 'zod'

export const bugActivitySchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	bug_id: z.number(),
	user_id: z.string().uuid('Invalid user ID').optional(),
	action: z.enum(['created', 'updated', 'status_changed', 'assigned', 'commented', 'attachment_added', 'label_added', 'label_removed', 'reopened', 'resolved', 'closed']),
	old_value: z.string().optional().nullable(),
	new_value: z.string().optional().nullable(),
	metadata: z.record(z.any()).optional(),
})

export type BugActivity = z.infer<typeof bugActivitySchema>
