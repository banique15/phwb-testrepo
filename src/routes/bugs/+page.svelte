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
			resolved: 'badge-success',
			closed: 'badge-neutral'
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
			resolved: 'Resolved',
			closed: 'Closed'
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
			resolved: [],
			closed: []
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
	const statusOrder: BugType['status'][] = ['new', 'planning', 'in_progress', 'testing', 'review', 'resolved', 'closed']

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
					(!assignedToFilter || newBug.assigned_to === assignedToFi

...[FILE CONTENT TRUNCATED DUE TO LENGTH - DO NOT READ COMPILED/MINIFIED/LOCK FILES]

</script>

<div class="bug-list-container">
	{#if bugs.length === 0}
		<div class="empty-state">
			🐛 No bugs found matching your filters.
		</div>
	{:else}
		<!-- Existing code to display bugs -->
	{/if}
</div>
