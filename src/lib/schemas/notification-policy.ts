import { z } from 'zod'
import { notificationTypeValues } from './notification-template'

export const dunningRuleSchema = z.object({
  offset_minutes: z.number().int(),
  reason: z.string().optional()
})

export const notificationPolicySchema = z.object({
  id: z.string().uuid().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  template_id: z.string().uuid('Invalid template id'),
  notification_type: z.enum(notificationTypeValues),
  enabled: z.boolean().default(true),
  trigger_event: z.string().min(1, 'Trigger event is required'),
  initial_delay_minutes: z.number().int().default(0),
  dunning_rules: z.array(dunningRuleSchema).default([]),
  max_attempts: z.number().int().min(1).default(3),
  stop_conditions: z.array(z.string()).default(['accepted', 'declined', 'manual_resolved']),
  quiet_hours: z.record(z.unknown()).default({}),
  updated_by: z.string().optional().nullable()
})

export const createNotificationPolicySchema = notificationPolicySchema.omit({
  id: true,
  created_at: true,
  updated_at: true
})

export const updateNotificationPolicySchema = notificationPolicySchema.partial()

export type DunningRule = z.infer<typeof dunningRuleSchema>
export type NotificationPolicy = z.infer<typeof notificationPolicySchema>
export type CreateNotificationPolicy = z.infer<typeof createNotificationPolicySchema>
export type UpdateNotificationPolicy = z.infer<typeof updateNotificationPolicySchema>
