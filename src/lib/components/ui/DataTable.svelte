<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import LoadingSpinner from './LoadingSpinner.svelte'
	import SearchInput from './SearchInput.svelte'
	import Pagination from './Pagination.svelte'
	import EmptyState from './EmptyState.svelte'

	interface Column<T = any> {
		key: string
		label: string
		sortable?: boolean
		width?: string
		render?: (item: T) => string
		component?: typeof SvelteComponent
		componentProps?: (item: T) => Record<string, any>
	}

	interface Props<T = any> {
		items: T[]
		columns: Column<T>[]
		loading?: boolean
		searchPlaceholder?: string
		searchValue?: string
		showSearch?: boolean
		pagination?: {
			currentPage: number
			totalPages: number
			total: number
			limit: number
		}
		emptyStateIcon?: string
		emptyStateTitle?: string
		emptyStateMessage?: string
		selectedItem?: T | null
		selectable?: boolean
		keyField?: string
		responsive?: boolean
	}

	let {
		items = [],
		columns = [],
		loading = false,
		searchPlaceholder = 'Search...',
		searchValue = '',
		showSearch = true,
		pagination,
		emptyStateIcon = '📄',
		emptyStateTitle = 'No data',
		emptyStateMessage = 'No items to display',
		selectedItem = null,
		selectable = false,
		keyField = 'id',
		responsive = true
	}: Props = $props()

	const dispatch = createEventDispatcher<{
		search: { value: string }
		sort: { key: string; order: 'asc' | 'desc' }
		select: { item: any }
		pageChange: { page: number }
	}>()

	let sortBy = $state<string>('')
	let sortOrder = $state<'asc' | 'desc'>('asc')
	let currentSearchValue = $state(searchValue)

	function handleSort(column: Column) {
		if (!column.sortable) return
		
		if (sortBy === column.key) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'
		} else {
			sortBy = column.key
			sortOrder = 'asc'
		}
		
		dispatch('sort', { key: column.key, order: sortOrder })
	}

	function handleSearch(value: string) {
		currentSearchValue = value
		dispatch('search', { value })
	}

	function handleSelect(item: any) {
		if (!selectable) return
		dispatch('select', { item })
	}

	function handlePageChange(page: number) {
		dispatch('pageChange', { page })
	}

	function getCellValue(item: any, column: Column) {
		if (column.render) {
			return column.render(item)
		}
		return item[column.key] || ''
	}

	function isSelected(item: any) {
		if (!selectedItem || !selectable) return false
		return item[keyField] === selectedItem[keyField]
	}

	// Reactive visibility for mobile
	let isMobile = $state(false)
	
	if (typeof window !== 'undefined') {
		const mediaQuery = window.matchMedia('(max-width: 768px)')
		isMobile = mediaQuery.matches
		mediaQuery.addEventListener('change', (e) => {
			isMobile = e.matches
		})
	}
</script>

<div class="space-y-4">
	<!-- Search Bar -->
	{#if showSearch}
		<div class="flex justify-between items-center">
			<SearchInput
				placeholder={searchPlaceholder}
				value={currentSearchValue}
				onSearch={handleSearch}
			/>
			<slot name="actions" />
		</div>
	{/if}

	<!-- Loading State -->
	{#if loading}
		<div class="flex justify-center py-8">
			<LoadingSpinner size="lg" />
		</div>
	{:else if items.length === 0}
		<!-- Empty State -->
		<EmptyState
			icon={emptyStateIcon}
			title={emptyStateTitle}
			message={emptyStateMessage}
		/>
	{:else}
		<!-- Desktop Table -->
		{#if !responsive || !isMobile}
			<div class="overflow-x-auto">
				<table class="table table-zebra w-full">
					<thead>
						<tr>
							{#each columns as column}
								<th 
									class="cursor-pointer hover:bg-base-200 {column.width ? `w-${column.width}` : ''}"
									class:sortable={column.sortable}
									onclick={() => handleSort(column)}
								>
									<div class="flex items-center gap-2">
										{column.label}
										{#if column.sortable}
											<div class="flex flex-col">
												<svg 
													class="w-3 h-3 {sortBy === column.key && sortOrder === 'asc' ? 'text-primary' : 'text-base-content/30'}"
													fill="currentColor" 
													viewBox="0 0 20 20"
												>
													<path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
												</svg>
												<svg 
													class="w-3 h-3 -mt-1 {sortBy === column.key && sortOrder === 'desc' ? 'text-primary' : 'text-base-content/30'}"
													fill="currentColor" 
													viewBox="0 0 20 20"
												>
													<path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
												</svg>
											</div>
										{/if}
									</div>
								</th>
							{/each}
							{#if $$slots.actions}
								<th class="w-20">Actions</th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each items as item}
							<tr 
								class="hover:bg-base-200 cursor-pointer"
								class:bg-primary={isSelected(item)}
								class:bg-opacity-10={isSelected(item)}
								onclick={() => handleSelect(item)}
							>
								{#each columns as column}
									<td>
										{#if column.component}
											<svelte:component 
												this={column.component} 
												{...column.componentProps?.(item) || {}}
											/>
										{:else}
											{getCellValue(item, column)}
										{/if}
									</td>
								{/each}
								{#if $$slots.actions}
									<td>
										<slot name="actions" {item} />
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<!-- Mobile Card View -->
			<div class="space-y-3">
				{#each items as item}
					<div
						class="card bg-base-100 shadow-sm border cursor-pointer transition-all"
						class:ring-2={isSelected(item)}
						class:ring-primary={isSelected(item)}
						onclick={() => handleSelect(item)}
					>
						<div class="card-body p-4">
							<div class="grid grid-cols-1 gap-2">
								{#each columns.slice(0, 3) as column}
									<div class="flex justify-between items-start">
										<span class="text-sm font-medium text-base-content/70">{column.label}:</span>
										<span class="text-sm text-right">
											{#if column.component}
												<svelte:component 
													this={column.component} 
													{...column.componentProps?.(item) || {}}
												/>
											{:else}
												{getCellValue(item, column)}
											{/if}
										</span>
									</div>
								{/each}
								{#if $$slots.actions}
									<div class="flex justify-end pt-2 border-t">
										<slot name="actions" {item} />
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Pagination -->
		{#if pagination}
			<div class="flex justify-center">
				<Pagination
					currentPage={pagination.currentPage}
					totalPages={pagination.totalPages}
					totalItems={pagination.total}
					itemsPerPage={pagination.limit}
					onPageChange={handlePageChange}
				/>
			</div>
		{/if}
	{/if}
</div>

<style>
	.sortable {
		user-select: none;
	}
</style>