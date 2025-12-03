import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import type { Profile } from '$lib/schemas/profile'

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.session) {
		throw error(401, 'Authentication required')
	}

	const supabase = locals.supabase
	if (!supabase) {
		throw error(500, 'Database connection not available')
	}

	const userId = locals.session.user.id

	try {
		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select('*')
			.eq('id', userId)
			.single()

		if (profileError && profileError.code !== 'PGRST116') {
			throw profileError
		}

		return {
			profile: profile as Profile | null,
			user: {
				id: locals.session.user.id,
				email: locals.session.user.email
			}
		}
	} catch (err) {
		console.error('Account load error:', err)
		throw error(500, 'Failed to load account information')
	}
}

export type AccountPageData = {
	profile: Profile | null
	user: {
		id: string
		email: string | undefined
	}
}
