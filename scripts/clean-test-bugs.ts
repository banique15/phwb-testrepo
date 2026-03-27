/**
 * Delete test bugs (and their comments) created by the dev-fix test flow.
 * Matches titles starting with "[Script Test]" or "[Dev Fix Test]".
 *
 * Usage (from phwb-testrepo root):
 *   npm run clean:test-bugs
 *   npx -y tsx scripts/clean-test-bugs.ts
 *
 * Requires .env: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

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

async function main() {
	if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
		console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
		process.exit(1)
	}

	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

	// Find test bugs (script-created or seed-test API)
	const { data: allBugs, error: fetchError } = await supabase
		.from('phwb_bugs')
		.select('id, title')
		.order('id', { ascending: false })
		.limit(2000)
	if (fetchError) {
		console.error('Failed to fetch bugs:', fetchError.message)
		process.exit(1)
	}
	const bugs = (allBugs ?? []).filter(
		(b) => b.title?.startsWith('[Script Test]') || b.title?.startsWith('[Dev Fix Test]')
	)

	if (!bugs.length) {
		console.log('No test bugs found. Nothing to delete.')
		return
	}

	const ids = bugs.map((b) => b.id)
	console.log(`Found ${bugs.length} test bug(s):`)
	bugs.forEach((b) => console.log(`  #${b.id} ${b.title}`))

	// Delete comments for these bugs first (foreign key)
	const { error: commentsError } = await supabase.from('phwb_bug_comments').delete().in('bug_id', ids)
	if (commentsError) {
		console.error('Failed to delete comments:', commentsError.message)
		process.exit(1)
	}
	console.log('Deleted comments for these bugs.')

	// Delete the bugs
	const { error: bugsError } = await supabase.from('phwb_bugs').delete().in('id', ids)
	if (bugsError) {
		console.error('Failed to delete bugs:', bugsError.message)
		process.exit(1)
	}
	console.log('Deleted test bugs. Done.')
}

main()
