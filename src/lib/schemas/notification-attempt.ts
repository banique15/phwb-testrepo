import { z } from 'zod'

export const notificationAttemptStatusValues = ['queued', 'sent', 'failed', 'callback_received'] as const

export const notificationAttemptSchema = z.object({
  id: z.coerce.number().int().optional(),
  created_at: z.string().optional(),
  run_id: z.string().uuid('Invalid run id'),
  attempt_no: z.number().int().min(1),
  provider: z.string().default('resend'),
  status: z.enum(notificationAttemptStatusValues).default('queued'),
  provider_message_id: z.string().optional().nullable(),
  request_payload: z.record(z.unknown()).default({}),
  response_payload: z.record(z.unknown()).default({}),
  error_message: z.string().optional().nullable()
})

export type NotificationAttempt = z.infer<typeof notificationAttemptSchema>
