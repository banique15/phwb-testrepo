# Instant to Supabase Migration Guide

## Overview
This guide provides step-by-step instructions for migrating artist and ensemble data from Instant DB to Supabase for the PHWB Admin system.

## Prerequisites

1. **Instant DB Access**: Ensure you have access to the "hope" Instant app (ID: `14c443ea-7e34-4058-b167-7af45cae3f4f`)
2. **Supabase Access**: Ensure you have appropriate permissions to execute migrations
3. **Bun Runtime**: Install Bun for running TypeScript scripts
4. **Instant SDK**: Install the Instant DB client library

```bash
bun add @instantdb/core
```

## Files Created

### Documentation
- [MIGRATION_ANALYSIS.md](./MIGRATION_ANALYSIS.md) - Detailed schema comparison and field mapping

### SQL Migrations (in `/migrations/`)
1. `001_prepare_artist_migration.sql` - Adds missing columns to `phwb_artists`
2. `002_create_ensembles_tables.sql` - Creates `phwb_ensembles` and `phwb_ensemble_members` tables
3. `003_create_migration_tracking.sql` - Creates migration logging infrastructure

### Scripts (in `/scripts/`)
1. `export-instant-data.ts` - Exports all data from Instant DB
2. `transform-instant-data.ts` - Transforms Instant data to Supabase format

## Migration Process

### Step 1: Review the Analysis

Read [MIGRATION_ANALYSIS.md](./MIGRATION_ANALYSIS.md) to understand:
- Schema differences between Instant and Supabase
- Field mapping strategies
- Potential data quality issues
- Missing columns and tables

### Step 2: Execute SQL Migrations

Run the SQL migrations in order to prepare your Supabase database:

```bash
# Option 1: Using Supabase CLI
supabase db push

# Option 2: Using the Supabase MCP tool (recommended in Claude Code)
# The migrations will be applied through the MCP interface

# Option 3: Manual execution in Supabase Studio
# Copy and paste each SQL file in the SQL Editor
```

**Important**: Execute migrations in numerical order:
1. First: `001_prepare_artist_migration.sql`
2. Second: `002_create_ensembles_tables.sql`
3. Third: `003_create_migration_tracking.sql`

### Step 3: Export Data from Instant

Run the export script to retrieve all data from Instant DB:

```bash
bun run scripts/export-instant-data.ts
```

This will create:
- `exports/instant-export-<timestamp>.json` - Complete export with all entities
- `exports/artists-<timestamp>.json` - Artists only
- `exports/ensembles-<timestamp>.json` - Ensembles only

**Expected output:**
```
🚀 Starting Instant DB export...

📊 Exporting artists...
✅ Exported XXX artists
📊 Exporting ensembles...
✅ Exported XXX ensembles
📊 Exporting employment records...
✅ Exported XXX employment records
...

✅ Export complete! Saved to: exports/instant-export-YYYY-MM-DDTHH-mm-ss.json
```

### Step 4: Review Exported Data

Open the exported JSON files and verify:
- Data looks complete
- No unexpected null values in critical fields
- Relationships are properly linked
- Profile data is present where expected

### Step 5: Transform Data

Create the `exports/transformed/` directory and run the transformation script:

```bash
mkdir -p exports/transformed
bun run scripts/transform-instant-data.ts exports/instant-export-<timestamp>.json
```

This will:
- Convert Instant schema to Supabase schema
- Generate new UUIDs for Supabase
- Merge profile data into artist records
- Create ensemble memberships
- Format timestamps and dates properly

**Expected output:**
```
🔄 Starting data transformation...

📖 Reading export file: exports/instant-export-YYYY-MM-DD...
   Found XXX artists
   Found XXX ensembles

🎨 Transforming artists...
✅ Transformed XXX artists

🎭 Transforming ensembles...
✅ Transformed XXX ensembles
✅ Created XXX ensemble memberships

✅ Transformation complete!
📁 Output saved to: exports/transformed/
```

### Step 6: Review Transformed Data

Before importing, review the transformed files:

```bash
# Check artists data
cat exports/transformed/artists-transformed-<timestamp>.json | jq '.[0]'

# Check ensembles data
cat exports/transformed/ensembles-transformed-<timestamp>.json | jq '.[0]'

# Check ensemble members
cat exports/transformed/ensemble-members-transformed-<timestamp>.json | jq '.[0:5]'
```

Verify:
- ✅ All required fields are populated
- ✅ UUIDs are properly formatted
- ✅ Timestamps are in ISO 8601 format
- ✅ Foreign keys (leader_id, artist_id, ensemble_id) are valid UUIDs

### Step 7: Import Data to Supabase

You can import using one of these methods:

#### Method A: Using Supabase MCP Tool (Recommended)

```typescript
// Use the mcp__supabase__execute_sql tool to insert data in batches
// This is best done through Claude Code with the Supabase MCP integration
```

#### Method B: Using a Custom Import Script

Create `scripts/import-to-supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { readFile } from 'fs/promises'

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for bulk operations
)

async function importArtists(filePath: string) {
  const artists = JSON.parse(await readFile(filePath, 'utf-8'))

  // Insert in batches of 100
  const batchSize = 100
  for (let i = 0; i < artists.length; i += batchSize) {
    const batch = artists.slice(i, i + batchSize)
    const { error } = await supabase.from('phwb_artists').insert(batch)

    if (error) {
      console.error(`Error importing batch ${i}-${i+batchSize}:`, error)
    } else {
      console.log(`✅ Imported ${batch.length} artists`)
    }
  }
}

// Similar functions for ensembles and members...
```

