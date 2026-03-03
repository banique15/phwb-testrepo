import { createBaseStore } from './base'
import {
	notificationSchema,
	type Notification,
	type CreateNotification,
	type UpdateNotification
} from '$lib/schemas/notification'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'

const baseStore = createBaseStore<Notification, CreateNotification, UpdateNotification>({
	tableName: 'phwb_notifications',
	schema: notificationSchema,
	searchFields: ['title', 'message'],
	defaultSortBy: 'created_at',
	defaultSortOrder: 'desc'
})

export const notificationsStore = {
	...baseStore,

	async getForCurrentUser(limit = 20) {
		try {
			const {
				data: { user },
				error: authError
			} = await supabase.auth.getUser()

			if (authError) throw authError
			if (!user) {
				return []
			}

			const { data, error } = await supabase
				.from('phwb_notifications')
				.select('*')
				.eq('user_id', user.id)
				.order('created_at', { ascending: false })
				.limit(limit)

			if (error) throw error
			return data || []
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to fetch notifications')
			throw error
		}
	},

	async markAsRead(notificationId: number) {
		try {
			const { data, error } = await supabase
				.from('phwb_notifications')
				.update({
					is_read: true,
					read_at: new Date().toISOString()
				})
				.eq('id', notificationId)
				.select()
				.single()

			if (error) throw error
			return data
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to mark notification as read')
			throw error
		}
	},

	async markAllAsReadForCurrentUser() {
		try {
			const {
				data: { user },
				error: authError
			} = await supabase.auth.getUser()

			if (authError) throw authError
			if (!user) return

			const { error } = await supabase
				.from('phwb_notifications')
				.update({
					is_read: true,
					read_at: new Date().toISOString()
				})
				.eq('user_id', user.id)
				.eq('is_read', false)

			if (error) throw error
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to mark notifications as read')
			throw error
		}
	}
}

// Export the base store functionality
export const {
	subscribe,
	fetchPaginated,
	fetchAll,
	create: createNotification,
	update: updateNotification,
	delete: deleteNotification,
	getById: getNotificationById,
	subscribeToChanges: subscribeToNotificationChanges,
	unsubscribeFromChanges: unsubscribeFromNotificationChanges,
	clearError: clearNotificationError,
	reset: resetNotificationsStore
} = notificationsStore

