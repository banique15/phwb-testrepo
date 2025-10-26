import { z } from 'zod'

export const eventSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	title: z.string().max(200, 'Title must be less than 200 characters'),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
	start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Start time must be in HH:MM format').optional(),
	end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'End time must be in HH:MM format').optional(),
	schedule: z.any().optional(),
	status: z.enum(['planned', 'confirmed', 'in_progress', 'completed', 'cancelled']).default('planned'),
	requirements: z.any().optional(),
	artists: z.any().optional(),
	feedback: z.any().optional(),
	notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional(),
	venue: z.number().optional(), // Legacy field - deprecated in favor of location_id
	location_id: z.number().optional(),
	program: z.number().optional(),
	// New fields for event imports
	event_type: z.string().max(100, 'Event type must be less than 100 characters').optional(),
	confirmation_status: z.enum(['confirmed', 'hold', 'cancelled', 'pending']).optional(),
	total_hours_of_service: z.number().min(0, 'Total hours must be non-negative').optional(),
	total_fee: z.number().min(0, 'Total fee must be non-negative').optional(),
	instrumentation_requirements: z.string().max(500, 'Instrumentation requirements must be less than 500 characters').optional(),
	number_of_musicians: z.number().int().min(0, 'Number of musicians must be a non-negative integer').optional(),
	location_detail: z.string().max(200, 'Location detail must be less than 200 characters').optional(),
	digital_flyer_link: z.string().url('Invalid URL format').or(z.literal('')).optional(),
})

export const createEventSchema = eventSchema.omit({
	id: true,
	created_at: true,
})

export const updateEventSchema = createEventSchema.partial()

export type Event = z.infer<typeof eventSchema>
export type CreateEvent = z.infer<typeof createEventSchema>
export type UpdateEvent = z.infer<typeof updateEventSchema>