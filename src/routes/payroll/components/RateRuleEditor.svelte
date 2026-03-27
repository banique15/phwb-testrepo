<script lang="ts">
	import { onMount } from 'svelte'
	import { supabase } from '$lib/supabase'
	import { rateCardStore } from '$lib/stores/rate-cards'
	import type { RateRule } from '$lib/schemas/rate-card'
	import { RateType } from '$lib/schemas/rate-card'
	import { Check, X } from 'lucide-svelte'

	interface Props {
		rateCardId: number
		existingRule?: RateRule
		onSave: () => void
		onCancel: () => void
	}

	let { rateCardId, existingRule, onSave, onCancel }: Props = $props()

	let programType = $state(existingRule?.program_type || '')
	let programId = $state<string>(existingRule?.program_id ? String(existingRule.program_id) : '')
	let rateType = $state<'hourly' | 'tiered' | 'flat'>(existingRule?.rate_type || 'hourly')
	let hourlyRate = $state<string>(existingRule?.hourly_rate?.toString() || '')
	let firstHourRate = $state<string>(existingRule?.first_hour_rate?.toString() || '')
	let subsequentHourRate = $state<string>(existingRule?.subsequent_hour_rate?.toString() || '')
	let flatRate = $state<string>(existingRule?.flat_rate?.toString() || '')
	let minHours = $state<string>(existingRule?.min_hours?.toString() || '')
	let maxHours = $state<string>(existingRule?.max_hours?.toString() || '')
	let includesTravel = $state(existingRule?.includes_travel || false)
	let description = $state(existingRule?.description || '')
	let notes = $state(existingRule?.notes || '')
	let saving = $state(false)
	let error = $state('')
	let programs = $state<Array<{ id: number; title: string; program_type: string | null }>>([])

	const programTypes = rateCardStore.getAllProgramTypes()
	const rateTypes = rateCardStore.getAllRateTypes()

	onMount(async () => {
		const { data, error: programsError } = await supabase
			.from('phwb_programs')
			.select('id, title, program_type')
			.order('title')

		if (programsError) {
			console.error('Failed to load programs for rate rule editor:', programsError)
			return
		}

		programs = data || []
	})

	function handleProgramChange(value: string) {
		programId = value
		if (!value) return
		const selectedProgram = programs.find((program) => String(program.id) === value)
		if (selectedProgram?.program_type) {
			programType = selectedProgram.program_type
		}
	}

	async function handleSubmit() {
		error = ''

		if (!programType) {
			error = 'Please select a program type'
			return
		}

		// Validate rate values based on type
		if (rateType === 'hourly' && !hourlyRate) {
			error = 'Please enter an hourly rate'
			return
		}
		if (rateType === 'tiered' && (!firstHourRate || !subsequentHourRate)) {
			error = 'Please enter both first hour and subsequent hour rates'
			return
		}
		if (rateType === 'flat' && !flatRate) {
			error = 'Please enter a flat rate'
			return
		}

		saving = true
		try {
			const ruleData = {
				rate_card_id: rateCardId,
				program_type: programType,
				program_id: programId ? Number(programId) : null,
				rate_type: rateType,
				hourly_rate: rateType === 'hourly' ? parseFloat(hourlyRate) : null,
				first_hour_rate: rateType === 'tiered' ? parseFloat(firstHourRate) : null,
				subsequent_hour_rate: rateType === 'tiered' ? parseFloat(subsequentHourRate) : null,
				flat_rate: rateType === 'flat' ? parseFloat(flatRate) : null,
				min_hours: minHours ? parseFloat(minHours) : null,
				max_hours: maxHours ? parseFloat(maxHours) : null,
				includes_travel: includesTravel,
				description: description || null,
				notes: notes || null
			}

			if (existingRule) {
				await rateCardStore.updateRateRule(existingRule.id, ruleData)
			} else {
				await rateCardStore.createRateRule(ruleData)
			}

			onSave()
		} catch (err) {
			error = 'Failed to save rate rule'
			console.error(err)
		} finally {
			saving = false
		}
	}
</script>

