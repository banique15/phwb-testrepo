import { writable } from 'svelte/store'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { browser } from '$app/environment'

export const user = writable<User | null>(null)

export const authStore = {
  subscribe: user.subscribe,
  
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (error) throw error
    return data
  },
  
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) throw error
    
    user.set(data.user)
    return data
  },
  
  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    
    user.set(null)
  },
  
  async initialize() {
    // Get the current session
    const { data: { session } } = await supabase.auth.getSession()
    user.set(session?.user ?? null)
    return session?.user ?? null
  }
}

// Only set up auth listener in the browser
if (browser) {
  // Initialize auth state on startup
  authStore.initialize()
  
  // Listen for auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    user.set(session?.user ?? null)
  })
}