<script lang="ts">
	import { parseCSVFile, type CSVRow } from '$lib/utils/csvImporter'
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte'

	interface Props {
		onFileUploaded: (file: File, data: CSVRow[]) => void
	}

	let { onFileUploaded }: Props = $props()

	let fileInput: HTMLInputElement
	let dragOver = $state(false)
	let isLoading = $state(false)
	let error: string | null = $state(null)
	let previewData: CSVRow[] = $state([])
	let selectedFile: File | null = $state(null)
	let fileStats = $state({ rows: 0, columns: 0, size: 0 })

	async function handleFileSelect(file: File) {
		if (!file) return

		// Validate file type
		if (!file.name.endsWith('.csv')) {
			error = 'Please select a CSV file'
			return
		}

		// Validate file size (10MB limit)
		if (file.size > 10 * 1024 * 1024) {
			error = 'File size must be less than 10MB'
			return
		}

		selectedFile = file
		isLoading = true
		error = null

		try {
			const csvData = await parseCSVFile(file)
			
			if (csvData.length === 0) {
				error = 'CSV file appears to be empty'
				return
			}

			previewData = csvData.slice(0, 5) // Show first 5 rows
			fileStats = {
				rows: csvData.length,
				columns: Object.keys(csvData[0] || {}).length,
				size: file.size
			}

		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to parse CSV file'
			previewData = []
			selectedFile = null
		} finally {
			isLoading = false
		}
	}

	function handleFileInput(event: Event) {
		const target = event.target as HTMLInputElement
		const file = target.files?.[0]
		if (file) {
			handleFileSelect(file)
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault()
		dragOver = false
		
		const file = event.dataTransfer?.files[0]
		if (file) {
			handleFileSelect(file)
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault()
		dragOver = true
	}

	function handleDragLeave() {
		dragOver = false
	}

	function proceedWithFile() {
		if (selectedFile && previewData.length > 0) {
			// Get the full data again for processing
			parseCSVFile(selectedFile).then(fullData => {
				onFileUploaded(selectedFile!, fullData)
			})
		}
	}

	function clearFile() {
		selectedFile = null
		previewData = []
		error = null
		fileStats = { rows: 0, columns: 0, size: 0 }
		if (fileInput) {
			fileInput.value = ''
		}
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes'
		const k = 1024
		const sizes = ['Bytes', 'KB', 'MB', 'GB']
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
	}

	// Get table headers from first row
	let tableHeaders = $derived(previewData.length > 0 ? Object.keys(previewData[0]) : []);
</script>

<div class="space-y-6">
	<!-- File Upload Area -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h3 class="card-title text-lg mb-4">Upload CSV File</h3>
			
			{#if !selectedFile}
				<!-- Upload Zone -->
				<div 
					class="border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
						{dragOver ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50'}"
					ondrop={handleDrop}
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
					onclick={() => fileInput?.click()}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-base-content/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
					</svg>
					
					<h4 class="text-lg font-semibold mb-2">
						{dragOver ? 'Drop your CSV file here' : 'Choose a CSV file or drag and drop'}
					</h4>
					
					<p class="text-base-content/60 mb-4">
						Upload payroll data in CSV format. Maximum file size: 10MB
					</p>
					
					<button class="btn btn-primary btn-outline">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Select File
					</button>
				</div>
				
				<input 
					bind:this={fileInput}
					type="file" 
					accept=".csv" 
					class="hidden" 
					onchange={handleFileInput}
				>
			{:else}
				<!-- File Info -->
				<div class="bg-base-200 rounded-lg p-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-success mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							<div>
								<h4 class="font-semibold">{selectedFile.name}</h4>
								<p class="text-sm text-base-content/60">
									{fileStats.rows} rows, {fileStats.columns} columns, {formatFileSize(fileStats.size)}
								</p>
							</div>
						</div>
						<button class="btn btn-ghost btn-sm" onclick={clearFile}>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Loading State -->
	{#if isLoading}
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<div class="flex items-center justify-center py-8">
					<LoadingSpinner />
					<span class="ml-4">Parsing CSV file...</span>
				</div>
			</div>
		</div>
	{/if}

	<!-- Error Display -->
	{#if error}
		<div class="alert alert-error">
			<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span>{error}</span>
		</div>
	{/if}

	<!-- Data Preview -->
	{#if previewData.length > 0 && !isLoading}
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<h3 class="card-title text-lg mb-4">Data Preview</h3>
				<p class="text-sm text-base-content/60 mb-4">
					Showing first {previewData.length} rows of {fileStats.rows} total rows
				</p>
				
				<div class="overflow-x-auto">
					<table class="table table-zebra table-sm">
						<thead>
							<tr>
								{#each tableHeaders as header}
									<th class="font-semibold">{header}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each previewData as row, index}
								<tr>
									{#each tableHeaders as header}
										<td class="text-sm max-w-32 truncate" title={row[header]}>
											{row[header] || '—'}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				
				<div class="flex justify-between items-center mt-6">
					<div class="text-sm text-base-content/60">
						Ready to proceed with {fileStats.rows} rows
					</div>
					<button class="btn btn-primary" onclick={proceedWithFile}>
						Continue to Field Mapping
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Format Guidelines -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h3 class="card-title text-lg mb-4">CSV Format Guidelines</h3>
			<div class="space-y-3 text-sm">
				<div class="flex items-start">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mt-0.5 mr-2 text-info flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<div>
						<strong>Required columns:</strong> event_date, artist_name, hours, rate
					</div>
				</div>
				<div class="flex items-start">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mt-0.5 mr-2 text-info flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<div>
						<strong>Date format:</strong> YYYY-MM-DD, MM/DD/YYYY, or MM-DD-YYYY
					</div>
				</div>
				<div class="flex items-start">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mt-0.5 mr-2 text-info flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<div>
						<strong>Optional columns:</strong> venue_name, additional_pay, additional_pay_reason, status, paid_date
					</div>
				</div>
				<div class="flex items-start">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mt-0.5 mr-2 text-info flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<div>
						<strong>Artist names:</strong> Will be matched against existing artists in the system
					</div>
				</div>
			</div>
		</div>
	</div>
</div>