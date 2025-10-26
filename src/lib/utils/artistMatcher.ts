import { supabase } from '$lib/supabase'
import type { Artist } from '$lib/schemas/artist'

export interface ArtistMatch {
	artist: Artist
	confidence: number
	matchType: 'exact' | 'fuzzy' | 'partial'
	matchedFields: string[]
}

export interface MatchResult {
	bestMatch?: ArtistMatch
	allMatches: ArtistMatch[]
	originalInput: string
	normalizedInput: string
	needsManualReview: boolean
}

/**
 * Normalizes an artist name to a standard format for comparison
 * Handles various input formats like "LastName, FirstName", "FirstName LastName", nicknames in parentheses
 */
export function normalizeArtistName(name: string): {
	fullName: string
	firstName: string
	lastName: string
	nickname?: string
} {
	if (!name?.trim()) {
		throw new Error('Name cannot be empty')
	}

	let cleanName = name.trim()
	let nickname: string | undefined

	// Extract nickname in parentheses
	const nicknameMatch = cleanName.match(/\(([^)]+)\)/)
	if (nicknameMatch) {
		nickname = nicknameMatch[1].trim()
		cleanName = cleanName.replace(/\([^)]+\)/, '').trim()
	}

	// Remove extra whitespace and normalize
	cleanName = cleanName.replace(/\s+/g, ' ')

	let firstName = ''
	let lastName = ''

	// Handle "LastName, FirstName" format
	if (cleanName.includes(',')) {
		const parts = cleanName.split(',').map(p => p.trim())
		if (parts.length >= 2) {
			lastName = parts[0]
			firstName = parts[1]
		}
	} else {
		// Handle "FirstName LastName" format
		const parts = cleanName.split(' ')
		if (parts.length >= 2) {
			firstName = parts[0]
			lastName = parts.slice(1).join(' ')
		} else if (parts.length === 1) {
			// Single name - could be first or last
			firstName = parts[0]
		}
	}

	// Clean up and capitalize properly
	firstName = capitalizeProper(firstName)
	lastName = capitalizeProper(lastName)
	
	const fullName = [firstName, lastName].filter(Boolean).join(' ')

	return {
		fullName,
		firstName,
		lastName,
		nickname: nickname ? capitalizeProper(nickname) : undefined
	}
}

/**
 * Properly capitalizes names (handles cases like "O'Connor", "de Silva", etc.)
 */
