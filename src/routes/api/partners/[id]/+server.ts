import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.session) {
		throw error(401, 'Authentication required')
	}

	const partnerId = parseInt(params.id, 10)
	if (isNaN(partnerId)) {
		throw error(400, 'Invalid partner ID')
	}

	// Use supabaseAdmin to bypass RLS (service role), or fall back to regular client
	const supabase = locals.supabaseAdmin || locals.supabase
	if (!supabase) {
		throw error(500, 'Database connection not available')
	}

	try {
		const updates = await request.json()

		const { data, error: updateError } = await supabase
			.from('phwb_partners')
			.update(updates)
			.eq('id', partnerId)
			.select()
			.single()

		if (updateError) {
			console.error('Partner update error:', updateError)
			throw error(500, `Failed to update partner: ${updateError.message}`)
		}

		return json(data)
	} catch (err) {
		if (err instanceof Error && 'status' in err) {
			throw err
		}
		console.error('Partner update error:', err)
		throw error(500, 'Failed to update partner')
	}
}
