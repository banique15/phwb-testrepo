# Bug #17 Verification Scripts

This directory contains verification and testing scripts for Bug #17 fix.

## Bug #17 Overview

**Issue:** Bug detail pages fail to load because the application queries a non-existent table `phwb_bug_testing_sessions`.

**Fix:** Created migration `013_create_bug_testing_sessions.sql` to create the missing table.

## Verification Scripts

### 1. `verify-bug-17.ts` (TypeScript)

Automated verification script that validates the fix without requiring database access.

**What it checks:**
- ✅ Migration file exists
- ✅ Migration contains all required schema elements
- ✅ TypeScript interface matches database schema
- ✅ Server page queries the table correctly
- ✅ Migration is idempotent (safe to re-run)

**Usage:**
```bash
# Run directly
bun run scripts/verify-bug-17.ts

# Or use package.json script
bun run verify:bug17
```

**Expected output:**
```
✅ Test 1: Migration file exists
✅ Test 2: Migration schema contains all required elements
✅ Test 3: TypeScript interface matches schema
✅ Test 4: Server page queries testing sessions table
✅ Test 5: Migration is idempotent

Summary: 5/5 tests passed
✅ Bug #17 fix is VERIFIED and ready for deployment!
```

### 2. `run-bug-17-verification.sh` (Bash)

Comprehensive verification runner that executes multiple validation steps.

**What it does:**
1. Runs automated verification script
2. Runs TypeScript type checking
3. Validates migration file format
4. Provides final summary and next steps

**Usage:**
```bash
# Make executable
chmod +x scripts/run-bug-17-verification.sh

# Run
./scripts/run-bug-17-verification.sh
```

**Requirements:**
- Bash shell
- Bun runtime
- All project dependencies installed

### 3. `test-migration-013.sql` (SQL)

Database-level test script that validates the migration was applied correctly.

**What it checks:**
- ✅ Table exists
- ✅ All required columns exist with correct types
- ✅ Foreign keys are configured
- ✅ Check constraints are in place
- ✅ Performance indexes exist
- ✅ RLS is enabled
- ✅ RLS policies are created
- ✅ Triggers are configured

**Usage:**
```bash
# Run in Supabase SQL Editor after applying migration
# Copy and paste contents of test-migration-013.sql
```

**Expected output:**
```
NOTICE: ✓ Test 1 PASSED: Table exists
NOTICE: ✓ Test 2 PASSED: All required columns exist
NOTICE: ✓ Test 3 PASSED: Foreign keys exist
NOTICE: ✓ Test 4 PASSED: Check constraints exist
NOTICE: ✓ Test 5 PASSED: Performance indexes exist
NOTICE: ✓ Test 6 PASSED: RLS is enabled
NOTICE: ✓ Test 7 PASSED: RLS policies exist
NOTICE: ✓ Test 8 PASSED: Trigger exists
NOTICE: ✓ Test 9 PASSED: All column types correct
NOTICE: Migration 013 Validation Complete
```

## Documentation Files

### `BUG_17_VERIFICATION.md`

Comprehensive documentation covering:
- Root cause analysis
- Solution implementation
- Verification steps
- Deployment instructions
- Migration safety analysis
- Expected behavior after fix

**Location:** `scripts/BUG_17_VERIFICATION.md`

## Quick Start

To verify Bug #17 fix is complete:

```bash
# 1. Run automated verification
bun run verify:bug17

# 2. Run type checking
bun run check

# 3. Apply migration (if not already applied)
supabase db push

# 4. Run SQL validation (in Supabase Dashboard)
# Copy contents of scripts/test-migration-013.sql
# Paste into SQL Editor and execute
```

## Integration with Project

The verification script is integrated into `package.json`:

```json
{
  "scripts": {
    "verify:bug17": "bun run scripts/verify-bug-17.ts"
  }
}
```

## Files Created for Bug #17

### Scripts (this directory)
- ✅ `verify-bug-17.ts` - Automated verification
- ✅ `run-bug-17-verification.sh` - Bash runner
- ✅ `test-migration-013.sql` - SQL validation
- ✅ `BUG_17_VERIFICATION.md` - Detailed docs
- ✅ `BUG_17_README.md` - This file

### Root directory
- ✅ `BUG_17_QUICK_REFERENCE.md` - Quick reference
- ℹ️  `BUG_17_FIX_SUMMARY.md` - Fix summary (existing)
- ℹ️  `BUG_17_IMPLEMENTATION_PLAN.md` - Implementation plan (existing)

### Migrations
- ✅ `migrations/013_create_bug_testing_sessions.sql` - The actual fix

### Configuration
- ✅ `package.json` - Added `verify:bug17` script

## Testing Workflow

### Pre-Deployment
1. Run `bun run verify:bug17` - Should pass 5/5 tests
2. Run `bun run check` - Should have no TypeScript errors
3. Review migration SQL in `migrations/013_create_bug_testing_sessions.sql`

### Deployment
1. Apply migration: `supabase db push`
2. Verify in Supabase Dashboard that table exists
3. Run SQL validation: `test-migration-013.sql`

### Post-Deployment
1. Start dev server: `bun dev`
2. Navigate to bug detail page: `/bugs/1`
3. Click "Testing" tab
4. Create test session
5. Verify CRUD operations work

## Troubleshooting

### Verification script fails
- Check that migration file exists
- Ensure all required dependencies are installed
- Review error messages for specific failures

### Type checking fails
- Ensure SvelteKit sync has run
- Check that Svelte packages are up to date
- Verify TypeScript configuration is correct

### Migration fails to apply
- Check Supabase connection
- Verify dependent tables exist (`phwb_bugs`)
- Check for SQL syntax errors
- Ensure `update_updated_at_column()` function exists

## Related Documentation

- `../BUG_17_QUICK_REFERENCE.md` - Quick start guide
- `../BUG_17_FIX_SUMMARY.md` - Detailed fix explanation
- `BUG_17_VERIFICATION.md` - Complete verification guide
- `../migrations/013_create_bug_testing_sessions.sql` - Migration file

## Support

For issues or questions:
1. Review verification output for specific errors
2. Check comprehensive docs in `BUG_17_VERIFICATION.md`
3. Verify migration file against schema requirements
4. Test in local Supabase instance first

---

**Last Updated:** 2026-01-23  
**Bug Status:** FIXED ✅  
**Migration Number:** 013
