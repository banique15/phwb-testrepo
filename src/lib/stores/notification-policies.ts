import { createBaseStore } from './base'
import {
  notificationPolicySchema,
  type NotificationPolicy,
  type CreateNotificationPolicy,
  type UpdateNotificationPolicy
} from '$lib/schemas/notification-policy'

const baseStore = createBaseStore<NotificationPolicy, CreateNotificationPolicy, UpdateNotificationPolicy>({
  tableName: 'phwb_notification_policies',
  schema: notificationPolicySchema,
  searchFields: ['notification_type', 'trigger_event'],
  defaultSortBy: 'notification_type',
  defaultSortOrder: 'asc'
})

export const notificationPoliciesStore = {
  ...baseStore
}

export const {
  subscribe,
  fetchPaginated,
  fetchAll,
  create: createNotificationPolicy,
  update: updateNotificationPolicy,
  delete: deleteNotificationPolicy,
  getById: getNotificationPolicyById,
  subscribeToChanges: subscribeToNotificationPolicyChanges,
  unsubscribeFromChanges: unsubscribeFromNotificationPolicyChanges,
  clearError: clearNotificationPolicyError,
  reset: resetNotificationPoliciesStore
} = notificationPoliciesStore
