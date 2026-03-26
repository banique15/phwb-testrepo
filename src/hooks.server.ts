import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'
import { redirect } from '@sveltejs/kit'
import type { Handle } from '@sveltejs/kit'
import { createRequestLogger } from '$lib/utils/logger'

export const handle: Handle = async ({ event, resolve }) => {
	// Generate request ID for tracking
	const requestId = crypto.randomUUID()
	const requestLogger = createRequestLogger(requestId, undefined, 'hooks.server')
	
	requestLogger.debug('Processing request', { 
		path: event.url.pathname,
		method: event.request.method
	})

	// Create a server-side Supabase client that handles cookies properly
	event.locals.supabase = createServerClient(
		PUBLIC_SUPABASE_URL,
		PUBLIC_SUPABASE_ANON_KEY,
		{
			cookies: {
				get: (key: string) => event.cookies.get(key),
				set: (key: string, value: string, options: CookieOptions) => {
					event.cookies.set(key, value, { ...options, path: '/' })
				},
				remove: (key: string, options: CookieOptions) => {
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
	// This works the same in both dev and production - real Supabase auth
	const { data: { session } } = await event.locals.supabase.auth.getSession()
	
	event.locals.session = session

	if (session) {
		requestLogger.debug('Authenticated session detected', {
			userId: session.user.id,
			email: session.user.email
		})
	} else {
		requestLogger.debug('No authenticated session')
	}

	// Public routes that don't require authentication
	const publicRoutes = ['/login', '/auth/callback', '/auth/test-login']
	const isPublicRoute = publicRoutes.some(route =>
		event.url.pathname === route || event.url.pathname.startsWith(route + '/')
	)

	// Redirect to login if accessing protected route without session
	if (!isPublicRoute && !session) {
		requestLogger.info('Redirecting to login - unauthenticated access attempt', {
			attemptedPath: event.url.pathname
		})
		throw redirect(302, '/login')
	}

	// Redirect to home if accessing login with valid session
	if (event.url.pathname === '/login' && session) {
		requestLogger.debug('Redirecting to home - already authenticated')
		throw redirect(302, '/')
	}
	
	const startTime = performance.now()
	const response = await resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range'
		}
	})
	const duration = performance.now() - startTime
	
	requestLogger.info('Request completed', {
		path: event.url.pathname,
		method: event.request.method,
		status: response.status,
		duration: `${duration.toFixed(2)}ms`
	})
	
	return response
}
