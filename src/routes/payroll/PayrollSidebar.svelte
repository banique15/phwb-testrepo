<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { createPayrollSchema, type Payroll, type CreatePayroll, PaymentType, EmployeeContractorStatus } from '$lib/schemas/payroll'
	import FormField from '$lib/components/ui/FormField.svelte'
	import ArtistSelector from '$lib/components/ui/ArtistSelector.svelte'
	import VenueSelector from '$lib/components/ui/VenueSelector.svelte'
	import EventSelector from '$lib/components/ui/EventSelector.svelte'
	import { toast } from '$lib/stores/toast'
	import { z } from 'zod'

	interface Props {
		open?: boolean
		entry?: Payroll | null
	}

	let { open = false, entry = null }: Props = $props()

	const dispatch = createEventDispatcher<{
		submit: { entry: CreatePayroll }
		close: void
		delete: { entry: Payroll }
	}>()

	// Form state
	let formData = $state({
		event_date: '',
		artist_id: '',
		venue_id: undefined as number | undefined,
		event_id: undefined as number | undefined,
		hours: 0,
		rate: 0,
		additional_pay: 0,
		additional_pay_reason: '',
		status: 'Planned' as 'Planned' | 'Approved' | 'Paid' | 'Completed' | 'Cancelled',
		payment_type: undefined as 'performance' | 'training' | 'special_event' | 'other' | undefined,
		employee_contractor_status: undefined as 'employee' | 'contractor' | 'roster_artist' | undefined,
		invoice_number: '',
		notes: '',
		rate_description: '',
		insperity_hours: undefined as number | undefined,
		paid_date: undefined as string | undefined
	})

	let errors = $state<Record<string, string>>({})
	let isSubmitting = $state(false)

	// Calculate total pay (using the same logic as the table)
	let totalPay = $derived.by(() => {
		// If we have a pre-calculated total_pay from the entry, use it
		if (entry?.total_pay) {
			return entry.total_pay
		}
		// Otherwise calculate it from form data
		const hours = Number(formData.hours) || 0
		const rate = Number(formData.rate) || 0
		const additionalPay = Number(formData.additional_pay) || 0
		return (hours * rate) + additionalPay
	})

	// Initialize form with entry data if editing
	$effect(() => {
		if (entry) {
			formData = {
				event_date: entry.event_date || '',
				artist_id: entry.artist_id || '',
				venue_id: entry.venue_id || undefined,
				event_id: entry.event_id || undefined,
				hours: Number(entry.hours) || 0,
				rate: Number(entry.rate || entry.base_rate) || 0,
				additional_pay: Number(String(entry.additional_pay || entry.additional_rate || 0).replace(/[$,]/g, '')) || 0,
				additional_pay_reason: entry.additional_pay_reason || '',
				status: entry.status || 'Planned',
				payment_type: entry.payment_type || undefined,
				employee_contractor_status: entry.employee_contractor_status || undefined,
				invoice_number: entry.invoice_number || '',
				notes: entry.notes || '',
				rate_description: entry.rate_description || '',
				insperity_hours: entry.insperity_hours || undefined,
				paid_date: entry.paid_date || undefined
			}
		} else {
			// Reset form for new entry
			formData = {
				event_date: '',
				artist_id: '',
				venue_id: undefined,
				event_id: undefined,
				hours: 0,
				rate: 0,
				additional_pay: 0,
				additional_pay_reason: '',
				status: 'Planned',
				payment_type: undefined,
				employee_contractor_status: undefined,
				invoice_number: '',
				notes: '',
				rate_description: '',
				insperity_hours: undefined,
				paid_date: undefined
			}
		}
		errors = {}
	})

	// Status options
	const statusOptions = [
		{ value: 'Planned', label: 'Planned' },
		{ value: 'Unpaid', label: 'Unpaid' },
		{ value: 'Paid', label: 'Paid' },
		{ value: 'Cancelled', label: 'Cancelled' }
	]

	// Payment type options
	const paymentTypeOptions = [
		{ value: '', label: 'Select payment type...' },
		{ value: PaymentType.PERFORMANCE, label: 'Performance' },
		{ value: PaymentType.TRAINING, label: 'Training' },
		{ value: PaymentType.SPECIAL_EVENT, label: 'Special Event' },
		{ value: PaymentType.OTHER, label: 'Other' }
	]

	// Employee contractor status options
	const employeeContractorOptions = [
		{ value: '', label: 'Select status...' },
		{ value: EmployeeContractorStatus.EMPLOYEE, label: 'Employee' },
		{ value: EmployeeContractorStatus.CONTRACTOR, label: 'Contractor' },
		{ value: EmployeeContractorStatus.ROSTER_ARTIST, label: 'Roster Artist' }
	]

	// Validate form
	function validateForm(): boolean {
		errors = {}
		
		try {
			// Create a validation schema that includes required fields
			const validationData = {
				...formData,
				// Make sure venue_id and event_id are included for validation
				venue_id: formData.venue_id || undefined,
				event_id: formData.event_id || undefined,
				insperity_hours: formData.insperity_hours || undefined
			}
			
			createPayrollSchema.parse(validationData)
			return true
		} catch (error) {
			if (error instanceof z.ZodError) {
				error.errors.forEach(err => {
					const field = err.path[0] as string
					errors[field] = err.message
					// Show toast notification for validation errors
					toast.error(`${field.replace('_', ' ').toUpperCase()}: ${err.message}`)
				})
			}
			return false
		}
	}

	// Submit form
	async function handleSubmit() {
		if (!validateForm()) {
			toast.error('Please fix the validation errors before submitting.')
			return
		}

		isSubmitting = true
		try {
			dispatch('submit', { entry: formData })
			toast.success(entry ? 'Payroll entry updated successfully!' : 'Payroll entry created successfully!')
		} finally {
			isSubmitting = false
		}
	}

	// Close sidebar
	function handleClose() {
		dispatch('close')
	}

	// Handle overlay click with event prevention
	function handleOverlayClick(event: MouseEvent) {
		event.preventDefault()
		event.stopPropagation()
		dispatch('close')
	}

	// Delete entry
	function handleDelete() {
		if (entry && confirm('Are you sure you want to delete this payroll entry? This action cannot be undone.')) {
			dispatch('delete', { entry })
		}
	}

	// Handle field changes
	function updateField(field: keyof typeof formData, value: unknown) {
		if (field === 'employee_contractor_status') {
			if (value === 'employee' || value === 'contractor' || value === 'roster_artist' || value === undefined) {
				formData[field] = value as typeof formData[typeof field]
			}
		} else if (field === 'status') {
			if ([
				'Planned',
				'Approved',
				'Paid',
				'Completed',
				'Cancelled'
			].includes(value as string)) {
				formData[field] = value as typeof formData[typeof field]
			}
		} else if (field === 'payment_type') {
			if ([
				'performance',
				'training',
				'special_event',
				'other',
				undefined
			].includes(value as string | undefined)) {
				formData[field] = value as typeof formData[typeof field]
			}
		} else {
			formData[field] = value as typeof formData[typeof field]
		}
		// Clear error for this field
		if (errors[field]) {
			delete errors[field]
		}
	}

