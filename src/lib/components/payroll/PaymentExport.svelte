<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { payrollStore } from '$lib/stores/payroll'
	import { user } from '$lib/auth'
	import { PaymentStatus, PaymentMethod } from '$lib/schemas/payroll'
	import { AuditAction } from '$lib/schemas/payroll-audit'

	export let isOpen: boolean = false

	const dispatch = createEventDispatcher<{
		exported: { format: string, count: number }
		close: void
	}>()

	let exportFormat: 'csv' | 'excel' | 'json' | 'insperity' = 'csv'
	let includeFields = {
		basic: true,
		payment: true,
		audit: false,
		artist: true,
		venue: false
	}
	let filters = {
		status: [] as string[],
		dateFrom: '',
		dateTo: '',
		paymentMethod: [] as string[]
	}
	let isLoading = false
	let previewData: any[] = []
	let showPreview = false

	const statusOptions = Object.values(PaymentStatus)
	const methodOptions = Object.values(PaymentMethod)

	async function handleExport() {
		if (!$user) return

		isLoading = true
		try {
			const data = await payrollStore.exportPayments(filters)
			
			if (data.length === 0) {
				alert('No payments found matching the current filters.')
				return
			}

			const processedData = processExportData(data)
			const filename = generateFilename()

			switch (exportFormat) {
				case 'csv':
					downloadCSV(processedData, filename)
					break
				case 'excel':
					downloadExcel(processedData, filename)
					break
				case 'json':
					downloadJSON(processedData, filename)
					break
				case 'insperity':
					downloadInsperity(data, filename)
					break
			}

			// Create audit log
			await payrollStore.createAuditLog({
				payroll_id: 0, // General export action
				user_id: $user.id,
				action: AuditAction.EXPORT,
				notes: `Exported ${data.length} payments as ${exportFormat.toUpperCase()}`
			})

			dispatch('exported', { format: exportFormat, count: data.length })
			handleClose()
		} catch (error) {
			console.error('Export failed:', error)
			alert('Export failed. Please try again.')
		} finally {
			isLoading = false
		}
	}

	async function generatePreview() {
		try {
			const data = await payrollStore.exportPayments(filters)
			previewData = processExportData(data.slice(0, 5)) // Show first 5 rows
			showPreview = true
		} catch (error) {
			console.error('Preview failed:', error)
		}
	}

	function processExportData(data: any[]) {
		return data.map(payment => {
			const row: any = {}

			if (includeFields.basic) {
				row.id = payment.id
				row.event_date = payment.event_date
				row.hours = payment.hours
				row.rate = payment.rate
				row.additional_pay = payment.additional_pay
				row.additional_pay_reason = payment.additional_pay_reason
				row.total_pay = payment.total_pay
				row.status = payment.status
			}

			if (includeFields.payment) {
				row.payment_method = payment.payment_method
				row.payment_reference = payment.payment_reference
				row.external_payment_id = payment.external_payment_id
				row.batch_id = payment.batch_id
				row.paid_date = payment.paid_date
				row.reconciled = payment.reconciled
				row.reconciled_at = payment.reconciled_at
			}

			if (includeFields.artist && payment.artists) {
				row.artist_name = payment.artists.full_name || (payment.artists.legal_first_name + ' ' + payment.artists.legal_last_name)
				row.artist_first_name = payment.artists.legal_first_name
				row.artist_last_name = payment.artists.legal_last_name
				row.artist_email = payment.artists.email
			}

			if (includeFields.venue && payment.venues) {
				row.venue_name = payment.venues.name
			}

			if (includeFields.audit) {
				row.approved_at = payment.approved_at
				row.processed_at = payment.processed_at
				row.created_at = payment.created_at
			}

			return row
		})
	}

	function generateFilename(): string {
		const timestamp = new Date().toISOString().split('T')[0]
		const statusSuffix = filters.status.length > 0 ? `_${filters.status.join('-')}` : ''
		return `phwb_payments_${timestamp}${statusSuffix}`
	}

	function downloadCSV(data: any[], filename: string) {
		if (data.length === 0) return

		const headers = Object.keys(data[0])
		const csvContent = [
			headers.join(','),
			...data.map(row => 
				headers.map(header => {
					const value = (row as any)[header]
					// Escape commas and quotes in CSV
					if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
						return `"${value.replace(/"/g, '""')}"`
					}
					return value ?? ''
				}).join(',')
			)
		].join('\n')

		downloadFile(csvContent, `${filename}.csv`, 'text/csv')
	}

	function downloadExcel(data: any[], filename: string) {
		// For Excel, we'll create a CSV with UTF-8 BOM for better Excel compatibility
		const csvContent = '\uFEFF' + convertToCSV(data)
		downloadFile(csvContent, `${filename}.csv`, 'text/csv')
	}

	function downloadJSON(data: any[], filename: string) {
		const jsonContent = JSON.stringify(data, null, 2)
		downloadFile(jsonContent, `${filename}.json`, 'application/json')
	}

	function convertToCSV(data: any[]): string {
		if (data.length === 0) return ''
		
		const headers = Object.keys(data[0])
		return [
			headers.join(','),
			...data.map(row => 
				headers.map(header => row[header] ?? '').join(',')
			)
		].join('\n')
	}

	function downloadInsperity(data: any[], filename: string) {
		// Insperity-specific CSV format with required columns
		const insperityData = data.map(payment => ({
			'Employee ID': payment.artist_id || '',
			'Employee Name': payment.artists ? (payment.artists.full_name || `${payment.artists.legal_first_name} ${payment.artists.legal_last_name}`) : '',
			'Pay Period Start': payment.event_date,
			'Pay Period End': payment.event_date,
			'Hours': payment.hours || 0,
			'Rate': payment.rate || 0,
			'Gross Pay': payment.total_pay || 0,
			'Pay Code': payment.payment_type === 'performance' ? 'REG' : 'OTH',
			'Department': 'ARTS',
			'Cost Center': payment.venues?.name || 'DEFAULT',
			'Reference': payment.payment_reference || payment.batch_id || '',
			'Earnings Type': payment.employee_contractor_status === 'employee' ? 'Salary' : 'Contract',
			'Additional Pay': payment.additional_pay || 0,
			'Additional Pay Reason': payment.additional_pay_reason || '',
			'Check Date': payment.paid_date || '',
			'Status': payment.status
		}))

		const headers = Object.keys(insperityData[0] || {})
		const csvContent = [
			headers.join(','),
			...insperityData.map(row => 
				headers.map(header => {
					const value = (row as any)[header]
					// Escape commas and quotes in CSV
					if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
						return `"${value.replace(/"/g, '""')}"`
					}
					return value ?? ''
				}).join(',')
			)
		].join('\n')

		downloadFile(csvContent, `${filename}_insperity.csv`, 'text/csv')
	}

	function downloadFile(content: string, filename: string, mimeType: string) {
		const blob = new Blob([content], { type: mimeType })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	function handleClose() {
		showPreview = false
		previewData = []
		dispatch('close')
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount)
	}
