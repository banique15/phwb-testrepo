import { z } from 'zod'
import { createPayrollSchema, type CreatePayroll } from '$lib/schemas/payroll'
import { artistsStore } from '$lib/stores/artists'
import { venuesStore } from '$lib/stores/venues'
import { payrollStore } from '$lib/stores/payroll'

// CSV Row Schema - defines the expected structure of CSV data
export const csvRowSchema = z.object({
	// Required fields
	event_date: z.string().min(1, 'Event date is required'),
	artist_name: z.string().min(1, 'Artist name is required'),
	hours: z.string().min(1, 'Hours is required'),
	rate: z.string().min(1, 'Rate is required'),
	
	// Optional fields
	venue_name: z.string().optional().default(''),
	additional_pay: z.string().optional().default('0'),
	additional_pay_reason: z.string().optional().default(''),
	status: z.string().optional().default('Planned'),
	insperity_hours: z.string().optional().default(''),
	paid_date: z.string().optional().default(''),
	event_id: z.string().optional().default(''),
})

export type CSVRow = z.infer<typeof csvRowSchema>

// Validation result types
export interface ValidationError {
	row: number
	field: string
	message: string
	value: any
}

export interface TransformationResult {
	success: boolean
	data?: CreatePayroll[]
	errors: ValidationError[]
	warnings: string[]
	summary: {
		totalRows: number
		validRows: number
		errorRows: number
		duplicateRows: number
	}
}

export interface ImportOptions {
	preview: boolean
	batchSize: number
	validateOnly: boolean
	allowDuplicates: boolean
	onProgress?: (processed: number, total: number) => void
}

export interface ImportResult {
	success: boolean
	message: string
	imported: number
	errors: ValidationError[]
	warnings: string[]
	duplicates: number
}

// Artist matching utility
class ArtistMatcher {
	private artists: Map<string, string> = new Map() // name -> id
	private initialized = false

	async initialize() {
		if (this.initialized) return

		try {
			const { data } = await artistsStore.fetchAll()
			for (const artist of data) {
				// Create multiple keys for matching
				const keys = [
					artist.full_name?.toLowerCase().trim(),
					artist.artist_name?.toLowerCase().trim(),
					artist.legal_name?.toLowerCase().trim(),
					`${artist.legal_first_name} ${artist.legal_last_name}`.toLowerCase().trim(),
					`${artist.public_first_name} ${artist.public_last_name}`.toLowerCase().trim()
				].filter(Boolean)

				for (const key of keys) {
					if (key && !this.artists.has(key)) {
						this.artists.set(key, artist.id!)
					}
				}
			}
			this.initialized = true
		} catch (error) {
			console.error('Failed to initialize artist matcher:', error)
			throw new Error('Could not load artists for matching')
		}
	}

	findArtistId(name: string): string | null {
		const cleanName = name.toLowerCase().trim()
		
		// Direct match
		if (this.artists.has(cleanName)) {
			return this.artists.get(cleanName)!
		}

		// Fuzzy match - remove common prefixes/suffixes and try again
		const variants = [
			cleanName.replace(/\s+/g, ' '), // normalize spaces
			cleanName.replace(/[.,\-()]/g, ''), // remove punctuation
			cleanName.split(' ').reverse().join(' '), // reverse name order
		]

		for (const variant of variants) {
			if (this.artists.has(variant)) {
				return this.artists.get(variant)!
			}
		}

		return null
	}

	getAllArtistNames(): string[] {
		return Array.from(this.artists.keys())
	}
}

// Venue matching utility
class VenueManager {
	private venues: Map<string, number> = new Map() // name -> id
	private initialized = false

	async initialize() {
		if (this.initialized) return

		try {
			const { data } = await venuesStore.fetchAll()
			for (const venue of data) {
				if (venue.name) {
					this.venues.set(venue.name.toLowerCase().trim(), venue.id!)
				}
			}
			this.initialized = true
		} catch (error) {
			console.error('Failed to initialize venue manager:', error)
			throw new Error('Could not load venues for matching')
		}
	}

