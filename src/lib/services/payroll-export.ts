/**
 * Payroll Export Service
 * 
 * Provides export functionality for payroll data in CSV and Excel formats.
 */

import * as XLSX from 'xlsx'
import type { Payroll } from '$lib/schemas/payroll'

export interface ExportOptions {
	filename?: string
	format: 'csv' | 'xlsx'
	includeHeaders?: boolean
}

interface EnhancedPayrollEntry {
	artistName: string
	eventDate: string
	program: string
	venue: string
	hours: number
	rate: number
	additionalPay: number
	additionalPayReason: string
	totalPay: number
	status: string
	paymentType: string
	employeeContractorStatus: string
	notes: string
}

/**
 * Format payroll entries for export
 */
function formatEntriesForExport(entries: Payroll[]): EnhancedPayrollEntry[] {
	return entries.map(entry => {
		// Extract artist name
		let artistName = 'Unknown Artist'
		const artist = entry.artists as any
		if (artist) {
			artistName = artist.full_name || 
				`${artist.legal_first_name || ''} ${artist.legal_last_name || ''}`.trim() || 
				'Unknown Artist'
		}

		// Extract program title
		const program = entry.programs as any
		const programTitle = program?.title || ''

		// Extract venue name
		const venue = entry.venues as any
		const venueName = venue?.name || ''

		return {
			artistName,
			eventDate: entry.event_date,
			program: programTitle,
			venue: venueName,
			hours: entry.hours || 0,
			rate: entry.rate || 0,
			additionalPay: entry.additional_pay || 0,
			additionalPayReason: entry.additional_pay_reason || '',
			totalPay: entry.total_pay || 0,
			status: entry.status || '',
			paymentType: entry.payment_type || '',
			employeeContractorStatus: entry.employee_contractor_status || '',
			notes: entry.notes || ''
		}
	})
}

/**
 * Generate CSV content from payroll entries
 */
export function generateCSV(entries: Payroll[], options: Partial<ExportOptions> = {}): string {
	const { includeHeaders = true } = options
	const formattedEntries = formatEntriesForExport(entries)

	const headers = [
		'Artist Name',
		'Event Date',
		'Program',
		'Venue',
		'Hours',
		'Rate',
		'Additional Pay',
		'Additional Pay Reason',
		'Total Pay',
		'Status',
		'Payment Type',
		'Worker Type',
		'Notes'
	]

	const rows = formattedEntries.map(entry => [
		entry.artistName,
		entry.eventDate,
		entry.program,
		entry.venue,
		entry.hours.toString(),
		entry.rate.toFixed(2),
		entry.additionalPay.toFixed(2),
		entry.additionalPayReason,
		entry.totalPay.toFixed(2),
		entry.status,
		entry.paymentType,
		entry.employeeContractorStatus,
		entry.notes
	])

	// Escape CSV values
	const escapeCSV = (value: string) => {
		if (value.includes(',') || value.includes('"') || value.includes('\n')) {
			return `"${value.replace(/"/g, '""')}"`
		}
		return value
	}

	const csvRows: string[] = []
	
	if (includeHeaders) {
		csvRows.push(headers.map(escapeCSV).join(','))
	}
	
	for (const row of rows) {
		csvRows.push(row.map(escapeCSV).join(','))
	}

	return csvRows.join('\n')
}

/**
 * Generate Excel workbook from payroll entries
 */
