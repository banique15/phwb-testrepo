/**
 * Transform Instant DB Export to Supabase Format
 *
 * This script transforms exported Instant data into the format needed for Supabase import.
 *
 * Usage: bun run scripts/transform-instant-data.ts <export-file>
 */

import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

interface InstantArtist {
	id: string
	firstName?: string
	middleName?: string
	lastName?: string
	stageName?: string
	email?: string
	workEmail?: string
	phone?: string
	address?: string
	addressLine2?: string
	city?: string
	state?: string
	zip?: string
	country?: string
	dateOfBirth?: number
	companyName?: string
	imageURL?: string
	gender?: string
	ethnicity?: string
	race?: string
	disability?: string
	languages?: string
	employmentType?: string
	taxID?: string
	emergencyContactName?: string
	emergencyContactPhone?: string
	internalNotes?: string
	createdAt: number
	updatedAt: number
	publicHealthProfile?: any
	workforceDevelopmentProfile?: any
	pianosProfile?: any
}

interface SupabaseArtist {
	id: string // Will be generated as UUID
	instant_id: string // Original Instant ID
	created_at: string
	updated_at: string
	full_name: string
	artist_name: string | null
	legal_name: string | null
	legal_first_name: string
	legal_last_name: string | null
	public_first_name: string | null
	public_last_name: string | null
	middle_name: string | null
	dob: string | null
	email: string | null
	work_email: string | null
	phone: string | null
	location: string | null
	address: string | null
	country: string
	employment_status: string | null
	employment_type: string | null
	profile_photo: string | null
	company_name: string | null
	gender: string | null
	ethnicity: string | null
	race: string | null
	disability: string | null
	languages: any | null
	social_security_number: string | null
	tax_id: string | null
	emergency_contact: any | null
	internal_notes: string | null
	// Fields that might come from profiles
	genres: any | null
	instruments: any | null
	bio: string | null
	social_link: any | null
	availability: any | null
	equipment_needs: any | null
	history: any | null
	special_requirements: any | null
	training: any | null
	sightreads: boolean | null
	can_be_soloist: boolean | null
	anti_harassment_training_date: string | null
	instagram: string | null
	website: string | null
	facebook: string | null
	metropolitan_hub: string | null
	one_sentence_bio: string | null
	shirt_size: string | null
}

interface InstantEnsemble {
	id: string
	name: string
	description?: string
	type: string
	status: string
	website?: string
	createdAt: number
	updatedAt: number
	leader?: { id: string }
	members?: Array<{ id: string }>
}

interface SupabaseEnsemble {
	id: string
	instant_id: string
	created_at: string
	updated_at: string
	name: string
	description: string | null
	ensemble_type: string
	status: string
	website: string | null
	leader_id: string | null
}

interface SupabaseEnsembleMember {
	ensemble_id: string
	artist_id: string
	joined_at: string
	is_active: boolean
}

/**
 * Convert Instant timestamp (milliseconds) to PostgreSQL timestamptz format
 */
function convertTimestamp(timestamp: number): string {
	return new Date(timestamp).toISOString()
}

/**
 * Convert Instant date (milliseconds) to PostgreSQL date format
 */
function convertDate(timestamp: number | undefined): string | null {
	if (!timestamp) return null
	return new Date(timestamp).toISOString().split('T')[0]
}

/**
 * Build location string from city, state, zip
 */
function buildLocation(city?: string, state?: string, zip?: string): string | null {
	const parts = [city, state, zip].filter(Boolean)
	return parts.length > 0 ? parts.join(', ') : null
}

/**
 * Build full address from address components
 */
function buildAddress(address?: string, addressLine2?: string): string | null {
	if (!address) return null
	return addressLine2 ? `${address}, ${addressLine2}` : address
}

/**
 * Build full name from name components
 */
function buildFullName(firstName?: string, middleName?: string, lastName?: string): string {
	const parts = [firstName, middleName, lastName].filter(Boolean)
	return parts.length > 0 ? parts.join(' ') : 'Unknown'
}

/**
 * Parse languages string to JSONB array
 */
function parseLanguages(languages?: string): any | null {
	if (!languages) return null
	// If it's already a JSON string, parse it
	try {
		return JSON.parse(languages)
	} catch {
		// Otherwise, split by comma and create array
		return languages.split(',').map(lang => lang.trim())
	}
}

/**
 * Build emergency contact JSONB
 */
function buildEmergencyContact(name?: string, phone?: string): any | null {
	if (!name && !phone) return null
	return { name: name || null, phone: phone || null }
}

