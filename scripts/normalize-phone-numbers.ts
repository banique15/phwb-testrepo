#!/usr/bin/env bun

/**
 * Script to normalize all phone numbers in the database
 * This will update all artists' phone numbers to use the standard format: (XXX) XXX-XXXX
 */

import { createClient } from '@supabase/supabase-js'
import { normalizePhoneForDB } from '../src/lib/utils/phone'

// Load environment variables
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
	console.error('❌ Missing Supabase credentials in environment variables')
	process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface Artist {
	id: string
	full_name: string | null
	phone: string | null
}

async function normalizePhoneNumbers() {
	console.log('🔄 Starting phone number normalization...\n')

	try {
		// Fetch all artists with phone numbers
		const { data: artists, error: fetchError } = await supabase
			.from('phwb_artists')
			.select('id, full_name, phone')
			.not('phone', 'is', null)

		if (fetchError) {
			throw fetchError
		}

		if (!artists || artists.length === 0) {
			console.log('ℹ️  No artists with phone numbers found')
			return
		}

		console.log(`📊 Found ${artists.length} artists with phone numbers\n`)

		let updated = 0
		let skipped = 0
		let cleared = 0
		const errors: string[] = []

		// Process each artist
		for (const artist of artists) {
			const originalPhone = artist.phone
			const normalizedPhone = normalizePhoneForDB(artist.phone)

			// Skip if already in correct format
			if (originalPhone === normalizedPhone) {
				skipped++
				continue
			}

			// Update the phone number
			const { error: updateError } = await supabase
				.from('phwb_artists')
				.update({ phone: normalizedPhone })
				.eq('id', artist.id)

			if (updateError) {
				errors.push(`${artist.full_name || 'Unknown'} (${artist.id}): ${updateError.message}`)
				continue
			}

			if (normalizedPhone === null) {
				console.log(`🗑️  Cleared invalid: ${artist.full_name || 'Unknown'} - ${originalPhone}`)
				cleared++
			} else {
				console.log(`✅ Updated: ${artist.full_name || 'Unknown'} - ${originalPhone} → ${normalizedPhone}`)
				updated++
			}
		}

		// Print summary
		console.log('\n' + '='.repeat(60))
		console.log('📈 Summary:')
		console.log('='.repeat(60))
		console.log(`✅ Updated: ${updated}`)
		console.log(`⏭️  Skipped (already formatted): ${skipped}`)
		console.log(`🗑️  Cleared (invalid): ${cleared}`)
		console.log(`❌ Errors: ${errors.length}`)
		console.log('='.repeat(60))

		if (errors.length > 0) {
			console.log('\n❌ Errors encountered:')
			errors.forEach(err => console.log(`  - ${err}`))
		}

		console.log('\n✨ Phone number normalization complete!')

	} catch (error) {
		console.error('❌ Fatal error:', error)
		process.exit(1)
	}
}

// Run the migration
normalizePhoneNumbers()
