<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { browser } from '$app/environment'
	import type { Snippet } from 'svelte'
	import LoadingSpinner from './LoadingSpinner.svelte'
	import Pagination from './Pagination.svelte'
	import EmptyState from './EmptyState.svelte'

	interface MasterItem {
		id: string | number
		[key: string]: any
	}

	interface Props<T extends MasterItem = MasterItem> {
		items: T[]
		selectedItem?: T | null
		loading?: boolean
		searchPlaceholder?: string
		searchValue?: string
		pagination?: {
			currentPage?: number
			page?: number
			totalPages: number
			total: number
			limit: number
		}
		// Master list configuration
		masterTitle?: string
		getItemTitle: (item: T) => string
		getItemSubtitle?: (item: T) => string
		getItemDetail?: (item: T) => string
		// Detail view configuration
		detailEmptyIcon?: string
		detailEmptyTitle?: string
		detailEmptyMessage?: string
		// Storage and persistence
		storageKey?: string
		// Responsive behavior
		responsive?: boolean
		// Mobile settings
		showMasterOnMobile?: boolean
		// Snippets
		filters?: Snippet
		children?: Snippet<[{ item: T }]>
	}

	let {
		items = [],
		selectedItem = null,
		loading = false,
		searchPlaceholder = 'Search...',
		searchValue = '',
		pagination,
		masterTitle = 'Items',
		getItemTitle,
		getItemSubtitle,
		getItemDetail,
		detailEmptyIcon = '👆',
		detailEmptyTitle = 'Select an item',
		detailEmptyMessage = 'Choose an item from the list to view details',
		storageKey,
		responsive = true,
		showMasterOnMobile = true,
		filters,
		children
	}: Props = $props()

	const dispatch = createEventDispatcher<{
		search: { value: string }
		select: { item: any }
		pageChange: { page: number }
	}>()

	let isMobile = $state(false)
	let showMasterPanel = $state(true)

	// Mobile detection
	if (typeof window !== 'undefined' && responsive) {
		const mediaQuery = window.matchMedia('(max-width: 1024px)')
		isMobile = mediaQuery.matches
		mediaQuery.addEventListener('change', (e) => {
			isMobile = e.matches
			if (!isMobile) {
				showMasterPanel = true
			} else {
				showMasterPanel = showMasterOnMobile
			}
		})
	}


	function handleSearch(value: string) {
		dispatch('search', { value })
	}

	function handleSelect(item: any) {
		// Persist selection to localStorage
		if (browser && storageKey) {
			localStorage.setItem(storageKey, String(item.id))
		}

		// On mobile, hide master panel when item is selected
		if (isMobile) {
			showMasterPanel = false
		}

		dispatch('select', { item })
	}

	function handlePageChange(page: number) {
		dispatch('pageChange', { page })
	}

	function toggleMasterPanel() {
		showMasterPanel = !showMasterPanel
	}

	function handleKeyboardNavigation(event: KeyboardEvent) {
		if (!items.length) return

		const currentIndex = selectedItem 
			? items.findIndex(item => item.id === selectedItem!.id)
			: -1

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault()
				const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0
				handleSelect(items[nextIndex])
				break
			case 'ArrowUp':
				event.preventDefault()
				const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1
				handleSelect(items[prevIndex])
				break
			case 'Escape':
				if (isMobile && !showMasterPanel) {
					showMasterPanel = true
				}
				break
		}
	}

	// Swipe gesture support for mobile
	let touchStartX = 0
	let touchStartY = 0

	function handleTouchStart(event: TouchEvent) {
		touchStartX = event.touches[0].clientX
		touchStartY = event.touches[0].clientY
	}

	function handleTouchEnd(event: TouchEvent) {
		if (!isMobile) return

		const touchEndX = event.changedTouches[0].clientX
		const touchEndY = event.changedTouches[0].clientY
		const deltaX = touchEndX - touchStartX
		const deltaY = touchEndY - touchStartY

		// Check if it's a horizontal swipe (more horizontal than vertical)
		if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
			if (deltaX > 0 && !showMasterPanel) {
				// Swipe right - show master panel
				showMasterPanel = true
			} else if (deltaX < 0 && showMasterPanel && selectedItem) {
				// Swipe left - hide master panel (only if item is selected)
				showMasterPanel = false
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeyboardNavigation} />

<div
	class="flex flex-col lg:flex-row gap-6 h-full min-h-0"
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
>
	<!-- Mobile Navigation Bar -->
	{#if isMobile}
		<div class="lg:hidden fixed top-0 left-0 right-0 z-40 bg-base-100 border-b border-base-300 p-4">
			<div class="flex items-center justify-between">
				<button 
					class="btn btn-ghost btn-sm"
					onclick={toggleMasterPanel}
					class:btn-active={showMasterPanel}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					</svg>
					{masterTitle}
					{#if pagination}
						<div class="badge badge-neutral badge-sm">{pagination.total}</div>
					{/if}
				</button>
				
				{#if selectedItem}
					<div class="text-sm font-medium truncate max-w-[200px]">
						{getItemTitle(selectedItem)}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Master List -->
	<div
		class="lg:w-1/3 lg:flex-none {isMobile ? 'fixed inset-0 z-30 bg-base-100' : 'h-full'}"
		class:hidden={isMobile && !showMasterPanel}
		class:pt-20={isMobile}
	>
		<div class="card bg-base-100 shadow-xl h-full flex flex-col min-h-0">
			<div class="card-body p-4 flex flex-col h-full min-h-0">
				<!-- Header with Search -->
				<div class="flex items-center justify-between flex-none">
					<div class="flex items-center gap-2">
						<h2 class="card-title text-lg">{masterTitle}</h2>
						{#if pagination}
							<div class="badge badge-neutral">{pagination.total}</div>
						{/if}
					</div>
					{#if isMobile && selectedItem}
						<button
							class="btn btn-ghost btn-sm lg:hidden"
							onclick={() => showMasterPanel = false}
							aria-label="Close master panel"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					{/if}
				</div>

				<!-- Search -->
				<div class="flex-none mt-4">
					<div class="flex gap-2">
						<input
							type="text"
							placeholder={searchPlaceholder}
							class="input input-bordered input-sm flex-1"
							value={searchValue}
							oninput={(e) => handleSearch((e.target as HTMLInputElement).value)}
						/>
						{#if filters}
							{@render filters()}
						{/if}
					</div>
				</div>

				<!-- Loading or Items List -->
				<div class="flex-1 mt-4 min-h-0 overflow-hidden flex flex-col">
					{#if loading}
						<div class="flex justify-center py-8">
							<LoadingSpinner size="md" />
						</div>
					{:else if items.length === 0}
						<EmptyState
							icon="📝"
							title="No items"
							message={searchValue ? 'No items match your search' : 'No items found'}
							size="sm"
							showCard={false}
						/>
					{:else}
						<div class="overflow-y-auto h-full space-y-2 pr-2">
							{#each items as item (item.id)}
								<div
									class="p-3 rounded-lg border cursor-pointer transition-all duration-200"
									class:bg-primary={selectedItem?.id === item.id}
									class:bg-opacity-10={selectedItem?.id === item.id}
									class:border-primary={selectedItem?.id === item.id}
									class:border-base-300={selectedItem?.id !== item.id}
									class:text-primary-content={selectedItem?.id === item.id}
									class:hover:bg-base-200={selectedItem?.id !== item.id}
									class:hover:bg-primary={selectedItem?.id === item.id}
									class:hover:bg-opacity-20={selectedItem?.id === item.id}
									onclick={() => handleSelect(item)}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && handleSelect(item)}
								>
									<div class="font-medium text-sm">
										{getItemTitle(item)}
									</div>
									{#if getItemSubtitle}
										<div class="text-xs mt-1" class:opacity-70={selectedItem?.id !== item.id} class:opacity-90={selectedItem?.id === item.id}>
											{getItemSubtitle(item)}
										</div>
									{/if}
									{#if getItemDetail}
										<div class="text-xs mt-1" class:opacity-50={selectedItem?.id !== item.id} class:opacity-75={selectedItem?.id === item.id}>
											{getItemDetail(item)}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Item count (optional) -->
				{#if pagination && !pagination.totalPages}
					<div class="flex-none mt-2 text-xs text-base-content/60 text-center">
						{items.length} {items.length === 1 ? 'item' : 'items'}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Detail View -->
	<div
		class="lg:flex-1 lg:min-w-0 h-full"
		class:hidden={isMobile && showMasterPanel}
		class:pt-20={isMobile && !showMasterPanel}
	>
		<div class="card bg-base-100 shadow-xl h-full flex flex-col min-h-0">
			<div class="card-body flex flex-col h-full min-h-0">
				{#if selectedItem}
					<div class="overflow-y-auto h-full min-h-0">
						{#if children}
							{@render children({ item: selectedItem })}
						{/if}
					</div>
				{:else}
					<EmptyState
						icon={detailEmptyIcon}
						title={detailEmptyTitle}
						message={detailEmptyMessage}
						showCard={false}
					/>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Mobile Swipe Indicator -->
{#if isMobile && selectedItem}
	<div class="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 lg:hidden">
		<div class="bg-base-content/10 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-base-content/70">
			Swipe to navigate
		</div>
	</div>
{/if}