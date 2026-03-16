import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const devUsers: Array<{ id: string; email: string; full_name: string }> = []

	// Only fetch auth users in development for quick-login buttons
	if (process.env.NODE_ENV === 'development' && locals.supabaseAdmin) {
		try {
			const { data, error } = await locals.supabaseAdmin.auth.admin.listUsers({
				perPage: 50
			})
			if (!error && data?.users) {
				for (const u of data.users) {
					const email = u.email?.trim()
					if (email) {
						devUsers.push({
							id: u.id,
							email,
							full_name:
								(u.user_metadata?.full_name as string) ||
								(u.user_metadata?.name as string) ||
								email.split('@')[0] ||
								'User'
						})
					}
				}
				// Sort by full name then email
				devUsers.sort((a, b) => {
					const na = a.full_name.toLowerCase()
					const nb = b.full_name.toLowerCase()
					if (na !== nb) return na.localeCompare(nb)
					return a.email.localeCompare(b.email)
				})
			}
		} catch (e) {
			console.warn('Login page: could not list dev users', e)
		}
	}

	return { devUsers }
}
