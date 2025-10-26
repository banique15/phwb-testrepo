/**
 * Example usage of the CSV Importer for PHWB Admin Payroll System
 * 
 * This file demonstrates how to use the CSV import functionality
 * to process timesheet data and convert it to payroll records.
 */

import {
	parseCSVFile,
	validateCSVData,
	transformCSVToPayroll,
	importPayrollData,
	previewImport,
	generateCSVTemplate,
	downloadCSV,
	validateFile,
	type ValidationError,
	type TransformationResult,
	type ImportResult
} from './index'

// Example: Basic CSV Import Workflow
export async function exampleBasicImport(file: File): Promise<void> {
	try {
		// Step 1: Validate file
		const fileValidation = validateFile(file)
		if (!fileValidation.valid) {
			throw new Error(fileValidation.error)
		}

		// Step 2: Parse CSV file
		console.log('Parsing CSV file...')
		const csvData = await parseCSVFile(file)
		console.log(`Parsed ${csvData.length} rows`)

		// Step 3: Validate data structure
		console.log('Validating CSV data...')
		const validation = await validateCSVData(csvData)
		
		if (!validation.success) {
			console.error('Validation failed:', validation.errors)
			return
		}

		console.log('Validation summary:', validation.summary)

		// Step 4: Transform to payroll records
		console.log('Transforming data...')
		const transformation = await transformCSVToPayroll(csvData)
		
		if (!transformation.success || !transformation.data) {
			console.error('Transformation failed:', transformation.errors)
			return
		}

		// Step 5: Import to database
		console.log('Importing to database...')
		const importResult = await importPayrollData(transformation.data, {
			preview: false,
			batchSize: 25,
			onProgress: (processed, total) => {
				console.log(`Progress: ${processed}/${total} (${Math.round((processed/total)*100)}%)`)
			}
		})

		if (importResult.success) {
			console.log(`Successfully imported ${importResult.imported} records`)
		} else {
			console.error('Import failed:', importResult.errors)
		}

	} catch (error) {
		console.error('Import process failed:', error)
	}
}

// Example: Preview Mode (Validate without importing)
export async function examplePreviewImport(file: File): Promise<TransformationResult> {
	try {
		// Parse and preview the import
		const csvData = await parseCSVFile(file)
		const preview = await previewImport(csvData)
		
		console.log('Preview results:')
		console.log('- Total rows:', preview.summary.totalRows)
		console.log('- Valid rows:', preview.summary.validRows)
		console.log('- Error rows:', preview.summary.errorRows)
		console.log('- Duplicate rows:', preview.summary.duplicateRows)
		
		if (preview.errors.length > 0) {
			console.log('Errors found:')
			preview.errors.forEach(error => {
				console.log(`  Row ${error.row}, ${error.field}: ${error.message}`)
			})
		}

		if (preview.warnings.length > 0) {
			console.log('Warnings:')
			preview.warnings.forEach(warning => console.log(`  ${warning}`))
		}

		return preview
	} catch (error) {
		console.error('Preview failed:', error)
		throw error
	}
}

// Example: Batch Import with Progress Tracking
export async function exampleBatchImport(file: File): Promise<ImportResult> {
	let progressPercentage = 0
	
	const csvData = await parseCSVFile(file)
	const transformation = await transformCSVToPayroll(csvData)
	
	if (!transformation.success || !transformation.data) {
		throw new Error('Data transformation failed')
	}

	return await importPayrollData(transformation.data, {
		preview: false,
		batchSize: 10, // Smaller batches for better progress tracking
		onProgress: (processed, total) => {
			const newProgress = Math.round((processed / total) * 100)
			if (newProgress !== progressPercentage) {
				progressPercentage = newProgress
				console.log(`Import progress: ${progressPercentage}%`)
				
				// You could emit events here for UI updates
				// eventBus.emit('import-progress', { processed, total, percentage: progressPercentage })
			}
		}
	})
}

