import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

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
