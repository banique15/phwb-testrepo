import { createBaseStore } from './base'
import { ensembleSchema, type Ensemble, type CreateEnsemble, type UpdateEnsemble } from '$lib/schemas/ensemble'

export const ensemblesStore = createBaseStore<Ensemble, CreateEnsemble, UpdateEnsemble>({
	tableName: 'phwb_ensembles',
	schema: ensembleSchema,
	searchFields: ['name', 'description', 'ensemble_type'],
	defaultSortBy: 'created_at',
	defaultSortOrder: 'desc'
})

// Export the base store functionality
export const {
	subscribe,
	fetchPaginated,
	fetchAll,
	create: createEnsemble,
	update: updateEnsemble,
	delete: deleteEnsemble,
	getById: getEnsembleById,
	subscribeToChanges: subscribeToEnsembleChanges,
	unsubscribeFromChanges: unsubscribeFromEnsembleChanges,
	clearError: clearEnsembleError,
	reset: resetEnsemblesStore
} = ensemblesStore
