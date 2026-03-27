import { z } from 'zod'

export const bugSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	title: z.string().min(1, 'Title is required').max(500, 'Title must be less than 500 characters'),
	description: z.string().max(10000, 'Description must be less than 10000 characters').optional(),
	status: z.enum(['new', 'planning', 'in_progress', 'testing', 'review', 'qa_passed', 'resolved']).default('new'),
	priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
	// severity is deprecated - use priority instead
	severity: z.enum(['cosmetic', 'minor', 'moderate', 'major', 'critical']).optional().default('moderate'),
	category: z.string().max(100, 'Category must be less than 100 characters').optional(),
	reported_by: z.string().uuid('Invalid user ID').optional(),
	assigned_to: z.string().uuid('Invalid user ID').optional().nullable(),
	due_date: z.string().optional().nullable(),
	resolved_at: z.string().optional().nullable(),
	resolved_by: z.string().uuid('Invalid user ID').optional().nullable(),
	closed_at: z.string().optional().nullable(),
	closed_by: z.string().uuid('Invalid user ID').optional().nullable(),
	replication_data: z.object({
		report: z.string(),
		screenshot_ids: z.array(z.number())
	}).optional().nullable(),
})

export const createBugSchema = bugSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
	resolved_at: true,
	resolved_by: true,
	closed_at: true,
	closed_by: true,
})

export const updateBugSchema = bugSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
}).partial()

export type Bug = z.infer<typeof bugSchema>
export type CreateBug = z.infer<typeof createBugSchema>
export type UpdateBug = z.infer<typeof updateBugSchema>
