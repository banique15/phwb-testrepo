/**
 * Artist Export Service
 * CSV export and sample template for artists (export/import round-trip).
 */

import type { Artist } from '$lib/schemas/artist'
import { downloadCSV } from '$lib/utils/index'

/** CSV column headers used for export and import (must match sample template) */
export const ARTIST_CSV_HEADERS = [
	'legal_first_name',
	'legal_last_name',
	'email',
	'phone',
	'full_name',
	'artist_name',
	'employment_status',
	'llc_name',
	'metropolitan_hub',
	'location',
	'address',
	'city',
	'state',
	'zip_code',
	'bio',
	'one_sentence_bio',
	'sightreads',
	'can_be_soloist',
	'genres',
	'instruments',
	'languages',
	'website',
	'instagram',
	'facebook',
	'dob',
	'shirt_size',
	'notes'
] as const

function escapeCSV(value: unknown): string {
	if (value == null) return ''
	const s = String(value)
	// Quote if contains comma, newline, or double quote
	if (/[,"\n\r]/.test(s)) {
		return `"${s.replace(/"/g, '""')}"`
	}
	return s
}

function toCSVValue(value: unknown): string {
	if (value == null || value === '') return ''
	if (typeof value === 'boolean') return value ? 'true' : 'false'
	if (Array.isArray(value)) return value.join(';')
	return escapeCSV(value)
}

/**
 * Build a single CSV row from an artist (same column order as ARTIST_CSV_HEADERS).
 */
export function artistToCSVRow(artist: Partial<Artist>): string[] {
	return ARTIST_CSV_HEADERS.map(header => {
		const v = (artist as Record<string, unknown>)[header]
		return toCSVValue(v)
	})
}

/**
 * Generate full CSV string from artists (header row + data rows).
 */
export function artistsToCSV(artists: Partial<Artist>[]): string {
	const headerRow = ARTIST_CSV_HEADERS.join(',')
	const dataRows = artists.map(a => artistToCSVRow(a).join(','))
	return [headerRow, ...dataRows].join('\n')
}

/**
 * Generate sample CSV template (header + one example row) for download.
 */
export function generateArtistCSVTemplate(): string {
	const headers = [...ARTIST_CSV_HEADERS]
	const sampleRow = [
		'Jane',
		'Doe',
		'jane.doe@example.com',
		'555-123-4567',
		'Jane Doe',
		'Jane D.',
		'1099',
		'Jane Doe LLC',
		'New York',
		'New York, NY',
		'123 Main St',
		'New York',
		'NY',
		'10001',
		'Pianist and educator.',
		'Pianist and educator.',
		'true',
		'true',
		'Classical;Jazz',
		'Piano;Voice',
		'English;Spanish',
		'https://janedoe.com',
		'@janedoe',
		'',
		'1990-05-15',
		'M',
		''
	]
	return [headers.join(','), sampleRow.join(',')].join('\n')
}

/**
 * Export artists to CSV and trigger download.
 */
export function exportArtistsAsCSV(artists: Partial<Artist>[], filename?: string): void {
	const csv = artistsToCSV(artists)
	const name = filename || `artists-export-${new Date().toISOString().slice(0, 10)}.csv`
	downloadCSV(csv, name)
}

/**
 * Parse a single CSV line (handles quoted fields and escaped quotes).
 */
function parseCSVLine(line: string): string[] {
	line = line.replace(/\r$/, '')
	const result: string[] = []
	let current = ''
	let inQuotes = false
	for (let i = 0; i < line.length; i++) {
		const char = line[i]
		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"'
				i++
			} else {
				inQuotes = !inQuotes
			}
		} else if (char === ',' && !inQuotes) {
			result.push(current.trim())
			current = ''
		} else {
			current += char
		}
	}
	result.push(current.trim())
	return result
}

export function parseArtistCSVFile(file: File): Promise<Record<string, string>[]> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = (e) => {
			try {
				const text = (e.target?.result as string) || ''
				const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
				if (lines.length < 2) {
					reject(new Error('CSV must have a header row and at least one data row'))
					return
				}
				const headers = parseCSVLine(lines[0])
				const rows: Record<string, string>[] = []
				for (let i = 1; i < lines.length; i++) {
					const values = parseCSVLine(lines[i])
					const row: Record<string, string> = {}
					headers.forEach((h, j) => {
						row[h] = values[j] ?? ''
					})
					rows.push(row)
				}
				resolve(rows)
			} catch (err) {
				reject(err)
			}
		}
		reader.onerror = () => reject(new Error('Failed to read file'))
		reader.readAsText(file)
	})
}

/** Coerce a CSV row (string values) into a create-artist payload. */
export function csvRowToCreateArtist(row: Record<string, string>): Record<string, unknown> {
	const arr = (v: string) => (v ? v.split(';').map((s) => s.trim()).filter(Boolean) : undefined)
	const bool = (v: string) => (v === 'true' || v === '1')
	const out: Record<string, unknown> = {}
	const set = (key: string, value: unknown) => {
		if (value !== undefined && value !== '') out[key] = value
	}
	set('legal_first_name', row.legal_first_name?.trim() || '')
	set('legal_last_name', row.legal_last_name?.trim() || undefined)
	set('email', row.email?.trim() || undefined)
	set('phone', row.phone?.trim() || undefined)
	set('full_name', row.full_name?.trim() || undefined)
	set('artist_name', row.artist_name?.trim() || undefined)
	set('employment_status', row.employment_status?.trim() || undefined)
	set('llc_name', row.llc_name?.trim() || undefined)
	set('metropolitan_hub', row.metropolitan_hub?.trim() || undefined)
	set('location', row.location?.trim() || undefined)
	set('address', row.address?.trim() || undefined)
	set('city', row.city?.trim() || undefined)
	set('state', row.state?.trim() || undefined)
	set('zip_code', row.zip_code?.trim() || undefined)
	set('bio', row.bio?.trim() || undefined)
	set('one_sentence_bio', row.one_sentence_bio?.trim() || undefined)
	set('sightreads', row.sightreads ? bool(row.sightreads) : undefined)
	set('can_be_soloist', row.can_be_soloist ? bool(row.can_be_soloist) : undefined)
	set('genres', arr(row.genres))
	set('instruments', arr(row.instruments))
	set('languages', arr(row.languages))
	set('website', row.website?.trim() || undefined)
	set('instagram', row.instagram?.trim() || undefined)
	set('facebook', row.facebook?.trim() || undefined)
	set('dob', row.dob?.trim() || undefined)
	set('shirt_size', row.shirt_size?.trim() || undefined)
	return out
}
