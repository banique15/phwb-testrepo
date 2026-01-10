/**
 * Utility functions for generating event URLs
 */

/**
 * Get the URL for an event
 * @param eventId - The numeric ID of the event
 * @param options - Optional parameters
 * @returns The URL path for the event
 */
export function getEventUrl(
	eventId: number,
	options?: { edit?: boolean; useQueryParams?: boolean }
): string {
	if (options?.useQueryParams) {
		// Use query parameter format for backward compatibility
		const params = new URLSearchParams()
		params.set('id', eventId.toString())
		if (options.edit) {
			params.set('edit', 'true')
		}
		return `/events?${params.toString()}`
	}

	// Use dedicated route format (preferred)
	if (options?.edit) {
		return `/events/${eventId}?edit=true`
	}
	return `/events/${eventId}`
}

/**
 * Get a full shareable URL for an event
 * @param eventId - The numeric ID of the event
 * @param baseUrl - Optional base URL (defaults to current origin)
 * @param options - Optional parameters
 * @returns The full URL including protocol and domain
 */
export function getEventShareUrl(
	eventId: number,
	baseUrl?: string,
	options?: { edit?: boolean; useQueryParams?: boolean }
): string {
	const path = getEventUrl(eventId, options)
	const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '')
	return `${base}${path}`
}

/**
 * Copy event URL to clipboard
 * @param eventId - The numeric ID of the event
 * @param options - Optional parameters
 * @returns Promise that resolves when URL is copied
 */
export async function copyEventUrl(
	eventId: number,
	options?: { edit?: boolean; useQueryParams?: boolean }
): Promise<void> {
	const url = getEventShareUrl(eventId, undefined, options)
	
	if (typeof navigator !== 'undefined' && navigator.clipboard) {
		await navigator.clipboard.writeText(url)
	} else {
		// Fallback for older browsers
		const textArea = document.createElement('textarea')
		textArea.value = url
		textArea.style.position = 'fixed'
		textArea.style.opacity = '0'
		document.body.appendChild(textArea)
		textArea.select()
		document.execCommand('copy')
		document.body.removeChild(textArea)
	}
}
