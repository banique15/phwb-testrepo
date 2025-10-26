/**
 * Run Event Import
 *
 * Example script to import events from the provided spreadsheets
 * Usage: bun run scripts/run-import.ts [--dry-run]
 */

import { importEvents, type EventRow } from './import-events'

const dryRun = process.argv.includes('--dry-run')

// Sheet 1: MSK Hospital Events
const mskEvents: EventRow[] = [
	{
		date: 'Wednesday, Dec 11, 2024',
		location: 'MSK',
		location_detail: 'Main Lobby',
		start_time: '1pm',
		end_time: '2pm',
		artist_name: 'Kely Pinheiro',
		number_of_musicians: 1,
		hours: 1,
		event_type: 'Performance',
		website: 'https://www.kelypinheiro.com/',
		program_name: 'MSK',
	},
	{
		date: 'Monday, Dec 16, 2024',
		location: 'MSK',
		location_detail: 'MDP Lobby',
		start_time: '1pm',
		end_time: '2pm',
		artist_name: 'Gabriel Aldort',
		number_of_musicians: 1,
		hours: 1,
		event_type: 'Performance',
		website: 'https://galdortmusic.com/',
		program_name: 'MSK',
	},
	{
		date: 'Tuesday, Jan 14, 2025',
		location: 'MSK',
		location_detail: 'Main Lobby',
		start_time: '1pm',
		end_time: '2pm',
		artist_name: 'Yifei Xu',
		number_of_musicians: 1,
		hours: 1,
		event_type: 'Performance',
		instrumentation: 'solo piano, will use Mets piano',
		description: 'Award-winning pianist Yifei Xu captivates audiences with her virtuosity, lyricism, and seamless fusion of classical and avant-garde styles.',
		website: 'https://yifeixu.org/about',
		program_name: 'MSK',
	},
	// Add more events here...
]

// Sheet 2: CLC Events
const clcEvents: EventRow[] = [
	{
		date: 'Monday, Jul 7, 2025',
		location: 'CLC',
		start_time: '2:00 PM',
		end_time: '3:00 PM',
		artist_name: 'DNA',
		event_type: 'Participatory Concert',
		status: 'CC',
		hours: 2,
		number_of_musicians: 2,
		total_fee: 487,
		notes: 'Project kick-off / pd addtl $75. to rep SFH @ kick off',
		program_name: 'CLC',
	},
	{
		date: 'Thursday, Aug 14, 2025',
		location: 'CLC',
		start_time: '2:00 PM',
		end_time: '3:00 PM',
		artist_name: 'Siegel/Bakr',
		event_type: 'Participatory Concert',
		status: 'CC',
		hours: 2,
		number_of_musicians: 2,
		total_fee: 426,
		program_name: 'CLC',
	},
	// Add more events here...
]

// Sheet 3: Moynihan Train Hall Events
const moynihanEvents: EventRow[] = [
	{
		date: 'Tuesday, Nov 4, 2025',
		location: 'Moynihan Train Hall',
		start_time: '4:00 PM',
		end_time: '6:00 PM',
		artist_name: 'Drift Winds',
		status: 'CD',
		number_of_musicians: 3,
		event_type: 'Performance',
		description: 'Drift Winds brings flutist Anjali Shinde, oboist Matthew Maroon, and bassoonist Marty Tung together with the simple goal of sharing meaningful music with as many people as possible.',
		program_name: 'Moynihan Train Hall',
	},
	{
		date: 'Tuesday, Nov 11, 2025',
		location: 'Moynihan Train Hall',
		start_time: '4:00 PM',
		end_time: '6:00 PM',
		artist_name: 'Benjamin Sutin & Gabriel Schillinger-Hyman',
		status: 'CC',
		number_of_musicians: 2,
		event_type: 'Performance',
		description: 'Award Winning Jazz Violinist Benjamin Sutin brings his vibrant blend of jazz, Latin, classic pop, and more to Moynihan Train Hall alongside Pianist Gabriel Schillinger Hyman.',
		program_name: 'Moynihan Train Hall',
	},
	// Add more events here...
]

// Combine all events
const allEvents = [...mskEvents, ...clcEvents, ...moynihanEvents]

console.log('Starting event import...')
console.log(`Mode: ${dryRun ? 'DRY RUN (no data will be saved)' : 'LIVE (data will be saved)'}`)
console.log(`Total events to import: ${allEvents.length}`)
console.log('')

importEvents(allEvents, dryRun)
	.then(() => {
		console.log('Import process complete!')
		process.exit(0)
	})
	.catch((error) => {
		console.error('Import failed:', error)
		process.exit(1)
	})
