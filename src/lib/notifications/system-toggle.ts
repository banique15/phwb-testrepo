import type { SupabaseClient } from '@supabase/supabase-js'

const GLOBAL_NOTIFICATIONS_ENTITY = 'notification_system'
const GLOBAL_NOTIFICATIONS_FIELD = 'enabled'

export function parseBooleanConfigValue(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return fallback

  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) return true
  if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) return false
  return fallback
}

export async function areNotificationsGloballyEnabled(
  supabaseClient: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from('phwb_config_options')
    .select('value')
    .eq('entity', GLOBAL_NOTIFICATIONS_ENTITY)
    .eq('field', GLOBAL_NOTIFICATIONS_FIELD)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) {
    return true
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null
  return parseBooleanConfigValue(row?.value, true)
}

export const GLOBAL_NOTIFICATIONS_TOGGLE_KEY = {
  entity: GLOBAL_NOTIFICATIONS_ENTITY,
  field: GLOBAL_NOTIFICATIONS_FIELD
}
