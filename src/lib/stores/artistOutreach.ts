import { supabase } from '$lib/supabase'
import { logger } from '$lib/utils/logger'
import type {
  OutreachAttempt,
  OutreachAttemptWithUser,
  CreateOutreachInput,
  UpdateOutreachInput,
  ConfirmationStatus,
  EventConfirmationSummary
} from '$lib/schemas/outreach'
import { normalizeConfirmationStatus } from '$lib/schemas/outreach'

/**
 * Artist Outreach Store
 * Manages outreach attempts and confirmation tracking for artists on events
 */
export const artistOutreachStore = {
  /**
   * Get all outreach attempts for a specific artist on an event
   */
  async getOutreachHistory(eventId: number, artistId: string): Promise<OutreachAttemptWithUser[]> {
    try {
      const { data, error } = await supabase
        .from('phwb_artist_outreach')
        .select('*')
        .eq('event_id', eventId)
        .eq('artist_id', artistId)
        .order('outreach_date', { ascending: false })

      if (error) throw error

      // Fetch user info for performed_by fields
      const userIds = [...new Set((data || []).map((entry: any) => entry.performed_by).filter(Boolean))]
      const userMap = new Map<string, { id: string; full_name?: string; email?: string }>()

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds)

        if (profiles) {
          profiles.forEach(profile => userMap.set(profile.id, profile))
        }
      }

      // Enhance with user info
      return (data || []).map((outreach: OutreachAttempt) => ({
        ...outreach,
        performed_by_user: outreach.performed_by ? userMap.get(outreach.performed_by) : undefined
      }))
    } catch (error) {
      logger.error('Failed to fetch outreach history:', error)
      throw error
    }
  },

  /**
   * Get all outreach attempts for all artists on an event
   */
  async getEventOutreach(eventId: number): Promise<OutreachAttemptWithUser[]> {
    try {
      const { data, error } = await supabase
        .from('phwb_artist_outreach')
        .select('*')
        .eq('event_id', eventId)
        .order('outreach_date', { ascending: false })

      if (error) throw error

      // Fetch user info for performed_by fields
      const userIds = [...new Set((data || []).map((entry: any) => entry.performed_by).filter(Boolean))]
      const userMap = new Map<string, { id: string; full_name?: string; email?: string }>()

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds)

        if (profiles) {
          profiles.forEach(profile => userMap.set(profile.id, profile))
        }
      }

      // Enhance with user info
      return (data || []).map((outreach: OutreachAttempt) => ({
        ...outreach,
        performed_by_user: outreach.performed_by ? userMap.get(outreach.performed_by) : undefined
      }))
    } catch (error) {
      logger.error('Failed to fetch event outreach:', error)
      throw error
    }
  },

  /**
   * Add a new outreach attempt
   */
  async addOutreach(input: CreateOutreachInput): Promise<OutreachAttempt> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('phwb_artist_outreach')
        .insert({
          event_id: input.event_id,
          artist_id: input.artist_id,
          outreach_date: input.outreach_date || new Date().toISOString(),
          method: input.method,
          notes: input.notes || null,
          performed_by: user?.id || null,
          response_type: input.response_type || null,
          response_received_at: input.response_type ? new Date().toISOString() : null
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      logger.error('Failed to add outreach:', error)
      throw error
    }
  },

  /**
   * Update an outreach attempt (e.g., to record a response)
   */
  async updateOutreach(outreachId: string, input: UpdateOutreachInput): Promise<OutreachAttempt> {
    try {
      const updateData: any = {}

      if (input.notes !== undefined) {
        updateData.notes = input.notes
      }

      if (input.response_type !== undefined) {
        updateData.response_type = input.response_type
        // Auto-set response time if recording a response
        if (input.response_type && !input.response_received_at) {
          updateData.response_received_at = new Date().toISOString()
        }
      }

      if (input.response_received_at !== undefined) {
        updateData.response_received_at = input.response_received_at
      }

      const { data, error } = await supabase
        .from('phwb_artist_outreach')
        .update(updateData)
        .eq('id', outreachId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      logger.error('Failed to update outreach:', error)
      throw error
    }
  },

  /**
   * Delete an outreach attempt
   */
  async deleteOutreach(outreachId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('phwb_artist_outreach')
        .delete()
        .eq('id', outreachId)

      if (error) throw error
    } catch (error) {
      logger.error('Failed to delete outreach:', error)
      throw error
    }
  },

  /**
   * Get summary of outreach for each artist on an event
   * Returns the latest outreach info and derived confirmation status
   */
  async getEventOutreachSummary(eventId: number): Promise<Map<string, {
    artist_id: string
    confirmation_status: ConfirmationStatus
    last_outreach_date?: string
    last_outreach_method?: string
    outreach_count: number
    confirmation_date?: string
  }>> {
    try {
      const outreach = await this.getEventOutreach(eventId)

      // Group by artist
      const artistOutreach = new Map<string, OutreachAttempt[]>()
      for (const o of outreach) {
        const existing = artistOutreach.get(o.artist_id) || []
        existing.push(o)
        artistOutreach.set(o.artist_id, existing)
      }

      // Build summary for each artist
      const summary = new Map<string, {
        artist_id: string
        confirmation_status: ConfirmationStatus
        last_outreach_date?: string
        last_outreach_method?: string
        outreach_count: number
        confirmation_date?: string
      }>()

      for (const [artistId, attempts] of artistOutreach) {
        // Sort by date descending (most recent first)
        attempts.sort((a, b) =>
          new Date(b.outreach_date).getTime() - new Date(a.outreach_date).getTime()
        )

        const latestOutreach = attempts[0]
        const confirmedAttempt = attempts.find(a => a.response_type === 'confirmed')
        const declinedAttempt = attempts.find(a => a.response_type === 'declined')

        // Derive confirmation status from outreach history
        let confirmationStatus: ConfirmationStatus = 'not_contacted'

        if (confirmedAttempt) {
          confirmationStatus = 'confirmed'
        } else if (declinedAttempt) {
          confirmationStatus = 'declined'
        } else if (attempts.some(a => a.response_type === 'no_response')) {
          confirmationStatus = 'no_response'
        } else if (attempts.length > 0) {
          // Has outreach but no definitive response
          confirmationStatus = 'awaiting_response'
        }

        summary.set(artistId, {
          artist_id: artistId,
          confirmation_status: confirmationStatus,
          last_outreach_date: latestOutreach?.outreach_date,
          last_outreach_method: latestOutreach?.method,
          outreach_count: attempts.length,
          confirmation_date: confirmedAttempt?.response_received_at ?? declinedAttempt?.response_received_at ?? undefined
        })
      }

      return summary
    } catch (error) {
      logger.error('Failed to get event outreach summary:', error)
      throw error
    }
  },

  /**
   * Get aggregate confirmation summary for an event
   */
  async getConfirmationSummary(eventId: number, artistIds: string[]): Promise<EventConfirmationSummary> {
    try {
      const outreachSummary = await this.getEventOutreachSummary(eventId)

      const summary: EventConfirmationSummary = {
        total_artists: artistIds.length,
        confirmed: 0,
        declined: 0,
        awaiting_response: 0,
        not_contacted: 0,
        no_response: 0,
        contacted: 0
      }

      for (const artistId of artistIds) {
        const artistSummary = outreachSummary.get(artistId)
        const status = artistSummary?.confirmation_status || 'not_contacted'

        switch (status) {
          case 'confirmed':
            summary.confirmed++
            break
          case 'declined':
            summary.declined++
            break
          case 'awaiting_response':
            summary.awaiting_response++
            break
          case 'not_contacted':
            summary.not_contacted++
            break
          case 'no_response':
            summary.no_response++
            break
          case 'contacted':
            summary.contacted++
            break
        }
      }

      return summary
    } catch (error) {
      logger.error('Failed to get confirmation summary:', error)
      throw error
    }
  }
}
