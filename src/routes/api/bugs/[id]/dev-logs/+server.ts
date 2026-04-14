import { json, error } from '@sveltejs/kit'
import { env } from '$env/dynamic/public'
import type { RequestHandler } from './$types'

function normalizeVoiceAgentUrl(raw: string | undefined): string {
	const s = (raw ?? '').trim()
	if (!s) return ''
	if (/^https?:\/\//i.test(s)) return s.replace(/\/+$/, '')
	const host = s.startsWith(':') ? `localhost${s}` : s.includes(':') ? s : `localhost:${s}`
	return `http://${host.replace(/^\/+/, '')}`
}

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.session) {
		throw error(401, 'Authentication required')
	}
	const bugId = parseInt(params.id, 10)
	if (isNaN(bugId)) {
		throw error(400, 'Invalid bug ID')
	}
	const supabase = locals.supabaseAdmin || locals.supabase
	if (!supabase) {
		throw error(500, 'Database connection not available')
	}

	const { data: logs, error: fetchError } = await supabase
		.from('phwb_dev_logs')
		.select('id, bug_id, step, message, level, workflow_id, created_at')
		.eq('bug_id', bugId)
		.order('created_at', { ascending: true })

	if (fetchError) {
		// Table might not exist yet
		if (fetchError.code === '42P01') {
			return json([])
		}
		throw error(500, String(fetchError.message))
	}

	return json(logs ?? [])
}

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.session) {
		throw error(401, 'Authentication required')
	}
	const bugId = parseInt(params.id, 10)
	if (isNaN(bugId)) {
		throw error(400, 'Invalid bug ID')
	}
	const supabase = locals.supabaseAdmin || locals.supabase
	if (!supabase) {
		throw error(500, 'Database connection not available')
	}

	const { error: deleteError } = await supabase
		.from('phwb_dev_logs')
		.delete()
		.eq('bug_id', bugId)

	if (deleteError) {
		if (deleteError.code === '42P01') return json({ ok: true })
		throw error(500, String(deleteError.message))
	}

	return json({ ok: true })
}

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.session) {
		throw error(401, 'Authentication required')
	}
	const bugId = parseInt(params.id, 10)
	if (isNaN(bugId)) {
		throw error(400, 'Invalid bug ID')
	}
	const supabase = locals.supabaseAdmin || locals.supabase
	if (!supabase) {
		throw error(500, 'Database connection not available')
	}

	const body = await request.json().catch(() => ({} as Record<string, unknown>))
	const state = String(body?.state ?? '').trim()
	const workflowId = body?.workflow_id == null ? null : String(body.workflow_id)
	const detail = String(body?.detail ?? '').trim()

	// Intentionally narrow for safety: this endpoint currently supports staging feedback states only.
	if (state !== 'staging_validated' && state !== 'staging_rejected') {
		throw error(400, 'Unsupported workflow state')
	}

	const isValidated = state === 'staging_validated'
	const stateLabel = isValidated ? 'staging_validated' : 'staging_rejected'
	const defaultDetail = isValidated
		? 'Staging validation confirmed by reviewer.'
		: 'Staging validation rejected by reviewer. Further iteration is required.'
	const msg = `🔖 Workflow state → \`${stateLabel}\`. ${detail || defaultDetail}`

	const { error: logError } = await supabase.from('phwb_dev_logs').insert({
		bug_id: bugId,
		step: 'workflow_state',
		message: msg,
		level: isValidated ? 'success' : 'warning',
		workflow_id: workflowId
	})
	if (logError) {
		throw error(500, String(logError.message))
	}

	// Mirror workflow state in comments so non-technical reviewers can track progression.
	await supabase.from('phwb_bug_comments').insert({
		bug_id: bugId,
		user_id: null,
		content: msg,
		is_internal: false
	})

	if (isValidated) {
		const voiceAgentUrl = normalizeVoiceAgentUrl(env.PUBLIC_VOICE_AGENT_URL)
		if (voiceAgentUrl) {
			const res = await fetch(`${voiceAgentUrl}/api/dev/fix/staging/validated`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bug_id: bugId,
					workflow_id: workflowId || undefined
				})
			}).catch(() => null)
			if (!res || !res.ok) {
				const payload = (await res?.json().catch(() => ({} as Record<string, unknown>))) ?? {}
				const detail =
					typeof payload?.detail === 'string'
						? payload.detail
						: `Promotion request failed (${res?.status ?? 'no response'})`
				throw error(502, detail)
			}
		}
	}

	return json({ ok: true, state: stateLabel, message: msg })
}