/**
 * Parse instruments from public health profile
 */
function parseInstruments(profile?: any): any | null {
	if (!profile?.instruments) return null
	if (typeof profile.instruments === 'string') {
		return profile.instruments.split(',').map((i: string) => i.trim())
	}
	return profile.instruments
}

/**
 * Parse genres from public health profile
 */
function parseGenres(profile?: any): any | null {
	if (!profile?.genres) return null
	if (typeof profile.genres === 'string') {
		return profile.genres.split(',').map((g: string) => g.trim())
	}
	return profile.genres
}

/**
 * Build availability from workforce profile
 */
function buildAvailability(profile?: any): any | null {
	if (!profile?.availability) return null
	if (typeof profile.availability === 'string') {
		try {
			return JSON.parse(profile.availability)
		} catch {
			return { notes: profile.availability }
		}
	}
	return profile.availability
}

/**
 * Transform a single Instant artist to Supabase format
 */
function transformArtist(instant: InstantArtist): SupabaseArtist {
	const fullName = buildFullName(instant.firstName, instant.middleName, instant.lastName)
	const legalName = instant.firstName && instant.lastName
		? `${instant.firstName} ${instant.lastName}`
		: null

	return {
		id: crypto.randomUUID(), // Generate new UUID for Supabase
		instant_id: instant.id,
		created_at: convertTimestamp(instant.createdAt),
		updated_at: convertTimestamp(instant.updatedAt),
		full_name: fullName,
		artist_name: instant.stageName || null,
		legal_name: legalName,
		legal_first_name: instant.firstName || 'Unknown',
		legal_last_name: instant.lastName || null,
		public_first_name: instant.firstName || null,
		public_last_name: instant.lastName || null,
		middle_name: instant.middleName || null,
		dob: convertDate(instant.dateOfBirth),
		email: instant.email || null,
		work_email: instant.workEmail || null,
		phone: instant.phone || null,
		location: buildLocation(instant.city, instant.state, instant.zip),
		address: buildAddress(instant.address, instant.addressLine2),
		country: instant.country || 'USA',
		employment_status: instant.employmentType || null,
		employment_type: instant.employmentType || null,
		profile_photo: instant.imageURL || null,
		company_name: instant.companyName || null,
		gender: instant.gender || null,
		ethnicity: instant.ethnicity || null,
		race: instant.race || null,
		disability: instant.disability || null,
		languages: parseLanguages(instant.languages),
		social_security_number: instant.taxID || null,
		tax_id: instant.taxID || null,
		emergency_contact: buildEmergencyContact(
			instant.emergencyContactName,
			instant.emergencyContactPhone
		),
		internal_notes: instant.internalNotes || null,

		// Fields from linked profiles
		genres: parseGenres(instant.publicHealthProfile),
		instruments: parseInstruments(instant.publicHealthProfile),
		bio: instant.publicHealthProfile?.bio || instant.pianosProfile?.bio || null,
		social_link: null, // TODO: Build from Instagram/website
		availability: buildAvailability(instant.workforceDevelopmentProfile),
		equipment_needs: null,
		history: null,
		special_requirements: instant.disability ? { disability: instant.disability } : null,
		training: null,
		sightreads: instant.publicHealthProfile?.sightReadingLevel ? true : null,
		can_be_soloist: null,
		anti_harassment_training_date: null,
		instagram: null, // TODO: Extract from publicHealthProfile
		website: instant.pianosProfile?.websiteURL || null,
		facebook: null,
		metropolitan_hub: null,
		one_sentence_bio: null,
		shirt_size: null
	}
}

/**
 * Transform a single Instant ensemble to Supabase format
 */
function transformEnsemble(
	instant: InstantEnsemble,
	artistIdMap: Map<string, string>
): SupabaseEnsemble {
	const leaderId = instant.leader?.id
		? artistIdMap.get(instant.leader.id) || null
		: null

	return {
		id: crypto.randomUUID(),
		instant_id: instant.id,
		created_at: convertTimestamp(instant.createdAt),
		updated_at: convertTimestamp(instant.updatedAt),
		name: instant.name,
		description: instant.description || null,
		ensemble_type: instant.type,
		status: instant.status,
		website: instant.website || null,
		leader_id: leaderId
	}
}

/**
 * Transform ensemble members to Supabase format
 */
