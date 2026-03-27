<script lang="ts">
	import { goto } from '$app/navigation'
	import {
		generateArtistCSVTemplate,
		parseArtistCSVFile,
		csvRowToCreateArtist,
		ARTIST_CSV_HEADERS
	} from '$lib/services/artist-export'
	import { downloadCSV } from '$lib/utils'
	import { createArtist } from '$lib/stores/artists'
	import { createArtistSchema } from '$lib/schemas/artist'
	import { ArrowLeft, Download, Upload, CheckCircle, AlertCircle } from 'lucide-svelte'

	let step = $state<'upload' | 'preview' | 'result'>('upload')
	let fileInput = $state<HTMLInputElement | null>(null)
	let selectedFile = $state<File | null>(null)
	let parsedRows = $state<Record<string, string>[]>([])
	let error = $state<string | null>(null)
	let loading = $state(false)
	let importing = $state(false)
	let result = $state<{ imported: number; failed: number; errors: string[] } | null>(null)

	function handleDownloadSample() {
		const csv = generateArtistCSVTemplate()
		downloadCSV(csv, `artists_import_template_${new Date().toISOString().slice(0, 10)}.csv`)
	}

	async function handleFileSelect(file: File) {
		if (!file?.name.toLowerCase().endsWith('.csv')) {
			error = 'Please select a CSV file.'
			return
		}
		if (file.size > 10 * 1024 * 1024) {
			error = 'File size must be less than 10MB.'
			return
		}
		error = null
		loading = true
		selectedFile = null
		parsedRows = []
		try {
			const rows = await parseArtistCSVFile(file)
			if (rows.length === 0) {
				error = 'CSV has no data rows.'
				return
			}
			selectedFile = file
			parsedRows = rows
			step = 'preview'
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to parse CSV'
		} finally {
			loading = false
		}
	}

	function handleFileInput(e: Event) {
		const target = e.target as HTMLInputElement
		const file = target.files?.[0]
		if (file) handleFileSelect(file)
	}

	function clearFile() {
		selectedFile = null
		parsedRows = []
		error = null
		step = 'upload'
		if (fileInput) (fileInput as HTMLInputElement).value = ''
	}

	async function runImport() {
		if (parsedRows.length === 0) return
		importing = true
		result = null
		const errors: string[] = []
		let imported = 0
		let failed = 0
		for (let i = 0; i < parsedRows.length; i++) {
			const row = parsedRows[i]
			const payload = csvRowToCreateArtist(row)
			if (!payload.legal_first_name || String(payload.legal_first_name).trim() === '') {
				errors.push(`Row ${i + 2}: legal first name is required`)
				failed++
				continue
			}
			try {
				const parsed = createArtistSchema.safeParse(payload)
				if (!parsed.success) {
					const msg = parsed.error.errors.map((e) => e.message).join('; ')
					errors.push(`Row ${i + 2}: ${msg}`)
					failed++
					continue
				}
				await createArtist(parsed.data)
				imported++
			} catch (e) {
				errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'Import failed'}`)
				failed++
			}
		}
		result = { imported, failed, errors }
		step = 'result'
		importing = false
	}

	function backToArtists() {
		goto('/artists')
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B'
		const k = 1024
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return `${(bytes / Math.pow(k, i)).toFixed(1)} ${['B', 'KB', 'MB'][i]}`
	}
</script>

<svelte:head>
	<title>Import Artists – PHWB</title>
</svelte:head>

<div class="container max-w-4xl mx-auto p-4 lg:p-6">
	<div class="flex items-center gap-4 mb-6">
		<button class="btn btn-ghost btn-sm btn-square" onclick={backToArtists} aria-label="Back to artists">
			<ArrowLeft class="h-5 w-5" />
		</button>
		<h1 class="text-2xl font-bold">Import Artists from CSV</h1>
	</div>

	{#if step === 'upload'}
		<div class="card bg-base-100 border border-base-300 shadow-sm">
			<div class="card-body">
				<p class="text-base-content/70 mb-4">
					Upload a CSV file with artist data. Use the same columns as the export template so data maps correctly.
					<strong>legal_first_name</strong> is required for each row.
				</p>
				<div class="flex flex-wrap gap-3 mb-4">
					<button type="button" class="btn btn-outline btn-sm" onclick={handleDownloadSample}>
						<Download class="h-4 w-4 mr-2" />
						Download sample CSV
					</button>
				</div>
				<label class="flex flex-col gap-2">
					<span class="font-medium text-sm">Choose file</span>
					<input
						type="file"
						accept=".csv"
						class="file-input file-input-bordered w-full max-w-md"
						bind:this={fileInput}
						onchange={handleFileInput}
						disabled={loading}
					/>
				</label>
				{#if loading}
					<p class="text-sm text-base-content/60">Parsing CSV…</p>
				{/if}
				{#if error}
					<div class="alert alert-warning mt-2">
						<AlertCircle class="h-5 w-5" />
						<span>{error}</span>
					</div>
				{/if}
			</div>
		</div>
	{:else if step === 'preview'}
		<div class="card bg-base-100 border border-base-300 shadow-sm">
			<div class="card-body">
				<div class="flex flex-wrap items-center justify-between gap-4 mb-4">
					<div>
						<p class="font-medium">{selectedFile?.name}</p>
						<p class="text-sm text-base-content/60">
							{parsedRows.length} row{parsedRows.length === 1 ? '' : 's'}
							{#if selectedFile}
								· {formatFileSize(selectedFile.size)}
							{/if}
						</p>
					</div>
					<div class="flex gap-2">
						<button class="btn btn-ghost btn-sm" onclick={clearFile}>Change file</button>
						<button
							class="btn btn-primary"
							onclick={runImport}
							disabled={importing || parsedRows.length === 0}
						>
							{#if importing}
								<span class="loading loading-spinner loading-sm"></span>
								Importing…
							{:else}
								Import {parsedRows.length} artist{parsedRows.length === 1 ? '' : 's'}
							{/if}
						</button>
					</div>
				</div>
				<div class="overflow-x-auto max-h-80 overflow-y-auto rounded-lg border border-base-300">
					<table class="table table-pin-rows table-xs">
						<thead>
							<tr>
								<th class="bg-base-200 sticky top-0">#</th>
								{#each ARTIST_CSV_HEADERS.slice(0, 10) as h}
									<th class="bg-base-200 sticky top-0 whitespace-nowrap">{h}</th>
								{/each}
								<th class="bg-base-200 sticky top-0">…</th>
							</tr>
						</thead>
						<tbody>
							{#each parsedRows.slice(0, 20) as row, i}
								<tr>
									<td class="font-mono text-base-content/60">{i + 1}</td>
									{#each ARTIST_CSV_HEADERS.slice(0, 10) as h}
										<td class="max-w-[12rem] truncate" title={(row[h] ?? '')}>
											{row[h] ?? '—'}
										</td>
									{/each}
									<td class="text-base-content/50">…</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if parsedRows.length > 20}
					<p class="text-sm text-base-content/60 mt-2">Showing first 20 of {parsedRows.length} rows.</p>
				{/if}
			</div>
		</div>
	{:else if step === 'result' && result}
		<div class="card bg-base-100 border border-base-300 shadow-sm">
			<div class="card-body">
				<div class="flex items-center gap-2 text-lg font-semibold mb-2">
					<CheckCircle class="h-6 w-6 text-success" />
					Import complete
				</div>
				<p class="text-base-content/70 mb-4">
					Imported <strong>{result.imported}</strong> artist{result.imported === 1 ? '' : 's'}.
					{#if result.failed > 0}
						<strong>{result.failed}</strong> row{result.failed === 1 ? '' : 's'} failed.
					{/if}
				</p>
				{#if result.errors.length > 0}
					<details class="bg-base-200 rounded-lg p-3">
						<summary class="cursor-pointer font-medium text-sm">View errors ({result.errors.length})</summary>
						<ul class="mt-2 text-sm text-error space-y-1 max-h-40 overflow-y-auto">
							{#each result.errors as err}
								<li>{err}</li>
							{/each}
						</ul>
					</details>
				{/if}
				<div class="flex gap-2 mt-4">
					<button class="btn btn-primary" onclick={backToArtists}>Back to Artists</button>
					<button class="btn btn-ghost" onclick={() => { step = 'upload'; clearFile() }}>Import another file</button>
				</div>
			</div>
		</div>
	{/if}
</div>
