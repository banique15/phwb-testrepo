/**
 * Venue Manager Utility for PHWB Admin CSV Import
 * 
 * Handles parsing complex location strings from CSV files and manages
 * venue creation/lookup in the phwb_venues table.
 */

import { supabase } from '$lib/supabase'
import type { CreateVenue, Venue } from '$lib/schemas/venue'

export interface ParsedLocation {
  venue_name: string;
  city?: string;
  state?: string;
  normalized_name: string;
  original_text: string;
  is_valid: boolean;
  error_message?: string;
}

export interface VenueResult {
  venue_id: number;
  venue: Venue;
  was_created: boolean;
  parsed_location: ParsedLocation;
}

/**
 * Parses a location string from CSV and extracts venue details
 * 
 * @param locationText - The location string from CSV (e.g., "Moynihan Train Hall", "Union Station, D.C. (DC)")
 * @returns ParsedLocation object with extracted information
 */
export function parseLocationText(locationText: string): ParsedLocation {
  if (!locationText || typeof locationText !== 'string') {
    return {
      venue_name: '',
      normalized_name: '',
      original_text: '',
      is_valid: false,
      error_message: 'Invalid or empty location text'
    };
  }

  const cleanText = locationText.trim();
  
  if (cleanText === '') {
    return {
      venue_name: '',
      normalized_name: '',
      original_text: cleanText,
      is_valid: false,
      error_message: 'Empty location text'
    };
  }

  try {
    // Pattern for "Venue Name, City (State)" or "Venue Name, City, State"
    const cityStatePattern = /^(.+?),\s*([^,()]+?)(?:\s*[,(]\s*([A-Z]{2})\s*[)]?)?$/i;
    const cityStateMatch = cleanText.match(cityStatePattern);
    
    if (cityStateMatch) {
      const venueName = cityStateMatch[1].trim();
      const city = cityStateMatch[2].trim();
      const state = cityStateMatch[3]?.trim().toUpperCase();
      
      return {
        venue_name: venueName,
        city: city,
        state: state,
        normalized_name: normalizeVenueName(venueName),
        original_text: cleanText,
        is_valid: true
      };
    }

    // Pattern for "Venue Name (City, State)" or "Venue Name (City)"
    const parenthesesPattern = /^(.+?)\s*\(([^)]+)\)$/;
    const parenthesesMatch = cleanText.match(parenthesesPattern);
    
    if (parenthesesMatch) {
      const venueName = parenthesesMatch[1].trim();
      const locationPart = parenthesesMatch[2].trim();
      
      // Check if location part contains state
      const stateInParensPattern = /^(.+?),?\s*([A-Z]{2})$/i;
      const stateMatch = locationPart.match(stateInParensPattern);
      
      if (stateMatch) {
        const city = stateMatch[1].replace(/,$/, '').trim();
        const state = stateMatch[2].toUpperCase();
        
        return {
          venue_name: venueName,
          city: city,
          state: state,
          normalized_name: normalizeVenueName(venueName),
          original_text: cleanText,
          is_valid: true
        };
      } else {
        // Just city in parentheses
        return {
          venue_name: venueName,
          city: locationPart,
          normalized_name: normalizeVenueName(venueName),
          original_text: cleanText,
          is_valid: true
        };
      }
    }

    // Pattern for locations with slashes like "NYC Health + Hospitals/Jacobi"
    // Treat as a single venue name
    const slashPattern = /^(.+)\/(.+)$/;
    const slashMatch = cleanText.match(slashPattern);
    
    if (slashMatch) {
      const venueName = cleanText; // Keep the full name including slash
      
      return {
        venue_name: venueName,
        normalized_name: normalizeVenueName(venueName),
        original_text: cleanText,
        is_valid: true
      };
    }

    // Default: treat entire string as venue name
    return {
      venue_name: cleanText,
      normalized_name: normalizeVenueName(cleanText),
      original_text: cleanText,
      is_valid: true
    };

  } catch (error) {
    return {
      venue_name: cleanText,
      normalized_name: normalizeVenueName(cleanText),
      original_text: cleanText,
      is_valid: false,
      error_message: `Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Normalizes venue name for consistent matching and deduplication
 * 
 * @param name - Raw venue name to normalize
 * @returns Normalized venue name for comparison
 */
export function normalizeVenueName(name: string): string {
  if (!name || typeof name !== 'string') {
    return '';
  }

  return name
    .trim()
    .toLowerCase()
    // Replace multiple spaces/tabs/newlines with single space
    .replace(/\s+/g, ' ')
    // Remove common punctuation that doesn't affect identity
    .replace(/['"]/g, '')
    // Normalize ampersands
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s*\+\s*/g, ' and ')
    // Remove trailing punctuation
    .replace(/[.,;:!?]+$/, '')
    // Normalize common abbreviations
    .replace(/\bst\b\.?/gi, 'street')
    .replace(/\bave\b\.?/gi, 'avenue')
    .replace(/\brd\b\.?/gi, 'road')
    .replace(/\bdr\b\.?/gi, 'drive')
    .replace(/\bblvd\b\.?/gi, 'boulevard')
    .replace(/\bctr\b\.?/gi, 'center')
    .replace(/\bcentre\b/gi, 'center')
    .replace(/\bhall\b/gi, 'hall')
    .replace(/\bstation\b/gi, 'station')
    .replace(/\bhospital\b/gi, 'hospital')
    .replace(/\bhospitals\b/gi, 'hospital')
    .trim();
}

/**
 * Searches for existing venue by normalized name and other criteria
 * 
 * @param parsedLocation - Parsed location data
 * @returns Existing venue or null if not found
 */
async function findExistingVenue(parsedLocation: ParsedLocation): Promise<Venue | null> {
  try {
    // First, try exact normalized name match
    const { data: exactMatch, error: exactError } = await supabase
      .from('phwb_venues')
      .select('*')
      .ilike('name', parsedLocation.venue_name)
      .limit(1)
      .single();

    if (exactError && exactError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.warn('Error searching for exact venue match:', exactError);
    }

    if (exactMatch) {
      return exactMatch;
    }

    // If no exact match, try fuzzy matching on normalized names
    const { data: allVenues, error: allError } = await supabase
      .from('phwb_venues')
      .select('*');

    if (allError) {
      console.warn('Error fetching all venues for fuzzy matching:', allError);
      return null;
    }

    if (!allVenues || allVenues.length === 0) {
      return null;
    }

    // Find venues with similar normalized names
    const targetNormalized = parsedLocation.normalized_name;
    
    for (const venue of allVenues) {
      if (!venue.name) continue;
      
      const venueNormalized = normalizeVenueName(venue.name);
      
      // Check for exact normalized match
      if (venueNormalized === targetNormalized) {
        return venue;
      }
      
      // Check if one name contains the other (for partial matches)
      if (targetNormalized.length > 5 && venueNormalized.length > 5) {
        if (venueNormalized.includes(targetNormalized) || targetNormalized.includes(venueNormalized)) {
          return venue;
        }
      }
    }

    return null;

  } catch (error) {
    console.error('Error in findExistingVenue:', error);
    return null;
  }
}

/**
 * Creates a new venue record in the database
 * 
 * @param parsedLocation - Parsed location data
 * @returns Created venue record
 */
async function createNewVenue(parsedLocation: ParsedLocation): Promise<Venue> {
  const venueData: CreateVenue = {
    name: parsedLocation.venue_name,
    address: buildAddressString(parsedLocation),
    type: determineVenueType(parsedLocation.venue_name),
    description: `Auto-created from CSV import: ${parsedLocation.original_text}`
  };

  const { data: newVenue, error } = await supabase
    .from('phwb_venues')
    .insert(venueData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create venue: ${error.message}`);
  }

  if (!newVenue) {
    throw new Error('Venue creation returned no data');
  }

  return newVenue;
}

