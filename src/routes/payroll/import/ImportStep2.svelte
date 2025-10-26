<script lang="ts">
	import { onMount } from 'svelte'
	import { csvImporter, type CSVRow, type TransformationResult } from '$lib/utils/csvImporter'
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte'

	interface Props {
		csvData: CSVRow[]
		onFieldsMapped: (mapping: Record<string, string>) => void
	}

	let { csvData, onFieldsMapped }: Props = $props()

	// Field mapping state
	let fieldMapping: Record<string, string> = $state({})
	let isValidating = $state(false)
	let validationResult: TransformationResult | null = $state(null)
	let showPreview = $state(false)

	// Available CSV headers from the uploaded data
	let csvHeaders = $derived(csvData.length > 0 ? Object.keys(csvData[0]) : []);

	// Required and optional payroll fields
	const requiredFields = [
		{ key: 'event_date', label: 'Event Date', description: 'Date of the event/performance' },
		{ key: 'artist_name', label: 'Artist Name', description: 'Name of the artist/performer' },
		{ key: 'hours', label: 'Hours', description: 'Number of hours worked' },
		{ key: 'rate', label: 'Rate', description: 'Hourly rate or payment amount' }
	]

	const optionalFields = [
		{ key: 'venue_name', label: 'Venue Name', description: 'Venue where the event took place' },
		{ key: 'additional_pay', label: 'Additional Pay', description: 'Extra compensation amount' },
		{ key: 'additional_pay_reason', label: 'Additional Pay Reason', description: 'Reason for additional compensation' },
		{ key: 'status', label: 'Status', description: 'Payment status (Planned, Paid, Unpaid, Cancelled)' },
		{ key: 'paid_date', label: 'Paid Date', description: 'Date when payment was made' },
		{ key: 'event_id', label: 'Event ID', description: 'Optional event identifier' },
		{ key: 'insperity_hours', label: 'Insperity Hours', description: 'Hours for Insperity processing' }
	]

	onMount(() => {
		// Auto-map fields based on header names
		autoMapFields()
	})

	function autoMapFields() {
		const mapping: Record<string, string> = {}
		
		// Auto-detect common field mappings
		for (const header of csvHeaders) {
			const normalizedHeader = header.toLowerCase().trim()
			
			// Direct matches
			if (normalizedHeader === 'event_date' || normalizedHeader === 'date') {
				mapping['event_date'] = header
			} else if (normalizedHeader === 'artist_name' || normalizedHeader === 'artist' || normalizedHeader === 'name') {
				mapping['artist_name'] = header
			} else if (normalizedHeader === 'hours' || normalizedHeader === 'hours_worked') {
				mapping['hours'] = header
			} else if (normalizedHeader === 'rate' || normalizedHeader === 'hourly_rate' || normalizedHeader === 'pay_rate') {
				mapping['rate'] = header
			} else if (normalizedHeader === 'venue_name' || normalizedHeader === 'venue' || normalizedHeader === 'location') {
				mapping['venue_name'] = header
			} else if (normalizedHeader === 'additional_pay' || normalizedHeader === 'bonus') {
				mapping['additional_pay'] = header
			} else if (normalizedHeader === 'additional_pay_reason' || normalizedHeader === 'bonus_reason') {
				mapping['additional_pay_reason'] = header
			} else if (normalizedHeader === 'status' || normalizedHeader === 'payment_status') {
				mapping['status'] = header
			} else if (normalizedHeader === 'paid_date' || normalizedHeader === 'payment_date') {
				mapping['paid_date'] = header
			} else if (normalizedHeader === 'event_id') {
				mapping['event_id'] = header
			} else if (normalizedHeader === 'insperity_hours') {
				mapping['insperity_hours'] = header
			}
		}
		
		fieldMapping = mapping
	}

	function updateMapping(field: string, csvHeader: string) {
		fieldMapping[field] = csvHeader
	}

	function clearMapping(field: string) {
		delete fieldMapping[field]
		fieldMapping = { ...fieldMapping }
	}

	async function validateMapping() {
		// Check that all required fields are mapped
		const missingRequired = requiredFields.filter(field => !fieldMapping[field.key])
		
		if (missingRequired.length > 0) {
			validationResult = {
				success: false,
				errors: missingRequired.map(field => ({
					row: 0,
					field: field.key,
					message: `Required field "${field.label}" is not mapped`,
					value: null
				})),
				warnings: [],
				summary: {
					totalRows: 0,
					validRows: 0,
					errorRows: missingRequired.length,
					duplicateRows: 0
				}
			}
			return
		}

		isValidating = true
		
		try {
			// Apply the field mapping to the CSV data
			const mappedData = csvData.map(row => {
				const mappedRow: Record<string, string> = {}
				
				// Map each field
				for (const [payrollField, csvHeader] of Object.entries(fieldMapping)) {
					mappedRow[payrollField] = row[csvHeader] || ''
				}
				
				return mappedRow as CSVRow
			})

			// Validate the mapped data
			validationResult = await csvImporter.validateCSVData(mappedData)
		} catch (error) {
			validationResult = {
				success: false,
				errors: [{
					row: 0,
					field: 'validation',
					message: error instanceof Error ? error.message : 'Validation failed',
					value: null
				}],
				warnings: [],
				summary: {
					totalRows: 0,
					validRows: 0,
					errorRows: 1,
					duplicateRows: 0
				}
			}
		} finally {
			isValidating = false
		}
	}

	function proceedToNextStep() {
		onFieldsMapped(fieldMapping)
	}

	// Check if mapping is complete
	let mappingComplete = $derived(requiredFields.every(field => fieldMapping[field.key]));

	// Get preview data with mapped fields
	let previewData = $derived(showPreview && csvData.length > 0 ? csvData.slice(0, 3).map(row => {
		const mappedRow: Record<string, string> = {}
		for (const [payrollField, csvHeader] of Object.entries(fieldMapping)) {
			mappedRow[payrollField] = row[csvHeader] || ''
		}
		return mappedRow
	}) : []);
