import { createBaseStore } from './base'
import {
  notificationTemplateSchema,
  type NotificationTemplate,
  type CreateNotificationTemplate,
  type UpdateNotificationTemplate
} from '$lib/schemas/notification-template'

const baseStore = createBaseStore<NotificationTemplate, CreateNotificationTemplate, UpdateNotificationTemplate>({
  tableName: 'phwb_notification_templates',
  schema: notificationTemplateSchema,
  searchFields: ['name', 'notification_type', 'subject_template'],
  defaultSortBy: 'notification_type',
  defaultSortOrder: 'asc'
})

export const notificationTemplatesStore = {
  ...baseStore
}

export const {
  subscribe,
  fetchPaginated,
  fetchAll,
  create: createNotificationTemplate,
  update: updateNotificationTemplate,
  delete: deleteNotificationTemplate,
  getById: getNotificationTemplateById,
  subscribeToChanges: subscribeToNotificationTemplateChanges,
  unsubscribeFromChanges: unsubscribeFromNotificationTemplateChanges,
  clearError: clearNotificationTemplateError,
  reset: resetNotificationTemplatesStore
} = notificationTemplatesStore
