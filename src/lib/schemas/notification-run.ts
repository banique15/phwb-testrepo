import { z } from 'zod'
import { notificationTypeValues } from './notification-template'

export const notificationRunStatusValues = [
  'pending',
  'scheduled',
  'sending',
  'sent',
  'failed',
  'cancelled',
  'suppressed'
] as const

export const notificationRunSchema = z.object({
  id: z.string().uuid().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  template_id: z.string().uuid('Invalid template id'),
  policy_id: z.string().uuid().optional().nullable(),
  notification_type: z.enum(notificationTypeValues),
  artist_id: z.string().uuid().optional().nullable(),
  event_id: z.coerce.number().int().optional().nullable(),
  recipient_email: z.string().email('Invalid recipient email'),
  recipient_name: z.string().optional().nullable(),
  status: z.enum(notificationRunStatusValues).default('pending'),
  scheduled_for: z.string().optional().nullable(),
  sent_at: z.string().optional().nullable(),
  next_attempt_at: z.string().optional().nullable(),
  attempt_count: z.number().int().default(0),
  max_attempts: z.number().int().default(3),
  dedupe_key: z.string().optional().nullable(),
  external_workflow_id: z.string().optional().nullable(),
  rendered_subject: z.string().optional().nullable(),
  rendered_body: z.string().optional().nullable(),
  payload: z.record(z.unknown()).default({}),
  last_error: z.string().optional().nullable(),
  manual_override_reason: z.string().optional().nullable()
})

export type NotificationRun = z.infer<typeof notificationRunSchema>
