/**
 * Migrate Artists from CSV to Supabase
 *
 * This script imports artist data from the HR CSV export into Supabase.
 * It handles all 145 records (W2 + 1099) and creates proper database entries.
 *
 * Usage: bun run scripts/migrate-csv-artists.ts [csv-file-path]
 * Default: artists.csv in project root
 */

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'fs/promises'
import { parse } from 'path'

// Get Supabase credentials from environment
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
	console.error('Missing Supabase credentials')
	console.error('Make sure PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are set')
	process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// CSV column indices (0-based, after splitting)
const COL = {
	EMPLOYMENT_TYPE: 0,        // W2 / 1099
	LLC_NAME: 1,               // LLC NAME (IF APPLICABLE)
	NOT_ONBOARDED: 2,          // INDIVIDUAL NOT YET ONBOARDED?
	LAST_NAME: 3,              // LEGAL LAST NAME
	FIRST_NAME: 4,             // LEGAL FIRST NAME
	MIDDLE_NAME: 5,            // LEGAL MIDDLE NAME
	GENDER_SELF: 6,            // GENDER (SELF-ID)
	GENDER_INSURANCE: 7,       // GENDER FOR INSURANCE COVERAGE
	BIRTH_DATE: 8,             // BIRTH DATE
	ADDRESS_1: 9,              // PRIMARY ADDRESS LINE 1
	ADDRESS_2: 10,             // PRIMARY ADDRESS LINE 2
	CITY: 11,                  // PRIMARY ADDRESS - CITY
	STATE: 12,                 // PRIMARY ADDRESS - STATE / TERRITORY
	ZIP_CODE: 13,              // PRIMARY ADDRESS - ZIP CODE
	LIVED_IN_STATE: 14,        // LIVED-IN STATE
	WORKED_IN_STATE: 15,       // WORKED IN STATE
	PERSONAL_EMAIL: 16,        // PERSONAL E-MAIL
	WORK_EMAIL: 17,            // WORK E-MAIL
	PHONE: 18,                 // PHONE #
	ETHNIC_GROUP: 19,          // ETHNIC GROUP
	RACE: 20,                  // RACE/ETHNICITY
	MARITAL_STATUS: 21,        // MARITAL STATUS DESCRIPTION
	ASSOCIATE_ID: 22,          // ASSOCIATE ID
	JOB_TITLE: 23,             // JOB TITLE
	WORKER_CATEGORY: 24,       // WORKER CATEGORY
	POSITION_STATUS: 25,       // POSITION STATUS
	HIRE_DATE: 26,             // HIRE DATE
	TERMINATION_DATE: 27,      // TERMINATION DATE
	YEARS_OF_SERVICE: 28,      // YEARS OF SERVICE
	INSTRUMENT: 29,            // INSTRUMENT
	ENSEMBLES: 30,             // WHAT SFH ENSEMBLES DO YOU PLAY WITH?
	GENRES: 31,                // GENRE(S)
	SIGHT_READING: 32,         // LEVEL OF SIGHT READING
	HEADSHOT: 33,              // HEADSHOT
	ONE_SENTENCE_BIO: 34,      // ONE SENTENCE BIO
	WEBSITE: 35,               // WEBSITE
	INSTAGRAM: 36,             // INSTAGRAM HANDLE
	SOCIAL_MEDIA: 37,          // ADD'L SOCIAL MEDIA
}

// Known data quality issues - phone numbers that are actually birthdates
const PHONE_BIRTHDATE_FIXES: Record<string, string> = {
	'02/25/1994': 'Adam Narimatsu',
	'06/16/1956': 'Leslie Nero',
	'11/18/1985': 'Hope Nwachukwu',
	'03/27/1981': "Harold O'Neal",
}

interface ArtistRecord {
	// Identity
	legal_first_name: string
	legal_last_name: string | null
	middle_name: string | null
	full_name: string
	artist_name: string

	// Contact
	email: string | null
	work_email: string | null
	phone: string | null

	// Address
	address: string | null
	address_line_2: string | null
	city: string | null
	state: string | null
	zip_code: string | null
	lived_in_state: string | null
	worked_in_state: string | null

	// Demographics
	dob: string | null
	gender: string | null
	ethnicity: string | null
	race: string | null
	marital_status: string | null

	// Employment
	employment_status: string | null
	llc_name: string | null
	associate_id: string | null
	job_title: string | null
	worker_category: string | null
	position_status: 'active' | 'terminated' | null
	hire_date: string | null
	termination_date: string | null
	onboarding_complete: boolean

	// Music
	instruments: string[] | null
	genres: string[] | null
	ensembles_text: string | null
	sight_reading_level: string | null
	sightreads: boolean

	// Profile
	profile_photo: string | null
	one_sentence_bio: string | null
	website: string | null
	instagram: string | null
	facebook: string | null
}

