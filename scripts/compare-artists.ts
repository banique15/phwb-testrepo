/**
 * Compare Supabase artists with CSV to find discrepancies
 */

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'fs/promises'

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
	console.error('Missing Supabase credentials')
	process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Parse CSV to extract names and emails
function parseCSVLine(line: string): string[] {
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

async function main() {
	console.log('Comparing Supabase artists with CSV...\n')

	// Get all artists from Supabase
	const { data: dbArtists, error } = await supabase
		.from('phwb_artists')
		.select('id, legal_first_name, legal_last_name, full_name, email, associate_id')
		.order('legal_last_name')

	if (error) {
		console.error('Error fetching artists:', error.message)
		process.exit(1)
	}

	console.log(`Found ${dbArtists?.length || 0} artists in Supabase\n`)

	// Read CSV
	const csvPath = process.argv[2] || 'artists.csv'
	const content = await readFile(csvPath, 'utf-8')
	const lines = content.split('\n').filter(line => line.trim())

	// Extract CSV artist info (first name, last name, email)
	const csvArtists: { firstName: string; lastName: string; email: string }[] = []

	for (const line of lines) {
		const cleanLine = line.replace(/^\s*\d+→/, '')
		const cols = parseCSVLine(cleanLine)

		const firstName = cols[4]?.trim()
		const lastName = cols[3]?.trim()
		const email = cols[16]?.trim()

		if (firstName && firstName !== 'LEGAL FIRST NAME') {
			csvArtists.push({ firstName, lastName, email: email?.toLowerCase() || '' })
		}
	}

	console.log(`Found ${csvArtists.length} artists in CSV\n`)

	// Find DB artists NOT in CSV
	const notInCSV: typeof dbArtists = []

	for (const dbArtist of dbArtists || []) {
		const dbEmail = dbArtist.email?.toLowerCase() || ''
		const dbFirstName = dbArtist.legal_first_name?.toLowerCase() || ''
		const dbLastName = dbArtist.legal_last_name?.toLowerCase() || ''

		// Try to match by email first, then by name
		const matchByEmail = csvArtists.some(csv => csv.email && csv.email === dbEmail)
		const matchByName = csvArtists.some(csv =>
			csv.firstName?.toLowerCase() === dbFirstName &&
			csv.lastName?.toLowerCase() === dbLastName
		)

		if (!matchByEmail && !matchByName) {
			notInCSV.push(dbArtist)
		}
	}

	console.log('=' .repeat(60))
	console.log(`Artists in Supabase but NOT in CSV: ${notInCSV.length}`)
	console.log('=' .repeat(60))

	if (notInCSV.length > 0) {
		for (const artist of notInCSV) {
			const name = artist.full_name || `${artist.legal_first_name} ${artist.legal_last_name}`
			console.log(`- ${name} (${artist.email || 'no email'})`)
		}
	} else {
		console.log('All Supabase artists are in the CSV!')
	}
}

main()