</script>

{#if isOpen}
	<div class="modal modal-open">
		<div class="modal-box w-11/12 max-w-6xl">
			<div class="flex items-center justify-between mb-6">
				<h3 class="font-bold text-lg">Export Payments</h3>
				<button class="btn btn-sm btn-circle btn-ghost" on:click={handleClose}>✕</button>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Export Configuration -->
				<div class="space-y-6">
					<!-- Format Selection -->
					<div class="card bg-base-100 border border-base-300">
						<div class="card-body">
							<h4 class="card-title text-base">Export Format</h4>
							<div class="form-control">
								<label class="label cursor-pointer">
									<span class="label-text">CSV (Comma Separated)</span>
									<input type="radio" name="format" class="radio radio-primary" bind:group={exportFormat} value="csv" />
								</label>
							</div>
							<div class="form-control">
								<label class="label cursor-pointer">
									<span class="label-text">Excel Compatible CSV</span>
									<input type="radio" name="format" class="radio radio-primary" bind:group={exportFormat} value="excel" />
								</label>
							</div>
							<div class="form-control">
								<label class="label cursor-pointer">
									<span class="label-text">JSON</span>
									<input type="radio" name="format" class="radio radio-primary" bind:group={exportFormat} value="json" />
								</label>
							</div>
							<div class="form-control">
								<label class="label cursor-pointer">
									<span class="label-text">Insperity Format</span>
									<input type="radio" name="format" class="radio radio-accent" bind:group={exportFormat} value="insperity" />
								</label>
							</div>
						</div>
					</div>

					<!-- Field Selection -->
					<div class="card bg-base-100 border border-base-300">
						<div class="card-body">
							<h4 class="card-title text-base">Include Fields</h4>
							<div class="space-y-2">
								<label class="label cursor-pointer">
									<span class="label-text">Basic Payment Info</span>
									<input type="checkbox" class="checkbox checkbox-primary" bind:checked={includeFields.basic} />
								</label>
								<label class="label cursor-pointer">
									<span class="label-text">Payment Processing Details</span>
									<input type="checkbox" class="checkbox checkbox-primary" bind:checked={includeFields.payment} />
								</label>
								<label class="label cursor-pointer">
									<span class="label-text">Artist Information</span>
									<input type="checkbox" class="checkbox checkbox-primary" bind:checked={includeFields.artist} />
								</label>
								<label class="label cursor-pointer">
									<span class="label-text">Venue Information</span>
									<input type="checkbox" class="checkbox checkbox-primary" bind:checked={includeFields.venue} />
								</label>
								<label class="label cursor-pointer">
									<span class="label-text">Audit Timestamps</span>
									<input type="checkbox" class="checkbox checkbox-primary" bind:checked={includeFields.audit} />
								</label>
							</div>
						</div>
					</div>
				</div>

				<!-- Filters -->
				<div class="space-y-6">
					<!-- Status Filter -->
					<div class="card bg-base-100 border border-base-300">
						<div class="card-body">
							<h4 class="card-title text-base">Filter by Status</h4>
							<div class="grid grid-cols-2 gap-2">
								{#each statusOptions as status}
									<label class="label cursor-pointer">
										<span class="label-text text-sm">{status}</span>
										<input 
											type="checkbox" 
											class="checkbox checkbox-sm checkbox-primary" 
											bind:group={filters.status}
											value={status}
										/>
									</label>
								{/each}
							</div>
						</div>
					</div>

					<!-- Date Range Filter -->
					<div class="card bg-base-100 border border-base-300">
						<div class="card-body">
							<h4 class="card-title text-base">Date Range</h4>
							<div class="grid grid-cols-2 gap-4">
								<div class="form-control">
									<label class="label" for="date-from">
										<span class="label-text text-sm">From Date</span>
									</label>
									<input
										id="date-from"
										type="date"
										class="input input-bordered input-sm"
										bind:value={filters.dateFrom}
									/>
								</div>
								<div class="form-control">
									<label class="label" for="date-to">
										<span class="label-text text-sm">To Date</span>
									</label>
									<input
										id="date-to"
										type="date"
										class="input input-bordered input-sm"
										bind:value={filters.dateTo}
									/>
								</div>
							</div>
						</div>
					</div>

					<!-- Payment Method Filter -->
					<div class="card bg-base-100 border border-base-300">
						<div class="card-body">
							<h4 class="card-title text-base">Payment Methods</h4>
							<div class="space-y-1">
								{#each methodOptions as method}
									<label class="label cursor-pointer">
										<span class="label-text text-sm capitalize">{method.replace('_', ' ')}</span>
										<input 
											type="checkbox" 
											class="checkbox checkbox-sm checkbox-primary" 
											bind:group={filters.paymentMethod}
											value={method}
										/>
									</label>
								{/each}
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Preview Section -->
			{#if showPreview && previewData.length > 0}
				<div class="divider">Preview (First 5 rows)</div>
				<div class="overflow-x-auto bg-base-200 p-4 rounded-lg mb-4">
					<table class="table table-xs">
						<thead>
							<tr>
								{#each Object.keys(previewData[0]) as header}
									<th class="text-xs">{header}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each previewData as row}
								<tr>
									{#each Object.values(row) as value}
										<td class="text-xs">{value}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<!-- Actions -->
			<div class="modal-action">
				<button class="btn btn-ghost" on:click={handleClose} disabled={isLoading}>
					Cancel
				</button>
				<button class="btn btn-info" on:click={generatePreview} disabled={isLoading}>
					Preview
				</button>
				<button
					class="btn btn-primary"
					on:click={handleExport}
					disabled={isLoading}
				>
					{#if isLoading}
						<span class="loading loading-spinner loading-sm"></span>
						Exporting...
					{:else}
						Export {exportFormat.toUpperCase()}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}