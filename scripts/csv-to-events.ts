/**
 * CSV to Events Converter
 *
 * Converts CSV files from spreadsheets to event import format
 * Usage: bun run scripts/csv-to-events.ts <csv-file> [--sheet-type=msk|clc|moynihan]
 */

import { readFileSync } from 'fs'
import { importEvents, type EventRow } from './import-events'

function parseCsvLine(line: string): string[] {
	const result: string[] = []
	let current = ''
	let inQuotes = false

	for (let i = 0; i < line.length; i++) {
		const char = line[i]

		if (char === '"') {
			inQuotes = !inQuotes
		} else if (char === '\t' && !inQuotes) {
			result.push(current.trim())
			current = ''
		} else {
			current += char
		}
	}

	result.push(current.trim())
	return result
}

function parseCSV(csvContent: string): string[][] {
	const lines = csvContent.split('\n').filter(line => line.trim())
	return lines.map(line => parseCsvLine(line))
}

// Sheet type mapping
type SheetType = 'msk' | 'clc' | 'moynihan'

function convertMskRow(row: string[]): EventRow | null {
	// Sheet 1 columns: Date, Location, Time, Artist Name/Bandleader, No of Musicians, Hours,
	// Total Musician Fee Hours, Notes, Artist/Bandleader Contact, Status, Instrumentation & requirements,
	// Artist Description, Additional artist names, Digital Flyer Link, Artist Website

	if (!row[0] || row[0].toLowerCase().includes('date')) return null // Skip header

	const [date, location, time, artistName, numMusicians, hours, , notes, contact, status,
		instrumentation, description, , digitalFlyer, website] = row

	const [startTime, endTime] = time ? time.split('-').map(t => t.trim()) : [null, null]

	return {
		date,
		location: 'MSK',
		location_detail: location,
		start_time: startTime || undefined,
		end_time: endTime || undefined,
		artist_name: artistName,
		number_of_musicians: numMusicians ? parseInt(numMusicians) : undefined,
		hours: hours ? parseFloat(hours) : undefined,
		notes,
		status,
		instrumentation,
		description,
		website,
		digital_flyer: digitalFlyer,
		event_type: 'Performance',
		program_name: 'MSK',
	}
}

function convertClcRow(row: string[]): EventRow | null {
	// Sheet 2 columns: DATE, Type, Location, START TIME, END TIME, ARTIST, NOTES / SPECIAL DETAILS,
	// Confirmation status, TOTAL HRS, # ARTISTS, TOTAL HOURS OF SERVICE, TOTAL FEE, PDF, PNG

	if (!row[0] || row[0].toLowerCase().includes('date')) return null // Skip header

	const [date, eventType, location, startTime, endTime, artist, notes, status, , numArtists,
		totalHours, totalFee] = row

	return {
		date,
		location,
		start_time: startTime,
		end_time: endTime,
		artist_name: artist,
		number_of_musicians: numArtists ? parseInt(numArtists) : undefined,
		hours: totalHours ? parseFloat(totalHours) : undefined,
		total_fee: totalFee ? parseFloat(totalFee.replace(/[^0-9.]/g, '')) : undefined,
		notes,
		status,
		event_type: eventType,
		program_name: 'CLC',
	}
}

function convertMoynihanRow(row: string[]): EventRow | null {
	// Sheet 3 columns: Date, Start Time, End Time, Artist, Status, # Musicians, Description, Link

	if (!row[0] || row[0].toLowerCase().includes('date')) return null // Skip header

	const [date, startTime, endTime, artist, status, numMusicians, description, link] = row

	return {
		date,
		location: 'Moynihan Train Hall',
		start_time: startTime,
		end_time: endTime,
		artist_name: artist,
		number_of_musicians: numMusicians ? parseInt(numMusicians) : undefined,
		description,
		digital_flyer: link,
		status,
		event_type: 'Performance',
		program_name: 'Moynihan Train Hall',
	}
}

// Main execution
const args = process.argv.slice(2)
const csvFile = args.find(arg => !arg.startsWith('--'))
const sheetTypeArg = args.find(arg => arg.startsWith('--sheet-type='))
const dryRun = args.includes('--dry-run')

if (!csvFile) {
	console.error('Usage: bun run scripts/csv-to-events.ts <csv-file> [--sheet-type=msk|clc|moynihan] [--dry-run]')
	process.exit(1)
}

const sheetType = (sheetTypeArg?.split('=')[1] as SheetType) || 'msk'

console.log(`Reading CSV file: ${csvFile}`)
console.log(`Sheet type: ${sheetType}`)
console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`)

try {
	const csvContent = readFileSync(csvFile, 'utf-8')
	const rows = parseCSV(csvContent)

	const events: EventRow[] = []

	for (const row of rows) {
		let event: EventRow | null = null

		switch (sheetType) {
			case 'msk':
				event = convertMskRow(row)
				break
			case 'clc':
				event = convertClcRow(row)
				break
			case 'moynihan':
				event = convertMoynihanRow(row)
				break
		}

		if (event) {
			events.push(event)
		}
	}

	console.log(`Parsed ${events.length} events from CSV\n`)

	importEvents(events, dryRun)
		.then(() => {
			console.log('Import complete!')
			process.exit(0)
		})
		.catch((error) => {
			console.error('Import failed:', error)
			process.exit(1)
		})
} catch (error) {
	console.error('Error reading CSV file:', error)
	process.exit(1)
}
