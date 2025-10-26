/**
 * Example usage of the Artist Matcher utility
 * 
 * This file demonstrates how to integrate the artist matching functionality
 * into your CSV import workflows and UI components.
 */

import { 
  findArtistByName, 
  searchArtistsByName, 
  batchMatchArtists, 
  createManualOverride,
  normalizeArtistName,
  validateArtistExists,
  type ArtistMatch,
  type MatchResult
} from './artistMatcher'

// Example 1: Simple name lookup
export async function exampleSimpleLookup() {
  try {
    const match = await findArtistByName("Boyanova, Alexandrina")
    
    if (match) {
      console.log(`Found artist: ${match.artist.full_name}`)
      console.log(`Confidence: ${match.confidence}`)
      console.log(`Match type: ${match.matchType}`)
      console.log(`Matched fields: ${match.matchedFields.join(', ')}`)
      
      return match.artist.id // Return UUID for database operations
    } else {
      console.log("No matching artist found")
      return null
    }
  } catch (error) {
    console.error("Error finding artist:", error)
    throw error
  }
}

// Example 2: Detailed search with multiple matches
export async function exampleDetailedSearch() {
  try {
    const result = await searchArtistsByName("John Smith")
    
    console.log(`Original input: "${result.originalInput}"`)
    console.log(`Normalized: "${result.normalizedInput}"`)
    console.log(`Found ${result.allMatches.length} potential matches`)
    console.log(`Needs manual review: ${result.needsManualReview}`)
    
    if (result.bestMatch) {
      console.log(`Best match: ${result.bestMatch.artist.full_name} (${result.bestMatch.confidence})`)
    }
    
    // Show all matches for user selection
    result.allMatches.forEach((match, index) => {
      console.log(`${index + 1}. ${match.artist.full_name} - ${match.confidence.toFixed(2)} (${match.matchType})`)
    })
    
    return result
  } catch (error) {
    console.error("Error searching artists:", error)
    throw error
  }
}

// Example 3: CSV Import Processing
export async function exampleCsvImport(csvData: { name: string; role: string; notes?: string }[]) {
  // Extract names from CSV data
  const names = csvData.map(row => row.name)
  
  try {
    const { results, summary } = await batchMatchArtists(names)
    
    console.log('Import Summary:')
    console.log(`Total processed: ${summary.totalProcessed}`)
    console.log(`Exact matches: ${summary.exactMatches}`)
    console.log(`Fuzzy matches: ${summary.fuzzyMatches}`)
    console.log(`No matches: ${summary.noMatches}`)
    console.log(`Need review: ${summary.needsReview}`)
    
    // Process results
    const processedRows = csvData.map((row, index) => {
      const matchResult = results[index]
      
      return {
        ...row,
        originalName: matchResult.originalInput,
        normalizedName: matchResult.normalizedInput,
        bestMatch: matchResult.bestMatch,
        allMatches: matchResult.allMatches,
        needsReview: matchResult.needsManualReview,
        status: getMatchStatus(matchResult)
      }
    })
    
    return {
      processedRows,
      summary,
      autoAssignable: processedRows.filter(row => row.status === 'auto-assign'),
      needsReview: processedRows.filter(row => row.status === 'needs-review'),
      noMatches: processedRows.filter(row => row.status === 'no-match')
    }
  } catch (error) {
    console.error("Error processing CSV import:", error)
    throw error
  }
}

// Example 4: Interactive matching with user selection
export async function exampleInteractiveMatching(inputName: string) {
  try {
    const result = await searchArtistsByName(inputName)
    
    if (!result.bestMatch) {
      return {
        status: 'no-matches',
        message: `No artists found matching "${inputName}"`
      }
    }
    
    if (!result.needsManualReview && result.bestMatch.confidence >= 0.9) {
      return {
        status: 'auto-assigned',
        artist: result.bestMatch.artist,
        confidence: result.bestMatch.confidence
      }
    }
    
    // Return options for user to choose from
    return {
      status: 'user-selection-needed',
      originalName: inputName,
      suggestions: result.allMatches.map(match => ({
        artist: match.artist,
        confidence: match.confidence,
        displayName: `${match.artist.full_name || match.artist.artist_name} (${(match.confidence * 100).toFixed(0)}% match)`,
        recommendation: match.confidence >= 0.85 ? 'recommended' : 'possible'
      }))
    }
  } catch (error) {
    console.error("Error in interactive matching:", error)
    throw error
  }
}

// Example 5: Manual override handling
export async function exampleManualOverride(originalName: string, selectedArtistId: string) {
  try {
    // Use the validateArtistExists function
    const artist = await validateArtistExists(selectedArtistId)
    
    if (!artist) {
      throw new Error(`Artist with ID ${selectedArtistId} not found`)
    }
    
    // Create manual override
    const manualMatch = createManualOverride(originalName, artist)
    
    console.log(`Manual override created: "${originalName}" → ${artist.full_name}`)
    
    return manualMatch
  } catch (error) {
    console.error("Error creating manual override:", error)
    throw error
  }
}

// Example 6: Name normalization testing
export function exampleNameNormalization() {
  const testNames = [
    "Boyanova, Alexandrina",
    "John Smith", 
    "Smith, John (Johnny)",
    "O'CONNOR, MARY-JANE",
    "van der Berg, Johannes",
    "Madonna",
    "JONES, mary-elizabeth (liz)"
  ]
  
  console.log("Name Normalization Examples:")
  console.log("=" .repeat(50))
  
  testNames.forEach(name => {
    try {
      const normalized = normalizeArtistName(name)
      console.log(`Input: "${name}"`)
      console.log(`  Full Name: "${normalized.fullName}"`)
      console.log(`  First: "${normalized.firstName}"`)
      console.log(`  Last: "${normalized.lastName}"`)
      if (normalized.nickname) {
        console.log(`  Nickname: "${normalized.nickname}"`)
      }
      console.log()
    } catch (error) {
      console.log(`Input: "${name}" - ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.log()
    }
  })
}

// Helper function to determine match status
function getMatchStatus(result: MatchResult): string {
  if (!result.bestMatch) return 'no-match'
  if (result.needsManualReview) return 'needs-review'
  if (result.bestMatch.confidence >= 0.9) return 'auto-assign'
  return 'needs-review'
}

// Example 7: Integration with Svelte store
export function createArtistMatcherStore() {
  let matchResults: MatchResult[] = $state([])
  let isProcessing = $state(false)
  let error = $state<string | null>(null)
  
  return {
    get matchResults() { return matchResults },
    get isProcessing() { return isProcessing },
    get error() { return error },
    
    async processNames(names: string[]) {
      isProcessing = true
      error = null
      
      try {
        const { results } = await batchMatchArtists(names)
        matchResults = results
      } catch (err) {
        error = err instanceof Error ? err.message : 'Unknown error occurred'
        matchResults = []
      } finally {
        isProcessing = false
      }
    },
    
    async processName(name: string) {
      isProcessing = true
      error = null
      
      try {
        const result = await searchArtistsByName(name)
        matchResults = [result]
        return result
      } catch (err) {
        error = err instanceof Error ? err.message : 'Unknown error occurred'
        matchResults = []
        return null
      } finally {
        isProcessing = false
      }
    },
    
    clearResults() {
      matchResults = []
      error = null
    }
  }
}

// Note: Import this in your Svelte components to see usage examples
// These functions are for demonstration and can be adapted to your specific needs