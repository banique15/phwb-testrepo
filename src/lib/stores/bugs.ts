import { createBaseStore } from './base'
import { bugSchema, type Bug, type CreateBug, type UpdateBug } from '$lib/schemas/bug'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'
import { logger } from '$lib/utils/logger'

const baseStore = createBaseStore<Bug, CreateBug, UpdateBug>({
	tableName: 'phwb_bugs',
	schema: bugSchema,
	searchFields: ['title', 'description'],
	defaultSortBy: 'created_at',
	defaultSortOrder: 'desc'
})

export const bugsStore = {
	...baseStore,

	async changeStatus(bugId: number, newStatus: Bug['status'], userId?: string) {
		try {
			const updateData: UpdateBug = { status: newStatus }
			
			// Set resolved/closed timestamps if applicable
			if (newStatus === 'resolved') {
				updateData.resolved_at = new Date().toISOString()
				if (userId) updateData.resolved_by = userId
			} else if (newStatus === 'closed') {
				updateData.closed_at = new Date().toISOString()
				if (userId) updateData.closed_by = userId
			}

			const result = await baseStore.update(bugId, updateData)
			return result
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to change bug status')
			throw error
		}
	},

	async assignBug(bugId: number, userId: string | null) {
		try {
			const result = await baseStore.update(bugId, { assigned_to: userId })
			return result
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to assign bug')
			throw error
		}
	},

	async getBugWithRelations(bugId: number) {
		try {
			// Fetch bug with related data
			const { data: bug, error: bugError } = await supabase
				.from('phwb_bugs')
				.select('*')
				.eq('id', bugId)
				.single()

			if (bugError) throw bugError

			// Fetch comments
			const { data: comments } = await supabase
				.from('phwb_bug_comments')
				.select('*, user_id, profiles:user_id(full_name, avatar_url)')
				.eq('bug_id', bugId)
				.order('created_at', { ascending: true })

			// Fetch attachments
			const { data: attachments } = await supabase
				.from('phwb_bug_attachments')
				.select('*')
				.eq('bug_id', bugId)
				.order('created_at', { ascending: false })

			// Fetch labels
			const { data: labelAssignments } = await supabase
				.from('phwb_bug_label_assignments')
				.select('label_id, phwb_bug_labels(*)')
				.eq('bug_id', bugId)

			// Fetch relations
			const { data: relations } = await supabase
				.from('phwb_bug_relations')
				.select('*, related_bug:related_bug_id(id, title, status)')
				.eq('bug_id', bugId)

			// Fetch activity
			const { data: activity } = await supabase
				.from('phwb_bug_activity')
				.select('*, user_id, profiles:user_id(full_name, avatar_url)')
				.eq('bug_id', bugId)
				.order('created_at', { ascending: false })

			// Fetch time tracking
			const { data: timeTracking } = await supabase
				.from('phwb_bug_time_tracking')
				.select('*, user_id, profiles:user_id(full_name)')
				.eq('bug_id', bugId)
				.order('date', { ascending: false })

			return {
				bug,
				comments: comments || [],
				attachments: attachments || [],
				labels: (labelAssignments || []).map((la: any) => la.phwb_bug_labels).filter(Boolean),
				relations: relations || [],
				activity: activity || [],
				timeTracking: timeTracking || []
			}
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to fetch bug with relations')
			throw error
		}
	},

	async getBugsByAssignee(userId: string) {
		try {
			const { data, error } = await supabase
				.from('phwb_bugs')
				.select('*')
				.eq('assigned_to', userId)
				.order('created_at', { ascending: false })

			if (error) throw error
			return data || []
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to fetch bugs by assignee')
			throw error
		}
	},

	async getBugsByReporter(userId: string) {
		try {
			const { data, error } = await supabase
				.from('phwb_bugs')
				.select('*')
				.eq('reported_by', userId)
				.order('created_at', { ascending: false })

			if (error) throw error
			return data || []
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to fetch bugs by reporter')
			throw error
		}
	},

	async getBugsByStatus(status: Bug['status']) {
		try {
			const { data, error } = await supabase
				.from('phwb_bugs')
				.select('*')
				.eq('status', status)
				.order('created_at', { ascending: false })

			if (error) throw error
			return data || []
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to fetch bugs by status')
			throw error
		}
	}
}

// Export the base store functionality
export const {
	subscribe,
	fetchPaginated,
	fetchAll,
	create: createBug,
	update: updateBug,
	delete: deleteBug,
	getById: getBugById,
	subscribeToChanges: subscribeToBugChanges,
	unsubscribeFromChanges: unsubscribeFromBugChanges,
	clearError: clearBugError,
	reset: resetBugsStore
} = bugsStore