function parseCSVLine(line: string): string[] {
	const result: string[] = []
	let current = ''
	let inQuotes = false

	for (let i = 0; i < line.length; i++) {
		const char = line[i]

		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				// Escaped quote
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

function parseDate(dateStr: string): string | null {
	if (!dateStr || dateStr.trim() === '') return null

	// Handle MM/DD/YYYY format
	const parts = dateStr.split('/')
	if (parts.length === 3) {
		const [month, day, year] = parts
		// Convert to YYYY-MM-DD
		return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
	}

	return null
}

function cleanPhone(phone: string): string | null {
	if (!phone || phone.trim() === '') return null

	// Check if this is a known birthdate in phone field
	if (PHONE_BIRTHDATE_FIXES[phone]) {
		console.log(`  Warning: Phone field contains birthdate for ${PHONE_BIRTHDATE_FIXES[phone]}`)
		return null
	}

	// Remove non-digit characters except + at start
	const cleaned = phone.replace(/[^\d+]/g, '')
	if (cleaned.length < 7) return null

	return cleaned
}

function parseCommaSeparatedList(value: string): string[] | null {
	if (!value || value.trim() === '') return null

	return value
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0)
}

function mapPositionStatus(status: string): 'active' | 'terminated' | null {
	if (!status) return null
	if (status.startsWith('A')) return 'active'
	if (status.startsWith('T')) return 'terminated'
	return null
}

function parseRow(columns: string[], rowNumber: number): ArtistRecord | null {
	const firstName = columns[COL.FIRST_NAME]?.trim()

	// Skip header row or empty rows
	if (!firstName || firstName === 'LEGAL FIRST NAME') {
		return null
	}

	const lastName = columns[COL.LAST_NAME]?.trim() || null
	const middleName = columns[COL.MIDDLE_NAME]?.trim() || null

	// Build full name
	const nameParts = [firstName]
	if (middleName) nameParts.push(middleName)
	if (lastName) nameParts.push(lastName)
	const fullName = nameParts.join(' ')

	// Parse sight reading - check if text contains confident language
	const sightReadingText = columns[COL.SIGHT_READING]?.trim() || ''
	const sightreads = sightReadingText.toLowerCase().includes('confident')

	// Parse employment type
	const empType = columns[COL.EMPLOYMENT_TYPE]?.trim()
	const employmentStatus = empType === 'W2' ? 'W2' : empType === '1099' ? '1099' : null

	// Check for known phone/birthdate issue
	const phoneRaw = columns[COL.PHONE]?.trim()
	let phone = cleanPhone(phoneRaw)
	let dob = parseDate(columns[COL.BIRTH_DATE])

	// If phone looks like a date, it might be the birthdate
	if (phoneRaw && /^\d{2}\/\d{2}\/\d{4}$/.test(phoneRaw) && !dob) {
		console.log(`  Row ${rowNumber}: Using phone value as birthdate: ${phoneRaw}`)
		dob = parseDate(phoneRaw)
		phone = null
	}

	const record: ArtistRecord = {
		// Identity
		legal_first_name: firstName,
		legal_last_name: lastName,
		middle_name: middleName,
		full_name: fullName,
		artist_name: fullName, // Default to full name

		// Contact
		email: columns[COL.PERSONAL_EMAIL]?.trim() || null,
		work_email: columns[COL.WORK_EMAIL]?.trim() || null,
		phone: phone,

		// Address
		address: columns[COL.ADDRESS_1]?.trim() || null,
		address_line_2: columns[COL.ADDRESS_2]?.trim() || null,
		city: columns[COL.CITY]?.trim() || null,
		state: columns[COL.STATE]?.trim() || null,
		zip_code: columns[COL.ZIP_CODE]?.trim() || null,
		lived_in_state: columns[COL.LIVED_IN_STATE]?.trim() || null,
		worked_in_state: columns[COL.WORKED_IN_STATE]?.trim() || null,

		// Demographics
		dob: dob,
		gender: columns[COL.GENDER_SELF]?.trim() || columns[COL.GENDER_INSURANCE]?.trim() || null,
		ethnicity: columns[COL.ETHNIC_GROUP]?.trim() || null,
		race: columns[COL.RACE]?.trim() || null,
		marital_status: columns[COL.MARITAL_STATUS]?.trim() || null,

		// Employment
		employment_status: employmentStatus,
		llc_name: columns[COL.LLC_NAME]?.trim() || null,
		associate_id: columns[COL.ASSOCIATE_ID]?.trim() || null,
		job_title: columns[COL.JOB_TITLE]?.trim() || null,
		worker_category: columns[COL.WORKER_CATEGORY]?.trim() || null,
		position_status: mapPositionStatus(columns[COL.POSITION_STATUS]),
		hire_date: parseDate(columns[COL.HIRE_DATE]),
		termination_date: parseDate(columns[COL.TERMINATION_DATE]),
		onboarding_complete: columns[COL.NOT_ONBOARDED]?.trim()?.toUpperCase() !== 'Y',

		// Music
		instruments: parseCommaSeparatedList(columns[COL.INSTRUMENT]),
		genres: parseCommaSeparatedList(columns[COL.GENRES]),
		ensembles_text: columns[COL.ENSEMBLES]?.trim() || null,
		sight_reading_level: sightReadingText || null,
		sightreads: sightreads,

		// Profile
		profile_photo: columns[COL.HEADSHOT]?.trim() || null,
		one_sentence_bio: columns[COL.ONE_SENTENCE_BIO]?.trim() || null,
		website: columns[COL.WEBSITE]?.trim() || null,
		instagram: columns[COL.INSTAGRAM]?.trim() || null,
		facebook: columns[COL.SOCIAL_MEDIA]?.trim() || null,
	}

	return record
}

async function migrateArtists(csvPath: string) {
	console.log('\n Reading CSV file...')
	const content = await readFile(csvPath, 'utf-8')
	const lines = content.split('\n').filter((line) => line.trim())

	console.log(`   Total lines: ${lines.length}`)

	const artists: ArtistRecord[] = []
	const errors: { row: number; error: string }[] = []

	// Parse each line (skip header)
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		// Skip the line number prefix if present (e.g., "     2→")
		const cleanLine = line.replace(/^\s*\d+→/, '')

		try {
			const columns = parseCSVLine(cleanLine)
			const record = parseRow(columns, i + 1)

			if (record) {
				artists.push(record)
			}
		} catch (error) {
			errors.push({ row: i + 1, error: String(error) })
		}
	}

	console.log(`   Parsed ${artists.length} artist records`)
	if (errors.length > 0) {
		console.log(`   Errors: ${errors.length}`)
		errors.forEach((e) => console.log(`     Row ${e.row}: ${e.error}`))
	}

	// Show summary by type
	const w2Count = artists.filter((a) => a.employment_status === 'W2').length
	const count1099 = artists.filter((a) => a.employment_status === '1099').length
	const activeCount = artists.filter((a) => a.position_status === 'active').length
	const terminatedCount = artists.filter((a) => a.position_status === 'terminated').length

	console.log('\n Summary:')
	console.log(`   W2 employees: ${w2Count}`)
	console.log(`   1099 contractors: ${count1099}`)
	console.log(`   Active: ${activeCount}`)
	console.log(`   Terminated: ${terminatedCount}`)

	return artists
}

