<script lang="ts">
	import MultiSelect from './MultiSelect.svelte'
	import { GENRE_OPTIONS, INSTRUMENT_OPTIONS } from '$lib/utils/artist-options'

	interface Props {
		value: string[]
		field: 'genres' | 'instruments'
		onSave: (value: string[]) => Promise<void>
		label?: string
		disabled?: boolean
		formatDisplay?: (value: string[]) => string
	}

	let {
		value = [],
		field,
		onSave,
		label,
		disabled = false,
		formatDisplay
	}: Props = $props()

	let isEditing = $state(false)
	let isLoading = $state(false)
	let editValue = $state<string[]>([])
	let isManuallyEditing = $state(false)

	const options = field === 'genres' ? GENRE_OPTIONS : INSTRUMENT_OPTIONS
	const placeholder = field === 'genres' ? 'Select genres...' : 'Select instruments...'

	function startEdit() {
		if (disabled) return
		isManuallyEditing = true
		isEditing = true
		editValue = Array.isArray(value) ? [...value] : []
	}

	function cancelEdit() {
		isManuallyEditing = false
		isEditing = false
		editValue = Array.isArray(value) ? [...value] : []
	}

	async function saveEdit() {
		if (disabled) return
		
		// Check if value changed
		const current = Array.isArray(value) ? value.sort().join(',') : ''
		const newValue = editValue.sort().join(',')
		if (current === newValue) {
			cancelEdit()
			return
		}

		isLoading = true
		try {
			await onSave(editValue)
			// Exit edit mode after successful save
			isManuallyEditing = false
			isEditing = false
			// Update editValue to match the saved value to prevent auto-edit from triggering
			editValue = Array.isArray(editValue) ? [...editValue] : []
		} catch (err) {
			console.error('Failed to save:', err)
			// Don't exit edit mode on error so user can retry
		} finally {
			isLoading = false
		}
	}

	function getDisplayValue(): string {
		if (!Array.isArray(value) || value.length === 0) {
			return 'Not specified'
		}
		if (formatDisplay) {
			return formatDisplay(value)
		}
		return value.join(', ')
	}

	// Sync editValue when value prop changes (after save)
	$effect(() => {
		// If we're not editing and value has changed, sync editValue
		if (!isEditing && !isManuallyEditing) {
			editValue = Array.isArray(value) ? [...value] : []
		}
	})

	// Auto-edit if value is empty (only on initial mount, not after saves)
	$effect(() => {
		// Only auto-edit if:
		// 1. Value is truly empty (null, undefined, or empty array)
		// 2. User hasn't manually entered edit mode
		// 3. We're not currently editing (to avoid interfering with saves)
		if ((!value || (Array.isArray(value) && value.length === 0)) && !isManuallyEditing && !isEditing) {
			isEditing = true
			editValue = []
		}
	})
</script>

<div class="inline-editable-field">
	{#if label}
		<div class="flex items-center gap-2 mb-1">
			<span class="text-sm font-medium opacity-70">{label}</span>
			{#if !disabled && !isEditing}
				<button
					class="btn btn-xs btn-ghost opacity-40 hover:opacity-60 transition-opacity"
					onclick={startEdit}
					title="Edit"
					type="button"
				>
					<svg 
						xmlns="http://www.w3.org/2000/svg" 
						class="h-3 w-3" 
						fill="none" 
						viewBox="0 0 24 24" 
						stroke="currentColor"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
					</svg>
				</button>
			{/if}
		</div>
	{/if}

	{#if isEditing}
		<div class="flex items-start gap-1 w-full">
			<div class="flex-1">
				<MultiSelect
					options={options}
					selected={editValue}
					onChange={(selected) => { editValue = selected }}
					{placeholder}
					{disabled}
				/>
			</div>
			<div class="flex flex-col gap-1 pt-1">
				<button
					class="btn btn-xs btn-ghost text-success"
					onclick={saveEdit}
					disabled={isLoading}
					title="Save"
				>
					{#if isLoading}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
					{/if}
				</button>
				{#if isManuallyEditing}
					<button
						class="btn btn-xs btn-ghost text-error"
						onclick={cancelEdit}
						disabled={isLoading}
						title="Cancel"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				{/if}
			</div>
		</div>
	{:else}
		<div class="flex items-start gap-2">
			<div class="flex-1 min-w-0">
				{#if Array.isArray(value) && value.length > 0}
					<div class="flex flex-wrap gap-1">
						{#each value as item}
							<span class="badge badge-sm badge-outline">{item}</span>
						{/each}
					</div>
				{:else}
					<p class="text-base opacity-50 select-text" style="user-select: text; -webkit-user-select: text; cursor: text;">
						{getDisplayValue()}
					</p>
				{/if}
			</div>
			{#if !label && !disabled}
				<button
					class="btn btn-xs btn-ghost opacity-40 hover:opacity-60 transition-opacity flex-shrink-0"
					onclick={startEdit}
					title="Edit"
					type="button"
				>
					<svg 
						xmlns="http://www.w3.org/2000/svg" 
						class="h-3 w-3" 
						fill="none" 
						viewBox="0 0 24 24" 
						stroke="currentColor"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
					</svg>
				</button>
			{/if}
		</div>
	{/if}
</div>

