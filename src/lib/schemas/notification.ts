import { z } from 'zod'

export const notificationSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	read_at: z.string().nullable().optional(),

	user_id: z.string().uuid('Invalid user ID'),
	type: z.enum(['bug_comment']),
	title: z.string().min(1, 'Title is required'),
	message: z.string().optional().nullable(),

	bug_id: z.number().optional().nullable(),
	bug_comment_id: z.number().optional().nullable(),

	is_read: z.boolean().default(false),
	metadata: z.record(z.any()).optional().nullable()
})

export const createNotificationSchema = notificationSchema.omit({
	id: true,
	created_at: true,
	read_at: true,
	is_read: true
})

export const updateNotificationSchema = notificationSchema.partial()

export type Notification = z.infer<typeof notificationSchema>
export type CreateNotification = z.infer<typeof createNotificationSchema>
export type UpdateNotification = z.infer<typeof updateNotificationSchema>

