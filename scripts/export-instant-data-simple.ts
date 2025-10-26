/**
 * Export Data from Instant DB - Simple REST API Approach
 *
 * This script uses Instant's REST API to export data directly
 *
 * Usage: bun run scripts/export-instant-data-simple.ts
 */

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

// Instant app configuration
const INSTANT_APP_ID = '14c443ea-7e34-4058-b167-7af45cae3f4f'
const INSTANT_API_URL = 'https://api.instantdb.com'

async function queryInstant(query: any) {
	const response = await fetch(`${INSTANT_API_URL}/runtime/query`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'app-id': INSTANT_APP_ID
		},
		body: JSON.stringify(query)
	})

	if (!response.ok) {
		throw new Error(`Instant API error: ${response.statusText}`)
	}

	return await response.json()
}

async function exportData() {
	console.log('🚀 Starting Instant DB export via REST API...\n')

	try {
		// Create export directory
		const exportDir = join(process.cwd(), 'exports')
		await mkdir(exportDir, { recursive: true })

		console.log('📊 Querying Instant DB...')

		// Query all entities with their relationships
		const result = await queryInstant({
			artists: {
				employmentRecord: {},
				ensembles: {},
				leadingEnsembles: {},
				pianosProfile: {},
				publicHealthProfile: {},
				workforceDevelopmentProfile: {},
				programs: {},
				phwbPrograms: {}
			},
			ensembles: {
				leader: {},
				members: {}
			},
			employmentRecords: {
				artist: {}
			},
			publicHealthProfiles: {
				artist: {}
			},
			pianosProfiles: {
				artist: {}
			},
			workforceDevelopmentProfiles: {
				artist: {}
			}
		})

		console.log('✅ Data fetched successfully!\n')

		const allData = {
			artists: result.artists || [],
			ensembles: result.ensembles || [],
			employmentRecords: result.employmentRecords || [],
			publicHealthProfiles: result.publicHealthProfiles || [],
			pianosProfiles: result.pianosProfiles || [],
			workforceProfiles: result.workforceDevelopmentProfiles || []
		}

		console.log('📈 Summary:')
		console.log(`   Artists: ${allData.artists.length}`)
		console.log(`   Ensembles: ${allData.ensembles.length}`)
		console.log(`   Employment Records: ${allData.employmentRecords.length}`)
		console.log(`   Public Health Profiles: ${allData.publicHealthProfiles.length}`)
		console.log(`   Pianos Profiles: ${allData.pianosProfiles.length}`)
		console.log(`   Workforce Profiles: ${allData.workforceProfiles.length}`)

		// Save all exports
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
		const exports = {
			exportedAt: new Date().toISOString(),
			instantAppId: INSTANT_APP_ID,
			summary: {
				artists: allData.artists.length,
				ensembles: allData.ensembles.length,
				employmentRecords: allData.employmentRecords.length,
				publicHealthProfiles: allData.publicHealthProfiles.length,
				pianosProfiles: allData.pianosProfiles.length,
				workforceProfiles: allData.workforceProfiles.length
			},
			data: allData
		}

		const exportFile = join(exportDir, `instant-export-${timestamp}.json`)
		await writeFile(exportFile, JSON.stringify(exports, null, 2))

		console.log(`\n✅ Export complete! Saved to: ${exportFile}`)

		// Save individual entity files
		await writeFile(
			join(exportDir, `artists-${timestamp}.json`),
			JSON.stringify(allData.artists, null, 2)
		)
		await writeFile(
			join(exportDir, `ensembles-${timestamp}.json`),
			JSON.stringify(allData.ensembles, null, 2)
		)

		console.log('\n📁 Individual files also saved for artists and ensembles')
		console.log(`\n🎯 Next step: Run transformation script:`)
		console.log(`   bun run scripts/transform-instant-data.ts ${exportFile}`)

		return exportFile

	} catch (error) {
		console.error('❌ Export failed:', error)
		if (error instanceof Error) {
			console.error('Error details:', error.message)
		}
		process.exit(1)
	}
}

// Run the export
exportData()
