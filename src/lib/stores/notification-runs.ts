import { createBaseStore } from './base'
import { notificationRunSchema, type NotificationRun } from '$lib/schemas/notification-run'

const baseStore = createBaseStore<NotificationRun, Partial<NotificationRun>, Partial<NotificationRun>>({
  tableName: 'phwb_notification_runs',
  schema: notificationRunSchema,
  searchFields: ['notification_type', 'recipient_email', 'recipient_name', 'status'],
  defaultSortBy: 'created_at',
  defaultSortOrder: 'desc'
})

export const notificationRunsStore = {
  ...baseStore
}

export const {
  subscribe,
  fetchPaginated,
  fetchAll,
  create: createNotificationRun,
  update: updateNotificationRun,
  delete: deleteNotificationRun,
  getById: getNotificationRunById,
  subscribeToChanges: subscribeToNotificationRunChanges,
  unsubscribeFromChanges: unsubscribeFromNotificationRunChanges,
  clearError: clearNotificationRunError,
  reset: resetNotificationRunsStore
} = notificationRunsStore
