<script lang="ts">
	import { goto } from '$app/navigation'
	import { env } from '$env/dynamic/public'
	import { Wrench, Loader2, ArrowLeft, RefreshCw, PlusCircle } from 'lucide-svelte'

	// Ensure full URL: http(s)://host:port (default http://localhost:8000 in dev)
	function normalizeVoiceAgentUrl(raw: string | undefined): string {
		const s = (raw || '').trim()
		if (!s && import.meta.env.DEV) return 'http://localhost:8000'
		if (!s) return ''
		if (/^https?:\/\//i.test(s)) return s.replace(/\/+$/, '')
		// e.g. "localhost:8000" or ":8000" or "8000"
		const host = s.startsWith(':') ? 'localhost' + s : s.includes(':') ? s : 'localhost:' + s
		return 'http://' + host.replace(/^\/+/, '')
	}
	const VOICE_AGENT_URL = normalizeVoiceAgentUrl(env.PUBLIC_VOICE_AGENT_URL)

	let bugId = $state<string>('')
	let title = $state('Test bug: fix button styling')
	let description = $state('The Initiate dev fix button should show loading state when clicked.')
	let category = $state('UI/UX')
	let status = $state('new')

	let loadLoading = $state(false)
	let loadError = $state<string | null>(null)
	let devFixLoading = $state(false)
	let devFixError = $state<string | null>(null)
	let devFixWorkflowId = $state<string | null>(null)
	let devFixCompleted = $state(false) // true after request finishes (success or error)
	let agentLogs = $state<Array<{ id: number; step: string; message: string; level: string }>>([])
	let seedLoading = $state(false)
	let seedError = $state<string | null>(null)
	let seedCreatedId = $state<number | null>(null)

	const categories = ['Artists', 'Events', 'Events/Payroll', 'Facilities', 'Feature Request', 'Payroll', 'Programs', 'UI/UX']
	const statuses = ['new', 'planning', 'in_progress', 'testing', 'review', 'resolved', 'closed'] as const

	async function loadBug() {
		const id = parseInt(String(bugId ?? '').trim(), 10)
		if (isNaN(id) || id < 1) {
			loadError = 'Enter a valid bug ID (number)'
			return
		}
		loadLoading = true
		loadError = null
		try {
			const res = await fetch(`/api/bugs/${id}`)
			if (!res.ok) {
				const err = await res.json().catch(() => ({}))
				loadError = err.message || `Failed to load bug (${res.status})`
				return
			}
			const bug = await res.json()
			bugId = String(bug.id)
			title = bug.title ?? ''
			description = bug.description ?? ''
			category = bug.category ?? 'UI/UX'
			status = (bug.status ?? 'new') as typeof statuses[number]
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load bug'
		} finally {
			loadLoading = false
		}
	}

	async function initiateDevFix() {
		const id = parseInt(String(bugId ?? '').trim(), 10)
		if (isNaN(id) || id < 1) {
			devFixError = 'Enter a valid bug ID'
			return
		}
		if (!VOICE_AGENT_URL) {
			devFixError = 'PUBLIC_VOICE_AGENT_URL not set (e.g. http://localhost:8000)'
			return
		}
		devFixLoading = true
		devFixError = null
		devFixWorkflowId = null
		devFixCompleted = false
		agentLogs = []
		try {
			const base = VOICE_AGENT_URL.replace(/\/$/, '')
			const res = await fetch(`${base}/api/dev/fix`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id,
					title: String(title ?? '').trim() || 'Test bug',
					description: String(description ?? '').trim() || '',
					category: String(category ?? '').trim() || 'UI/UX',
					status: status
				})
			})
			const json = await res.json().catch(() => ({}))
			if (!res.ok) {
				devFixError = json.detail ?? json.error ?? `Request failed (${res.status})`
				return
			}
			devFixWorkflowId = json.workflow_id ?? null
			agentLogs = [] // Live logs filled by polling /api/bugs/:id/dev-logs
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Failed to start dev fix'
			const isConnectionRefused =
				/failed to fetch|connection refused|ERR_CONNECTION_REFUSED|NetworkError/i.test(msg) || msg === 'Failed to fetch'
			devFixError = isConnectionRefused
				? `Cannot reach the dev fix backend at ${VOICE_AGENT_URL}. Is voiceaiagentv5 running? (Start it and ensure Temporal is running too.)`
				: msg
		} finally {
			devFixLoading = false
			devFixCompleted = true
		}
	}

	// Poll phwb_dev_logs for the current bug so Agent activity shows live logs
	$effect(() => {
		const id = parseInt(String(bugId ?? '').trim(), 10)
		if (isNaN(id) || id < 1) return
		let cancelled = false
		async function fetchLogs() {
			if (cancelled) return
			try {
				const res = await fetch(`/api/bugs/${id}/dev-logs`)
				if (!res.ok || cancelled) return
				const data = await res.json()
				if (!cancelled && Array.isArray(data)) {
					agentLogs = data.map((row: { id: number; step: string; message: string; level: string }) => ({
						id: row.id,
						step: row.step ?? '',
						message: row.message ?? '',
						level: row.level ?? 'info'
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

	let clearLogsLoading = $state(false)
	async function clearAgentLogs() {
		const id = parseInt(String(bugId ?? '').trim(), 10)
		if (isNaN(id) || id < 1) return
		clearLogsLoading = true
		try {
			const res = await fetch(`/api/bugs/${id}/dev-logs`, { method: 'DELETE' })
			if (res.ok) agentLogs = []
		} catch {
			// ignore
		} finally {
			clearLogsLoading = false
		}
	}

	async function createTestIssue() {
		seedLoading = true
		seedError = null
		seedCreatedId = null
		try {
			const res = await fetch('/api/bugs/seed-test', { method: 'POST' })
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				seedError = data.message || `Failed (${res.status})`
				return
			}
			const id = data.bug?.id
			if (id != null) {
				seedCreatedId = id
				bugId = String(id)
				await loadBug()
			}
		} catch (e) {
			seedError = e instanceof Error ? e.message : 'Failed to create test issue'
		} finally {
			seedLoading = false
		}
	}

	function resetForm() {
		bugId = ''
		title = 'Test bug: fix button styling'
		description = 'The Initiate dev fix button should show loading state when clicked.'
		category = 'UI/UX'
		status = 'new'
		loadError = null
		seedError = null
		seedCreatedId = null
		devFixError = null
		devFixWorkflowId = null
		devFixCompleted = false
		agentLogs = []
	}
</script>

<div class="h-full min-h-0 overflow-y-auto bg-base-200/50 p-6">
	<div class="max-w-2xl mx-auto">
		<div class="flex items-center gap-4 mb-6">
			<button class="btn btn-ghost btn-sm gap-2" onclick={() => goto('/bugs')}>
				<ArrowLeft class="w-4 h-4" />
				Back to Issues
			</button>
		</div>
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h1 class="card-title text-2xl gap-2">
					<Wrench class="w-8 h-8" />
					Dev fix – edit issue test simulation
				</h1>
				<p class="text-base-content/70 text-sm">
					Simulate editing an issue and trigger Initiate dev fix. Load an existing bug by ID or edit fields, then run the workflow.
				</p>

				<!-- Quick start: create test issue -->
				<div class="rounded-lg bg-primary/10 border border-primary/20 p-4 mb-4">
					<p class="text-sm font-medium text-base-content/80 mb-2">Try the full flow</p>
					<p class="text-xs text-base-content/60 mb-3">
						Create a test issue in the database, then open it and use &quot;Initiate dev fix&quot; on the bug detail page. When the workflow completes, check the <strong>Comments</strong> tab for the PR link.
					</p>
					<div class="flex flex-wrap items-center gap-2">
						<button
							type="button"
							class="btn btn-primary btn-sm gap-2"
							onclick={createTestIssue}
							disabled={seedLoading}
						>
							{#if seedLoading}
								<Loader2 class="w-4 h-4 animate-spin" />
							{:else}
								<PlusCircle class="w-4 h-4" />
							{/if}
							Create test issue
						</button>
						{#if seedCreatedId != null}
							<a href="/bugs/{seedCreatedId}" class="btn btn-outline btn-sm">Open issue #{seedCreatedId} →</a>
						{/if}
					</div>
					{#if seedError}
						<p class="text-error text-sm mt-2">{seedError}</p>
					{/if}
				</div>

				<!-- Load bug by ID -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Load existing bug</span>
					</label>
					<div class="flex gap-2">
						<input
							type="number"
							class="input input-bordered flex-1"
							placeholder="Bug ID (e.g. 1)"
							min="1"
							bind:value={bugId}
						/>
						<button
							type="button"
							class="btn btn-outline gap-2"
							onclick={loadBug}
							disabled={loadLoading}
						>
							{#if loadLoading}
								<Loader2 class="w-4 h-4 animate-spin" />
							{:else}
								<RefreshCw class="w-4 h-4" />
							{/if}
							Load bug
						</button>
					</div>
					{#if loadError}
						<p class="text-error text-sm mt-1">{loadError}</p>
					{/if}
				</div>

				<div class="divider text-xs">Edit issue (payload for dev fix)</div>

				<!-- Edit issue form -->
				<div class="space-y-4">
					<div class="form-control">
						<label class="label" for="sim-bug-id"><span class="label-text">Bug ID</span></label>
						<input id="sim-bug-id" type="number" class="input input-bordered" min="1" bind:value={bugId} />
					</div>
					<div class="form-control">
						<label class="label" for="sim-title"><span class="label-text">Title</span></label>
						<input id="sim-title" type="text" class="input input-bordered" bind:value={title} placeholder="Bug title" />
					</div>
					<div class="form-control">
						<label class="label" for="sim-description"><span class="label-text">Description</span></label>
						<textarea id="sim-description" class="textarea textarea-bordered h-24" bind:value={description} placeholder="Bug description"></textarea>
					</div>
					<div class="form-control">
						<label class="label" for="sim-category"><span class="label-text">Category</span></label>
						<select id="sim-category" class="select select-bordered" bind:value={category}>
							{#each categories as c}
								<option value={c}>{c}</option>
							{/each}
						</select>
					</div>
					<div class="form-control">
						<label class="label" for="sim-status"><span class="label-text">Status</span></label>
						<select id="sim-status" class="select select-bordered" bind:value={status}>
							{#each statuses as s}
								<option value={s}>{s}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="flex gap-2 mt-4">
					<button
						type="button"
						class="btn btn-primary gap-2"
						onclick={initiateDevFix}
						disabled={devFixLoading || !VOICE_AGENT_URL}
						title={!VOICE_AGENT_URL ? 'Set PUBLIC_VOICE_AGENT_URL' : ''}
					>
						{#if devFixLoading}
							<Loader2 class="w-4 h-4 animate-spin" />
							Starting workflow…
						{:else}
							<Wrench class="w-4 h-4" />
							Initiate dev fix
						{/if}
					</button>
					<button type="button" class="btn btn-ghost" onclick={resetForm}>Reset form</button>
				</div>

				{#if devFixError}
					<div class="alert alert-error mt-4" data-testid="dev-fix-error">
						<span>{devFixError}</span>
					</div>
				{/if}
				{#if devFixWorkflowId}
					<div class="alert alert-success mt-4" data-testid="dev-fix-success">
						<span>Workflow started: <code class="text-xs">{devFixWorkflowId}</code></span>
					</div>
				{/if}
				{#if devFixCompleted && !devFixError && !devFixWorkflowId}
					<div class="alert alert-info mt-4" data-testid="dev-fix-result">
						<span>Request completed but no workflow ID returned. Backend may need configuration.</span>
					</div>
				{/if}

				<!-- Agent activity (placeholder) -->
				<div class="mt-6 border border-base-300 rounded-lg overflow-hidden">
					<div class="bg-base-200/60 px-3 py-2 text-sm font-medium text-base-content/70 border-b border-base-300 flex items-center justify-between gap-2">
						<span>Agent activity</span>
						<button
							type="button"
							class="btn btn-ghost btn-xs"
							onclick={clearAgentLogs}
							disabled={clearLogsLoading || agentLogs.length === 0 || !bugId?.trim()}
							title="Clear logs for this issue"
						>
							{#if clearLogsLoading}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								Clear logs
							{/if}
						</button>
					</div>
					<div class="p-3 font-mono text-xs bg-base-200/30 min-h-[80px] max-h-40 overflow-y-auto">
						{#if agentLogs.length === 0}
							<p class="text-base-content/50 italic">Enter a bug ID and run Initiate dev fix to see live activity here.</p>
						{:else}
							{#each agentLogs as log (log.id)}
								<div class="py-1 border-b border-base-300/50 last:border-0" class:text-error={log.level === 'error'} class:text-warning={log.level === 'warning'}>
									<span class="text-base-content/60">[{log.step}]</span> {log.message}
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
