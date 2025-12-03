import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code')

	if (code) {
		const { data, error } = await locals.supabase.auth.exchangeCodeForSession(code)

		// Sync Google profile data to profiles table
		if (!error && data.session?.user) {
			const { user } = data.session
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
