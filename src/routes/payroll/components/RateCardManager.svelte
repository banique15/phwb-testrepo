<script lang="ts">
	import { onMount } from 'svelte'
	import { rateCardStore, rateCardState } from '$lib/stores/rate-cards'
	import type { RateCard } from '$lib/schemas/rate-card'
	import { Plus, Edit, Trash2, Copy, Check, X, ChevronDown, ChevronRight } from 'lucide-svelte'
	import RateCardEditor from './RateCardEditor.svelte'

	let selectedCardId = $state<number | null>(null)
	let showCreateModal = $state(false)
	let showDuplicateModal = $state(false)
	let duplicateSourceId = $state<number | null>(null)
	let duplicateName = $state('')
	let duplicateEffectiveDate = $state('')
	let expandedCards = $state<Set<number>>(new Set())

	// Derive state from store subscription
	let storeState = $state({ loading: false, rateCards: [] as RateCard[], activeRateCard: null as RateCard | null })
	
	// Use onMount for subscription to avoid re-subscription issues
	onMount(() => {
		const unsubscribe = rateCardState.subscribe((state) => {
			storeState = {
				loading: state.loading,
				rateCards: state.rateCards,
				activeRateCard: state.activeRateCard
			}
		})
		
		// Load initial data
		rateCardStore.fetchAllRateCards()
		
		return unsubscribe
	})

	// Derived values from store state
	let loading = $derived(storeState.loading)
	let rateCards = $derived(storeState.rateCards)
	let activeRateCard = $derived(storeState.activeRateCard)

	function toggleCardExpansion(cardId: number) {
		const newExpanded = new Set(expandedCards)
		if (newExpanded.has(cardId)) {
			newExpanded.delete(cardId)
		} else {
			newExpanded.add(cardId)
		}
		expandedCards = newExpanded
	}

	function selectCard(cardId: number) {
		selectedCardId = selectedCardId === cardId ? null : cardId
	}

	async function setActive(cardId: number) {
		try {
			await rateCardStore.updateRateCard(cardId, { is_active: true })
		} catch (error) {
			console.error('Failed to set active rate card:', error)
		}
	}

	async function deleteCard(cardId: number) {
		if (!confirm('Are you sure you want to delete this rate card? This will also delete all associated rules and fees.')) {
			return
		}
		try {
			await rateCardStore.deleteRateCard(cardId)
			if (selectedCardId === cardId) {
				selectedCardId = null
			}
		} catch (error) {
			console.error('Failed to delete rate card:', error)
		}
	}

	function openDuplicateModal(cardId: number, cardName: string) {
		duplicateSourceId = cardId
		duplicateName = `${cardName} (Copy)`
		duplicateEffectiveDate = new Date().toISOString().split('T')[0]
		showDuplicateModal = true
	}

	async function handleDuplicate() {
		if (!duplicateSourceId || !duplicateName || !duplicateEffectiveDate) return
		try {
			await rateCardStore.duplicateRateCard(duplicateSourceId, duplicateName, duplicateEffectiveDate)
			showDuplicateModal = false
			duplicateSourceId = null
			duplicateName = ''
			duplicateEffectiveDate = ''
		} catch (error) {
			console.error('Failed to duplicate rate card:', error)
		}
	}

	function formatDate(dateStr: string | null | undefined): string {
		if (!dateStr) return 'N/A'
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		})
	}

	function getSelectedCard(): RateCard | undefined {
		return rateCards.find((c) => c.id === selectedCardId)
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex justify-between items-center">
		<div>
			<h3 class="text-lg font-semibold">Rate Card Management</h3>
			<p class="text-sm opacity-70">Manage rate cards, rules, and additional fees for payroll calculations</p>
		</div>
		<button class="btn btn-primary btn-sm" onclick={() => (showCreateModal = true)}>
			<Plus class="w-4 h-4 mr-1" />
			New Rate Card
		</button>
	</div>

	{#if loading && rateCards.length === 0}
		<div class="flex justify-center py-8">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if rateCards.length === 0}
		<div class="card bg-base-200">
			<div class="card-body text-center">
				<p class="opacity-70">No rate cards found. Create your first rate card to get started.</p>
				<button class="btn btn-primary btn-sm mx-auto mt-2" onclick={() => (showCreateModal = true)}>
					<Plus class="w-4 h-4 mr-1" />
					Create Rate Card
				</button>
			</div>
		</div>
	{:else}
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Rate Cards List -->
			<div class="lg:col-span-1 space-y-2">
				<h4 class="font-medium text-sm opacity-70 uppercase tracking-wide">Rate Cards</h4>
				<div class="space-y-2">
					{#each rateCards as card (card.id)}
						<div
							class="card bg-base-100 shadow-sm border cursor-pointer transition-all hover:shadow-md {selectedCardId === card.id ? 'border-primary ring-1 ring-primary' : 'border-base-300'}"
							onclick={() => selectCard(card.id)}
							onkeypress={(e) => e.key === 'Enter' && selectCard(card.id)}
							role="button"
							tabindex="0"
						>
							<div class="card-body p-3">
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<div class="flex items-center gap-2">
											<span class="font-semibold">{card.name}</span>
											{#if card.is_active}
												<span class="badge badge-success badge-sm">Active</span>
											{/if}
										</div>
										<div class="text-xs opacity-60 mt-1">
											Effective: {formatDate(card.effective_date)}
											{#if card.expires_date}
												<span class="mx-1">-</span>
												Expires: {formatDate(card.expires_date)}
											{/if}
										</div>
									</div>
									<div class="flex items-center gap-1">
										{#if !card.is_active}
											<button
												class="btn btn-ghost btn-xs"
												onclick={(e) => { e.stopPropagation(); setActive(card.id) }}
												title="Set as active"
											>
												<Check class="w-3 h-3" />
											</button>
										{/if}
										<button
											class="btn btn-ghost btn-xs"
											onclick={(e) => { e.stopPropagation(); openDuplicateModal(card.id, card.name) }}
											title="Duplicate"
										>
											<Copy class="w-3 h-3" />
										</button>
										<button
											class="btn btn-ghost btn-xs text-error"
											onclick={(e) => { e.stopPropagation(); deleteCard(card.id) }}
											title="Delete"
										>
											<Trash2 class="w-3 h-3" />
										</button>
									</div>
								</div>
								{#if card.notes}
									<p class="text-xs opacity-50 mt-1 line-clamp-2">{card.notes}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Rate Card Editor -->
			<div class="lg:col-span-2">
				{#if selectedCardId}
					{@const selectedCard = getSelectedCard()}
					{#if selectedCard}
						<RateCardEditor rateCard={selectedCard} />
					{/if}
				{:else}
					<div class="card bg-base-200 h-full min-h-[300px]">
						<div class="card-body flex items-center justify-center">
							<p class="opacity-50">Select a rate card to view and edit its rules and fees</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Create Rate Card Modal -->
{#if showCreateModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg mb-4">Create New Rate Card</h3>
			<form
				onsubmit={async (e) => {
					e.preventDefault()
					const formData = new FormData(e.currentTarget)
					try {
						const newCard = await rateCardStore.createRateCard({
							name: formData.get('name') as string,
							effective_date: formData.get('effective_date') as string,
							expires_date: (formData.get('expires_date') as string) || null,
							is_active: formData.get('is_active') === 'on',
							notes: (formData.get('notes') as string) || null
						})
						showCreateModal = false
						selectedCardId = newCard.id
					} catch (error) {
						console.error('Failed to create rate card:', error)
					}
				}}
			>
				<div class="form-control mb-3">
					<label class="label" for="name">
						<span class="label-text">Name</span>
					</label>
					<input
						type="text"
						id="name"
						name="name"
						class="input input-bordered"
						placeholder="e.g., FY26"
						required
					/>
				</div>

				<div class="form-control mb-3">
					<label class="label" for="effective_date">
						<span class="label-text">Effective Date</span>
					</label>
					<input
						type="date"
						id="effective_date"
						name="effective_date"
						class="input input-bordered"
						required
					/>
				</div>

				<div class="form-control mb-3">
					<label class="label" for="expires_date">
						<span class="label-text">Expires Date (optional)</span>
					</label>
					<input
						type="date"
						id="expires_date"
						name="expires_date"
						class="input input-bordered"
					/>
				</div>

				<div class="form-control mb-3">
					<label class="label cursor-pointer justify-start gap-3">
						<input type="checkbox" name="is_active" class="checkbox checkbox-primary" />
						<span class="label-text">Set as active rate card</span>
					</label>
				</div>

				<div class="form-control mb-4">
					<label class="label" for="notes">
						<span class="label-text">Notes (optional)</span>
					</label>
					<textarea
						id="notes"
						name="notes"
						class="textarea textarea-bordered"
						rows="2"
						placeholder="Any additional notes..."
					></textarea>
				</div>

				<div class="modal-action">
					<button type="button" class="btn" onclick={() => (showCreateModal = false)}>
						Cancel
					</button>
					<button type="submit" class="btn btn-primary">Create</button>
				</div>
			</form>
		</div>
		<div class="modal-backdrop" onclick={() => (showCreateModal = false)}></div>
	</div>
{/if}

<!-- Duplicate Rate Card Modal -->
{#if showDuplicateModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg mb-4">Duplicate Rate Card</h3>
			<form
				onsubmit={(e) => {
					e.preventDefault()
					handleDuplicate()
				}}
			>
				<div class="form-control mb-3">
					<label class="label" for="duplicate_name">
						<span class="label-text">New Name</span>
					</label>
					<input
						type="text"
						id="duplicate_name"
						class="input input-bordered"
						bind:value={duplicateName}
						required
					/>
				</div>

				<div class="form-control mb-4">
					<label class="label" for="duplicate_effective_date">
						<span class="label-text">Effective Date</span>
					</label>
					<input
						type="date"
						id="duplicate_effective_date"
						class="input input-bordered"
						bind:value={duplicateEffectiveDate}
						required
					/>
				</div>

				<p class="text-sm opacity-70 mb-4">
					This will create a copy of the rate card including all its rules and fees.
				</p>

				<div class="modal-action">
					<button type="button" class="btn" onclick={() => (showDuplicateModal = false)}>
						Cancel
					</button>
					<button type="submit" class="btn btn-primary">Duplicate</button>
				</div>
			</form>
		</div>
		<div class="modal-backdrop" onclick={() => (showDuplicateModal = false)}></div>
	</div>
{/if}