#### Method C: Using PostgreSQL COPY command

```bash
# Convert JSON to CSV first, then use COPY
# This is fastest for large datasets
```

### Step 8: Verify Migration

After import, run verification queries:

```sql
-- Check artist counts
SELECT COUNT(*) as total_artists FROM phwb_artists;
SELECT COUNT(*) as artists_with_instant_id FROM phwb_artists WHERE instant_id IS NOT NULL;

-- Check ensemble counts
SELECT COUNT(*) as total_ensembles FROM phwb_ensembles;
SELECT COUNT(*) as ensembles_with_leader FROM phwb_ensembles WHERE leader_id IS NOT NULL;

-- Check ensemble memberships
SELECT COUNT(*) as total_memberships FROM phwb_ensemble_members;
SELECT COUNT(*) as active_memberships FROM phwb_ensemble_members WHERE is_active = true;

-- View migration summary
SELECT * FROM migration_summary;

-- Check for orphaned references
SELECT COUNT(*) FROM phwb_ensembles e
LEFT JOIN phwb_artists a ON e.leader_id = a.id
WHERE e.leader_id IS NOT NULL AND a.id IS NULL;
```

### Step 9: Data Quality Checks

Run these queries to identify potential issues:

```sql
-- Artists missing critical information
SELECT id, full_name, email, phone
FROM phwb_artists
WHERE email IS NULL OR phone IS NULL;

-- Duplicate emails
SELECT email, COUNT(*) as count
FROM phwb_artists
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1;

-- Ensembles without any members
SELECT e.id, e.name
FROM phwb_ensembles e
LEFT JOIN phwb_ensemble_members em ON e.id = em.ensemble_id
WHERE em.id IS NULL;

-- Invalid foreign keys
SELECT * FROM phwb_ensemble_members em
WHERE NOT EXISTS (SELECT 1 FROM phwb_artists a WHERE a.id = em.artist_id);
```

### Step 10: Update Application Code

After successful migration, update your application to:

1. **Use new ensemble tables**:
   - Update queries to fetch from `phwb_ensembles` and `phwb_ensemble_members`
   - Add ensemble management UI
   - Update stores to handle ensembles

2. **Handle new artist fields**:
   - Update forms to include new demographic fields
   - Add emergency contact information UI
   - Handle updated_at timestamps

3. **Test thoroughly**:
   - Test artist CRUD operations
   - Test ensemble creation and membership management
   - Verify all relationships work correctly

## Rollback Plan

If something goes wrong, you can rollback:

```sql
-- Rollback Step 1: Delete imported data
DELETE FROM phwb_ensemble_members WHERE created_at > '<migration-start-time>';
DELETE FROM phwb_ensembles WHERE created_at > '<migration-start-time>';
UPDATE phwb_artists SET instant_id = NULL WHERE instant_id IS NOT NULL;

-- Rollback Step 2: Drop new columns (if needed)
ALTER TABLE phwb_artists
  DROP COLUMN IF EXISTS middle_name,
  DROP COLUMN IF EXISTS work_email,
  -- ... (drop other new columns)

-- Rollback Step 3: Drop new tables
DROP TABLE IF EXISTS phwb_ensemble_members CASCADE;
DROP TABLE IF EXISTS phwb_ensembles CASCADE;
DROP TABLE IF EXISTS migration_log CASCADE;
```

## Post-Migration Tasks

1. ✅ Verify all data imported successfully
2. ✅ Run data quality checks
3. ✅ Update application code to use new schema
4. ✅ Test all features thoroughly
5. ✅ Document any data quality issues found
6. ✅ Archive Instant export files for reference
7. ✅ Update team on new ensemble features
8. ✅ Create user documentation for ensemble management

## Troubleshooting

### Issue: Export script fails with authentication error
**Solution**: Verify your Instant app ID is correct and you have access to the app

### Issue: Transformation creates invalid UUIDs
**Solution**: Ensure you're using Node.js 18+ or Bun which has native `crypto.randomUUID()`

### Issue: Foreign key constraint violations during import
**Solution**: Import in correct order: artists first, then ensembles, then ensemble_members

### Issue: Duplicate email errors
**Solution**: Review and merge duplicate artists before import

### Issue: Some profiles are missing data
**Solution**: Check that the export included all linked entities (publicHealthProfile, etc.)

## Support

For questions or issues:
1. Review [MIGRATION_ANALYSIS.md](./MIGRATION_ANALYSIS.md)
2. Check the migration_log table for errors
3. Review failed_migrations view for specific failures
4. Contact the development team

## Timeline Estimate

- **Step 1-2** (Schema preparation): 30 minutes
- **Step 3** (Export): 5-10 minutes
- **Step 4** (Review export): 15 minutes
- **Step 5** (Transform): 5 minutes
- **Step 6** (Review transform): 15 minutes
- **Step 7** (Import): 10-30 minutes (depending on volume)
- **Step 8-9** (Verification): 30 minutes
- **Step 10** (Code updates): 2-4 hours

**Total estimate**: 4-6 hours for complete migration

## Next Steps

After successful migration:
1. Consider deprecating the Instant DB connection
2. Implement ensemble management UI
3. Add data validation and quality checks to application
4. Set up automated backups for new tables
5. Monitor performance of new ensemble queries
