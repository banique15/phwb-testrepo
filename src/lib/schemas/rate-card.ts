import { z } from 'zod'

// Rate card schema
export const rateCardSchema = z.object({
	id: z.number(),
	name: z.string(),
	effective_date: z.string(),
	expires_date: z.string().nullable().optional(),
	is_active: z.boolean().default(true),
	notes: z.string().nullable().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional()
})

export type RateCard = z.infer<typeof rateCardSchema>

// Program types enum
export const ProgramType = {
	HEALING_ARTS: 'healing_arts',
	TRANSIT_HUB: 'transit_hub',
	VIRTUAL_ARTIST: 'virtual_artist',
	VIRTUAL_TEACHING: 'virtual_teaching',
	TEACHING_IN_PERSON: 'teaching_in_person',
	NEWARK_AIRPORT: 'newark_airport',
	DONOR_EVENT: 'donor_event',
	HOLIDAY_SOLOIST: 'holiday_soloist',
	HOLIDAY_GROUP: 'holiday_group',
	HOLIDAY_SPECIAL: 'holiday_special',
	PM: 'pm',
	TRAINING: 'training',
	OTHER: 'other'
} as const

export type ProgramTypeValue = (typeof ProgramType)[keyof typeof ProgramType]

// Rate type enum
export const RateType = {
	HOURLY: 'hourly',
	TIERED: 'tiered',
	FLAT: 'flat'
} as const

export type RateTypeValue = (typeof RateType)[keyof typeof RateType]

// Rate rule schema
export const rateRuleSchema = z.object({
	id: z.number(),
	rate_card_id: z.number(),
	program_type: z.string(),
	rate_type: z.enum(['hourly', 'tiered', 'flat']),
	hourly_rate: z.number().nullable().optional(),
	first_hour_rate: z.number().nullable().optional(),
	subsequent_hour_rate: z.number().nullable().optional(),
	flat_rate: z.number().nullable().optional(),
	min_hours: z.number().nullable().optional(),
	max_hours: z.number().nullable().optional(),
	includes_travel: z.boolean().default(false),
	description: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional()
})

export type RateRule = z.infer<typeof rateRuleSchema>

// Additional fee types
export const FeeType = {
	BANDLEADER: 'bandleader',
	BANK_DEPOSIT: 'bank_deposit',
	TRAVEL: 'travel',
	HARASSMENT_TRAINING: 'harassment_training',
	SETUP_TIME: 'setup_time',
	OVERTIME: 'overtime'
} as const

export type FeeTypeValue = (typeof FeeType)[keyof typeof FeeType]

// Additional fee schema
export const additionalFeeSchema = z.object({
	id: z.number(),
	rate_card_id: z.number(),
	fee_type: z.string(),
	amount: z.number(),
	min_musicians: z.number().nullable().optional(),
	applies_to: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional()
})

export type AdditionalFee = z.infer<typeof additionalFeeSchema>

// Payroll generation log schema
export const payrollGenerationLogSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	week_start: z.string(),
	week_end: z.string(),
	events_processed: z.number().default(0),
	entries_created: z.number().default(0),
	total_amount: z.number().default(0),
	skipped_events: z.number().default(0),
	errors: z.any().nullable().optional(),
	generated_by: z.string().uuid().nullable().optional(),
	generation_method: z.enum(['manual', 'automated']).optional(),
	notes: z.string().nullable().optional()
})

export type PayrollGenerationLog = z.infer<typeof payrollGenerationLogSchema>

// Helper type for rate calculation result
export interface RateCalculationResult {
	basePay: number
	additionalPay: number
	additionalPayReason: string | null
	totalPay: number
	calculationNotes: string
	rateRuleId: number
	rateCardId: number
}

// Helper type for generated payroll entry (before saving)
export interface GeneratedPayrollEntry {
	event_id: number
	event_date: string
	artist_id: string | null
	artist_name: string
	venue_id: number | null
	facility_id?: number | null
	program_id: number | null
	hours: number
	rate: number
	rate_type?: RateTypeValue | null
	base_rate?: number | null
	additional_rate?: number | null
	rate_description?: string | null
	additional_pay: number
	additional_pay_reason: string | null
	total_pay: number
	number_of_musicians: number
	gig_duration: number | null
	employee_contractor_status: string
	rate_card_id: number
	rate_rule_id: number
	status: string
	payment_type: string
	creation_method: string
	source_event_id: number
	notes: string
}

// Generation result type
export interface PayrollGenerationResult {
	success: boolean
	eventsProcessed: number
	entriesCreated: number
	totalAmount: number
	skippedEvents: number
	entries: GeneratedPayrollEntry[]
	errors: string[]
	weekStart: string
	weekEnd: string
}
