import { z } from 'zod'

// Contact type options
export const CONTACT_TYPES = ['general', 'emergency', 'scheduling', 'technical', 'security', 'logistics'] as const

export const locationContactSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	location_id: z.number().min(1, 'Location is required'),
	name: z.string().min(1, 'Contact name is required').max(200, 'Name must be less than 200 characters'),
	title: z.string().max(200, 'Title must be less than 200 characters').optional().nullable(),
	role: z.string().max(100, 'Role must be less than 100 characters').optional().nullable(),
	email: z.string().email('Invalid email format').max(255, 'Email must be less than 255 characters').optional().nullable(),
	phone: z.string().max(50, 'Phone must be less than 50 characters').optional().nullable(),
	phone_ext: z.string().max(20, 'Extension must be less than 20 characters').optional().nullable(),
	primary_contact: z.boolean().default(false),
	contact_type: z.enum(CONTACT_TYPES).default('general'),
	availability_notes: z.string().optional().nullable(),
	active: z.boolean().default(true),
	notes: z.string().optional().nullable(),
})
.refine(
	(data) => data.email || data.phone,
	{
		message: 'At least one contact method (email or phone) is required',
		path: ['email']
	}
)

export const createLocationContactSchema = locationContactSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
})

export const updateLocationContactSchema = createLocationContactSchema.partial()

export type LocationContact = z.infer<typeof locationContactSchema>
export type CreateLocationContact = z.infer<typeof createLocationContactSchema>
export type UpdateLocationContact = z.infer<typeof updateLocationContactSchema>

// Extended type that includes location information
export type LocationContactWithLocation = LocationContact & {
	location?: {
		id: number
		name: string
		facility_id: number
		floor?: string
	}
}

// Event-specific location contact assignment schema
export const eventLocationContactSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	event_id: z.number().min(1, 'Event is required'),
	location_contact_id: z.number().min(1, 'Location contact is required'),
	is_primary_for_event: z.boolean().default(false),
	notes: z.string().optional().nullable(),
})

export const createEventLocationContactSchema = eventLocationContactSchema.omit({
	id: true,
	created_at: true,
})

export type EventLocationContact = z.infer<typeof eventLocationContactSchema>
export type CreateEventLocationContact = z.infer<typeof createEventLocationContactSchema>

// Helper type for event contacts with full contact details
export type EventContactWithDetails = EventLocationContact & {
	contact?: LocationContact
}
