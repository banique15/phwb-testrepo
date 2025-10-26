# Create Ensemble with Members - Enhancement

## Feature Enhancement
Added ability to select and add artists as members directly when creating a new ensemble, eliminating the need for a separate "Add Member" step.

## Changes Made

### Updated: Create Ensemble Modal
**File:** [src/routes/artists/components/modals/CreateEnsemble.svelte](src/routes/artists/components/modals/CreateEnsemble.svelte)

### New Features Added:

#### 1. **Artist Selection Section**
- Searchable list of all artists
- Real-time search filtering by name or email
- Checkbox selection for multiple artists
- "Select All" and "Clear All" bulk actions

#### 2. **Role Assignment**
- Individual role input for each selected member
- Inline role editing in the selected members preview
- Optional field (can create ensemble members without roles)
- Examples: "Lead Vocalist", "Pianist", "Drummer", etc.

#### 3. **Selected Members Preview**
- Visual confirmation of selected artists
- Shows count badge
- Editable roles for each member
- Quick removal with × button
- Helper text with role examples

#### 4. **Automatic Member Creation**
- Members are added immediately after ensemble creation
- Single transaction - no need for follow-up steps
- Graceful error handling (ensemble still created even if members fail)

## User Experience Flow

### Before (2 steps):
1. Create ensemble → Click "Create"
2. Open ensemble → Click "Add Member" → Search artist → Add → Repeat

### After (1 step):
1. Create ensemble → Select artists → Assign roles → Click "Create" ✅

## UI Improvements

### Layout
- Expanded modal width to `max-w-4xl` (from `max-w-2xl`)
- Added vertical scrolling for long artist lists
- Added divider with "Add Members (Optional)" label
- Consistent styling with event creation modal

### Search & Filter
- Real-time search as you type
- Searches across:
  - Full name
  - Legal first name
  - Artist name
  - Email address
- Shows email below name for disambiguation

### Selected Members Section
- Color-coded primary badge for each member
- Inline role input with placeholder
- Remove button (×) for quick deselection
- Count badge showing total selected
- Info tip about role examples

## Technical Implementation

### State Management
```typescript
let artists = $state<Artist[]>([])
let loadingArtists = $state(true)
let artistSearchTerm = $state('')
let selectedArtistIds = $state<Set<string>>(new Set())
let artistRoles = $state<Record<string, string>>({})
```

### Member Creation
```typescript
if (selectedArtistIds.size > 0 && newEnsemble.id) {
  const memberInserts = Array.from(selectedArtistIds).map(artistId => ({
    ensemble_id: newEnsemble.id,
    artist_id: artistId,
    role: artistRoles[artistId] || null,
    joined_at: new Date().toISOString(),
    is_active: true
  }))

  await supabase.from('phwb_ensemble_members').insert(memberInserts)
}
```

### Functions Added
- `loadArtists()` - Fetch all artists on mount
- `toggleArtist(artistId)` - Add/remove artist from selection
- `selectAllVisibleArtists()` - Bulk select filtered artists
- `clearAllArtists()` - Clear all selections
- `getArtistDisplayName(artist)` - Consistent name display

### Derived State
```typescript
let displayedArtists = $derived.by(() => {
  if (!artistSearchTerm.trim()) return artists

  const searchLower = artistSearchTerm.toLowerCase()
  return artists.filter(artist =>
    artist.full_name?.toLowerCase().includes(searchLower) ||
    // ... other fields
  )
})
```

## Error Handling

### Graceful Degradation
- If members fail to add, ensemble is still created
- Error message: "Ensemble created, but some members could not be added."
- Doesn't break the workflow

### Validation
- No validation required (members are optional)
- Empty role fields are saved as `null`
- Duplicate checking happens at database level

## Benefits

✅ **Single-Step Workflow** - Create ensemble with members in one go

✅ **Time Saving** - No need to navigate back and forth

✅ **Better UX** - See all selections before creating

✅ **Bulk Operations** - Select All/Clear All for efficiency

✅ **Role Assignment** - Add roles during creation instead of editing later

✅ **Search Capability** - Easy to find artists in large datasets

✅ **Consistent Pattern** - Matches event creation modal design

## Testing Checklist

- [ ] Modal opens and loads artists
- [ ] Search filters artists correctly
- [ ] Selecting/deselecting artists works
- [ ] "Select All" selects all filtered artists
- [ ] "Clear All" clears all selections
- [ ] Role input saves for each artist
- [ ] Remove button (×) removes artist
- [ ] Counter badge updates correctly
- [ ] Creating ensemble without members works
- [ ] Creating ensemble with 1 member works
- [ ] Creating ensemble with multiple members works
- [ ] Members show correct roles in detail view
- [ ] Members without roles save properly
- [ ] Error handling works if member insert fails

## Example Usage

### Creating "Big Apple Quintet"
1. Click "Add Ensemble" button
2. Enter name: "Big Apple Quintet"
3. Select type: "Jazz Ensemble"
4. Search and select 5 artists:
   - Larry Siegel → Role: "Pianist"
   - Hasan Bakr → Role: "Bassist"
   - Adam Narimatsu → Role: "Drummer"
   - Ron Thompson → Role: "Saxophone"
   - Benjamin Sutin → Role: "Trumpet"
5. Click "Create Ensemble"
6. ✅ Ensemble created with all 5 members!

## Database Operations

### Ensemble Creation
```sql
INSERT INTO phwb_ensembles (name, ensemble_type, status, ...)
VALUES ('Big Apple Quintet', 'Jazz Ensemble', 'active', ...);
```

### Member Insertion (Batch)
```sql
INSERT INTO phwb_ensemble_members (ensemble_id, artist_id, role, joined_at, is_active)
VALUES
  (ensemble_id, artist_1_id, 'Pianist', NOW(), true),
  (ensemble_id, artist_2_id, 'Bassist', NOW(), true),
  (ensemble_id, artist_3_id, 'Drummer', NOW(), true),
  ...;
```

## Related Files

1. **Modified:**
   - [src/routes/artists/components/modals/CreateEnsemble.svelte](src/routes/artists/components/modals/CreateEnsemble.svelte)

2. **Related (unchanged):**
   - [src/routes/artists/components/modals/AddEnsembleMember.svelte](src/routes/artists/components/modals/AddEnsembleMember.svelte)
   - [src/lib/schemas/ensemble.ts](src/lib/schemas/ensemble.ts)
   - [src/lib/stores/ensembles.ts](src/lib/stores/ensembles.ts)

## Future Enhancements

Optional improvements that could be added:
1. Set ensemble leader from selected members
2. Import members from another ensemble
3. Suggest common ensemble configurations
4. Validate minimum members for certain types (e.g., quartet needs 4)
5. Show artist availability status
6. Filter artists by instrument/genre

---

**Implementation Status:** ✅ Complete
**Ready for Testing:** Yes
**Breaking Changes:** None
**Backward Compatibility:** Yes (members still optional)
