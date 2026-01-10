import { createBaseStore } from './base'
import { bugCommentSchema, type BugComment, type CreateBugComment, type UpdateBugComment } from '$lib/schemas/bug-comment'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'

const baseStore = createBaseStore<BugComment, CreateBugComment, UpdateBugComment>({
	tableName: 'phwb_bug_comments',
	schema: bugCommentSchema,
	searchFields: ['content'],
	defaultSortBy: 'created_at',
	defaultSortOrder: 'asc'
})

export const bugCommentsStore = {
	...baseStore,

	async getCommentsForBug(bugId: number) {
		try {
			const { data, error } = await supabase
				.from('phwb_bug_comments')
				.select('*, profiles:user_id(full_name, avatar_url)')
				.eq('bug_id', bugId)
				.order('created_at', { ascending: true })

			if (error) throw error
			return data || []
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to fetch comments')
			throw error
		}
	},

	async updateComment(commentId: number, updates: UpdateBugComment) {
		try {
			const updateData = {
				...updates,
				edited_at: new Date().toISOString()
			}

			const { data, error } = await supabase
				.from('phwb_bug_comments')
				.update(updateData)
				.eq('id', commentId)
				.select()
				.single()

			if (error) throw error

			return data
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to update comment')
			throw error
		}
	}
}

// Export the base store functionality
export const {
	subscribe,
	fetchPaginated,
	fetchAll,
	create: createBugComment,
	delete: deleteBugComment,
	getById: getBugCommentById,
	subscribeToChanges: subscribeToBugCommentChanges,
	unsubscribeFromChanges: unsubscribeFromBugCommentChanges,
	clearError: clearBugCommentError,
	reset: resetBugCommentsStore
} = bugCommentsStore
