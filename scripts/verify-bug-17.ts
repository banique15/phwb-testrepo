#!/usr/bin/env bun

/**
 * Bug #17 Verification Script
 * 
 * This script verifies that the fix for bug #17 is properly implemented.
 * Bug #17: Re-run after Supabase label relationship fix and migration apply
 * 
 * The issue was that the bug detail page attempts to query a non-existent table
 * `phwb_bug_testing_sessions`, causing page load failures.
 * 
 * Fix: Migration 013_create_bug_testing_sessions.sql creates the missing table
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface VerificationResult {
	passed: boolean
	message: string
	details?: string
}

const results: VerificationResult[] = []

console.log('🔍 Bug #17 Verification Script\n')
console.log('=' .repeat(60))
console.log()

// Test 1: Verify migration file exists
function verifyMigrationExists(): VerificationResult {
	const migrationPath = join(process.cwd(), 'migrations', '013_create_bug_testing_sessions.sql')
	const exists = existsSync(migrationPath)
	
	return {
		passed: exists,
		message: 'Migration file 013_create_bug_testing_sessions.sql exists',
		details: exists ? `Found at: ${migrationPath}` : `Missing at: ${migrationPath}`
	}
}

// Test 2: Verify migration creates correct table
function verifyMigrationSchema(): VerificationResult {
	const migrationPath = join(process.cwd(), 'migrations', '013_create_bug_testing_sessions.sql')
	
	if (!existsSync(migrationPath)) {
		return {
			passed: false,
			message: 'Migration schema validation',
			details: 'Migration file not found'
		}
	}
	
	const content = readFileSync(migrationPath, 'utf-8')
	
	// Required table creation
	const hasTableCreation = content.includes('CREATE TABLE IF NOT EXISTS phwb_bug_testing_sessions')
	
	// Required columns
	const requiredColumns = [
		'id SERIAL PRIMARY KEY',
		'created_at timestamptz',
		'updated_at timestamptz',
		'bug_id integer',
		'tester_id uuid',
		'title text',
		'status text',
		'environment text',
		'transcript text',
		'summary text',
		'media jsonb',
		'tested_issue_ids integer[]',
		'started_at timestamptz',
		'completed_at timestamptz'
	]
	
	const missingColumns = requiredColumns.filter(col => !content.includes(col))
	
	// Required foreign keys
	const hasBugForeignKey = content.includes('REFERENCES phwb_bugs(id)')
	const hasUserForeignKey = content.includes('REFERENCES auth.users(id)')
	
	// Required constraints
	const hasStatusCheck = content.includes("CHECK (status IN ('pass', 'fail', 'partial', 'blocked'))")
	const hasTitleCheck = content.includes('title_not_empty')
	
	// Required indexes
	const requiredIndexes = [
		'idx_bug_testing_sessions_bug_id',
		'idx_bug_testing_sessions_tester_id',
		'idx_bug_testing_sessions_status',
		'idx_bug_testing_sessions_created_at'
	]
	const missingIndexes = requiredIndexes.filter(idx => !content.includes(idx))
	
	// Required RLS
	const hasRLS = content.includes('ALTER TABLE phwb_bug_testing_sessions ENABLE ROW LEVEL SECURITY')
	const hasSelectPolicy = content.includes('CREATE POLICY') && content.includes('FOR SELECT')
	const hasInsertPolicy = content.includes('FOR INSERT')
	const hasUpdatePolicy = content.includes('FOR UPDATE')
	
	// Required trigger
	const hasTrigger = content.includes('CREATE TRIGGER update_bug_testing_sessions_updated_at')
	
	const issues: string[] = []
	if (!hasTableCreation) issues.push('Missing table creation statement')
	if (missingColumns.length > 0) issues.push(`Missing columns: ${missingColumns.join(', ')}`)
	if (!hasBugForeignKey) issues.push('Missing bug_id foreign key')
	if (!hasUserForeignKey) issues.push('Missing tester_id foreign key')
	if (!hasStatusCheck) issues.push('Missing status constraint')
	if (!hasTitleCheck) issues.push('Missing title constraint')
	if (missingIndexes.length > 0) issues.push(`Missing indexes: ${missingIndexes.join(', ')}`)
	if (!hasRLS) issues.push('Missing RLS enablement')
	if (!hasSelectPolicy) issues.push('Missing SELECT policy')
	if (!hasInsertPolicy) issues.push('Missing INSERT policy')
	if (!hasUpdatePolicy) issues.push('Missing UPDATE policy')
	if (!hasTrigger) issues.push('Missing updated_at trigger')
	
	return {
		passed: issues.length === 0,
		message: 'Migration schema contains all required elements',
		details: issues.length === 0 
			? 'All required columns, constraints, indexes, and policies found'
			: `Issues found: ${issues.join('; ')}`
	}
}

// Test 3: Verify TypeScript interface matches schema
function verifyTypeScriptInterface(): VerificationResult {
	const componentPath = join(process.cwd(), 'src', 'routes', 'bugs', '[id]', 'components', 'BugTesting.svelte')
	
	if (!existsSync(componentPath)) {
		return {
			passed: false,
			message: 'TypeScript interface validation',
			details: 'BugTesting.svelte component not found'
		}
	}
	
	const content = readFileSync(componentPath, 'utf-8')
	
	// Required interface fields
	const requiredFields = [
		'id: number',
		'created_at: string',
		'updated_at: string',
		'bug_id: number',
		'tester_id: string | null',
		'title: string',
		"status: 'pass' | 'fail' | 'partial' | 'blocked'",
		'environment: string | null',
		'transcript: string | null',
		'summary: string | null',
		'tested_issue_ids: number[] | null',
		'started_at: string | null',
		'completed_at: string | null'
	]
	
	const missingFields = requiredFields.filter(field => !content.includes(field))
	
	return {
		passed: missingFields.length === 0,
		message: 'TypeScript TestingSession interface matches schema',
		details: missingFields.length === 0
			? 'All required fields present in interface'
			: `Missing fields: ${missingFields.join(', ')}`
	}
}

// Test 4: Verify server page loads testing sessions
function verifyServerPageQuery(): VerificationResult {
	const serverPagePath = join(process.cwd(), 'src', 'routes', 'bugs', '[id]', '+page.server.ts')
	
	if (!existsSync(serverPagePath)) {
		return {
			passed: false,
			message: 'Server page query validation',
			details: '+page.server.ts not found'
		}
	}
	
	const content = readFileSync(serverPagePath, 'utf-8')
	
	// Check for query to phwb_bug_testing_sessions
	const queriesTestingSessions = content.includes('phwb_bug_testing_sessions')
	const hasSelect = content.includes('.select(')
	const hasOrderBy = content.includes('.order(')
	
	return {
		passed: queriesTestingSessions && hasSelect,
		message: 'Server page queries testing sessions table',
		details: queriesTestingSessions && hasSelect
			? 'Query to phwb_bug_testing_sessions found'
			: 'No query to phwb_bug_testing_sessions found'
	}
}

// Test 5: Verify migration is idempotent
function verifyMigrationIdempotency(): VerificationResult {
	const migrationPath = join(process.cwd(), 'migrations', '013_create_bug_testing_sessions.sql')
	
	if (!existsSync(migrationPath)) {
		return {
			passed: false,
			message: 'Migration idempotency validation',
			details: 'Migration file not found'
		}
	}
	
	const content = readFileSync(migrationPath, 'utf-8')
	
	// Check for IF NOT EXISTS clauses
	const hasIfNotExistsTable = content.includes('CREATE TABLE IF NOT EXISTS')
	const hasIfNotExistsIndexes = content.match(/CREATE INDEX IF NOT EXISTS/g)?.length === 4
	
	return {
		passed: hasIfNotExistsTable && hasIfNotExistsIndexes,
		message: 'Migration is idempotent (safe to re-run)',
		details: hasIfNotExistsTable && hasIfNotExistsIndexes
			? 'Uses IF NOT EXISTS for table and indexes'
			: 'Missing IF NOT EXISTS clauses'
	}
}

// Run all verification tests
console.log('Running verification tests...\n')

results.push(verifyMigrationExists())
results.push(verifyMigrationSchema())
results.push(verifyTypeScriptInterface())
results.push(verifyServerPageQuery())
results.push(verifyMigrationIdempotency())

// Display results
results.forEach((result, index) => {
	const icon = result.passed ? '✅' : '❌'
	console.log(`${icon} Test ${index + 1}: ${result.message}`)
	if (result.details) {
		console.log(`   ${result.details}`)
	}
	console.log()
})

// Summary
console.log('=' .repeat(60))
const passedCount = results.filter(r => r.passed).length
const totalCount = results.length
const allPassed = passedCount === totalCount

console.log()
console.log(`Summary: ${passedCount}/${totalCount} tests passed`)
console.log()

if (allPassed) {
	console.log('✅ Bug #17 fix is VERIFIED and ready for deployment!')
	console.log()
	console.log('Next steps:')
	console.log('1. Apply migration to Supabase: supabase db push')
	console.log('2. Run type checking: bun run check')
	console.log('3. Test bug detail page loads correctly')
	console.log('4. Test Testing tab functionality')
	process.exit(0)
} else {
	console.log('❌ Bug #17 fix has issues that need to be addressed')
	process.exit(1)
}