<form onsubmit={(e) => { e.preventDefault(); handleSubmit() }} class="space-y-3">
	<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
		<!-- Program Type -->
		<div class="form-control">
			<label class="label py-1" for="program_type">
				<span class="label-text text-xs">Program Type</span>
			</label>
			<select
				id="program_type"
				class="select select-bordered select-sm"
				bind:value={programType}
				required
			>
				<option value="">Select program type...</option>
				{#each programTypes as pt}
					<option value={pt.value}>{pt.label}</option>
				{/each}
			</select>
		</div>

		<!-- Program (optional) -->
		<div class="form-control">
			<label class="label py-1" for="program_id">
				<span class="label-text text-xs">Specific Program (optional)</span>
			</label>
			<select
				id="program_id"
				class="select select-bordered select-sm"
				value={programId}
				onchange={(e) => handleProgramChange(e.currentTarget.value)}
			>
				<option value="">All programs in selected type</option>
				{#each programs as program}
					<option value={String(program.id)}>
						{program.title}
						{program.program_type ? ` (${rateCardStore.getProgramTypeLabel(program.program_type)})` : ''}
					</option>
				{/each}
			</select>
		</div>

		<!-- Rate Type -->
		<div class="form-control">
			<label class="label py-1" for="rate_type">
				<span class="label-text text-xs">Rate Type</span>
			</label>
			<select
				id="rate_type"
				class="select select-bordered select-sm"
				bind:value={rateType}
				required
			>
				{#each rateTypes as rt}
					<option value={rt.value}>{rt.label}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Rate Values (conditional based on type) -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
		{#if rateType === 'hourly'}
			<div class="form-control">
				<label class="label py-1" for="hourly_rate">
					<span class="label-text text-xs">Hourly Rate ($)</span>
				</label>
				<input
					type="number"
					id="hourly_rate"
					class="input input-bordered input-sm"
					bind:value={hourlyRate}
					step="0.01"
					min="0"
					placeholder="0.00"
					required
				/>
			</div>
		{:else if rateType === 'tiered'}
			<div class="form-control">
				<label class="label py-1" for="first_hour_rate">
					<span class="label-text text-xs">First Hour Rate ($)</span>
				</label>
				<input
					type="number"
					id="first_hour_rate"
					class="input input-bordered input-sm"
					bind:value={firstHourRate}
					step="0.01"
					min="0"
					placeholder="0.00"
					required
				/>
			</div>
			<div class="form-control">
				<label class="label py-1" for="subsequent_hour_rate">
					<span class="label-text text-xs">Subsequent Hour Rate ($)</span>
				</label>
				<input
					type="number"
					id="subsequent_hour_rate"
					class="input input-bordered input-sm"
					bind:value={subsequentHourRate}
					step="0.01"
					min="0"
					placeholder="0.00"
					required
				/>
			</div>
		{:else if rateType === 'flat'}
			<div class="form-control">
				<label class="label py-1" for="flat_rate">
					<span class="label-text text-xs">Flat Rate ($)</span>
				</label>
				<input
					type="number"
					id="flat_rate"
					class="input input-bordered input-sm"
					bind:value={flatRate}
					step="0.01"
					min="0"
					placeholder="0.00"
					required
				/>
			</div>
		{/if}

		<!-- Min Hours -->
		<div class="form-control">
			<label class="label py-1" for="min_hours">
				<span class="label-text text-xs">Min Hours</span>
			</label>
			<input
				type="number"
				id="min_hours"
				class="input input-bordered input-sm"
				bind:value={minHours}
				step="0.5"
				min="0"
				placeholder="Optional"
			/>
		</div>

		<!-- Max Hours -->
		<div class="form-control">
			<label class="label py-1" for="max_hours">
				<span class="label-text text-xs">Max Hours</span>
			</label>
			<input
				type="number"
				id="max_hours"
				class="input input-bordered input-sm"
				bind:value={maxHours}
				step="0.5"
				min="0"
				placeholder="Optional"
			/>
		</div>
	</div>

	<!-- Includes Travel -->
	<div class="form-control">
		<label class="label cursor-pointer justify-start gap-3 py-1">
			<input type="checkbox" class="checkbox checkbox-sm checkbox-primary" bind:checked={includesTravel} />
			<span class="label-text text-xs">Rate includes travel costs</span>
		</label>
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
			placeholder="Brief description of this rate rule"
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
			{existingRule ? 'Update' : 'Create'} Rule
		</button>
	</div>
</form>
