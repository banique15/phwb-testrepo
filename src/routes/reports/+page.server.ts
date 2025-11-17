import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication
	if (!locals.session) {
		throw error(401, 'Authentication required')
	}

	return {}
}

