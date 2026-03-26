# Bug #17: Backend Log Observation Enhancement

## Summary
Enhanced the centralized logging utility to support better backend log observation with structured logging, request tracking, and server-side visibility.

## Changes Made

### 1. Enhanced Logger Utility (`src/lib/utils/logger.ts`)
- **Server-side logging**: Logger now works on both client and server
- **Structured logging**: Support for contextual logging with metadata
- **Request tracking**: New `createRequestLogger()` for request-scoped logging with automatic context
- **Backward compatibility**: Maintains support for legacy variadic usage while adding new structured style
- **Production observability**: Server logs are always enabled for better observability in production

#### Key Features
- Automatic environment detection (client vs server, dev vs production)
- ISO 8601 timestamps on all log entries
- JSON-formatted context for easy parsing by log aggregators
- Request ID tracking for distributed tracing
- User ID tracking for audit trails
- Module/component identification

### 2. Updated Server Hooks (`src/hooks.server.ts`)
- Integrated enhanced logger with request tracking
- Generates unique request IDs for each request using `crypto.randomUUID()`
- Logs authentication events (session detection, redirects)
- Tracks request performance (duration timing)
- Provides structured context (path, method, status, userId)

## Usage Examples

### Basic Structured Logging
```typescript
import { logger } from '$lib/utils/logger'

// Simple message
logger.info('User logged in')

// With context
logger.info('User logged in', { 
  userId: 'user-123',
  timestamp: new Date().toISOString()
})

// Error with context
logger.error('Database query failed', dbError, {
  query: 'SELECT * FROM users',
  userId: 'user-123'
})
```

### Request-Scoped Logging
```typescript
import { createRequestLogger } from '$lib/utils/logger'

// In a server endpoint
export const GET: RequestHandler = async ({ locals, params }) => {
  const requestId = crypto.randomUUID()
  const requestLogger = createRequestLogger(
    requestId, 
    locals.session?.user.id, 
    'api.users'
  )
  
  requestLogger.info('Fetching user data', { userId: params.id })
  
  try {
    const data = await fetchUser(params.id)
    requestLogger.debug('User data retrieved', { recordCount: data.length })
    return json(data)
  } catch (error) {
    requestLogger.error('Failed to fetch user', error)
    throw error(500, 'Database error')
  }
}
```

### Backward Compatible Usage (Legacy Code)
```typescript
import { logger } from '$lib/utils/logger'

// Old variadic style still works
logger.log('Multiple', 'arguments', { any: 'data' })
logger.error('Error occurred:', error, 'Additional info')
```

## Log Format

### Structured Format (New Style)
```
[SERVER] [INFO] [2024-01-23T10:30:45.123Z] Request completed | {"requestId":"abc-123","userId":"user-456","path":"/api/users","method":"GET","status":200,"duration":"125.50ms"}
```

### Legacy Format (Backward Compatible)
```
[LOG] Multiple arguments { any: 'data' }
```

## Benefits

1. **Better Observability**: All server requests are now logged with context
2. **Request Tracing**: Unique request IDs enable distributed tracing
3. **Debugging**: Structured logs are easier to parse and filter
4. **Performance Monitoring**: Request duration tracking built-in
5. **Security Auditing**: User actions are tracked with user IDs
6. **Production Ready**: Server logs persist in production for debugging
7. **Backward Compatible**: No breaking changes to existing code

## Testing

The logger can be tested manually by:
1. Starting the dev server: `bun dev`
2. Navigating to any page
3. Observing server console logs with structured format
4. Each request shows: request ID, path, method, duration, and authentication status

## Future Enhancements

Potential improvements:
- Integration with log aggregation services (e.g., DataDog, Sentry)
- Log level filtering by environment variable
- Performance metrics collection
- Automatic error reporting
- Log rotation for production deployments
