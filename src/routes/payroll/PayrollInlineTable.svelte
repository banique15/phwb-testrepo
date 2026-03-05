<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import type { Payroll, CreatePayroll, UpdatePayroll } from '$lib/schemas/payroll'
	import { payrollStore } from '$lib/stores/payroll'
	import { artistsStore } from '$lib/stores/artists'
	import { venuesStore } from '$lib/stores/venues'
	import { artistLookup, venueLookup } from '$lib/stores/lookup'
	import { PaymentStatus, PaymentType, EmployeeContractorStatus } from '$lib/schemas/payroll'
	import { rateCardStore, type RateRuleOption } from '$lib/stores/rate-cards'
	import { DollarSign } from 'lucide-svelte'
	import PaymentStatusBadge from '$lib/components/payroll/PaymentStatusBadge.svelte'
	import ArtistSelector from '$lib/components/ui/ArtistSelector.svelte'
	import { onMount } from 'svelte'
	import { browser } from '$app/environment'
	import { supabase } from '$lib/supabase'
	import { toast } from '$lib/stores/toast'
	
	interface Props {
		entries: Payroll[]
		loading: boolean
		searchQuery: string
		selectedEntries: Set<number>
		pagination: {
			currentPage: number
			totalPages: number
			total: number
			limit: number
		}
		sortBy: string
		sortOrder: 'asc' | 'desc'
		actions?: import('svelte').Snippet
	}

	let {
		entries = [],
		loading = false,
		searchQuery = '',
		selectedEntries = new Set(),
		pagination,
		sortBy = 'event_date',
		sortOrder = 'desc',
		actions
	}: Props = $props()

	const dispatch = createEventDispatcher<{
		search: { value: string }
		sort: { key: string; order: 'asc' | 'desc' }
		pageChange: { page: number }
		select: { entries: Set<number> }
		update: { entry: Payroll }
		delete: { id: number }
	}>()

	// Editing state - use string | number for keys to support both new rows and existing rows
	let editingRows = $state<Map<string | number, Partial<Payroll>>>(new Map())
	let editingCell = $state<{ id: number | string, field: string } | null>(null)
	let newRowCounter = $state(0)
	
	// Validation state
	let validationErrors = $state<Map<string, Record<string, string>>>(new Map())
	
	// Venue type colors
	const venueTypeColors: Record<string, string> = {
		'Healing Arts': 'text-green-600',
		'Creative Placemaking': 'text-blue-600',
		'Training': 'text-purple-600',
		'Administrative': 'text-gray-600'
	}
	
	// Rate rule options loaded from the active rate card
	let rateRuleOptions = $state<RateRuleOption[]>([])
	
	// Additional pay reason options
	const additionalPayReasons = [
		'Travel',
		'Equipment',
		'Preparation',
		'Overtime',
		'Holiday',
		'Bonus',
		'Other'
	]

	// Artist display formatting for LLC support
	function formatArtistOption(artist: any): string {
		const name = artist.full_name || `${artist.legal_first_name} ${artist.legal_last_name}`
		if (artist.llc_name && (artist.employment_status === '1099' || artist.employment_status === 'LLC')) {
			return `${artist.llc_name} (${name})`
		}
		return name
	}

	function formatArtistDisplay(entry: Partial<Payroll>): string {
		const a = (entry as any).artists
		if (!a) return 'N/A'
		const name = a.full_name || (a.legal_first_name && a.legal_last_name ? `${a.legal_first_name} ${a.legal_last_name}` : null)
		if (!name) return 'N/A'
		if (a.llc_name && entry.employee_contractor_status === 'llc') {
			return `${a.llc_name} (${name})`
		}
		return name
	}

	function deriveTypeFromArtist(artist: any): string | null {
		if (!artist?.employment_status) return null
		const status = artist.employment_status
		if (status === 'Employee' || status === 'W2') return 'employee'
		if (status === '1099' && artist.llc_name) return 'llc'
		if (status === '1099') return 'contractor'
		return null
	}

	// Store subscriptions
	let artists = $state<any[]>([])
	let venues = $state<any[]>([])
	
	// Text size management
	const TEXT_SIZE_KEY = 'payroll-table-text-size'
	const textSizes = [
		{ value: 'xs', label: 'XS', class: 'text-xs' },
		{ value: 'sm', label: 'S', class: 'text-sm' },
		{ value: 'base', label: 'M', class: 'text-base' },
		{ value: 'lg', label: 'L', class: 'text-lg' },
	]
	
	let selectedTextSize = $state('sm')
	
	// Load text size from localStorage
	if (browser) {
		const saved = localStorage.getItem(TEXT_SIZE_KEY)
		if (saved && textSizes.some(size => size.value === saved)) {
			selectedTextSize = saved
		}
	}
	
	// Save text size to localStorage whenever it changes
	$effect(() => {
		if (browser) {
			localStorage.setItem(TEXT_SIZE_KEY, selectedTextSize)
		}
	})
	
	// Get current text size class
	let textSizeClass = $derived(textSizes.find(size => size.value === selectedTextSize)?.class || 'text-sm')
	
	onMount(() => {
		// Load lookup data
		artistsStore.fetchAll()
		venuesStore.fetchAll()
		rateCardStore.fetchActiveRuleOptions()
		
		// Subscribe to stores
		const unsubArtists = artistsStore.subscribe(state => {
			artists = state.items
		})
		
		const unsubVenues = venuesStore.subscribe(state => {
			venues = state.items
		})

		const unsubRateCards = rateCardStore.subscribe((state: { ruleOptions: RateRuleOption[] }) => {
			rateRuleOptions = state.ruleOptions
		})
		
		return () => {
			unsubArtists()
			unsubVenues()
			unsubRateCards()
		}
	})

	// Add new entry row
	function addNewEntry() {
		const tempId: string = `new-${newRowCounter++}`
		const today = new Date().toISOString().split('T')[0]
		
		editingRows.set(tempId, {
			event_date: today,
			artist_id: '',
			venue_id: undefined,
			hours: 0,
			rate: 0,
			rate_type: undefined,
			rate_rule_id: undefined,
			base_rate: undefined,
			additional_rate: undefined,
			rate_description: undefined,
			additional_pay: 0,
			additional_pay_reason: '',
			insperity_hours: 0,
			status: PaymentStatus.PLANNED,
			payment_type: PaymentType.PERFORMANCE,
			employee_contractor_status: EmployeeContractorStatus.EMPLOYEE,
			notes: '',
			creation_method: 'manual'
		})
		editingRows = new Map(editingRows)
	}

	// Start editing a specific cell
	function startEditingCell(entry: Payroll, field: string) {
		if (!entry.id || typeof entry.id === 'string') return
		
		// If not already editing this row, create edit data
		if (!editingRows.has(entry.id)) {
			editingRows.set(entry.id, { ...entry })
			editingRows = new Map(editingRows)
		}
		
		editingCell = { id: entry.id, field }
	}

	// Start editing entire row
	function startEditing(entry: Payroll) {
		if (!entry.id || typeof entry.id === 'string') return
		
		if (!editingRows.has(entry.id)) {
			editingRows.set(entry.id, { ...entry })
			editingRows = new Map(editingRows)
		}
	}

	// Cancel editing
	function cancelEditing(id: string | number) {
		editingRows.delete(id)
		editingRows = new Map(editingRows)
		editingCell = null
	}
	
	// Cancel editing just the current cell
	function cancelCellEdit() {
		if (!editingCell) return
		
		const cellId = editingCell.id
		const field = editingCell.field as keyof Payroll
		const entry = entries.find(e => e.id === cellId)
		if (entry && editingRows.has(cellId)) {
			const editData = editingRows.get(cellId)!
			;(editData as any)[field] = entry[field]
			editingRows = new Map(editingRows)
		}
		
		editingCell = null
	}

	// Validate a row
	function validateRow(id: string | number, data: Partial<Payroll>): Record<string, string> {
		const errors: Record<string, string> = {}
		
		// Required field: event_date
		if (!data.event_date) {
			errors.event_date = 'Date is required'
		}
		
		// Required field: artist_id
		if (!data.artist_id) {
			errors.artist_id = 'Artist is required'
		}
		
		// Hours validation
		if (data.hours !== undefined && data.hours < 0) {
			errors.hours = 'Hours cannot be negative'
		}
		
		// Rate validation
		if (data.rate !== undefined && data.rate < 0) {
			errors.rate = 'Rate cannot be negative'
		}
		
		// Additional pay validation
		if (data.additional_pay !== undefined && data.additional_pay < 0) {
			errors.additional_pay = 'Additional pay cannot be negative'
		}
		
		// Paid date validation - if status is Paid, paid_date should be set
		if (data.status === 'Paid' && !data.paid_date) {
			errors.paid_date = 'Paid date is required when status is Paid'
		}
		
		return errors
	}
	
	// Get validation error for a specific field
	function getFieldError(id: string | number, field: string): string | undefined {
		const rowErrors = validationErrors.get(String(id))
		return rowErrors?.[field]
	}
	
	// Check if field has error
	function hasFieldError(id: string | number, field: string): boolean {
		return !!getFieldError(id, field)
	}

	// Save row
	async function saveRow(id: string | number) {
		const editData = editingRows.get(id)
		if (!editData) return
		
		// Validate the row
		const errors = validateRow(id, editData)
		if (Object.keys(errors).length > 0) {
			validationErrors.set(String(id), errors)
			validationErrors = new Map(validationErrors)
			toast.error('Please fix the validation errors before saving')
			return
		}
		
		// Clear validation errors for this row
		validationErrors.delete(String(id))
		validationErrors = new Map(validationErrors)

		try {
			// Calculate total pay using the rate-type-aware function
			editData.total_pay = calculateTotalPay(editData)
			
			// Set insperity_hours to match hours if not set
			if (editData.insperity_hours === undefined || editData.insperity_hours === 0) {
				editData.insperity_hours = editData.hours
			}

			// For manual entries, set creation metadata
			if (typeof id === 'string' && id.startsWith('new')) {
				editData.creation_method = 'manual'
				// Get current user info for created_by
				const { data: { user } } = await supabase.auth.getUser()
				if (user) {
					editData.created_by = user.email || user.id
				}
			}

			// Clean up data - convert null to undefined for optional fields
			const cleanedData = Object.entries(editData).reduce((acc, [key, value]) => {
				// Convert null to undefined for optional fields
				if (value === null) {
					// Don't include null values in the update
					return acc
				}
				// Convert empty strings to undefined for optional fields
				if (value === '' && key !== 'artist_id' && key !== 'event_date' && key !== 'status') {
					return acc
				}
				acc[key] = value
				return acc
			}, {} as any)

			if (typeof id === 'string' && id.startsWith('new')) {
				// Create new entry
				await payrollStore.create(cleanedData as CreatePayroll)
				toast.success('Payroll entry created successfully')
			} else {
				// Update existing entry
				await payrollStore.update(id as number, cleanedData as UpdatePayroll)
				toast.success('Payroll entry updated successfully')
			}
			
			// Clear editing state
			editingRows.delete(id)
			editingRows = new Map(editingRows)
			editingCell = null
			dispatch('update', { entry: cleanedData as Payroll })
		} catch (error) {
			console.error('Failed to save payroll entry:', error)
			toast.error('Failed to save payroll entry. Please try again.')
		}
	}
	
	// Save just the current cell
	async function saveCellEdit() {
		if (!editingCell) return
		await saveRow(editingCell.id)
	}

	// Delete row
	async function deleteRow(id: number) {
		if (confirm('Are you sure you want to delete this entry?')) {
			try {
				await payrollStore.delete(id)
				dispatch('delete', { id })
				toast.success('Payroll entry deleted')
			} catch (error) {
				console.error('Failed to delete payroll entry:', error)
				toast.error('Failed to delete payroll entry')
			}
		}
	}

	// Update field value
	function updateField(id: string | number, field: string, value: any) {
		const current = editingRows.get(id) || {}
		;(current as any)[field] = value
		
		// Auto-calculate insperity_hours when hours change
		if (field === 'hours' && !current.insperity_hours) {
			current.insperity_hours = value
		}
		
		editingRows.set(id, current)
		editingRows = new Map(editingRows)
	}

	// Handle artist selection with auto-classification of employee/contractor type
	function handleArtistSelect(id: string | number, artistId: string) {
		updateField(id, 'artist_id', artistId)
		if (!artistId) return

		const artist = artists.find((a: any) => a.id === artistId)
		if (!artist) return

		const derivedType = deriveTypeFromArtist(artist)
		if (derivedType) {
			updateField(id, 'employee_contractor_status', derivedType)
		}
	}

	// Filter artists based on the currently selected type column,
	// but always include the currently selected artist (for existing rows)
	function filteredArtists(typeStatus: string | null | undefined, selectedId?: string | null): any[] {
		let list = artists

		if (typeStatus === 'employee') {
			list = artists.filter((a: any) => a.employment_status === 'Employee' || a.employment_status === 'W2' || !a.employment_status)
		} else if (typeStatus === 'llc') {
			list = artists.filter((a: any) => a.employment_status === '1099' && a.llc_name)
		} else if (typeStatus === 'contractor') {
			list = artists.filter((a: any) => a.employment_status === '1099')
		}

		if (selectedId) {
			const selected = artists.find((a: any) => a.id === selectedId)
			if (selected && !list.some((a: any) => a.id === selected.id)) {
				list = [...list, selected]
			}
		}

		return list
	}

	// Apply a selected rate rule to a payroll entry
	function handleRateRuleSelect(id: number | string, ruleId: number) {
		const option = rateRuleOptions.find(o => o.ruleId === ruleId)
		if (!option) return

		const current = editingRows.get(id) || {}
		current.rate_rule_id = option.ruleId
		current.rate_type = option.rateType
		current.rate_description = option.description

		if (option.rateType === 'hourly') {
			current.rate = option.primaryRate
			current.base_rate = undefined
			current.additional_rate = undefined
		} else if (option.rateType === 'flat') {
			current.rate = option.primaryRate
			current.base_rate = undefined
			current.additional_rate = undefined
		} else if (option.rateType === 'tiered') {
			current.rate = option.primaryRate
			current.base_rate = option.primaryRate
			current.additional_rate = option.additionalRate ?? undefined
		}

		editingRows.set(id, current)
		editingRows = new Map(editingRows)
	}

	// Format the rate display value for existing entries
	function formatRateDisplay(entry: Partial<Payroll>): string {
		const rateType = entry.rate_type
		if (rateType === 'flat') {
			return `${formatCurrency(entry.rate || 0)} flat`
		}
		if (rateType === 'tiered') {
			return `${formatCurrency(entry.rate || 0)} + ${formatCurrency(entry.additional_rate || 0)}/hr`
		}
		return `${formatCurrency(entry.rate || 0)}/hr`
	}

	// Get venue type color
	function getVenueColor(venueId: number | undefined): string {
		if (!venueId) return ''
		const venue = venues.find(v => v.id === venueId)
		if (!venue || !venue.type) return ''
		return venueTypeColors[venue.type] || ''
	}

	// Format helpers
	function formatDate(dateStr: string): string {
		if (!dateStr) return '-'
		// Append 'T00:00:00' to treat date as local time, not UTC
		const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
		return date.toLocaleDateString()
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount)
	}

	// Calculate total pay based on rate_type
	function calculateTotalPay(entry: Partial<Payroll>): number {
		const rateType = entry.rate_type || 'hourly'
		let base = 0

		if (rateType === 'flat') {
			base = entry.rate || 0
		} else if (rateType === 'tiered') {
			const hours = entry.hours || 0
			const firstHour = entry.rate || 0
			const subsequent = entry.additional_rate || 0
			base = hours <= 1 ? hours * firstHour : firstHour + (hours - 1) * subsequent
		} else {
			base = (entry.hours || 0) * (entry.rate || 0)
		}

		return base + (entry.additional_pay || 0)
	}

	// Check if a specific cell is being edited
	function isEditingCell(entryId: string | number, field: string): boolean {
		return editingCell?.id === entryId && editingCell?.field === field
	}
	
	// Check if row is being edited (for new rows)
	function isNewRow(entry: Payroll | { id?: string }): boolean {
		const id = entry.id
		return typeof id === 'string' && id.startsWith('new')
	}

	// Get display entries (add new rows at the top)
	let displayEntries = $derived([
		...Array.from(editingRows.entries())
			.filter(([id]) => typeof id === 'string' && id.startsWith('new'))
			.map(([id, data]) => ({ ...data, id } as Payroll)),
		...entries
	])

	// Derive a reactive snapshot of selected IDs so Svelte 5 tracks changes
	let selectedSnapshot = $derived(new Set(selectedEntries))

	function isEntrySelected(entryId: number | string | undefined): boolean {
		if (typeof entryId !== 'number') return false
		return selectedSnapshot.has(entryId)
	}

	function toggleSelection(entryId: number) {
		const newSelected = new Set(selectedEntries)
		if (newSelected.has(entryId)) {
			newSelected.delete(entryId)
		} else {
			newSelected.add(entryId)
		}
		dispatch('select', { entries: newSelected })
	}

	// Keyboard navigation
	function handleKeyDown(event: KeyboardEvent, id: string | number, field: string) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault()
			saveRow(id)
		} else if (event.key === 'Escape') {
			event.preventDefault()
			cancelEditing(id)
		} else if (event.key === 'Tab') {
			// Allow tab navigation between fields
		}
	}
