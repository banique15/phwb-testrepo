<script lang="ts">
	import { onMount } from 'svelte'
	import { csvImporter, type CSVRow, type TransformationResult } from '$lib/utils/csvImporter'
	import ArtistMappingModal from './ArtistMappingModal.svelte'
	import VenueMappingModal from './VenueMappingModal.svelte'
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte'

	interface Props {
		csvData: CSVRow[]
		validationResult: TransformationResult | null
		fieldMapping: Record<string, string>
		onConflictsResolved: (resolutions: Record<string, any>) => void
	}

	let { csvData, validationResult, fieldMapping, onConflictsResolved }: Props = $props()

	// Conflict resolution state
	let artistConflicts: any[] = $state([])
	let venueConflicts: any[] = $state([])
	let dataErrors: any[] = $state([])
	let resolutions: Record<string, any> = $state({})
	let showArtistModal = $state(false)
	let showVenueModal = $state(false)
	let selectedConflict: any = $state(null)
	let isProcessing = $state(false)

	// Summary statistics
	let totalConflicts = $state(0)
	let resolvedConflicts = $state(0)

	onMount(() => {
		if (validationResult) {
			analyzeConflicts()
		}
	})

	async function analyzeConflicts() {
		if (!validationResult?.errors) return

		const artistErrors: any[] = []
		const venueErrors: any[] = []
		const otherErrors: any[] = []

		for (const error of validationResult.errors) {
			if (error.field === 'artist_name') {
				// Artist not found - potential conflict
				const rowData = csvData[error.row - 1]
				if (rowData) {
					const suggestions = await csvImporter.getArtistSuggestions(rowData.artist_name || '')
					artistErrors.push({
						...error,
						rowData,
						suggestions,
						resolved: false
					})
				}
			} else if (error.field === 'venue_name') {
				// Venue not found - potential new venue creation
				const rowData = csvData[error.row - 1]
				if (rowData) {
					venueErrors.push({
						...error,
						rowData,
						resolved: false
					})
				}
			} else {
				// Other data errors
				otherErrors.push(error)
			}
		}

		artistConflicts = artistErrors
		venueConflicts = venueErrors
		dataErrors = otherErrors
		totalConflicts = artistErrors.length + venueErrors.length + otherErrors.length
		updateResolvedCount()
	}

	function updateResolvedCount() {
		resolvedConflicts = artistConflicts.filter(c => c.resolved).length + 
		                   venueConflicts.filter(c => c.resolved).length
	}

	function openArtistModal(conflict: any) {
		selectedConflict = conflict
		showArtistModal = true
	}

	function openVenueModal(conflict: any) {
		selectedConflict = conflict
		showVenueModal = true
	}

	function handleArtistSelected(artistId: string) {
		if (selectedConflict) {
			// Update the conflict resolution
			resolutions[`artist_${selectedConflict.row}`] = artistId
			selectedConflict.resolved = true
			selectedConflict.selectedArtistId = artistId
			
			// Update the conflicts array
			artistConflicts = [...artistConflicts]
			updateResolvedCount()
		}
		showArtistModal = false
		selectedConflict = null
	}

	function handleVenueSelected(venueId: number | null) {
		if (selectedConflict) {
			if (venueId) {
				resolutions[`venue_${selectedConflict.row}`] = { action: 'map', venueId }
				selectedConflict.resolved = true
				selectedConflict.resolution = 'mapped'
				selectedConflict.selectedVenueId = venueId
			} else {
				resolutions[`venue_${selectedConflict.row}`] = { action: 'skip' }
				selectedConflict.resolved = true
				selectedConflict.resolution = 'skip'
			}
			
			// Update the conflicts array
			venueConflicts = [...venueConflicts]
			updateResolvedCount()
		}
		showVenueModal = false
		selectedConflict = null
	}

	function undoResolution(conflict: any, type: 'artist' | 'venue') {
		conflict.resolved = false
		delete resolutions[`${type}_${conflict.row}`]
		
		if (type === 'artist') {
			delete conflict.selectedArtistId
			artistConflicts = [...artistConflicts]
		} else {
			delete conflict.resolution
			delete conflict.selectedVenueId
			venueConflicts = [...venueConflicts]
		}
		updateResolvedCount()
	}

	async function proceedWithResolutions() {
		isProcessing = true
		
		// Apply resolutions to CSV data
		const resolvedData = csvData.map((row, index) => {
			const rowNumber = index + 1
			const resolvedRow = { ...row }
			
			// Apply artist resolutions
			const artistResolution = resolutions[`artist_${rowNumber}`]
			if (artistResolution) {
				// This would be handled in the transformation step
				resolvedRow._artistId = artistResolution
			}
			
			// Apply venue resolutions
			const venueResolution = resolutions[`venue_${rowNumber}`]
			if (venueResolution) {
				if (venueResolution.action === 'map' && venueResolution.venueId) {
					// Override the venue mapping with the selected venue ID
					resolvedRow._mappedVenueId = venueResolution.venueId
				}
				resolvedRow._venueResolution = venueResolution
			}
			
			return resolvedRow
		})

		try {
			await onConflictsResolved(resolutions)
		} catch (error) {
			console.error('Failed to apply resolutions:', error)
		} finally {
			isProcessing = false
		}
	}

	function skipAllVenues() {
		for (const conflict of venueConflicts) {
			if (!conflict.resolved) {
				resolutions[`venue_${conflict.row}`] = { action: 'skip' }
				conflict.resolved = true
				conflict.resolution = 'skip'
			}
		}
		venueConflicts = [...venueConflicts]
		updateResolvedCount()
	}

	// Calculate progress
	let progress = $derived(totalConflicts > 0 ? (resolvedConflicts / totalConflicts) * 100 : 100);
	let canProceed = $derived(totalConflicts === 0 || resolvedConflicts === totalConflicts);