	findVenueId(name: string): number | null {
		if (!name) return null
		const cleanName = name.toLowerCase().trim()
		return this.venues.get(cleanName) || null
	}

	getAllVenueNames(): string[] {
		return Array.from(this.venues.keys())
	}
}

// Rate parsing utility
class RateParser {
	static parseNumericValue(value: string, fieldName: string): number {
		if (!value || value.trim() === '') {
			return 0
		}

		// Remove currency symbols, commas, and spaces
		const cleaned = value.replace(/[$,\s]/g, '')
		
		// Handle percentage rates
		if (cleaned.includes('%')) {
			throw new Error(`${fieldName} cannot be a percentage value`)
		}

		const parsed = parseFloat(cleaned)
		
		if (isNaN(parsed)) {
			throw new Error(`${fieldName} must be a valid number`)
		}

		if (parsed < 0) {
			throw new Error(`${fieldName} cannot be negative`)
		}

		return parsed
	}

	static parseDate(dateString: string, fieldName: string): string {
		if (!dateString || dateString.trim() === '') {
			throw new Error(`${fieldName} is required`)
		}

		const cleaned = dateString.trim()
		
		// Try various date formats
		const formats = [
			// YYYY-MM-DD (ISO format - preferred)
			/^(\d{4})-(\d{1,2})-(\d{1,2})$/,
			// MM/DD/YYYY
			/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
			// DD/MM/YYYY
			/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
			// MM-DD-YYYY
			/^(\d{1,2})-(\d{1,2})-(\d{4})$/,
		]

		// If already in ISO format, validate and return
		if (formats[0].test(cleaned)) {
			const date = new Date(cleaned)
			if (isNaN(date.getTime())) {
				throw new Error(`${fieldName} is not a valid date`)
			}
			return cleaned
		}

		// Try parsing other formats and convert to ISO
		for (let i = 1; i < formats.length; i++) {
			const match = cleaned.match(formats[i])
			if (match) {
				const [, part1, part2, year] = match
				
				// Assume MM/DD/YYYY format for ambiguous cases
				const month = parseInt(part1, 10)
				const day = parseInt(part2, 10)
				
				if (month < 1 || month > 12) {
					throw new Error(`${fieldName} has invalid month: ${month}`)
				}
				if (day < 1 || day > 31) {
					throw new Error(`${fieldName} has invalid day: ${day}`)
				}

				// Convert to ISO format
				const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
				const date = new Date(isoDate)
				if (isNaN(date.getTime())) {
					throw new Error(`${fieldName} is not a valid date`)
				}
				return isoDate
			}
		}

		throw new Error(`${fieldName} format not recognized. Use YYYY-MM-DD, MM/DD/YYYY, or MM-DD-YYYY`)
	}

	static parseStatus(status: string): 'Planned' | 'Approved' | 'Paid' | 'Completed' | 'Cancelled' {
		if (!status || status.trim() === '') {
			return 'Planned'
		}

		const cleaned = status.toLowerCase().trim()
		const statusMap: Record<string, 'Planned' | 'Approved' | 'Paid' | 'Completed' | 'Cancelled'> = {
			'planned': 'Planned',
			'approved': 'Approved',
			'paid': 'Paid',
			'unpaid': 'Planned', // Map unpaid to planned
			'cancelled': 'Cancelled',
			'canceled': 'Cancelled',
			'pending': 'Planned',
			'complete': 'Completed',
			'completed': 'Completed',
		}

		return statusMap[cleaned] || 'Planned'
	}
}

// Main CSV Importer class
export class CSVImporter {
	private artistMatcher = new ArtistMatcher()
	private venueManager = new VenueManager()
	private initialized = false

	async initialize() {
		if (this.initialized) return

		await Promise.all([
			this.artistMatcher.initialize(),
			this.venueManager.initialize()
		])
		
		this.initialized = true
	}

