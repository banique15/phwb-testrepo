# Event Import Implementation Summary

## Overview
Successfully implemented comprehensive event import functionality to import events from three spreadsheet sources (MSK, CLC, and Moynihan Train Hall) into the PHWB system.

## What Was Done

### 1. Database Schema Enhancement ✅
**Migration**: `add_event_import_fields`

Added the following fields to `phwb_events` table:
- `event_type` (TEXT) - Event categorization (Performance, Participatory Concert, Bedside, etc.)
- `confirmation_status` (TEXT) - Booking status with CHECK constraint (confirmed, hold, cancelled, pending)
- `total_hours_of_service` (NUMERIC) - Total artist hours across all performers
- `total_fee` (NUMERIC) - Event total compensation
- `instrumentation_requirements` (TEXT) - Specific instrument/setup needs
- `number_of_musicians` (INTEGER) - Count of performers
- `location_detail` (TEXT) - Sub-location within venue (e.g., "Main Lobby", "MDP Lobby")
- `digital_flyer_link` (TEXT) - Marketing materials URL

Added indexes for:
- `confirmation_status` - Fast status filtering
- `event_type` - Fast event type filtering
- `date` - Fast date-based queries

### 2. TypeScript Schema Updates ✅
**File**: [src/lib/schemas/event.ts](src/lib/schemas/event.ts)

Updated `eventSchema` with proper Zod validation for all new fields including:
- String length constraints
- Numeric range validation
- Enum validation for status
- URL format validation

### 3. Import Utility Scripts ✅

Created three import scripts in `scripts/` directory:

#### a. **import-events.ts** - Core Import Library
Features:
- **Smart time parsing** - Handles "1pm-2pm", "2:00 PM", "3:30pm" formats
- **Date normalization** - Converts various date formats to YYYY-MM-DD
- **Artist/ensemble detection** - Automatically identifies:
  - Solo artists (e.g., "Kely Pinheiro")
  - Ensembles (Trio, Quartet, Quintet, etc.)
  - Collaborations (names with &, +, "and")
- **Venue fuzzy matching** - Finds venues by exact or partial name match
- **Status code mapping** - Converts spreadsheet codes (CC, H, CD) to database values
- **Auto-create entities** - Creates missing artists and ensembles on-the-fly
- **Dry-run mode** - Preview imports before committing

#### b. **run-import.ts** - Programmatic Import Example
Sample script showing how to import events programmatically with proper data structure

#### c. **csv-to-events.ts** - CSV/TSV Import Tool
Converts CSV/TSV files directly to events with support for three sheet types:
- `--sheet-type=msk` - MSK Hospital events
- `--sheet-type=clc` - CLC events
- `--sheet-type=moynihan` - Moynihan Train Hall events

### 4. Documentation ✅
**File**: [scripts/IMPORT_README.md](scripts/IMPORT_README.md)

Comprehensive guide covering:
- Script usage instructions
- CSV format specifications
- Status code mapping reference
- Artist detection rules
- Venue mapping strategy
- Troubleshooting tips

## How to Use

### Quick Start

1. **Export your spreadsheets to CSV/TSV format**
   - Save each sheet as a separate file

2. **Run a dry-run import** (no data saved):
   ```bash
   bun run scripts/csv-to-events.ts msk-events.csv --sheet-type=msk --dry-run
   ```

3. **Review the output** - Check for any errors or warnings

4. **Run the live import**:
   ```bash
   bun run scripts/csv-to-events.ts msk-events.csv --sheet-type=msk
   ```

### Example Commands

```bash
# Import MSK hospital events (dry run)
bun run scripts/csv-to-events.ts sheet1.csv --sheet-type=msk --dry-run

# Import CLC events (live)
bun run scripts/csv-to-events.ts sheet2.csv --sheet-type=clc

# Import Moynihan events (dry run)
bun run scripts/csv-to-events.ts sheet3.csv --sheet-type=moynihan --dry-run
```

