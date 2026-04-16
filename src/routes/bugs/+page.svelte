<script lang="ts">
	import { onMount, onDestroy } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { browser } from '$app/environment'
	import { Bug, Plus, Search, Filter, X, Grid3x3, List, Columns } from 'lucide-svelte'
	import { bugsStore } from '$lib/stores/bugs'
	import { supabase } from '$lib/supabase'
	import type { BugsPageData } from './+page.server'
	import type { Bug as BugType } from '$lib/schemas/bug'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import { formatDistanceToNow } from 'date-fns'
	import BugCreateForm from './components/BugCreateForm.svelte'

	interface Props {
		data: BugsPageData
	}

	const STORAGE_KEY = 'phwb_bugs_view_mode'
	const DEFAULT_VIEW_MODE: 'grid' | 'list' | 'kanban' = 'grid'

	let { data }: Props = $props()

	let bugs = $state<BugType[]>(data.bugs)
	let showCreateForm = $state(false)
	let showFilters = $state(false)
	let searchQuery = $state(data.filters.search || '')
	let selectedBugs = $state<Set<number>>(new Set())
	
	// Load view mode from localStorage or use default
	function loadViewMode(): 'grid' | 'list' | 'kanban' {
		if (!browser) return DEFAULT_VIEW_MODE
		try {
			const saved = localStorage.getItem(STORAGE_KEY)
			if (saved === 'grid' || saved === 'list' || saved === 'kanban') {
				return saved
			}
		} catch (error) {
			console.error('Failed to load view mode preference:', error)
		}
		return DEFAULT_VIEW_MODE
	}

	// Save view mode to localStorage
	function saveViewMode(mode: 'grid' | 'list' | 'kanban') {
		if (!browser) return
		try {
			localStorage.setItem(STORAGE_KEY, mode)
		} catch (error) {
			console.error('Failed to save view mode preference:', error)
		}
	}

	let viewMode = $state<'grid' | 'list' | 'kanban'>(DEFAULT_VIEW_MODE)
	let realtimeSubscription: any = null
	let profilesMap = $state<Map<string, { full_name: string | null; avatar_url: string | null }>>(new Map())
	
	// Statistics - start with server data, update in realtime
	let statistics = $state({
		total: data.statistics.total,
		open: data.statistics.open,
		inProgress: data.statistics.inProgress,
		resolved: data.statistics.resolved
	})

	// Filter state
	let statusFilter = $state(data.filters.status || '')
	let priorityFilter = $state(data.filters.priority || '')
	let severityFilter = $state(data.filters.severity || '')
	let categoryFilter = $state(data.filters.category || '')
	let assignedToFilter = $state(data.filters.assignedTo || '')
	let reportedByFilter = $state(data.filters.reportedBy || '')

	// Initialize profiles map from server data (only once on mount)
	// Track last synced data to avoid unnecessary updates
	let lastSyncedBugsData = $state<string | null>(null)
	
	// Sync bugs with data.bugs when server data changes (e.g., after invalidateAll())
	$effect(() => {
		const newBugsData = JSON.stringify(data.bugs.map(b => b.id))
		if (newBugsData !== lastSyncedBugsData) {
			lastSyncedBugsData = newBugsData
			bugs = data.bugs
			
			// Update profiles map when data changes
			const map = new Map<string, { full_name: string | null; avatar_url: string | null }>()
			data.bugs.forEach((bug: any) => {
				if (bug.profiles_reported && bug.reported_by) {
					map.set(bug.reported_by, bug.profiles_reported)
				}
				if (bug.profiles_assigned && bug.assigned_to) {
					map.set(bug.assigned_to, bug.profiles_assigned)
				}
			})
			profilesMap = map
			
			// Update statistics
			statistics = {
				total: data.statistics.total,
				open: data.statistics.open,
				inProgress: data.statistics.inProgress,
				resolved: data.statistics.resolved
			}
		}
	})
	
	onMount(() => {
		// Load saved view mode preference
		viewMode = loadViewMode()
	})

	// Fetch profile for a user ID
	async function fetchProfile(userId: string) {
		if (!userId || profilesMap.has(userId)) return
		
		const { data: profile } = await supabase
			.from('profiles')
			.select('id, full_name, avatar_url')
			.eq('id', userId)
			.maybeSingle()

		if (profile) {
			profilesMap = new Map(profilesMap)
			profilesMap.set(userId, {
				full_name: profile.full_name,
				avatar_url: profile.avatar_url
			})
		}
	}

	// Attach profile data to a bug
	function attachProfiles(bug: BugType): any {
		return {
			...bug,
			profiles_reported: bug.reported_by ? profilesMap.get(bug.reported_by) || null : null,
			profiles_assigned: bug.assigned_to ? profilesMap.get(bug.assigned_to) || null : null
		}
	}

	// Debounce timer for search input
	let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
	
	// Update URL when filters change (with optional debounce for search)
	function updateFilters(debounce = false) {
		const doUpdate = () => {
			const params = new URLSearchParams()
			if (searchQuery) params.set('search', searchQuery)
			if (statusFilter) params.set('status', statusFilter)
			if (priorityFilter) params.set('priority', priorityFilter)
			if (severityFilter) params.set('severity', severityFilter)
			if (categoryFilter) params.set('category', categoryFilter)
			if (assignedToFilter) params.set('assignedTo', assignedToFilter)
			if (reportedByFilter) params.set('reportedBy', reportedByFilter)
			
			// Use replaceState to update URL without triggering full page navigation
			// This prevents the input from losing focus
			goto(`/bugs?${params.toString()}`, { noScroll: true, replaceState: true, keepFocus: true })
		}
		
		if (debounce) {
			// Clear previous timer
			if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
			// Set new timer with 300ms delay
			searchDebounceTimer = setTimeout(doUpdate, 300)
		} else {
			doUpdate()
		}
	}

	function getStatusBadgeClass(status: BugType['status']): string {
		const classes: Record<string, string> = {
			new: 'badge-info',
			planning: 'badge-warning',
			in_progress: 'badge-primary',
			testing: 'badge-secondary',
			review: 'badge-accent',
			qa_passed: 'badge-success',
			resolved: 'badge-success'
		}
		return classes[status] || 'badge-neutral'
	}

	function getStatusLabel(status: BugType['status']): string {
		const labels: Record<string, string> = {
			new: 'New',
			planning: 'Planning',
			in_progress: 'In Progress',
			testing: 'Testing',
			review: 'Review',
			qa_passed: 'QA passed',
			resolved: 'Resolved'
		}
		return labels[status] || status
	}

	function getPriorityBadgeClass(priority: BugType['priority']): string {
		const classes: Record<string, string> = {
			low: 'badge-outline',
			medium: 'badge-warning',
			high: 'badge-error',
			critical: 'badge-error'
		}
		return classes[priority] || 'badge-neutral'
	}

	function getPriorityLabel(priority: BugType['priority']): string {
		return priority.charAt(0).toUpperCase() + priority.slice(1)
	}


	function formatDate(dateString: string | undefined): string {
		if (!dateString) return 'N/A'
		try {
			return formatDistanceToNow(new Date(dateString), { addSuffix: true })
		} catch {
			return dateString
		}
	}

	function clearFilters() {
		statusFilter = ''
		priorityFilter = ''
		severityFilter = ''
		categoryFilter = ''
		assignedToFilter = ''
		reportedByFilter = ''
		searchQuery = ''
		updateFilters()
	}

	function toggleBugSelection(bugId: number) {
		if (selectedBugs.has(bugId)) {
			selectedBugs.delete(bugId)
		} else {
			selectedBugs.add(bugId)
		}
		selectedBugs = new Set(selectedBugs)
	}

	function selectAllBugs() {
		selectedBugs = new Set(bugs.map(b => b.id).filter((id): id is number => typeof id === 'number'))
	}

	function clearSelection() {
		selectedBugs = new Set()
	}

	// Group bugs by status for kanban view - make it reactive so kanban updates in realtime
	const bugsByStatus = $derived.by(() => {
		const grouped: Record<string, BugType[]> = {
			new: [],
			planning: [],
			in_progress: [],
			testing: [],
			review: [],
			qa_passed: [],
			resolved: []
		}
		
		bugs.forEach(bug => {
			if (grouped[bug.status]) {
				grouped[bug.status].push(bug)
			}
		})
		
		// Sort each group by ID descending
		Object.keys(grouped).forEach(status => {
			grouped[status].sort((a, b) => {
				const aId = a.id as number || 0
				const bId = b.id as number || 0
				return bId - aId // Descending order
			})
		})
		
		return grouped as Record<BugType['status'], BugType[]>
	})

	// Status order for kanban columns
	const statusOrder: BugType['status'][] = ['new', 'planning', 'in_progress', 'testing', 'review', 'qa_passed', 'resolved']

	// Set up realtime subscription
	onMount(() => {
		console.log('Setting up realtime subscription for bugs...')
		realtimeSubscription = bugsStore.subscribeToChanges({
			status: (status) => {
				console.log('Realtime subscription status:', status)
				if (status === 'SUBSCRIBED') {
					console.log('✅ Realtime subscription is active and ready')
				} else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
					console.warn('⚠️ Realtime subscription issue:', status)
				} else if (status === 'CLOSED') {
					console.warn('⚠️ Realtime subscription closed, will attempt to reconnect')
				}
			},
			onInsert: async (payload) => {
				console.log('Realtime INSERT event received:', payload)
				const newBug = payload.new as BugType
				// Fetch profiles for new bug
				if (newBug.reported_by) await fetchProfile(newBug.reported_by)
				if (newBug.assigned_to) await fetchProfile(newBug.assigned_to)
				
				// Update statistics
				statistics.total += 1
				if (['new', 'planning', 'in_progress', 'testing', 'review'].includes(newBug.status)) {
					statistics.open += 1
				}
				if (newBug.status === 'in_progress') {
					statistics.inProgress += 1
				}
				if (newBug.status === 'resolved') {
					statistics.resolved += 1
				}
				
				// Check if bug matches current filters
				const matchesFilters = 
					(!statusFilter || newBug.status === statusFilter) &&
					(!priorityFilter || newBug.priority === priorityFilter) &&
					(!severityFilter || newBug.severity === severityFilter) &&
					(!categoryFilter || newBug.category === categoryFilter) &&
					(!assignedToFilter || newBug.assigned_to === assignedToFilter) &&
					(!reportedByFilter || newBug.reported_by === reportedByFilter) &&
					(!searchQuery || 
						newBug.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
						newBug.description?.toLowerCase().includes(searchQuery.toLowerCase())
					)

				if (matchesFilters) {
					bugs = [attachProfiles(newBug), ...bugs]
				}
			},
			onUpdate: async (payload) => {
				console.log('Realtime UPDATE event received:', payload)
				const updatedBug = payload.new as BugType
				const oldBug = payload.old as Partial<BugType>
				
				// Fetch profiles if needed
				if (updatedBug.reported_by) await fetchProfile(updatedBug.reported_by)
				if (updatedBug.assigned_to) await fetchProfile(updatedBug.assigned_to)
				
				// Find the existing bug to get its old status if not available in payload
				const existingBug = bugs.find(b => b.id === updatedBug.id)
				const oldStatus = oldBug.status || existingBug?.status
				
				// Update statistics based on status changes
				if (oldStatus && oldStatus !== updatedBug.status) {
					// Remove from old status
					if (['new', 'planning', 'in_progress', 'testing', 'review'].includes(oldStatus)) {
						statistics.open -= 1
					}
					if (oldStatus === 'in_progress') {
						statistics.inProgress -= 1
					}
					if (oldStatus === 'resolved') {
						statistics.resolved -= 1
					}
					
					// Add to new status
					if (['new', 'planning', 'in_progress', 'testing', 'review'].includes(updatedBug.status)) {
						statistics.open += 1
					}
					if (updatedBug.status === 'in_progress') {
						statistics.inProgress += 1
					}
					if (updatedBug.status === 'resolved') {
						statistics.resolved += 1
					}
				}
				
				// Check if bug still matches filters
				const matchesFilters = 
					(!statusFilter || updatedBug.status === statusFilter) &&
					(!priorityFilter || updatedBug.priority === priorityFilter) &&
					(!severityFilter || updatedBug.severity === severityFilter) &&
					(!categoryFilter || updatedBug.category === categoryFilter) &&
					(!assignedToFilter || updatedBug.assigned_to === assignedToFilter) &&
					(!reportedByFilter || updatedBug.reported_by === reportedByFilter) &&
					(!searchQuery || 
						updatedBug.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
						updatedBug.description?.toLowerCase().includes(searchQuery.toLowerCase())
					)

				const bugIndex = bugs.findIndex(b => b.id === updatedBug.id)
				
				if (bugIndex !== -1) {
					// Bug exists in current list
					if (matchesFilters) {
						// Update it
						bugs = bugs.map(b => b.id === updatedBug.id ? attachProfiles(updatedBug) : b)
					} else {
						// Remove it (no longer matches filters)
						bugs = bugs.filter(b => b.id !== updatedBug.id)
					}
				} else if (matchesFilters) {
					// Bug doesn't exist but now matches filters, add it
					bugs = [attachProfiles(updatedBug), ...bugs]
				}
			},
			onDelete: (payload) => {
				console.log('Realtime DELETE event received:', payload)
				const deletedBug = payload.old as BugType
				
				// Update statistics
				statistics.total -= 1
				if (['new', 'planning', 'in_progress', 'testing', 'review'].includes(deletedBug.status)) {
					statistics.open -= 1
				}
				if (deletedBug.status === 'in_progress') {
					statistics.inProgress -= 1
				}
				if (deletedBug.status === 'resolved') {
					statistics.resolved -= 1
				}
				
				bugs = bugs.filter(b => b.id !== deletedBug.id)
			}
		})
		
		if (realtimeSubscription) {
			console.log('Realtime subscription established:', realtimeSubscription)
		} else {
			console.error('❌ Failed to establish realtime subscription')
		}
	})

	// Cleanup subscription and timers
	onDestroy(() => {
		if (realtimeSubscription) {
			bugsStore.unsubscribeFromChanges()
		}
		if (searchDebounceTimer) {
			clearTimeout(searchDebounceTimer)
		}
	})
