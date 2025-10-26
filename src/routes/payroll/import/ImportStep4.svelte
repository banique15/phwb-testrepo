<script lang="ts">
	import { onMount } from 'svelte'
	import { csvImporter, importPayrollData, type ImportResult } from '$lib/utils/csvImporter'
	import type { CreatePayroll } from '$lib/schemas/payroll'
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte'

	interface Props {
		transformedData: CreatePayroll[]
		onImportComplete: (result: ImportResult) => void
	}

	let { transformedData, onImportComplete }: Props = $props()

	// Import state
	let importResult: ImportResult | null = $state(null)
	let isImporting = $state(false)
	let importProgress = $state(0)
	let totalRecords = $state(0)
	let currentBatch = $state(0)
	let totalBatches = $state(0)
	let importStarted = $state(false)

	// Import stats
	let successfulImports = $state(0)
	let failedImports = $state(0)
	let importErrors: any[] = $state([])

	onMount(() => {
		totalRecords = transformedData.length
		totalBatches = Math.ceil(totalRecords / 50) // Default batch size
	})

	async function startImport() {
		if (transformedData.length === 0) {
			importResult = {
				success: false,
				message: 'No data to import',
				imported: 0,
				errors: [],
				warnings: [],
				duplicates: 0
			}
			onImportComplete(importResult)
			return
		}

		importStarted = true
		isImporting = true
		importProgress = 0
		successfulImports = 0
		failedImports = 0
		importErrors = []

		try {
			// Start the import with progress tracking
			const result = await importPayrollData(transformedData, {
				preview: false,
				batchSize: 50,
				validateOnly: false,
				allowDuplicates: false,
				onProgress: (processed: number, total: number) => {
					importProgress = (processed / total) * 100
					currentBatch = Math.ceil(processed / 50)
					successfulImports = processed
				}
			})

			importResult = result
			
			if (result.errors.length > 0) {
				importErrors = result.errors
				failedImports = result.errors.length
			}

			onImportComplete(result)
		} catch (error) {
			importResult = {
				success: false,
				message: error instanceof Error ? error.message : 'Import failed',
				imported: 0,
				errors: [],
				warnings: [],
				duplicates: 0
			}
			onImportComplete(importResult)
		} finally {
			isImporting = false
		}
	}

	function resetImport() {
		importStarted = false
		importResult = null
		importProgress = 0
		successfulImports = 0
		failedImports = 0
		importErrors = []
		currentBatch = 0
	}

	function downloadErrorReport() {
		if (!importResult?.errors.length) return

		const csvContent = [
			'Row,Field,Error,Value',
			...importResult.errors.map(error => 
				`${error.row},"${error.field}","${error.message}","${String(error.value).replace(/"/g, '""')}"`
			)
		].join('\n')

		const blob = new Blob([csvContent], { type: 'text/csv' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `import-errors-${new Date().toISOString().split('T')[0]}.csv`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	// Preview summary calculations
	let totalAmount = $derived(transformedData.reduce((sum, record) => {
		const baseAmount = record.hours * record.rate
		const additional = record.additional_pay || 0
		return sum + baseAmount + additional
	}, 0));

	let totalHours = $derived(transformedData.reduce((sum, record) => sum + record.hours, 0));

	let uniqueArtists = $derived(new Set(transformedData.map(record => record.artist_id)).size);

	let recordsByStatus = $derived(transformedData.reduce((acc, record) => {
		acc[record.status] = (acc[record.status] || 0) + 1
		return acc
	}, {} as Record<string, number>));
</script>

<div class="space-y-6">
	<!-- Import Summary -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h3 class="card-title text-lg mb-4">Import Summary</h3>
			
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				<div class="stat bg-base-200 rounded-lg">
					<div class="stat-title text-xs">Total Records</div>
					<div class="stat-value text-lg">{totalRecords}</div>
				</div>
				<div class="stat bg-base-200 rounded-lg">
					<div class="stat-title text-xs">Unique Artists</div>
					<div class="stat-value text-lg">{uniqueArtists}</div>
				</div>
				<div class="stat bg-base-200 rounded-lg">
					<div class="stat-title text-xs">Total Hours</div>
					<div class="stat-value text-lg">{totalHours.toFixed(1)}</div>
				</div>
				<div class="stat bg-base-200 rounded-lg">
					<div class="stat-title text-xs">Total Amount</div>
					<div class="stat-value text-lg">${totalAmount.toLocaleString()}</div>
				</div>
			</div>

			<!-- Status Distribution -->
			<div class="mb-4">
				<h4 class="font-semibold mb-2">Records by Status</h4>
				<div class="flex flex-wrap gap-2">
					{#each Object.entries(recordsByStatus) as [status, count]}
						<div class="badge badge-outline">
							{status}: {count}
						</div>
					{/each}
				</div>
			</div>

			<!-- Preview Data -->
			<div class="mb-6">
				<h4 class="font-semibold mb-3">Preview (First 5 Records)</h4>
				<div class="overflow-x-auto">
					<table class="table table-zebra table-sm">
						<thead>
							<tr>
								<th>Date</th>
								<th>Artist ID</th>
								<th>Hours</th>
								<th>Rate</th>
								<th>Amount</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{#each transformedData.slice(0, 5) as record}
								<tr>
									<td class="text-sm">{record.event_date}</td>
									<td class="text-sm font-mono">{record.artist_id}</td>
									<td class="text-sm">{record.hours}</td>
									<td class="text-sm">${record.rate}</td>
									<td class="text-sm">${(record.hours * record.rate + (record.additional_pay || 0)).toFixed(2)}</td>
									<td>
										<span class="badge badge-sm 
											{record.status === 'Paid' ? 'badge-success' :
											 record.status === 'Unpaid' ? 'badge-error' :
											 record.status === 'Cancelled' ? 'badge-ghost' : 'badge-warning'}">
											{record.status}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if transformedData.length > 5}
					<p class="text-sm text-base-content/60 mt-2">
						... and {transformedData.length - 5} more records
					</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- Import Action -->
	{#if !importStarted}
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<h3 class="card-title text-lg mb-4">Ready to Import</h3>
				<p class="text-base-content/80 mb-6">
					All validations have passed and conflicts have been resolved. 
					Click below to start importing {totalRecords} payroll records into the system.
				</p>
				
				<div class="alert alert-info mb-4">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<div>
						<h4 class="font-bold">Important Notes</h4>
						<ul class="text-sm mt-1 list-disc list-inside space-y-1">
							<li>Import will process records in batches of 50</li>
							<li>Duplicate records will be detected and skipped</li>
							<li>Failed imports will be logged for review</li>
							<li>You can download a report after import completion</li>
						</ul>
					</div>
				</div>

				<div class="flex justify-end">
					<button 
						class="btn btn-primary btn-lg"
						onclick={startImport}
						disabled={totalRecords === 0}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
						</svg>
						Start Import Process
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Import Progress -->
	{#if isImporting}
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<h3 class="card-title text-lg mb-4">Import in Progress</h3>
				
				<div class="space-y-4">
					<!-- Overall Progress -->
					<div>
						<div class="flex justify-between text-sm mb-2">
							<span>Overall Progress</span>
							<span>{importProgress.toFixed(1)}%</span>
						</div>
						<div class="w-full bg-base-300 rounded-full h-3">
							<div class="bg-primary h-3 rounded-full transition-all duration-300" 
								 style="width: {importProgress}%"></div>
						</div>
					</div>

					<!-- Batch Progress -->
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div class="stat bg-base-200 rounded-lg">
							<div class="stat-title text-xs">Current Batch</div>
							<div class="stat-value text-lg">{currentBatch} / {totalBatches}</div>
						</div>
						<div class="stat bg-base-200 rounded-lg">
							<div class="stat-title text-xs">Successful</div>
							<div class="stat-value text-lg text-success">{successfulImports}</div>
						</div>
						<div class="stat bg-base-200 rounded-lg">
							<div class="stat-title text-xs">Failed</div>
							<div class="stat-value text-lg text-error">{failedImports}</div>
						</div>
					</div>

					<!-- Status Message -->
					<div class="flex items-center justify-center py-4">
						<LoadingSpinner size="lg" />
						<span class="ml-4 text-lg">
							Processing batch {currentBatch} of {totalBatches}...
						</span>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Import Results -->
	{#if importResult && !isImporting}
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<h3 class="card-title text-lg mb-4">Import Results</h3>
				
				{#if importResult.success}
					<div class="alert alert-success mb-6">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<div>
							<h4 class="font-bold">Import Completed Successfully!</h4>
							<div class="text-sm">{importResult.message}</div>
						</div>
					</div>
				{:else}
					<div class="alert alert-error mb-6">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<div>
							<h4 class="font-bold">Import Failed</h4>
							<div class="text-sm">{importResult.message}</div>
						</div>
					</div>
				{/if}

				<!-- Results Summary -->
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title text-xs">Total Processed</div>
						<div class="stat-value text-lg">{totalRecords}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title text-xs">Successfully Imported</div>
						<div class="stat-value text-lg text-success">{importResult.imported}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title text-xs">Failed</div>
						<div class="stat-value text-lg text-error">{importResult.errors.length}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title text-xs">Duplicates</div>
						<div class="stat-value text-lg text-warning">{importResult.duplicates}</div>
					</div>
				</div>

				<!-- Warnings -->
				{#if importResult.warnings.length > 0}
					<div class="mb-4">
						<h4 class="font-semibold mb-2">Warnings</h4>
						<div class="space-y-1">
							{#each importResult.warnings as warning}
								<div class="alert alert-warning py-2">
									<span class="text-sm">{warning}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Errors -->
				{#if importResult.errors.length > 0}
					<div class="mb-6">
						<h4 class="font-semibold mb-2">Import Errors</h4>
						<p class="text-sm text-base-content/60 mb-3">
							The following records failed to import. Please review and correct these issues.
						</p>
						
						<div class="max-h-64 overflow-y-auto space-y-2">
							{#each importResult.errors.slice(0, 20) as error}
								<div class="alert alert-error py-2">
									<span class="text-sm">
										<strong>Row {error.row}:</strong> {error.message}
									</span>
								</div>
							{/each}
							{#if importResult.errors.length > 20}
								<div class="text-sm text-base-content/60 text-center py-2">
									... and {importResult.errors.length - 20} more errors
								</div>
							{/if}
						</div>
						
						<!-- Download Error Report -->
						<div class="mt-4">
							<button class="btn btn-outline btn-sm" onclick={downloadErrorReport}>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								Download Error Report
							</button>
						</div>
					</div>
				{/if}

				<!-- Success Actions -->
				{#if importResult.success}
					<div class="flex justify-between items-center">
						<div class="text-sm text-base-content/60">
							Import completed at {new Date().toLocaleString()}
						</div>
						<div class="flex space-x-3">
							<button class="btn btn-outline" onclick={resetImport}>
								Import Another File
							</button>
							<a href="/payroll" class="btn btn-primary">
								View Payroll Records
							</a>
						</div>
					</div>
				{:else}
					<!-- Failure Actions -->
					<div class="flex justify-end space-x-3">
						<button class="btn btn-outline" onclick={resetImport}>
							Try Again
						</button>
						<button class="btn btn-ghost" onclick={() => window.history.back()}>
							Go Back
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Quick Actions -->
	{#if importResult?.success}
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<h3 class="card-title text-lg mb-4">What's Next?</h3>
				
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<a href="/payroll" class="btn btn-outline btn-lg">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
						</svg>
						Review Records
					</a>
					
					<a href="/reports" class="btn btn-outline btn-lg">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
						</svg>
						Generate Reports
					</a>
					
					<button class="btn btn-outline btn-lg" onclick={resetImport}>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
						</svg>
						Import More Data
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>