</script>

<div class="space-y-6">
	<!-- Progress Summary -->
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<h3 class="card-title text-lg mb-4">Conflict Resolution Progress</h3>
			
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
				<div class="stat bg-base-200 rounded-lg">
					<div class="stat-title text-xs">Total Conflicts</div>
					<div class="stat-value text-lg">{totalConflicts}</div>
				</div>
				<div class="stat bg-base-200 rounded-lg">
					<div class="stat-title text-xs">Resolved</div>
					<div class="stat-value text-lg text-success">{resolvedConflicts}</div>
				</div>
				<div class="stat bg-base-200 rounded-lg">
					<div class="stat-title text-xs">Remaining</div>
					<div class="stat-value text-lg text-warning">{totalConflicts - resolvedConflicts}</div>
				</div>
			</div>

			{#if totalConflicts > 0}
				<div class="w-full bg-base-300 rounded-full h-2 mb-4">
					<div class="bg-primary h-2 rounded-full transition-all duration-300" 
						 style="width: {progress}%"></div>
				</div>
				<p class="text-sm text-base-content/60">
					{resolvedConflicts} of {totalConflicts} conflicts resolved ({progress.toFixed(1)}%)
				</p>
			{:else}
				<div class="alert alert-success">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>No conflicts detected! Your data is ready for import.</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- Artist Conflicts -->
	{#if artistConflicts.length > 0}
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<div class="flex justify-between items-center mb-4">
					<h3 class="card-title text-lg">Artist Name Conflicts</h3>
					<span class="badge badge-warning">
						{artistConflicts.filter(c => !c.resolved).length} unresolved
					</span>
				</div>
				<p class="text-sm text-base-content/60 mb-4">
					These artist names were not found in the system. Please select the correct artist or create a new one.
				</p>
				
				<div class="space-y-3">
					{#each artistConflicts as conflict}
						<div class="border rounded-lg p-4 {conflict.resolved ? 'bg-success/10 border-success' : 'bg-warning/10 border-warning'}">
							<div class="flex justify-between items-start">
								<div class="flex-1">
									<div class="flex items-center mb-2">
										<span class="badge badge-sm mr-2">Row {conflict.row}</span>
										<span class="font-medium">"{conflict.value}"</span>
										{#if conflict.resolved}
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-2 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
										{/if}
									</div>
									{#if conflict.suggestions.length > 0}
										<div class="text-sm text-base-content/60">
											Suggestions: {conflict.suggestions.slice(0, 3).join(', ')}
											{#if conflict.suggestions.length > 3}
												and {conflict.suggestions.length - 3} more...
											{/if}
										</div>
									{:else}
										<div class="text-sm text-base-content/60">No similar artists found</div>
									{/if}
								</div>
								<div class="flex space-x-2">
									{#if conflict.resolved}
										<button 
											class="btn btn-ghost btn-sm"
											onclick={() => undoResolution(conflict, 'artist')}
										>
											Undo
										</button>
									{:else}
										<button 
											class="btn btn-primary btn-sm"
											onclick={() => openArtistModal(conflict)}
										>
											Resolve
										</button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Venue Conflicts -->
	{#if venueConflicts.length > 0}
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<div class="flex justify-between items-center mb-4">
					<h3 class="card-title text-lg">Venue Conflicts</h3>
					<div class="flex items-center space-x-2">
						<span class="badge badge-warning">
							{venueConflicts.filter(c => !c.resolved).length} unresolved
						</span>
						{#if venueConflicts.some(c => !c.resolved)}
							<button 
								class="btn btn-outline btn-sm"
								onclick={skipAllVenues}
							>
								Skip All
							</button>
						{/if}
					</div>
				</div>
				<p class="text-sm text-base-content/60 mb-4">
					These venues were not found in the system. You can map them to existing venues or skip venue assignment.
				</p>
				
				<div class="space-y-3">
					{#each venueConflicts as conflict}
						<div class="border rounded-lg p-4 {conflict.resolved ? 'bg-success/10 border-success' : 'bg-warning/10 border-warning'}">
							<div class="flex justify-between items-start">
								<div class="flex-1">
									<div class="flex items-center mb-2">
										<span class="badge badge-sm mr-2">Row {conflict.row}</span>
										<span class="font-medium">"{conflict.value}"</span>
										{#if conflict.resolved}
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-2 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
											<span class="text-sm text-success ml-1">
												({conflict.resolution === 'mapped' ? 'Mapped' : 'Skipped'})
											</span>
										{/if}
									</div>
								</div>
								<div class="flex space-x-2">
									{#if conflict.resolved}
										<button 
											class="btn btn-ghost btn-sm"
											onclick={() => undoResolution(conflict, 'venue')}
										>
											Undo
										</button>
									{:else}
										<button 
											class="btn btn-primary btn-sm"
											onclick={() => openVenueModal(conflict)}
										>
											Resolve
										</button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Data Errors -->
	{#if dataErrors.length > 0}
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<h3 class="card-title text-lg mb-4">Data Errors</h3>
				<p class="text-sm text-base-content/60 mb-4">
					These data validation errors must be fixed in your CSV file before proceeding.
				</p>
				
				<div class="space-y-2">
					{#each dataErrors.slice(0, 10) as error}
						<div class="alert alert-error py-2">
							<span class="text-sm">
								<strong>Row {error.row}, Field {error.field}:</strong> {error.message}
							</span>
						</div>
					{/each}
					{#if dataErrors.length > 10}
						<div class="text-sm text-base-content/60 text-center">
							... and {dataErrors.length - 10} more errors
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Import Summary -->
	{#if canProceed}
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<h3 class="card-title text-lg mb-4">Ready for Import</h3>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span>Total rows to import:</span>
						<span class="font-medium">{csvData.length}</span>
					</div>
					<div class="flex justify-between">
						<span>Artist conflicts resolved:</span>
						<span class="font-medium">{artistConflicts.filter(c => c.resolved).length}</span>
					</div>
					<div class="flex justify-between">
						<span>Venue conflicts resolved:</span>
						<span class="font-medium">{venueConflicts.filter(c => c.resolved).length}</span>
					</div>
					<div class="flex justify-between">
						<span>Venues mapped:</span>
						<span class="font-medium">
							{venueConflicts.filter(c => c.resolved && c.resolution === 'mapped').length}
						</span>
					</div>
				</div>
				
				<div class="flex justify-end mt-6">
					<button 
						class="btn btn-primary"
						onclick={proceedWithResolutions}
						disabled={isProcessing}
					>
						{#if isProcessing}
							<LoadingSpinner size="sm" />
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
							</svg>
						{/if}
						Start Import Process
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Artist Mapping Modal -->
{#if showArtistModal && selectedConflict}
	<ArtistMappingModal
		conflict={selectedConflict}
		onArtistSelected={handleArtistSelected}
		onCancel={() => { showArtistModal = false; selectedConflict = null }}
	/>
{/if}

<!-- Venue Mapping Modal -->
{#if showVenueModal && selectedConflict}
	<VenueMappingModal
		conflict={selectedConflict}
		onVenueSelected={handleVenueSelected}
		onCancel={() => { showVenueModal = false; selectedConflict = null }}
	/>
{/if}