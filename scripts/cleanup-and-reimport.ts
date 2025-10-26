/**
 * Cleanup Pre-existing Artists and Re-import from Instant
 *
 * This script:
 * 1. Removes all pre-existing artists (those without instant_id)
 * 2. Removes all ensembles and memberships
 * 3. Removes all Instant artists
 * 4. Re-imports clean data from transformed files
 *
 * Usage: bun run scripts/cleanup-and-reimport.ts <artists-file> <ensembles-file> <members-file>
 */

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'fs/promises'

// Get Supabase credentials from environment
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
	console.error('❌ Missing Supabase credentials')
	process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanup() {
	console.log('\n🧹 Starting cleanup...\n')

	// Step 1: Get current counts
	console.log('📊 Current state:')
	const { count: preExisting } = await supabase
		.from('phwb_artists')
		.select('*', { count: 'exact', head: true })
		.is('instant_id', null)

	const { count: instantArtists } = await supabase
		.from('phwb_artists')
		.select('*', { count: 'exact', head: true })
		.not('instant_id', 'is', null)

	const { count: ensembles } = await supabase
		.from('phwb_ensembles')
		.select('*', { count: 'exact', head: true })

	const { count: memberships } = await supabase
		.from('phwb_ensemble_members')
		.select('*', { count: 'exact', head: true })

	console.log(`   Pre-existing artists: ${preExisting}`)
	console.log(`   Instant artists: ${instantArtists}`)
	console.log(`   Ensembles: ${ensembles}`)
	console.log(`   Memberships: ${memberships}`)

	// Step 2: Remove ensemble memberships (must be first due to foreign keys)
	console.log('\n🗑️  Removing ensemble memberships...')
	const { error: membersError } = await supabase
		.from('phwb_ensemble_members')
		.delete()
		.neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

	if (membersError) {
		console.error('   ❌ Error removing memberships:', membersError.message)
	} else {
		console.log(`   ✅ Removed all memberships`)
	}

	// Step 3: Remove ensembles
	console.log('\n🗑️  Removing ensembles...')
	const { error: ensemblesError } = await supabase
		.from('phwb_ensembles')
		.delete()
		.neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

	if (ensemblesError) {
		console.error('   ❌ Error removing ensembles:', ensemblesError.message)
	} else {
		console.log(`   ✅ Removed all ensembles`)
	}

	// Step 4: Remove pre-existing artists (those without instant_id)
	console.log('\n🗑️  Removing pre-existing artists...')
	const { error: preExistingError } = await supabase
		.from('phwb_artists')
		.delete()
		.is('instant_id', null)

	if (preExistingError) {
		console.error('   ❌ Error removing pre-existing artists:', preExistingError.message)
	} else {
		console.log(`   ✅ Removed ${preExisting} pre-existing artists`)
	}

	// Step 5: Remove Instant artists (clean slate)
	console.log('\n🗑️  Removing Instant artists...')
	const { error: instantError } = await supabase
		.from('phwb_artists')
		.delete()
		.not('instant_id', 'is', null)

	if (instantError) {
		console.error('   ❌ Error removing Instant artists:', instantError.message)
	} else {
		console.log(`   ✅ Removed ${instantArtists} Instant artists`)
	}

	// Verify cleanup
	const { count: finalCount } = await supabase
		.from('phwb_artists')
		.select('*', { count: 'exact', head: true })

	console.log(`\n✅ Cleanup complete! Remaining artists: ${finalCount}`)
	return finalCount === 0
}

async function reimportData(artistsFile: string, ensemblesFile: string, membersFile: string) {
	console.log('\n📥 Starting re-import...\n')

	// Import Artists
	console.log('📊 Importing artists...')
	const artists = JSON.parse(await readFile(artistsFile, 'utf-8'))
	console.log(`   Total artists to import: ${artists.length}`)

	const batchSize = 50
	let imported = 0
	let errors = 0

	for (let i = 0; i < artists.length; i += batchSize) {
		const batch = artists.slice(i, i + batchSize)

		const { data, error } = await supabase
			.from('phwb_artists')
			.insert(batch)
			.select('id')

		if (error) {
			console.error(`   ❌ Error importing batch ${i}-${i + batchSize}:`, error.message)
			errors += batch.length
		} else {
			imported += batch.length
			console.log(`   ✅ Imported batch ${i + 1}-${Math.min(i + batchSize, artists.length)}`)
		}
	}

	console.log(`\n✅ Artist import complete: ${imported} imported, ${errors} errors`)

	// Import Ensembles
	console.log('\n🎭 Importing ensembles...')
	const ensembles = JSON.parse(await readFile(ensemblesFile, 'utf-8'))
	console.log(`   Total ensembles to import: ${ensembles.length}`)

	const { data: ensData, error: ensError } = await supabase
		.from('phwb_ensembles')
		.insert(ensembles)
		.select('id')

	if (ensError) {
		console.error('   ❌ Error importing ensembles:', ensError.message)
	} else {
		console.log(`✅ Imported ${ensembles.length} ensembles`)
	}

	// Import Ensemble Members
	console.log('\n👥 Importing ensemble members...')
	const members = JSON.parse(await readFile(membersFile, 'utf-8'))
	console.log(`   Total memberships to import: ${members.length}`)

	const { data: memData, error: memError } = await supabase
		.from('phwb_ensemble_members')
		.insert(members)
		.select('id')

	if (memError) {
		console.error('   ❌ Error importing members:', memError.message)
	} else {
		console.log(`✅ Imported ${members.length} ensemble memberships`)
	}

	// Final verification
	console.log('\n🔍 Verifying import...')

	const { count: artistCount } = await supabase
		.from('phwb_artists')
		.select('*', { count: 'exact', head: true })

	const { count: ensembleCount } = await supabase
		.from('phwb_ensembles')
		.select('*', { count: 'exact', head: true })

	const { count: memberCount } = await supabase
		.from('phwb_ensemble_members')
		.select('*', { count: 'exact', head: true })

	console.log('\n📊 Final Database State:')
	console.log(`   Total artists: ${artistCount}`)
	console.log(`   Total ensembles: ${ensembleCount}`)
	console.log(`   Total memberships: ${memberCount}`)

	console.log('\n✅ Re-import complete!')
}

async function main() {
	console.log('🚀 Cleanup and Re-import Process\n')

	const artistsFile = process.argv[2]
	const ensemblesFile = process.argv[3]
	const membersFile = process.argv[4]

	if (!artistsFile || !ensemblesFile || !membersFile) {
		console.error('❌ Missing file arguments')
		console.error('Usage: bun run scripts/cleanup-and-reimport.ts <artists-file> <ensembles-file> <members-file>')
		process.exit(1)
	}

	try {
		// Step 1: Cleanup
		const cleanupSuccess = await cleanup()

		if (!cleanupSuccess) {
			console.warn('⚠️  Warning: Database not completely clean, but continuing...')
		}

		// Step 2: Re-import
		await reimportData(artistsFile, ensemblesFile, membersFile)

		console.log('\n🎉 Process complete!')

	} catch (error) {
		console.error('\n❌ Process failed:', error)
		process.exit(1)
	}
}

main()