</script>

<ErrorBoundary>
	<div class="h-full flex flex-col p-6">
		<!-- Header -->
		<div class="flex items-center justify-between mb-6">
			<div>
				<h1 class="text-3xl font-bold flex items-center gap-2">
					<Bug class="w-8 h-8" />
					Issues
				</h1>
				<p class="text-base-content/60 mt-1">
					{statistics.total} total • {statistics.open} open • {statistics.inProgress} in progress
				</p>
			</div>
			<div class="flex items-center gap-3">
				<!-- View Toggle -->
				<div class="btn-group">
					<button
						class="btn btn-sm {viewMode === 'grid' ? 'btn-primary' : 'btn-outline'}"
						onclick={() => {
							viewMode = 'grid'
							saveViewMode('grid')
						}}
						title="Grid View"
					>
						<Grid3x3 class="w-4 h-4" />
					</button>
					<button
						class="btn btn-sm {viewMode === 'list' ? 'btn-primary' : 'btn-outline'}"
						onclick={() => {
							viewMode = 'list'
							saveViewMode('list')
						}}
						title="List View"
					>
						<List class="w-4 h-4" />
					</button>
					<button
						class="btn btn-sm {viewMode === 'kanban' ? 'btn-primary' : 'btn-outline'}"
						onclick={() => {
							viewMode = 'kanban'
							saveViewMode('kanban')
						}}
						title="Kanban View"
					>
						<Columns class="w-4 h-4" />
					</button>
				</div>
				<button
					class="btn btn-primary"
					onclick={() => showCreateForm = true}
				>
					<Plus class="w-5 h-5" />
					New Issue
				</button>
			</div>
		</div>

		<!-- Filters and Search -->
		<div class="bg-base-200 rounded-lg p-4 mb-6">
			<div class="flex flex-col md:flex-row gap-4">
				<!-- Search -->
				<div class="flex-1">
					<label class="input input-bordered flex items-center gap-2">
						<Search class="w-4 h-4" />
						<input
							type="text"
							class="grow"
							placeholder="Search issues..."
							bind:value={searchQuery}
							oninput={() => updateFilters(true)}
						/>
					</label>
				</div>

				<!-- Filter Toggle -->
				<button
					class="btn btn-outline"
					onclick={() => showFilters = !showFilters}
				>
					<Filter class="w-4 h-4" />
					Filters
					{#if statusFilter || priorityFilter || categoryFilter || assignedToFilter || reportedByFilter}
						<span class="badge badge-sm badge-primary ml-2">
							{[statusFilter, priorityFilter, categoryFilter, assignedToFilter, reportedByFilter].filter(Boolean).length}
						</span>
					{/if}
				</button>
			</div>

				<!-- Expanded Filters -->
			{#if showFilters}
				<div class="mt-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
					<!-- Status Filter -->
					<select class="select select-bordered" bind:value={statusFilter} onchange={updateFilters}>
						<option value="">All Statuses</option>
						<option value="new">New</option>
						<option value="planning">Planning</option>
						<option value="in_progress">In Progress</option>
						<option value="testing">Testing</option>
						<option value="review">Review</option>
						<option value="qa_passed">QA passed</option>
						<option value="resolved">Resolved</option>
					</select>

					<!-- Priority Filter -->
					<select class="select select-bordered" bind:value={priorityFilter} onchange={updateFilters}>
						<option value="">All Priorities</option>
						<option value="low">Low</option>
						<option value="medium">Medium</option>
						<option value="high">High</option>
						<option value="critical">Critical</option>
					</select>

					<!-- Category Filter -->
					<input
						type="text"
						class="input input-bordered"
						placeholder="Category"
						bind:value={categoryFilter}
						oninput={() => updateFilters()}
					/>

					<!-- Assigned To Filter -->
					<select class="select select-bordered" bind:value={assignedToFilter} onchange={updateFilters}>
						<option value="">All Assignees</option>
						{#each data.users as user}
							<option value={user.id}>{user.full_name || 'Unknown'}</option>
						{/each}
					</select>

					<!-- Reported By Filter -->
					<select class="select select-bordered" bind:value={reportedByFilter} onchange={updateFilters}>
						<option value="">All Reporters</option>
						{#each data.users as user}
							<option value={user.id}>{user.full_name || 'Unknown'}</option>
						{/each}
					</select>
				</div>

				<!-- Clear Filters -->
				{#if statusFilter || priorityFilter || categoryFilter || assignedToFilter || reportedByFilter}
					<div class="mt-4">
						<button class="btn btn-sm btn-ghost" onclick={clearFilters}>
							<X class="w-4 h-4" />
							Clear Filters
						</button>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Bulk Actions -->
		{#if selectedBugs.size > 0}
			<div class="bg-primary/10 border border-primary rounded-lg p-4 mb-6 flex items-center justify-between">
				<span class="font-medium">{selectedBugs.size} issue{selectedBugs.size === 1 ? '' : 's'} selected</span>
				<div class="flex gap-2">
					<button class="btn btn-sm btn-ghost" onclick={clearSelection}>Clear</button>
					<button class="btn btn-sm btn-primary">Bulk Actions</button>
				</div>
			</div>
		{/if}

		<!-- Issues List -->
		{#if bugs.length === 0}
			<div class="flex-1 flex items-center justify-center bg-base-200 rounded-lg p-12">
				<div class="text-center">
					<Bug class="w-16 h-16 mx-auto text-base-content/30 mb-4" />
					<p class="text-lg font-medium mb-2">No issues found</p>
					<p class="text-base-content/60 mb-4">
						{#if searchQuery || statusFilter || priorityFilter}
							Try adjusting your filters
						{:else}
							Get started by creating your first issue
						{/if}
					</p>
					{#if !searchQuery && !statusFilter && !priorityFilter}
						<button class="btn btn-primary" onclick={() => showCreateForm = true}>
							<Plus class="w-5 h-5" />
							New Issue
						</button>
					{/if}
				</div>
			</div>
		{:else if viewMode === 'kanban'}
			<!-- Kanban View -->
			<div class="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
				<div class="flex gap-4 h-full pb-4" style="min-width: fit-content;">
					{#each statusOrder as status}
						{@const bugsInStatus = bugsByStatus[status]}
						<div class="flex-shrink-0 w-80 flex flex-col bg-base-200 rounded-lg border border-base-300 overflow-hidden">
							<!-- Column Header -->
							<div class="p-4 bg-base-300 border-b border-base-300 sticky top-0 z-10">
								<div class="flex items-center justify-between">
									<h3 class="font-semibold text-lg flex items-center gap-2">
										<span class="badge badge-sm {getStatusBadgeClass(status)}">
											{getStatusLabel(status)}
										</span>
									</h3>
									<span class="badge badge-sm badge-outline">{bugsInStatus.length}</span>
								</div>
							</div>
							
							<!-- Column Content -->
							<div class="flex-1 overflow-y-auto p-3 space-y-3">
								{#each bugsInStatus as bug}
									<div
										class="card bg-base-100 border border-base-300 hover:border-primary/50 transition-colors cursor-pointer shadow-sm"
										onclick={() => goto(`/bugs/${bug.id}`)}
									>
										<div class="card-body p-4">
											<!-- Checkbox and Title -->
											<div class="flex items-start gap-2 mb-2">
												<input
													type="checkbox"
													class="checkbox checkbox-sm mt-1"
													checked={selectedBugs.has(bug.id as number)}
													onclick={(e) => {
														e.stopPropagation()
														toggleBugSelection(bug.id as number)
													}}
												/>
												<div class="flex-1 min-w-0">
													<div class="flex items-center gap-2 mb-1">
														<span class="text-xs font-mono text-base-content/50">#{bug.id}</span>
													</div>
													<h4 class="font-semibold text-sm line-clamp-2">
														{bug.title}
													</h4>
												</div>
											</div>
											
											<!-- Description Preview -->
											{#if bug.description}
												<p class="text-xs text-base-content/70 line-clamp-2 mb-2">
													{bug.description}
												</p>
											{/if}
											
											<!-- Priority -->
											<div class="flex flex-wrap gap-1 mb-2">
												<span class="badge badge-xs {getPriorityBadgeClass(bug.priority)}">
													{getPriorityLabel(bug.priority)}
												</span>
											</div>
											
											<!-- Category -->
											{#if bug.category}
												<div class="mb-2">
													<span class="badge badge-xs badge-outline">{bug.category}</span>
												</div>
											{/if}
											
											<!-- Assignee -->
											<div class="text-xs text-base-content/60 mb-2">
												{#if bug.assigned_to && profilesMap.get(bug.assigned_to)?.full_name}
													<span class="font-medium">Assigned:</span> {profilesMap.get(bug.assigned_to)!.full_name}
												{:else}
													<span class="text-base-content/40">Unassigned</span>
												{/if}
											</div>
											
											<!-- Footer -->
											<div class="flex items-center justify-between text-xs text-base-content/50 pt-2 border-t border-base-300">
												<span>{formatDate(bug.created_at)}</span>
												{#if bug.due_date}
													<span class="text-warning">Due: {new Date(bug.due_date).toLocaleDateString()}</span>
												{/if}
											</div>
										</div>
									</div>
								{:else}
									<div class="text-center text-base-content/40 py-8">
										<p class="text-sm">No issues in this status</p>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{:else if viewMode === 'grid'}
			<!-- Grid View -->
			<div class="flex-1 overflow-y-auto min-h-0">
				<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
				{#each bugs as bug}
					<div
						class="card bg-base-100 border border-base-300 hover:border-primary/50 transition-colors cursor-pointer"
						onclick={() => goto(`/bugs/${bug.id}`)}
					>
						<div class="card-body p-4">
							<!-- Header with checkbox and status -->
							<div class="flex items-start justify-between mb-2">
								<div class="flex items-start gap-2 flex-1">
									<input
										type="checkbox"
										class="checkbox checkbox-sm mt-1"
										checked={selectedBugs.has(bug.id as number)}
										onclick={(e) => {
											e.stopPropagation()
											toggleBugSelection(bug.id as number)
										}}
									/>
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 mb-1">
											<span class="text-sm font-mono font-semibold text-base-content/70">#{bug.id}</span>
										</div>
										<h3 class="font-semibold text-lg line-clamp-2 mb-1">
											{bug.title}
										</h3>
										<div class="flex flex-wrap gap-2">
											<span class="badge badge-sm {getStatusBadgeClass(bug.status)}">
												{getStatusLabel(bug.status)}
											</span>
											<span class="badge badge-sm {getPriorityBadgeClass(bug.priority)}">
												{getPriorityLabel(bug.priority)}
											</span>
										</div>
									</div>
								</div>
							</div>

							<!-- Description Preview -->
							{#if bug.description}
								<p class="text-sm text-base-content/70 line-clamp-2 mb-3">
									{bug.description}
								</p>
							{/if}

							<!-- Category -->
							{#if bug.category}
								<div class="mb-3">
									<span class="badge badge-xs badge-outline">{bug.category}</span>
								</div>
							{/if}

							<!-- Assignee and Reporter -->
							<div class="flex items-center justify-between text-xs text-base-content/60 mb-2">
								<div class="flex items-center gap-4">
									{#if bug.assigned_to}
										<div>
											<span class="font-medium">Assigned:</span>
											<span class="ml-1">
												{profilesMap.get(bug.assigned_to)?.full_name || 'Unknown'}
											</span>
										</div>
									{:else}
										<span class="text-base-content/40">Unassigned</span>
									{/if}
								</div>
								<div>
									<span class="font-medium">By:</span>
									<span class="ml-1">
										{profilesMap.get(bug.reported_by || '')?.full_name || 'Unknown'}
									</span>
								</div>
							</div>

							<!-- Due Date -->
							{#if bug.due_date}
								<div class="text-xs text-base-content/60 mb-2">
									<span class="font-medium">Due:</span>
									<span class="ml-1">{new Date(bug.due_date).toLocaleDateString()}</span>
								</div>
							{/if}

							<!-- Footer -->
							<div class="flex items-center justify-between mt-auto pt-2 border-t border-base-300">
								<span class="text-xs text-base-content/50">
									{formatDate(bug.created_at)}
								</span>
								{#if bug.updated_at && bug.updated_at !== bug.created_at}
									<span class="text-xs text-base-content/50">
										Updated {formatDate(bug.updated_at)}
									</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
				</div>
			</div>
		{:else}
			<!-- List View -->
			<div class="flex-1 bg-base-100 rounded-lg border border-base-300 overflow-hidden flex flex-col min-h-0">
				<div class="overflow-x-auto overflow-y-auto flex-1">
					<table class="table table-zebra">
						<thead>
							<tr>
								<th class="w-12">
									<input
										type="checkbox"
										class="checkbox checkbox-sm"
										checked={selectedBugs.size === bugs.length && bugs.length > 0}
										onchange={(e) => {
											if ((e.target as HTMLInputElement).checked) {
												selectAllBugs()
											} else {
												clearSelection()
											}
										}}
									/>
								</th>
								<th>ID</th>
								<th>Title</th>
								<th>Status</th>
								<th>Priority</th>
								<th>Assigned To</th>
								<th>Reported By</th>
								<th>Category</th>
								<th>Created</th>
							</tr>
						</thead>
						<tbody>
							{#each bugs as bug}
								<tr
									class="cursor-pointer hover:bg-base-200 transition-colors"
									onclick={() => goto(`/bugs/${bug.id}`)}
								>
									<td onclick={(e) => e.stopPropagation()}>
										<input
											type="checkbox"
											class="checkbox checkbox-sm"
											checked={selectedBugs.has(bug.id as number)}
											onclick={(e) => {
												e.stopPropagation()
												toggleBugSelection(bug.id as number)
											}}
										/>
									</td>
									<td>
										<span class="font-mono font-semibold text-base-content/70">#{bug.id}</span>
									</td>
									<td>
										<div class="font-semibold line-clamp-1">{bug.title}</div>
										{#if bug.description}
											<div class="text-xs text-base-content/60 line-clamp-1 mt-1">
												{bug.description}
											</div>
										{/if}
									</td>
									<td>
										<span class="badge badge-sm {getStatusBadgeClass(bug.status)}">
											{getStatusLabel(bug.status)}
										</span>
									</td>
									<td>
										<span class="badge badge-sm {getPriorityBadgeClass(bug.priority)}">
											{getPriorityLabel(bug.priority)}
										</span>
									</td>
									<td>
										{#if bug.assigned_to && profilesMap.get(bug.assigned_to)?.full_name}
											{profilesMap.get(bug.assigned_to)!.full_name}
										{:else}
											<span class="text-base-content/40">Unassigned</span>
										{/if}
									</td>
									<td>
										{profilesMap.get(bug.reported_by || '')?.full_name || 'Unknown'}
									</td>
									<td>
										{#if bug.category}
											<span class="badge badge-xs badge-outline">{bug.category}</span>
										{:else}
											<span class="text-base-content/40">—</span>
										{/if}
									</td>
									<td class="text-xs text-base-content/60">
										{formatDate(bug.created_at)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

		{/if}

		<!-- Create Bug Form Modal -->
		<BugCreateForm bind:isOpen={showCreateForm} />
	</div>
</ErrorBoundary>
