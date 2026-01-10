import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'
import { redirect } from '@sveltejs/kit'
import type { Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
	// Create a server-side Supabase client that handles cookies properly
	event.locals.supabase = createServerClient(
		PUBLIC_SUPABASE_URL,
		PUBLIC_SUPABASE_ANON_KEY,
		{
			cookies: {
				get: (key) => event.cookies.get(key),
				set: (key, value, options) => {
					event.cookies.set(key, value, { ...options, path: '/' })
				},
				remove: (key, options) => {
					event.cookies.delete(key, { ...options, path: '/' })
				}
			}
		}
	)

	// Get service role key from environment (optional)
	// Try to import it statically, fall back to process.env or undefined
	let serviceRoleKey: string | undefined
	try {
		// Try static import first (SvelteKit way)
		const { SUPABASE_SERVICE_ROLE_KEY } = await import('$env/static/private')
		serviceRoleKey = SUPABASE_SERVICE_ROLE_KEY
	} catch {
		// If static import fails, try process.env as fallback
		serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
	}

	// Create a service role client that bypasses RLS
	// This uses the service role key which has full access
	// Falls back to anon key if service key is not available
	event.locals.supabaseAdmin = createClient(
		PUBLIC_SUPABASE_URL,
		serviceRoleKey || PUBLIC_SUPABASE_ANON_KEY,
		{
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		}
	)

	// Get the session from the server-side client
	let { data: { session } } = await event.locals.supabase.auth.getSession()
	
	// Dev mode: Check for test login cookie and create mock session
	if (process.env.NODE_ENV === 'development' && !session) {
		const devUserId = event.cookies.get('dev-test-user-id')
		const devUserEmail = event.cookies.get('dev-test-user-email')
		
		if (devUserId && devUserEmail) {
			// Ensure profile exists with correct name
			const devUserNames: Record<string, string> = {
				'it@singforhope.org': 'IT Dev',
				'marty@singforhope.org': 'Marty',
				'javier@singforhope.org': 'Javier'
			}
			const displayName = devUserNames[devUserEmail.toLowerCase()] || devUserEmail.split('@')[0]
			
			// Update profile if needed
			await event.locals.supabase.from('profiles').upsert({
				id: devUserId,
				full_name: displayName
			}, { onConflict: 'id' })
			
			// Create a mock session object for dev testing
			// This won't work with Supabase's actual auth, but we can bypass checks
			session = {
				user: {
					id: devUserId,
					email: devUserEmail,
					user_metadata: {},
					app_metadata: {}
				},
				access_token: 'dev-token',
				refresh_token: 'dev-refresh-token',
				expires_at: Math.floor(Date.now() / 1000) + 3600,
				expires_in: 3600,
				token_type: 'bearer'
			} as any
		}
	}
	
	event.locals.session = session

	// Public routes that don't require authentication
	const publicRoutes = ['/login', '/auth/callback', '/auth/test-login']
	const isPublicRoute = publicRoutes.some(route =>
		event.url.pathname === route || event.url.pathname.startsWith(route + '/')
	)

	// Redirect to login if accessing protected route without session
	if (!isPublicRoute && !session) {
		throw redirect(302, '/login')
	}

	// Redirect to home if accessing login with valid session
	if (event.url.pathname === '/login' && session) {
		throw redirect(302, '/')
	}
	
	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range'
		}
	})
}