</script>

<div class="space-y-4">
	<!-- Header with search and actions -->
	<div class="flex justify-between items-center">
		<div class="flex items-center gap-4">
			<div class="form-control">
				<input
					type="text"
					placeholder="Search payroll entries..."
					class="input input-bordered w-80"
					value={searchQuery}
					oninput={(e) => dispatch('search', { value: e.currentTarget.value })}
				/>
			</div>
			{#if selectedEntries.size > 0}
				<span class="text-sm text-base-content/70">
					{selectedEntries.size} selected
				</span>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			<!-- Text size selector -->
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn btn-ghost btn-sm" title="Adjust text size">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
					</svg>
					<span class="hidden sm:inline ml-1">Text Size</span>
				</div>
				<ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-32">
					{#each textSizes as size}
						<li>
							<button 
								class:active={selectedTextSize === size.value}
								onclick={() => selectedTextSize = size.value}
							>
								<span class={size.class}>{size.label}</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
			
			<button 
				class="btn btn-primary btn-sm"
				onclick={addNewEntry}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				Add Entry
			</button>
			{#if actions}
				{@render actions()}
			{/if}
		</div>
	</div>

	<!-- Table -->
	{#if loading}
		<div class="flex justify-center py-8">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if displayEntries.length === 0}
		<div class="text-center py-12">
			<DollarSign class="w-16 h-16 mx-auto mb-4 text-base-content/70" />
			<h3 class="text-lg font-semibold mb-2">No payroll entries found</h3>
			<p class="text-base-content/60">
				Click "Add Entry" to create your first payroll entry
			</p>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="table table-sm {textSizeClass}">
				<thead>
					<tr>
						<th class="w-10"></th>
						<th class="w-28">Date</th>
						<th class="w-48">Artist</th>
						<th class="w-40">Venue</th>
						<th class="w-32">Program</th>
						<th class="w-16">Musicians</th>
						<th class="w-20">Type</th>
					<th class="w-20">Duration</th>
					<th class="w-16">Gig Dur.</th>
						<th class="w-64">Rate</th>
						<th class="w-24">Additional</th>
						<th class="w-32">Reason</th>
						<th class="w-24">Total</th>
						<th class="w-24">Service Hrs</th>
						<th class="w-28">Paid Date</th>
						<th class="w-24">Status</th>
						<th class="w-20">Source</th>
						<th class="w-24">Invoice</th>
						<th class="w-48">Notes</th>
						<th class="w-32">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each displayEntries as entry (entry.id)}
						{@const isNew = isNewRow(entry)}
						{@const editData = editingRows.get(entry.id!) || entry}
						{@const isSelected = isEntrySelected(entry.id)}
						<tr 
							class:bg-warning={isNew} 
							class:bg-opacity-20={isNew}
							class:bg-primary={isSelected}
							class:bg-opacity-10={isSelected}
						>
						<td 
							class="cursor-pointer select-none"
							onclick={() => { if (typeof entry.id === 'number') toggleSelection(entry.id) }}
						>
							{#if typeof entry.id === 'number'}
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={isSelected}
									onclick={(e: MouseEvent) => e.stopPropagation()}
									onchange={() => toggleSelection(entry.id as number)}
								/>
							{/if}
						</td>
							
							<!-- Event Date -->
							<td class="relative group">
								{#if isEditingCell(entry.id!, 'event_date') || isNew}
									<div class="flex flex-col gap-0.5">
										<div class="flex items-center gap-1">
											<input
												type="date"
												class="input input-bordered input-xs flex-1"
												class:input-error={hasFieldError(entry.id!, 'event_date')}
												value={editData.event_date}
												oninput={(e) => updateField(entry.id!, 'event_date', e.currentTarget.value)}
												onkeydown={(e) => handleKeyDown(e, entry.id!, 'event_date')}
												required
											/>
										{#if !isNew}
											<button class="btn btn-xs btn-ghost text-success" onclick={() => saveCellEdit()} title="Save">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											</button>
											<button class="btn btn-xs btn-ghost text-error" onclick={() => cancelCellEdit()} title="Cancel">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										{/if}
										</div>
										{#if hasFieldError(entry.id!, 'event_date')}
											<span class="text-error text-xs">{getFieldError(entry.id!, 'event_date')}</span>
										{/if}
									</div>
								{:else}
									<div 
										class="cursor-pointer hover:bg-base-200 px-2 py-1 rounded transition-all duration-150 border border-transparent hover:border-base-300" 
										onclick={() => startEditingCell(entry, 'event_date')}
									>
										{formatDate(entry.event_date)}
									</div>
								{/if}
							</td>
							
							<!-- Artist -->
							<td class="relative group">
								{#if isEditingCell(entry.id!, 'artist_id') || isNew}
									<div class="flex flex-col gap-0.5">
										<div class="flex items-center gap-1">
											<select
												class="select select-bordered select-xs flex-1 min-w-[14rem]"
												class:select-error={hasFieldError(entry.id!, 'artist_id')}
												value={editData.artist_id}
											onchange={(e) => handleArtistSelect(entry.id!, e.currentTarget.value)}
												required
											>
												<option value="">Select artist...</option>
											{#each filteredArtists(editData.employee_contractor_status, editData.artist_id) as artist}
													<option value={artist.id}>
														{formatArtistOption(artist)}
													</option>
												{/each}
											</select>
											{#if !isNew}
												<button class="btn btn-xs btn-ghost text-success" onclick={() => saveCellEdit()} title="Save">
													<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
													</svg>
												</button>
												<button class="btn btn-xs btn-ghost text-error" onclick={() => cancelCellEdit()} title="Cancel">
													<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
													</svg>
												</button>
											{/if}
										</div>
										{#if hasFieldError(entry.id!, 'artist_id')}
											<span class="text-error text-xs">{getFieldError(entry.id!, 'artist_id')}</span>
										{/if}
									</div>
								{:else}
									<div 
										class="cursor-pointer hover:bg-base-200 hover:shadow-sm px-2 py-1 rounded truncate transition-all duration-150 border border-transparent hover:border-base-300" 
										onclick={() => startEditingCell(entry, 'artist_id')}
										title={formatArtistDisplay(entry)}
									>
										{formatArtistDisplay(entry)}
									</div>
								{/if}
							</td>
							
							<!-- Venue -->
							<td class="relative group">
								{#if isEditingCell(entry.id!, 'venue_id') || isNew}
									<div class="flex items-center gap-1">
										<select
											class="select select-bordered select-xs flex-1"
											value={editData.venue_id || ''}
											onchange={(e) => updateField(entry.id!, 'venue_id', e.currentTarget.value ? Number(e.currentTarget.value) : undefined)}
										>
											<option value="">Select venue...</option>
											{#each venues as venue}
												<option value={venue.id} class={getVenueColor(venue.id)}>
													{venue.name}
												</option>
											{/each}
										</select>
										{#if !isNew}
											<button class="btn btn-xs btn-ghost text-success" onclick={() => saveCellEdit()} title="Save">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											</button>
											<button class="btn btn-xs btn-ghost text-error" onclick={() => cancelCellEdit()} title="Cancel">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										{/if}
									</div>
								{:else}
									<div 
										class="cursor-pointer hover:bg-base-200 hover:shadow-sm px-2 py-1 rounded truncate transition-all duration-150 border border-transparent hover:border-base-300 {getVenueColor(entry.venue_id)}" 
										onclick={() => startEditingCell(entry, 'venue_id')}
									>
										{entry.venues?.name || '-'}
									</div>
								{/if}
							</td>
							
							<!-- Program -->
							<td>
								<div class="truncate text-xs" title={entry.programs?.title || '-'}>
									{entry.programs?.title || '-'}
								</div>
							</td>
							
							<!-- Musicians -->
							<td class="text-center">
								{#if entry.number_of_musicians}
									<span class="badge badge-outline badge-sm">{entry.number_of_musicians}</span>
								{:else}
									<span class="text-xs opacity-50">-</span>
								{/if}
							</td>
							
						<!-- Type (Employee/Contractor/LLC) -->
						<td class="relative group">
							{#if isEditingCell(entry.id!, 'employee_contractor_status') || isNew}
								<div class="flex items-center gap-1">
									<select
										class="select select-bordered select-xs flex-1"
										value={editData.employee_contractor_status || ''}
										onchange={(e) => updateField(entry.id!, 'employee_contractor_status', e.currentTarget.value || null)}
									>
										<option value="">-</option>
										<option value="employee">W2</option>
										<option value="contractor">1099</option>
										<option value="llc">LLC</option>
										<option value="roster_artist">Roster</option>
									</select>
									{#if !isNew}
										<button class="btn btn-xs btn-ghost text-success" onclick={() => saveCellEdit()} title="Save">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
										</button>
										<button class="btn btn-xs btn-ghost text-error" onclick={() => cancelCellEdit()} title="Cancel">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									{/if}
								</div>
							{:else}
								<div 
									class="cursor-pointer hover:bg-base-200 px-2 py-1 rounded transition-all duration-150 border border-transparent hover:border-base-300" 
									onclick={() => startEditingCell(entry, 'employee_contractor_status')}
								>
									{#if entry.employee_contractor_status === 'employee'}
										<span class="badge badge-success badge-xs">W2</span>
									{:else if entry.employee_contractor_status === 'contractor'}
										<span class="badge badge-warning badge-xs">1099</span>
									{:else if entry.employee_contractor_status === 'llc'}
										<span class="badge badge-info badge-xs">LLC</span>
									{:else if entry.employee_contractor_status === 'roster_artist'}
										<span class="badge badge-secondary badge-xs">Roster</span>
									{:else}
										<span class="text-xs opacity-50">-</span>
									{/if}
								</div>
							{/if}
						</td>
							
							<!-- Hours -->
							<td class="relative group">
								{#if isEditingCell(entry.id!, 'hours') || isNew}
									<div class="flex items-center gap-1">
										<input
											type="number"
											class="input input-bordered input-xs flex-1"
											value={editData.hours}
											min="0"
											step="0.5"
											oninput={(e) => updateField(entry.id!, 'hours', Number(e.currentTarget.value))}
											onkeydown={(e) => handleKeyDown(e, entry.id!, 'hours')}
										/>
										{#if !isNew}
											<button class="btn btn-xs btn-ghost text-success" onclick={() => saveCellEdit()} title="Save">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											</button>
											<button class="btn btn-xs btn-ghost text-error" onclick={() => cancelCellEdit()} title="Cancel">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										{/if}
									</div>
								{:else}
									<div 
										class="cursor-pointer hover:bg-base-200 px-2 py-1 rounded transition-all duration-150 border border-transparent hover:border-base-300" 
										onclick={() => startEditingCell(entry, 'hours')}
									>
										{entry.hours || 0}
									</div>
								{/if}
							</td>
							
							<!-- Duration (gig_duration) -->
							<td class="text-center">
								{#if entry.gig_duration}
									<span class="text-xs">{entry.gig_duration}h</span>
								{:else}
									<span class="text-xs opacity-50">-</span>
								{/if}
							</td>
							
							<!-- Rate -->
							<td class="relative group">
								{#if isEditingCell(entry.id!, 'rate') || isNew}
									<div class="flex items-center gap-1">
										<select
											class="select select-bordered select-xs flex-1 min-w-[16rem]"
											value={editData.rate_rule_id || ''}
											onchange={(e) => {
												const val = e.currentTarget.value
												if (val) handleRateRuleSelect(entry.id!, Number(val))
											}}
										>
											<option value="">Select rate...</option>
											{#each rateRuleOptions as option}
												<option value={option.ruleId}>{option.label}</option>
											{/each}
										</select>
										{#if !isNew}
											<button class="btn btn-xs btn-ghost text-success" onclick={() => saveCellEdit()} title="Save">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											</button>
											<button class="btn btn-xs btn-ghost text-error" onclick={() => cancelCellEdit()} title="Cancel">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										{/if}
									</div>
								{:else}
									<div 
										class="cursor-pointer hover:bg-base-200 px-2 py-1 rounded transition-all duration-150 border border-transparent hover:border-base-300"
										title={entry.rate_description || ''}
										onclick={() => startEditingCell(entry, 'rate')}
									>
										{formatRateDisplay(entry)}
									</div>
								{/if}
							</td>
							
							<!-- Additional Pay -->
							<td class="relative group">
								{#if isEditingCell(entry.id!, 'additional_pay') || isNew}
									<div class="flex items-center gap-1">
										<input
											type="number"
											class="input input-bordered input-xs flex-1"
											value={editData.additional_pay}
											min="0"
											step="1"
											oninput={(e) => updateField(entry.id!, 'additional_pay', Number(e.currentTarget.value))}
											onkeydown={(e) => handleKeyDown(e, entry.id!, 'additional_pay')}
										/>
										{#if !isNew}
											<button class="btn btn-xs btn-ghost text-success" onclick={() => saveCellEdit()} title="Save">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											</button>
											<button class="btn btn-xs btn-ghost text-error" onclick={() => cancelCellEdit()} title="Cancel">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										{/if}
									</div>
								{:else}
									<div 
										class="cursor-pointer hover:bg-base-200 px-2 py-1 rounded transition-all duration-150 border border-transparent hover:border-base-300" 
										onclick={() => startEditingCell(entry, 'additional_pay')}
									>
										{formatCurrency(entry.additional_pay || 0)}
									</div>
								{/if}
							</td>
							
							<!-- Additional Pay Reason -->
							<td class="relative group">
								{#if isEditingCell(entry.id!, 'additional_pay_reason') || isNew}
									<div class="flex items-center gap-1">
										{#if editData.additional_pay_reason === 'Other'}
											<input
												type="text"
												class="input input-bordered input-xs flex-1"
												value={editData.additional_pay_reason || ''}
												placeholder="Enter reason..."
												oninput={(e) => updateField(entry.id!, 'additional_pay_reason', e.currentTarget.value)}
												onkeydown={(e) => handleKeyDown(e, entry.id!, 'additional_pay_reason')}
											/>
										{:else}
											<select
												class="select select-bordered select-xs flex-1"
												value={editData.additional_pay_reason || ''}
												onchange={(e) => updateField(entry.id!, 'additional_pay_reason', e.currentTarget.value)}
											>
												<option value="">-</option>
												{#each additionalPayReasons as reason}
													<option value={reason}>{reason}</option>
												{/each}
											</select>
										{/if}
										{#if !isNew}
											<button class="btn btn-xs btn-ghost text-success" onclick={() => saveCellEdit()} title="Save">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											</button>
											<button class="btn btn-xs btn-ghost text-error" onclick={() => cancelCellEdit()} title="Cancel">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										{/if}
									</div>
								{:else}
									<div 
										class="cursor-pointer hover:bg-base-200 hover:shadow-sm px-2 py-1 rounded truncate transition-all duration-150 border border-transparent hover:border-base-300" 
										onclick={() => startEditingCell(entry, 'additional_pay_reason')}
									>
										<span class="text-xs">
											{entry.additional_pay_reason || '-'}
										</span>
									</div>
								{/if}
							</td>
							
							<!-- Total Pay -->
							<td class="font-semibold">
								{formatCurrency(calculateTotalPay(editData || entry))}
							</td>
							
							<!-- Artist Service Hours -->
							<td class="relative group">
								{#if isEditingCell(entry.id!, 'insperity_hours') || isNew}
									<div class="flex items-center gap-1">
										<input
											type="number"
											class="input input-bordered input-xs flex-1"
											value={editData.insperity_hours || editData.hours}
											min="0"
											step="0.5"
											oninput={(e) => updateField(entry.id!, 'insperity_hours', Number(e.currentTarget.value))}
											onkeydown={(e) => handleKeyDown(e, entry.id!, 'insperity_hours')}
										/>
										{#if !isNew}
											<button class="btn btn-xs btn-ghost text-success" onclick={() => saveCellEdit()} title="Save">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											</button>
											<button class="btn btn-xs btn-ghost text-error" onclick={() => cancelCellEdit()} title="Cancel">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										{/if}
									</div>
								{:else}
									<div 
										class="cursor-pointer hover:bg-base-200 px-2 py-1 rounded transition-all duration-150 border border-transparent hover:border-base-300" 
										onclick={() => startEditingCell(entry, 'insperity_hours')}
									>
										{entry.insperity_hours || entry.hours || 0}
									</div>
								{/if}
							</td>
							
							<!-- Paid Date -->
							<td class="relative group">
								{#if isEditingCell(entry.id!, 'paid_date') || isNew}
									<div class="flex items-center gap-1">
										<input
											type="date"
											class="input input-bordered input-xs flex-1"
											value={editData.paid_date || ''}
											oninput={(e) => updateField(entry.id!, 'paid_date', e.currentTarget.value)}
											onkeydown={(e) => handleKeyDown(e, entry.id!, 'paid_date')}
										/>
										{#if !isNew}
											<button class="btn btn-xs btn-ghost text-success" onclick={() => saveCellEdit()} title="Save">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											</button>
											<button class="btn btn-xs btn-ghost text-error" onclick={() => cancelCellEdit()} title="Cancel">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										{/if}
									</div>
								{:else}
									<div 
										class="cursor-pointer hover:bg-base-200 px-2 py-1 rounded transition-all duration-150 border border-transparent hover:border-base-300" 
										onclick={() => startEditingCell(entry, 'paid_date')}
									>
										{entry.paid_date ? formatDate(entry.paid_date) : '-'}
									</div>
								{/if}
							</td>
							
							<!-- Status -->
							<td class="relative group">
								{#if isEditingCell(entry.id!, 'status') || isNew}
									<div class="flex items-center gap-1">
										<select
											class="select select-bordered select-xs flex-1"
											value={editData.status}
											onchange={(e) => updateField(entry.id!, 'status', e.currentTarget.value)}
										>
											{#each Object.values(PaymentStatus) as status}
												<option value={status}>{status}</option>
											{/each}
										</select>
										{#if !isNew}
											<button class="btn btn-xs btn-ghost text-success" onclick={() => saveCellEdit()} title="Save">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											</button>
											<button class="btn btn-xs btn-ghost text-error" onclick={() => cancelCellEdit()} title="Cancel">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										{/if}
									</div>
								{:else}
									<div 
										class="cursor-pointer hover:bg-base-200 px-2 py-1 rounded transition-all duration-150 border border-transparent hover:border-base-300" 
										onclick={() => startEditingCell(entry, 'status')}
									>
										<PaymentStatusBadge status={entry.status} size="xs" />
									</div>
								{/if}
							</td>
							
							<!-- Source -->
							<td>
								{#if entry.creation_method === 'event-automation' && (entry.source_event_id || entry.event_id)}
									<a
										href="/events?selected={entry.source_event_id || entry.event_id}&tab=payroll"
										class="tooltip flex items-center gap-1 hover:text-primary"
										data-tip="View source event #{entry.source_event_id || entry.event_id}"
									>
										<span class="badge badge-info badge-xs">Auto</span>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
										</svg>
									</a>
								{:else if entry.source_event_id || entry.event_id}
									<a
										href="/events?selected={entry.source_event_id || entry.event_id}&tab=payroll"
										class="tooltip flex items-center gap-1 hover:text-primary"
										data-tip="View linked event #{entry.source_event_id || entry.event_id}"
									>
										<span class="badge badge-outline badge-xs">Event</span>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
										</svg>
									</a>
								{:else if entry.creation_method === 'manual'}
									<div class="tooltip" data-tip={`Created by ${entry.created_by || 'Unknown'}`}>
										<span class="badge badge-ghost badge-xs">Manual</span>
									</div>
								{:else}
									<span class="text-xs text-base-content/50">-</span>
								{/if}
							</td>
							
							<!-- Invoice Number -->
							<td class="relative group">
								{#if isEditingCell(entry.id!, 'invoice_number') || isNew}
									<div class="flex items-center gap-1">
										<input
											type="text"
											class="input input-bordered input-xs flex-1"
											value={editData.invoice_number || ''}
											oninput={(e) => updateField(entry.id!, 'invoice_number', e.currentTarget.value)}
											onkeydown={(e) => handleKeyDown(e, entry.id!, 'invoice_number')}
										/>
										{#if !isNew}
											<button class="btn btn-xs btn-ghost text-success" onclick={() => saveCellEdit()} title="Save">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											</button>
											<button class="btn btn-xs btn-ghost text-error" onclick={() => cancelCellEdit()} title="Cancel">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										{/if}
									</div>
								{:else}
									<div 
										class="cursor-pointer hover:bg-base-200 hover:shadow-sm px-2 py-1 rounded truncate transition-all duration-150 border border-transparent hover:border-base-300" 
										onclick={() => startEditingCell(entry, 'invoice_number')}
									>
										<span class="text-xs">
											{entry.invoice_number || '-'}
										</span>
									</div>
								{/if}
							</td>
							
							<!-- Notes -->
							<td class="relative group">
								{#if isEditingCell(entry.id!, 'notes') || isNew}
									<div class="flex items-center gap-1">
										<input
											type="text"
											class="input input-bordered input-xs flex-1"
											value={editData.notes || ''}
											oninput={(e) => updateField(entry.id!, 'notes', e.currentTarget.value)}
											onkeydown={(e) => handleKeyDown(e, entry.id!, 'notes')}
										/>
										{#if !isNew}
											<button class="btn btn-xs btn-ghost text-success" onclick={() => saveCellEdit()} title="Save">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											</button>
											<button class="btn btn-xs btn-ghost text-error" onclick={() => cancelCellEdit()} title="Cancel">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										{/if}
									</div>
								{:else}
									<div 
										class="cursor-pointer hover:bg-base-200 hover:shadow-sm px-2 py-1 rounded truncate transition-all duration-150 border border-transparent hover:border-base-300" 
										onclick={() => startEditingCell(entry, 'notes')}
										title={entry.notes}
									>
										<span class="text-xs">
											{entry.notes || '-'}
										</span>
									</div>
								{/if}
							</td>
							
							<!-- Actions -->
							<td>
								{#if editingRows.has(entry.id!) || isNew}
									<div class="flex gap-1">
										<button
											class="btn btn-success btn-xs"
											onclick={() => saveRow(entry.id!)}
											title="Save changes"
										>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
										</button>
										<button
											class="btn btn-error btn-xs"
											onclick={() => cancelEditing(entry.id!)}
											title="Cancel"
										>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								{:else if typeof entry.id === 'number'}
									<div class="flex gap-1">
										<button
											class="btn btn-ghost btn-xs text-error"
											onclick={() => deleteRow(entry.id as number)}
											title="Delete"
										>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
											</svg>
										</button>
									</div>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if pagination && pagination.totalPages > 1}
			<div class="flex flex-col sm:flex-row items-center justify-between gap-4">
				<div class="text-sm text-base-content/60">
					Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to {Math.min(pagination.currentPage * pagination.limit, pagination.total)} of {pagination.total} entries
				</div>
				
				<div class="join">
					<button 
						class="join-item btn btn-sm"
						disabled={pagination.currentPage <= 1}
						onclick={() => dispatch('pageChange', { page: pagination.currentPage - 1 })}
					>
						Previous
					</button>
					
					{#each Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
						const totalPages = pagination.totalPages
						const current = pagination.currentPage
						if (totalPages <= 7) return i + 1
						if (current <= 4) return i + 1
						if (current >= totalPages - 3) return totalPages - 6 + i
						return current - 3 + i
					}) as pageNum}
						<button 
							class="join-item btn btn-sm"
							class:btn-active={pageNum === pagination.currentPage}
							onclick={() => dispatch('pageChange', { page: pageNum })}
						>
							{pageNum}
						</button>
					{/each}
					
					<button 
						class="join-item btn btn-sm"
						disabled={pagination.currentPage >= pagination.totalPages}
						onclick={() => dispatch('pageChange', { page: pagination.currentPage + 1 })}
					>
						Next
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	/* Base table cell padding */
	:global(.table-sm td) {
		padding: 0.5rem;
	}
	
	/* Text size adjustments for table */
	:global(.table.text-xs) {
		font-size: 0.75rem;
	}
	:global(.table.text-xs input, .table.text-xs select) {
		font-size: 0.75rem;
		height: 1.75rem;
		padding: 0.25rem 0.5rem;
	}
	
	:global(.table.text-sm) {
		font-size: 0.875rem;
	}
	:global(.table.text-sm input, .table.text-sm select) {
		font-size: 0.875rem;
		height: 2rem;
		padding: 0.25rem 0.5rem;
	}
	
	:global(.table.text-base) {
		font-size: 1rem;
	}
	:global(.table.text-base input, .table.text-base select) {
		font-size: 1rem;
		height: 2.25rem;
		padding: 0.375rem 0.75rem;
	}
	
	:global(.table.text-lg) {
		font-size: 1.125rem;
	}
	:global(.table.text-lg input, .table.text-lg select) {
		font-size: 1.125rem;
		height: 2.5rem;
		padding: 0.5rem 0.75rem;
	}
	
	/* Keep badges consistent size */
	:global(.table .badge) {
		font-size: 0.75rem;
	}
</style>