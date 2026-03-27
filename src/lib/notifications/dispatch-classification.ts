import { notificationTypeValues } from '$lib/schemas/notification-template'

export type NotificationType = (typeof notificationTypeValues)[number]

const reminderNotificationTypes = new Set<NotificationType>([
  'artist_invitation_reminder',
  'artist_contract_signature_reminder',
  'artist_pre_event_reminder_48h',
  'artist_pre_event_reminder_24h',
  'artist_event_starting_reminder'
])

export function isReminderNotificationType(type: string): type is NotificationType {
  return reminderNotificationTypes.has(type as NotificationType)
}

export function isTransactionalNotificationType(type: string): type is NotificationType {
  return notificationTypeValues.includes(type as NotificationType) && !isReminderNotificationType(type)
}

export function getNotificationDispatchCategory(type: string): 'reminder' | 'transactional' | 'unknown' {
  if (isReminderNotificationType(type)) return 'reminder'
  if (isTransactionalNotificationType(type)) return 'transactional'
  return 'unknown'
}

