<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { ArrowLeft, Edit, Check, X, User, Calendar, Clock, Tag, AlertCircle } from 'lucide-svelte'
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
</script>

<ErrorBoundary>
	<div class="h-full flex flex-col min-h-0 bg-base-200/50">
		<!-- Header with Back Button -->
		<div class="bg-base-100 border-b border-base-300 flex-shrink-0">
			<div class="p-4">
				<button class="btn btn-sm btn-ghost gap-2" onclick={() => goto('/bugs')}>
					<ArrowLeft class="w-4 h-4" />
					Back to Issues
				</button>
			</div>
		</div>

		<!-- Main Content -->
		<div class="flex-1 flex gap-6 p-6 min-h-0 overflow-hidden">
			<!-- Left Column - Main Content -->
			<div class="flex-1 flex flex-col min-w-0 min-h-0">
				<!-- Title Card -->
				<div class="card bg-base-100 shadow-sm mb-4 flex-shrink-0">
					<div class="card-body p-6">
						{#if editingTitle}
							<div class="flex items-center gap-3">
								<input
									type="text"
									class="input input-bordered flex-1 text-2xl font-bold"
									bind:value={titleValue}
									onkeydown={(e) => {
										if (e.key === 'Enter') saveTitle()
										if (e.key === 'Escape') { editingTitle = false; titleValue = bug.title }
									}}
								/>
								<button class="btn btn-sm btn-success gap-2" onclick={saveTitle}>
									<Check class="w-4 h-4" />
									Save
								</button>
								<button class="btn btn-sm btn-ghost gap-2" onclick={() => { editingTitle = false; titleValue = bug.title }}>
									<X class="w-4 h-4" />
									Cancel
								</button>
							</div>
						{:else}
							<div class="flex items-start justify-between gap-4">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-3 mb-2">
										<span class="badge badge-lg badge-outline font-mono font-semibold">#{bug.id}</span>
										{#if bug.category}
											<span class="badge badge-lg badge-ghost">
												<Tag class="w-3 h-3 mr-1" />
												{bug.category}
											</span>
										{/if}
									</div>
									<h1 class="text-3xl font-bold leading-tight">{bug.title}</h1>
								</div>
								<button class="btn btn-sm btn-ghost gap-2 flex-shrink-0" onclick={() => editingTitle = true}>
									<Edit class="w-4 h-4" />
									Edit
								</button>
							</div>
						{/if}
					</div>
				</div>

				<!-- Tabs Content -->
				<div class="flex-1 min-h-0 flex flex-col">
					<BugDetailTabs
					bug={bug}
					activeTab={activeTab}
					onTabChange={(tab) => activeTab = tab}
					comments={data.comments}
					attachments={data.attachments}
					labels={data.labels}
					relations={data.relations}
					activity={data.activity}
					timeTracking={data.timeTracking}
					allLabels={data.allLabels}
					users={data.users}
					replicationScreenshots={data.replicationScreenshots}
					testingSessions={data.testingSessions || []}
					onDescriptionChange={async (desc) => {
						descriptionValue = desc
						await saveDescription()
					}}
				/>
				</div>
			</div>

			<!-- Right Sidebar - Metadata -->
			<div class="w-80 flex-shrink-0 flex flex-col gap-4">
			<!-- Status, Priority & Category Card -->
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body p-4">
					<h3 class="font-semibold text-sm uppercase tracking-wide text-base-content/60 mb-3">Status & Priority</h3>
					<div class="space-y-3">
						<div>
							<label class="text-xs font-medium text-base-content/60 mb-1 block">Status</label>
							<BugStatusChange bug={bug} onStatusChange={handleStatusChange} />
						</div>
						<div>
							<label class="text-xs font-medium text-base-content/60 mb-1 block">Priority</label>
							<select
								class="select select-bordered select-sm w-full"
								value={bug.priority}
								onchange={(e) => handlePriorityChange(e.currentTarget.value as BugType['priority'])}
							>
								<option value="low">Low</option>
								<option value="medium">Medium</option>
								<option value="high">High</option>
								<option value="critical">Critical</option>
							</select>
						</div>
						<div>
							<label class="text-xs font-medium text-base-content/60 mb-1 block">
								<Tag class="w-3 h-3 inline mr-1" />
								Category
							</label>
							{#if editingCategory}
								<div class="flex flex-col gap-2">
									<input
										type="text"
										class="input input-bordered input-sm w-full"
										bind:value={categoryValue}
										placeholder="e.g., Payroll, Events, UI/UX"
										list="category-options"
										onkeydown={(e) => {
											if (e.key === 'Enter') saveCategory()
											if (e.key === 'Escape') { editingCategory = false; categoryValue = bug.category || '' }
										}}
									/>
									<datalist id="category-options">
										{#each categoryOptions as cat}
											<option value={cat}></option>
										{/each}
									</datalist>
									<div class="flex gap-1">
										<button class="btn btn-xs btn-success flex-1" onclick={saveCategory}>Save</button>
										<button class="btn btn-xs btn-ghost flex-1" onclick={() => { editingCategory = false; categoryValue = bug.category || '' }}>Cancel</button>
									</div>
								</div>
							{:else}
								<button
									class="btn btn-sm btn-ghost w-full justify-start text-left font-normal"
									onclick={() => { categoryValue = bug.category || ''; editingCategory = true }}
								>
									{#if bug.category}
										<span class="badge badge-ghost badge-sm">{bug.category}</span>
									{:else}
										<span class="text-base-content/40 italic">No category</span>
									{/if}
								</button>
							{/if}
						</div>
					</div>
				</div>
			</div>

				<!-- People & Dates Card -->
				<div class="card bg-base-100 shadow-sm">
					<div class="card-body p-4">
						<h3 class="font-semibold text-sm uppercase tracking-wide text-base-content/60 mb-3">People & Dates</h3>
						<div class="space-y-3">
							<div>
								<label class="text-xs font-medium text-base-content/60 mb-1 flex items-center gap-1">
									<User class="w-3 h-3" />
									Assigned to
								</label>
								<BugAssigneeSelect bug={bug} users={data.users} onAssigneeChange={handleAssigneeChange} />
							</div>
							<div>
								<label class="text-xs font-medium text-base-content/60 mb-1 flex items-center gap-1">
									<User class="w-3 h-3" />
									Reported by
								</label>
								<div class="text-sm font-medium">
									{data.bug.profiles_reported?.full_name || 'Unknown'}
								</div>
							</div>
							<div>
								<label class="text-xs font-medium text-base-content/60 mb-1 flex items-center gap-1">
									<Clock class="w-3 h-3" />
									Created
								</label>
								<div class="text-sm">
									{formatDistanceToNow(new Date(bug.created_at || ''), { addSuffix: true })}
								</div>
							</div>
							{#if bug.updated_at && bug.updated_at !== bug.created_at}
								<div>
									<label class="text-xs font-medium text-base-content/60 mb-1 flex items-center gap-1">
										<Clock class="w-3 h-3" />
										Last updated
									</label>
									<div class="text-sm">
										{formatDistanceToNow(new Date(bug.updated_at), { addSuffix: true })}
									</div>
								</div>
							{/if}
							{#if bug.due_date}
								<div>
									<label class="text-xs font-medium text-base-content/60 mb-1 flex items-center gap-1">
										<Calendar class="w-3 h-3" />
										Due date
									</label>
									<div class="text-sm font-medium">
										{new Date(bug.due_date).toLocaleDateString('en-US', { 
											weekday: 'short', 
											year: 'numeric', 
											month: 'short', 
											day: 'numeric' 
										})}
									</div>
								</div>
							{/if}
							{#if bug.resolved_at}
								<div>
									<label class="text-xs font-medium text-base-content/60 mb-1 flex items-center gap-1">
										<Check class="w-3 h-3" />
										Resolved
									</label>
									<div class="text-sm">
										{formatDistanceToNow(new Date(bug.resolved_at), { addSuffix: true })}
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</ErrorBoundary>
