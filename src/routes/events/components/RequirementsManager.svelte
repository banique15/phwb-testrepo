<script lang="ts">
	import { Plus, X, Edit2, Check, Trash2 } from 'lucide-svelte'
	import { getRequirementIcon } from '$lib/utils/icon-mapping'

	interface Props {
		requirements: any
		onUpdateRequirements: (requirements: any) => Promise<void>
	}

	let { requirements, onUpdateRequirements }: Props = $props()

	let saving = $state(false)
	let isAdding = $state(false)
	let editingKey = $state<string | null>(null)

	// New requirement form state
	let newKey = $state('')
	let newValue = $state('')
	let newType = $state<'text' | 'boolean'>('text')
	let newBoolValue = $state(true)

	// Edit form state
	let editValue = $state('')
	let editType = $state<'text' | 'boolean'>('text')
	let editBoolValue = $state(true)

	// Delete modal state
	let showDeleteModal = $state(false)
	let deleteKey = $state<string | null>(null)

	// Common requirement presets
	const presets = [
		{ key: 'sound_system', label: 'Sound System', type: 'boolean' as const },
		{ key: 'microphones', label: 'Microphones', type: 'text' as const },
		{ key: 'stage_platform', label: 'Stage/Platform', type: 'boolean' as const },
		{ key: 'lighting', label: 'Lighting', type: 'text' as const },
		{ key: 'power_outlets', label: 'Power Outlets', type: 'text' as const },
		{ key: 'parking', label: 'Parking', type: 'text' as const },
		{ key: 'load_in_access', label: 'Load-in Access', type: 'text' as const },
		{ key: 'green_room', label: 'Green Room', type: 'boolean' as const },
		{ key: 'catering', label: 'Catering', type: 'text' as const },
		{ key: 'dress_code', label: 'Dress Code', type: 'text' as const },
		{ key: 'security', label: 'Security', type: 'boolean' as const },
		{ key: 'piano', label: 'Piano', type: 'boolean' as const },
		{ key: 'chairs', label: 'Chairs', type: 'text' as const },
		{ key: 'music_stands', label: 'Music Stands', type: 'text' as const },
	]

	// Parse requirements into a normalized object (derived from prop)
	let requirementsObj = $derived.by(() => {
		if (!requirements) return {}
		if (typeof requirements === 'object' && !Array.isArray(requirements)) {
			return requirements
		}
		if (Array.isArray(requirements)) {
			const obj: Record<string, any> = {}
			requirements.forEach((req: any, i: number) => {
				if (typeof req === 'string') {
					obj[`requirement_${i + 1}`] = req
				} else if (req.key && req.value !== undefined) {
					obj[req.key] = req.value
				}
			})
			return obj
		}
		return {}
	})

	let requirementEntries = $derived(Object.entries(requirementsObj))

	// Available presets (not yet added)
	let availablePresets = $derived(
		presets.filter(p => !(p.key in requirementsObj))
	)

	function formatKey(key: string): string {
		return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
	}

	function startAdding() {
		isAdding = true
		newKey = ''
		newValue = ''
		newType = 'text'
		newBoolValue = true
	}

	function cancelAdding() {
		isAdding = false
		newKey = ''
		newValue = ''
	}

	function selectPreset(preset: typeof presets[0]) {
		newKey = preset.key
		newType = preset.type
		if (preset.type === 'boolean') {
			newBoolValue = true
		}
	}

	async function addRequirement() {
		if (!newKey.trim()) return

		saving = true
		const key = newKey.trim().toLowerCase().replace(/\s+/g, '_')
		const value = newType === 'boolean' ? newBoolValue : newValue.trim()

		const updated = {
			...requirementsObj,
			[key]: value
		}

		cancelAdding()

		try {
			await onUpdateRequirements(updated)
		} catch (err) {
			console.error('Failed to add requirement:', err)
		} finally {
			saving = false
		}
	}

	function startEditing(key: string, value: any) {
		editingKey = key
		if (typeof value === 'boolean') {
			editType = 'boolean'
			editBoolValue = value
			editValue = ''
		} else {
			editType = 'text'
			editValue = String(value)
			editBoolValue = true
		}
	}

	function cancelEditing() {
		editingKey = null
		editValue = ''
	}

	async function saveEdit(key: string) {
		saving = true
		const value = editType === 'boolean' ? editBoolValue : editValue.trim()
		const updated = {
			...requirementsObj,
			[key]: value
		}

		cancelEditing()

		try {
			await onUpdateRequirements(updated)
		} catch (err) {
			console.error('Failed to update requirement:', err)
		} finally {
			saving = false
		}
	}

	function openDeleteModal(key: string) {
		deleteKey = key
		showDeleteModal = true
	}

	function closeDeleteModal() {
		showDeleteModal = false
		deleteKey = null
	}

	async function confirmDelete() {
		if (!deleteKey) return

		const key = deleteKey
		closeDeleteModal()

		saving = true
		const updated = { ...requirementsObj }
		delete updated[key]

		// If no requirements left, set to null
		const result = Object.keys(updated).length > 0 ? updated : null

		try {
			await onUpdateRequirements(result)
		} catch (err) {
			console.error('Failed to remove requirement:', err)
		} finally {
			saving = false
		}
	}

	function formatValue(value: any): string {
		if (typeof value === 'boolean') {
			return value ? 'Yes' : 'No'
		}
		if (Array.isArray(value)) {
			return value.join(', ')
		}
		return String(value)
	}