export function generateExcel(entries: Payroll[], options: Partial<ExportOptions> = {}): XLSX.WorkBook {
	const formattedEntries = formatEntriesForExport(entries)

	// Create worksheet data
	const wsData = [
		// Headers
		[
			'Artist Name',
			'Event Date',
			'Program',
			'Venue',
			'Hours',
			'Rate',
			'Additional Pay',
			'Additional Pay Reason',
			'Total Pay',
			'Status',
			'Payment Type',
			'Worker Type',
			'Notes'
		],
		// Data rows
		...formattedEntries.map(entry => [
			entry.artistName,
			entry.eventDate,
			entry.program,
			entry.venue,
			entry.hours,
			entry.rate,
			entry.additionalPay,
			entry.additionalPayReason,
			entry.totalPay,
			entry.status,
			entry.paymentType,
			entry.employeeContractorStatus,
			entry.notes
		])
	]

	// Create workbook and worksheet
	const wb = XLSX.utils.book_new()
	const ws = XLSX.utils.aoa_to_sheet(wsData)

	// Set column widths
	ws['!cols'] = [
		{ wch: 25 }, // Artist Name
		{ wch: 12 }, // Event Date
		{ wch: 25 }, // Program
		{ wch: 20 }, // Venue
		{ wch: 8 },  // Hours
		{ wch: 10 }, // Rate
		{ wch: 12 }, // Additional Pay
		{ wch: 25 }, // Additional Pay Reason
		{ wch: 12 }, // Total Pay
		{ wch: 12 }, // Status
		{ wch: 15 }, // Payment Type
		{ wch: 15 }, // Worker Type
		{ wch: 30 }  // Notes
	]

	// Apply number formatting to currency columns
	const currencyFormat = '$#,##0.00'
	const currencyColumns = [5, 6, 8] // Rate, Additional Pay, Total Pay (0-indexed: E, F, H)
	
	for (let row = 1; row <= formattedEntries.length; row++) {
		for (const col of currencyColumns) {
			const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
			if (ws[cellAddress]) {
				ws[cellAddress].z = currencyFormat
			}
		}
	}

	// Add worksheet to workbook
	XLSX.utils.book_append_sheet(wb, ws, 'Payroll')

	return wb
}

/**
 * Export payroll entries to a file
 */
export function exportPayroll(entries: Payroll[], options: ExportOptions): void {
	const defaultFilename = `payroll_export_${new Date().toISOString().split('T')[0]}`
	const filename = options.filename || defaultFilename

	if (options.format === 'csv') {
		const csvContent = generateCSV(entries, options)
		downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;')
	} else if (options.format === 'xlsx') {
		const wb = generateExcel(entries, options)
		XLSX.writeFile(wb, `${filename}.xlsx`)
	}
}

/**
 * Export payroll entries grouped by week
 */
export function exportPayrollByWeek(
	entries: Payroll[], 
	options: ExportOptions & { weekLabel?: string }
): void {
	const weekSuffix = options.weekLabel 
		? `_${options.weekLabel.replace(/[^a-zA-Z0-9]/g, '_')}`
		: ''
	const defaultFilename = `payroll_batch${weekSuffix}_${new Date().toISOString().split('T')[0]}`
	
	exportPayroll(entries, {
		...options,
		filename: options.filename || defaultFilename
	})
}

/**
 * Generate summary statistics for export
 */
export function generateExportSummary(entries: Payroll[]): {
	totalEntries: number
	totalAmount: number
	uniqueArtists: number
	dateRange: { start: string; end: string }
} {
	const uniqueArtists = new Set(entries.map(e => e.artist_id).filter(Boolean))
	const dates = entries.map(e => e.event_date).filter(Boolean).sort()

	return {
		totalEntries: entries.length,
		totalAmount: entries.reduce((sum, e) => sum + (e.total_pay || 0), 0),
		uniqueArtists: uniqueArtists.size,
		dateRange: {
			start: dates[0] || '',
			end: dates[dates.length - 1] || ''
		}
	}
}

/**
 * Helper function to download a file
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
	const blob = new Blob([content], { type: mimeType })
	const link = document.createElement('a')
	link.href = URL.createObjectURL(blob)
	link.download = filename
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	URL.revokeObjectURL(link.href)
}

/**
 * Generate export for Google Sheets (returns URL-encoded data)
 */
export function generateGoogleSheetsURL(entries: Payroll[]): string {
	// Note: This creates a URL that opens Google Sheets with the data
	// The user would need to paste the data manually or use Google Sheets API
	const csvContent = generateCSV(entries)
	const encodedData = encodeURIComponent(csvContent)
	
	// This URL opens Google Sheets - user can then paste the data
	// For full integration, you'd need to use Google Sheets API
	return `https://docs.google.com/spreadsheets/create`
}
