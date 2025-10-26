/**
 * Event Import Utility
 *
 * Imports events from CSV spreadsheets into the phwb_events table
 * Handles artist/ensemble detection, time parsing, venue mapping, and payroll generation
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
	console.error('Missing Supabase credentials')
	process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Status mapping from spreadsheet codes to database values
const STATUS_MAP: Record<string, 'confirmed' | 'hold' | 'cancelled' | 'pending'> = {
	'CC': 'confirmed',
	'C': 'confirmed',
	'CD': 'confirmed',
	'H': 'hold',
	'CS': 'confirmed',
	'CANCELLED': 'cancelled',
}

/**
 * Parse time string (e.g., "1pm-2pm", "2:00 PM", "3:30pm") to HH:MM format
 */
function parseTime(timeStr: string): string | null {
	if (!timeStr) return null

	timeStr = timeStr.trim().toLowerCase()

	// Handle range like "1pm-2pm" - extract start time
	if (timeStr.includes('-')) {
		timeStr = timeStr.split('-')[0].trim()
	}

	// Remove spaces
	timeStr = timeStr.replace(/\s+/g, '')

	// Handle "1pm" or "1:30pm" format
	const match = timeStr.match(/^(\d{1,2})(?::(\d{2}))?([ap]m)?$/)
	if (match) {
		let hours = parseInt(match[1])
		const minutes = match[2] || '00'
		const meridiem = match[3]

		if (meridiem === 'pm' && hours !== 12) {
			hours += 12
		} else if (meridiem === 'am' && hours === 12) {
			hours = 0
		}

		return `${hours.toString().padStart(2, '0')}:${minutes}`
	}

	return null
}

/**
 * Parse date string to YYYY-MM-DD format
 */
function parseDate(dateStr: string): string | null {
	if (!dateStr) return null

	// Remove day of week if present (e.g., "Monday, Jul 7, 2025" -> "Jul 7, 2025")
	dateStr = dateStr.replace(/^[A-Za-z]+,\s*/, '')

	try {
		const date = new Date(dateStr)
		if (isNaN(date.getTime())) return null

		const year = date.getFullYear()
		const month = (date.getMonth() + 1).toString().padStart(2, '0')
		const day = date.getDate().toString().padStart(2, '0')

		return `${year}-${month}-${day}`
	} catch {
		return null
	}
}

/**
 * Find venue by name (fuzzy matching)
 */
async function findVenue(venueName: string): Promise<number | null> {
	if (!venueName) return null

	// First try exact match
	const { data: exactMatch } = await supabase
		.from('phwb_venues')
		.select('id')
		.ilike('name', venueName)
		.single()

	if (exactMatch) return exactMatch.id

	// Try partial match
	const { data: partialMatches } = await supabase
		.from('phwb_venues')
		.select('id, name')
		.ilike('name', `%${venueName}%`)

	if (partialMatches && partialMatches.length > 0) {
		return partialMatches[0].id
	}

	return null
}

/**
 * Find or create artist by name
 */
async function findOrCreateArtist(artistName: string): Promise<string | null> {
	if (!artistName) return null

	// Try to find existing artist
	const { data: exactMatch } = await supabase
		.from('phwb_artists')
		.select('id')
		.or(`full_name.ilike.${artistName},artist_name.ilike.${artistName}`)
		.single()

	if (exactMatch) return exactMatch.id

	// Create new artist with minimal info
	const nameParts = artistName.trim().split(/\s+/)
	const firstName = nameParts[0]
	const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''

	const artistId = randomUUID()

	const { data: newArtist, error } = await supabase
		.from('phwb_artists')
		.insert({
			id: artistId,
			full_name: artistName,
			artist_name: artistName,
			legal_first_name: firstName,
			legal_last_name: lastName || null,
		})
		.select('id')
		.single()

	if (error) {
		console.error(`Error creating artist ${artistName}:`, error)
		return null
	}

	return newArtist?.id || null
}

/**
 * Find or create ensemble by name
 */
async function findOrCreateEnsemble(ensembleName: string, leaderName?: string): Promise<string | null> {
	if (!ensembleName) return null

	// Try to find existing ensemble
	const { data: exactMatch } = await supabase
		.from('phwb_ensembles')
		.select('id')
		.ilike('name', ensembleName)
		.single()

	if (exactMatch) return exactMatch.id

	// Find leader if provided
	let leaderId: string | null = null
	if (leaderName) {
		leaderId = await findOrCreateArtist(leaderName)
	}

	const ensembleId = randomUUID()

	// Create new ensemble
	const { data: newEnsemble, error } = await supabase
		.from('phwb_ensembles')
		.insert({
			id: ensembleId,
			name: ensembleName,
			ensemble_type: 'band', // default
			status: 'active',
			leader_id: leaderId,
		})
		.select('id')
		.single()

	if (error) {
		console.error(`Error creating ensemble ${ensembleName}:`, error)
		return null
	}

	return newEnsemble?.id || null
}

