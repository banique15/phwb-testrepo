import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

const ALLOWED_EMAILS = [
	'phwb@singforhope.org',
	'it@singforhope.org',
	'michele@singforhope.org',
	'richard@singforhope.org',
	'lis@singforhope.org',
	'adam@singforhope.org',
	'javier@singforhope.org'
]

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code')

	if (code) {
		const { data, error } = await locals.supabase.auth.exchangeCodeForSession(code)

		if (!error && data.session?.user) {
			const { user } = data.session
			const email = user.email?.toLowerCase()

			// Check if email is in allowed list
			if (!email || !ALLOWED_EMAILS.includes(email)) {
				// Sign out unauthorized user
				await locals.supabase.auth.signOut()
				throw redirect(303, '/login?error=Access denied. Your account is not authorized.')
			}

			// Sync Google profile data to profiles table
			const metadata = user.user_metadata
			await locals.supabase.from('profiles').upsert({
				id: user.id,
				full_name: metadata.full_name || metadata.name,
				avatar_url: metadata.avatar_url || metadata.picture
			}, {
				onConflict: 'id'
			})
		}
	}

	throw redirect(303, '/')
}
