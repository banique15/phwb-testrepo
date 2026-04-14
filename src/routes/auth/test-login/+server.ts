import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

// Allow in development by default; optionally enable in preview/staging via env flag.
const isDev = process.env.NODE_ENV === 'development'
const allowNonDev = (process.env.DEV_TEST_LOGIN_ENABLED || '').toLowerCase() === '1' || (process.env.DEV_TEST_LOGIN_ENABLED || '').toLowerCase() === 'true'

export const GET: RequestHandler = async ({ url, locals, cookies }) => {
	if (!isDev && !allowNonDev) {
		throw redirect(
			303,
			'/login?error=Test login is disabled. Set DEV_TEST_LOGIN_ENABLED=1 to allow it in preview/staging.'
		)
	}

	const email = url.searchParams.get('email')?.trim()
	if (!email) {
		throw redirect(303, '/login?error=Email required (e.g. /auth/test-login?email=user@example.com)')
	}

	// Use the admin client to generate a magic link for the user
	const supabaseAdmin = locals.supabaseAdmin
	if (!supabaseAdmin) {
		throw redirect(303, '/login?error=Admin client not available')
	}

	try {
		// First, check if the user exists in Supabase auth
		const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()
		
		let userId: string | undefined
		let displayName = email.split('@')[0]
		if (!listError && users) {
			const existingUser = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
			if (existingUser) {
				userId = existingUser.id
				displayName =
					(existingUser.user_metadata?.full_name as string) ||
					(existingUser.user_metadata?.name as string) ||
					displayName
			}
		}

		// If user doesn't exist, create them
		if (!userId) {
			const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
				email: email,
				email_confirm: true,
				user_metadata: { full_name: displayName }
			})
			
			if (createError) {
				console.error('Error creating dev user:', createError)
				throw redirect(303, `/login?error=Failed to create dev user: ${createError.message}`)
			}
			
			userId = newUser.user.id
		}

		// Generate a magic link for the user
		const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
			type: 'magiclink',
			email: email,
			options: {
				redirectTo: url.origin + '/'
			}
		})

		if (linkError || !linkData) {
			console.error('Error generating magic link:', linkError)
			throw redirect(303, `/login?error=Failed to generate login link: ${linkError?.message || 'Unknown error'}`)
		}

		// The linkData contains the hashed_token we can use to verify the OTP
		// Extract the token from the action_link
		const actionLink = new URL(linkData.properties.action_link)
		const token = actionLink.searchParams.get('token')
		const tokenType = actionLink.searchParams.get('type') || 'magiclink'

		if (!token) {
			throw redirect(303, '/login?error=Failed to extract token from magic link')
		}

		// Use the regular supabase client to verify the OTP and create a session
		const { data: sessionData, error: verifyError } = await locals.supabase.auth.verifyOtp({
			token_hash: token,
			type: tokenType as any
		})

		if (verifyError) {
			console.error('Error verifying OTP:', verifyError)
			throw redirect(303, `/login?error=Failed to verify login: ${verifyError.message}`)
		}

		// Ensure profile exists with correct name
		if (userId) {
			await locals.supabase.from('profiles').upsert({
				id: userId,
				full_name: displayName
			}, { onConflict: 'id' })
		}

		// Clear any old dev cookies since we now have a real session
		cookies.delete('dev-test-user-id', { path: '/' })
		cookies.delete('dev-test-user-email', { path: '/' })

		// Session is automatically set via cookies by Supabase
		throw redirect(303, '/')
	} catch (err) {
		// If it's already a redirect, re-throw it
		if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
			throw err
		}
		
		console.error('Dev login error:', err)
		throw redirect(303, `/login?error=Dev login failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
	}
}
