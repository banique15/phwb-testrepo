import { z } from 'zod'

export const contactPersonSchema = z.object({
	name: z.string().min(1, 'Contact name is required').max(200, 'Name must be less than 200 characters'),
	title: z.string().max(200, 'Title must be less than 200 characters').optional(),
	email: z.string().email('Invalid email format').optional().or(z.literal('')),
	phone: z.string().max(50, 'Phone must be less than 50 characters').optional(),
	address: z.string().max(500, 'Address must be less than 500 characters').optional(),
	isPrimary: z.boolean().optional().default(false),
})

export const partnerSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	name: z.string().min(1, 'Partner name is required').max(200, 'Name must be less than 200 characters').optional(),
	organization: z.string().max(200, 'Organization must be less than 200 characters').optional(),
	description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
	website: z.string().url('Invalid URL format').or(z.literal('')).optional(),
	logo: z.string().url('Invalid logo URL format').or(z.literal('')).optional(),
	contacts: z.array(contactPersonSchema).optional(),
	history: z.any().optional(),
})

export const createPartnerSchema = partnerSchema.omit({
	id: true,
	created_at: true,
})

export const updatePartnerSchema = createPartnerSchema.partial()

export type ContactPerson = z.infer<typeof contactPersonSchema>
export type Partner = z.infer<typeof partnerSchema>
export type CreatePartner = z.infer<typeof createPartnerSchema>
export type UpdatePartner = z.infer<typeof updatePartnerSchema>