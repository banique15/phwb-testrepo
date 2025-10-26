import { derived, get } from 'svelte/store'
import { venuesStore } from './venues'
import { programsStore } from './programs'
import { artistsStore } from './artists'
import type { Venue } from '$lib/schemas/venue'
import type { Program } from '$lib/schemas/program'
import type { Artist } from '$lib/schemas/artist'

// Derived stores for each entity (no memory leaks)
const venuesState = derived(venuesStore, $store => $store.items)
const programsState = derived(programsStore, $store => $store.items)
const artistsState = derived(artistsStore, $store => $store.items)

// Derived lookup maps for quick ID-to-name resolution
export const venueLookup = derived(venuesState, ($venues) => {
	const lookup = new Map<number, string>()
	$venues.forEach(venue => {
		if (venue.id && venue.name) {
			lookup.set(venue.id, venue.name)
		}
	})
	return lookup
})

export const programLookup = derived(programsState, ($programs) => {
	const lookup = new Map<number, string>()
	$programs.forEach(program => {
		if (program.id && program.title) {
			lookup.set(program.id, program.title)
		}
	})
	return lookup
})

export const artistLookup = derived(artistsState, ($artists) => {
	const lookup = new Map<string, string>()
	$artists.forEach(artist => {
		if (artist.id) {
			// Use full_name or fall back to artist_name, then legal names
			const name = artist.full_name || 
						artist.artist_name || 
						`${artist.legal_first_name || ''} ${artist.legal_last_name || ''}`.trim() ||
						`${artist.public_first_name || ''} ${artist.public_last_name || ''}`.trim() ||
						'Unknown Artist'
			lookup.set(artist.id, name)
		}
	})
	return lookup
})

// Utility functions to resolve IDs to names
export const lookupUtils = {
	getVenueName: (id: number | undefined, fallback = 'Unknown Venue') => {
		if (!id) return fallback
		const lookup = get(venueLookup)
		return lookup.get(id) || fallback
	},

	getProgramName: (id: number | undefined, fallback = 'Unknown Program') => {
		if (!id) return fallback
		const lookup = get(programLookup)
		return lookup.get(id) || fallback
	},

	getArtistName: (id: string | undefined, fallback = 'Unknown Artist') => {
		if (!id) return fallback
		const lookup = get(artistLookup)
		return lookup.get(id) || fallback
	},

	// Initialize all lookups by fetching data
	async initialize() {
		try {
			await Promise.all([
				venuesStore.fetchAll(),
				programsStore.fetchAll(),
				artistsStore.fetchAll()
			])
		} catch (error) {
			console.error('Failed to initialize lookup data:', error)
		}
	}
}

// Enhanced lookup that returns full objects for richer displays
export const enhancedLookup = {
	getVenue: (id: number | undefined): Venue | null => {
		if (!id) return null
		const venues = get(venuesState)
		return venues.find(v => v.id === id) || null
	},

	getProgram: (id: number | undefined): Program | null => {
		if (!id) return null
		const programs = get(programsState)
		return programs.find(p => p.id === id) || null
	},

	getArtist: (id: string | undefined): Artist | null => {
		if (!id) return null
		const artists = get(artistsState)
		return artists.find(a => a.id === id) || null
	}
}