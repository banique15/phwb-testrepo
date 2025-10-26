# Instant to Supabase Migration Analysis

## Overview
This document outlines the data migration from Instant DB (hope app) to Supabase for the PHWB Admin system.

## Instant App Details
- **App ID**: `14c443ea-7e34-4058-b167-7af45cae3f4f`
- **App Name**: hope
- **Created**: 2025-10-15

## Key Entities to Migrate

### 1. Artists Entity

#### Instant Schema (Source)
The `artists` entity in Instant contains comprehensive artist information:

**Core Fields:**
- `firstName`, `middleName`, `lastName` - Name components
- `stageName` - Performance/public name
- `email` (unique, indexed), `workEmail`
- `phone`
- `address`, `addressLine2`, `city`, `state`, `zip`, `country`
- `dateOfBirth` (number/timestamp)
- `companyName`
- `imageURL`

**Demographic Fields:**
- `gender`
- `ethnicity`
- `race`
- `disability`
- `languages` (string)

**Employment Fields:**
- `employmentType` (required)
- `taxID`

**Emergency Contact:**
- `emergencyContactName`
- `emergencyContactPhone`

**Administrative:**
- `internalNotes`
- `createdAt`, `updatedAt` (number/timestamps)

**Relationships (Links):**
- `employmentRecord` → one `employmentRecords`
- `ensembles` → many `ensembles` (member of)
- `leadingEnsembles` → many `ensembles` (leader of)
- `pianosProfile` → one `pianosProfiles`
- `programs` → many `programs`
- `publicHealthProfile` → one `publicHealthProfiles`
- `workforceDevelopmentProfile` → one `workforceDevelopmentProfiles`
- `phwbPrograms` → many `phwbPrograms`
- `user` → one `users`

#### Supabase Schema (Target)
The `phwb_artists` table in Supabase has a different structure:

**Existing Fields:**
- `id` (uuid) - primary key
- `created_at` (timestamptz)
- `full_name`, `artist_name`, `legal_name`
- `legal_first_name`, `legal_last_name`
- `public_first_name`, `public_last_name`
- `dob` (date)
- `email`, `phone`
- `location`, `address`
- `employment_status`
- `profile_photo`
- `shirt_size`
- `genres` (jsonb), `instruments` (jsonb)
- `bio`
- `social_link` (jsonb), `languages` (jsonb)
- `availability` (jsonb), `equipment_needs` (jsonb)
- `history` (jsonb), `special_requirements` (jsonb)
- `training` (jsonb)
- `sightreads` (boolean), `can_be_soloist` (boolean)
- `anti_harassment_training_date` (date)
- `social_security_number`
- `instagram`, `website`, `facebook`
- `metropolitan_hub`
- `one_sentence_bio`

#### Field Mapping: Instant → Supabase

| Instant Field | Supabase Field | Transformation Required | Notes |
|--------------|----------------|------------------------|--------|
| `firstName` + `lastName` | `full_name` | Concatenate | Combine with space |
| `firstName` | `legal_first_name` | Direct | - |
| `lastName` | `legal_last_name` | Direct | - |
| `stageName` | `artist_name` | Direct | - |
| `dateOfBirth` | `dob` | Convert timestamp to date | Instant uses milliseconds |
| `email` | `email` | Direct | Already unique |
| `phone` | `phone` | Direct | - |
| `address` + `addressLine2` | `address` | Concatenate | Combine both address lines |
| `city`, `state`, `zip` | `location` | Format as string | Create "City, State ZIP" |
| `employmentType` | `employment_status` | Direct | - |
| `imageURL` | `profile_photo` | Direct | - |
| `internalNotes` | Add to `history` jsonb | Convert to JSON | New field or jsonb |
| `createdAt` | `created_at` | Convert timestamp to timestamptz | Instant uses milliseconds |
| `taxID` | `social_security_number` | Direct | Sensitive data |
| `languages` | `languages` | Parse string to jsonb | If string format in Instant |

#### Missing/Unmapped Instant Fields
These fields exist in Instant but not in Supabase `phwb_artists`:
- `middleName` - **ACTION NEEDED**: Add column or concat to full_name
- `workEmail` - **ACTION NEEDED**: Add column or store in jsonb
- `addressLine2` - Will be merged with `address`
- `country` - **ACTION NEEDED**: Add column if international artists
- `companyName` - **ACTION NEEDED**: Add column or store in jsonb
- `gender` - **ACTION NEEDED**: Add demographic column
- `ethnicity` - **ACTION NEEDED**: Add demographic column
- `race` - **ACTION NEEDED**: Add demographic column
- `disability` - **ACTION NEEDED**: Add column or store in special_requirements
- `emergencyContactName` - **ACTION NEEDED**: Add column or store in jsonb
- `emergencyContactPhone` - **ACTION NEEDED**: Add column or store in jsonb
- `updatedAt` - **ACTION NEEDED**: Add updated_at column

#### Missing/Unmapped Supabase Fields
These exist in Supabase but not in Instant:
- `shirt_size` - Will be NULL
- `genres` - Will be NULL (populated separately?)
- `instruments` - Will be NULL (populated separately?)
- `bio` - May come from linked profiles
- `social_link` - Will be constructed from Instagram/website?
- `availability` - May come from workforce profile
- `equipment_needs` - Will be NULL
- `history` - Will be NULL initially
- `training` - Will be NULL
- `sightreads` - May come from publicHealthProfile
- `can_be_soloist` - Will be NULL
- `anti_harassment_training_date` - Will be NULL
- `metropolitan_hub` - Will be NULL
- `one_sentence_bio` - Will be NULL
- `facebook` - Will be NULL

