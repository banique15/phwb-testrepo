/**
 * Test the dev-fix workflow: create a test bug in Supabase, then trigger
 * voiceaiagentv5 POST /api/dev/fix. Use when Temporal + voiceaiagentv5 API + worker are running.
 *
 * Usage (from phwb-testrepo root):
 *   npm run test-dev-fix
 *   npm run test:dev-fix-flow
 *   bun run test-dev-fix
 *
 * Repo-only test (no LLM; trivial change → verify → PR, finishes in ~1–2 min):
 *   npm run test-repo
 *   TEST_MODE=1 npm run test-dev-fix
 *
 * Run this from phwb-testrepo root (not from voiceaiagentv5).
 * Requires .env: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_VOICE_AGENT_URL (optional)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Load .env from project root when not already set (Bun loads it automatically; Node doesn't)
function loadEnv() {
	const root = resolve(process.cwd(), '.env')
	if (!existsSync(root)) return
	const content = readFileSync(root, 'utf8')
	for (const line of content.split('\n')) {
		const m = line.match(/^([^#=]+)=(.*)$/)
		if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
	}
}
loadEnv()

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VOICE_AGENT_URL = (process.env.PUBLIC_VOICE_AGENT_URL || 'http://localhost:8000').replace(/\/$/, '')

async function main() {
	if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
		console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
		process.exit(1)
	}

	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

	const testBug = {
		title: '[Script Test] Dev fix workflow – small UI/check fix',
		description:
			'Automated test issue for the dev-fix flow.\n\n' +
			'**Goal:** Change a single file so the project still passes `bun run check`.\n' +
			'E.g. add a comment in a Svelte file or fix a trivial typo in a label.',
		status: 'new',
		priority: 'medium',
		category: 'UI/UX'
	}

	console.log('Creating test bug in phwb_bugs...')
	const { data: bug, error: insertError } = await supabase
		.from('phwb_bugs')
		.insert(testBug)
		.select('id, title')
		.single()

	if (insertError) {
		console.error('Failed to create test bug:', insertError.message)
		process.exit(1)
	}
	console.log('Created bug:', bug.id, bug.title)

	const testMode = process.env.TEST_MODE === '1' || process.env.TEST_REPO === '1'
	const payload = {
		id: bug.id,
		title: testBug.title,
		description: testBug.description,
		category: testBug.category,
		status: testBug.status,
		...(testMode && { test_mode: true })
	}

	if (testMode) console.log('Repo test mode: trivial change → verify → PR (no LLM).')
	console.log('Triggering dev fix at', VOICE_AGENT_URL + '/api/dev/fix')
	let res: Response
	try {
		res = await fetch(VOICE_AGENT_URL + '/api/dev/fix', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		})
	} catch (e) {
		console.error('Request failed:', e instanceof Error ? e.message : e)
		console.error('Is voiceaiagentv5 running? (Temporal + API + worker)')
		process.exit(1)
	}

	const body = await res.json().catch(() => ({}))
	if (!res.ok) {
		console.error('API error', res.status, body)
		process.exit(1)
	}

	console.log('Workflow started:', body.workflow_id)
	console.log('')
	console.log('Next steps:')
	console.log('  1. Open PHWB → Bugs → issue #' + bug.id + ' (or /bugs/' + bug.id + ')')
	console.log('  2. Watch "Agent activity" for live logs')
	console.log('  3. When done, check Comments tab for PR link or error')
	if (testMode) console.log('   (Repo test usually finishes in 1–2 minutes.)')
}

main()
