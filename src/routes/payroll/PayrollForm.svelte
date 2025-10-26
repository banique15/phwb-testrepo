<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { createPayrollSchema, type Payroll, type CreatePayroll, PaymentType, EmployeeContractorStatus } from '$lib/schemas/payroll'
	import FormField from '$lib/components/ui/FormField.svelte'
	import ArtistSelector from '$lib/components/ui/ArtistSelector.svelte'
	import VenueSelector from '$lib/components/ui/VenueSelector.svelte'
	import EventSelector from '$lib/components/ui/EventSelector.svelte'
	import { z } from 'zod'

	interface Props {
		entry?: Payroll | null
	}

	let { entry = null }: Props = $props()

	const dispatch = createEventDispatcher<{
		submit: { entry: CreatePayroll }
		cancel: void
	}>()

	// Form state
	let formData = $state({
		event_date: '',
		artist_id: '',
		venue_id: undefined as number | undefined,
		event_id: undefined as number | undefined,
		hours: 0,
		rate: 0,
		base_rate: undefined as number | undefined,
		additional_rate: undefined as number | undefined,
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

	// Initialize form with entry data if editing
	$effect(() => {
		if (entry) {
			formData = {
				event_date: entry.event_date || '',
				artist_id: entry.artist_id || '',
				venue_id: entry.venue_id,
				event_id: entry.event_id,
				hours: entry.hours || 0,
				rate: entry.rate || 0,
				base_rate: entry.base_rate,
				additional_rate: entry.additional_rate,
				additional_pay: entry.additional_pay || 0,
				additional_pay_reason: entry.additional_pay_reason || '',
				status: (entry.status || 'Planned') as 'Planned' | 'Approved' | 'Paid' | 'Completed' | 'Cancelled',
				payment_type: entry.payment_type as 'performance' | 'training' | 'special_event' | 'other' | undefined,
				employee_contractor_status: entry.employee_contractor_status || undefined,
				invoice_number: entry.invoice_number || '',
				notes: entry.notes || '',
				rate_description: entry.rate_description || '',
				insperity_hours: entry.insperity_hours,
				paid_date: entry.paid_date
			}
		}
	})

	// Calculate total pay
	let totalPay = $derived(calculateTotalPay())

	function calculateTotalPay(): number {
		const base = formData.hours * formData.rate
		return base + formData.additional_pay
	}

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
			createPayrollSchema.parse(formData)
			return true
		} catch (error) {
			if (error instanceof z.ZodError) {
				error.errors.forEach(err => {
					const field = err.path[0] as string
					errors[field] = err.message
				})
			}
			return false
		}
	}

	// Submit form
	async function handleSubmit() {
		if (!validateForm()) return

		isSubmitting = true
		try {
			dispatch('submit', { entry: formData })
		} finally {
			isSubmitting = false
		}
	}

	// Cancel form
	function handleCancel() {
		dispatch('cancel')
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

<div class="space-y-6">
	<!-- Form Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<!-- Left Column -->
		<div class="space-y-4">
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

			<FormField
				label="Payment Type"
				type="select"
				value={formData.payment_type ?? ''}
				error={errors.payment_type}
				options={paymentTypeOptions}
				required
				onchange={(value) => updateField('payment_type', value)}
			/>

			<FormField
				label="Employee/Contractor Status"
				type="select"
				value={formData.employee_contractor_status}
				error={errors.employee_contractor_status}
				options={employeeContractorOptions}
				required
				onchange={(value) => updateField('employee_contractor_status', value)}
			/>

			<FormField
				label="Payment Status"
				type="select"
				value={formData.status}
				error={errors.status}
				options={statusOptions}
				required
				onchange={(value) => updateField('status', value)}
			/>
		</div>

		<!-- Right Column -->
		<div class="space-y-4">
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

			<FormField
				label="Additional Pay"
				type="number"
				value={formData.additional_pay}
				error={errors.additional_pay}
				min="0"
				step="0.01"
				onchange={(value) => updateField('additional_pay', Number(value))}
			/>

			<FormField
				label="Additional Pay Reason"
				type="textarea"
				value={formData.additional_pay_reason}
				error={errors.additional_pay_reason}
				placeholder="Reason for additional payment..."
				rows={2}
				onchange={(value) => updateField('additional_pay_reason', value)}
			/>

			<!-- Total Pay Display -->
			<div class="card bg-base-200">
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
						{formData.hours} hours × ${formData.rate}/hr
						{formData.additional_pay > 0 ? ` + $${formData.additional_pay} additional` : ''}
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Additional Fields (Collapsible) -->
	<div class="collapse collapse-arrow bg-base-200">
		<input type="checkbox" />
		<div class="collapse-title text-lg font-medium">
			Additional Information
		</div>
		<div class="collapse-content">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
				<!-- Venue Selector -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Venue</span>
					</label>
					<VenueSelector
						value={formData.venue_id}
						error={errors.venue_id}
						placeholder="Search and select a venue..."
						on:change={(event) => updateField('venue_id', event.detail.value)}
					/>
				</div>

				<!-- Event Selector -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Event</span>
					</label>
					<EventSelector
						value={formData.event_id}
						error={errors.event_id}
						placeholder="Search and select an event..."
						on:change={(event) => updateField('event_id', event.detail.value)}
					/>
				</div>

				<FormField
					label="Base Rate"
					type="number"
					value={formData.base_rate ?? ''}
					error={errors.base_rate}
					min="0"
					step="0.01"
					placeholder="Base hourly rate"
					onchange={(value) => updateField('base_rate', value ? Number(value) : undefined)}
				/>

				<FormField
					label="Additional Rate"
					type="number"
					value={formData.additional_rate ?? ''}
					error={errors.additional_rate}
					min="0"
					step="0.01"
					placeholder="Additional hourly rate"
					onchange={(value) => updateField('additional_rate', value ? Number(value) : undefined)}
				/>

				<FormField
					label="Rate Description"
					type="text"
					value={formData.rate_description}
					error={errors.rate_description}
					placeholder="Description of rate calculation"
					onchange={(value) => updateField('rate_description', value)}
				/>

				<FormField
					label="Invoice Number"
					type="text"
					value={formData.invoice_number}
					error={errors.invoice_number}
					placeholder="Invoice reference number"
					onchange={(value) => updateField('invoice_number', value)}
				/>

				<FormField
					label="Insperity Hours"
					type="number"
					value={formData.insperity_hours ?? ''}
					error={errors.insperity_hours}
					min="0"
					step="0.5"
					placeholder="Hours for Insperity system"
					onchange={(value) => updateField('insperity_hours', value ? Number(value) : undefined)}
				/>

				{#if formData.status === 'Paid'}
					<FormField
						label="Paid Date"
						type="date"
						value={formData.paid_date ?? ''}
						error={errors.paid_date}
						onchange={(value) => updateField('paid_date', value || undefined)}
					/>
				{/if}

				<div class="md:col-span-2">
					<FormField
						label="Notes"
						type="textarea"
						value={formData.notes}
						error={errors.notes}
						placeholder="Additional notes or comments..."
						rows={3}
						onchange={(value) => updateField('notes', value)}
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- Form Actions -->
	<div class="flex justify-end gap-3 pt-4 border-t">
		<button 
			class="btn btn-ghost"
			onclick={handleCancel}
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