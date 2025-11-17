import { createServerClient } from '@supabase/ssr'
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

	// Get the session from the server-side client
	const { data: { session } } = await event.locals.supabase.auth.getSession()
	event.locals.session = session

	// Public routes that don't require authentication
	const publicRoutes = ['/login']
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