// Re-export artist matcher utilities
export {
	findArtistByName,
	searchArtistsByName,
	batchMatchArtists,
	normalizeArtistName,
	createManualOverride,
	validateArtistExists,
	type ArtistMatch,
	type MatchResult
} from './artistMatcher'

// Re-export CSV importer utilities
export {
	CSVImporter,
	csvImporter,
	parseCSVFile,
	validateCSVData,
	transformCSVToPayroll,
	importPayrollData,
	previewImport,
	type CSVRow,
	type ValidationError,
	type TransformationResult,
	type ImportOptions,
	type ImportResult,
	csvRowSchema
} from './csvImporter'

// Additional utility functions for the payroll system

/**
 * Format currency values for display
 */
export function formatCurrency(amount: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount)
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
	try {
		const date = new Date(dateString)
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		})
	} catch {
		return dateString
	}
}

/**
 * Calculate total pay from hours, rate, and additional pay
 */
export function calculateTotalPay(hours: number, rate: number, additionalPay: number = 0): number {
	return (hours * rate) + additionalPay
}

/**
 * Generate CSV template for download
 */
export function generateCSVTemplate(): string {
	const headers = [
		'event_date',
		'artist_name', 
		'venue_name',
		'hours',
		'rate',
		'additional_pay',
		'additional_pay_reason',
		'status',
		'insperity_hours',
		'paid_date',
		'event_id'
	]

	const sampleRow = [
		'2024-01-15',
		'John Doe',
		'Central Park',
		'4',
		'50.00',
		'25.00',
		'Travel expenses',
		'Planned',
		'4',
		'',
		''
	]

	return [headers.join(','), sampleRow.join(',')].join('\n')
}

/**
 * Download data as CSV file
 */
export function downloadCSV(data: string, filename: string): void {
	const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' })
	const link = document.createElement('a')
	
	if (link.download !== undefined) {
		const url = URL.createObjectURL(blob)
		link.setAttribute('href', url)
		link.setAttribute('download', filename)
		link.style.visibility = 'hidden'
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
		URL.revokeObjectURL(url)
	}
}

/**
 * Validate file type and size
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
	// Check file type
	if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
		return { valid: false, error: 'File must be a CSV file' }
	}

	// Check file size (max 10MB)
	const maxSize = 10 * 1024 * 1024 // 10MB
	if (file.size > maxSize) {
		return { valid: false, error: 'File size must be less than 10MB' }
	}

	// Check if file is empty
	if (file.size === 0) {
		return { valid: false, error: 'File cannot be empty' }
	}

	return { valid: true }
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout | null = null
	
	return (...args: Parameters<T>) => {
		if (timeout) clearTimeout(timeout)
		timeout = setTimeout(() => func(...args), wait)
	}
}

/**
 * Get status badge class for styling
 */
export function getStatusBadgeClass(status: string): string {
	const statusClasses: Record<string, string> = {
		'Planned': 'badge-info',
		'Paid': 'badge-success', 
		'Unpaid': 'badge-warning',
		'Cancelled': 'badge-error'
	}
	
	return statusClasses[status] || 'badge-neutral'
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: any[]): string[] {
	return errors.map(error => {
		if (error.row && error.field && error.message) {
			return `Row ${error.row}, ${error.field}: ${error.message}`
		}
		return error.message || 'Unknown error'
	})
}

/**
 * Group validation errors by type
 */
export function groupErrorsByType(errors: any[]): Record<string, any[]> {
	return errors.reduce((groups, error) => {
		const type = error.field || 'unknown'
		if (!groups[type]) {
			groups[type] = []
		}
		groups[type].push(error)
		return groups
	}, {} as Record<string, any[]>)
}

/**
 * Create progress percentage
 */
export function calculateProgress(current: number, total: number): number {
	if (total === 0) return 0
	return Math.round((current / total) * 100)
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
	try {
		return JSON.parse(json)
	} catch {
		return fallback
	}
}

/**
 * Generate unique ID
 */
export function generateId(): string {
	return Math.random().toString(36).substring(2) + Date.now().toString(36)
}