## What the Import Handles Automatically

### Artist Management
- ✅ Detects ensemble names (Trio Fadolin, Big Apple Quintet, etc.)
- ✅ Creates ensemble records with proper typing
- ✅ Splits collaborations ("Larry Siegel & Simón Gómez") into separate artists
- ✅ Creates minimal artist records (can be enhanced later)

### Data Normalization
- ✅ Converts time formats to standard HH:MM
- ✅ Parses various date formats to YYYY-MM-DD
- ✅ Maps venue names to existing venue records
- ✅ Converts status codes to standard values

### Validation
- ✅ Validates dates before import
- ✅ Checks for required fields
- ✅ Reports errors without stopping the import
- ✅ Provides detailed logging

## Data Coverage Analysis

### Fields Covered from Spreadsheets

**Sheet 1 (MSK)**: ✅ All fields mapped
- Date → `date`
- Location → `venue` (via mapping) + `location_detail`
- Time → `start_time`, `end_time`
- Artist Name → `artists` (JSONB array)
- Number of Musicians → `number_of_musicians`
- Hours → `total_hours_of_service`
- Status → `confirmation_status`
- Instrumentation → `instrumentation_requirements`
- Description → `notes`
- Website → stores in artist record
- Digital Flyer → `digital_flyer_link`

**Sheet 2 (CLC)**: ✅ All fields mapped
- Date → `date`
- Type → `event_type`
- Location → `venue`
- Start/End Time → `start_time`, `end_time`
- Artist → `artists`
- # Artists → `number_of_musicians`
- Total Hours → `total_hours_of_service`
- Total Fee → `total_fee`
- Status → `confirmation_status`
- Notes → `notes`

**Sheet 3 (Moynihan)**: ✅ All fields mapped
- Date → `date`
- Start/End Time → `start_time`, `end_time`
- Artist → `artists`
- Status → `confirmation_status`
- # Musicians → `number_of_musicians`
- Description → `notes`
- Link → `digital_flyer_link`

## Next Steps

### To Import Your Data:
1. Export each spreadsheet sheet to CSV/TSV
2. Run dry-run imports to verify parsing
3. Review any warnings about missing venues or artists
4. Create any missing venues manually if needed
5. Run live imports
6. Review imported events in the UI
7. Enhance artist profiles with additional details

### Future Enhancements:
- Auto-generate payroll entries for confirmed events with fees
- Link events to programs automatically
- Bulk venue creation from unmatched locations
- Enhanced ensemble member tracking
- Event series detection

## Files Modified/Created

### Modified:
- [src/lib/schemas/event.ts](src/lib/schemas/event.ts) - Added new field validations

### Created:
- `migrations/add_event_import_fields.sql` - Database migration
- [scripts/import-events.ts](scripts/import-events.ts) - Core import library
- [scripts/run-import.ts](scripts/run-import.ts) - Example import script
- [scripts/csv-to-events.ts](scripts/csv-to-events.ts) - CSV converter
- [scripts/IMPORT_README.md](scripts/IMPORT_README.md) - Documentation

## Testing Recommendations

Before importing production data:

1. **Test with sample data**
   ```bash
   bun run scripts/run-import.ts --dry-run
   ```

2. **Verify artist detection**
   - Check that ensembles are properly identified
   - Verify solo artists are created correctly
   - Confirm collaborations split properly

3. **Check venue mapping**
   - Ensure venues match correctly
   - Create missing venues before import if needed

4. **Review status mapping**
   - Verify all status codes convert correctly
   - Check that "CC", "C", "CD" → "confirmed"
   - Verify "H" → "hold"

5. **Validate dates and times**
   - Confirm all date formats parse correctly
   - Check time conversions (1pm → 13:00)

## Support

For questions or issues:
- See [scripts/IMPORT_README.md](scripts/IMPORT_README.md) for detailed documentation
- Check the Troubleshooting section for common issues
- Review dry-run output for specific error messages
