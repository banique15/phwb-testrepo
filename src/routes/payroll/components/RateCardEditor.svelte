<script lang="ts">
	import { onMount, untrack } from 'svelte'
	import { supabase } from '$lib/supabase'
	import { rateCardStore, rateCardState } from '$lib/stores/rate-cards'
	import type { RateCard, RateRule, AdditionalFee } from '$lib/schemas/rate-card'
	import { ProgramType, RateType, FeeType } from '$lib/schemas/rate-card'
	import { Plus, Save, Trash2, Edit2, X, Check, DollarSign, Clock, Users } from 'lucide-svelte'
	import RateRuleEditor from './RateRuleEditor.svelte'
	import AdditionalFeeEditor from './AdditionalFeeEditor.svelte'

	interface Props {
		rateCard: RateCard
	}

	let { rateCard }: Props = $props()

	let rules = $state<RateRule[]>([])
	let fees = $state<AdditionalFee[]>([])
	let programs = $state<Array<{ id: number; title: string }>>([])
	let loading = $state(false)
	let editingCard = $state(false)
	let editName = $state('')
	let editEffectiveDate = $state('')
	let editExpiresDate = $state('')
	let editNotes = $state('')
	let showAddRule = $state(false)
	let showAddFee = $state(false)
	let editingRuleId = $state<number | null>(null)
	let editingFeeId = $state<number | null>(null)
	let lastLoadedCardId: number | null = null // Not reactive - just for tracking

	// Fetch rules and fees when rate card changes
	$effect(() => {
		const cardId = rateCard?.id
		// Use untrack to prevent the state updates inside loadRulesAndFees from re-triggering this effect
		if (cardId) {
			untrack(() => {
				if (cardId !== lastLoadedCardId) {
					lastLoadedCardId = cardId
					loadRulesAndFees()
				}
			})
		}
	})

	async function loadRulesAndFees() {
		loading = true
		try {
			const [rulesResponse, feesResponse, programsResponse] = await Promise.all([
				supabase
					.from('phwb_rate_rules')
					.select('*')
					.eq('rate_card_id', rateCard.id)
					.order('program_type'),
				supabase
					.from('phwb_additional_fees')
					.select('*')
					.eq('rate_card_id', rateCard.id)
					.order('fee_type'),
				supabase
					.from('phwb_programs')
					.select('id, title')
					.order('title')
			])
			
			if (rulesResponse.error) throw rulesResponse.error
			if (feesResponse.error) throw feesResponse.error
			if (programsResponse.error) throw programsResponse.error
			
			rules = rulesResponse.data || []
			fees = feesResponse.data || []
			programs = programsResponse.data || []
		} catch (error) {
			console.error('Failed to load rules and fees:', error)
		} finally {
			loading = false
		}
	}

	function startEditCard() {
		editName = rateCard.name
		editEffectiveDate = rateCard.effective_date
		editExpiresDate = rateCard.expires_date || ''
		editNotes = rateCard.notes || ''
		editingCard = true
	}

	async function saveCardEdit() {
		try {
			await rateCardStore.updateRateCard(rateCard.id, {
				name: editName,
				effective_date: editEffectiveDate,
				expires_date: editExpiresDate || null,
				notes: editNotes || null
			})
			editingCard = false
		} catch (error) {
			console.error('Failed to update rate card:', error)
		}
	}

	function cancelCardEdit() {
		editingCard = false
	}

	async function handleRuleSaved() {
		showAddRule = false
		editingRuleId = null
		await loadRulesAndFees()
	}

	async function handleFeeSaved() {
		showAddFee = false
		editingFeeId = null
		await loadRulesAndFees()
	}

	async function deleteRule(ruleId: number) {
		if (!confirm('Are you sure you want to delete this rate rule?')) return
		try {
			await rateCardStore.deleteRateRule(ruleId)
			rules = rules.filter((r) => r.id !== ruleId)
		} catch (error) {
			console.error('Failed to delete rule:', error)
		}
	}

	async function deleteFee(feeId: number) {
		if (!confirm('Are you sure you want to delete this fee?')) return
		try {
			await rateCardStore.deleteAdditionalFee(feeId)
			fees = fees.filter((f) => f.id !== feeId)
		} catch (error) {
			console.error('Failed to delete fee:', error)
		}
	}

	function formatCurrency(amount: number | null | undefined): string {
		if (amount === null || amount === undefined) return '-'
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
	}

	function formatDate(dateStr: string | null | undefined): string {
		if (!dateStr) return 'N/A'
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		})
	}

	function getProgramTitle(programId: number | null | undefined): string {
		if (!programId) return 'All'
		const program = programs.find((p) => p.id === programId)
		return program?.title || `Program #${programId}`
	}

	// Group rules by program type category
	function groupRulesByCategory(rules: RateRule[]) {
		const groups: Record<string, RateRule[]> = {
			'In-Person Programs': [],
			'Virtual Programs': [],
			'Special Events': [],
			'Other': []
		}

		for (const rule of rules) {
			if (
				rule.program_type === ProgramType.HEALING_ARTS ||
				rule.program_type === ProgramType.TRANSIT_HUB ||
				rule.program_type === ProgramType.TEACHING_IN_PERSON ||
				rule.program_type === ProgramType.NEWARK_AIRPORT
			) {
				groups['In-Person Programs'].push(rule)
			} else if (
				rule.program_type === ProgramType.VIRTUAL_ARTIST ||
				rule.program_type === ProgramType.VIRTUAL_TEACHING
			) {
				groups['Virtual Programs'].push(rule)
			} else if (
				rule.program_type === ProgramType.DONOR_EVENT ||
				rule.program_type === ProgramType.HOLIDAY_SOLOIST ||
				rule.program_type === ProgramType.HOLIDAY_GROUP ||
				rule.program_type === ProgramType.HOLIDAY_SPECIAL
			) {
				groups['Special Events'].push(rule)
			} else {
				groups['Other'].push(rule)
			}
		}

		return groups
	}
