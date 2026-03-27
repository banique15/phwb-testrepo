import { z } from 'zod'

export const notificationTypeValues = [
  'artist_added_to_system',
  'artist_added_to_event_invited',
  'artist_invitation_reminder',
  'artist_booking_confirmation',
  'artist_contract_signature_request',
  'artist_contract_signature_reminder',
  'artist_briefing_packet',
  'artist_pre_event_reminder_48h',
  'artist_pre_event_reminder_24h',
  'artist_accepted_invitation',
  'artist_declined_invitation',
  'booking_request_received_admin',
  'booking_confirmed_admin',
  'partner_requested_artist_not_found_admin',
  'artist_event_starting_reminder',
  'artist_thank_you_after_completed',
  'artist_feedback_request',
  'artist_payout_processed'
] as const

export const notificationTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  notification_type: z.enum(notificationTypeValues),
  name: z.string().min(1, 'Template name is required'),
  subject_template: z.string().min(1, 'Subject is required'),
  body_template: z.string().min(1, 'Body is required'),
  available_fields: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
  brand_config: z.record(z.unknown()).default({}),
  version: z.number().int().default(1),
  created_by: z.string().optional().nullable(),
  updated_by: z.string().optional().nullable()
})

export const createNotificationTemplateSchema = notificationTemplateSchema.omit({
  id: true,
  created_at: true,
  updated_at: true
})

export const updateNotificationTemplateSchema = notificationTemplateSchema.partial()

export type NotificationTemplate = z.infer<typeof notificationTemplateSchema>
export type CreateNotificationTemplate = z.infer<typeof createNotificationTemplateSchema>
export type UpdateNotificationTemplate = z.infer<typeof updateNotificationTemplateSchema>