async function upsertArtists(artists: ArtistRecord[]) {
	console.log('\n Importing to Supabase...')

	let imported = 0
	let updated = 0
	let errored = 0

	// Process one at a time to handle upserts properly
	for (const artist of artists) {
		try {
			// Check if artist already exists by associate_id or email
			let existingId: string | null = null

			if (artist.associate_id) {
				const { data: existing } = await supabase
					.from('phwb_artists')
					.select('id')
					.eq('associate_id', artist.associate_id)
					.single()

				if (existing) {
					existingId = existing.id
				}
			}

			if (!existingId && artist.email) {
				const { data: existing } = await supabase
					.from('phwb_artists')
					.select('id')
					.eq('email', artist.email)
					.single()

				if (existing) {
					existingId = existing.id
				}
			}

			if (existingId) {
				// Update existing record
				const { error } = await supabase.from('phwb_artists').update(artist).eq('id', existingId)

				if (error) {
					console.log(`   Error updating ${artist.full_name}: ${error.message}`)
					errored++
				} else {
					updated++
				}
			} else {
				// Insert new record
				const { error } = await supabase.from('phwb_artists').insert(artist)

				if (error) {
					console.log(`   Error inserting ${artist.full_name}: ${error.message}`)
					errored++
				} else {
					imported++
				}
			}
		} catch (error) {
			console.log(`   Exception for ${artist.full_name}: ${error}`)
			errored++
		}
	}

	console.log('\n Import complete:')
	console.log(`   New records: ${imported}`)
	console.log(`   Updated records: ${updated}`)
	console.log(`   Errors: ${errored}`)

	return { imported, updated, errored }
}

async function verifyImport() {
	console.log('\n Verifying import...')

	const { count: totalCount } = await supabase
		.from('phwb_artists')
		.select('*', { count: 'exact', head: true })

	const { count: withAssociateId } = await supabase
		.from('phwb_artists')
		.select('*', { count: 'exact', head: true })
		.not('associate_id', 'is', null)

	const { count: activeCount } = await supabase
		.from('phwb_artists')
		.select('*', { count: 'exact', head: true })
		.eq('position_status', 'active')

	const { count: terminatedCount } = await supabase
		.from('phwb_artists')
		.select('*', { count: 'exact', head: true })
		.eq('position_status', 'terminated')

	console.log('\n Database counts:')
	console.log(`   Total artists: ${totalCount}`)
	console.log(`   With associate_id: ${withAssociateId}`)
	console.log(`   Active: ${activeCount}`)
	console.log(`   Terminated: ${terminatedCount}`)
}

async function main() {
	console.log('CSV Artist Migration Script')
	console.log('============================\n')

	const csvPath = process.argv[2] || 'artists.csv'
	console.log(`CSV file: ${csvPath}`)

	try {
		// Parse CSV
		const artists = await migrateArtists(csvPath)

		// Confirm before proceeding
		console.log('\nReady to import to Supabase.')
		console.log('This will insert new records and update existing ones.')

		// Import to database
		const result = await upsertArtists(artists)

		// Verify
		await verifyImport()

		console.log('\n Migration complete!')
	} catch (error) {
		console.error('\n Migration failed:', error)
		process.exit(1)
	}
}

main()
