import { createBaseStore } from './base'
import { bugLabelSchema, type BugLabel, type CreateBugLabel, type UpdateBugLabel } from '$lib/schemas/bug-label'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'

const baseStore = createBaseStore<BugLabel, CreateBugLabel, UpdateBugLabel>({
	tableName: 'phwb_bug_labels',
	schema: bugLabelSchema,
	searchFields: ['name', 'description'],
	defaultSortBy: 'name',
	defaultSortOrder: 'asc'
})

export const bugLabelsStore = {
	...baseStore,

	async assignLabelToBug(bugId: number, labelId: number) {
		try {
			const { data, error } = await supabase
				.from('phwb_bug_label_assignments')
				.insert({
					bug_id: bugId,
					label_id: labelId
				})
				.select()
				.single()

			if (error) {
				// If it's a unique constraint violation, that's okay - label already assigned
				if (error.code === '23505') {
					return { bug_id: bugId, label_id: labelId }
				}
				throw error
			}

			return data
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to assign label to bug')
			throw error
		}
	},

	async removeLabelFromBug(bugId: number, labelId: number) {
		try {
			const { error } = await supabase
				.from('phwb_bug_label_assignments')
				.delete()
				.eq('bug_id', bugId)
				.eq('label_id', labelId)

			if (error) throw error
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to remove label from bug')
			throw error
		}
	},

	async getLabelsForBug(bugId: number) {
		try {
			const { data, error } = await supabase
				.from('phwb_bug_label_assignments')
				.select('label_id, phwb_bug_labels(*)')
				.eq('bug_id', bugId)

			if (error) throw error
			return (data || []).map((item: any) => item.phwb_bug_labels).filter(Boolean)
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to fetch labels for bug')
			throw error
		}
	},

	async getBugsForLabel(labelId: number) {
		try {
			const { data, error } = await supabase
				.from('phwb_bug_label_assignments')
				.select('bug_id, phwb_bugs(*)')
				.eq('label_id', labelId)

			if (error) throw error
			return (data || []).map((item: any) => item.phwb_bugs).filter(Boolean)
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to fetch bugs for label')
			throw error
		}
	}
}

// Export the base store functionality
export const {
	subscribe,
	fetchPaginated,
	fetchAll,
	create: createBugLabel,
	update: updateBugLabel,
	delete: deleteBugLabel,
	getById: getBugLabelById,
	subscribeToChanges: subscribeToBugLabelChanges,
	unsubscribeFromChanges: unsubscribeFromBugLabelChanges,
	clearError: clearBugLabelError,
	reset: resetBugLabelsStore
} = bugLabelsStore
