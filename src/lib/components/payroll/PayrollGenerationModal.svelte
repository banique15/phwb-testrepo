<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte'
	import { Calendar, Loader2, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Settings } from 'lucide-svelte'
	import { 
		previewPayrollGeneration, 
		generatePayrollForDateRange,
		getWeekMonday,
		getWeekSunday 
	} from '$lib/services/payroll-generator'
	import type { PayrollGenerationResult, GeneratedPayrollEntry, RateCard } from '$lib/schemas/rate-card'
	import { supabase } from '$lib/supabase'
	import { toast } from '$lib/stores/toast'
	import { computeEntryTotalPay } from '$lib/utils/payrollTotals'

	interface Props {
		isOpen: boolean
	}

	let { isOpen = $bindable() }: Props = $props()

	const dispatch = createEventDispatcher<{
		generated: void
		close: void
	}>()

	// Week selection
	let selectedWeekDate = $state<string>(getLastWeekDate())
	let previewResult = $state<PayrollGenerationResult | null>(null)
	let isLoading = $state(false)
	let isGenerating = $state(false)
	let errorMessage = $state<string | null>(null)
	let showDetails = $state(false)
	
	// Rate card selection
	let rateCards = $state<RateCard[]>([])
	let selectedRateCardId = $state<number | null>(null)
	let showRateOverrides = $state(false)
	
	// Manual rate overrides per entry (entry index -> rate override)
	let rateOverrides = $state<Map<number, { rate?: number; additionalPay?: number }>>(new Map())

	function recalculateEntryTotal(entry: GeneratedPayrollEntry): number {
		return computeEntryTotalPay({
			hours: entry.hours,
			rate: entry.rate,
			base_rate: entry.base_rate,
			rate_type: entry.rate_type || undefined,
			additional_rate: entry.additional_rate || undefined,
			additional_pay: entry.additional_pay
		})
	}

	// Computed week range
	let weekRange = $derived(() => {
		const date = new Date(selectedWeekDate)
		const monday = getWeekMonday(date)
		const sunday = getWeekSunday(date)
		return {
			start: monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
			end: sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
			monday,
			sunday
		}
	})

	function getLastWeekDate(): string {
		const today = new Date()
		const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
		return lastWeek.toISOString().split('T')[0]
	}
	
	// Load available rate cards
	async function loadRateCards() {
		const { data, error } = await supabase
			.from('phwb_rate_cards')
			.select('*')
			.order('effective_date', { ascending: false })
		
		if (!error && data) {
			rateCards = data
			// Select the active rate card by default
			const activeCard = data.find(c => c.is_active)
			if (activeCard) {
				selectedRateCardId = activeCard.id
			}
		}
	}
	
	// Update rate override for an entry
	function setRateOverride(index: number, field: 'rate' | 'additionalPay', value: number) {
		const current = rateOverrides.get(index) || {}
		current[field] = value
		rateOverrides.set(index, current)
		rateOverrides = new Map(rateOverrides)
		
		// Update the preview entry with the override
		if (previewResult?.entries[index]) {
			if (field === 'rate') {
				previewResult.entries[index].rate = value
			} else {
				previewResult.entries[index].additional_pay = value
			}
			previewResult.entries[index].total_pay = recalculateEntryTotal(previewResult.entries[index])
			// Recalculate total amount
			previewResult.totalAmount = previewResult.entries.reduce((sum, e) => sum + e.total_pay, 0)
			previewResult = { ...previewResult }
		}
	}
	
	// Check if entry has override
	function hasOverride(index: number): boolean {
		return rateOverrides.has(index)
	}
	
	// Clear rate override
	function clearOverride(index: number) {
		rateOverrides.delete(index)
		rateOverrides = new Map(rateOverrides)
		// Reload preview to reset rates
		loadPreview()
	}
	
	onMount(() => {
		loadRateCards()
	})

	async function loadPreview() {
		isLoading = true
		errorMessage = null
		previewResult = null

		try {
			const range = weekRange()
			previewResult = await previewPayrollGeneration(range.monday, range.sunday)
			
			if (!previewResult.success && previewResult.errors.length > 0) {
				errorMessage = previewResult.errors[0]
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to load preview'
		} finally {
			isLoading = false
		}
	}

	async function handleGenerate() {
		if (!previewResult || previewResult.entries.length === 0) return

		isGenerating = true
		errorMessage = null

		try {
			const { data: { user } } = await supabase.auth.getUser()
			if (!user) {
				throw new Error('User not authenticated')
			}

			const range = weekRange()
			
			// Apply rate overrides to entries before generating
			const entriesWithOverrides = previewResult.entries.map((entry, index) => {
				const override = rateOverrides.get(index)
				if (override) {
					const updatedEntry: GeneratedPayrollEntry = {
						...entry,
						rate: override.rate ?? entry.rate,
						additional_pay: override.additionalPay ?? entry.additional_pay
					}
					return {
						...updatedEntry,
						total_pay: recalculateEntryTotal(updatedEntry),
						notes: entry.notes + (override.rate ? ` (Rate manually overridden to $${override.rate})` : '')
					}
				}
				return entry
			})
			
			const result = await generatePayrollForDateRange(range.monday, range.sunday, {
				dryRun: false,
				userId: user.id,
				rateCardId: selectedRateCardId || undefined,
				overriddenEntries: entriesWithOverrides
			})

			if (result.success) {
				toast.success(`Generated ${result.entriesCreated} payroll entries`)
				dispatch('generated')
				close()
			} else if (result.errors.length > 0) {
				errorMessage = result.errors.join('\n')
				toast.error('Some errors occurred during generation')
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to generate payroll'
			toast.error('Failed to generate payroll')
		} finally {
			isGenerating = false
		}
	}

	function close() {
		isOpen = false
		previewResult = null
		errorMessage = null
		rateOverrides.clear()
		showRateOverrides = false
		dispatch('close')
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount)
	}

	type IndexedEntry = { index: number; entry: GeneratedPayrollEntry }
	type EntryGroup = {
		eventId: number
		eventDate: string
		ensembleGroups: Array<{ key: string; name: string; entries: IndexedEntry[] }>
		ungroupedEntries: IndexedEntry[]
	}

	// Group entries by event, then by ensemble for display.
	function groupEntriesByEvent(entries: GeneratedPayrollEntry[]): EntryGroup[] {
		const indexed = entries.map((entry, index) => ({ entry, index }))
		const byEvent = new Map<number, IndexedEntry[]>()

		for (const row of indexed) {
			const eventId = row.entry.event_id
			if (!byEvent.has(eventId)) byEvent.set(eventId, [])
			byEvent.get(eventId)!.push(row)
		}

		const groups: EntryGroup[] = []
		for (const [eventId, rows] of byEvent.entries()) {
			const ensembleMap = new Map<string, { key: string; name: string; entries: IndexedEntry[] }>()
			const ungroupedEntries: IndexedEntry[] = []

			for (const row of rows) {
				const entry = row.entry
				const groupId = entry.ensemble_id || entry.rollup_group_id
				const groupName = entry.ensemble_name || entry.rollup_group_name
				if (!groupId && !groupName) {
					ungroupedEntries.push(row)
					continue
				}
				const key = groupId || `name:${groupName}`
				if (!ensembleMap.has(key)) {
					ensembleMap.set(key, {
						key,
						name: groupName || 'Ensemble Group',
						entries: []
					})
				}
				ensembleMap.get(key)!.entries.push(row)
			}

			groups.push({
				eventId,
				eventDate: rows[0]?.entry.event_date || '',
				ensembleGroups: Array.from(ensembleMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
				ungroupedEntries
			})
		}

		return groups.sort((a, b) => a.eventDate.localeCompare(b.eventDate))
	}

	// Load preview when week changes
	$effect(() => {
		if (isOpen && selectedWeekDate) {
			loadPreview()
		}
	})
</script>

{#if isOpen}
	<div class="modal modal-open">
		<div class="modal-box max-w-4xl">
			<button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onclick={close}>✕</button>
			
			<h3 class="font-bold text-lg flex items-center gap-2">
				<Calendar class="w-5 h-5" />
				Generate Weekly Payroll
			</h3>
			
			<div class="py-4">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
					<!-- Week Selector -->
					<div class="form-control w-full">
						<label class="label">
							<span class="label-text font-medium">Select Week</span>
						</label>
						<input
							type="date"
							class="input input-bordered"
							bind:value={selectedWeekDate}
						/>
						<label class="label">
							<span class="label-text-alt">
								Week of {weekRange().start} - {weekRange().end}
							</span>
						</label>
					</div>
					
					<!-- Rate Card Selector -->
					<div class="form-control w-full">
						<label class="label">
							<span class="label-text font-medium">Rate Card</span>
						</label>
						<select 
							class="select select-bordered"
							bind:value={selectedRateCardId}
							onchange={() => loadPreview()}
						>
							{#each rateCards as card}
								<option value={card.id}>
									{card.name} {card.is_active ? '(Active)' : ''} - Effective: {card.effective_date}
								</option>
							{/each}
						</select>
						<label class="label">
							<span class="label-text-alt">
								{#if selectedRateCardId}
									Using rate rules from selected card
								{:else}
									No rate card selected
								{/if}
							</span>
						</label>
					</div>
				</div>

				<!-- Loading State -->
				{#if isLoading}
					<div class="flex items-center justify-center py-8">
						<Loader2 class="w-8 h-8 animate-spin text-primary" />
						<span class="ml-3">Loading preview...</span>
					</div>
				{:else if errorMessage}
					<!-- Error Message -->
					<div class="alert alert-error">
						<AlertTriangle class="w-5 h-5" />
						<span>{errorMessage}</span>
					</div>
				{:else if previewResult}
					<!-- Preview Results -->
					<div class="space-y-4">
						<!-- Summary Stats -->
						<div class="stats stats-vertical lg:stats-horizontal shadow w-full">
							<div class="stat">
								<div class="stat-title">Events to Process</div>
								<div class="stat-value text-primary">{previewResult.eventsProcessed}</div>
								<div class="stat-desc">{previewResult.skippedEvents} already processed</div>
							</div>
							
							<div class="stat">
								<div class="stat-title">Payroll Entries</div>
								<div class="stat-value">{previewResult.entries.length}</div>
								<div class="stat-desc">To be created</div>
							</div>
							
							<div class="stat">
								<div class="stat-title">Total Amount</div>
								<div class="stat-value text-secondary">{formatCurrency(previewResult.totalAmount)}</div>
								<div class="stat-desc">Estimated payroll</div>
							</div>
						</div>

						{#if previewResult.entries.length > 0}
							<!-- Entry Details Toggle -->
							<div class="flex gap-2 mb-2">
								<button
									class="btn btn-ghost btn-sm flex-1 justify-between"
									onclick={() => showDetails = !showDetails}
								>
									<span>View Entry Details ({previewResult.entries.length} entries)</span>
									{#if showDetails}
										<ChevronUp class="w-4 h-4" />
									{:else}
										<ChevronDown class="w-4 h-4" />
									{/if}
								</button>
								{#if showDetails}
									<button
										class="btn btn-ghost btn-sm"
										class:btn-active={showRateOverrides}
										onclick={() => showRateOverrides = !showRateOverrides}
										title="Toggle rate override mode"
									>
										<Settings class="w-4 h-4" />
										{showRateOverrides ? 'Hide Overrides' : 'Override Rates'}
									</button>
								{/if}
							</div>

							{#if showDetails}
								<div class="max-h-64 overflow-y-auto space-y-3 border rounded-lg p-2">
									{#each groupEntriesByEvent(previewResult.entries) as eventGroup}
										<div class="rounded-lg border border-base-300">
											<div class="px-3 py-2 border-b border-base-300 bg-base-200/50 text-sm font-semibold">
												Event #{eventGroup.eventId} - {eventGroup.eventDate}
											</div>
											<div class="p-2 space-y-2">
												{#each eventGroup.ensembleGroups as ensembleGroup}
													<div class="rounded border border-primary/30">
														<div class="px-3 py-2 text-xs font-medium border-b border-base-300">
															{ensembleGroup.name} ({ensembleGroup.entries.length} member{ensembleGroup.entries.length === 1 ? '' : 's'})
														</div>
														<div class="overflow-x-auto">
															<table class="table table-sm">
																<thead class="bg-base-100">
																	<tr>
																		<th>Artist</th>
																		<th>Hours</th>
																		<th>Rate {showRateOverrides ? '(Editable)' : ''}</th>
																		<th>Add'l Pay {showRateOverrides ? '(Editable)' : ''}</th>
																		<th>Total</th>
																		{#if showRateOverrides}
																			<th>Actions</th>
																		{/if}
																	</tr>
																</thead>
																<tbody>
																	{#each ensembleGroup.entries as row}
																		{@const entry = row.entry}
																		{@const index = row.index}
																		<tr class:bg-warning={hasOverride(index)} class:bg-opacity-20={hasOverride(index)}>
																			<td class="font-medium">
																				{entry.artist_name}
																				{#if entry.rolled_into_bandleader}
																					<span class="badge badge-warning badge-xs ml-2">Rolled to Bandleader</span>
																				{/if}
																				{#if (entry.rollup_member_count || 0) > 0}
																					<span class="badge badge-info badge-xs ml-2">Bandleader (+{entry.rollup_member_count})</span>
																				{/if}
																				{#if entry.rolled_into_bandleader && entry.rollup_owner_name}
																					<div class="text-xs opacity-70 mt-1">Paid via {entry.rollup_owner_name}</div>
																				{/if}
																			</td>
																			<td>{entry.hours}h</td>
																			<td>
																				{#if showRateOverrides}
																					<input
																						type="number"
																						class="input input-bordered input-xs w-20"
																						value={entry.rate}
																						min="0"
																						step="5"
																						onchange={(e) => setRateOverride(index, 'rate', parseFloat(e.currentTarget.value) || 0)}
																					/>
																				{:else}
																					{formatCurrency(entry.rate)}
																				{/if}
																			</td>
																			<td>
																				{#if showRateOverrides}
																					<input
																						type="number"
																						class="input input-bordered input-xs w-20"
																						value={entry.additional_pay}
																						min="0"
																						step="5"
																						onchange={(e) => setRateOverride(index, 'additionalPay', parseFloat(e.currentTarget.value) || 0)}
																					/>
																				{:else if entry.additional_pay > 0}
																					<span class="badge badge-sm badge-success">
																						+{formatCurrency(entry.additional_pay)}
																					</span>
																				{:else}
																					-
																				{/if}
																			</td>
																			<td class="font-bold">{formatCurrency(entry.total_pay)}</td>
																			{#if showRateOverrides}
																				<td>
																					{#if hasOverride(index)}
																						<button
																							class="btn btn-ghost btn-xs text-warning"
																							onclick={() => clearOverride(index)}
																							title="Reset to calculated rate"
																						>
																							Reset
																						</button>
																					{/if}
																				</td>
																			{/if}
																		</tr>
																	{/each}
																</tbody>
															</table>
														</div>
													</div>
												{/each}

												{#if eventGroup.ungroupedEntries.length > 0}
													<div class="rounded border border-base-300">
														<div class="px-3 py-2 text-xs font-medium border-b border-base-300">Individual / Non-ensemble</div>
														<div class="overflow-x-auto">
															<table class="table table-sm">
																<thead class="bg-base-100">
																	<tr>
																		<th>Artist</th>
																		<th>Hours</th>
																		<th>Rate {showRateOverrides ? '(Editable)' : ''}</th>
																		<th>Add'l Pay {showRateOverrides ? '(Editable)' : ''}</th>
																		<th>Total</th>
																		{#if showRateOverrides}
																			<th>Actions</th>
																		{/if}
																	</tr>
																</thead>
																<tbody>
																	{#each eventGroup.ungroupedEntries as row}
																		{@const entry = row.entry}
																		{@const index = row.index}
																		<tr class:bg-warning={hasOverride(index)} class:bg-opacity-20={hasOverride(index)}>
																			<td class="font-medium">
																				{entry.artist_name}
																				{#if entry.is_production_manager}
																					<span class="badge badge-secondary badge-xs ml-2">PM</span>
																				{/if}
																			</td>
																			<td>{entry.hours}h</td>
																			<td>
																				{#if showRateOverrides}
																					<input
																						type="number"
																						class="input input-bordered input-xs w-20"
																						value={entry.rate}
																						min="0"
																						step="5"
																						onchange={(e) => setRateOverride(index, 'rate', parseFloat(e.currentTarget.value) || 0)}
																					/>
																				{:else}
																					{formatCurrency(entry.rate)}
																				{/if}
																			</td>
																			<td>
																				{#if showRateOverrides}
																					<input
																						type="number"
																						class="input input-bordered input-xs w-20"
																						value={entry.additional_pay}
																						min="0"
																						step="5"
																						onchange={(e) => setRateOverride(index, 'additionalPay', parseFloat(e.currentTarget.value) || 0)}
																					/>
																				{:else if entry.additional_pay > 0}
																					<span class="badge badge-sm badge-success">
																						+{formatCurrency(entry.additional_pay)}
																					</span>
																				{:else}
																					-
																				{/if}
																			</td>
																			<td class="font-bold">{formatCurrency(entry.total_pay)}</td>
																			{#if showRateOverrides}
																				<td>
																					{#if hasOverride(index)}
																						<button
																							class="btn btn-ghost btn-xs text-warning"
																							onclick={() => clearOverride(index)}
																							title="Reset to calculated rate"
																						>
																							Reset
																						</button>
																					{/if}
																				</td>
																			{/if}
																		</tr>
																	{/each}
																</tbody>
															</table>
														</div>
													</div>
												{/if}
											</div>
										</div>
									{/each}
								</div>
								
								{#if rateOverrides.size > 0}
									<div class="alert alert-warning mt-2">
										<AlertTriangle class="w-4 h-4" />
										<span class="text-sm">
											{rateOverrides.size} {rateOverrides.size === 1 ? 'entry has' : 'entries have'} manual rate overrides
										</span>
									</div>
								{/if}
							{/if}

							<!-- Warnings/Notes -->
							{#if previewResult.errors.length > 0}
								<div class="alert alert-warning">
									<AlertTriangle class="w-5 h-5" />
									<div>
										<h4 class="font-bold">Warnings</h4>
										<ul class="list-disc list-inside text-sm">
											{#each previewResult.errors as warning}
												<li>{warning}</li>
											{/each}
										</ul>
									</div>
								</div>
							{/if}
						{:else}
							<div class="alert">
								<CheckCircle class="w-5 h-5" />
								<span>No new payroll entries to generate for this week. All events have been processed.</span>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={close}>Cancel</button>
				<button
					class="btn btn-primary"
					disabled={isLoading || isGenerating || !previewResult || previewResult.entries.length === 0}
					onclick={handleGenerate}
				>
					{#if isGenerating}
						<Loader2 class="w-4 h-4 animate-spin mr-2" />
						Generating...
					{:else}
						<CheckCircle class="w-4 h-4 mr-2" />
						Generate {previewResult?.entries.length || 0} Entries
					{/if}
				</button>
			</div>
		</div>
		<div class="modal-backdrop bg-black/50" onclick={close}></div>
	</div>
{/if}
