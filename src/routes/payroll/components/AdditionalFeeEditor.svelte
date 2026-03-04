<script lang="ts">
	import { rateCardStore } from '$lib/stores/rate-cards'
	import type { AdditionalFee } from '$lib/schemas/rate-card'
	import { Check, X } from 'lucide-svelte'

	interface Props {
		rateCardId: number
		existingFee?: AdditionalFee
		onSave: () => void
		onCancel: () => void
	}

	let { rateCardId, existingFee, onSave, onCancel }: Props = $props()

	let feeType = $state(existingFee?.fee_type || '')
	let amount = $state<string>(existingFee?.amount?.toString() || '')
	let minMusicians = $state<string>(existingFee?.min_musicians?.toString() || '')
	let appliesTo = $state(existingFee?.applies_to || '')
	let description = $state(existingFee?.description || '')
	let notes = $state(existingFee?.notes || '')
	let saving = $state(false)
	let error = $state('')

	const feeTypes = rateCardStore.getAllFeeTypes()

	const appliesToOptions = [
		{ value: '', label: 'Not specified' },
		{ value: 'leader', label: 'Leader only' },
		{ value: 'all', label: 'All musicians' },
		{ value: 'specific_role', label: 'Specific role' }
	]

	async function handleSubmit() {
		error = ''

		if (!feeType) {
			error = 'Please select a fee type'
			return
		}

		if (!amount || parseFloat(amount) <= 0) {
			error = 'Please enter a valid amount'
			return
		}

		saving = true
		try {
			const feeData = {
				rate_card_id: rateCardId,
				fee_type: feeType,
				amount: parseFloat(amount),
				min_musicians: minMusicians ? parseInt(minMusicians) : null,
				applies_to: appliesTo || null,
				description: description || null,
				notes: notes || null
			}

			if (existingFee) {
				await rateCardStore.updateAdditionalFee(existingFee.id, feeData)
			} else {
				await rateCardStore.createAdditionalFee(feeData)
			}

			onSave()
		} catch (err) {
			error = 'Failed to save fee'
			console.error(err)
		} finally {
			saving = false
		}
	}
</script>

<form onsubmit={(e) => { e.preventDefault(); handleSubmit() }} class="space-y-3">
	<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
		<!-- Fee Type -->
		<div class="form-control">
			<label class="label py-1" for="fee_type">
				<span class="label-text text-xs">Fee Type</span>
			</label>
			<select
				id="fee_type"
				class="select select-bordered select-sm"
				bind:value={feeType}
				required
			>
				<option value="">Select fee type...</option>
				{#each feeTypes as ft}
					<option value={ft.value}>{ft.label}</option>
				{/each}
			</select>
		</div>

		<!-- Amount -->
		<div class="form-control">
			<label class="label py-1" for="amount">
				<span class="label-text text-xs">Amount ($)</span>
			</label>
			<input
				type="number"
				id="amount"
				class="input input-bordered input-sm"
				bind:value={amount}
				step="0.01"
				min="0"
				placeholder="0.00"
				required
			/>
		</div>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
		<!-- Min Musicians -->
		<div class="form-control">
			<label class="label py-1" for="min_musicians">
				<span class="label-text text-xs">Minimum Musicians</span>
			</label>
			<input
				type="number"
				id="min_musicians"
				class="input input-bordered input-sm"
				bind:value={minMusicians}
				min="1"
				placeholder="e.g., 4 for quartets"
			/>
			<label class="label py-0">
				<span class="label-text-alt text-xs opacity-50">Fee only applies when this many or more musicians</span>
			</label>
		</div>

		<!-- Applies To -->
		<div class="form-control">
			<label class="label py-1" for="applies_to">
				<span class="label-text text-xs">Applies To</span>
			</label>
			<select
				id="applies_to"
				class="select select-bordered select-sm"
				bind:value={appliesTo}
			>
				{#each appliesToOptions as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Description -->
	<div class="form-control">
		<label class="label py-1" for="description">
			<span class="label-text text-xs">Description (optional)</span>
		</label>
		<input
			type="text"
			id="description"
			class="input input-bordered input-sm"
			bind:value={description}
			placeholder="Brief description of this fee"
		/>
	</div>

	<!-- Notes -->
	<div class="form-control">
		<label class="label py-1" for="notes">
			<span class="label-text text-xs">Notes (optional)</span>
		</label>
		<textarea
			id="notes"
			class="textarea textarea-bordered textarea-sm"
			bind:value={notes}
			placeholder="Additional notes..."
			rows="2"
		></textarea>
	</div>

	{#if error}
		<div class="alert alert-error alert-sm">
			<span class="text-sm">{error}</span>
		</div>
	{/if}

	<!-- Actions -->
	<div class="flex justify-end gap-2">
		<button type="button" class="btn btn-ghost btn-sm" onclick={onCancel} disabled={saving}>
			<X class="w-4 h-4" />
			Cancel
		</button>
		<button type="submit" class="btn btn-primary btn-sm" disabled={saving}>
			{#if saving}
				<span class="loading loading-spinner loading-xs"></span>
			{:else}
				<Check class="w-4 h-4" />
			{/if}
			{existingFee ? 'Update' : 'Create'} Fee
		</button>
	</div>
</form>
