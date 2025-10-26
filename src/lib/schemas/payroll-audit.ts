import { z } from 'zod'

export const payrollAuditSchema = z.object({
	id: z.number().optional(),
	created_at: z.string().optional(),
	payroll_id: z.number(),
	user_id: z.string().uuid('Invalid user ID'),
	action: z.enum(['create', 'update', 'delete', 'approve', 'reject', 'process', 'reconcile', 'export']),
	previous_values: z.record(z.any()).optional(),
	new_values: z.record(z.any()).optional(),
	notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
	ip_address: z.string().max(45, 'IP address must be less than 45 characters').optional(),
	user_agent: z.string().max(500, 'User agent must be less than 500 characters').optional(),
})

export const createPayrollAuditSchema = payrollAuditSchema.omit({
	id: true,
	created_at: true,
})

export type PayrollAudit = z.infer<typeof payrollAuditSchema>
export type CreatePayrollAudit = z.infer<typeof createPayrollAuditSchema>

export const AuditAction = {
	CREATE: 'create' as const,
	UPDATE: 'update' as const,
	DELETE: 'delete' as const,
	APPROVE: 'approve' as const,
	REJECT: 'reject' as const,
	PROCESS: 'process' as const,
	RECONCILE: 'reconcile' as const,
	EXPORT: 'export' as const,
} as const

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction]