import { z } from 'zod'

export const payrollSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Event date must be in YYYY-MM-DD format'),
	artist_id: z.string().uuid('Invalid artist ID').optional().nullable(),
	venue_id: z.number().optional(),
	hours: z.number().min(0, 'Hours must be non-negative'),
	rate: z.number().min(0, 'Rate must be non-negative'),
	additional_pay: z.number().min(0, 'Additional pay must be non-negative'),
	additional_pay_reason: z.string().max(500, 'Additional pay reason must be less than 500 characters').optional().nullable(),
	total_pay: z.number().min(0, 'Total pay must be non-negative').optional(),
	insperity_hours: z.number().min(0, 'Artist service hours must be non-negative').optional(),
	paid_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Paid date must be in YYYY-MM-DD format').optional().nullable(),
	status: z.enum(['Planned', 'Approved', 'Paid', 'Completed', 'Cancelled']),
	event_id: z.number().optional(),
	// Worker status and type fields
	employee_contractor_status: z.enum(['employee', 'contractor', 'roster_artist', 'llc']).optional().nullable(),
	invoice_number: z.string().max(100, 'Invoice number must be less than 100 characters').optional().nullable(),
	notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional().nullable(),
	payment_type: z.enum(['performance', 'training', 'special_event', 'other']).optional().nullable(),
	base_rate: z.number().min(0, 'Base rate must be non-negative').optional(),
	additional_rate: z.number().min(0, 'Additional rate must be non-negative').optional(),
	rate_description: z.string().max(200, 'Rate description must be less than 200 characters').optional(),
	// Payment workflow fields
	approved_by: z.string().uuid('Invalid user ID').optional().nullable(),
	approved_at: z.string().optional().nullable(),
	payment_method: z.enum(['check', 'ach', 'wire', 'payroll_system', 'other']).optional().nullable(),
	payment_reference: z.string().max(200, 'Payment reference must be less than 200 characters').optional().nullable(),
	external_payment_id: z.string().max(200, 'External payment ID must be less than 200 characters').optional().nullable(),
	processed_by: z.string().uuid('Invalid user ID').optional().nullable(),
	processed_at: z.string().optional().nullable(),
	reconciled: z.boolean().default(false).optional(),
	reconciled_at: z.string().optional().nullable(),
	batch_id: z.string().max(100, 'Batch ID must be less than 100 characters').optional().nullable(),
	// Source tracking fields
	created_by: z.string().max(50, 'Created by must be less than 50 characters').optional().nullable(),
	creation_method: z.enum(['manual', 'event-automation']).optional().nullable(),
	source_event_id: z.number().optional().nullable(),
	// New fields for payroll automation (Issue #61)
	program_id: z.number().optional().nullable(),
	number_of_musicians: z.number().optional().nullable(),
	gig_duration: z.number().optional().nullable(),
	rate_card_id: z.number().optional().nullable(),
	rate_rule_id: z.number().optional().nullable(),
	facility_id: z.number().optional().nullable(),
	// New LLC field
	llc: z.string().max(100, 'LLC must be less than 100 characters').optional().nullable(),
})

export const createPayrollSchema = payrollSchema.omit({
	id: true,
	created_at: true,
	total_pay: true,
})

// Enhanced schema for CSV import with additional validation
export const csvImportPayrollSchema = payrollSchema.extend({
	// Override required fields for CSV import context
	employee_contractor_status: z.enum(['employee', 'contractor', 'roster_artist', 'llc']),
	payment_type: z.enum(['performance', 'training', 'special_event', 'other']),
}).omit({
	id: true,
	created_at: true,
})

export const updatePayrollSchema = createPayrollSchema.partial()

export type Payroll = z.infer<typeof payrollSchema> & {
	// Joined data from Supabase queries
	artists?: {
		id: string
		full_name?: string
		legal_first_name?: string
		legal_last_name?: string
		email?: string
	} | null
	venues?: {
		id: number
		name: string
	} | null
	programs?: {
		id: number
		title: string
		program_type?: string
	} | null
	facilities?: {
		id: number
		name: string
	} | null
}
export type CreatePayroll = z.infer<typeof createPayrollSchema>
export type UpdatePayroll = z.infer<typeof updatePayrollSchema>
export type CsvImportPayroll = z.infer<typeof csvImportPayrollSchema>

// Enum types for easier reference and validation
export const EmployeeContractorStatus = {
	EMPLOYEE: 'employee' as const,
	CONTRACTOR: 'contractor' as const,
	ROSTER_ARTIST: 'roster_artist' as const,
	LLC: 'llc' as const,
} as const

export const PaymentType = {
	PERFORMANCE: 'performance' as const,
	TRAINING: 'training' as const,
	SPECIAL_EVENT: 'special_event' as const,
	OTHER: 'other' as const,
} as const

export const PaymentMethod = {
	CHECK: 'check' as const,
	ACH: 'ach' as const,
	WIRE: 'wire' as const,
	PAYROLL_SYSTEM: 'payroll_system' as const,
	OTHER: 'other' as const,
} as const

export const PaymentStatus = {
	PLANNED: 'Planned' as const,
	APPROVED: 'Approved' as const,
	PAID: 'Paid' as const,
	COMPLETED: 'Completed' as const,
	CANCELLED: 'Cancelled' as const,
} as const

export const CreationMethod = {
	MANUAL: 'manual' as const,
	EVENT_AUTOMATION: 'event-automation' as const,
} as const

export type EmployeeContractorStatusType = (typeof EmployeeContractorStatus)[keyof typeof EmployeeContractorStatus]
export type PaymentTypeType = (typeof PaymentType)[keyof typeof PaymentType]
export type PaymentMethodType = (typeof PaymentMethod)[keyof typeof PaymentMethod]
export type PaymentStatusType = (typeof PaymentStatus)[keyof typeof PaymentStatus]
export type CreationMethodType = (typeof CreationMethod)[keyof typeof CreationMethod]