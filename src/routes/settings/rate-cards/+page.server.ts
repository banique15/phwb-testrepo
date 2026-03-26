import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	// Keep auth check aligned with current hooks.locals shape.
	if (!locals.session) {
		throw redirect(303, '/login')
	}

	return {}
}
