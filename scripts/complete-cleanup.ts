/**
 * Complete Database Cleanup - Remove ALL artists and related data
 *
 * This script removes all artists (both pre-existing and from Instant)
 * and all related data, handling foreign key constraints properly.
 *
 * WARNING: This will delete ALL artist data from the database!
 *
 * Usage: bun run scripts/complete-cleanup.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
	console.error('❌ Missing Supabase credentials')
	process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function completeCleanup() {
	console.log('🚀 Starting COMPLETE database cleanup...\n')
	console.log('⚠️  WARNING: This will delete ALL artists and related data!\n')

	// Get current state
	const { count: totalArtists } = await supabase
		.from('phwb_artists')
		.select('*', { count: 'exact', head: true })

	const { count: preExisting } = await supabase
		.from('phwb_artists')
		.select('*', { count: 'exact', head: true })
		.is('instant_id', null)

	const { count: instantArtists } = await supabase
		.from('phwb_artists')
		.select('*', { count: 'exact', head: true })
		.not('instant_id', 'is', null)

	console.log('📊 Current state:')
	console.log(`   Total artists: ${totalArtists}`)
	console.log(`   Pre-existing artists: ${preExisting}`)
	console.log(`   Instant artists: ${instantArtists}`)

	// Step 1: Delete ensemble members (references artists)
	console.log('\n🗑️  Step 1: Removing ensemble members...')
	const { error: membersError } = await supabase
		.from('phwb_ensemble_members')
		.delete()
		.neq('id', '00000000-0000-0000-0000-000000000000')

	if (membersError) {
		console.error('   ❌ Error:', membersError.message)
	} else {
		console.log('   ✅ Removed all ensemble members')
	}

	// Step 2: Delete ensembles (references artists via leader_id)
	console.log('\n🗑️  Step 2: Removing ensembles...')
	const { error: ensemblesError } = await supabase
		.from('phwb_ensembles')
		.delete()
		.neq('id', '00000000-0000-0000-0000-000000000000')

	if (ensemblesError) {
		console.error('   ❌ Error:', ensemblesError.message)
	} else {
		console.log('   ✅ Removed all ensembles')
	}

	// Step 3: Delete payroll records (references artists)
	console.log('\n🗑️  Step 3: Removing payroll records...')
	const { count: payrollCount } = await supabase
		.from('phwb_payroll')
		.select('*', { count: 'exact', head: true })

	const { error: payrollError } = await supabase
		.from('phwb_payroll')
		.delete()
		.neq('id', 0)

	if (payrollError) {
		console.error('   ❌ Error:', payrollError.message)
	} else {
		console.log(`   ✅ Removed ${payrollCount} payroll records`)
	}

	// Step 4: Delete artist mappings (references artists)
	console.log('\n🗑️  Step 4: Removing artist mappings...')
	const { count: mappingsCount } = await supabase
		.from('artist_mappings')
		.select('*', { count: 'exact', head: true })

	const { error: mappingsError } = await supabase
		.from('artist_mappings')
		.delete()
		.neq('id', 0)

	if (mappingsError) {
		console.error('   ❌ Error:', mappingsError.message)
	} else {
		console.log(`   ✅ Removed ${mappingsCount} artist mappings`)
	}

	// Step 5: Delete timesheet data (references artists)
	console.log('\n🗑️  Step 5: Removing timesheet data...')
	const { count: timesheetCount } = await supabase
		.from('timesheet_data')
		.select('*', { count: 'exact', head: true })

	const { error: timesheetError } = await supabase
		.from('timesheet_data')
		.delete()
		.neq('id', 0)

	if (timesheetError) {
		console.error('   ❌ Error:', timesheetError.message)
	} else {
		console.log(`   ✅ Removed ${timesheetCount} timesheet records`)
	}

	// Step 6: Now we can delete all artists
	console.log('\n🗑️  Step 6: Removing ALL artists...')
	const { error: artistsError } = await supabase
		.from('phwb_artists')
		.delete()
		.neq('id', '00000000-0000-0000-0000-000000000000')

	if (artistsError) {
		console.error('   ❌ Error:', artistsError.message)
		return false
	} else {
		console.log(`   ✅ Removed all ${totalArtists} artists`)
	}

	// Verify cleanup
	console.log('\n🔍 Verifying cleanup...')

	const { count: finalArtists } = await supabase
		.from('phwb_artists')
		.select('*', { count: 'exact', head: true })

	const { count: finalEnsembles } = await supabase
		.from('phwb_ensembles')
		.select('*', { count: 'exact', head: true })

	const { count: finalMembers } = await supabase
		.from('phwb_ensemble_members')
		.select('*', { count: 'exact', head: true })

	const { count: finalPayroll } = await supabase
		.from('phwb_payroll')
		.select('*', { count: 'exact', head: true })

	console.log('\n📊 Final state:')
	console.log(`   Artists: ${finalArtists}`)
	console.log(`   Ensembles: ${finalEnsembles}`)
	console.log(`   Memberships: ${finalMembers}`)
	console.log(`   Payroll records: ${finalPayroll}`)

	if (finalArtists === 0 && finalEnsembles === 0 && finalMembers === 0) {
		console.log('\n✅ Database completely cleaned!')
		return true
	} else {
		console.log('\n⚠️  Warning: Some records remain')
		return false
	}
}

async function main() {
	try {
		const success = await completeCleanup()

		if (success) {
			console.log('\n🎯 Next step: Re-import Instant data')
			console.log('   bun run scripts/import-to-supabase.ts \\')
			console.log('     exports/transformed/artists-transformed-2025-10-22T18-41-28-192Z.json \\')
			console.log('     exports/transformed/ensembles-transformed-2025-10-22T18-41-28-192Z.json \\')
			console.log('     exports/transformed/ensemble-members-transformed-2025-10-22T18-41-28-192Z.json')
		} else {
			console.log('\n❌ Cleanup incomplete - please check errors above')
			process.exit(1)
		}
	} catch (error) {
		console.error('\n❌ Cleanup failed:', error)
		process.exit(1)
	}
}

main()
