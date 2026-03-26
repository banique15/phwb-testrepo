import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '$env/dynamic/private'

type VerifyAuthInput = {
  method: string
  path: string
  rawBody: string
  headers: Headers
}

function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)
  if (aBuffer.length !== bBuffer.length) return false
  return timingSafeEqual(aBuffer, bBuffer)
}

function getAuthConfig() {
  return {
    bearerToken: env.PHWB_INTEGRATION_BEARER_TOKEN || env.CRON_SECRET || '',
    hmacSecret: env.PHWB_INTEGRATION_HMAC_SECRET || '',
    maxSkewSeconds: Number(env.PHWB_INTEGRATION_MAX_SKEW_SECONDS || '300')
  }
}

export function createRequestSignature(method: string, path: string, timestamp: string, rawBody: string, secret: string): string {
  const normalizedMethod = method.toUpperCase()
  const payload = `${normalizedMethod}\n${path}\n${timestamp}\n${rawBody}`
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function verifyIntegrationAuth(input: VerifyAuthInput): { ok: boolean; mode?: 'bearer' | 'hmac'; reason?: string } {
  const { bearerToken, hmacSecret, maxSkewSeconds } = getAuthConfig()
  const authHeader = input.headers.get('authorization') || ''

  if (bearerToken && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim()
    if (safeCompare(token, bearerToken)) {
      return { ok: true, mode: 'bearer' }
    }
  }

  if (hmacSecret) {
    const timestamp = input.headers.get('x-webhook-timestamp') || ''
    const signature = input.headers.get('x-webhook-signature') || ''
    if (!timestamp || !signature) {
      return { ok: false, reason: 'Missing HMAC headers' }
    }

    const parsedTimestamp = Number(timestamp)
    if (!Number.isFinite(parsedTimestamp)) {
      return { ok: false, reason: 'Invalid timestamp' }
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    if (Math.abs(nowSeconds - parsedTimestamp) > maxSkewSeconds) {
      return { ok: false, reason: 'Timestamp outside allowed skew window' }
    }

    const expectedSignature = createRequestSignature(
      input.method,
      input.path,
      timestamp,
      input.rawBody,
      hmacSecret
    )
    if (!safeCompare(signature, expectedSignature)) {
      return { ok: false, reason: 'Invalid HMAC signature' }
    }
    return { ok: true, mode: 'hmac' }
  }

  return { ok: false, reason: 'No valid integration auth provided' }
}

export function getOutboundIntegrationAuthHeaders(path: string, method: string, rawBody: string): Record<string, string> {
  const { bearerToken, hmacSecret } = getAuthConfig()
  const headers: Record<string, string> = {}

  if (bearerToken) {
    headers.authorization = `Bearer ${bearerToken}`
  }
  if (hmacSecret) {
    const timestamp = String(Math.floor(Date.now() / 1000))
    headers['x-webhook-timestamp'] = timestamp
    headers['x-webhook-signature'] = createRequestSignature(method, path, timestamp, rawBody, hmacSecret)
  }

  return headers
}
