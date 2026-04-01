<script lang="ts">
	import { onMount } from 'svelte'
	import { supabase } from '$lib/supabase'
	import { rateCardStore } from '$lib/stores/rate-cards'
	import type { RateRule } from '$lib/schemas/rate-card'
	import { RateType } from '$lib/schemas/rate-card'
	import { Check, X, Search } from 'lucide-svelte'

	interface Props {
		rateCardId: number
		existingRule?: RateRule
		onSave: () => void
		onCancel: () => void
	}

	let { rateCardId, existingRule, onSave, onCancel }: Props = $props()

	let programType = $state(existingRule?.program_type || '')
	let selectedProgramIds = $state<string[]>(existingRule?.program_id ? [String(existingRule.program_id)] : [])
	let availableSearchTerm = $state('')
	let assignedSearchTerm = $state('')
	let highlightedAvailableIds = $state<string[]>([])
	let highlightedAssignedIds = $state<string[]>([])
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
	let showTypeConflictModal = $state(false)
	let pendingConflictPrograms = $state<Array<{ id: string; title: string; program_type: string | null }>>([])

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
		syncSelectedWithProgramType()
	})

	function syncSelectedWithProgramType() {
		if (!programType) {
			selectedProgramIds = []
			return
		}
		selectedProgramIds = programs
			.filter((program) => program.program_type === programType)
			.map((program) => String(program.id))
	}

	let availablePrograms = $derived.by(() => {
		return programs.filter((program) => !selectedProgramIds.includes(String(program.id)))
	})

	let assignedPrograms = $derived.by(() => {
		return programs.filter((program) => selectedProgramIds.includes(String(program.id)))
	})

	function filterPrograms(
		source: Array<{ id: number; title: string; program_type: string | null }>,
		searchTerm: string
	) {
		const normalizedSearch = searchTerm.trim().toLowerCase()
		if (!normalizedSearch) return source
		return source.filter((program) => {
			const title = program.title?.toLowerCase() || ''
			const typeLabel = program.program_type
				? rateCardStore.getProgramTypeLabel(program.program_type).toLowerCase()
				: ''
			return title.includes(normalizedSearch) || typeLabel.includes(normalizedSearch)
		})
	}

	let filteredAvailablePrograms = $derived(filterPrograms(availablePrograms, availableSearchTerm))
	let filteredAssignedPrograms = $derived(filterPrograms(assignedPrograms, assignedSearchTerm))

	function getProgramTypeSubtitle(programTypeValue: string | null): string {
		if (!programTypeValue) return 'Unassigned'
		return rateCardStore.getProgramTypeLabel(programTypeValue)
	}

	function toggleHighlightedAvailable(programId: string) {
		if (highlightedAvailableIds.includes(programId)) {
			highlightedAvailableIds = highlightedAvailableIds.filter((id) => id !== programId)
			return
		}
		highlightedAvailableIds = [...highlightedAvailableIds, programId]
	}

	function toggleHighlightedAssigned(programId: string) {
		if (highlightedAssignedIds.includes(programId)) {
			highlightedAssignedIds = highlightedAssignedIds.filter((id) => id !== programId)
			return
		}
		highlightedAssignedIds = [...highlightedAssignedIds, programId]
	}

	async function applyProgramTypeAssignment(programIds: string[], typeValue: string | null) {
		if (programIds.length === 0) return

		const updates = await Promise.all(
			programIds.map(async (id) => {
				const numericId = Number(id)
				const { error: updateError } = await supabase
					.from('phwb_programs')
					.update({ program_type: typeValue })
					.eq('id', numericId)

				if (updateError) throw updateError
				return { id: numericId, program_type: typeValue }
			})
		)

		programs = programs.map((program) => {
			const updated = updates.find((entry) => entry.id === program.id)
			return updated ? { ...program, program_type: updated.program_type } : program
		})
		syncSelectedWithProgramType()
	}

	async function moveHighlightedToSelected() {
		if (highlightedAvailableIds.length === 0) return
		if (!programType) {
			error = 'Please select a program type before assigning programs'
			return
		}

		const chosenPrograms = programs.filter((program) =>
			highlightedAvailableIds.includes(String(program.id))
		)
		const assignableIds: string[] = []
		const conflicts: Array<{ id: string; title: string; program_type: string | null }> = []

		for (const program of chosenPrograms) {
			if (programType && program.program_type && program.program_type !== programType) {
				conflicts.push({
					id: String(program.id),
					title: program.title,
					program_type: program.program_type
				})
				continue
			}
			assignableIds.push(String(program.id))
		}

		try {
			await applyProgramTypeAssignment(assignableIds, programType)
		} catch (err) {
			console.error('Failed to assign programs:', err)
			error = 'Failed to update program assignment'
			return
		}
		highlightedAvailableIds = []

		if (conflicts.length > 0) {
			pendingConflictPrograms = conflicts
			showTypeConflictModal = true
		}
	}

	async function moveHighlightedToAvailable() {
		if (highlightedAssignedIds.length === 0) return
		try {
			await applyProgramTypeAssignment(highlightedAssignedIds, null)
		} catch (err) {
			console.error('Failed to unassign programs:', err)
			error = 'Failed to update program assignment'
			return
		}
		highlightedAssignedIds = []
	}

	async function confirmTypeConflictSelection() {
		if (!programType) return
		try {
			await applyProgramTypeAssignment(
				pendingConflictPrograms.map((program) => program.id),
				programType
			)
		} catch (err) {
			console.error('Failed to assign conflicting programs:', err)
			error = 'Failed to update program assignment'
		}
		cancelTypeConflictSelection()
	}

	function cancelTypeConflictSelection() {
		showTypeConflictModal = false
		pendingConflictPrograms = []
	}

	function clearSelectedPrograms() {
		// no-op: kept for compatibility if bound in template
	}

	function handleProgramTypeChange(value: string) {
		programType = value
		syncSelectedWithProgramType()
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
			const baseRuleData = {
				rate_card_id: rateCardId,
				program_type: programType,
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
				await rateCardStore.updateRateRule(existingRule.id, {
					...baseRuleData,
					// Program assignment is managed through phwb_programs.program_type.
					// Keep this rule type-scoped.
					program_id: null
				})
			} else {
				await rateCardStore.createRateRule({
					...baseRuleData,
					program_id: null
				})
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
				value={programType}
				onchange={(e) => handleProgramTypeChange(e.currentTarget.value)}
				required
			>
				<option value="">Select program type...</option>
				{#each programTypes as pt}
					<option value={pt.value}>{pt.label}</option>
				{/each}
			</select>
		</div>

		<!-- Program multi-select (optional) -->
		<div class="form-control md:col-span-2">
			<label class="label py-1">
				<span class="label-text text-xs">Program Assignment (optional, multi-select)</span>
			</label>
			<div class="border border-base-300 rounded-lg p-2">
				<div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 items-start">
					<div class="space-y-2 min-w-0">
						<p class="text-xs font-medium opacity-70">All Programs</p>
						<div class="relative">
							<Search class="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-base-content/50" />
							<input
								type="text"
								class="input input-bordered input-sm w-full pl-8"
								placeholder="Search all programs..."
								bind:value={availableSearchTerm}
							/>
						</div>
						<div class="max-h-52 overflow-y-auto border border-base-200 rounded">
							{#if filteredAvailablePrograms.length === 0}
								<div class="px-2 py-3 text-xs text-base-content/60 text-center">
									No available programs
								</div>
							{:else}
								{#each filteredAvailablePrograms as program}
									<button
										type="button"
										class="w-full text-left px-2 py-1.5 hover:bg-base-200 border-b border-base-200 last:border-b-0 {highlightedAvailableIds.includes(String(program.id)) ? 'bg-primary/10' : ''}"
										onclick={() => toggleHighlightedAvailable(String(program.id))}
									>
										<div class="text-xs font-medium">{program.title}</div>
										<div class="text-[11px] opacity-60">{getProgramTypeSubtitle(program.program_type)}</div>
									</button>
								{/each}
							{/if}
						</div>
					</div>

					<div class="flex md:flex-col gap-2 justify-center pt-6">
						<button
							type="button"
							class="btn btn-sm btn-outline"
							onclick={moveHighlightedToSelected}
							disabled={highlightedAvailableIds.length === 0}
							title="Assign selected programs to this rule"
						>
							&rarr;
						</button>
						<button
							type="button"
							class="btn btn-sm btn-outline"
							onclick={moveHighlightedToAvailable}
							disabled={highlightedAssignedIds.length === 0}
							title="Remove selected programs from this rule"
						>
							&larr;
						</button>
					</div>

					<div class="space-y-2 min-w-0">
						<p class="text-xs font-medium opacity-70">Programs in this Rule</p>
						<div class="relative">
							<Search class="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-base-content/50" />
							<input
								type="text"
								class="input input-bordered input-sm w-full pl-8"
								placeholder="Search selected..."
								bind:value={assignedSearchTerm}
							/>
						</div>
						<div class="max-h-52 overflow-y-auto border border-base-200 rounded">
							{#if filteredAssignedPrograms.length === 0}
								<div class="px-2 py-3 text-xs text-base-content/60 text-center">
									No programs selected
								</div>
							{:else}
								{#each filteredAssignedPrograms as program}
									<button
										type="button"
										class="w-full text-left px-2 py-1.5 hover:bg-base-200 border-b border-base-200 last:border-b-0 {highlightedAssignedIds.includes(String(program.id)) ? 'bg-primary/10' : ''}"
										onclick={() => toggleHighlightedAssigned(String(program.id))}
									>
										<div class="text-xs font-medium">{program.title}</div>
										<div class="text-[11px] opacity-60">{getProgramTypeSubtitle(program.program_type)}</div>
									</button>
								{/each}
							{/if}
						</div>
					</div>
				</div>

				<p class="text-[11px] opacity-60">
					No selection applies this rule to all programs in the selected program type.
				</p>
			</div>
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

{#if showTypeConflictModal}
	<div class="modal modal-open">
		<div class="modal-box max-w-lg">
			<h3 class="font-bold text-lg">Program Type Mismatch</h3>
			<p class="py-3 text-sm">
				{pendingConflictPrograms.length} selected program(s) are currently assigned to another program type,
				which differs from this rule's selected type
				<strong>{programType ? rateCardStore.getProgramTypeLabel(programType) : 'Not set'}</strong>.
			</p>
			<div class="max-h-40 overflow-y-auto border border-base-300 rounded p-2 text-sm">
				{#each pendingConflictPrograms as program}
					<div class="py-1 border-b border-base-200 last:border-b-0">
						<div class="font-medium">{program.title}</div>
						<div class="text-xs opacity-60">
							Currently: {getProgramTypeSubtitle(program.program_type)}
						</div>
					</div>
				{/each}
			</div>
			<p class="text-xs opacity-70">
				You can still include it in this rule, but this may indicate a data mismatch.
			</p>
			<div class="modal-action">
				<button type="button" class="btn btn-ghost btn-sm" onclick={cancelTypeConflictSelection}>
					Cancel
				</button>
				<button type="button" class="btn btn-warning btn-sm" onclick={confirmTypeConflictSelection}>
					Add Anyway
				</button>
			</div>
		</div>
		<button type="button" class="modal-backdrop" onclick={cancelTypeConflictSelection}>close</button>
	</div>
{/if}
