<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { ArrowLeft, Edit, Check, X, User, Calendar, Clock, Tag, AlertCircle, FlaskConical, Wrench } from 'lucide-svelte'
	import { bugsStore } from '$lib/stores/bugs'
	import type { BugDetailPageData } from './+page.server'
	import type { Bug as BugType } from '$lib/schemas/bug'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import { formatDistanceToNow } from 'date-fns'
	import BugDetailTabs from './components/BugDetailTabs.svelte'
	import BugStatusChange from './components/BugStatusChange.svelte'
	import BugAssigneeSelect from './components/BugAssigneeSelect.svelte'

	interface Props {
		data: BugDetailPageData
	}

	let { data }: Props = $props()

	let bug = $state<BugType>(data.bug as BugType)

	const validTabs = ['description', 'comments', 'attachments', 'activity', 'time', 'replication', 'testing'] as const
	type TabId = typeof validTabs[number]
	const initialTab = $page.url.searchParams.get('tab') as TabId | null
	let activeTab = $state<TabId>(initialTab && validTabs.includes(initialTab) ? initialTab : 'description')
	let editingTitle = $state(false)
	let editingDescription = $state(false)
	let titleValue = $state(bug.title)
	let descriptionValue = $state(bug.description || '')

	// Keep bug in sync with server data (only when data.bug.id or updated_at changes)
	$effect(() => {
		const newBug = data.bug as BugType
		const bugId = newBug.id
		const updatedAt = newBug.updated_at
		
		// Only update if bug ID changed or if it's a different bug instance (updated_at changed)
		if (bug.id !== bugId || bug.updated_at !== updatedAt) {
			bug = newBug
			if (!editingTitle) {
				titleValue = bug.title
			}
			if (!editingDescription) {
				descriptionValue = bug.description || ''
			}
		}
	})

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

	async function handleStatusChange(newStatus: BugType['status']) {
		try {
			await bugsStore.changeStatus(bug.id as number, newStatus)
			bug = { ...bug, status: newStatus }
		} catch (error) {
			console.error('Failed to change status:', error)
		}
	}

	async function handleAssigneeChange(userId: string | null) {
		try {
			await bugsStore.assignBug(bug.id as number, userId)
			bug = { ...bug, assigned_to: userId }
		} catch (error) {
			console.error('Failed to assign bug:', error)
		}
	}

	async function saveTitle() {
		try {
			await bugsStore.update(bug.id as number, { title: titleValue })
			bug = { ...bug, title: titleValue }
			editingTitle = false
		} catch (error) {
			console.error('Failed to save title:', error)
		}
	}

	async function saveDescription() {
		try {
			await bugsStore.update(bug.id as number, { description: descriptionValue })
			bug = { ...bug, description: descriptionValue }
			editingDescription = false
		} catch (error) {
			console.error('Failed to save description:', error)
		}
	}

	async function handlePriorityChange(newPriority: BugType['priority']) {
		try {
			await bugsStore.update(bug.id as number, { priority: newPriority })
			bug = { ...bug, priority: newPriority }
		} catch (error) {
			console.error('Failed to change priority:', error)
		}
	}

	let editingCategory = $state(false)
	let categoryValue = $state(bug.category || '')

	const categoryOptions = ['Artists', 'Events', 'Events/Payroll', 'Facilities', 'Feature Request', 'Payroll', 'Programs', 'UI/UX']

	async function saveCategory() {
		try {
			await bugsStore.update(bug.id as number, { category: categoryValue })
			bug = { ...bug, category: categoryValue }
			editingCategory = false
		} catch (error) {
			console.error('Failed to save category:', error)
		}
	}

	function handleTestButton() {
		// Placeholder function for test button - UI only for now
		console.log('Test button clicked for bug:', bug.id)
	}

	function handleInitiateDevFix() {
		// Placeholder function for initiate dev fix button - UI only for now
		console.log('Initiate dev fix clicked for bug:', bug.id)
	}
