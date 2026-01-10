import { z } from 'zod'

export const bugAttachmentSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	bug_id: z.number(),
	user_id: z.string().uuid('Invalid user ID').optional(),
	uploaded_by: z.string().uuid('Invalid user ID').optional(),
	file_name: z.string().min(1, 'File name is required').max(500, 'File name must be less than 500 characters'),
	file_path: z.string().min(1, 'File path is required'),
	file_size: z.number().optional(),
	mime_type: z.string().max(100, 'MIME type must be less than 100 characters').optional(),
})

export const createBugAttachmentSchema = bugAttachmentSchema.omit({
	id: true,
	created_at: true,
})

export type BugAttachment = z.infer<typeof bugAttachmentSchema>
export type CreateBugAttachment = z.infer<typeof createBugAttachmentSchema>
