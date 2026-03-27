/**
 * Centralized logging utility for both client and server
 * Provides structured logging with context for better observability
 * Backward compatible with legacy usage
 */

// Check if we're in a development environment
const isDev = typeof import.meta !== 'undefined' 
	? import.meta.env?.DEV ?? false 
	: process.env.NODE_ENV === 'development'

// Check if we're running on the server
const isServer = typeof window === 'undefined'

export interface LogContext {
	requestId?: string
	userId?: string
	timestamp?: string
	module?: string
	[key: string]: any
}

/**
 * Format a log message with context
 */
function formatMessage(level: string, message: string, context?: LogContext): string {
	const timestamp = context?.timestamp || new Date().toISOString()
	const prefix = isServer ? '[SERVER]' : '[CLIENT]'
	const contextStr = context ? ` | ${JSON.stringify(context)}` : ''
	return `${prefix} [${level}] [${timestamp}] ${message}${contextStr}`
}

/**
 * Log only in development or server environment for observability
 */
function shouldLog(level: 'error' | 'warn' | 'info' | 'log' | 'debug'): boolean {
	// Always log errors
	if (level === 'error') return true
	
	// In production client, only log errors
	if (!isServer && !isDev) return false
	
	// Server always logs in all environments for observability
	if (isServer) return true
	
	// Development mode logs everything
	return isDev
}

/**
 * Helper to determine if first arg is a context object
 */
function isContext(arg: any): arg is LogContext {
	return arg !== null && typeof arg === 'object' && !Array.isArray(arg) && !(arg instanceof Error)
}

export const logger = {
	/**
	 * Log general information
	 * Supports both old variadic style and new structured style
	 */
	log: (...args: any[]) => {
		if (!shouldLog('log')) return
		
		// New style: log(message, context)
		if (args.length <= 2 && typeof args[0] === 'string' && (args.length === 1 || isContext(args[1]))) {
			console.log(formatMessage('LOG', args[0], args[1]))
		} else {
			// Old style: log(...args) - backward compatible
			if (isDev) console.log('[LOG]', ...args)
		}
	},

	/**
	 * Log informational messages
	 * Supports both old variadic style and new structured style
	 */
	info: (...args: any[]) => {
		if (!shouldLog('info')) return
		
		// New style: info(message, context)
		if (args.length <= 2 && typeof args[0] === 'string' && (args.length === 1 || isContext(args[1]))) {
			console.info(formatMessage('INFO', args[0], args[1]))
		} else {
			// Old style: info(...args) - backward compatible
			if (isDev) console.info('[INFO]', ...args)
		}
	},

	/**
	 * Log warnings
	 * Supports both old variadic style and new structured style
	 */
	warn: (...args: any[]) => {
		if (!shouldLog('warn')) return
		
		// New style: warn(message, context)
		if (args.length <= 2 && typeof args[0] === 'string' && (args.length === 1 || isContext(args[1]))) {
			console.warn(formatMessage('WARN', args[0], args[1]))
		} else {
			// Old style: warn(...args) - backward compatible
			if (isDev) console.warn('[WARN]', ...args)
		}
	},

	/**
	 * Log errors - always logged for observability
	 * Supports both old variadic style and new structured style
	 */
	error: (...args: any[]) => {
		// New style: error(message, error?, context?)
		if (args.length >= 1 && args.length <= 3 && typeof args[0] === 'string') {
			const message = args[0]
			const error = args.length >= 2 && (args[1] instanceof Error || typeof args[1] === 'object') ? args[1] : undefined
			const context = args.length === 3 && isContext(args[2]) ? args[2] : (args.length === 2 && isContext(args[1]) ? args[1] : undefined)
			
			const errorContext = {
				...context,
				error: error instanceof Error ? {
					name: error.name,
					message: error.message,
					stack: error.stack
				} : error
			}
			console.error(formatMessage('ERROR', message, errorContext))
		} else {
			// Old style: error(...args) - backward compatible
			console.error('[ERROR]', ...args)
		}
	},

	/**
	 * Log debug information
	 * Supports both old variadic style and new structured style
	 */
	debug: (...args: any[]) => {
		if (!shouldLog('debug')) return
		
		// New style: debug(message, context)
		if (args.length <= 2 && typeof args[0] === 'string' && (args.length === 1 || isContext(args[1]))) {
			console.debug(formatMessage('DEBUG', args[0], args[1]))
		} else {
			// Old style: debug(...args) - backward compatible
			if (isDev) console.debug('[DEBUG]', ...args)
		}
	},

	/**
	 * Start a log group
	 */
	group: (label: string, context?: LogContext) => {
		if (shouldLog('log')) {
			if (context) {
				console.group(formatMessage('GROUP', label, context))
			} else {
				// Backward compatible
				if (isDev) console.group(label)
			}
		}
	},

	/**
	 * End a log group
	 */
	groupEnd: () => {
		if (shouldLog('log')) {
			if (isDev || isServer) console.groupEnd()
		}
	},

	/**
	 * Log with custom context (useful for request tracking)
	 */
	withContext: (baseContext: LogContext) => ({
		log: (message: string, additionalContext?: LogContext) => 
			logger.log(message, { ...baseContext, ...additionalContext }),
		info: (message: string, additionalContext?: LogContext) => 
			logger.info(message, { ...baseContext, ...additionalContext }),
		warn: (message: string, additionalContext?: LogContext) => 
			logger.warn(message, { ...baseContext, ...additionalContext }),
		error: (message: string, error?: Error | unknown, additionalContext?: LogContext) => 
			logger.error(message, error, { ...baseContext, ...additionalContext }),
		debug: (message: string, additionalContext?: LogContext) => 
			logger.debug(message, { ...baseContext, ...additionalContext })
	})
}

/**
 * Create a request-scoped logger with automatic context
 * 
 * This factory function creates a logger instance that automatically includes
 * base context (requestId, userId, module) in all log entries, making it perfect
 * for tracking requests across the application lifecycle.
 * 
 * @param requestId - Unique identifier for the request (e.g., from crypto.randomUUID())
 * @param userId - Optional user identifier for audit trails
 * @param module - Optional module/component name for log organization
 * @returns A logger instance with methods that inherit the base context
 * 
 * @example
 * ```typescript
 * // In a server hook or API endpoint
 * const requestLogger = createRequestLogger(
 *   crypto.randomUUID(),
 *   session?.user.id,
 *   'api.users'
 * )
 * 
 * requestLogger.info('Processing request', { path: '/api/users' })
 * // Output: [SERVER] [INFO] [2024-01-23T10:30:45.123Z] Processing request | {"requestId":"...","userId":"...","module":"api.users","path":"/api/users"}
 * ```
 */
export function createRequestLogger(requestId?: string, userId?: string, module?: string) {
	return logger.withContext({
		requestId,
		userId,
		module
	})
}

// Re-export for convenience
export default logger