</script>

<div class="card bg-base-100 shadow-sm border border-base-300">
	<div class="card-body">
		<!-- Card Header -->
		<div class="flex items-start justify-between mb-4">
			{#if editingCard}
				<div class="flex-1 space-y-3">
					<input
						type="text"
						class="input input-bordered input-sm w-full max-w-xs"
						bind:value={editName}
						placeholder="Rate card name"
					/>
					<div class="flex gap-2">
						<input
							type="date"
							class="input input-bordered input-sm"
							bind:value={editEffectiveDate}
						/>
						<span class="self-center">to</span>
						<input
							type="date"
							class="input input-bordered input-sm"
							bind:value={editExpiresDate}
							placeholder="No expiry"
						/>
					</div>
					<textarea
						class="textarea textarea-bordered textarea-sm w-full"
						bind:value={editNotes}
						placeholder="Notes..."
						rows="2"
					></textarea>
					<div class="flex gap-2">
						<button class="btn btn-primary btn-sm" onclick={saveCardEdit}>
							<Check class="w-4 h-4" />
							Save
						</button>
						<button class="btn btn-ghost btn-sm" onclick={cancelCardEdit}>
							<X class="w-4 h-4" />
							Cancel
						</button>
					</div>
				</div>
			{:else}
				<div>
					<div class="flex items-center gap-2">
						<h3 class="text-xl font-bold">{rateCard.name}</h3>
						{#if rateCard.is_active}
							<span class="badge badge-success">Active</span>
						{/if}
					</div>
					<p class="text-sm opacity-60">
						{formatDate(rateCard.effective_date)}
						{#if rateCard.expires_date}
							<span class="mx-1">-</span>
							{formatDate(rateCard.expires_date)}
						{/if}
					</p>
					{#if rateCard.notes}
						<p class="text-sm opacity-50 mt-1">{rateCard.notes}</p>
					{/if}
				</div>
				<button class="btn btn-ghost btn-sm" onclick={startEditCard}>
					<Edit2 class="w-4 h-4" />
				</button>
			{/if}
		</div>

		{#if loading}
			<div class="flex justify-center py-8">
				<span class="loading loading-spinner loading-md"></span>
			</div>
		{:else}
			<!-- Rate Rules Section -->
			<div class="mb-6">
				<div class="flex items-center justify-between mb-3">
					<h4 class="font-semibold flex items-center gap-2">
						<DollarSign class="w-4 h-4" />
						Rate Rules
					</h4>
					<button class="btn btn-ghost btn-xs" onclick={() => (showAddRule = true)}>
						<Plus class="w-4 h-4" />
						Add Rule
					</button>
				</div>

				{#if showAddRule}
					<div class="mb-4 p-3 bg-base-200 rounded-lg">
						<RateRuleEditor
							rateCardId={rateCard.id}
							onSave={handleRuleSaved}
							onCancel={() => (showAddRule = false)}
						/>
					</div>
				{/if}

				{#if rules.length === 0}
					<p class="text-sm opacity-50 text-center py-4">No rate rules defined yet.</p>
				{:else}
					{@const groupedRules = groupRulesByCategory(rules)}
					{#each Object.entries(groupedRules) as [category, categoryRules]}
						{#if categoryRules.length > 0}
							<div class="mb-4">
								<h5 class="text-xs font-medium uppercase tracking-wide opacity-50 mb-2">
									{category}
								</h5>
								<div class="overflow-x-auto">
									<table class="table table-sm table-zebra">
										<thead>
											<tr>
												<th>Program</th>
												<th>Program Type</th>
												<th>Rate Type</th>
												<th>Rate</th>
												<th>Duration</th>
												<th class="w-20"></th>
											</tr>
										</thead>
										<tbody>
											{#each categoryRules as rule (rule.id)}
												{#if editingRuleId === rule.id}
													<tr>
														<td colspan="6" class="bg-base-200 p-3">
															<RateRuleEditor
																rateCardId={rateCard.id}
																existingRule={rule}
																onSave={handleRuleSaved}
																onCancel={() => (editingRuleId = null)}
															/>
														</td>
													</tr>
												{:else}
													<tr>
														<td>
															<span class="text-sm">{getProgramTitle(rule.program_id)}</span>
														</td>
														<td>
															<span class="font-medium">
																{rateCardStore.getProgramTypeLabel(rule.program_type)}
															</span>
															{#if rule.description}
																<br />
																<span class="text-xs opacity-50">{rule.description}</span>
															{/if}
														</td>
														<td>
															<span class="badge badge-ghost badge-sm">
																{rateCardStore.getRateTypeLabel(rule.rate_type)}
															</span>
														</td>
														<td>
															{#if rule.rate_type === 'hourly'}
																{formatCurrency(rule.hourly_rate)}/hr
															{:else if rule.rate_type === 'tiered'}
																{formatCurrency(rule.first_hour_rate)} first hr
																<br />
																<span class="text-xs opacity-60">
																	{formatCurrency(rule.subsequent_hour_rate)} subsequent
																</span>
															{:else}
																{formatCurrency(rule.flat_rate)} flat
															{/if}
														</td>
														<td>
															{#if rule.min_hours || rule.max_hours}
																<span class="text-xs">
																	{rule.min_hours || '–'} - {rule.max_hours || '–'} hrs
																</span>
															{:else}
																<span class="text-xs opacity-50">—</span>
															{/if}
														</td>
														<td>
															<div class="flex gap-1">
																<button
																	class="btn btn-ghost btn-xs"
																	onclick={() => (editingRuleId = rule.id)}
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
												{/if}
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						{/if}
					{/each}
				{/if}
			</div>

			<!-- Additional Fees Section -->
			<div>
				<div class="flex items-center justify-between mb-3">
					<h4 class="font-semibold flex items-center gap-2">
						<Users class="w-4 h-4" />
						Additional Fees
					</h4>
					<button class="btn btn-ghost btn-xs" onclick={() => (showAddFee = true)}>
						<Plus class="w-4 h-4" />
						Add Fee
					</button>
				</div>

				{#if showAddFee}
					<div class="mb-4 p-3 bg-base-200 rounded-lg">
						<AdditionalFeeEditor
							rateCardId={rateCard.id}
							onSave={handleFeeSaved}
							onCancel={() => (showAddFee = false)}
						/>
					</div>
				{/if}

				{#if fees.length === 0}
					<p class="text-sm opacity-50 text-center py-4">No additional fees defined yet.</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="table table-sm table-zebra">
							<thead>
								<tr>
									<th>Fee Type</th>
									<th>Amount</th>
									<th>Conditions</th>
									<th class="w-20"></th>
								</tr>
							</thead>
							<tbody>
								{#each fees as fee (fee.id)}
									{#if editingFeeId === fee.id}
										<tr>
											<td colspan="4" class="bg-base-200 p-3">
												<AdditionalFeeEditor
													rateCardId={rateCard.id}
													existingFee={fee}
													onSave={handleFeeSaved}
													onCancel={() => (editingFeeId = null)}
												/>
											</td>
										</tr>
									{:else}
										<tr>
											<td>
												<span class="font-medium">
													{rateCardStore.getFeeTypeLabel(fee.fee_type)}
												</span>
												{#if fee.description}
													<br />
													<span class="text-xs opacity-50">{fee.description}</span>
												{/if}
											</td>
											<td>{formatCurrency(fee.amount)}</td>
											<td>
												{#if fee.min_musicians}
													<span class="text-xs">Min {fee.min_musicians} musicians</span>
												{/if}
												{#if fee.applies_to}
													<span class="text-xs opacity-60">
														{fee.applies_to === 'leader' ? 'Leader only' : fee.applies_to}
													</span>
												{/if}
												{#if !fee.min_musicians && !fee.applies_to}
													<span class="text-xs opacity-50">—</span>
												{/if}
											</td>
											<td>
												<div class="flex gap-1">
													<button
														class="btn btn-ghost btn-xs"
														onclick={() => (editingFeeId = fee.id)}
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
									{/if}
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