/**
 * Builds an address string from parsed location data
 * 
 * @param parsedLocation - Parsed location data
 * @returns Address string or undefined if no location data
 */
function buildAddressString(parsedLocation: ParsedLocation): string | undefined {
  const parts: string[] = [];
  
  if (parsedLocation.city) {
    parts.push(parsedLocation.city);
  }
  
  if (parsedLocation.state) {
    parts.push(parsedLocation.state);
  }
  
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Attempts to determine venue type from venue name
 * 
 * @param venueName - Name of the venue
 * @returns Suggested venue type
 */
function determineVenueType(venueName: string): string | undefined {
  if (!venueName) return undefined;
  
  const name = venueName.toLowerCase();
  
  if (name.includes('hospital') || name.includes('medical')) {
    return 'Healthcare Facility';
  }
  
  if (name.includes('station') || name.includes('terminal') || name.includes('airport')) {
    return 'Transportation Hub';
  }
  
  if (name.includes('school') || name.includes('university') || name.includes('college')) {
    return 'Educational Institution';
  }
  
  if (name.includes('hall') || name.includes('center') || name.includes('centre')) {
    return 'Event Space';
  }
  
  if (name.includes('park') || name.includes('garden')) {
    return 'Outdoor Space';
  }
  
  if (name.includes('church') || name.includes('cathedral') || name.includes('temple')) {
    return 'Religious Institution';
  }
  
  if (name.includes('library') || name.includes('museum')) {
    return 'Cultural Institution';
  }
  
  return 'Other';
}

/**
 * Main function to find or create a venue from location text
 * 
 * @param locationText - The location string from CSV
 * @returns VenueResult with venue ID and metadata
 */
export async function findOrCreateVenue(locationText: string): Promise<VenueResult> {
  // Parse the location text
  const parsedLocation = parseLocationText(locationText);
  
  if (!parsedLocation.is_valid) {
    throw new Error(`Invalid location text: ${parsedLocation.error_message}`);
  }

  try {
    // Try to find existing venue
    const existingVenue = await findExistingVenue(parsedLocation);
    
    if (existingVenue) {
      return {
        venue_id: existingVenue.id!,
        venue: existingVenue,
        was_created: false,
        parsed_location: parsedLocation
      };
    }

    // Create new venue if not found
    const newVenue = await createNewVenue(parsedLocation);
    
    return {
      venue_id: newVenue.id!,
      venue: newVenue,
      was_created: true,
      parsed_location: parsedLocation
    };

  } catch (error) {
    throw new Error(`Failed to find or create venue: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Batch processes multiple location strings for CSV import
 * 
 * @param locationStrings - Array of location strings from CSV
 * @returns Array of venue results with processing status
 */
export async function batchProcessVenues(locationStrings: string[]): Promise<VenueResult[]> {
  const results: VenueResult[] = [];
  const errors: { location: string; error: string }[] = [];
  
  for (const locationText of locationStrings) {
    try {
      const result = await findOrCreateVenue(locationText);
      results.push(result);
    } catch (error) {
      errors.push({
        location: locationText,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  if (errors.length > 0) {
    console.warn('Venue processing errors:', errors);
  }
  
  return results;
}

/**
 * Gets summary statistics for venue processing
 * 
 * @param results - Array of venue processing results
 * @returns Summary statistics object
 */
export function getVenueProcessingStats(results: VenueResult[]) {
  const total = results.length;
  const created = results.filter(r => r.was_created).length;
  const existing = total - created;
  
  const typeBreakdown = results.reduce((acc, result) => {
    const type = result.venue.type || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stateBreakdown = results.reduce((acc, result) => {
    const state = result.parsed_location.state || 'Unknown';
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    total,
    created,
    existing,
    createdPercentage: total > 0 ? ((created / total) * 100).toFixed(1) : '0.0',
    typeBreakdown,
    stateBreakdown,
    newVenues: results
      .filter(r => r.was_created)
      .map(r => ({
        name: r.venue.name,
        type: r.venue.type,
        original_text: r.parsed_location.original_text
      }))
  };
}

/**
 * Validates venue data structure
 * 
 * @param venue - Venue object to validate
 * @returns boolean indicating if venue is valid
 */
export function validateVenueData(venue: Venue): boolean {
  if (!venue) {
    return false;
  }

  // Must have a name
  if (!venue.name || venue.name.trim() === '') {
    return false;
  }

  // Must have an ID (for existing venues)
  if (venue.id === undefined || venue.id === null) {
    return false;
  }

  return true;
}

/**
 * Formats venue information for display purposes
 * 
 * @param venue - Venue object to format
 * @param parsedLocation - Optional parsed location data for additional context
 * @returns Formatted venue string for UI display
 */
export function formatVenueForDisplay(venue: Venue, parsedLocation?: ParsedLocation): string {
  if (!validateVenueData(venue)) {
    return 'Invalid venue data';
  }

  let display = venue.name || 'Unnamed Venue';
  
  if (venue.address) {
    display += ` (${venue.address})`;
  } else if (parsedLocation?.city || parsedLocation?.state) {
    const locationParts = [parsedLocation.city, parsedLocation.state].filter(Boolean);
    if (locationParts.length > 0) {
      display += ` (${locationParts.join(', ')})`;
    }
  }

  if (venue.type && venue.type !== 'Other') {
    display += ` - ${venue.type}`;
  }

  return display;
}