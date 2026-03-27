import { env } from '$env/dynamic/private'

export interface ResendSendInput {
  to: string
  subject: string
  html: string
  from?: string | null
  replyTo?: string | null
  tags?: Record<string, string>
}

export interface ResendSendResult {
  ok: boolean
  messageId?: string | null
  errorMessage?: string
  responsePayload?: Record<string, unknown>
}

function getResendApiKey(): string {
  return env.RESEND_API_KEY || ''
}

function getDefaultFromAddress(): string {
  return env.RESEND_FROM_EMAIL || 'PHWB Notifications <notifications@singforhope.org>'
}

export async function sendWithResend(input: ResendSendInput): Promise<ResendSendResult> {
  const apiKey = getResendApiKey()
  if (!apiKey) {
    return {
      ok: false,
      errorMessage: 'RESEND_API_KEY is not configured'
    }
  }

  const payload: Record<string, unknown> = {
    from: input.from || getDefaultFromAddress(),
    to: [input.to],
    subject: input.subject,
    html: input.html
  }

  if (input.replyTo) {
    payload.reply_to = input.replyTo
  }
  if (input.tags && Object.keys(input.tags).length > 0) {
    payload.tags = Object.entries(input.tags).map(([name, value]) => ({ name, value }))
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const responsePayload = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) {
      const message =
        (typeof responsePayload.message === 'string' && responsePayload.message) ||
        (typeof responsePayload.error === 'string' && responsePayload.error) ||
        `Resend request failed (${response.status})`
      return {
        ok: false,
        errorMessage: message,
        responsePayload
      }
    }

    return {
      ok: true,
      messageId: (responsePayload.id as string) || null,
      responsePayload
    }
  } catch (error) {
    return {
      ok: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown Resend error'
    }
  }
}

