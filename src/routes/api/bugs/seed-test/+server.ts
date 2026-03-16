import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

/** Creates a single test bug for trying the Dev Fix flow. Requires auth. */
export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.session) {
		throw error(401, 'Authentication required')
	}
	const supabase = locals.supabaseAdmin || locals.supabase
	if (!supabase) {
		throw error(500, 'Database connection not available')
	}

	const testBug = {
		title: '[Dev Fix Test] Button styling / small UI fix',
		description:
			'Test issue for the Initiate dev fix flow.\n\n' +
			'**Steps to verify:**\n' +
			'1. Open this issue and click "Initiate dev fix" in the Dev Agent section.\n' +
			'2. When the workflow completes, check the **Comments** tab for the PR link (or error message).\n\n' +
			'You can close or resolve this issue after testing.',
		status: 'new',
		priority: 'medium',
		category: 'UI/UX',
		reported_by: locals.session.user.id
	}

	const { data: bug, error: insertError } = await supabase
		.from('phwb_bugs')
		.insert(testBug)
		.select()
		.single()

	if (insertError) {
		console.error('Seed test bug insert error:', insertError)
		throw error(500, `Failed to create test issue: ${insertError.message}`)
	}

	return json({ bug, message: 'Test issue created. Open it and try Initiate dev fix.' })
}
