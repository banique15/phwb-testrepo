<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { programsStore } from '$lib/stores/programs'
	import type { Program } from '$lib/schemas/program'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import PageHeader from '$lib/components/ui/PageHeader.svelte'
	import MasterDetail from '$lib/components/ui/MasterDetail.svelte'
	import CreateProgram from './components/modals/CreateProgram.svelte'
	import EditProgram from './components/modals/EditProgram.svelte'
	import DeleteProgram from './components/modals/DeleteProgram.svelte'

	interface Props {
		data: {
			programs: Program[]
			pagination: {
				total: number
				page: number
				limit: number
				totalPages: number
			}
			filters: {
				search?: string
				sortBy: string
				sortOrder: 'asc' | 'desc'
				page?: number
			}
			performance: {
				totalTime: number
				queryTime: number
				itemCount: number
			}
			error?: string
		}
	}

	let { data }: Props = $props()

	let selectedProgram = $state<Program | null>(null)
	let isCreateModalOpen = $state(false)
	let isEditModalOpen = $state(false)
	let isDeleteModalOpen = $state(false)
	let clientLoading = $state(false)

	// Filter state
	let hideEndedPrograms = $state(false)

	// Use derived state to avoid infinite loops
	let programs = $derived(data.programs)
	let pagination = $derived(data.pagination)
	let currentFilters = $derived(data.filters)
	let performanceMetrics = $derived(data.performance)

	// Filter programs client-side
	let filteredPrograms = $derived.by(() => {
		if (!hideEndedPrograms) return programs

		const now = new Date()
		return programs.filter(program => {
			if (!program.end_date) return true // Keep programs without end date
			const endDate = new Date(program.end_date)
			return endDate >= now // Only show if not ended
		})
	})

	onMount(() => {
		// Restore selected program from localStorage on initial client-side mount
		const storageKey = 'phwb-selected-program'
		const savedId = localStorage.getItem(storageKey)
		if (savedId && data.programs.length > 0) {
			const savedProgram = data.programs.find(program => String(program.id) === savedId)
			if (savedProgram) {
				selectedProgram = savedProgram
			}
		}

		// Subscribe to real-time changes for new/updated programs
		programsStore.subscribe(() => {
			// Handle real-time updates if needed
		})
		
		// Log performance metrics in development
		if (import.meta.env.DEV) {
			console.log('Programs page performance:', performanceMetrics)
		}
	})

	// Client-side navigation for search and pagination
	async function updateUrlAndFetch(newFilters: Partial<typeof currentFilters>) {
		clientLoading = true
		
		try {
			// Update URL with new parameters
			const searchParams = new URLSearchParams($page.url.searchParams)
			
			Object.entries({ ...currentFilters, ...newFilters }).forEach(([key, value]) => {
				if (value !== undefined && value !== null && value !== '') {
					if (Array.isArray(value)) {
						searchParams.set(key, value.join(','))
					} else {
						searchParams.set(key, String(value))
					}
				} else {
					searchParams.delete(key)
				}
			})

			// Navigate to the new URL, which will trigger server load function
			await goto(`?${searchParams.toString()}`, { 
				keepFocus: true,
				replaceState: true
			})
		} catch (err) {
			console.error('Failed to update programs:', err)
		} finally {
			clientLoading = false
		}
	}

	async function handleSearch(event: CustomEvent<{ value: string }>) {
		await updateUrlAndFetch({
			search: event.detail.value || undefined,
			page: 1 // Reset to first page when searching
		})
	}

	async function handlePageChange(event: CustomEvent<{ page: number }>) {
		await updateUrlAndFetch({
			page: event.detail.page
		})
	}

	function handleSelectProgram(event: CustomEvent<{ item: Program }>) {
		selectedProgram = event.detail.item
	}

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		return new Date(dateStr).toLocaleDateString()
	}

	function calculateDuration(startDate: string | undefined, endDate: string | undefined) {
		if (!startDate || !endDate) return 'Unknown duration'
		const start = new Date(startDate)
		const end = new Date(endDate)
		const diffTime = Math.abs(end.getTime() - start.getTime())
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
		
		if (diffDays < 30) return `${diffDays} days`
		if (diffDays < 365) return `${Math.round(diffDays / 30)} months`
		return `${Math.round(diffDays / 365)} years`
	}

	function getStatusColor(startDate: string | undefined, endDate: string | undefined) {
		const now = new Date()
		const start = startDate ? new Date(startDate) : null
		const end = endDate ? new Date(endDate) : null
		
		if (start && start > now) return 'badge-info' // Future
		if (end && end < now) return 'badge-neutral' // Completed
		if (start && start <= now && (!end || end >= now)) return 'badge-success' // Active
		return 'badge-outline' // Unknown
	}

	function getStatusText(startDate: string | undefined, endDate: string | undefined) {
		const now = new Date()
		const start = startDate ? new Date(startDate) : null
		const end = endDate ? new Date(endDate) : null
		
		if (start && start > now) return 'Upcoming'
		if (end && end < now) return 'Completed'
		if (start && start <= now && (!end || end >= now)) return 'Active'
		return 'Unknown'
	}

	// MasterDetail configuration functions
	function getProgramTitle(item: any): string {
		return item.title || 'Unnamed Program'
	}

	function getProgramSubtitle(item: any): string {
		return item.geo_coverage || 'No coverage specified'
	}

	function getProgramDetail(item: any): string {
		const status = getStatusText(item.start_date, item.end_date)
		const startDate = item.start_date ? formatDate(item.start_date) : 'No start date'
		return `${status} • ${startDate}`
	}

	function openCreateModal() {
		isCreateModalOpen = true
	}

	function closeCreateModal() {
		isCreateModalOpen = false
	}

	function handleProgramCreated(event: CustomEvent<{ program: any }>) {
		// The program will be automatically added to the store by the create function
		// We can optionally select the newly created program
		selectedProgram = event.detail.program
		
		// Close the modal
		isCreateModalOpen = false
		
		// Refresh the page data to ensure we have the latest list
		updateUrlAndFetch({})
		
		console.log('Program created successfully:', event.detail.program.title)
	}

	function openEditModal() {
		if (selectedProgram) {
			isEditModalOpen = true
		}
	}

	function closeEditModal() {
		isEditModalOpen = false
	}

	function handleEditSuccess(event: CustomEvent<{ program: Program }>) {
		// Update the selected program with the updated data
		selectedProgram = event.detail.program
		
		// The store will handle the update automatically
		console.log('Program updated successfully:', event.detail.program.title)
	}

	function openDeleteModal() {
		if (selectedProgram) {
			isDeleteModalOpen = true
		}
	}

	function closeDeleteModal() {
		isDeleteModalOpen = false
	}

	function handleDeleteSuccess() {
		// Clear the selected program since it was deleted
		selectedProgram = null
		
		// Close the modal
		isDeleteModalOpen = false
		
		// Refresh the page data to ensure we have the latest list
		updateUrlAndFetch({})
		
		console.log('Program deleted successfully')
	}
