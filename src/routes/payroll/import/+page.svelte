<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import PageHeader from '$lib/components/ui/PageHeader.svelte'
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte'
	
	// Import wizard steps
	import ImportStep1 from './ImportStep1.svelte'
	import ImportStep2 from './ImportStep2.svelte'
	import ImportStep3 from './ImportStep3.svelte'
	import ImportStep4 from './ImportStep4.svelte'
	
	// Import utilities
	import { csvImporter, type CSVRow, type TransformationResult, type ImportResult } from '$lib/utils/csvImporter'
	import type { CreatePayroll } from '$lib/schemas/payroll'

	// Wizard state
	let currentStep = $state(1)
	const totalSteps = 4
	
	// Data state
	let uploadedFile: File | null = $state(null)
	let csvData: CSVRow[] = $state([])
	let validationResult: TransformationResult | null = $state(null)
	let transformedData: CreatePayroll[] = $state([])
	let importResult: ImportResult | null = $state(null)
	let fieldMapping: Record<string, string> = $state({})
	let conflictResolutions: Record<string, any> = $state({})
	
	// UI state
	let isLoading = $state(false)
	let error: string | null = $state(null)

	const stepTitles = [
		'Upload CSV File',
		'Map Fields & Validate',
		'Review & Resolve Conflicts',
		'Import Progress & Results'
	]

	function nextStep() {
		if (currentStep < totalSteps) {
			currentStep++
		}
	}

	function previousStep() {
		if (currentStep > 1) {
			currentStep--
		}
	}

	function restartWizard() {
		currentStep = 1
		uploadedFile = null
		csvData = []
		validationResult = null
		transformedData = []
		importResult = null
		fieldMapping = {}
		conflictResolutions = {}
		error = null
	}

	function cancelWizard() {
		goto('/payroll')
	}

	async function handleFileUploaded(file: File, data: CSVRow[]) {
		uploadedFile = file
		csvData = data
		nextStep()
	}

	async function handleFieldsMapped(mapping: Record<string, string>) {
		fieldMapping = mapping
		
		isLoading = true
		error = null
		
		try {
			validationResult = await csvImporter.validateCSVData(csvData)
			nextStep()
		} catch (err) {
			error = err instanceof Error ? err.message : 'Validation failed'
		} finally {
			isLoading = false
		}
	}

	async function handleConflictsResolved(resolutions: Record<string, any>) {
		conflictResolutions = resolutions
		
		isLoading = true
		error = null
		
		try {
			const transformResult = await csvImporter.transformCSVToPayroll(csvData)
			if (transformResult.success && transformResult.data) {
				transformedData = transformResult.data
				nextStep()
			} else {
				error = 'Failed to transform data: ' + transformResult.errors.map(e => e.message).join(', ')
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Transformation failed'
		} finally {
			isLoading = false
		}
	}

	async function handleImportComplete(result: ImportResult) {
		importResult = result
	}

	// Progress bar calculation
	let progress = $derived((currentStep / totalSteps) * 100);
</script>

<ErrorBoundary>
	<div class="flex flex-col h-full">
		<!-- Fixed Page Header -->
		<div class="flex-none px-6 pt-4 pb-4 bg-base-100 border-b border-base-200">
			<PageHeader
				title="CSV Import Wizard"
				subtitle="Import payroll data from CSV files"
			>
				{#snippet actions()}
					<button class="btn btn-ghost" onclick={cancelWizard}>
						Cancel
					</button>
					{#if currentStep > 1 && currentStep < 4}
						<button class="btn btn-outline" onclick={previousStep}>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
							</svg>
							Back
						</button>
					{/if}
					{#if importResult?.success}
						<button class="btn btn-primary" onclick={restartWizard}>
							Import Another File
						</button>
					{/if}
				{/snippet}
			</PageHeader>
		</div>
		
		<!-- Scrollable Content Area -->
		<div class="flex-1 p-6 overflow-auto">
			<div class="max-w-4xl mx-auto space-y-6">
				
				<!-- Progress Indicator -->
				<div class="card bg-base-100 shadow-sm">
					<div class="card-body p-6">
						<!-- Steps Navigation -->
						<div class="flex justify-between items-center mb-4">
							{#each stepTitles as title, index}
								<div class="flex items-center {index < stepTitles.length - 1 ? 'flex-1' : ''}">
									<div class="flex items-center">
										<div class="rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium
											{currentStep > index + 1 ? 'bg-primary text-primary-content' : 
											 currentStep === index + 1 ? 'bg-primary text-primary-content' : 
											 'bg-base-300 text-base-content'}">
											{#if currentStep > index + 1}
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											{:else}
												{index + 1}
											{/if}
										</div>
										<span class="ml-2 text-sm font-medium
											{currentStep >= index + 1 ? 'text-base-content' : 'text-base-content/60'}">
											{title}
										</span>
									</div>
									{#if index < stepTitles.length - 1}
										<div class="flex-1 h-px bg-base-300 mx-4
											{currentStep > index + 1 ? 'bg-primary' : ''}"></div>
									{/if}
								</div>
							{/each}
						</div>
						
						<!-- Progress Bar -->
						<div class="w-full bg-base-300 rounded-full h-2">
							<div class="bg-primary h-2 rounded-full transition-all duration-300 ease-out" 
								 style="width: {progress}%"></div>
						</div>
					</div>
				</div>

				<!-- Loading State -->
				{#if isLoading}
					<div class="card bg-base-100 shadow-sm">
						<div class="card-body p-6">
							<div class="flex items-center justify-center py-8">
								<LoadingSpinner size="lg" />
								<span class="ml-4 text-lg">Processing...</span>
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

				<!-- Step Content -->
				{#if !isLoading}
					{#if currentStep === 1}
						<ImportStep1 onFileUploaded={handleFileUploaded} />
					{:else if currentStep === 2}
						<ImportStep2 
							csvData={csvData} 
							onFieldsMapped={handleFieldsMapped} />
					{:else if currentStep === 3}
						<ImportStep3 
							csvData={csvData}
							validationResult={validationResult}
							fieldMapping={fieldMapping}
							onConflictsResolved={handleConflictsResolved} />
					{:else if currentStep === 4}
						<ImportStep4 
							transformedData={transformedData}
							onImportComplete={handleImportComplete} />
					{/if}
				{/if}
			</div>
		</div>
	</div>
</ErrorBoundary>