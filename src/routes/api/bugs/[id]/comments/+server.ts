import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.session) {
		throw error(401, 'Authentication required')
	}

	const bugId = Number.parseInt(params.id, 10)
	if (!Number.isFinite(bugId)) {
		throw error(400, 'Invalid bug ID')
	}

	const supabase = locals.supabaseAdmin || locals.supabase
	if (!supabase) {
		throw error(500, 'Database connection not available')
	}

	try {
		const { data: commentsRaw, error: commentsError } = await supabase
			.from('phwb_bug_comments')
			.select('*')
			.eq('bug_id', bugId)
			.order('created_at', { ascending: true })

		if (commentsError) {
			throw error(500, commentsError.message)
		}

		const comments = Array.isArray(commentsRaw) ? commentsRaw : []
		const userIds = Array.from(
			new Set(
				comments
					.map((c: any) => c?.user_id)
					.filter((id: unknown) => typeof id === 'string' && id.length > 0)
			)
		)

		const profilesMap = new Map<string, { full_name: string | null; avatar_url: string | null }>()
		if (userIds.length > 0) {
			const { data: profilesRaw } = await supabase
				.from('profiles')
				.select('id, full_name, avatar_url')
				.in('id', userIds)
			const profiles = Array.isArray(profilesRaw) ? profilesRaw : []
			for (const p of profiles) {
				if (typeof p?.id === 'string') {
					profilesMap.set(p.id, { full_name: p.full_name ?? null, avatar_url: p.avatar_url ?? null })
				}
			}
		}

		const enriched = comments.map((c: any) => ({
			...c,
			profiles: c?.user_id ? profilesMap.get(c.user_id) || null : null
		}))

		return json(enriched)
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err
		throw error(500, err instanceof Error ? err.message : 'Failed to load comments')
	}
}

