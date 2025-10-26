/**
 * Import Transformed Data to Supabase
 *
 * This script imports the transformed artists and ensembles data into Supabase
 *
 * Usage: bun run scripts/import-to-supabase.ts <artists-file> <ensembles-file> <members-file>
 */

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'fs/promises'

// Get Supabase credentials from environment
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
	console.error('❌ Missing Supabase credentials')
	console.error('Make sure PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are set')
	process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function importArtists(filePath: string) {
	console.log('\n📊 Importing artists...')
	const artists = JSON.parse(await readFile(filePath, 'utf-8'))

	console.log(`   Total artists to import: ${artists.length}`)

	// Import in batches of 50 to avoid payload size issues
	const batchSize = 50
	let imported = 0
	let errors = 0

	for (let i = 0; i < artists.length; i += batchSize) {
		const batch = artists.slice(i, i + batchSize)

		const { data, error } = await supabase
			.from('phwb_artists')
			.insert(batch)
			.select('id, instant_id')

		if (error) {
			console.error(`   ❌ Error importing batch ${i}-${i + batchSize}:`, error.message)
			errors += batch.length
		} else {
			imported += batch.length
			console.log(`   ✅ Imported batch ${i + 1}-${Math.min(i + batchSize, artists.length)}`)
		}
	}

	console.log(`\n✅ Artist import complete:`)
	console.log(`   Successfully imported: ${imported}`)
	console.log(`   Errors: ${errors}`)

	return imported
}

async function importEnsembles(filePath: string) {
	console.log('\n🎭 Importing ensembles...')
	const ensembles = JSON.parse(await readFile(filePath, 'utf-8'))

	console.log(`   Total ensembles to import: ${ensembles.length}`)

	const { data, error } = await supabase
		.from('phwb_ensembles')
		.insert(ensembles)
		.select('id, instant_id')

	if (error) {
		console.error('   ❌ Error importing ensembles:', error.message)
		return 0
	}

	console.log(`✅ Imported ${ensembles.length} ensembles`)
	return ensembles.length
}

async function importEnsembleMembers(filePath: string) {
	console.log('\n👥 Importing ensemble members...')
	const members = JSON.parse(await readFile(filePath, 'utf-8'))

	console.log(`   Total memberships to import: ${members.length}`)

	const { data, error } = await supabase
		.from('phwb_ensemble_members')
		.insert(members)
		.select('id')

	if (error) {
		console.error('   ❌ Error importing members:', error.message)
		return 0
	}

	console.log(`✅ Imported ${members.length} ensemble memberships`)
	return members.length
}

async function verifyImport() {
	console.log('\n🔍 Verifying import...')

	// Count artists
	const { count: artistCount } = await supabase
		.from('phwb_artists')
		.select('*', { count: 'exact', head: true })

	// Count artists with instant_id
	const { count: instantArtistCount } = await supabase
		.from('phwb_artists')
		.select('*', { count: 'exact', head: true })
		.not('instant_id', 'is', null)

	// Count ensembles
	const { count: ensembleCount } = await supabase
		.from('phwb_ensembles')
		.select('*', { count: 'exact', head: true })

	// Count ensemble members
	const { count: memberCount } = await supabase
		.from('phwb_ensemble_members')
		.select('*', { count: 'exact', head: true })

	console.log('\n📊 Database Counts:')
	console.log(`   Total artists: ${artistCount}`)
	console.log(`   Artists from Instant: ${instantArtistCount}`)
	console.log(`   Total ensembles: ${ensembleCount}`)
	console.log(`   Total ensemble memberships: ${memberCount}`)
}

async function main() {
	console.log('🚀 Starting Supabase import...\n')

	const artistsFile = process.argv[2]
	const ensemblesFile = process.argv[3]
	const membersFile = process.argv[4]

	if (!artistsFile || !ensemblesFile || !membersFile) {
		console.error('❌ Missing file arguments')
		console.error('Usage: bun run scripts/import-to-supabase.ts <artists-file> <ensembles-file> <members-file>')
		process.exit(1)
	}

	try {
		// Import in order: artists first, then ensembles, then members
		const artistsImported = await importArtists(artistsFile)
		const ensemblesImported = await importEnsembles(ensemblesFile)
		const membersImported = await importEnsembleMembers(membersFile)

		// Verify
		await verifyImport()

		console.log('\n✅ Import complete!')
		console.log(`\n📈 Summary:`)
		console.log(`   Artists: ${artistsImported}`)
		console.log(`   Ensembles: ${ensemblesImported}`)
		console.log(`   Memberships: ${membersImported}`)

	} catch (error) {
		console.error('\n❌ Import failed:', error)
		process.exit(1)
	}
}

main()
