/**
 * Export Data from Instant DB
 *
 * This script exports artists, ensembles, and related data from the Instant DB
 * "hope" app to prepare for migration to Supabase.
 *
 * Usage: bun run scripts/export-instant-data.ts
 */

import { init } from '@instantdb/core'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

// Instant app configuration
const INSTANT_APP_ID = '14c443ea-7e34-4058-b167-7af45cae3f4f'

// Initialize Instant DB
const db = init({ appId: INSTANT_APP_ID })

async function exportData() {
	console.log('🚀 Starting Instant DB export...\n')

	try {
		// Create export directory
		const exportDir = join(process.cwd(), 'exports')
		await mkdir(exportDir, { recursive: true })

		// Storage for all exported data
		let allData: any = {
			artists: [],
			ensembles: [],
			employmentRecords: [],
			publicHealthProfiles: [],
			pianosProfiles: [],
			workforceProfiles: []
		}

		console.log('📊 Exporting data from Instant DB...')
		console.log('   This will take a few seconds as we fetch all entities...\n')

		// Use subscribeQuery to fetch all data
		const unsubscribe = db.subscribeQuery(
			{
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
			},
			(resp: any) => {
				if (resp.data) {
					allData = {
						artists: resp.data.artists || [],
						ensembles: resp.data.ensembles || [],
						employmentRecords: resp.data.employmentRecords || [],
						publicHealthProfiles: resp.data.publicHealthProfiles || [],
						pianosProfiles: resp.data.pianosProfiles || [],
						workforceProfiles: resp.data.workforceDevelopmentProfiles || []
					}
				}
			}
		)

		// Wait for data to load (Instant DB is reactive, so we need to wait a bit)
		await new Promise(resolve => setTimeout(resolve, 3000))

		// Unsubscribe
		unsubscribe()

		// Log what we got
		console.log('✅ Data exported successfully!\n')
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

		// Save individual entity files for easier processing
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
		console.log(`   bun run scripts/transform-instant-data.ts exports/instant-export-${timestamp}.json`)

	} catch (error) {
		console.error('❌ Export failed:', error)
		process.exit(1)
	}
}

// Run the export
exportData()
