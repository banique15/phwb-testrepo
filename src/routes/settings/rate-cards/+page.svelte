<script lang="ts">
	import { onMount } from 'svelte'
	import { supabase } from '$lib/supabase'
	import type { RateCard, RateRule, AdditionalFee } from '$lib/schemas/rate-card'
	import { ProgramType, RateType } from '$lib/schemas/rate-card'
	import { Loader2, Plus, Edit2, Trash2, Save, X, DollarSign, Settings } from 'lucide-svelte'

	// State
	let rateCards = $state<RateCard[]>([])
	let rateRules = $state<RateRule[]>([])
	let additionalFees = $state<AdditionalFee[]>([])
	let loading = $state(true)
	let saving = $state(false)
	let error = $state<string | null>(null)

	// Currently selected rate card
	let selectedCardId = $state<number | null>(null)
	let selectedCard = $derived(rateCards.find(c => c.id === selectedCardId))

	// Editing state
	let editingRule = $state<Partial<RateRule> | null>(null)
	let editingFee = $state<Partial<AdditionalFee> | null>(null)
	let isNewRule = $state(false)
	let isNewFee = $state(false)

	// Program type display names
	const programTypeLabels: Record<string, string> = {
		healing_arts: 'Healing Arts',
		transit_hub: 'Transit Hub',
		virtual_artist: 'Virtual Program (Artist)',
		virtual_teaching: 'Virtual Program (Teaching)',
		teaching_in_person: 'In-Person Teaching',
		newark_airport: 'Newark Airport',
		donor_event: 'Donor/Board Event',
		holiday_soloist: 'Holiday Soloist',
		holiday_group: 'Holiday Group/Chorus',
		holiday_special: 'Holiday Special',
		pm: 'Production Manager',
		training: 'Training',
		other: 'Other/Default'
	}

	// Load data
	onMount(async () => {
		await loadData()
	})

	async function loadData() {
		loading = true
		error = null

		try {
			// Load rate cards
			const { data: cards, error: cardsError } = await supabase
				.from('phwb_rate_cards')
				.select('*')
				.order('effective_date', { ascending: false })

			if (cardsError) throw cardsError
			rateCards = cards || []

			// Select active card by default
			const activeCard = rateCards.find(c => c.is_active)
			if (activeCard) {
				selectedCardId = activeCard.id
				await loadRulesAndFees(activeCard.id)
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load data'
		} finally {
			loading = false
		}
	}

	async function loadRulesAndFees(cardId: number) {
		// Load rate rules
		const { data: rules, error: rulesError } = await supabase
			.from('phwb_rate_rules')
			.select('*')
			.eq('rate_card_id', cardId)
			.order('program_type')

		if (rulesError) throw rulesError
		rateRules = rules || []

		// Load additional fees
		const { data: fees, error: feesError } = await supabase
			.from('phwb_additional_fees')
			.select('*')
			.eq('rate_card_id', cardId)
			.order('fee_type')

		if (feesError) throw feesError
		additionalFees = fees || []
	}

	async function selectCard(cardId: number) {
		selectedCardId = cardId
		await loadRulesAndFees(cardId)
	}

	function startEditRule(rule?: RateRule) {
		if (rule) {
			editingRule = { ...rule }
			isNewRule = false
		} else {
			editingRule = {
				rate_card_id: selectedCardId!,
				program_type: '',
				rate_type: 'hourly',
				hourly_rate: 0
			}
			isNewRule = true
		}
	}

	function cancelEditRule() {
		editingRule = null
		isNewRule = false
	}

	async function saveRule() {
		if (!editingRule || !selectedCardId) return

		saving = true
		error = null

		try {
			if (isNewRule) {
				const { error: insertError } = await supabase
					.from('phwb_rate_rules')
					.insert([editingRule])

				if (insertError) throw insertError
			} else {
				const { error: updateError } = await supabase
					.from('phwb_rate_rules')
					.update(editingRule)
					.eq('id', editingRule.id)

				if (updateError) throw updateError
			}

			await loadRulesAndFees(selectedCardId)
			editingRule = null
			isNewRule = false
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save rule'
		} finally {
			saving = false
		}
	}

	async function deleteRule(ruleId: number) {
		if (!confirm('Are you sure you want to delete this rate rule?')) return

		try {
			const { error: deleteError } = await supabase
				.from('phwb_rate_rules')
				.delete()
				.eq('id', ruleId)

			if (deleteError) throw deleteError

			await loadRulesAndFees(selectedCardId!)
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete rule'
		}
	}

	function startEditFee(fee?: AdditionalFee) {
		if (fee) {
			editingFee = { ...fee }
			isNewFee = false
		} else {
			editingFee = {
				rate_card_id: selectedCardId!,
				fee_type: '',
				amount: 0,
				min_musicians: null
			}
			isNewFee = true
		}
	}

	function cancelEditFee() {
		editingFee = null
		isNewFee = false
	}

	async function saveFee() {
		if (!editingFee || !selectedCardId) return

		saving = true
		error = null

		try {
			if (isNewFee) {
				const { error: insertError } = await supabase
					.from('phwb_additional_fees')
					.insert([editingFee])

				if (insertError) throw insertError
			} else {
				const { error: updateError } = await supabase
					.from('phwb_additional_fees')
					.update(editingFee)
					.eq('id', editingFee.id)

				if (updateError) throw updateError
			}

			await loadRulesAndFees(selectedCardId)
			editingFee = null
			isNewFee = false
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save fee'
		} finally {
			saving = false
		}
	}

	async function deleteFee(feeId: number) {
		if (!confirm('Are you sure you want to delete this additional fee?')) return

		try {
			const { error: deleteError } = await supabase
				.from('phwb_additional_fees')
				.delete()
				.eq('id', feeId)

			if (deleteError) throw deleteError

			await loadRulesAndFees(selectedCardId!)
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete fee'
		}
	}

	function formatCurrency(amount: number | null | undefined): string {
		if (amount === null || amount === undefined) return '-'
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount)
	}

	function formatRateDisplay(rule: RateRule): string {
		switch (rule.rate_type) {
			case 'hourly':
				return `${formatCurrency(rule.hourly_rate)}/hr`
			case 'tiered':
				return `${formatCurrency(rule.first_hour_rate)} first hr, ${formatCurrency(rule.subsequent_hour_rate)} after`
			case 'flat':
				return `${formatCurrency(rule.flat_rate)} flat`
			default:
				return '-'
		}
	}