// Example: Error Handling and Recovery
export async function exampleErrorHandling(file: File): Promise<void> {
	try {
		const csvData = await parseCSVFile(file)
		const validation = await validateCSVData(csvData)
		
		if (!validation.success) {
			// Group errors by type for better reporting
			const errorsByType: Record<string, ValidationError[]> = {}
			
			validation.errors.forEach(error => {
				if (!errorsByType[error.field]) {
					errorsByType[error.field] = []
				}
				errorsByType[error.field].push(error)
			})

			console.log('Validation errors grouped by field:')
			Object.entries(errorsByType).forEach(([field, errors]) => {
				console.log(`${field} (${errors.length} errors):`)
				errors.slice(0, 3).forEach(error => {
					console.log(`  Row ${error.row}: ${error.message}`)
				})
				if (errors.length > 3) {
					console.log(`  ... and ${errors.length - 3} more`)
				}
			})

			// Suggest fixes
			if (errorsByType.artist_name) {
				console.log('\nSuggestion: Check artist names match exactly with the database.')
				console.log('You can get artist suggestions using the CSV importer.')
			}

			if (errorsByType.event_date) {
				console.log('\nSuggestion: Ensure dates are in YYYY-MM-DD, MM/DD/YYYY, or MM-DD-YYYY format.')
			}

			return
		}

		// If validation passes, proceed with import
		const transformation = await transformCSVToPayroll(csvData)
		if (transformation.success && transformation.data) {
			const result = await importPayrollData(transformation.data)
			console.log('Import completed:', result.message)
		}

	} catch (error) {
		if (error instanceof Error) {
			if (error.message.includes('not found')) {
				console.error('Data not found error:', error.message)
				console.log('Please check that all referenced artists and venues exist in the database.')
			} else if (error.message.includes('Invalid')) {
				console.error('Data format error:', error.message)
				console.log('Please check the CSV data format and try again.')
			} else {
				console.error('Unexpected error:', error.message)
			}
		} else {
			console.error('Unknown error occurred during import')
		}
	}
}

// Example: Generate and Download CSV Template
export function exampleGenerateTemplate(): void {
	const template = generateCSVTemplate()
	const filename = `payroll_template_${new Date().toISOString().split('T')[0]}.csv`
	
	downloadCSV(template, filename)
	console.log(`Downloaded CSV template: ${filename}`)
}

// Example: Validate Multiple Files
export async function exampleValidateMultipleFiles(files: File[]): Promise<void> {
	console.log(`Validating ${files.length} files...`)
	
	const results = await Promise.allSettled(
		files.map(async (file, index) => {
			try {
				console.log(`Processing file ${index + 1}: ${file.name}`)
				
				const csvData = await parseCSVFile(file)
				const validation = await validateCSVData(csvData)
				
				return {
					filename: file.name,
					success: validation.success,
					summary: validation.summary,
					errors: validation.errors
				}
			} catch (error) {
				return {
					filename: file.name,
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				}
			}
		})
	)

	// Report results
	results.forEach((result, index) => {
		if (result.status === 'fulfilled') {
			const data = result.value
			console.log(`\nFile ${index + 1}: ${data.filename}`)
			
			if (data.success) {
				console.log(`  ✅ Valid - ${data.summary.validRows}/${data.summary.totalRows} rows`)
			} else {
				console.log(`  ❌ Invalid - ${data.errors.length} errors`)
				data.errors.slice(0, 3).forEach(error => {
					console.log(`    Row ${error.row}, ${error.field}: ${error.message}`)
				})
			}
		} else {
			console.log(`\nFile ${index + 1}: Processing failed`)
			console.log(`  Error: ${result.reason}`)
		}
	})
}

// Example: Custom Progress Handler
export function createProgressHandler() {
	let startTime = Date.now()
	
	return (processed: number, total: number) => {
		const percentage = Math.round((processed / total) * 100)
		const elapsed = Date.now() - startTime
		const rate = processed / (elapsed / 1000) // records per second
		const estimated = total / rate // total estimated time in seconds
		const remaining = estimated - (elapsed / 1000) // remaining time
		
		console.log(`Progress: ${processed}/${total} (${percentage}%) - ${rate.toFixed(1)} rec/sec - ETA: ${remaining.toFixed(0)}s`)
	}
}

// Example: Using Custom Progress Handler
export async function exampleWithCustomProgress(file: File): Promise<void> {
	const csvData = await parseCSVFile(file)
	const transformation = await transformCSVToPayroll(csvData)
	
	if (transformation.success && transformation.data) {
		await importPayrollData(transformation.data, {
			onProgress: createProgressHandler(),
			batchSize: 20
		})
	}
}