	/**
	 * Parse CSV file and return raw data
	 */
	async parseCSVFile(file: File): Promise<CSVRow[]> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader()
			
			reader.onload = (e) => {
				try {
					const text = e.target?.result as string
					const rows = this.parseCSVText(text)
					resolve(rows)
				} catch (error) {
					reject(error)
				}
			}
			
			reader.onerror = () => reject(new Error('Failed to read file'))
			reader.readAsText(file)
		})
	}

	/**
	 * Parse CSV text content into structured data
	 */
	private parseCSVText(text: string): CSVRow[] {
		const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
		
		if (lines.length < 2) {
			throw new Error('CSV must contain at least a header row and one data row')
		}

		const headers = this.parseCSVLine(lines[0])
		const rows: CSVRow[] = []

		for (let i = 1; i < lines.length; i++) {
			const values = this.parseCSVLine(lines[i])
			
			if (values.length === 0) continue // Skip empty lines
			
			const row: Record<string, string> = {}
			
			// Map values to headers
			for (let j = 0; j < headers.length; j++) {
				const header = this.normalizeHeader(headers[j])
				row[header] = values[j] || ''
			}

			rows.push(row as CSVRow)
		}

		return rows
	}

	/**
	 * Parse a single CSV line, handling quoted values
	 */
	private parseCSVLine(line: string): string[] {
		const result: string[] = []
		let current = ''
		let inQuotes = false
		let i = 0

		while (i < line.length) {
			const char = line[i]
			
			if (char === '"') {
				if (inQuotes && line[i + 1] === '"') {
					// Escaped quote
					current += '"'
					i += 2
				} else {
					// Toggle quote state
					inQuotes = !inQuotes
					i++
				}
			} else if (char === ',' && !inQuotes) {
				// End of field
				result.push(current.trim())
				current = ''
				i++
			} else {
				current += char
				i++
			}
		}

		// Add the last field
		result.push(current.trim())
		
		return result
	}

	/**
	 * Normalize header names to match schema
	 */
	private normalizeHeader(header: string): string {
		const normalized = header.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_')
		
		// Map common variations to standard field names
		const headerMap: Record<string, string> = {
			'artist': 'artist_name',
			'artist_name': 'artist_name',
			'name': 'artist_name',
			'performer': 'artist_name',
			'date': 'event_date',
			'event_date': 'event_date',
			'performance_date': 'event_date',
			'venue': 'venue_name',
			'venue_name': 'venue_name',
			'location': 'venue_name',
			'hours': 'hours',
			'hours_worked': 'hours',
			'rate': 'rate',
			'hourly_rate': 'rate',
			'pay_rate': 'rate',
			'additional_pay': 'additional_pay',
			'bonus': 'additional_pay',
			'extra_pay': 'additional_pay',
			'additional_pay_reason': 'additional_pay_reason',
			'bonus_reason': 'additional_pay_reason',
			'status': 'status',
			'payment_status': 'status',
			'insperity_hours': 'insperity_hours',
			'paid_date': 'paid_date',
			'payment_date': 'paid_date',
			'event_id': 'event_id',
		}

		return headerMap[normalized] || normalized
	}

	/**
	 * Validate CSV data structure and content
	 */
	async validateCSVData(csvData: CSVRow[]): Promise<TransformationResult> {
		await this.initialize()

		const errors: ValidationError[] = []
		const warnings: string[] = []
		let validRows = 0

		// Check for required headers
		if (csvData.length === 0) {
			errors.push({
				row: 0,
				field: 'file',
				message: 'CSV file is empty',
				value: null
			})
			return {
				success: false,
				errors,
				warnings,
				summary: {
					totalRows: 0,
					validRows: 0,
					errorRows: 0,
					duplicateRows: 0
				}
			}
		}

		// Validate each row
		for (let i = 0; i < csvData.length; i++) {
			const row = csvData[i]
			const rowNumber = i + 1

			try {
				// Validate basic structure
				const validatedRow = csvRowSchema.parse(row)
				
				// Additional validations
				const rowErrors = await this.validateRowData(validatedRow, rowNumber)
				errors.push(...rowErrors)

				if (rowErrors.length === 0) {
					validRows++
				}
			} catch (error) {
				if (error instanceof z.ZodError) {
					for (const issue of error.issues) {
						errors.push({
							row: rowNumber,
							field: issue.path.join('.'),
							message: issue.message,
							value: row
						})
					}
				} else {
					errors.push({
						row: rowNumber,
						field: 'row',
						message: error instanceof Error ? error.message : 'Unknown validation error',
						value: row
					})
				}
			}
		}

		// Check for duplicates
		const duplicates = this.findDuplicateRows(csvData)
		
		if (duplicates.length > 0) {
			warnings.push(`Found ${duplicates.length} potential duplicate rows`)
		}

		return {
			success: errors.length === 0,
			errors,
			warnings,
			summary: {
				totalRows: csvData.length,
				validRows,
				errorRows: csvData.length - validRows,
				duplicateRows: duplicates.length
			}
		}
	}

	/**
	 * Validate individual row data
	 */
	private async validateRowData(row: CSVRow, rowNumber: number): Promise<ValidationError[]> {
		const errors: ValidationError[] = []

		try {
			// Validate and parse date
			RateParser.parseDate(row.event_date, 'Event date')
		} catch (error) {
			errors.push({
				row: rowNumber,
				field: 'event_date',
				message: error instanceof Error ? error.message : 'Invalid date',
				value: row.event_date
			})
		}

		// Validate artist exists
		const artistId = this.artistMatcher.findArtistId(row.artist_name)
		if (!artistId) {
			errors.push({
				row: rowNumber,
				field: 'artist_name',
				message: `Artist "${row.artist_name}" not found. Available artists: ${this.artistMatcher.getAllArtistNames().slice(0, 5).join(', ')}...`,
				value: row.artist_name
			})
		}

		// Validate numeric fields
		try {
			RateParser.parseNumericValue(row.hours, 'Hours')
		} catch (error) {
			errors.push({
				row: rowNumber,
				field: 'hours',
				message: error instanceof Error ? error.message : 'Invalid hours',
				value: row.hours
			})
		}

		try {
			RateParser.parseNumericValue(row.rate, 'Rate')
		} catch (error) {
			errors.push({
				row: rowNumber,
				field: 'rate',
				message: error instanceof Error ? error.message : 'Invalid rate',
				value: row.rate
			})
		}

		if (row.additional_pay) {
			try {
				RateParser.parseNumericValue(row.additional_pay, 'Additional pay')
			} catch (error) {
				errors.push({
					row: rowNumber,
					field: 'additional_pay',
					message: error instanceof Error ? error.message : 'Invalid additional pay',
					value: row.additional_pay
				})
			}
		}

		// Validate venue if provided
		if (row.venue_name) {
			const venueId = this.venueManager.findVenueId(row.venue_name)
			if (!venueId) {
				errors.push({
					row: rowNumber,
					field: 'venue_name',
					message: `Venue "${row.venue_name}" not found. Available venues: ${this.venueManager.getAllVenueNames().slice(0, 5).join(', ')}...`,
					value: row.venue_name
				})
			}
		}

		// Validate optional dates
		if (row.paid_date) {
			try {
				RateParser.parseDate(row.paid_date, 'Paid date')
			} catch (error) {
				errors.push({
					row: rowNumber,
					field: 'paid_date',
					message: error instanceof Error ? error.message : 'Invalid paid date',
					value: row.paid_date
				})
			}
		}

		return errors
	}

	/**
	 * Find duplicate rows based on key fields
	 */
	private findDuplicateRows(csvData: CSVRow[]): number[] {
		const seen = new Set<string>()
		const duplicates: number[] = []

		for (let i = 0; i < csvData.length; i++) {
			const row = csvData[i]
			const key = `${row.event_date}|${row.artist_name}|${row.hours}|${row.rate}`
			
			if (seen.has(key)) {
				duplicates.push(i + 1)
			} else {
				seen.add(key)
			}
		}

		return duplicates
	}

	/**
	 * Transform CSV data to payroll records
	 */
	async transformCSVToPayroll(csvData: CSVRow[]): Promise<TransformationResult> {
		await this.initialize()

		const validation = await this.validateCSVData(csvData)
		
		if (!validation.success) {
			return validation
		}

		const transformed: CreatePayroll[] = []
		const errors: ValidationError[] = []

		for (let i = 0; i < csvData.length; i++) {
			const row = csvData[i]
			const rowNumber = i + 1

			try {
				const payrollRecord = await this.transformRow(row)
				transformed.push(payrollRecord)
			} catch (error) {
				errors.push({
					row: rowNumber,
					field: 'transformation',
					message: error instanceof Error ? error.message : 'Transformation failed',
					value: row
				})
			}
		}

		return {
			success: errors.length === 0,
			data: transformed,
			errors: [...validation.errors, ...errors],
			warnings: validation.warnings,
			summary: {
				totalRows: csvData.length,
				validRows: transformed.length,
				errorRows: errors.length,
				duplicateRows: validation.summary.duplicateRows
			}
		}
	}

	/**
	 * Transform a single CSV row to payroll record
	 */
	private async transformRow(row: CSVRow): Promise<CreatePayroll> {
		const artistId = this.artistMatcher.findArtistId(row.artist_name)
		if (!artistId) {
			throw new Error(`Artist "${row.artist_name}" not found`)
		}

		const venueId = row.venue_name ? this.venueManager.findVenueId(row.venue_name) : undefined

		const hours = RateParser.parseNumericValue(row.hours, 'Hours')
		const rate = RateParser.parseNumericValue(row.rate, 'Rate')
		const additionalPay = RateParser.parseNumericValue(row.additional_pay || '0', 'Additional pay')
		
		const payrollData: CreatePayroll = {
			event_date: RateParser.parseDate(row.event_date, 'Event date'),
			artist_id: artistId,
			venue_id: venueId || undefined,
			hours,
			rate,
			additional_pay: additionalPay,
			additional_pay_reason: row.additional_pay_reason || undefined,
			status: RateParser.parseStatus(row.status),
			insperity_hours: row.insperity_hours ? RateParser.parseNumericValue(row.insperity_hours, 'Insperity hours') : undefined,
			paid_date: row.paid_date ? RateParser.parseDate(row.paid_date, 'Paid date') : undefined,
			event_id: row.event_id ? parseInt(row.event_id, 10) : undefined,
		}

		// Validate against schema
		return createPayrollSchema.parse(payrollData)
	}

	/**
	 * Import payroll data to database
	 */
	async importPayrollData(
		transformedData: CreatePayroll[], 
		options: ImportOptions = {
			preview: false,
			batchSize: 50,
			validateOnly: false,
			allowDuplicates: false
		}
	): Promise<ImportResult> {
		if (options.preview || options.validateOnly) {
			return {
				success: true,
				message: `Preview: Would import ${transformedData.length} records`,
				imported: 0,
				errors: [],
				warnings: [],
				duplicates: 0
			}
		}

		const errors: ValidationError[] = []
		let imported = 0
		let duplicates = 0

		// Process in batches
		const batches = this.createBatches(transformedData, options.batchSize)
		
		for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
			const batch = batches[batchIndex]
			
			try {
				for (const record of batch) {
					try {
						await payrollStore.create(record)
						imported++
					} catch (error) {
						errors.push({
							row: batchIndex * options.batchSize + batch.indexOf(record) + 1,
							field: 'import',
							message: error instanceof Error ? error.message : 'Import failed',
							value: record
						})
					}
				}

				// Report progress
				if (options.onProgress) {
					const processed = (batchIndex + 1) * options.batchSize
					options.onProgress(Math.min(processed, transformedData.length), transformedData.length)
				}
			} catch (error) {
				errors.push({
					row: batchIndex * options.batchSize + 1,
					field: 'batch',
					message: `Batch ${batchIndex + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
					value: batch
				})
			}
		}

		return {
			success: errors.length === 0,
			message: `Successfully imported ${imported} of ${transformedData.length} records`,
			imported,
			errors,
			warnings: [],
			duplicates
		}
	}

	/**
	 * Preview import without saving to database
	 */
	async previewImport(csvData: CSVRow[]): Promise<TransformationResult> {
		const result = await this.transformCSVToPayroll(csvData)
		
		// Add preview-specific information
		if (result.success && result.data) {
			const preview = result.data.slice(0, 5) // Show first 5 records
			result.warnings.push(`Preview showing first ${preview.length} of ${result.data.length} records`)
		}

		return result
	}

	/**
	 * Create batches for processing
	 */
	private createBatches<T>(data: T[], batchSize: number): T[][] {
		const batches: T[][] = []
		
		for (let i = 0; i < data.length; i += batchSize) {
			batches.push(data.slice(i, i + batchSize))
		}
		
		return batches
	}

	/**
	 * Get artist matching suggestions
	 */
	async getArtistSuggestions(name: string): Promise<string[]> {
		await this.initialize()
		
		const allNames = this.artistMatcher.getAllArtistNames()
		const cleanName = name.toLowerCase().trim()
		
		return allNames
			.filter(artistName => 
				artistName.includes(cleanName) || 
				cleanName.includes(artistName) ||
				this.calculateSimilarity(cleanName, artistName) > 0.6
			)
			.slice(0, 10)
	}

	/**
	 * Calculate string similarity for fuzzy matching
	 */
	private calculateSimilarity(str1: string, str2: string): number {
		const longer = str1.length > str2.length ? str1 : str2
		const shorter = str1.length > str2.length ? str2 : str1
		
		if (longer.length === 0) return 1.0
		
		const editDistance = this.levenshteinDistance(longer, shorter)
		return (longer.length - editDistance) / longer.length
	}

	/**
	 * Calculate Levenshtein distance for string comparison
	 */
	private levenshteinDistance(str1: string, str2: string): number {
		const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
		
		for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
		for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
		
		for (let j = 1; j <= str2.length; j++) {
			for (let i = 1; i <= str1.length; i++) {
				const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1
				matrix[j][i] = Math.min(
					matrix[j][i - 1] + 1, // deletion
					matrix[j - 1][i] + 1, // insertion
					matrix[j - 1][i - 1] + substitutionCost // substitution
				)
			}
		}
		
		return matrix[str2.length][str1.length]
	}
}

// Export singleton instance
export const csvImporter = new CSVImporter()

// Convenience functions for direct use
export async function parseCSVFile(file: File): Promise<CSVRow[]> {
	return csvImporter.parseCSVFile(file)
}

export async function validateCSVData(csvData: CSVRow[]): Promise<TransformationResult> {
	return csvImporter.validateCSVData(csvData)
}

export async function transformCSVToPayroll(csvData: CSVRow[]): Promise<TransformationResult> {
	return csvImporter.transformCSVToPayroll(csvData)
}

export async function importPayrollData(transformedData: CreatePayroll[], options?: Partial<ImportOptions>): Promise<ImportResult> {
	const defaultOptions: ImportOptions = {
		preview: false,
		batchSize: 50,
		validateOnly: false,
		allowDuplicates: false
	}
	return csvImporter.importPayrollData(transformedData, { ...defaultOptions, ...options })
}

export async function previewImport(csvData: CSVRow[]): Promise<TransformationResult> {
	return csvImporter.previewImport(csvData)
}