</script>

<svelte:head>
	<title>Rate Cards | Settings</title>
</svelte:head>

<div class="container mx-auto p-6 max-w-6xl">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div class="flex items-center gap-3">
			<Settings class="w-8 h-8 text-primary" />
			<div>
				<h1 class="text-2xl font-bold">Rate Card Management</h1>
				<p class="text-base-content/60">Manage payroll rates by program type</p>
			</div>
		</div>
	</div>

	{#if error}
		<div class="alert alert-error mb-4">
			<span>{error}</span>
		</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<Loader2 class="w-8 h-8 animate-spin text-primary" />
		</div>
	{:else}
		<!-- Rate Card Selector -->
		<div class="card bg-base-200 mb-6">
			<div class="card-body">
				<h2 class="card-title text-lg">Select Rate Card</h2>
				<div class="flex flex-wrap gap-2">
					{#each rateCards as card}
						<button
							class="btn btn-sm {selectedCardId === card.id ? 'btn-primary' : 'btn-ghost'}"
							onclick={() => selectCard(card.id)}
						>
							{card.name}
							{#if card.is_active}
								<span class="badge badge-success badge-xs ml-1">Active</span>
							{/if}
						</button>
					{/each}
				</div>
				{#if selectedCard}
					<p class="text-sm text-base-content/60 mt-2">
						Effective: {new Date(selectedCard.effective_date).toLocaleDateString()}
						{selectedCard.expires_date ? ` - ${new Date(selectedCard.expires_date).toLocaleDateString()}` : ''}
					</p>
				{/if}
			</div>
		</div>

		{#if selectedCardId}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Rate Rules Section -->
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<div class="flex justify-between items-center">
							<h2 class="card-title">
								<DollarSign class="w-5 h-5" />
								Rate Rules
							</h2>
							<button 
								class="btn btn-primary btn-sm"
								onclick={() => startEditRule()}
							>
								<Plus class="w-4 h-4" />
								Add Rule
							</button>
						</div>

						<div class="overflow-x-auto">
							<table class="table table-sm">
								<thead>
									<tr>
										<th>Program Type</th>
										<th>Rate Type</th>
										<th>Rate</th>
										<th>Actions</th>
									</tr>
								</thead>
								<tbody>
									{#each rateRules as rule}
										<tr>
											<td class="font-medium">
												{programTypeLabels[rule.program_type] || rule.program_type}
											</td>
											<td>
												<span class="badge badge-outline badge-sm">
													{rule.rate_type}
												</span>
											</td>
											<td>{formatRateDisplay(rule)}</td>
											<td>
												<div class="flex gap-1">
													<button 
														class="btn btn-ghost btn-xs"
														onclick={() => startEditRule(rule)}
													>
														<Edit2 class="w-3 h-3" />
													</button>
													<button 
														class="btn btn-ghost btn-xs text-error"
														onclick={() => deleteRule(rule.id)}
													>
														<Trash2 class="w-3 h-3" />
													</button>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>

				<!-- Additional Fees Section -->
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<div class="flex justify-between items-center">
							<h2 class="card-title">
								<Plus class="w-5 h-5" />
								Additional Fees
							</h2>
							<button 
								class="btn btn-primary btn-sm"
								onclick={() => startEditFee()}
							>
								<Plus class="w-4 h-4" />
								Add Fee
							</button>
						</div>

						<div class="overflow-x-auto">
							<table class="table table-sm">
								<thead>
									<tr>
										<th>Fee Type</th>
										<th>Amount</th>
										<th>Min Musicians</th>
										<th>Actions</th>
									</tr>
								</thead>
								<tbody>
									{#each additionalFees as fee}
										<tr>
											<td class="font-medium capitalize">
												{fee.fee_type.replace('_', ' ')}
											</td>
											<td>{formatCurrency(fee.amount)}</td>
											<td>
												{fee.min_musicians ? `${fee.min_musicians}+` : '-'}
											</td>
											<td>
												<div class="flex gap-1">
													<button 
														class="btn btn-ghost btn-xs"
														onclick={() => startEditFee(fee)}
													>
														<Edit2 class="w-3 h-3" />
													</button>
													<button 
														class="btn btn-ghost btn-xs text-error"
														onclick={() => deleteFee(fee.id)}
													>
														<Trash2 class="w-3 h-3" />
													</button>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Edit Rule Modal -->
{#if editingRule}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">
				{isNewRule ? 'Add Rate Rule' : 'Edit Rate Rule'}
			</h3>
			
			<div class="py-4 space-y-4">
				<!-- Program Type -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Program Type</span>
					</label>
					<select 
						class="select select-bordered w-full"
						bind:value={editingRule.program_type}
					>
						<option value="">Select program type...</option>
						{#each Object.entries(programTypeLabels) as [value, label]}
							<option {value}>{label}</option>
						{/each}
					</select>
				</div>

				<!-- Rate Type -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Rate Type</span>
					</label>
					<select 
						class="select select-bordered w-full"
						bind:value={editingRule.rate_type}
					>
						<option value="hourly">Hourly</option>
						<option value="tiered">Tiered (First Hour Different)</option>
						<option value="flat">Flat Rate</option>
					</select>
				</div>

				<!-- Rate Fields based on type -->
				{#if editingRule.rate_type === 'hourly'}
					<div class="form-control">
						<label class="label">
							<span class="label-text">Hourly Rate ($)</span>
						</label>
						<input 
							type="number"
							class="input input-bordered"
							bind:value={editingRule.hourly_rate}
							step="0.01"
							min="0"
						/>
					</div>
				{:else if editingRule.rate_type === 'tiered'}
					<div class="grid grid-cols-2 gap-4">
						<div class="form-control">
							<label class="label">
								<span class="label-text">First Hour Rate ($)</span>
							</label>
							<input 
								type="number"
								class="input input-bordered"
								bind:value={editingRule.first_hour_rate}
								step="0.01"
								min="0"
							/>
						</div>
						<div class="form-control">
							<label class="label">
								<span class="label-text">Subsequent Hour Rate ($)</span>
							</label>
							<input 
								type="number"
								class="input input-bordered"
								bind:value={editingRule.subsequent_hour_rate}
								step="0.01"
								min="0"
							/>
						</div>
					</div>
				{:else if editingRule.rate_type === 'flat'}
					<div class="form-control">
						<label class="label">
							<span class="label-text">Flat Rate ($)</span>
						</label>
						<input 
							type="number"
							class="input input-bordered"
							bind:value={editingRule.flat_rate}
							step="0.01"
							min="0"
						/>
					</div>
				{/if}

				<!-- Description -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Description</span>
					</label>
					<input 
						type="text"
						class="input input-bordered"
						bind:value={editingRule.description}
						placeholder="Optional description..."
					/>
				</div>

				<!-- Notes -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Notes</span>
					</label>
					<textarea 
						class="textarea textarea-bordered"
						bind:value={editingRule.notes}
						placeholder="Optional notes..."
					></textarea>
				</div>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={cancelEditRule}>
					<X class="w-4 h-4 mr-2" />
					Cancel
				</button>
				<button 
					class="btn btn-primary"
					disabled={saving || !editingRule.program_type}
					onclick={saveRule}
				>
					{#if saving}
						<Loader2 class="w-4 h-4 mr-2 animate-spin" />
					{:else}
						<Save class="w-4 h-4 mr-2" />
					{/if}
					Save
				</button>
			</div>
		</div>
		<div class="modal-backdrop bg-black/50" onclick={cancelEditRule}></div>
	</div>
{/if}

<!-- Edit Fee Modal -->
{#if editingFee}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">
				{isNewFee ? 'Add Additional Fee' : 'Edit Additional Fee'}
			</h3>
			
			<div class="py-4 space-y-4">
				<!-- Fee Type -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Fee Type</span>
					</label>
					<input 
						type="text"
						class="input input-bordered"
						bind:value={editingFee.fee_type}
						placeholder="e.g., bandleader, bank_deposit, travel"
					/>
				</div>

				<!-- Amount -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Amount ($)</span>
					</label>
					<input 
						type="number"
						class="input input-bordered"
						bind:value={editingFee.amount}
						step="0.01"
						min="0"
					/>
				</div>

				<!-- Min Musicians -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Minimum Musicians (optional)</span>
					</label>
					<input 
						type="number"
						class="input input-bordered"
						bind:value={editingFee.min_musicians}
						min="1"
						placeholder="e.g., 4 for quartets"
					/>
					<label class="label">
						<span class="label-text-alt">Leave blank if not applicable</span>
					</label>
				</div>

				<!-- Description -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Description</span>
					</label>
					<input 
						type="text"
						class="input input-bordered"
						bind:value={editingFee.description}
						placeholder="Optional description..."
					/>
				</div>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={cancelEditFee}>
					<X class="w-4 h-4 mr-2" />
					Cancel
				</button>
				<button 
					class="btn btn-primary"
					disabled={saving || !editingFee.fee_type}
					onclick={saveFee}
				>
					{#if saving}
						<Loader2 class="w-4 h-4 mr-2 animate-spin" />
					{:else}
						<Save class="w-4 h-4 mr-2" />
					{/if}
					Save
				</button>
			</div>
		</div>
		<div class="modal-backdrop bg-black/50" onclick={cancelEditFee}></div>
	</div>
{/if}
