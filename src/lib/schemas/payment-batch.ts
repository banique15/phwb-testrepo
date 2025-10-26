import { z } from 'zod'

export const paymentBatchSchema = z.object({
	id: z.string().optional(),
	created_at: z.string().optional(),
	batch_name: z.string().min(1, 'Batch name is required').max(200, 'Batch name must be less than 200 characters'),
	created_by: z.string().uuid('Invalid user ID'),
	status: z.enum(['draft', 'submitted', 'processing', 'completed', 'failed']),
	total_amount: z.number().min(0, 'Total amount must be non-negative'),
	payment_count: z.number().min(0, 'Payment count must be non-negative'),
	payment_method: z.enum(['check', 'ach', 'wire', 'payroll_system', 'other']),
	description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
	processed_at: z.string().optional(),
	external_reference: z.string().max(200, 'External reference must be less than 200 characters').optional(),
	notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
})

export const createPaymentBatchSchema = paymentBatchSchema.omit({
	id: true,
	created_at: true,
})

export type PaymentBatch = z.infer<typeof paymentBatchSchema>
export type CreatePaymentBatch = z.infer<typeof createPaymentBatchSchema>

export const BatchStatus = {
	DRAFT: 'draft' as const,
	SUBMITTED: 'submitted' as const,
	PROCESSING: 'processing' as const,
	COMPLETED: 'completed' as const,
	FAILED: 'failed' as const,
} as const

export type BatchStatusType = (typeof BatchStatus)[keyof typeof BatchStatus]