</script>

<div class="space-y-6">
	<!-- Field Mapping -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h3 class="card-title text-lg mb-4">Map CSV Fields to Payroll Data</h3>
			<p class="text-sm text-base-content/60 mb-6">
				Map the columns from your CSV file to the corresponding payroll fields. Required fields must be mapped to proceed.
			</p>

			<!-- Required Fields -->
			<div class="mb-6">
				<h4 class="font-semibold text-md mb-3 flex items-center">
					<span class="badge badge-error badge-sm mr-2">Required</span>
					Required Fields
				</h4>
				<div class="space-y-3">
					{#each requiredFields as field}
						<div class="flex items-center justify-between p-3 bg-base-200 rounded-lg">
							<div class="flex-1">
								<div class="font-medium">{field.label}</div>
								<div class="text-sm text-base-content/60">{field.description}</div>
							</div>
							<div class="flex items-center space-x-2">
								<select 
									class="select select-bordered select-sm w-48"
									bind:value={fieldMapping[field.key]}
									onchange={(e) => updateMapping(field.key, e.target.value)}
								>
									<option value="">Select CSV column...</option>
									{#each csvHeaders as header}
										<option value={header}>{header}</option>
									{/each}
								</select>
								{#if fieldMapping[field.key]}
									<button 
										class="btn btn-ghost btn-sm btn-square"
										onclick={() => clearMapping(field.key)}
										title="Clear mapping"
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Optional Fields -->
			<div class="mb-6">
				<h4 class="font-semibold text-md mb-3 flex items-center">
					<span class="badge badge-info badge-sm mr-2">Optional</span>
					Optional Fields
				</h4>
				<div class="space-y-3">
					{#each optionalFields as field}
						<div class="flex items-center justify-between p-3 bg-base-200 rounded-lg">
							<div class="flex-1">
								<div class="font-medium">{field.label}</div>
								<div class="text-sm text-base-content/60">{field.description}</div>
							</div>
							<div class="flex items-center space-x-2">
								<select 
									class="select select-bordered select-sm w-48"
									bind:value={fieldMapping[field.key]}
									onchange={(e) => updateMapping(field.key, e.target.value)}
								>
									<option value="">Not mapped</option>
									{#each csvHeaders as header}
										<option value={header}>{header}</option>
									{/each}
								</select>
								{#if fieldMapping[field.key]}
									<button 
										class="btn btn-ghost btn-sm btn-square"
										onclick={() => clearMapping(field.key)}
										title="Clear mapping"
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Actions -->
			<div class="flex justify-between items-center">
				<button 
					class="btn btn-outline btn-sm"
					onclick={() => showPreview = !showPreview}
					disabled={!mappingComplete}
				>
					{showPreview ? 'Hide' : 'Show'} Preview
				</button>
				<div class="space-x-2">
					<button 
						class="btn btn-primary btn-outline"
						onclick={validateMapping}
						disabled={!mappingComplete || isValidating}
					>
						{#if isValidating}
							<LoadingSpinner size="sm" />
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						{/if}
						Validate Mapping
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Preview Section -->
	{#if showPreview && mappingComplete}
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<h3 class="card-title text-lg mb-4">Mapped Data Preview</h3>
				<p class="text-sm text-base-content/60 mb-4">
					Preview of how your CSV data will be interpreted with the current field mapping
				</p>
				
				<div class="overflow-x-auto">
					<table class="table table-zebra table-sm">
						<thead>
							<tr>
								{#each Object.entries(fieldMapping) as [payrollField, csvHeader]}
									<th class="font-semibold">{payrollField}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each previewData as row}
								<tr>
									{#each Object.entries(fieldMapping) as [payrollField, csvHeader]}
										<td class="text-sm max-w-32 truncate">
											{row[payrollField] || '—'}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/if}

	<!-- Validation Results -->
	{#if validationResult}
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<h3 class="card-title text-lg mb-4">Validation Results</h3>
				
				{#if validationResult.success}
					<div class="alert alert-success">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<div>
							<h4 class="font-bold">Validation Successful!</h4>
							<div class="text-sm">
								{validationResult.summary.validRows} of {validationResult.summary.totalRows} rows are valid and ready for import.
							</div>
						</div>
					</div>
				{:else}
					<div class="alert alert-error">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<div>
							<h4 class="font-bold">Validation Failed</h4>
							<div class="text-sm">
								Found {validationResult.errors.length} error(s) that need to be resolved.
							</div>
						</div>
					</div>
				{/if}

				<!-- Summary Stats -->
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title text-xs">Total Rows</div>
						<div class="stat-value text-lg">{validationResult.summary.totalRows}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title text-xs">Valid Rows</div>
						<div class="stat-value text-lg text-success">{validationResult.summary.validRows}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title text-xs">Error Rows</div>
						<div class="stat-value text-lg text-error">{validationResult.summary.errorRows}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title text-xs">Duplicates</div>
						<div class="stat-value text-lg text-warning">{validationResult.summary.duplicateRows}</div>
					</div>
				</div>

				<!-- Errors -->
				{#if validationResult.errors.length > 0}
					<div class="mt-4">
						<h4 class="font-semibold mb-2">Errors (showing first 10):</h4>
						<div class="space-y-2">
							{#each validationResult.errors.slice(0, 10) as error}
								<div class="alert alert-error py-2">
									<span class="text-sm">
										<strong>Row {error.row}, Field {error.field}:</strong> {error.message}
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Warnings -->
				{#if validationResult.warnings.length > 0}
					<div class="mt-4">
						<h4 class="font-semibold mb-2">Warnings:</h4>
						<div class="space-y-2">
							{#each validationResult.warnings as warning}
								<div class="alert alert-warning py-2">
									<span class="text-sm">{warning}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Proceed Button -->
				{#if validationResult.success}
					<div class="flex justify-end mt-6">
						<button class="btn btn-primary" onclick={proceedToNextStep}>
							Continue to Review
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Mapping Status -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h3 class="card-title text-lg mb-4">Mapping Status</h3>
			<div class="space-y-2">
				<div class="flex justify-between">
					<span>Required fields mapped:</span>
					<span class="font-medium">
						{requiredFields.filter(field => fieldMapping[field.key]).length} / {requiredFields.length}
					</span>
				</div>
				<div class="flex justify-between">
					<span>Optional fields mapped:</span>
					<span class="font-medium">
						{optionalFields.filter(field => fieldMapping[field.key]).length} / {optionalFields.length}
					</span>
				</div>
				<div class="flex justify-between">
					<span>Ready to validate:</span>
					<span class="font-medium {mappingComplete ? 'text-success' : 'text-error'}">
						{mappingComplete ? 'Yes' : 'No'}
					</span>
				</div>
			</div>
		</div>
	</div>
</div>