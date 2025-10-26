# Artist Matcher Utility

This utility provides comprehensive fuzzy matching capabilities for converting CSV names to artist UUIDs in the PHWB Admin system.

## Features

- **Fuzzy Name Matching**: Converts various name formats to find matching artists
- **Format Normalization**: Handles "LastName, FirstName", "FirstName LastName", and nicknames in parentheses
- **Confidence Scoring**: Returns match confidence from 0.0 to 1.0
- **Multiple Match Support**: Returns all potential matches for manual review
- **Batch Processing**: Efficiently processes multiple names for CSV imports
- **Manual Override**: Allows explicit artist selection for ambiguous cases

## Core Functions

### `normalizeArtistName(name: string)`

Converts input names to a standardized format for comparison.

**Input formats supported:**
- `"Boyanova, Alexandrina"` → `{ fullName: "Alexandrina Boyanova", firstName: "Alexandrina", lastName: "Boyanova" }`
- `"John Smith"` → `{ fullName: "John Smith", firstName: "John", lastName: "Smith" }`
- `"Smith, John (Johnny)"` → `{ fullName: "John Smith", firstName: "John", lastName: "Smith", nickname: "Johnny" }`
- `"O'CONNOR, MARY-JANE"` → `{ fullName: "Mary-Jane O'Connor", firstName: "Mary-Jane", lastName: "O'Connor" }`

### `findArtistByName(name: string)`

Returns the single best artist match for a given name.

```typescript
const match = await findArtistByName("Boyanova, Alexandrina");
if (match) {
  console.log(`Found artist: ${match.artist.full_name} (confidence: ${match.confidence})`);
}
```

### `searchArtistsByName(name: string)`

Returns all potential matches with detailed analysis.

```typescript
const result = await searchArtistsByName("John Smith");
console.log(`Found ${result.allMatches.length} potential matches`);
console.log(`Best match confidence: ${result.bestMatch?.confidence}`);
console.log(`Needs manual review: ${result.needsManualReview}`);
```

### `batchMatchArtists(names: string[])`

Processes multiple names efficiently for CSV imports.

```typescript
const names = ["Boyanova, Alexandrina", "Smith, John", "Unknown Artist"];
const { results, summary } = await batchMatchArtists(names);

console.log(`Processed: ${summary.totalProcessed}`);
console.log(`Exact matches: ${summary.exactMatches}`);
console.log(`Fuzzy matches: ${summary.fuzzyMatches}`);
console.log(`No matches: ${summary.noMatches}`);
console.log(`Need review: ${summary.needsReview}`);
```

## Match Types and Confidence Scores

### Match Types
- **`exact`**: Perfect match found (confidence = 1.0)
- **`fuzzy`**: High similarity match (confidence ≥ 0.9)
- **`partial`**: Lower similarity match (confidence 0.6-0.89)

### Confidence Thresholds
- **1.0**: Exact match in database fields
- **0.9-0.99**: Very high similarity (recommended for auto-assignment)
- **0.8-0.89**: High similarity (consider for auto-assignment)
- **0.6-0.79**: Moderate similarity (manual review recommended)
- **< 0.6**: Low similarity (not returned as matches)

## Database Fields Matched

The utility searches across multiple artist fields:
- `full_name`
- `artist_name`
- `legal_name`
- `legal_first_name` + `legal_last_name`
- `public_first_name` + `public_last_name`

## Usage Examples

### Basic CSV Import Processing

```typescript
import { batchMatchArtists, createManualOverride } from '$lib/utils/artistMatcher';

async function processCsvArtists(csvNames: string[]) {
  const { results, summary } = await batchMatchArtists(csvNames);
  
  const processedResults = [];
  
  for (const result of results) {
    if (result.bestMatch && !result.needsManualReview) {
      // Auto-assign high-confidence matches
      processedResults.push({
        originalName: result.originalInput,
        artistId: result.bestMatch.artist.id,
        confidence: result.bestMatch.confidence,
        status: 'auto-matched'
      });
    } else {
      // Queue for manual review
      processedResults.push({
        originalName: result.originalInput,
        potentialMatches: result.allMatches,
        status: 'needs-review'
      });
    }
  }
  
  return { processedResults, summary };
}
```

### Manual Override for Ambiguous Matches

```typescript
import { createManualOverride, validateArtistExists } from '$lib/utils/artistMatcher';

async function handleManualSelection(originalName: string, selectedArtistId: string) {
  // Validate the selected artist exists
  const artist = await validateArtistExists(selectedArtistId);
  
  if (artist) {
    const manualMatch = createManualOverride(originalName, artist);
    return manualMatch;
  }
  
  throw new Error('Selected artist not found');
}
```

### Integration with UI Components

```typescript
// In a Svelte component for CSV import review
import { searchArtistsByName } from '$lib/utils/artistMatcher';

let csvNames = ['Boyanova, Alexandrina', 'Smith, John'];
let matchResults = [];

async function processNames() {
  matchResults = [];
  
  for (const name of csvNames) {
    const result = await searchArtistsByName(name);
    matchResults.push(result);
  }
}
```

## Error Handling

The utility includes comprehensive error handling:

- **Empty/Invalid Names**: Throws descriptive errors for invalid input
- **Database Errors**: Catches and re-throws Supabase errors with context
- **Network Issues**: Handles connection failures gracefully
- **Type Safety**: Full TypeScript support with proper error types

## Performance Considerations

- **Batch Processing**: Use `batchMatchArtists()` for multiple names
- **Caching**: Consider implementing result caching for repeated lookups
- **Database Optimization**: For large datasets, consider server-side search
- **Rate Limiting**: Be mindful of Supabase rate limits for large imports

## Future Enhancements

Potential improvements for the utility:
- Server-side fuzzy search using PostgreSQL extensions
- Phonetic matching (Soundex, Metaphone)
- Machine learning-based name matching
- Integration with external name databases
- Caching layer for improved performance
- Advanced nickname detection and matching