function transformEnsembleMembers(
	instant: InstantEnsemble,
	ensembleSupabaseId: string,
	artistIdMap: Map<string, string>
): SupabaseEnsembleMember[] {
	if (!instant.members || instant.members.length === 0) return []

	return instant.members
		.filter(member => artistIdMap.has(member.id))
		.map(member => ({
			ensemble_id: ensembleSupabaseId,
			artist_id: artistIdMap.get(member.id)!,
			joined_at: convertTimestamp(instant.createdAt), // Use ensemble creation date
			is_active: instant.status === 'active'
		}))
}

async function transformData(exportFilePath: string) {
	console.log('🔄 Starting data transformation...\n')

	try {
		// Read export file
		console.log(`📖 Reading export file: ${exportFilePath}`)
		const exportData = JSON.parse(await readFile(exportFilePath, 'utf-8'))

		const { artists: instantArtists, ensembles: instantEnsembles } = exportData.data

		console.log(`   Found ${instantArtists.length} artists`)
		console.log(`   Found ${instantEnsembles.length} ensembles\n`)

		// Transform artists
		console.log('🎨 Transforming artists...')
		const supabaseArtists: SupabaseArtist[] = []
		const artistIdMap = new Map<string, string>() // Maps Instant ID → Supabase UUID

		for (const instantArtist of instantArtists) {
			const supabaseArtist = transformArtist(instantArtist)
			supabaseArtists.push(supabaseArtist)
			artistIdMap.set(instantArtist.id, supabaseArtist.id)
		}
		console.log(`✅ Transformed ${supabaseArtists.length} artists\n`)

		// Transform ensembles
		console.log('🎭 Transforming ensembles...')
		const supabaseEnsembles: SupabaseEnsemble[] = []
		const supabaseEnsembleMembers: SupabaseEnsembleMember[] = []

		for (const instantEnsemble of instantEnsembles) {
			const supabaseEnsemble = transformEnsemble(instantEnsemble, artistIdMap)
			supabaseEnsembles.push(supabaseEnsemble)

			// Transform members
			const members = transformEnsembleMembers(
				instantEnsemble,
				supabaseEnsemble.id,
				artistIdMap
			)
			supabaseEnsembleMembers.push(...members)
		}
		console.log(`✅ Transformed ${supabaseEnsembles.length} ensembles`)
		console.log(`✅ Created ${supabaseEnsembleMembers.length} ensemble memberships\n`)

		// Save transformed data
		const outputDir = join(process.cwd(), 'exports', 'transformed')
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

		await writeFile(
			join(outputDir, `artists-transformed-${timestamp}.json`),
			JSON.stringify(supabaseArtists, null, 2)
		)
		await writeFile(
			join(outputDir, `ensembles-transformed-${timestamp}.json`),
			JSON.stringify(supabaseEnsembles, null, 2)
		)
		await writeFile(
			join(outputDir, `ensemble-members-transformed-${timestamp}.json`),
			JSON.stringify(supabaseEnsembleMembers, null, 2)
		)

		console.log(`✅ Transformation complete!`)
		console.log(`\n📁 Output saved to: ${outputDir}`)
		console.log(`   - artists-transformed-${timestamp}.json`)
		console.log(`   - ensembles-transformed-${timestamp}.json`)
		console.log(`   - ensemble-members-transformed-${timestamp}.json`)

		// Generate summary
		console.log(`\n📊 Transformation Summary:`)
		console.log(`   Artists: ${supabaseArtists.length}`)
		console.log(`   Ensembles: ${supabaseEnsembles.length}`)
		console.log(`   Ensemble Memberships: ${supabaseEnsembleMembers.length}`)

		// Data quality checks
		console.log(`\n🔍 Data Quality Checks:`)
		const artistsWithoutEmail = supabaseArtists.filter(a => !a.email).length
		const artistsWithoutPhone = supabaseArtists.filter(a => !a.phone).length
		const ensemblesWithoutLeader = supabaseEnsembles.filter(e => !e.leader_id).length

		console.log(`   Artists without email: ${artistsWithoutEmail}`)
		console.log(`   Artists without phone: ${artistsWithoutPhone}`)
		console.log(`   Ensembles without leader: ${ensemblesWithoutLeader}`)

	} catch (error) {
		console.error('❌ Transformation failed:', error)
		process.exit(1)
	}
}

// Get export file from command line args
const exportFile = process.argv[2]
if (!exportFile) {
	console.error('❌ Please provide the path to the export file')
	console.error('Usage: bun run scripts/transform-instant-data.ts <export-file>')
	process.exit(1)
}

transformData(exportFile)
