<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { toast } from '$lib/stores/toast'
	import type { Payroll } from '$lib/schemas/payroll'

	interface Props {
		selectedCount: number
		selectedEntries: number[]
		payrollData?: Payroll[]
	}

	let {
		selectedCount = 0,
		selectedEntries = [],
		payrollData = []
	}: Props = $props()

	const dispatch = createEventDispatcher<{
		bulkAction: {
			action: string
			entryIds: number[]
		}
	}>()

	// Handle bulk actions
	function handleAction(action: string) {
		if (selectedEntries.length === 0) return

		let confirmMessage = ''
		switch (action) {
			case 'markPaid':
				confirmMessage = `Mark ${selectedCount} entries as paid?`
				break
			case 'markUnpaid':
				confirmMessage = `Mark ${selectedCount} entries as unpaid?`
				break
			case 'approve':
				confirmMessage = `Approve ${selectedCount} entries for payment?`
				break
			case 'delete':
				confirmMessage = `Delete ${selectedCount} entries? This action cannot be undone.`
				break
			default:
				return
		}

		if (confirm(confirmMessage)) {
			dispatch('bulkAction', { action, entryIds: selectedEntries })
		}
	}

	// Get selected payroll entries
	function getSelectedEntries(): Payroll[] {
		return payrollData.filter(p => selectedEntries.includes(p.id!))
	}

	// Export to CSV
	function exportToCSV() {
		const entries = getSelectedEntries()
		if (entries.length === 0) {
			toast.warning('No entries selected for export')
			return
		}

		const headers = ['Date', 'Artist', 'Venue', 'Hours', 'Rate', 'Additional Pay', 'Total Pay', 'Status', 'Payment Type', 'Notes']
		const rows = entries.map(e => [
			e.event_date,
			e.artists?.full_name || e.artists?.legal_first_name ? `${e.artists?.legal_first_name} ${e.artists?.legal_last_name}` : 'N/A',
			e.venues?.name || '',
			e.hours?.toString() || '0',
			e.rate?.toString() || '0',
			e.additional_pay?.toString() || '0',
			e.total_pay?.toString() || '0',
			e.status || '',
			e.payment_type || '',
			e.notes || ''
		])

		const csvContent = [headers, ...rows]
			.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
			.join('\n')

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
		const link = document.createElement('a')
		const url = URL.createObjectURL(blob)
		link.setAttribute('href', url)
		link.setAttribute('download', `payroll_export_${new Date().toISOString().split('T')[0]}.csv`)
		link.style.visibility = 'hidden'
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)

		toast.success(`Exported ${entries.length} entries to CSV`)
	}

	// Export to Excel (uses CSV for compatibility)
	function exportToExcel() {
		const entries = getSelectedEntries()
		if (entries.length === 0) {
			toast.warning('No entries selected for export')
			return
		}

		const headers = ['Date', 'Artist', 'Venue', 'Hours', 'Rate', 'Additional Pay', 'Total Pay', 'Status', 'Payment Type', 'Notes']
		const rows = entries.map(e => [
			e.event_date,
			e.artists?.full_name || e.artists?.legal_first_name ? `${e.artists?.legal_first_name} ${e.artists?.legal_last_name}` : 'N/A',
			e.venues?.name || '',
			e.hours?.toString() || '0',
			e.rate?.toString() || '0',
			e.additional_pay?.toString() || '0',
			e.total_pay?.toString() || '0',
			e.status || '',
			e.payment_type || '',
			e.notes || ''
		])

		// Tab-separated for Excel compatibility
		const xlsContent = [headers, ...rows]
			.map(row => row.join('\t'))
			.join('\n')

		const blob = new Blob([xlsContent], { type: 'application/vnd.ms-excel' })
		const link = document.createElement('a')
		const url = URL.createObjectURL(blob)
		link.setAttribute('href', url)
		link.setAttribute('download', `payroll_export_${new Date().toISOString().split('T')[0]}.xls`)
		link.style.visibility = 'hidden'
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)

		toast.success(`Exported ${entries.length} entries to Excel`)
	}

	// Print report
	function printReport() {
		const entries = getSelectedEntries()
		if (entries.length === 0) {
			toast.warning('No entries selected for printing')
			return
		}

		const totalAmount = entries.reduce((sum, e) => sum + (e.total_pay || 0), 0)
		const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

		const printContent = `
			<html>
			<head>
				<title>Payroll Report</title>
				<style>
					body { font-family: Arial, sans-serif; padding: 20px; }
					h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
					table { width: 100%; border-collapse: collapse; margin-top: 20px; }
					th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
					th { background-color: #f5f5f5; }
					.total { font-weight: bold; text-align: right; margin-top: 20px; font-size: 1.2em; }
				</style>
			</head>
			<body>
				<h1>Payroll Report</h1>
				<p>Generated: ${new Date().toLocaleString()}</p>
				<table>
					<thead>
						<tr>
							<th>Date</th>
							<th>Artist</th>
							<th>Venue</th>
							<th>Duration</th>
							<th>Rate</th>
							<th>Total</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						${entries.map(e => `
							<tr>
								<td>${e.event_date}</td>
								<td>${e.artists?.full_name || (e.artists?.legal_first_name ? `${e.artists.legal_first_name} ${e.artists.legal_last_name}` : 'N/A')}</td>
								<td>${e.venues?.name || '-'}</td>
								<td>${e.hours || 0}</td>
								<td>${formatCurrency(e.rate || 0)}</td>
								<td>${formatCurrency(e.total_pay || 0)}</td>
								<td>${e.status || '-'}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
				<div class="total">Total: ${formatCurrency(totalAmount)}</div>
			</body>
			</html>
		`

		const printWindow = window.open('', '_blank')
		if (printWindow) {
			printWindow.document.write(printContent)
			printWindow.document.close()
			printWindow.print()
		}
	}
</script>

<div class="card bg-base-100 shadow-sm border border-primary/20">
	<div class="card-body p-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="flex items-center gap-2">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span class="font-medium">
						{selectedCount} {selectedCount === 1 ? 'entry' : 'entries'} selected
					</span>
				</div>
			</div>

			<div class="flex items-center gap-2">
				<!-- Payment Actions -->
				<div class="dropdown dropdown-end">
					<div tabindex="0" role="button" class="btn btn-sm btn-outline">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
						</svg>
						Payment Actions
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</div>
					<ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-56 z-10">
						<li>
							<button onclick={() => handleAction('approve')} class="flex items-center gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								Approve for Payment
							</button>
						</li>
						<li>
							<button onclick={() => handleAction('markPaid')} class="flex items-center gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
								</svg>
								Mark as Paid
							</button>
						</li>
						<li>
							<button onclick={() => handleAction('markUnpaid')} class="flex items-center gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.182 16.5c-.77.833.192 2.5 1.732 2.5z" />
								</svg>
								Mark as Unpaid
							</button>
						</li>
					</ul>
				</div>

				<!-- Export Actions -->
				<div class="dropdown dropdown-end">
					<div tabindex="0" role="button" class="btn btn-sm btn-ghost">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						Export
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</div>
					<ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-48 z-10">
						<li>
							<button onclick={exportToCSV} class="flex items-center gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								Export to CSV
							</button>
						</li>
						<li>
							<button onclick={exportToExcel} class="flex items-center gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								Export to Excel
							</button>
						</li>
						<li>
							<button onclick={printReport} class="flex items-center gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
								</svg>
								Print Report
							</button>
						</li>
					</ul>
				</div>

				<!-- Delete Action -->
				<button 
					class="btn btn-sm btn-error btn-outline"
					onclick={() => handleAction('delete')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
					</svg>
					Delete
				</button>
			</div>
		</div>

		<!-- Action summary -->
		<div class="text-sm text-base-content/60 mt-2">
			Select bulk actions to perform on {selectedCount} selected {selectedCount === 1 ? 'entry' : 'entries'}
		</div>
	</div>
</div>