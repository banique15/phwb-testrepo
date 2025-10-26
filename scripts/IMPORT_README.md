# Event Import Scripts

This directory contains scripts to import events from spreadsheets into the PHWB system.

## Overview

The import system handles:
- **Date/time parsing** - Converts various formats ("1pm-2pm", "2:00 PM", etc.) to standard format
- **Artist detection** - Automatically identifies solo artists, ensembles, and collaborations
- **Venue mapping** - Fuzzy matches venue names to existing venues in the database
- **Ensemble creation** - Creates ensemble records for groups (Trio, Quartet, etc.)
- **Status mapping** - Converts spreadsheet status codes (CC, H, CD) to database values
- **Payroll preparation** - Structures data ready for payroll generation

## New Database Fields

The following fields were added to `phwb_events`:

- `event_type` - Type of event (Performance, Participatory Concert, Bedside, etc.)
- `confirmation_status` - confirmed, hold, cancelled, pending
- `total_hours_of_service` - Total artist hours across all performers
- `total_fee` - Event total compensation
- `instrumentation_requirements` - Specific instrument/setup needs
- `number_of_musicians` - Count of performers
- `location_detail` - Sub-location within venue (e.g., "Main Lobby")
- `digital_flyer_link` - Marketing materials URL

## Scripts

### 1. `import-events.ts`
Core import utility with parsing and mapping functions.

### 2. `run-import.ts`
Example script showing how to import events programmatically.

Usage:
```bash
# Dry run (no data saved)
bun run scripts/run-import.ts --dry-run

# Live import
bun run scripts/run-import.ts
```

### 3. `csv-to-events.ts`
Converts CSV/TSV files to events and imports them.

Usage:
```bash
# Import MSK events from CSV (dry run)
bun run scripts/csv-to-events.ts msk-events.csv --sheet-type=msk --dry-run

# Import CLC events (live)
bun run scripts/csv-to-events.ts clc-events.csv --sheet-type=clc

# Import Moynihan events
bun run scripts/csv-to-events.ts moynihan.csv --sheet-type=moynihan --dry-run
```

Sheet types:
- `msk` - MSK Hospital events (Sheet 1)
- `clc` - CLC events (Sheet 2)
- `moynihan` - Moynihan Train Hall events (Sheet 3)

## CSV Format

### MSK Sheet (Sheet 1)
Tab-separated columns:
```
Date | Location | Time | Artist Name/Bandleader | No of Musicians | Hours |
Total Musician Fee Hours | Notes | Artist/Bandleader Contact | Status |
Instrumentation & requirements | Artist Description | Additional artist names |
Digital Flyer Link | Artist Website
```

### CLC Sheet (Sheet 2)
Tab-separated columns:
```
DATE | Type | Location | START TIME | END TIME | ARTIST | NOTES / SPECIAL DETAILS |
Confirmation status | TOTAL HRS | # ARTISTS | TOTAL HOURS OF SERVICE | TOTAL FEE |
PDF | PNG
```

### Moynihan Sheet (Sheet 3)
Tab-separated columns:
```
Date | Start Time | End Time | Artist | Status | # Musicians | Description | Link
```

## How to Import Your Spreadsheets

### Option 1: Export to CSV/TSV
1. Open your spreadsheet in Excel/Google Sheets
2. Export each sheet as CSV or TSV (tab-separated)
3. Run the import script:
   ```bash
   bun run scripts/csv-to-events.ts sheet1.csv --sheet-type=msk --dry-run
   bun run scripts/csv-to-events.ts sheet2.csv --sheet-type=clc --dry-run
   bun run scripts/csv-to-events.ts sheet3.csv --sheet-type=moynihan --dry-run
   ```
4. Review the dry run output
5. If everything looks good, run without `--dry-run` flag

### Option 2: Programmatic Import
1. Copy the data into `run-import.ts` following the example format
2. Run the script:
   ```bash
   bun run scripts/run-import.ts --dry-run
   ```

## Status Code Mapping

The import scripts map spreadsheet status codes to database values:

| Spreadsheet Code | Database Value |
|------------------|----------------|
| CC, C, CD, CS    | confirmed      |
| H                | hold           |
| CANCELLED        | cancelled      |
| (empty/other)    | pending        |

## Artist Detection

The import automatically detects:

**Ensembles** - Names containing: trio, quartet, quintet, duo, ensemble, collective, band, massive, chorus
- Example: "Trio Fadolin" → Creates ensemble record

**Collaborations** - Names with: &, +, and
- Example: "Larry Siegel & Simón Gómez" → Creates 2 artist records

**Solo Artists** - All other names
- Example: "Kely Pinheiro" → Creates 1 artist record

## Venue Mapping

The script attempts to match venues:
1. **Exact match** - Looks for exact venue name
2. **Partial match** - Fuzzy search for similar names
3. **Creates new** - If no match found, you can manually create the venue first

For sub-locations (like "Main Lobby" at MSK), the main venue is linked and the detail stored in `location_detail`.

## Notes

- Always run with `--dry-run` first to preview changes
- The script creates minimal artist records (name only) - you can fill in details later
- Events with fees and confirmed status are ready for payroll generation
- Ensemble memberships can be managed separately after import

## Troubleshooting

**"Invalid date" errors**
- Check date format - should be like "Monday, Dec 11, 2024" or "12/11/2024"

**"Venue not found" warnings**
- Create the venue first or the event will import without a venue link

**"Artist creation failed"**
- Check for special characters in names
- Verify database connection

**Import seems stuck**
- Check network connection to Supabase
- Verify environment variables are set