</script>

<!-- DaisyUI Drawer -->
<div class="drawer drawer-end">
	<input id="payroll-drawer" type="checkbox" class="drawer-toggle" bind:checked={open} />
	<div class="drawer-content">
		<!-- This is empty since we're using it as an overlay -->
	</div>
	<div class="drawer-side">
		<label for="payroll-drawer" aria-label="close sidebar" class="drawer-overlay" onclick={handleOverlayClick}></label>
		<div class="bg-base-100 text-base-content min-h-full w-full max-w-md flex flex-col">
			<!-- Header -->
			<div class="px-6 py-4 border-b border-base-200 flex items-center justify-between">
				<div>
					<h2 class="text-xl font-semibold text-base-content">
						{entry ? 'Edit Payroll Entry' : 'Add Payroll Entry'}
					</h2>
					<p class="text-sm text-base-content/60 mt-1">
						{entry ? 'Update the payroll information below' : 'Fill in the payroll information below'}
					</p>
				</div>
				<button 
					type="button" 
					class="btn btn-sm btn-circle btn-ghost"
					onclick={handleClose}
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
					</svg>
				</button>
			</div>

			<!-- Form Content -->
			<div class="flex-1 overflow-y-auto px-6 py-4">
				<div class="space-y-4">
					<!-- Event Date -->
					<FormField
						label="Event Date"
						type="date"
						value={formData.event_date}
						error={errors.event_date}
						required
						onchange={(value) => updateField('event_date', value)}
					/>

					<!-- Artist Selector -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Artist <span class="text-error">*</span></span>
						</label>
						<ArtistSelector
							value={formData.artist_id}
							error={errors.artist_id}
							placeholder="Search and select an artist..."
							required
							on:change={(event) => updateField('artist_id', event.detail.value)}
						/>
					</div>

					<!-- Venue Selector -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Venue <span class="text-error">*</span></span>
						</label>
						<VenueSelector
							value={formData.venue_id}
							error={errors.venue_id}
							placeholder="Search and select a venue..."
							required
							on:change={(event) => updateField('venue_id', event.detail.value)}
						/>
					</div>

					<!-- Event Selector -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Event <span class="text-error">*</span></span>
						</label>
						<EventSelector
							value={formData.event_id}
							error={errors.event_id}
							placeholder="Search and select an event..."
							required
							on:change={(event) => updateField('event_id', event.detail.value)}
						/>
					</div>

					<!-- Payment Type -->
					<FormField
						label="Payment Type"
						type="select"
						value={formData.payment_type ?? ''}
						error={errors.payment_type}
						options={paymentTypeOptions}
						required
						onchange={(value) => updateField('payment_type', value)}
					/>

					<!-- Employee/Contractor Status -->
					<FormField
						label="Employee/Contractor Status"
						type="select"
						value={formData.employee_contractor_status}
						error={errors.employee_contractor_status}
						options={employeeContractorOptions}
						required
						onchange={(value) => updateField('employee_contractor_status', value)}
					/>

					<!-- Hours -->
					<FormField
						label="Hours"
						type="number"
						value={formData.hours}
						error={errors.hours}
						min="0"
						step="0.5"
						required
						onchange={(value) => updateField('hours', Number(value))}
					/>

					<!-- Hourly Rate -->
					<FormField
						label="Hourly Rate"
						type="number"
						value={formData.rate}
						error={errors.rate}
						min="0"
						step="0.01"
						required
						onchange={(value) => updateField('rate', Number(value))}
					/>

					<!-- Insperity Hours -->
					<FormField
						label="Insperity Hours"
						type="number"
						value={formData.insperity_hours ?? ''}
						error={errors.insperity_hours}
						min="0"
						step="0.5"
						placeholder="Hours for Insperity system"
						required
						onchange={(value) => updateField('insperity_hours', value ? Number(value) : undefined)}
					/>

					<!-- Additional Pay -->
					<FormField
						label="Additional Pay"
						type="number"
						value={formData.additional_pay}
						error={errors.additional_pay}
						min="0"
						step="0.01"
						onchange={(value) => updateField('additional_pay', Number(value))}
					/>

					<!-- Additional Pay Reason -->
					<FormField
						label="Additional Pay Reason"
						type="textarea"
						value={formData.additional_pay_reason}
						error={errors.additional_pay_reason}
						placeholder="Reason for additional payment..."
						rows={2}
						onchange={(value) => updateField('additional_pay_reason', value)}
					/>

					<!-- Rate Description -->
					<FormField
						label="Rate Description"
						type="text"
						value={formData.rate_description}
						error={errors.rate_description}
						placeholder="Description of rate calculation"
						onchange={(value) => updateField('rate_description', value)}
					/>

					<!-- Invoice Number -->
					<FormField
						label="Invoice Number"
						type="text"
						value={formData.invoice_number}
						error={errors.invoice_number}
						placeholder="Invoice reference number"
						onchange={(value) => updateField('invoice_number', value)}
					/>

					<!-- Payment Status -->
					<FormField
						label="Payment Status"
						type="select"
						value={formData.status}
						error={errors.status}
						options={statusOptions}
						required
						onchange={(value) => updateField('status', value)}
					/>

					<!-- Paid Date (only if status is Paid) -->
					{#if formData.status === 'Paid'}
						<FormField
							label="Paid Date"
							type="date"
							value={formData.paid_date ?? ''}
							error={errors.paid_date}
							onchange={(value) => updateField('paid_date', value || undefined)}
						/>
					{/if}

					<!-- Notes -->
					<FormField
						label="Notes"
						type="textarea"
						value={formData.notes}
						error={errors.notes}
						placeholder="Additional notes or comments..."
						rows={3}
						onchange={(value) => updateField('notes', value)}
					/>

					<!-- Total Pay Display -->
					<div class="card bg-base-200 mt-6">
						<div class="card-body p-4">
							<div class="flex justify-between items-center">
								<span class="font-medium">Total Pay:</span>
								<span class="text-xl font-bold text-primary">
									{new Intl.NumberFormat('en-US', {
										style: 'currency',
										currency: 'USD'
									}).format(totalPay)}
								</span>
							</div>
							<div class="text-sm text-base-content/60">
								{formData.hours || 0} hours × ${formData.rate || 0}/hr
								{(formData.additional_pay || 0) > 0 ? ` + $${formData.additional_pay || 0} additional` : ''}
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Footer Actions -->
			<div class="border-t border-base-200 px-6 py-4">
				<div class="flex justify-between items-center">
					<!-- Delete button (only when editing) -->
					<div>
						{#if entry}
							<button 
								class="btn btn-outline btn-error"
								onclick={handleDelete}
								disabled={isSubmitting}
								title="Delete this payroll entry"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
								Delete
							</button>
						{/if}
					</div>
					
					<!-- Cancel and Save buttons -->
					<div class="flex gap-3">
						<button 
							class="btn btn-outline"
							onclick={handleClose}
							disabled={isSubmitting}
						>
							Cancel
						</button>
						<button 
							class="btn btn-primary"
							onclick={handleSubmit}
							disabled={isSubmitting}
						>
							{#if isSubmitting}
								<span class="loading loading-spinner loading-sm"></span>
							{/if}
							{entry ? 'Update Entry' : 'Create Entry'}
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>