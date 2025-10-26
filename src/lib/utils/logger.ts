/**
 * Centralized logging utility
 * Only logs in development mode - automatically stripped in production builds
 */

const isDev = import.meta.env.DEV

export const logger = {
	log: (...args: any[]) => {
		if (isDev) console.log('[LOG]', ...args)
	},

	info: (...args: any[]) => {
		if (isDev) console.info('[INFO]', ...args)
	},

	warn: (...args: any[]) => {
		if (isDev) console.warn('[WARN]', ...args)
	},

	error: (...args: any[]) => {
		// Always log errors, even in production
		console.error('[ERROR]', ...args)
	},

	debug: (...args: any[]) => {
		if (isDev) console.debug('[DEBUG]', ...args)
	},

	group: (label: string) => {
		if (isDev) console.group(label)
	},

	groupEnd: () => {
		if (isDev) console.groupEnd()
	}
}

// Re-export for convenience
export default logger