/**
 * Parse artist string and determine if it's solo, ensemble, or collaboration
 * Returns array of artist/ensemble IDs
 */
async function parseArtists(artistStr: string): Promise<string[]> {
	if (!artistStr) return []

	const artistIds: string[] = []

	// Check for common ensemble indicators
	const ensembleIndicators = ['trio', 'quartet', 'quintet', 'duo', 'ensemble', 'collective', 'band', 'massive', 'chorus']
	const isEnsemble = ensembleIndicators.some(ind => artistStr.toLowerCase().includes(ind))

	if (isEnsemble) {
		// Treat as ensemble
		const ensembleId = await findOrCreateEnsemble(artistStr)
		if (ensembleId) artistIds.push(ensembleId)
	} else if (artistStr.includes('&') || artistStr.includes(' and ') || artistStr.includes('+')) {
		// Multiple artists
		const separator = artistStr.includes('&') ? '&' : artistStr.includes('+') ? '+' : ' and '
		const names = artistStr.split(separator).map(n => n.trim())

		for (const name of names) {
			const artistId = await findOrCreateArtist(name)
			if (artistId) artistIds.push(artistId)
		}
	} else {
		// Single artist
		const artistId = await findOrCreateArtist(artistStr)
		if (artistId) artistIds.push(artistId)
	}

	return artistIds
}

interface EventRow {
	date: string
	title?: string
	location?: string
	location_detail?: string
	start_time?: string
	end_time?: string
	artist_name?: string
	number_of_musicians?: string | number
	hours?: string | number
	total_fee?: string | number
	notes?: string
	status?: string
	instrumentation?: string
	description?: string
	website?: string
	digital_flyer?: string
	event_type?: string
	program_name?: string
}

/**
 * Import a single event row
 */
async function importEvent(row: EventRow, dryRun = true): Promise<boolean> {
	try {
		// Parse date
		const date = parseDate(row.date)
		if (!date) {
			console.error(`Invalid date: ${row.date}`)
			return false
		}

		// Parse times
		const startTime = row.start_time ? parseTime(row.start_time) : null
		const endTime = row.end_time ? parseTime(row.end_time) : null

		// Find venue
		const venueId = row.location ? await findVenue(row.location) : null

		// Parse artists
		const artistIds = row.artist_name ? await parseArtists(row.artist_name) : []

		// Map status
		const confirmationStatus = row.status ? STATUS_MAP[row.status.toUpperCase()] || 'pending' : 'pending'

		// Parse numbers
		const numberOfMusicians = typeof row.number_of_musicians === 'string'
			? parseInt(row.number_of_musicians)
			: row.number_of_musicians || null

		const hours = typeof row.hours === 'string'
			? parseFloat(row.hours)
			: row.hours || null

		const totalFee = typeof row.total_fee === 'string'
			? parseFloat(row.total_fee.replace(/[^0-9.]/g, ''))
			: row.total_fee || null

		// Build event object
		const event = {
			title: row.title || row.artist_name || 'Untitled Event',
			date,
			start_time: startTime,
			end_time: endTime,
			venue: venueId,
			location_detail: row.location_detail,
			event_type: row.event_type,
			confirmation_status: confirmationStatus,
			number_of_musicians: numberOfMusicians,
			total_hours_of_service: hours,
			total_fee: totalFee,
			instrumentation_requirements: row.instrumentation,
			digital_flyer_link: row.digital_flyer,
			notes: row.notes,
			artists: artistIds.length > 0 ? artistIds : null,
			status: confirmationStatus === 'confirmed' ? 'confirmed' : 'planned',
		}

		if (dryRun) {
			console.log('\n[DRY RUN] Would import event:', JSON.stringify(event, null, 2))
			return true
		}

		// Insert event
		const { data, error } = await supabase
			.from('phwb_events')
			.insert(event)
			.select()
			.single()

		if (error) {
			console.error('Error inserting event:', error)
			return false
		}

		console.log(`✓ Imported event: ${event.title} on ${date}`)

		// TODO: Create payroll entries if confirmed and has fee

		return true
	} catch (error) {
		console.error('Error importing event:', error)
		return false
	}
}

/**
 * Main import function
 */
export async function importEvents(events: EventRow[], dryRun = true) {
	console.log(`\n${'='.repeat(60)}`)
	console.log(`Importing ${events.length} events (${dryRun ? 'DRY RUN' : 'LIVE'})`)
	console.log('='.repeat(60))

	let successCount = 0
	let failCount = 0

	for (const event of events) {
		const success = await importEvent(event, dryRun)
		if (success) {
			successCount++
		} else {
			failCount++
		}
	}

	console.log(`\n${'='.repeat(60)}`)
	console.log(`Import complete: ${successCount} succeeded, ${failCount} failed`)
	console.log(`${'='.repeat(60)}\n`)
}

// Export types
export type { EventRow }

// Export utility functions for testing
export {
	parseTime,
	parseDate,
	parseArtists,
	findVenue,
	findOrCreateArtist,
	findOrCreateEnsemble,
}
