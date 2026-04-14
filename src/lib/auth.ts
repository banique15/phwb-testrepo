import { writable } from 'svelte/store'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { browser } from '$app/environment'

export const user = writable<User | null>(null)

export const authStore = {
  subscribe: user.subscribe,

  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (error) throw error
    return data
  },

  async signInWithEmail(email: string) {
    const trimmed = (email || '').trim()
    if (!trimmed) throw new Error('Email is required')

    const { data, error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (error) throw error
    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    user.set(null)
  },

  async initialize() {
    const { data: { session } } = await supabase.auth.getSession()
    user.set(session?.user ?? null)
    return session?.user ?? null
  }
}

// Only set up auth listener in the browser
if (browser) {
  authStore.initialize()

  supabase.auth.onAuthStateChange((event, session) => {
    user.set(session?.user ?? null)
  })
}
