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
	const { data: bug, error: fetchError } = await supabase
		.from('phwb_bugs')
		.select('*')
		.eq('id', bugId)
		.maybeSingle()
	if (fetchError) {
		throw error(500, String(fetchError.message))
	}
	if (!bug) {
		throw error(404, 'Bug not found')
	}
	return json(bug)
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.session) {
		throw error(401, 'Authentication required')
	}

	const bugId = parseInt(params.id, 10)
	if (isNaN(bugId)) {
		throw error(400, 'Invalid bug ID')
	}

	// Use supabaseAdmin to bypass RLS (service role), or fall back to regular client
	const supabase = locals.supabaseAdmin || locals.supabase
	if (!supabase) {
		throw error(500, 'Database connection not available')
	}

	try {
		const updates = await request.json()

		const { data, error: updateError } = await supabase
			.from('phwb_bugs')
			.update(updates)
			.eq('id', bugId)
			.select()
			.single()

		if (updateError) {
			console.error('Bug update error:', updateError)
			throw error(500, `Failed to update bug: ${updateError.message}`)
		}

		return json(data)
	} catch (err) {
		console.error('Bug PATCH error:', err)
		if (err instanceof Error && 'status' in err) {
			throw err
		}
		throw error(500, 'Failed to update bug')
	}
}