---

### 2. Ensembles Entity

#### Instant Schema (Source)
**Core Fields:**
- `name` (required)
- `description`
- `type` (required) - e.g., "band", "orchestra", "quartet"
- `status` (required) - e.g., "active", "inactive"
- `website`
- `createdAt`, `updatedAt` (number/timestamps)

**Relationships:**
- `leader` → one `artists` (ensemble leader)
- `members` → many `artists` (ensemble members)

#### Supabase Schema (Target)
**Currently Missing** - Ensembles table does not exist in Supabase!

**ACTION NEEDED**: Create `phwb_ensembles` table with:
```sql
CREATE TABLE phwb_ensembles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  name text NOT NULL,
  description text,
  ensemble_type text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  website text,
  leader_id uuid REFERENCES phwb_artists(id),
  CONSTRAINT status_check CHECK (status IN ('active', 'inactive', 'archived'))
);

-- Junction table for ensemble members
CREATE TABLE phwb_ensemble_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ensemble_id uuid REFERENCES phwb_ensembles(id) ON DELETE CASCADE,
  artist_id uuid REFERENCES phwb_artists(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  role text,
  is_active boolean DEFAULT true,
  UNIQUE(ensemble_id, artist_id)
);
```

---

### 3. Related Profile Entities

#### Employment Records
**Instant Schema:**
- Links 1:1 with artists
- Contains ADP integration data, hire dates, job titles, worker categories

**Supabase:** Not present - may need to be added to `phwb_artists` or separate table

#### Public Health Profiles
**Instant Schema:**
- Artist designation, instruments, genres, certifications
- Healthcare experience, bookings tracking
- Contains data that should populate `instruments`, `genres`, `bio` in Supabase

**Supabase:** Data should be merged into `phwb_artists` jsonb fields

#### Pianos Profiles
**Instant Schema:**
- Artist statements, bio, design statements
- Portfolio and website URLs
- Previous projects

**Supabase:** Separate `piano_artists` table exists for the Pianos program

#### Workforce Development Profiles
**Instant Schema:**
- Skills, experience, availability
- Hourly rate information

**Supabase:** Should populate `availability` and related jsonb fields in `phwb_artists`

---

## Migration Steps

### Phase 1: Schema Preparation
1. ✅ Analyze Instant schema structure
2. ✅ Compare with Supabase schema
3. ⏳ Create SQL migration to add missing columns to `phwb_artists`
4. ⏳ Create `phwb_ensembles` and `phwb_ensemble_members` tables
5. ⏳ Add indexes for performance

### Phase 2: Data Export
1. ⏳ Export all artists from Instant with linked data
2. ⏳ Export all ensembles with members
3. ⏳ Export employment records
4. ⏳ Export all profile types (publicHealth, pianos, workforceDevelopment)
5. ⏳ Save exports as JSON files for reference

### Phase 3: Data Transformation
1. ⏳ Transform artist data to match Supabase schema
2. ⏳ Merge profile data into artist records
3. ⏳ Handle name formatting and address concatenation
4. ⏳ Convert timestamps to proper PostgreSQL formats
5. ⏳ Build social_link jsonb from scattered fields
6. ⏳ Create ensemble records and member associations

### Phase 4: Data Loading
1. ⏳ Load artists into Supabase
2. ⏳ Load ensembles and memberships
3. ⏳ Verify foreign key relationships
4. ⏳ Run data quality checks

### Phase 5: Validation
1. ⏳ Verify record counts match
2. ⏳ Spot-check sample records for accuracy
3. ⏳ Test application functionality with migrated data
4. ⏳ Document any data quality issues

---

## Critical Missing Columns in phwb_artists

The following columns should be added to support full Instant data:

```sql
ALTER TABLE phwb_artists
  ADD COLUMN IF NOT EXISTS middle_name text,
  ADD COLUMN IF NOT EXISTS work_email text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'USA',
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS ethnicity text,
  ADD COLUMN IF NOT EXISTS race text,
  ADD COLUMN IF NOT EXISTS disability text,
  ADD COLUMN IF NOT EXISTS emergency_contact jsonb, -- {name, phone}
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS instant_id text UNIQUE, -- For migration tracking
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS tax_id text; -- Encrypted/protected
```

---

## Data Volume Estimates
Based on Instant schema and Supabase current data:
- **Artists**: ~413 existing in Supabase, unknown count in Instant
- **Ensembles**: 0 in Supabase (needs creation)
- **Programs**: Various program associations to migrate

---

## Next Steps

1. **Execute Schema Migrations** - Add missing columns and tables
2. **Create Export Script** - Retrieve all data from Instant
3. **Build Transformation Pipeline** - Map and clean data
4. **Test Migration** - Run on staging/dev first
5. **Execute Production Migration** - With rollback plan
6. **Verify and Validate** - Comprehensive testing

---

## Risks & Considerations

1. **Data Loss**: Some Instant fields have no Supabase equivalent
2. **Sensitive Data**: Tax IDs and SSNs need proper handling
3. **Relationships**: Ensemble memberships require junction table
4. **Timestamps**: Conversion from milliseconds to PostgreSQL timestamptz
5. **Deduplication**: May have duplicate artists between systems
6. **Profile Merging**: Multiple profile types need to merge cleanly

---

## Migration Tracking

We should create a migration tracking table:

```sql
CREATE TABLE migration_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  entity_type text NOT NULL,
  instant_id text NOT NULL,
  supabase_id uuid,
  status text DEFAULT 'pending',
  error_message text,
  metadata jsonb
);
```
