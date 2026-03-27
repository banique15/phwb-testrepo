# Plan: Identify Artists as Production Managers

## Summary

Production managers are a **type of artist**. We need a clear way to identify which artists are production managers so they can be filtered, labeled, and used in event assignment and reporting.

---

## Current State (References in the Project)

### 1. Artists and job title

- **Table**: `phwb_artists`
- **Relevant field**: `job_title` (text), already used for HR roles.
- **Existing production manager job titles** (in `ArtistForm.svelte`, `ArtistsList.svelte`, CSV):
  - `PRMG - PRODUCTION MANAGER` → "Production Manager"
  - `PPMG - PROGRAM & PRODUCTION MANAGER` → "Program & Production Manager"
- Artists with these job titles are already “production managers” in the data; there is no separate boolean or role field.

### 2. Separate Production Managers entity

- **Table**: `phwb_production_managers` (migration `013_create_production_managers.sql`)
- **Page**: `/production-managers` (sidebar: "Production Managers")
- **Schema**: `src/lib/schemas/productionManager.ts` — identity fields (name, email, phone, etc.), optional `user_id`, `facility_id`
- **Location contacts**: `phwb_location_contacts` has optional `production_manager_id` (FK to `phwb_production_managers`)

So today there are **two** notions of “production manager”: (1) artist with a PM job title, (2) row in `phwb_production_managers` (and optionally a location contact linked to that row).

### 3. Events and “production manager contact”

- **Field**: `phwb_events.production_manager_contact_id`
- **Points to**: `phwb_location_contacts` (a contact at a **location/facility**), not to `phwb_artists`.
- So the event’s “Production Manager Contact” is a venue/location contact (e.g. “Jane at Lincoln Center”), not necessarily an artist. This is separate from “which artists are production managers.”

### 4. Other references

- **Payroll**: `payroll-generator.ts` and rate cards refer to “Production Manager” as a role (e.g. PM hours on events).
- **Location contact type**: `CONTACT_TYPES` in `locationContact.ts` includes `'production_manager'` for labeling a contact at a location.
- **Artist list**: `ArtistsList.svelte` shortens PM job titles to “Prod Manager” in the badge.

---

## Goal (Clarified)

- **Production managers are a type of artist.**
- We need the **option to identify** whether an artist is a production manager (for filtering, badges, reporting, and future features like “assign PM artist to event” or payroll).

No change to the meaning of event’s “Production Manager Contact” (location contact) is required for this plan; that stays as-is.

---

## Recommended Approach: Explicit “Is Production Manager” on Artists

Add a single, explicit way to mark an artist as a production manager, and use it everywhere (filters, badges, forms, reporting).

### Option A — Use only job title (no schema change)

- **Idea**: Treat “production manager” as “artist whose `job_title` is one of the known PM codes.”
- **Implementation**:
  - Add a small helper (e.g. `isProductionManagerJobTitle(job_title)` or `PRODUCTION_MANAGER_JOB_TITLES`) used everywhere we need to know if an artist is a PM.
  - On Artists page: add filter “Production managers” that restricts to those job titles.
  - In artist list/detail: show a “Prod Manager” (or “Production Manager”) badge when `job_title` matches.
- **Pros**: No migration, no new column, quick to ship.
- **Cons**: Any new PM job title code must be added to the helper; logic is spread (job title string checks).

### Option B — Add `is_production_manager` on artists (recommended)

- **Idea**: Add a boolean `is_production_manager` on `phwb_artists` and use it as the single source of truth for “this artist is a production manager.”
- **Implementation**:
  1. **Database**
     - Migration: add `is_production_manager boolean DEFAULT false` to `phwb_artists`, plus index if we filter often.
     - Optional: one-time backfill from existing data: set `is_production_manager = true` where `job_title` is in (`PRMG - PRODUCTION MANAGER`, `PPMG - PROGRAM & PRODUCTION MANAGER`).
  2. **Schema**
     - In `artist.ts`: add `is_production_manager: z.boolean().optional()` (or `.default(false)`) to `artistSchema` and ensure create/update schemas allow it.
  3. **Artist form**
     - In create/edit artist flows (e.g. `ArtistForm.svelte`, Create Artist modal, Edit Artist modal): add a checkbox or toggle “Production manager” bound to `is_production_manager`.
  4. **Optional sync with job title**
     - When user sets `job_title` to a PM code (PRMG / PPMG), auto-set `is_production_manager = true`; when they clear or change to a non-PM title, optionally set `is_production_manager = false` (or leave it as a manual override).
  5. **Artists list and detail**
     - Use `is_production_manager` (or, for backward compatibility, `is_production_manager || isProductionManagerJobTitle(artist.job_title)`) to show a “Production Manager” badge.
  6. **Artists page filter**
     - Add a filter “Production managers” that filters by `is_production_manager === true` (and optionally includes legacy job-title-based PMs until data is fully backfilled).
  7. **Reporting / payroll**
     - Any report or payroll logic that needs “production manager artists” should use `is_production_manager` (and optionally job title for legacy).

