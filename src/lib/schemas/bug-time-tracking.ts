import { z } from 'zod'

export const bugTimeTrackingSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	bug_id: z.number(),
	user_id: z.string().uuid('Invalid user ID').optional(),
	time_spent_minutes: z.number().int().positive('Time spent must be a positive number'),
	description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
	date: z.string().default(() => new Date().toISOString().split('T')[0]),
})

export const createBugTimeTrackingSchema = bugTimeTrackingSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
})

export const updateBugTimeTrackingSchema = bugTimeTrackingSchema.partial().required({
	time_spent_minutes: true,
})

export type BugTimeTracking = z.infer<typeof bugTimeTrackingSchema>
export type CreateBugTimeTracking = z.infer<typeof createBugTimeTrackingSchema>
export type UpdateBugTimeTracking = z.infer<typeof updateBugTimeTrackingSchema>