</script>

<ErrorBoundary>
	<div class="flex flex-col h-full">
		<!-- Fixed Page Header -->
		<div class="sticky top-0 z-30 flex-none px-4 py-2 bg-base-100 border-b border-base-200 shadow-sm">
			<PageHeader
				title="Programs"
				subtitle="Manage program offerings and structure"
			>
				{#snippet actions()}
					<!-- Performance indicator (development only) -->
					{#if import.meta.env.DEV && performanceMetrics}
						<div class="btn btn-ghost btn-sm text-xs opacity-60" title="Server load time">
							⚡ {performanceMetrics.totalTime}ms
						</div>
					{/if}
					<button class="btn btn-primary" onclick={openCreateModal}>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Add Program
					</button>
				{/snippet}
			</PageHeader>
		</div>
		
		<!-- Scrollable Content Area -->
		<div class="flex-1 p-6 min-h-0">
			<MasterDetail
				items={filteredPrograms as any}
				selectedItem={selectedProgram as any}
				loading={clientLoading}
				searchPlaceholder="Search programs..."
				searchValue={currentFilters.search || ''}
				masterTitle="Programs"
				getItemTitle={getProgramTitle}
				getItemSubtitle={getProgramSubtitle}
				getItemDetail={getProgramDetail}
				detailEmptyIcon="📋"
				detailEmptyTitle="Select a program"
				detailEmptyMessage="Choose a program from the list to view its full information"
				storageKey="phwb-selected-program"
				on:search={handleSearch}
				on:select={handleSelectProgram}
			>
				{#snippet filters()}
					<div class="dropdown dropdown-end">
						<button tabindex="0" class="btn btn-sm btn-outline" class:btn-active={hideEndedPrograms}>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
							</svg>
							Filters
							{#if hideEndedPrograms}
								<span class="badge badge-sm badge-primary">•</span>
							{/if}
						</button>
						<div tabindex="0" class="dropdown-content z-[1] card card-compact w-64 p-4 shadow bg-base-100 border border-base-300 mt-2">
							<div class="space-y-3">
								<div class="flex items-center justify-between">
									<h3 class="font-semibold text-sm">Filter Programs</h3>
									{#if hideEndedPrograms}
										<button
											class="btn btn-ghost btn-xs"
											onclick={() => {
												hideEndedPrograms = false
											}}
										>
											Clear all
										</button>
									{/if}
								</div>

								<div class="divider my-1"></div>

								<div class="form-control">
									<label class="label cursor-pointer justify-start gap-2 py-1">
										<input
											type="checkbox"
											class="checkbox checkbox-sm checkbox-primary"
											bind:checked={hideEndedPrograms}
										/>
										<span class="label-text text-sm font-medium">Hide ended programs</span>
									</label>
									<p class="text-xs opacity-60 ml-6">Only show active and upcoming programs</p>
								</div>
							</div>
						</div>
					</div>
				{/snippet}
				{#snippet children(props)}
					{@const program = props.item}
					{#if program}
						<div class="overflow-y-auto h-full">
							<div class="flex items-start justify-between mb-6">
								<div>
									<h2 class="card-title text-2xl">
										{program.title || 'Unnamed Program'}
									</h2>
									<div class="flex items-center gap-3 mt-2">
										<span class="badge {getStatusColor(program.start_date, program.end_date)}">
											{getStatusText(program.start_date, program.end_date)}
										</span>
										{#if program.geo_coverage}
											<span class="badge badge-outline">
												{program.geo_coverage}
											</span>
										{/if}
									</div>
								</div>
								<div class="flex gap-2">
									<button 
										class="btn btn-sm btn-outline"
										onclick={openEditModal}
										title="Edit program information"
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
										</svg>
										Edit
									</button>
									<button 
										class="btn btn-sm btn-outline btn-error"
										onclick={openDeleteModal}
										title="Delete program"
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
										Delete
									</button>
								</div>
							</div>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
								<!-- Program Details -->
								<div class="space-y-4">
									<h3 class="text-lg font-semibold border-b pb-2">Program Details</h3>
									<div class="space-y-3">
										<div>
											<label class="text-sm font-medium opacity-70">Program Title</label>
											<p class="text-base">{program.title || 'Not specified'}</p>
										</div>
										<div>
											<label class="text-sm font-medium opacity-70">Geographic Coverage</label>
											<p class="text-base">{program.geo_coverage || 'Not specified'}</p>
										</div>
										<div>
											<label class="text-sm font-medium opacity-70">Partner ID</label>
											<p class="text-base">{program.partner || 'No partner assigned'}</p>
										</div>
										<div>
											<label class="text-sm font-medium opacity-70">Created</label>
											<p class="text-base">{formatDate(program.created_at)}</p>
										</div>
									</div>
								</div>

								<!-- Timeline -->
								<div class="space-y-4">
									<h3 class="text-lg font-semibold border-b pb-2">Timeline</h3>
									<div class="space-y-3">
										<div>
											<label class="text-sm font-medium opacity-70">Start Date</label>
											<p class="text-base">{formatDate(program.start_date)}</p>
										</div>
										<div>
											<label class="text-sm font-medium opacity-70">End Date</label>
											<p class="text-base">{formatDate(program.end_date)}</p>
										</div>
										<div>
											<label class="text-sm font-medium opacity-70">Duration</label>
											<p class="text-base">{calculateDuration(program.start_date, program.end_date)}</p>
										</div>
										<div>
											<span class="text-sm font-medium opacity-70">Status</span>
											<span class="badge {getStatusColor(program.start_date, program.end_date)}">
												{getStatusText(program.start_date, program.end_date)}
											</span>
										</div>
									</div>
								</div>

								<!-- Description -->
								<div class="md:col-span-2 space-y-4">
									<h3 class="text-lg font-semibold border-b pb-2">Description</h3>
									<div>
										<p class="text-base whitespace-pre-wrap">{program.description || 'No description provided'}</p>
									</div>
								</div>

								<!-- Program Timeline Visualization -->
								{#if program.start_date}
									<div class="md:col-span-2 space-y-4">
										<h3 class="text-lg font-semibold border-b pb-2">Timeline Visualization</h3>
										<div class="bg-base-200 p-4 rounded-lg">
											<div class="flex items-center justify-between text-sm">
												<span class="font-medium">Start</span>
												<span class="font-medium">End</span>
											</div>
											{#if program.start_date}
												{@const now = new Date()}
												{@const start = new Date(program.start_date)}
												{@const end = program.end_date ? new Date(program.end_date) : new Date()}
												{@const total = end.getTime() - start.getTime()}
												{@const progress = Math.min(100, Math.max(0, ((now.getTime() - start.getTime()) / total) * 100))}
												
												<div class="relative mt-2 h-2 bg-base-300 rounded-full overflow-hidden">
													<div 
														class="h-full bg-primary transition-all duration-500 rounded-full"
														style="width: {progress}%"
													></div>
												</div>
											{/if}
											<div class="flex items-center justify-between text-xs mt-2 opacity-70">
												<span>{formatDate(program.start_date)}</span>
												<span>{formatDate(program.end_date)}</span>
											</div>
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}
				{/snippet}
			</MasterDetail>
		</div>
	</div>

	<!-- Create Program Modal -->
	<CreateProgram 
		open={isCreateModalOpen}
		on:close={closeCreateModal}
		on:success={handleProgramCreated}
	/>

	<!-- Edit Program Modal -->
	<EditProgram 
		open={isEditModalOpen}
		program={selectedProgram}
		on:close={closeEditModal}
		on:success={handleEditSuccess}
	/>

	<!-- Delete Program Modal -->
	<DeleteProgram
		open={isDeleteModalOpen}
		program={selectedProgram}
		on:close={closeDeleteModal}
		on:success={handleDeleteSuccess}
	/>
</ErrorBoundary>