function capitalizeProper(name: string): string {
	if (!name) return ''
	
	return name
		.toLowerCase()
		.split(/(\s|-|')/)
		.map((part, index, array) => {
			if (part.match(/\s|-|'/)) return part
			
			// Don't capitalize particles unless they're at the beginning
			const particles = ['de', 'da', 'di', 'du', 'del', 'della', 'von', 'van', 'le', 'la']
			if (index > 0 && particles.includes(part.toLowerCase())) {
				return part.toLowerCase()
			}
			
			return part.charAt(0).toUpperCase() + part.slice(1)
		})
		.join('')
}

/**
 * Calculates similarity between two strings using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
	if (!str1 || !str2) return 0
	
	const s1 = str1.toLowerCase().trim()
	const s2 = str2.toLowerCase().trim()
	
	if (s1 === s2) return 1
	
	const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null))
	
	for (let i = 0; i <= s1.length; i++) matrix[0][i] = i
	for (let j = 0; j <= s2.length; j++) matrix[j][0] = j
	
	for (let j = 1; j <= s2.length; j++) {
		for (let i = 1; i <= s1.length; i++) {
			const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1
			matrix[j][i] = Math.min(
				matrix[j][i - 1] + 1,     // deletion
				matrix[j - 1][i] + 1,     // insertion
				matrix[j - 1][i - 1] + indicator // substitution
			)
		}
	}
	
	const distance = matrix[s2.length][s1.length]
	const maxLength = Math.max(s1.length, s2.length)
	
	return maxLength === 0 ? 1 : 1 - (distance / maxLength)
}

/**
 * Checks for exact matches in various name fields
 */
function checkExactMatch(normalized: ReturnType<typeof normalizeArtistName>, artist: Artist): ArtistMatch | null {
	const matchedFields: string[] = []
	
	// Check full name matches
	if (artist.full_name && artist.full_name.toLowerCase() === normalized.fullName.toLowerCase()) {
		matchedFields.push('full_name')
	}
	
	if (artist.artist_name && artist.artist_name.toLowerCase() === normalized.fullName.toLowerCase()) {
		matchedFields.push('artist_name')
	}
	
	if (artist.legal_name && artist.legal_name.toLowerCase() === normalized.fullName.toLowerCase()) {
		matchedFields.push('legal_name')
	}
	
	// Check component matches (both first and last name must match)
	const firstNameMatch = (
		(artist.legal_first_name?.toLowerCase() === normalized.firstName.toLowerCase()) ||
		(artist.public_first_name?.toLowerCase() === normalized.firstName.toLowerCase())
	)
	
	const lastNameMatch = (
		(artist.legal_last_name?.toLowerCase() === normalized.lastName.toLowerCase()) ||
		(artist.public_last_name?.toLowerCase() === normalized.lastName.toLowerCase())
	)
	
	if (firstNameMatch && lastNameMatch) {
		if (artist.legal_first_name?.toLowerCase() === normalized.firstName.toLowerCase()) {
			matchedFields.push('legal_first_name')
		}
		if (artist.public_first_name?.toLowerCase() === normalized.firstName.toLowerCase()) {
			matchedFields.push('public_first_name')
		}
		if (artist.legal_last_name?.toLowerCase() === normalized.lastName.toLowerCase()) {
			matchedFields.push('legal_last_name')
		}
		if (artist.public_last_name?.toLowerCase() === normalized.lastName.toLowerCase()) {
			matchedFields.push('public_last_name')
		}
	}
	
	if (matchedFields.length > 0) {
		return {
			artist,
			confidence: 1.0,
			matchType: 'exact',
			matchedFields
		}
	}
	
	return null
}

/**
 * Calculates fuzzy match score for an artist
 */
function calculateFuzzyMatch(normalized: ReturnType<typeof normalizeArtistName>, artist: Artist): ArtistMatch | null {
	const scores: { field: string; score: number }[] = []
	
	// Check full name similarities
	if (artist.full_name) {
		scores.push({
			field: 'full_name',
			score: calculateSimilarity(normalized.fullName, artist.full_name)
		})
	}
	
	if (artist.artist_name) {
		scores.push({
			field: 'artist_name',
			score: calculateSimilarity(normalized.fullName, artist.artist_name)
		})
	}
	
	if (artist.legal_name) {
		scores.push({
			field: 'legal_name',
			score: calculateSimilarity(normalized.fullName, artist.legal_name)
		})
	}
	
	// Check component name similarities
	if (normalized.firstName && normalized.lastName) {
		// Reconstruct names from components for comparison
		if (artist.legal_first_name && artist.legal_last_name) {
			const legalFullName = `${artist.legal_first_name} ${artist.legal_last_name}`
			scores.push({
				field: 'legal_names_combined',
				score: calculateSimilarity(normalized.fullName, legalFullName)
			})
		}
		
		if (artist.public_first_name && artist.public_last_name) {
			const publicFullName = `${artist.public_first_name} ${artist.public_last_name}`
			scores.push({
				field: 'public_names_combined',
				score: calculateSimilarity(normalized.fullName, publicFullName)
			})
		}
		
		// Check individual component similarities
		if (artist.legal_first_name) {
			scores.push({
				field: 'legal_first_name',
				score: calculateSimilarity(normalized.firstName, artist.legal_first_name) * 0.7 // Weight component matches lower
			})
		}
		
		if (artist.legal_last_name) {
			scores.push({
				field: 'legal_last_name',
				score: calculateSimilarity(normalized.lastName, artist.legal_last_name) * 0.7
			})
		}
		
		if (artist.public_first_name) {
			scores.push({
				field: 'public_first_name',
				score: calculateSimilarity(normalized.firstName, artist.public_first_name) * 0.7
			})
		}
		
		if (artist.public_last_name) {
			scores.push({
				field: 'public_last_name',
				score: calculateSimilarity(normalized.lastName, artist.public_last_name) * 0.7
			})
		}
	}
	
	// Check nickname matches if available
	if (normalized.nickname) {
		if (artist.legal_first_name) {
			scores.push({
				field: 'legal_first_name_nickname',
				score: calculateSimilarity(normalized.nickname, artist.legal_first_name) * 0.8
			})
		}
		if (artist.public_first_name) {
			scores.push({
				field: 'public_first_name_nickname',
				score: calculateSimilarity(normalized.nickname, artist.public_first_name) * 0.8
			})
		}
	}
	
	if (scores.length === 0) return null
	
	// Find the best score and all fields that contributed to it
	const bestScore = Math.max(...scores.map(s => s.score))
	const matchedFields = scores.filter(s => s.score >= 0.7).map(s => s.field)
	
	// Minimum threshold for fuzzy matches
	if (bestScore < 0.6) return null
	
	return {
		artist,
		confidence: bestScore,
		matchType: bestScore >= 0.9 ? 'fuzzy' : 'partial',
		matchedFields
	}
}

/**
 * Searches for artists by name with fuzzy matching
 * Returns multiple potential matches sorted by confidence
 */
export async function searchArtistsByName(name: string): Promise<MatchResult> {
	try {
		const normalized = normalizeArtistName(name)
		
		// Fetch all artists - in a real app, you might want to implement server-side search
		// or use Supabase's full-text search capabilities for better performance
		const { data: artists, error } = await supabase
			.from('phwb_artists')
			.select('*')
			.order('created_at', { ascending: false })
		
		if (error) {
			throw new Error(`Database error: ${error.message}`)
		}
		
		if (!artists || artists.length === 0) {
			return {
				allMatches: [],
				originalInput: name,
				normalizedInput: normalized.fullName,
				needsManualReview: true
			}
		}
		
		const matches: ArtistMatch[] = []
		
		// First pass: look for exact matches
		for (const artist of artists) {
			const exactMatch = checkExactMatch(normalized, artist)
			if (exactMatch) {
				matches.push(exactMatch)
			}
		}
		
		// If no exact matches found, look for fuzzy matches
		if (matches.length === 0) {
			for (const artist of artists) {
				const fuzzyMatch = calculateFuzzyMatch(normalized, artist)
				if (fuzzyMatch) {
					matches.push(fuzzyMatch)
				}
			}
		}
		
		// Sort by confidence (descending) and then by match type priority
		matches.sort((a, b) => {
			if (a.confidence !== b.confidence) {
				return b.confidence - a.confidence
			}
			
			// Tie-breaker: exact > fuzzy > partial
			const typeOrder = { exact: 3, fuzzy: 2, partial: 1 }
			return typeOrder[b.matchType] - typeOrder[a.matchType]
		})
		
		const bestMatch = matches.length > 0 ? matches[0] : undefined
		
		// Determine if manual review is needed
		const needsManualReview = !bestMatch || 
			bestMatch.confidence < 0.9 || 
			(matches.length > 1 && matches[1].confidence > 0.8)
		
		return {
			bestMatch,
			allMatches: matches,
			originalInput: name,
			normalizedInput: normalized.fullName,
			needsManualReview
		}
	} catch (error) {
		console.error('Error searching artists by name:', error)
		throw error
	}
}

/**
 * Finds the best artist match for a given name
 * Returns the single best match with confidence score
 */
export async function findArtistByName(name: string): Promise<ArtistMatch | null> {
	const result = await searchArtistsByName(name)
	return result.bestMatch || null
}

/**
 * Batch processes multiple names for CSV import
 * Returns results for all names with confidence scores
 */
export async function batchMatchArtists(names: string[]): Promise<{
	results: MatchResult[]
	summary: {
		totalProcessed: number
		exactMatches: number
		fuzzyMatches: number
		noMatches: number
		needsReview: number
	}
}> {
	const results: MatchResult[] = []
	let exactMatches = 0
	let fuzzyMatches = 0
	let noMatches = 0
	let needsReview = 0
	
	for (const name of names) {
		try {
			const result = await searchArtistsByName(name)
			results.push(result)
			
			if (result.bestMatch) {
				if (result.bestMatch.matchType === 'exact') {
					exactMatches++
				} else {
					fuzzyMatches++
				}
				
				if (result.needsManualReview) {
					needsReview++
				}
			} else {
				noMatches++
				needsReview++
			}
		} catch (error) {
			console.error(`Error processing name "${name}":`, error)
			results.push({
				allMatches: [],
				originalInput: name,
				normalizedInput: name,
				needsManualReview: true
			})
			noMatches++
			needsReview++
		}
	}
	
	return {
		results,
		summary: {
			totalProcessed: names.length,
			exactMatches,
			fuzzyMatches,
			noMatches,
			needsReview
		}
	}
}

/**
 * Manual override function for ambiguous matches
 * Allows user to explicitly select an artist for a given name
 */
export function createManualOverride(originalName: string, selectedArtist: Artist): ArtistMatch {
	return {
		artist: selectedArtist,
		confidence: 1.0,
		matchType: 'exact',
		matchedFields: ['manual_override']
	}
}

/**
 * Validates that an artist exists by ID
 */
export async function validateArtistExists(artistId: string): Promise<Artist | null> {
	try {
		const { data: artist, error } = await supabase
			.from('phwb_artists')
			.select('*')
			.eq('id', artistId)
			.single()
		
		if (error) {
			console.error('Error validating artist:', error)
			return null
		}
		
		return artist
	} catch (error) {
		console.error('Error validating artist existence:', error)
		return null
	}
}