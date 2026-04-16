<script lang="ts">
	import { goto } from '$app/navigation'
	import { browser } from '$app/environment'
	import { page } from '$app/stores'
	import { env } from '$env/dynamic/public'
	import { ArrowLeft, Edit, Check, X, User, Calendar, Clock, Tag, AlertCircle, Wrench, Loader2 } from 'lucide-svelte'
	import { bugsStore } from '$lib/stores/bugs'
	import type { BugDetailPageData } from './+page.server'
	import type { Bug as BugType } from '$lib/schemas/bug'
	import type { BugComment } from '$lib/schemas/bug-comment'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import { formatDistanceToNow } from 'date-fns'
	import BugDetailTabs from './components/BugDetailTabs.svelte'

	function formatDistanceSafe(dateStr: string | null | undefined, fallback = '—'): string {
		if (dateStr == null || dateStr === '') return fallback
		const d = new Date(dateStr)
		if (Number.isNaN(d.getTime())) return fallback
		return formatDistanceToNow(d, { addSuffix: true })
	}
	function formatDateSafe(dateStr: string | null | undefined, fallback = '—'): string {
		if (dateStr == null || dateStr === '') return fallback
		const d = new Date(dateStr)
		if (Number.isNaN(d.getTime())) return fallback
		return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
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
	let commentsData = $state<Array<BugComment & { profiles?: { full_name: string | null; avatar_url: string | null } | null }>>(
		Array.isArray(data?.comments) ? data.comments : []
	)

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
	$effect(() => {
		const incomingComments = data?.comments
		if (!Array.isArray(incomingComments)) return
		const currentLen = commentsData.length
		if (incomingComments.length !== currentLen) {
			commentsData = incomingComments
		}
	})

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
	let agentLogs = $state<Array<{ id: number; step: string; message: string; level: string; created_at?: string; workflow_id?: string | null }>>([])
	let clearLogsLoading = $state(false)
	let stagingFeedbackLoading = $state(false)
	let stagingFeedbackError = $state<string | null>(null)
	let stagingFeedbackNote = $state('')
	let migrationPreviewLoading = $state(false)
	let migrationPreviewError = $state<string | null>(null)
	let migrationPreview = $state<{
		bug_id: number
		workflow_id?: string | null
		db_changes_detected: boolean
		requires_db_confirmation: boolean
		branch_name?: string | null
		migration_files: string[]
		summaries: Array<{
			file: string
			summary?: { operations?: string[]; touched_tables?: string[]; risk_tags?: string[] }
			error?: string | null
		}>
		warnings?: string[]
	} | null>(null)
	let migrationApplyLoading = $state(false)
	let migrationApplyError = $state<string | null>(null)
	let migrationApplyResult = $state<{
		success: boolean
		applied: Array<{ file: string }>
		failed: Array<{ file: string; error?: string }>
		warnings?: string[]
	} | null>(null)
	let previewFetchedKey = $state<string | null>(null)
	let autoApplyPromptedKey = $state<string | null>(null)
	let autoClarificationPromptedKey = $state<string | null>(null)
	let applyConfirmModal = $state<HTMLDialogElement | null>(null)
	let clarificationModal = $state<HTMLDialogElement | null>(null)
	let dismissedClarificationKeys = $state<Record<string, true>>({})
	let dismissedDbPromptKeys = $state<Record<string, true>>({})
	let sessionPromptStateLoaded = $state(false)
	let clarificationSubmitting = $state(false)
	let clarificationSubmitError = $state<string | null>(null)
	let clarificationSubmitSuccess = $state<string | null>(null)
	let clarificationSelections = $state<Record<string, string>>({})
	let clarificationImageFile = $state<File | null>(null)
	let clarificationImageUploadLoading = $state(false)
	let clarificationImageUploadError = $state<string | null>(null)
	let clarificationImageUploadedName = $state<string | null>(null)
	let clarificationImageUploadedAttachmentId = $state<number | null>(null)
	let clarificationReferenceAttachmentId = $state<number | null>(null)

	type WorkflowState =
		| 'awaiting_clarification'
		| 'code_complete_db_pending'
		| 'staging_ready'
		| 'staging_ready_db_pending'
		| 'staging_validated'
		| 'staging_rejected'
		| 'ready_for_pr'
		| 'fully_complete'
	const workflowStateMeta: Record<WorkflowState, { label: string; badgeClass: string }> = {
		awaiting_clarification: { label: 'Awaiting clarification', badgeClass: 'badge-warning' },
		code_complete_db_pending: { label: 'Code complete - DB pending', badgeClass: 'badge-warning' },
		staging_ready: { label: 'Staging ready', badgeClass: 'badge-info' },
		staging_ready_db_pending: { label: 'Staging ready - DB pending', badgeClass: 'badge-warning' },
		staging_validated: { label: 'Staging validated', badgeClass: 'badge-success' },
		staging_rejected: { label: 'Staging rejected', badgeClass: 'badge-error' },
		ready_for_pr: { label: 'Ready for PR', badgeClass: 'badge-accent' },
		fully_complete: { label: 'Fully complete', badgeClass: 'badge-success' }
	}
	const stagingChecklistItems = [
		{ id: 'load', label: 'Page loads and the target flow is accessible.' },
		{ id: 'behavior', label: 'Requested behavior works as expected on staging.' },
		{ id: 'regression', label: 'No obvious regressions in nearby workflow.' },
		{ id: 'data', label: 'Data/save behavior looks correct after refresh.' }
	] as const
	let stagingChecklistState = $state<Record<string, boolean>>(
		Object.fromEntries(stagingChecklistItems.map((item) => [item.id, false]))
	)

	function extractWorkflowState(message: string | undefined): WorkflowState | null {
		if (!message) return null
		const m = message.match(/`([^`]+)`/)
		if (!m?.[1]) return null
		const state = m[1] as WorkflowState
		return state in workflowStateMeta ? state : null
	}

	function extractFirstUrl(message: string | undefined): string | null {
		if (!message) return null
		const m = message.match(/https?:\/\/[^\s)>"']+/)
		return m?.[0] ?? null
	}
	function latestLogMessage(step: string, predicate?: (message: string) => boolean): string | null {
		for (let i = agentLogs.length - 1; i >= 0; i--) {
			const row = agentLogs[i]
			if (row?.step !== step) continue
			const msg = row?.message ?? ''
			if (!predicate || predicate(msg)) return msg
		}
		return null
	}

	const workflowStateLogs = $derived(agentLogs.filter((log) => log.step === 'workflow_state'))
	const currentWorkflowState = $derived.by<WorkflowState | null>(() => {
		for (let i = workflowStateLogs.length - 1; i >= 0; i--) {
			const parsed = extractWorkflowState(workflowStateLogs[i]?.message)
			if (parsed) return parsed
		}
		return null
	})
	const currentWorkflowStateMessage = $derived.by<string | null>(() => {
		for (let i = workflowStateLogs.length - 1; i >= 0; i--) {
			const msg = workflowStateLogs[i]?.message
			if (extractWorkflowState(msg)) return msg ?? null
		}
		return null
	})
	const currentStagingUrl = $derived.by<string | null>(() => {
		for (let i = workflowStateLogs.length - 1; i >= 0; i--) {
			const url = extractFirstUrl(workflowStateLogs[i]?.message)
			if (url) return url
		}
		return null
	})
	const currentWorkflowId = $derived.by<string | null>(() => {
		for (let i = agentLogs.length - 1; i >= 0; i--) {
			const wid = agentLogs[i]?.workflow_id
			if (wid) return wid
		}
		return devFixWorkflowId
	})
	const canMarkStagingValidated = $derived(
		currentWorkflowState === 'staging_ready' || currentWorkflowState === 'staging_ready_db_pending'
	)
	const checklistComplete = $derived(stagingChecklistItems.every((item) => stagingChecklistState[item.id]))
	const isDbPendingState = $derived(
		currentWorkflowState === 'code_complete_db_pending' || currentWorkflowState === 'staging_ready_db_pending'
	)
	const contractIndicatesDb = $derived.by<boolean>(() => {
		const msg = latestContractMessage ?? ''
		return msg.includes('migration_required=yes') || evidenceImpactedLayers.includes('DB')
	})
	const verifyDetectedDbChanges = $derived.by<boolean>(() => {
		const msg = latestLogMessage('verify_fix', (m) => m.includes('DB change metadata:'))
		if (!msg) return false
		return msg.includes('db_changes_detected=true')
	})
	const showDbConfirmationPanel = $derived(
		isDbPendingState || contractIndicatesDb || verifyDetectedDbChanges || Boolean(migrationPreview?.db_changes_detected)
	)
	const latestContractMessage = $derived.by<string | null>(() =>
		latestLogMessage('analyze_and_code', (m) => m.includes('Implementation contract:'))
	)
	const evidenceImpactedLayers = $derived.by<string[]>(() => {
		const msg = latestContractMessage
		if (!msg) return []
		const m = msg.match(/layers=([^|]+)(?:\||$)/)
		if (!m?.[1]) return []
		return m[1]
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
	})
	const evidenceVerifyMode = $derived.by<string | null>(() => {
		const msg = latestLogMessage('verify_fix', (m) => m.includes('Verify mode:'))
		if (!msg) return null
		const m = msg.match(/Verify mode:\s*`([^`]+)`/)
		return m?.[1] ?? null
	})
	const evidenceMigrationStatus = $derived.by<string>(() => {
		if (currentWorkflowState === 'code_complete_db_pending' || currentWorkflowState === 'staging_ready_db_pending') {
			return 'pending_apply'
		}
		if (migrationApplyResult) {
			return migrationApplyResult.success ? 'applied_success' : 'apply_failed'
		}
		const dbApplyMsg = latestLogMessage('db_apply')
		if (dbApplyMsg?.includes('✅ DB apply completed')) return 'applied_success'
		if (dbApplyMsg?.includes('❌ DB apply completed with failures')) return 'apply_failed'
		if (migrationPreview?.db_changes_detected) return 'detected_not_applied'
		return 'not_required_or_unknown'
	})
	const evidenceStagingValidation = $derived.by<string>(() => {
		if (currentWorkflowState === 'staging_validated') return 'validated'
		if (currentWorkflowState === 'staging_rejected') return 'rejected'
		if (currentWorkflowState === 'staging_ready' || currentWorkflowState === 'staging_ready_db_pending') {
			return 'awaiting_validation'
		}
		return 'n/a'
	})
	const shouldOfferAutoApply = $derived.by<boolean>(() => {
		if (!showDbConfirmationPanel) return false
		if (!migrationPreview?.db_changes_detected) return false
		if (migrationApplyLoading) return false
		if (migrationApplyResult?.success) return false
		const status = evidenceMigrationStatus
		return status === 'pending_apply' || status === 'detected_not_applied' || status === 'apply_failed'
	})
	const clarificationWorkflowKey = $derived.by<string>(() => {
		const bid = bug?.id ?? 'no-bug'
		const wid = currentWorkflowId ?? 'no-workflow'
		return `${bid}:${wid}`
	})
	const currentDbAutoPromptKey = $derived.by<string | null>(() => {
		const bid = bug?.id
		if (bid == null) return null
		const workflowKey = currentWorkflowId ?? 'no-workflow'
		const migrationKey = (migrationPreview?.migration_files || []).join(',')
		return `${bid}:${workflowKey}:${migrationKey}`
	})
	type ClarificationQuestion = {
		id: string
		prompt: string
		options: string[]
	}
	type ClarificationFormPayload = {
		questions: ClarificationQuestion[]
		required_answers?: number
	}
	function parseClarificationFormPayload(message: string | null): ClarificationFormPayload | null {
		if (!message) return null
		const marker = 'CLARIFICATION_FORM_JSON:'
		const idx = message.indexOf(marker)
		if (idx < 0) return null
		const raw = message.slice(idx + marker.length).trim()
		try {
			const parsed = JSON.parse(raw)
			if (!Array.isArray(parsed?.questions)) return null
			return {
				questions: parsed.questions
					.filter((q: unknown) => {
						const candidate = q as { id?: unknown; prompt?: unknown; options?: unknown }
						return typeof candidate.id === 'string' && typeof candidate.prompt === 'string' && Array.isArray(candidate.options)
					})
					.map((q: { id: string; prompt: string; options: string[] }) => ({
						id: q.id,
						prompt: q.prompt,
						options: q.options.slice(0, 3).map((opt) => String(opt))
					})),
				required_answers:
					typeof parsed?.required_answers === 'number' && parsed.required_answers > 0
						? parsed.required_answers
						: undefined
			}
		} catch {
			return null
		}
	}
	const clarificationForm = $derived.by<ClarificationFormPayload | null>(() => {
		const msg = latestLogMessage('clarify_ticket', (m) => m.includes('CLARIFICATION_FORM_JSON:'))
		return parseClarificationFormPayload(msg)
	})
	const clarificationQuestions = $derived.by<ClarificationQuestion[]>(() => clarificationForm?.questions || [])
	const clarificationRequiredAnswers = $derived.by<number>(() => clarificationForm?.required_answers ?? clarificationQuestions.length)
	const hasBugAttachments = $derived((data.attachments?.length ?? 0) > 0)
	const bugAttachmentNames = $derived((data.attachments || []).map((a) => a.file_name).filter(Boolean))
	const attachmentReferenceOptions = $derived(
		(data.attachments || []).map((a) => ({
			id: Number(a.id),
			file_name: a.file_name || `attachment-${a.id}`,
			mime_type: a.mime_type || ''
		}))
	)
	const selectedImageReferenceMode = $derived(clarificationSelections['image_reference'] ?? '')
	const shouldShowImageUploadHelper = $derived.by<boolean>(() => {
		if (selectedImageReferenceMode.startsWith('Upload a new image reference')) return true
		if (selectedImageReferenceMode.startsWith('Use existing bug attachments as the reference') && !hasBugAttachments) {
			return true
		}
		return false
	})
	const clarificationAllAnswered = $derived.by<boolean>(() => {
		const questions = clarificationQuestions
		if (questions.length === 0) return false
		return questions.every((q) => Boolean(clarificationSelections[q.id]))
	})
	const clarificationCurrentQuestionIndex = $derived.by<number>(() => {
		const questions = clarificationQuestions
		for (let i = 0; i < questions.length; i++) {
			if (!clarificationSelections[questions[i].id]) return i
		}
		return Math.max(questions.length - 1, 0)
	})

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
					agentLogs = data.map((row: { id: number; step: string; message: string; level: string; created_at?: string; workflow_id?: string | null }) => ({
						id: row.id,
						step: row.step ?? '',
						message: row.message ?? '',
						level: row.level ?? 'info',
						created_at: row.created_at,
						workflow_id: row.workflow_id ?? null
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
	$effect(() => {
		const bid = bug?.id
		if (bid == null) return
		let cancelled = false
		async function fetchComments() {
			if (cancelled) return
			try {
				const res = await fetch(`/api/bugs/${bid}/comments`)
				if (!res.ok || cancelled) return
				const payload = await res.json()
				if (cancelled || !Array.isArray(payload)) return
				commentsData = payload
			} catch {
				// ignore
			}
		}
		fetchComments()
		const interval = setInterval(fetchComments, 3000)
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

	async function submitStagingFeedback(state: 'staging_validated' | 'staging_rejected') {
		const bid = bug?.id
		if (bid == null || !canMarkStagingValidated) return
		if (state === 'staging_validated' && !checklistComplete) {
			stagingFeedbackError = 'Complete all validation checklist items before approving staging.'
			return
		}
		stagingFeedbackLoading = true
		stagingFeedbackError = null
		const trimmedNote = stagingFeedbackNote.trim()
		try {
			const res = await fetch(`/api/bugs/${bid}/dev-logs`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					state,
					workflow_id: currentWorkflowId,
					detail:
						trimmedNote ||
						(state === 'staging_validated'
							? 'Staging preview was validated from bug detail UI.'
							: 'Staging preview was rejected from bug detail UI; further fixes are required.')
				})
			})
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}))
				stagingFeedbackError = payload?.message || payload?.error || payload?.detail || `Request failed (${res.status})`
			} else {
				// Reset transient inputs after successful submission.
				stagingFeedbackNote = ''
				stagingChecklistState = Object.fromEntries(stagingChecklistItems.map((item) => [item.id, false]))
			}
		} catch (e) {
			stagingFeedbackError = e instanceof Error ? e.message : 'Failed to submit staging feedback'
		} finally {
			stagingFeedbackLoading = false
		}
	}

	async function fetchMigrationPreview(manual = false) {
		const bid = bug?.id
		if (bid == null || !VOICE_AGENT_URL) return
		if (!manual) {
			const key = `${bid}:${currentWorkflowId ?? ''}`
			if (previewFetchedKey === key) return
			previewFetchedKey = key
		}
		migrationPreviewLoading = true
		migrationPreviewError = null
		try {
			const base = VOICE_AGENT_URL.replace(/\/$/, '')
			const res = await fetch(`${base}/api/dev/fix/migrations/preview`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bug_id: bid,
					workflow_id: currentWorkflowId ?? undefined
				})
			})
			const payload = await res.json().catch(() => ({}))
			if (!res.ok) {
				migrationPreviewError = payload?.detail || payload?.error || `Preview request failed (${res.status})`
				return
			}
			migrationPreview = payload
		} catch (e) {
			migrationPreviewError = e instanceof Error ? e.message : 'Failed to load migration preview'
		} finally {
			migrationPreviewLoading = false
		}
	}

	function openApplyDbModal() {
		migrationApplyError = null
		applyConfirmModal?.showModal()
	}
	function dismissDbAutoPrompt(key?: string | null) {
		if (!key) return
		dismissedDbPromptKeys = { ...dismissedDbPromptKeys, [key]: true }
		if (!browser) return
		try {
			window.sessionStorage.setItem('phwb-devagent-dismissed-db-autoapply', JSON.stringify(dismissedDbPromptKeys))
		} catch {
			// ignore storage write errors
		}
	}
	function dismissClarificationPrompt() {
		const key = clarificationWorkflowKey
		if (!key) return
		dismissedClarificationKeys = { ...dismissedClarificationKeys, [key]: true }
		clarificationModal?.close()
		if (!browser) return
		try {
			window.sessionStorage.setItem('phwb-devagent-dismissed-clarification', JSON.stringify(dismissedClarificationKeys))
		} catch {
			// ignore storage write errors
		}
	}
	function openClarificationModal() {
		clarificationSubmitError = null
		clarificationModal?.showModal()
	}

	async function applyDbChanges() {
		const bid = bug?.id
		if (bid == null || !VOICE_AGENT_URL) return
		migrationApplyLoading = true
		migrationApplyError = null
		migrationApplyResult = null
		try {
			const base = VOICE_AGENT_URL.replace(/\/$/, '')
			const res = await fetch(`${base}/api/dev/fix/migrations/apply`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bug_id: bid,
					workflow_id: currentWorkflowId ?? undefined,
					branch_name: migrationPreview?.branch_name ?? undefined,
					confirm: true,
					confirm_destructive: true,
					dry_run: false
				})
			})
			const payload = await res.json().catch(() => ({}))
			if (!res.ok) {
				migrationApplyError = payload?.detail || payload?.error || `Apply request failed (${res.status})`
				return
			}
			migrationApplyResult = {
				success: Boolean(payload?.success),
				applied: Array.isArray(payload?.applied) ? payload.applied : [],
				failed: Array.isArray(payload?.failed) ? payload.failed : [],
				warnings: Array.isArray(payload?.warnings) ? payload.warnings : []
			}
			if (migrationApplyResult.success) {
				dismissDbAutoPrompt(currentDbAutoPromptKey)
				applyConfirmModal?.close()
			}
			await fetchMigrationPreview(true)
		} catch (e) {
			migrationApplyError = e instanceof Error ? e.message : 'Failed to apply migrations'
		} finally {
			migrationApplyLoading = false
		}
	}

	$effect(() => {
		if (!browser || sessionPromptStateLoaded) return
		try {
			const rawClar = window.sessionStorage.getItem('phwb-devagent-dismissed-clarification')
			if (rawClar) {
				const parsed = JSON.parse(rawClar) as Record<string, true>
				if (parsed && typeof parsed === 'object') dismissedClarificationKeys = parsed
			}
		} catch {
			// ignore storage parse errors
		}
		try {
			const rawDb = window.sessionStorage.getItem('phwb-devagent-dismissed-db-autoapply')
			if (rawDb) {
				const parsed = JSON.parse(rawDb) as Record<string, true>
				if (parsed && typeof parsed === 'object') dismissedDbPromptKeys = parsed
			}
		} catch {
			// ignore storage parse errors
		}
		sessionPromptStateLoaded = true
	})
	$effect(() => {
		if (showDbConfirmationPanel && VOICE_AGENT_URL) {
			void fetchMigrationPreview(false)
		}
	})
	$effect(() => {
		if (!shouldOfferAutoApply) return
		const key = currentDbAutoPromptKey
		if (!key) return
		if (dismissedDbPromptKeys[key]) return
		if (autoApplyPromptedKey === key) return
		if (!applyConfirmModal) return
		migrationApplyError = null
		applyConfirmModal.showModal()
		autoApplyPromptedKey = key
	})

	$effect(() => {
		const state = currentWorkflowState
		if (state !== 'awaiting_clarification') {
			clarificationModal?.close()
			clarificationSelections = {}
			clarificationImageFile = null
			clarificationImageUploadError = null
			clarificationImageUploadedName = null
			clarificationImageUploadedAttachmentId = null
			clarificationReferenceAttachmentId = null
			clarificationSubmitError = null
			clarificationSubmitSuccess = null
		}
	})
	$effect(() => {
		if (currentWorkflowState !== 'awaiting_clarification') return
		const key = clarificationWorkflowKey
		if (!key) return
		if (dismissedClarificationKeys[key]) return
		if (autoClarificationPromptedKey === key) return
		if (!clarificationModal) return
		clarificationSubmitError = null
		clarificationModal.showModal()
		autoClarificationPromptedKey = key
	})
	$effect(() => {
		if (!selectedImageReferenceMode.startsWith('Use existing bug attachments as the reference')) {
			clarificationReferenceAttachmentId = null
		}
	})

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

	async function uploadClarificationImage() {
		const bid = bug?.id
		if (bid == null || !clarificationImageFile) return
		clarificationImageUploadLoading = true
		clarificationImageUploadError = null
		try {
			const form = new FormData()
			form.append('file', clarificationImageFile)
			form.append('context', 'clarification')
			const res = await fetch(`/api/bugs/${bid}/attachments`, {
				method: 'POST',
				body: form
			})
			const payload = await res.json().catch(() => ({}))
			if (!res.ok) {
				clarificationImageUploadError = payload?.error || `Upload failed (${res.status})`
				return
			}
			clarificationImageUploadedName = payload?.file_name || clarificationImageFile.name
			clarificationImageUploadedAttachmentId =
				typeof payload?.attachment_id === 'number' ? payload.attachment_id : null
		} catch (e) {
			clarificationImageUploadError = e instanceof Error ? e.message : 'Image upload failed'
		} finally {
			clarificationImageUploadLoading = false
		}
	}

	async function submitClarificationAnswers() {
		const bid = bug?.id
		const wid = currentWorkflowId
		if (bid == null || !wid || !VOICE_AGENT_URL) return
		if (!clarificationAllAnswered) {
			clarificationSubmitError = 'Select one option for each clarification question before submitting.'
			return
		}
		const answers = clarificationQuestions
			.map((q) => {
				const selected = clarificationSelections[q.id]
				return selected ? `${q.prompt}: ${selected}` : ''
			})
			.filter(Boolean)
		if (selectedImageReferenceMode.startsWith('Use existing bug attachments as the reference') && hasBugAttachments) {
			const selectedFiles = attachmentReferenceOptions
				.filter((a) => clarificationReferenceAttachmentId === a.id)
				.map((a) => a.file_name)
			const files = (selectedFiles.length > 0 ? selectedFiles : bugAttachmentNames.slice(0, 5)).join(', ')
			if (files) {
				answers.push(`Confirmed bug attachments as image reference: ${files}`)
			}
		}
		if (clarificationImageUploadedName) {
			answers.push(`Image reference uploaded: ${clarificationImageUploadedName}`)
		} else if (selectedImageReferenceMode.startsWith('Upload a new image reference')) {
			answers.push('Image reference note: no upload was provided; proceed without image reference.')
		} else if (selectedImageReferenceMode.startsWith('Use existing bug attachments as the reference') && !hasBugAttachments) {
			answers.push('Image reference note: no existing attachments found; proceed without image reference.')
		}
		if (answers.length < clarificationRequiredAnswers) {
			clarificationSubmitError = 'Clarification is incomplete. Please complete all required selections.'
			return
		}
		clarificationSubmitting = true
		clarificationSubmitError = null
		clarificationSubmitSuccess = null
		const imageReferenceMode = selectedImageReferenceMode || null
		let referenceAttachmentId: number | null = null
		if (selectedImageReferenceMode.startsWith('Use existing bug attachments as the reference')) {
			referenceAttachmentId = clarificationReferenceAttachmentId
		} else if (selectedImageReferenceMode.startsWith('Upload a new image reference')) {
			referenceAttachmentId = clarificationImageUploadedAttachmentId
		}
		try {
			const base = VOICE_AGENT_URL.replace(/\/$/, '')
			const res = await fetch(`${base}/api/dev/fix/clarification/submit`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bug_id: bid,
					workflow_id: wid,
					answers,
					image_reference_mode: imageReferenceMode,
					reference_attachment_id: referenceAttachmentId
				})
			})
			const payload = await res.json().catch(() => ({}))
			if (!res.ok) {
				clarificationSubmitError =
					payload?.detail || payload?.error || payload?.message || `Request failed (${res.status})`
				return
			}
			clarificationSelections = {}
			clarificationImageFile = null
			clarificationImageUploadError = null
			clarificationImageUploadedName = null
			clarificationImageUploadedAttachmentId = null
			clarificationReferenceAttachmentId = null
			clarificationModal?.close()
			clarificationSubmitSuccess = 'Clarification submitted. Workflow resumed.'
		} catch (e) {
			clarificationSubmitError = e instanceof Error ? e.message : 'Failed to submit clarification'
		} finally {
			clarificationSubmitting = false
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
					comments={commentsData}
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
										{formatDateSafe(b.due_date)}
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
							{#if currentWorkflowState}
								<div class="rounded-lg border border-base-300 bg-base-200/40 p-2 text-xs">
									<div class="flex items-center justify-between gap-2">
										<span class="text-base-content/70">Current state</span>
										<span class={`badge badge-sm ${workflowStateMeta[currentWorkflowState].badgeClass}`}>
											{workflowStateMeta[currentWorkflowState].label}
										</span>
									</div>
									{#if currentWorkflowStateMessage}
										<p class="mt-1 text-base-content/70 whitespace-pre-wrap">{currentWorkflowStateMessage}</p>
									{/if}
									{#if currentStagingUrl}
										<a class="btn btn-outline btn-xs mt-1 w-full" href={currentStagingUrl} target="_blank" rel="noreferrer">
											Open staging preview
										</a>
									{/if}
									{#if currentWorkflowState === 'awaiting_clarification'}
										<div class="mt-2 rounded border border-warning/30 bg-warning/10 p-2">
											<p class="text-[11px] text-warning-content mb-2">
												Clarification is required before coding continues.
											</p>
											<button type="button" class="btn btn-warning btn-xs w-full" onclick={openClarificationModal}>
												Open clarification modal
											</button>
										</div>
									{/if}
									{#if canMarkStagingValidated}
										<div class="mt-2 rounded border border-base-300 bg-base-100/60 p-2">
											<p class="font-medium text-base-content/70 mb-1">Validation checklist</p>
											<div class="space-y-1">
												{#each stagingChecklistItems as item}
													<label class="flex items-start gap-2 cursor-pointer">
														<input
															type="checkbox"
															class="checkbox checkbox-xs mt-0.5"
															checked={stagingChecklistState[item.id]}
															onchange={(e) => {
																stagingChecklistState = {
																	...stagingChecklistState,
																	[item.id]: e.currentTarget.checked
																}
															}}
														/>
														<span class="text-[11px] leading-tight">{item.label}</span>
													</label>
												{/each}
											</div>
											<textarea
												class="textarea textarea-bordered textarea-xs w-full mt-2"
												placeholder="Optional validation notes"
												rows="2"
												bind:value={stagingFeedbackNote}
											></textarea>
											<div class="grid grid-cols-2 gap-2 mt-2">
												<button
													type="button"
													class="btn btn-success btn-xs"
													onclick={() => submitStagingFeedback('staging_validated')}
													disabled={stagingFeedbackLoading || !checklistComplete}
												>
													Approve
												</button>
												<button
													type="button"
													class="btn btn-error btn-outline btn-xs"
													onclick={() => submitStagingFeedback('staging_rejected')}
													disabled={stagingFeedbackLoading}
												>
													Reject
												</button>
											</div>
											{#if stagingFeedbackLoading}
												<p class="text-xs text-base-content/60 mt-1">Submitting feedback…</p>
											{/if}
										</div>
									{/if}
									{#if stagingFeedbackError}
										<p class="text-error mt-1 whitespace-pre-wrap">{stagingFeedbackError}</p>
									{/if}
								</div>
							{/if}
							<div class="rounded-lg border border-base-300 bg-base-200/30 p-2 text-xs">
								<p class="font-medium text-base-content/70 mb-1">Evidence</p>
								<div class="space-y-1">
									<div>
										<span class="text-base-content/60">Impacted layers:</span>
										{#if evidenceImpactedLayers.length > 0}
											<div class="mt-1 flex flex-wrap gap-1">
												{#each evidenceImpactedLayers as layer}
													<span class="badge badge-ghost badge-xs">{layer}</span>
												{/each}
											</div>
										{:else}
											<span class="ml-1 text-base-content/70">—</span>
										{/if}
									</div>
									<div>
										<span class="text-base-content/60">Verify mode:</span>
										<span class="ml-1">{evidenceVerifyMode ?? '—'}</span>
									</div>
									<div>
										<span class="text-base-content/60">Migration status:</span>
										<span class="ml-1">{evidenceMigrationStatus}</span>
									</div>
									<div>
										<span class="text-base-content/60">Staging validation:</span>
										<span class="ml-1">{evidenceStagingValidation}</span>
									</div>
									{#if currentStagingUrl}
										<div>
											<span class="text-base-content/60">Staging URL:</span>
											<a class="link link-primary ml-1 break-all" href={currentStagingUrl} target="_blank" rel="noreferrer">
												{currentStagingUrl}
											</a>
										</div>
									{/if}
								</div>
							</div>
							{#if showDbConfirmationPanel}
								<div class="rounded-lg border border-warning/30 bg-warning/10 p-2 text-xs">
									<div class="flex items-center justify-between gap-2">
										<p class="font-medium text-warning-content">
											{#if isDbPendingState || verifyDetectedDbChanges || migrationPreview?.db_changes_detected}
												DB changes detected
											{:else}
												Potential DB changes detected
											{/if}
										</p>
										<button
											type="button"
											class="btn btn-ghost btn-xs"
											onclick={() => fetchMigrationPreview(true)}
											disabled={migrationPreviewLoading}
										>
											{#if migrationPreviewLoading}Refreshing…{:else}Refresh{/if}
										</button>
									</div>
									{#if migrationPreviewError}
										<p class="text-error mt-1 whitespace-pre-wrap">{migrationPreviewError}</p>
									{/if}
									{#if migrationPreview?.db_changes_detected}
										{#if migrationPreview.migration_files?.length}
											<p class="mt-1 text-base-content/80">Migrations: {migrationPreview.migration_files.join(', ')}</p>
										{/if}
										{#if migrationPreview.summaries?.length}
											<div class="mt-1 space-y-1">
												{#each migrationPreview.summaries as s}
													<div class="rounded border border-base-300 bg-base-100/60 p-1.5">
														<p class="font-medium break-all">{s.file}</p>
														{#if s.summary}
															<p class="text-base-content/70">
																Ops: {(s.summary.operations || []).join(', ') || '—'} | Tables: {(s.summary.touched_tables || []).join(', ') || '—'}
															</p>
															<p class="text-base-content/70">Risk: {(s.summary.risk_tags || []).join(', ') || 'none'}</p>
														{/if}
														{#if s.error}
															<p class="text-error">{s.error}</p>
														{/if}
													</div>
												{/each}
											</div>
										{/if}
										<div class="mt-2">
											<button
												type="button"
												class="btn btn-warning btn-xs w-full"
												onclick={openApplyDbModal}
												disabled={migrationApplyLoading}
											>
												Apply DB changes
											</button>
										</div>
									{:else if migrationPreview && !migrationPreview.db_changes_detected}
										<p class="mt-1 text-base-content/70">No pending migration files found for this workflow.</p>
										{#if contractIndicatesDb}
											<p class="mt-1 text-warning-content/80">
												Contract indicates DB work; if this is unexpected, refresh after verify/create-PR steps or review agent output.
											</p>
										{/if}
									{:else if contractIndicatesDb}
										<p class="mt-1 text-base-content/70">
											DB-related implementation is expected. Waiting for migration detection metadata.
										</p>
									{/if}
									{#if migrationApplyError}
										<p class="text-error mt-1 whitespace-pre-wrap">{migrationApplyError}</p>
									{/if}
									{#if migrationApplyResult}
										<p class={`mt-1 ${migrationApplyResult.success ? 'text-success' : 'text-error'}`}>
											Apply result: {migrationApplyResult.success ? 'success' : 'failed'} (applied: {migrationApplyResult.applied.length}, failed: {migrationApplyResult.failed.length})
										</p>
									{/if}
								</div>
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
		<dialog class="modal" bind:this={clarificationModal}>
			<div class="modal-box max-w-2xl">
				<div class="flex items-center justify-between gap-2">
					<h3 class="font-bold text-lg">Clarification required</h3>
					<button type="button" class="btn btn-ghost btn-xs" onclick={dismissClarificationPrompt}>
						Not now
					</button>
				</div>
				<p class="py-2 text-sm text-base-content/80">
					Answer these clarification prompts so the dev agent can continue coding with precise context.
				</p>
				{#if clarificationQuestions.length > 0}
					{@const activeQuestion = clarificationQuestions[clarificationCurrentQuestionIndex]}
					<div class="rounded border border-base-300 bg-base-100/70 p-2">
						<p class="text-[11px] text-base-content/70 mb-1">
							Question {clarificationCurrentQuestionIndex + 1} of {clarificationQuestions.length}
						</p>
						<p class="text-xs font-medium mb-2">{activeQuestion.prompt}</p>
						<div class="grid gap-1">
							{#each activeQuestion.options as opt}
								<button
									type="button"
									class={`btn btn-xs justify-start text-left ${clarificationSelections[activeQuestion.id] === opt ? 'btn-warning' : 'btn-outline'}`}
									onclick={() => {
										clarificationSelections = {
											...clarificationSelections,
											[activeQuestion.id]: opt
										}
										clarificationSubmitError = null
									}}
								>
									{opt}
								</button>
							{/each}
						</div>
					</div>
					{#if selectedImageReferenceMode}
						<div class="mt-2 rounded border border-base-300 bg-base-100/70 p-2 text-[11px]">
							<p class="text-base-content/70 mb-1">Image reference check</p>
							{#if hasBugAttachments}
								<p class="text-success mb-1">
									{data.attachments.length} attachment(s) available on this bug.
								</p>
								{#if selectedImageReferenceMode.startsWith('Use existing bug attachments as the reference')}
									<p class="text-base-content/70">
										Using attached files as reference:
										<span class="font-mono">{bugAttachmentNames.slice(0, 3).join(', ')}</span>
									</p>
									<div class="mt-2 rounded border border-base-300 bg-base-200/40 p-2">
										<p class="text-base-content/70 mb-1">Choose one attachment reference</p>
										<div class="grid gap-1 max-h-24 overflow-y-auto">
											{#each attachmentReferenceOptions as att}
												<label class="flex items-center gap-2 cursor-pointer">
													<input
														type="radio"
														class="radio radio-xs"
														name="clarification-reference-attachment"
														checked={clarificationReferenceAttachmentId === att.id}
														onchange={() => {
															clarificationReferenceAttachmentId = att.id
														}}
													/>
													<span class="truncate">
														{att.file_name}
														{#if att.mime_type.startsWith('image/')}
															<span class="text-success">(image)</span>
														{/if}
													</span>
												</label>
											{/each}
										</div>
										<p class="text-[11px] text-base-content/60 mt-1">
											If none selected, the planner uses the first attached files by default.
										</p>
									</div>
								{/if}
							{:else}
								<p class="text-warning mb-1">No bug attachments found yet.</p>
							{/if}
						</div>
					{/if}
					{#if shouldShowImageUploadHelper}
						<div class="mt-2 rounded border border-base-300 bg-base-100/70 p-2">
							<p class="text-[11px] text-base-content/70 mb-1">
								Upload image/mock reference (optional)
							</p>
							<input
								type="file"
								accept="image/*"
								class="file-input file-input-bordered file-input-xs w-full"
								onchange={(e) => {
									const file = e.currentTarget.files?.[0] ?? null
									clarificationImageFile = file
									clarificationImageUploadedName = null
									clarificationImageUploadedAttachmentId = null
									clarificationImageUploadError = null
								}}
							/>
							<button
								type="button"
								class="btn btn-outline btn-xs mt-2 w-full"
								disabled={!clarificationImageFile || clarificationImageUploadLoading}
								onclick={uploadClarificationImage}
							>
								{#if clarificationImageUploadLoading}Uploading…{:else}Upload image{/if}
							</button>
							<p class="text-[11px] text-base-content/60 mt-1">
								You can continue clarification without uploading an image.
							</p>
							{#if clarificationImageUploadedName}
								<p class="text-success text-[11px] mt-1">Uploaded: {clarificationImageUploadedName}</p>
							{/if}
							{#if clarificationImageUploadError}
								<p class="text-error text-[11px] mt-1 whitespace-pre-wrap">{clarificationImageUploadError}</p>
							{/if}
						</div>
					{/if}
				{/if}
				<div class="modal-action mt-2">
					<form method="dialog">
						<button class="btn btn-ghost btn-sm" onclick={dismissClarificationPrompt}>Not now</button>
					</form>
					<button
						type="button"
						class="btn btn-warning btn-sm"
						onclick={submitClarificationAnswers}
						disabled={clarificationSubmitting || !clarificationAllAnswered}
					>
						{#if clarificationSubmitting}Submitting…{:else}Submit clarification{/if}
					</button>
				</div>
				{#if clarificationSubmitError}
					<p class="text-error mt-1 whitespace-pre-wrap text-xs">{clarificationSubmitError}</p>
				{/if}
				{#if clarificationSubmitSuccess}
					<p class="text-success mt-1 text-xs">{clarificationSubmitSuccess}</p>
				{/if}
			</div>
			<form method="dialog" class="modal-backdrop">
				<button aria-label="Close" onclick={dismissClarificationPrompt}>close</button>
			</form>
		</dialog>
		<dialog class="modal" bind:this={applyConfirmModal}>
			<div class="modal-box">
				<h3 class="font-bold text-lg">Apply DB changes</h3>
				<p class="py-2 text-sm">
					DB migration changes were detected for this workflow. Confirm to apply them now automatically.
					Choose “Not now” to keep manual apply available in the Dev Agent section.
				</p>
				{#if migrationPreview?.migration_files?.length}
					<p class="text-xs text-base-content/70 break-all">
						Files: {migrationPreview.migration_files.join(', ')}
					</p>
				{/if}
				<div class="modal-action">
					<form method="dialog">
						<button
							class="btn btn-ghost btn-sm"
							disabled={migrationApplyLoading}
							onclick={() => dismissDbAutoPrompt(currentDbAutoPromptKey)}
						>
							Not now
						</button>
					</form>
					<button
						type="button"
						class="btn btn-warning btn-sm"
						onclick={applyDbChanges}
						disabled={migrationApplyLoading}
					>
						{#if migrationApplyLoading}Applying…{:else}Confirm apply{/if}
					</button>
				</div>
			</div>
			<form method="dialog" class="modal-backdrop">
				<button aria-label="Close" onclick={() => dismissDbAutoPrompt(currentDbAutoPromptKey)}>close</button>
			</form>
		</dialog>
		{/if}
	</div>
</ErrorBoundary>
