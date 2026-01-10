import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

// Only allow in development
const isDev = process.env.NODE_ENV === 'development'

// Known user IDs for dev testing (from Supabase auth.users)
const DEV_USERS: Record<string, string> = {
	'it@singforhope.org': '22b70f9d-2bd6-4c3a-a697-f502d172eeeb',
	'marty@singforhope.org': '718d7290-9959-4ce9-8553-e6b98bc2ed9b',
	'javier@singforhope.org': 'b2819c42-d6bc-435a-92c0-da845f77fd2d'
}

// Display names for dev users
const DEV_USER_NAMES: Record<string, string> = {
	'it@singforhope.org': 'IT Dev',
	'marty@singforhope.org': 'Marty',
	'javier@singforhope.org': 'Javier'
}

export const GET: RequestHandler = async ({ url, locals, cookies }) => {
	if (!isDev) {
		throw redirect(303, '/login?error=Test login only available in development')
	}

	// Get email from query param or use default test user
	const email = url.searchParams.get('email') || 'it@singforhope.org'
	const userId = DEV_USERS[email.toLowerCase()]
	const displayName = DEV_USER_NAMES[email.toLowerCase()] || email.split('@')[0]

	if (!userId) {
		throw redirect(303, `/login?error=Test user not found: ${email}. Available test users: ${Object.keys(DEV_USERS).join(', ')}`)
	}

	// Get user from database to verify they exist
	const { data: profile, error: profileError } = await locals.supabase
		.from('profiles')
		.select('id, full_name, email')
		.eq('id', userId)
		.single()

	if (profileError || !profile) {
		// User might not have a profile yet, but we can still create a session
		// Create a minimal profile entry with the display name
		await locals.supabase.from('profiles').upsert({
			id: userId,
			full_name: displayName
		}, { onConflict: 'id' })
	} else if (profile && profile.full_name !== displayName) {
		// Update the profile name if it doesn't match
		await locals.supabase.from('profiles').update({
			full_name: displayName
		}).eq('id', userId)
	}

	// Use Supabase's signInWithPassword with a dummy password won't work
	// Instead, we'll use a magic link approach or set cookies directly
	// For dev, we'll create a session using the admin API if available, 
	// or use a workaround with cookies
	
	// Try to get an existing session first
	const { data: { session: existingSession } } = await locals.supabase.auth.getSession()
	
	if (!existingSession) {
		// Create a magic link token for the user
		// This requires admin API, so we'll use a simpler cookie-based approach for dev
		// Set a dev cookie that hooks can check
		cookies.set('dev-test-user-id', userId, { 
			path: '/', 
			maxAge: 60 * 60 * 24 * 7,
			httpOnly: false // Allow JS access for debugging
		})
		cookies.set('dev-test-user-email', email, { 
			path: '/', 
			maxAge: 60 * 60 * 24 * 7,
			httpOnly: false
		})

		// Try to create a session using Supabase's password reset flow
		// Actually, let's use a simpler approach - modify hooks to accept dev cookie
		// For now, redirect and let hooks handle it
	}

	throw redirect(303, '/')
}