</script>

<div class="space-y-4">
	<!-- Header with Add button -->
	<div class="flex items-center justify-between">
		<h3 class="text-lg font-semibold">Requirements ({requirementEntries.length})</h3>
		{#if !isAdding}
			<button
				type="button"
				class="btn btn-primary btn-sm gap-2"
				onclick={startAdding}
				disabled={saving}
			>
				<Plus class="w-4 h-4" />
				Add Requirement
			</button>
		{/if}
	</div>

	<!-- Add Requirement Form -->
	{#if isAdding}
		<div class="card bg-base-200 p-4">
			<div class="flex items-center justify-between mb-3">
				<span class="font-medium text-sm">Add New Requirement</span>
				<button
					type="button"
					class="btn btn-ghost btn-xs btn-circle"
					onclick={cancelAdding}
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<!-- Quick presets -->
			{#if availablePresets.length > 0}
				<div class="mb-3">
					<label class="label py-1">
						<span class="label-text text-xs">Quick Add</span>
					</label>
					<div class="flex flex-wrap gap-1">
						{#each availablePresets.slice(0, 8) as preset}
							<button
								type="button"
								class="btn btn-xs {newKey === preset.key ? 'btn-primary' : 'btn-outline'}"
								onclick={() => selectPreset(preset)}
							>
								{preset.label}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				<!-- Key input -->
				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-xs">Requirement Name</span>
					</label>
					<input
						type="text"
						bind:value={newKey}
						placeholder="e.g., Sound System"
						class="input input-bordered input-sm"
						disabled={saving}
					/>
				</div>

				<!-- Type selector -->
				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-xs">Type</span>
					</label>
					<select
						bind:value={newType}
						class="select select-bordered select-sm"
						disabled={saving}
					>
						<option value="text">Text / Details</option>
						<option value="boolean">Yes / No</option>
					</select>
				</div>
			</div>

			<!-- Value input -->
			<div class="form-control mt-3">
				<label class="label py-1">
					<span class="label-text text-xs">Value</span>
				</label>
				{#if newType === 'boolean'}
					<div class="flex gap-4">
						<label class="label cursor-pointer gap-2">
							<input
								type="radio"
								name="newBoolValue"
								class="radio radio-primary radio-sm"
								checked={newBoolValue === true}
								onchange={() => newBoolValue = true}
								disabled={saving}
							/>
							<span class="label-text">Yes / Required</span>
						</label>
						<label class="label cursor-pointer gap-2">
							<input
								type="radio"
								name="newBoolValue"
								class="radio radio-sm"
								checked={newBoolValue === false}
								onchange={() => newBoolValue = false}
								disabled={saving}
							/>
							<span class="label-text">No / Not Required</span>
						</label>
					</div>
				{:else}
					<textarea
						bind:value={newValue}
						placeholder="Enter details..."
						class="textarea textarea-bordered textarea-sm"
						rows="2"
						disabled={saving}
					></textarea>
				{/if}
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-2 mt-4">
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={cancelAdding}
					disabled={saving}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn-primary btn-sm"
					onclick={addRequirement}
					disabled={saving || !newKey.trim()}
				>
					{#if saving}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					Add
				</button>
			</div>
		</div>
	{/if}

	<!-- Requirements List -->
	{#if requirementEntries.length === 0}
		<div class="text-center py-8 border-2 border-dashed border-base-300 rounded-lg">
			<svelte:component this={getRequirementIcon('')} class="w-12 h-12 mx-auto mb-3 text-base-content/40" />
			<p class="text-base opacity-70 mb-2">No requirements defined</p>
			<p class="text-sm opacity-50">Click "Add Requirement" to specify event needs</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
			{#each requirementEntries as [key, value]}
				<div class="card bg-base-200 hover:bg-base-300 transition-colors group">
					<div class="card-body p-4">
						{#if editingKey === key}
							<!-- Edit Mode -->
							<div class="space-y-3">
								<div class="font-medium text-sm flex items-center gap-2">
									<svelte:component this={getRequirementIcon(key)} class="w-4 h-4" />
									{formatKey(key)}
								</div>

								{#if editType === 'boolean'}
									<div class="flex gap-4">
										<label class="label cursor-pointer gap-2">
											<input
												type="radio"
												name="editBoolValue"
												class="radio radio-primary radio-sm"
												checked={editBoolValue === true}
												onchange={() => editBoolValue = true}
												disabled={saving}
											/>
											<span class="label-text">Yes</span>
										</label>
										<label class="label cursor-pointer gap-2">
											<input
												type="radio"
												name="editBoolValue"
												class="radio radio-sm"
												checked={editBoolValue === false}
												onchange={() => editBoolValue = false}
												disabled={saving}
											/>
											<span class="label-text">No</span>
										</label>
									</div>
								{:else}
									<textarea
										bind:value={editValue}
										class="textarea textarea-bordered textarea-sm w-full"
										rows="2"
										disabled={saving}
									></textarea>
								{/if}

								<div class="flex justify-end gap-2">
									<button
										type="button"
										class="btn btn-ghost btn-xs"
										onclick={cancelEditing}
										disabled={saving}
									>
										Cancel
									</button>
									<button
										type="button"
										class="btn btn-primary btn-xs"
										onclick={() => saveEdit(key)}
										disabled={saving}
									>
										{#if saving}
											<span class="loading loading-spinner loading-xs"></span>
										{/if}
										Save
									</button>
								</div>
							</div>
						{:else}
							<!-- View Mode -->
							<div class="flex items-start gap-3">
								<svelte:component this={getRequirementIcon(key)} class="w-5 h-5 flex-shrink-0 mt-0.5 opacity-70" />
								<div class="flex-1 min-w-0">
									<div class="flex items-start justify-between">
										<h4 class="font-medium text-sm capitalize">
											{formatKey(key)}
										</h4>
										<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<button
												type="button"
												class="btn btn-ghost btn-xs btn-circle"
												onclick={() => startEditing(key, value)}
												disabled={saving}
												title="Edit"
											>
												<Edit2 class="w-3 h-3" />
											</button>
											<button
												type="button"
												class="btn btn-ghost btn-xs btn-circle text-error"
												onclick={() => openDeleteModal(key)}
												disabled={saving}
												title="Remove"
											>
												<Trash2 class="w-3 h-3" />
											</button>
										</div>
									</div>
									<div class="mt-1">
										{#if typeof value === 'boolean'}
											<span class="badge badge-sm {value ? 'badge-success' : 'badge-outline'}">
												{value ? 'Yes' : 'No'}
											</span>
										{:else}
											<p class="text-sm opacity-80 whitespace-pre-wrap">{formatValue(value)}</p>
										{/if}
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Saving indicator -->
	{#if saving}
		<div class="flex items-center justify-center gap-2 text-sm opacity-70">
			<span class="loading loading-spinner loading-xs"></span>
			Saving...
		</div>
	{/if}
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && deleteKey}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">Delete Requirement</h3>
			<p class="py-4">
				Are you sure you want to remove the <strong>"{formatKey(deleteKey)}"</strong> requirement?
			</p>
			<div class="modal-action">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={closeDeleteModal}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn-error"
					onclick={confirmDelete}
				>
					<Trash2 class="w-4 h-4" />
					Delete
				</button>
			</div>
		</div>
		<div class="modal-backdrop bg-black/50" onclick={closeDeleteModal}></div>
	</div>
{/if}
