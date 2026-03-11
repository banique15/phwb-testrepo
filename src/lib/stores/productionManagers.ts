import { createBaseStore } from './base'
import {
	productionManagerSchema,
	type ProductionManager,
	type CreateProductionManager,
	type UpdateProductionManager
} from '$lib/schemas/productionManager'

export const productionManagersStore = createBaseStore<
	ProductionManager,
	CreateProductionManager,
	UpdateProductionManager
>({
	tableName: 'phwb_production_managers',
	schema: productionManagerSchema,
	searchFields: ['full_name', 'legal_first_name', 'legal_last_name', 'email', 'phone'],
	defaultSortBy: 'created_at',
	defaultSortOrder: 'desc'
})

export const {
	subscribe,
	fetchPaginated,
	fetchAll,
	create: createProductionManager,
	update: updateProductionManager,
	delete: deleteProductionManager,
	getById: getProductionManagerById,
	subscribeToChanges: subscribeToProductionManagerChanges,
	unsubscribeFromChanges: unsubscribeFromProductionManagerChanges,
	clearError: clearProductionManagerError,
	reset: resetProductionManagersStore
} = productionManagersStore

