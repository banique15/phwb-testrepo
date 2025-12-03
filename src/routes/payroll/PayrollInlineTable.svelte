<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import type { Payroll, CreatePayroll, UpdatePayroll } from '$lib/schemas/payroll'
	import { payrollStore } from '$lib/stores/payroll'
	import { artistsStore } from '$lib/stores/artists'
	import { venuesStore } from '$lib/stores/venues'
	import { artistLookup, venueLookup } from '$lib/stores/lookup'
	import { PaymentStatus, PaymentType, EmployeeContractorStatus } from '$lib/schemas/payroll'
	import { DollarSign } from 'lucide-svelte'
	import PaymentStatusBadge from '$lib/components/payroll/PaymentStatusBadge.svelte'
	import ArtistSelector from '$lib/components/ui/ArtistSelector.svelte'
	import { onMount } from 'svelte'
	import { browser } from '$app/environment'
	import { supabase } from '$lib/supabase'
	
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

	// Editing state
	let editingRows = $state<Map<number | 'new', Partial<Payroll>>>(new Map())
	let editingCell = $state<{ id: number | string, field: string } | null>(null)
	let newRowCounter = $state(0)
	
	// Venue type colors
	const venueTypeColors: Record<string, string> = {
		'Healing Arts': 'text-green-600',
		'Creative Placemaking': 'text-blue-600',
		'Training': 'text-purple-600',
		'Administrative': 'text-gray-600'
	}
	
	// Rate options
	const rateOptions = [
		{ value: 25, label: '$25/hr' },
		{ value: 35, label: '$35/hr' },
		{ value: 50, label: '$50/hr' },
		{ value: 75, label: '$75/hr' },
		{ value: 100, label: '$100/hr' },
		{ value: 125, label: '$125/hr' },
		{ value: 150, label: '$150/hr' },
	]
	
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
		
		// Subscribe to stores
		const unsubArtists = artistsStore.subscribe(state => {
			artists = state.items
		})
		
		const unsubVenues = venuesStore.subscribe(state => {
			venues = state.items
		})
		
		return () => {
			unsubArtists()
			unsubVenues()
		}
	})

	// Add new entry row
	function addNewEntry() {
		const tempId = `new-${newRowCounter++}`
		const today = new Date().toISOString().split('T')[0]
		
		editingRows.set(tempId, {
			event_date: today,
			artist_id: '',
			venue_id: undefined,
			hours: 0,
			rate: 35,
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
	function cancelEditing(id: number | string) {
		editingRows.delete(id)
		editingRows = new Map(editingRows)
		editingCell = null
	}
	
	// Cancel editing just the current cell
	function cancelCellEdit() {
		if (!editingCell) return
		
		const entry = entries.find(e => e.id === editingCell.id)
		if (entry && editingRows.has(editingCell.id)) {
			const editData = editingRows.get(editingCell.id)!
			editData[editingCell.field] = entry[editingCell.field]
			editingRows = new Map(editingRows)
		}
		
		editingCell = null
	}

	// Save row
	async function saveRow(id: number | string) {
		const editData = editingRows.get(id)
		if (!editData) return

		try {
			// Calculate total pay
			const totalPay = (editData.hours || 0) * (editData.rate || 0) + (editData.additional_pay || 0)
			editData.total_pay = totalPay
			
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
			} else {
				// Update existing entry
				await payrollStore.update(id as number, cleanedData as UpdatePayroll)
			}
			
			// Clear editing state
			editingRows.delete(id)
			editingRows = new Map(editingRows)
			editingCell = null
		} catch (error) {
			console.error('Failed to save payroll entry:', error)
			// TODO: Show error toast
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
			} catch (error) {
				console.error('Failed to delete payroll entry:', error)
			}
		}
	}

	// Update field value
	function updateField(id: number | string, field: string, value: any) {
		const current = editingRows.get(id) || {}
		current[field] = value
		
		// Auto-calculate insperity_hours when hours change
		if (field === 'hours' && !current.insperity_hours) {
			current.insperity_hours = value
		}
		
		editingRows.set(id, current)
		editingRows = new Map(editingRows)
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
		return new Date(dateStr).toLocaleDateString()
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount)
	}

	// Calculate total pay
	function calculateTotalPay(entry: Partial<Payroll>): number {
		const base = (entry.hours || 0) * (entry.rate || 0)
		return base + (entry.additional_pay || 0)
	}

	// Check if a specific cell is being edited
	function isEditingCell(entryId: number | string, field: string): boolean {
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

	// Keyboard navigation
	function handleKeyDown(event: KeyboardEvent, id: number | string, field: string) {
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
						<th class="w-20">Hours</th>
						<th class="w-24">Rate</th>
						<th class="w-24">Additional</th>
						<th class="w-32">Reason</th>
						<th class="w-24">Total</th>
						<th class="w-24">Insperity</th>
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
						<tr class:bg-warning={isNew} class:bg-opacity-20={isNew}>
							<td>
								{#if typeof entry.id === 'number'}
									<input
										type="checkbox"
										class="checkbox checkbox-xs"
										checked={selectedEntries.has(entry.id)}
										onchange={() => {
											const newSelected = new Set(selectedEntries)
											if (newSelected.has(entry.id as number)) {
												newSelected.delete(entry.id as number)
											} else {
												newSelected.add(entry.id as number)
											}
											dispatch('select', { entries: newSelected })
										}}
									/>
								{/if}
							</td>
							
							<!-- Event Date -->
							<td class="relative group">
								{#if isEditingCell(entry.id!, 'event_date') || isNew}
									<div class="flex items-center gap-1">
										<input
											type="date"
											class="input input-bordered input-xs flex-1"
											value={editData.event_date}
											oninput={(e) => updateField(entry.id!, 'event_date', e.currentTarget.value)}
											onkeydown={(e) => handleKeyDown(e, entry.id!, 'event_date')}
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
										onclick={() => startEditingCell(entry, 'event_date')}
									>
										{formatDate(entry.event_date)}
									</div>
								{/if}
							</td>
							
							<!-- Artist -->
							<td class="relative group">
								{#if isEditingCell(entry.id!, 'artist_id') || isNew}
									<div class="flex items-center gap-1">
										<select
											class="select select-bordered select-xs flex-1"
											value={editData.artist_id}
											onchange={(e) => updateField(entry.id!, 'artist_id', e.currentTarget.value)}
										>
											<option value="">Select artist...</option>
											{#each artists as artist}
												<option value={artist.id}>
													{artist.full_name || `${artist.legal_first_name} ${artist.legal_last_name}`}
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
										class="cursor-pointer hover:bg-base-200 hover:shadow-sm px-2 py-1 rounded truncate transition-all duration-150 border border-transparent hover:border-base-300" 
										onclick={() => startEditingCell(entry, 'artist_id')}
									>
										{entry.artists?.full_name || 
										 (entry.artists?.legal_first_name && entry.artists?.legal_last_name 
											? `${entry.artists.legal_first_name} ${entry.artists.legal_last_name}` 
											: 'N/A')}
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
							
							<!-- Rate -->
							<td class="relative group">
								{#if isEditingCell(entry.id!, 'rate') || isNew}
									<div class="flex items-center gap-1">
										<select
											class="select select-bordered select-xs flex-1"
											value={editData.rate}
											onchange={(e) => updateField(entry.id!, 'rate', Number(e.currentTarget.value))}
										>
											{#each rateOptions as option}
												<option value={option.value}>{option.label}</option>
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
										onclick={() => startEditingCell(entry, 'rate')}
									>
										{formatCurrency(entry.rate || 0)}
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
							
							<!-- Insperity Hours -->
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
								{@const eventId = entry.source_event_id || entry.event_id}
								{#if entry.creation_method === 'event-automation' && eventId}
									<a
										href="/events?selected={eventId}&tab=payroll"
										class="tooltip flex items-center gap-1 hover:text-primary"
										data-tip="View source event #{eventId}"
									>
										<span class="badge badge-info badge-xs">Auto</span>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
										</svg>
									</a>
								{:else if eventId}
									<a
										href="/events?selected={eventId}&tab=payroll"
										class="tooltip flex items-center gap-1 hover:text-primary"
										data-tip="View linked event #{eventId}"
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