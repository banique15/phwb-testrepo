<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { env } from '$env/dynamic/public'
	import { ArrowLeft, Edit, Check, X, User, Calendar, Clock, Tag, AlertCircle, Wrench, Loader2 } from 'lucide-svelte'
	import { bugsStore } from '$lib/stores/bugs'
	import type { BugDetailPageData } from './+page.server'
	import type { Bug as BugType } from '$lib/schemas/bug'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import { formatDistanceToNow } from 'date-fns'
	import BugDetailTabs from './components/BugDetailTabs.svelte'

	function formatDistanceSafe(dateStr: string | null | undefined, fallback = '—'): string {
		if (dateStr == null || dateStr === '') return fallback
		const d = new Date(dateStr)
		if (Number.isNaN(d.getTime())) return fallback
		return formatDistanceToNow(d, { addSuffix: true })
	}
	import BugStatusChange from './components/BugStatusChange.svelte'
	import BugAssigneeSelect from './components/BugAssigneeSelect.svelte'

	// Ensure full URL: http(s)://host:port (default http://localhost:8000 in dev)
	function normalizeVoiceAgentUrl(raw: string | undefined): string {
		const s = (raw || '').trim()
		if (!s && import.meta.env.DEV) return 'http://localhost:8000'
		if (!s) return ''
		if (/^https?:\/\//i.test(s)) return s.replace(/\/+$/, '')
		const host = s.startsWith(':') ? 'localhost' + s : s.includes(':') ? s : 'localhost:' + s
		return 'http://' + host.replace(/^\/+/, '')
	}
	const VOICE_AGENT_URL = normalizeVoiceAgentUrl(env.PUBLIC_VOICE_AGENT_URL)

	interface Props {
		data: BugDetailPageData
	}

	let { data }: Props = $props()

	// Seed from server data so we don't flash "Loading..." when data is already available
	const initialBug = (): BugType | null => {
		const b = data?.bug
		return (b != null && typeof b === 'object' && 'id' in b && 'title' in b) ? (b as BugType) : null
	}
	let bug = $state<BugType | null>(initialBug())

	const validTabs = ['description', 'comments', 'attachments', 'activity', 'time', 'replication', 'testing'] as const
	type TabId = typeof validTabs[number]
	const initialTab = $page.url.searchParams.get('tab') as TabId | null
	let activeTab = $state<TabId>(initialTab && validTabs.includes(initialTab) ? initialTab : 'description')
	let skipUrlSyncCount = $state(0)

	// Keep activeTab in sync with URL (back/forward or direct link). Skip a couple of effect runs
	// after we change tab so we don't overwrite activeTab with the old URL before goto() has updated it.
	$effect(() => {
		if (skipUrlSyncCount > 0) {
			skipUrlSyncCount = skipUrlSyncCount - 1
			return
		}
		const tabParam = $page.url.searchParams.get('tab') as TabId | null
		if (tabParam && validTabs.includes(tabParam) && tabParam !== activeTab) {
			activeTab = tabParam
		}
	})
	let editingTitle = $state(false)
	let editingDescription = $state(false)
	let titleValue = $state(bug?.title ?? data?.bug?.title ?? '')
	let descriptionValue = $state(bug?.description ?? data?.bug?.description ?? '')

	// Keep bug in sync with server data (only when data.bug.id or updated_at changes)
	$effect(() => {
		const newBug = data?.bug as BugType | undefined
		if (!newBug) {
			bug = null
			return
		}
		const bugId = newBug.id
		const updatedAt = newBug.updated_at
		const current = bug
		if (!current || current.id !== bugId || current.updated_at !== updatedAt) {
			bug = newBug
			if (!editingTitle) titleValue = newBug.title
			if (!editingDescription) descriptionValue = newBug.description || ''
			if (!editingCategory) categoryValue = newBug.category || ''
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
		if (!bug) return
		try {
			await bugsStore.changeStatus(bug.id as number, newStatus)
			bug = { ...bug, status: newStatus }
		} catch (error) {
			console.error('Failed to change status:', error)
		}
	}

	async function handleAssigneeChange(userId: string | null) {
		if (!bug) return
		try {
			await bugsStore.assignBug(bug.id as number, userId)
			bug = { ...bug, assigned_to: userId }
		} catch (error) {
			console.error('Failed to assign bug:', error)
		}
	}

	async function saveTitle() {
		if (!bug) return
		try {
			await bugsStore.update(bug.id as number, { title: titleValue })
			bug = { ...bug, title: titleValue }
			editingTitle = false
		} catch (error) {
			console.error('Failed to save title:', error)
		}
	}

	async function saveDescription() {
		if (!bug) return
		try {
			await bugsStore.update(bug.id as number, { description: descriptionValue })
			bug = { ...bug, description: descriptionValue }
			editingDescription = false
		} catch (error) {
			console.error('Failed to save description:', error)
		}
	}

	async function handlePriorityChange(newPriority: BugType['priority']) {
		if (!bug) return
		try {
			await bugsStore.update(bug.id as number, { priority: newPriority })
			bug = { ...bug, priority: newPriority }
		} catch (error) {
			console.error('Failed to change priority:', error)
		}
	}

	let editingCategory = $state(false)
	let categoryValue = $state(bug?.category ?? data?.bug?.category ?? '')

	const categoryOptions = ['Artists', 'Events', 'Events/Payroll', 'Facilities', 'Feature Request', 'Payroll', 'Programs', 'UI/UX']

	async function saveCategory() {
		if (!bug) return
		try {
			await bugsStore.update(bug.id as number, { category: categoryValue })
			bug = { ...bug, category: categoryValue }
			editingCategory = false
		} catch (error) {
			console.error('Failed to save category:', error)
		}
	}

	// Dev Agent: Initiate dev fix (voiceaiagentv5)
	let devFixLoading = $state(false)
	let devFixError = $state<string | null>(null)
	let devFixWorkflowId = $state<string | null>(null)
	let agentLogs = $state<Array<{ id: number; step: string; message: string; level: string; created_at?: string }>>([])
	let clearLogsLoading = $state(false)

	// Poll phwb_dev_logs for this bug so Agent activity shows live logs
	$effect(() => {
		const bid = bug?.id
		if (bid == null) return
		let cancelled = false
		async function fetchLogs() {
			if (cancelled) return
			try {
				const res = await fetch(`/api/bugs/${bid}/dev-logs`)
				if (!res.ok || cancelled) return
				const data = await res.json()
				if (!cancelled && Array.isArray(data)) {
					agentLogs = data.map((row: { id: number; step: string; message: string; level: string; created_at?: string }) => ({
						id: row.id,
						step: row.step ?? '',
						message: row.message ?? '',
						level: row.level ?? 'info',
						created_at: row.created_at
					}))
				}
			} catch {
				// ignore
			}
		}
		fetchLogs()
		const interval = setInterval(fetchLogs, 2000)
		return () => {
			cancelled = true
			clearInterval(interval)
		}
	})

	async function clearAgentLogs() {
		const bid = bug?.id
		if (bid == null) return
		clearLogsLoading = true
		try {
			const res = await fetch(`/api/bugs/${bid}/dev-logs`, { method: 'DELETE' })
			if (res.ok) agentLogs = []
		} catch {
			// ignore
		} finally {
			clearLogsLoading = false
		}
	}

	async function initiateDevFix() {
		if (!bug || !VOICE_AGENT_URL) return
		devFixLoading = true
		devFixError = null
		devFixWorkflowId = null
		try {
			const base = VOICE_AGENT_URL.replace(/\/$/, '')
			const res = await fetch(`${base}/api/dev/fix`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: bug.id,
					title: bug.title,
					description: bug.description ?? '',
					category: bug.category ?? '',
					status: bug.status
				})
			})
			const json = await res.json().catch(() => ({}))
			if (!res.ok) {
				devFixError = json.detail ?? json.error ?? `Request failed (${res.status})`
				return
			}
			devFixWorkflowId = json.workflow_id ?? null
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Failed to start dev fix'
			const isConnectionRefused =
				/failed to fetch|connection refused|ERR_CONNECTION_REFUSED|NetworkError/i.test(msg) || msg === 'Failed to fetch'
			devFixError = isConnectionRefused
				? `Cannot reach the dev fix backend at ${VOICE_AGENT_URL}. Is voiceaiagentv5 running? (Start it and ensure Temporal is running too.)`
				: msg
		} finally {
			devFixLoading = false
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

		{#if !bug}
			<div class="flex-1 flex items-center justify-center p-8">
				<div class="text-center text-base-content/70">
					<p class="mb-4">Loading bug details…</p>
					<button class="btn btn-sm btn-ghost" onclick={() => goto('/bugs')}>Back to Issues</button>
				</div>
			</div>
		{:else}
		{@const b = bug}
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
										if (e.key === 'Escape') { editingTitle = false; titleValue = b.title }
									}}
								/>
								<button class="btn btn-sm btn-success gap-2" onclick={saveTitle}>
									<Check class="w-4 h-4" />
									Save
								</button>
								<button class="btn btn-sm btn-ghost gap-2" onclick={() => { editingTitle = false; titleValue = b.title }}>
									<X class="w-4 h-4" />
									Cancel
								</button>
							</div>
						{:else}
							<div class="flex items-start justify-between gap-4">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-3 mb-2">
										<span class="badge badge-lg badge-outline font-mono font-semibold">#{b.id}</span>
										{#if b.category}
											<span class="badge badge-lg badge-ghost">
												<Tag class="w-3 h-3 mr-1" />
												{b.category}
											</span>
										{/if}
									</div>
									<h1 class="text-3xl font-bold leading-tight">{b.title}</h1>
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
					bug={b}
					activeTab={activeTab}
					onTabChange={(tab) => {
					activeTab = tab
					skipUrlSyncCount = 2
					// Update URL without re-running load (avoids 500 on /bugs/id?tab=comments)
					goto(`${$page.url.pathname}?tab=${tab}`, {
						replaceState: true,
						keepFocus: true,
						invalidateAll: false
					})
				}}
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

			<!-- Right Sidebar - Metadata (scroll when tall; avoids clipping Dev Agent / logs) -->
			<div class="w-80 flex-shrink-0 flex flex-col gap-4 min-h-0 overflow-y-auto overscroll-y-contain pr-1">
			<!-- Status, Priority & Category Card -->
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body p-4">
					<h3 class="font-semibold text-sm uppercase tracking-wide text-base-content/60 mb-3">Status & Priority</h3>
					<div class="space-y-3">
						<div>
							<label class="text-xs font-medium text-base-content/60 mb-1 block">Status</label>
							<BugStatusChange bug={b} onStatusChange={handleStatusChange} />
						</div>
						<div>
							<label class="text-xs font-medium text-base-content/60 mb-1 block">Priority</label>
							<select
								class="select select-bordered select-sm w-full"
								value={b.priority}
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
											if (e.key === 'Escape') { editingCategory = false; categoryValue = b.category || '' }
										}}
									/>
									<datalist id="category-options">
										{#each categoryOptions as cat}
											<option value={cat}></option>
										{/each}
									</datalist>
									<div class="flex gap-1">
										<button class="btn btn-xs btn-success flex-1" onclick={saveCategory}>Save</button>
										<button class="btn btn-xs btn-ghost flex-1" onclick={() => { editingCategory = false; categoryValue = b.category || '' }}>Cancel</button>
									</div>
								</div>
							{:else}
								<button
									class="btn btn-sm btn-ghost w-full justify-start text-left font-normal"
									onclick={() => { categoryValue = b.category || ''; editingCategory = true }}
								>
									{#if b.category}
										<span class="badge badge-ghost badge-sm">{b.category}</span>
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
								<BugAssigneeSelect bug={b} users={data.users} onAssigneeChange={handleAssigneeChange} />
							</div>
							<div>
								<label class="text-xs font-medium text-base-content/60 mb-1 flex items-center gap-1">
									<User class="w-3 h-3" />
									Reported by
								</label>
								<div class="text-sm font-medium">
									{data?.bug?.profiles_reported?.full_name || 'Unknown'}
								</div>
							</div>
							<div>
								<label class="text-xs font-medium text-base-content/60 mb-1 flex items-center gap-1">
									<Clock class="w-3 h-3" />
									Created
								</label>
								<div class="text-sm">
									{formatDistanceSafe(b.created_at)}
								</div>
							</div>
							{#if b.updated_at && b.updated_at !== b.created_at}
								<div>
									<label class="text-xs font-medium text-base-content/60 mb-1 flex items-center gap-1">
										<Clock class="w-3 h-3" />
										Last updated
									</label>
									<div class="text-sm">
										{formatDistanceSafe(b.updated_at)}
									</div>
								</div>
							{/if}
							{#if b.due_date}
								<div>
									<label class="text-xs font-medium text-base-content/60 mb-1 flex items-center gap-1">
										<Calendar class="w-3 h-3" />
										Due date
									</label>
									<div class="text-sm font-medium">
										{new Date(b.due_date).toLocaleDateString('en-US', { 
											weekday: 'short', 
											year: 'numeric', 
											month: 'short', 
											day: 'numeric' 
										})}
									</div>
								</div>
							{/if}
							{#if b.resolved_at}
								<div>
									<label class="text-xs font-medium text-base-content/60 mb-1 flex items-center gap-1">
										<Check class="w-3 h-3" />
										Resolved
									</label>
									<div class="text-sm">
										{formatDistanceSafe(b.resolved_at)}
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Dev Agent: Initiate dev fix + live logs -->
				<div class="card bg-base-100 shadow-sm flex flex-col flex-shrink-0">
					<div class="card-body p-4 flex flex-col">
						<h3 class="font-semibold text-sm uppercase tracking-wide text-base-content/60 mb-3 flex items-center gap-2">
							<Wrench class="w-4 h-4" />
							Dev Agent
						</h3>
						<div class="flex flex-col gap-3 flex-shrink-0">
							<button
								type="button"
								class="btn btn-primary btn-sm w-full gap-2"
								onclick={initiateDevFix}
								disabled={devFixLoading || !VOICE_AGENT_URL}
								title={!VOICE_AGENT_URL ? 'Set PUBLIC_VOICE_AGENT_URL (e.g. http://localhost:8000) to enable' : ''}
							>
								{#if devFixLoading}
									<Loader2 class="w-4 h-4 animate-spin" />
									Starting…
								{:else}
									<Wrench class="w-4 h-4" />
									Initiate dev fix
								{/if}
							</button>
							{#if devFixError}
								<div class="alert alert-error text-xs py-2">
									<span>{devFixError}</span>
								</div>
							{/if}
							{#if devFixWorkflowId}
								<p class="text-xs text-success">Workflow started: <span class="font-mono truncate block">{devFixWorkflowId}</span></p>
							{/if}
						</div>
						<!-- Live logs: placeholder for phwb_dev_logs integration -->
						<div class="mt-3 flex flex-col border border-base-300 rounded-lg overflow-hidden">
							<div class="bg-base-200/60 px-2 py-1.5 text-xs font-medium text-base-content/60 border-b border-base-300 flex items-center justify-between gap-2 flex-shrink-0">
								<span>Agent activity</span>
								<button
									type="button"
									class="btn btn-ghost btn-xs"
									onclick={clearAgentLogs}
									disabled={clearLogsLoading || agentLogs.length === 0}
									title="Clear logs for this issue"
								>
									{#if clearLogsLoading}
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										Clear logs
									{/if}
								</button>
							</div>
							<div class="overflow-y-auto min-h-48 max-h-[min(75vh,32rem)] p-2 bg-base-200/30 font-mono text-xs whitespace-pre-wrap wrap-break-word">
								{#if agentLogs.length === 0}
									<p class="text-base-content/50 italic">Live logs will appear here when a fix is running.</p>
								{:else}
									{#each agentLogs as log (log.id)}
										<div class="py-0.5 border-b border-base-300/50 last:border-0" class:text-error={log.level === 'error'} class:text-warning={log.level === 'warning'}>
											<span class="text-base-content/60">{log.step}</span>
											<span>{log.message}</span>
										</div>
									{/each}
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		{/if}
	</div>
</ErrorBoundary>
