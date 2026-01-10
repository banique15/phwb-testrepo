import { z } from 'zod'

// Confirmation status for an artist on an event
export const confirmationStatusEnum = z.enum([
  'not_contacted',    // Initial state - no outreach yet
  'contacted',        // At least one outreach attempt made
  'awaiting_response', // Contacted, waiting for reply
  'confirmed',        // Artist confirmed attendance
  'declined',         // Artist declined
  'no_response'       // No response after multiple attempts
])

export type ConfirmationStatus = z.infer<typeof confirmationStatusEnum>

// Outreach method
export const outreachMethodEnum = z.enum(['email', 'phone', 'text', 'in_person', 'other'])
export type OutreachMethod = z.infer<typeof outreachMethodEnum>

// Response type from artist
export const responseTypeEnum = z.enum(['confirmed', 'declined', 'maybe', 'no_response'])
export type ResponseType = z.infer<typeof responseTypeEnum>

// Schema for outreach attempt record
export const outreachAttemptSchema = z.object({
  id: z.string().uuid(),
  event_id: z.number(),
  artist_id: z.string().uuid(),
  outreach_date: z.string(), // ISO timestamp
  method: outreachMethodEnum,
  notes: z.string().max(2000).optional().nullable(),
  performed_by: z.string().uuid().optional().nullable(),
  response_received_at: z.string().optional().nullable(),
  response_type: responseTypeEnum.optional().nullable(),
  created_at: z.string(),
  updated_at: z.string()
})

export type OutreachAttempt = z.infer<typeof outreachAttemptSchema>

// Outreach attempt with user info populated
export interface OutreachAttemptWithUser extends OutreachAttempt {
  performed_by_user?: {
    id: string
    full_name?: string
    email?: string
  }
}

// Input for creating a new outreach attempt
export const createOutreachSchema = z.object({
  event_id: z.number(),
  artist_id: z.string().uuid(),
  outreach_date: z.string().optional(), // Defaults to now
  method: outreachMethodEnum,
  notes: z.string().max(2000).optional(),
  response_type: responseTypeEnum.optional() // Can immediately record response
})

export type CreateOutreachInput = z.infer<typeof createOutreachSchema>

// Input for updating an outreach attempt
export const updateOutreachSchema = z.object({
  notes: z.string().max(2000).optional(),
  response_received_at: z.string().optional(),
  response_type: responseTypeEnum.optional().nullable()
})

export type UpdateOutreachInput = z.infer<typeof updateOutreachSchema>

// Enhanced artist assignment with confirmation tracking
export interface ArtistAssignment {
  artist_id: string
  artist_name?: string
  role?: string

  // Confirmation status (enhanced from old 'pending' | 'confirmed' | 'declined')
  confirmation_status: ConfirmationStatus

  // Tracking fields (derived from outreach records)
  last_outreach_date?: string
  outreach_count?: number
  confirmation_date?: string

  // Existing fields
  num_hours?: number
  hourly_rate?: number
  notes?: string

  // Legacy status field for backward compatibility
  status?: 'pending' | 'confirmed' | 'declined'
}

// Summary of confirmation status for an event
export interface EventConfirmationSummary {
  total_artists: number
  confirmed: number
  declined: number
  awaiting_response: number
  not_contacted: number
  no_response: number
  contacted: number
}

// Helper to normalize old status to new confirmation_status
export function normalizeConfirmationStatus(
  oldStatus?: 'pending' | 'confirmed' | 'declined',
  confirmationStatus?: ConfirmationStatus
): ConfirmationStatus {
  // If new status exists, use it
  if (confirmationStatus) return confirmationStatus

  // Map old status to new
  switch (oldStatus) {
    case 'confirmed':
      return 'confirmed'
    case 'declined':
      return 'declined'
    case 'pending':
    default:
      return 'not_contacted'
  }
}

// Helper to get display info for confirmation status
export function getConfirmationStatusInfo(status: ConfirmationStatus): {
  label: string
  color: string
  badgeClass: string
  icon: string
} {
  switch (status) {
    case 'not_contacted':
      return {
        label: 'Not Contacted',
        color: 'gray',
        badgeClass: 'badge-ghost',
        icon: 'circle'
      }
    case 'contacted':
      return {
        label: 'Contacted',
        color: 'blue',
        badgeClass: 'badge-info',
        icon: 'send'
      }
    case 'awaiting_response':
      return {
        label: 'Awaiting Response',
        color: 'yellow',
        badgeClass: 'badge-warning',
        icon: 'clock'
      }
    case 'confirmed':
      return {
        label: 'Confirmed',
        color: 'green',
        badgeClass: 'badge-success',
        icon: 'check-circle'
      }
    case 'declined':
      return {
        label: 'Declined',
        color: 'red',
        badgeClass: 'badge-error',
        icon: 'x-circle'
      }
    case 'no_response':
      return {
        label: 'No Response',
        color: 'orange',
        badgeClass: 'badge-warning badge-outline',
        icon: 'alert-circle'
      }
  }
}

// Helper to get display info for outreach method
export function getOutreachMethodInfo(method: OutreachMethod): {
  label: string
  icon: string
} {
  switch (method) {
    case 'email':
      return { label: 'Email', icon: 'mail' }
    case 'phone':
      return { label: 'Phone', icon: 'phone' }
    case 'text':
      return { label: 'Text', icon: 'message-square' }
    case 'in_person':
      return { label: 'In Person', icon: 'user' }
    case 'other':
      return { label: 'Other', icon: 'more-horizontal' }
  }
}