- **Pros**: Clear meaning, one place to look, easy filtering and reporting, works even if job titles change or new PM roles are added without new codes.
- **Cons**: One migration and a few form/UI touches.

**Recommendation**: Implement **Option B**, and optionally keep a small helper that treats known PM job titles as “production manager” for backward compatibility until backfill is done.

---

## Implementation Checklist (Option B)

- [ ] **Migration**: Add `is_production_manager` to `phwb_artists` (default false), index if desired.
- [ ] **Backfill** (optional): Set `is_production_manager = true` where `job_title` IN (`PRMG - PRODUCTION MANAGER`, `PPMG - PROGRAM & PRODUCTION MANAGER`).
- [ ] **Schema**: Update `src/lib/schemas/artist.ts` with `is_production_manager`.
- [ ] **Create artist**: Add “Production manager” checkbox/toggle in create-artist flow.
- [ ] **Edit artist**: Add “Production manager” checkbox/toggle in edit-artist flow (and in ArtistForm if used there).
- [ ] **Artists list**: Show “Production Manager” (or “Prod Manager”) badge when `is_production_manager` is true (and optionally when job title is PM and flag not yet set).
- [ ] **Artist detail**: Show same badge in header or summary.
- [ ] **Artists page filter**: Add “Production managers” filter that filters by `is_production_manager === true`.
- [ ] **Helper** (optional): `isArtistProductionManager(artist)` in a shared util that checks `is_production_manager` and/or known PM job titles.
- [ ] **Docs**: Short note in CLAUDE.md or project docs that “production manager” in the context of artists means “artist with is_production_manager set (or legacy PM job title).”

---

## Relationship to Existing “Production Managers” Page

- **`/production-managers`** and **`phwb_production_managers`** are a separate entity (people who may or may not be artists).
- **Artists with `is_production_manager`** are the “artist type = production manager” concept you asked for.

Possible future directions (out of scope for this plan):

- **Unify**: e.g. allow linking an artist to a `phwb_production_managers` row, or gradually migrate PM data into artists and deprecate the separate table.
- **Keep both**: Use “Production Managers” page for non-artist PMs or legacy data, and use the Artists page + “Production managers” filter for “artists who are production managers.”

For the current goal (“identify if an artist is a production manager”), the checklist above is sufficient and does not require changes to `phwb_production_managers` or the event’s production manager **contact** (location contact).

---

## Files to Touch (Option B)

| Area            | File(s) |
|-----------------|--------|
| Migration       | New migration, e.g. `migrations/014_artist_is_production_manager.sql` |
| Schema          | `src/lib/schemas/artist.ts` |
| Create artist   | `src/routes/artists/components/modals/CreateArtist.svelte` (or equivalent) |
| Edit / form     | `src/routes/artists/components/ArtistForm.svelte`, `EditArtist.svelte` if present |
| List & badge    | `src/routes/artists/components/ArtistsList.svelte`, list in `+page.svelte` |
| Detail          | `ArtistHeaderCard.svelte` or detail view |
| Filter          | Artists page filter state and derived list (e.g. `+page.svelte` or component that filters artists) |
| Util (optional) | e.g. `src/lib/utils/artist.ts` or existing artist helpers |

---

## Summary

- **Current**: Production manager identity for artists is implied by `job_title` (PRMG / PPMG). A separate `phwb_production_managers` table and event “Production Manager Contact” (location contact) also exist.
- **Goal**: Support “production managers as a type of artist” with a clear way to identify them.
- **Plan**: Add `is_production_manager` to artists (Option B), backfill from existing job titles, and add UI (form toggle, badge, filter). Option A (job title only) is possible with no schema change if you prefer to ship faster and add the flag later.
