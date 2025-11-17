<script lang="ts">
	interface Props {
		value: string | number | boolean | null | undefined
		field: string
		type?: 'text' | 'textarea' | 'select' | 'number' | 'url' | 'checkbox'
		options?: Array<{ value: string; label: string }>
		placeholder?: string
		required?: boolean
		maxLength?: number
		min?: number
		max?: number
		onSave: (value: any) => Promise<void>
		onCancel?: () => void
		disabled?: boolean
		formatDisplay?: (value: any) => string
		label?: string
		rows?: number
		error?: string
		displayClass?: string
	}

	let {
		value,
		field,
		type = 'text',
		options = [],
		placeholder = '',
		required = false,
		maxLength,
		min,
		max,
		onSave,
		onCancel,
		disabled = false,
		formatDisplay,
		label,
		rows = 3,
		error,
		displayClass = ''
	}: Props = $props()

	let isEditing = $state(false)
	let editValue = $state<string | number | boolean>('')
	let isLoading = $state(false)
	let validationError = $state<string | null>(null)
	let inputElement: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null = $state(null)

	// Initialize edit value when entering edit mode
	function startEdit() {
		if (disabled) return
		isEditing = true
		editValue = value ?? (type === 'number' ? 0 : type === 'checkbox' ? false : '')
		validationError = null
		// Focus input after a brief delay to ensure it's rendered
		setTimeout(() => {
			inputElement?.focus()
			if (inputElement instanceof HTMLInputElement || inputElement instanceof HTMLTextAreaElement) {
				inputElement?.select()
			}
		}, 10)
	}

	function cancelEdit() {
		isEditing = false
		editValue = value ?? (type === 'number' ? 0 : type === 'checkbox' ? false : '')
		validationError = null
		onCancel?.()
	}

	async function saveEdit() {
		validationError = null

		// Basic validation
		if (required && (editValue === '' || editValue === null || editValue === undefined)) {
			validationError = 'This field is required'
			return
		}

		if (type === 'number') {
			const numValue = Number(editValue)
			if (isNaN(numValue)) {
				validationError = 'Please enter a valid number'
				return
			}
			if (min !== undefined && numValue < min) {
				validationError = `Value must be at least ${min}`
				return
			}
			if (max !== undefined && numValue > max) {
				validationError = `Value must be at most ${max}`
				return
			}
		}

		if (type === 'url' && editValue && typeof editValue === 'string') {
			try {
				new URL(editValue)
			} catch {
				validationError = 'Please enter a valid URL'
				return
			}
		}

		if (maxLength && typeof editValue === 'string' && editValue.length > maxLength) {
			validationError = `Maximum length is ${maxLength} characters`
			return
		}

		// If value hasn't changed, just cancel
		if (editValue === value) {
			cancelEdit()
			return
		}

		isLoading = true
		try {
			await onSave(editValue)
			isEditing = false
			validationError = null
		} catch (err) {
			validationError = err instanceof Error ? err.message : 'Failed to save. Please try again.'
		} finally {
			isLoading = false
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && type !== 'textarea') {
			event.preventDefault()
			saveEdit()
		} else if (event.key === 'Escape') {
			event.preventDefault()
			cancelEdit()
		}
	}

	function formatValue(val: any): string {
		if (val === null || val === undefined || val === '') {
			return placeholder || 'Not specified'
		}
		if (formatDisplay) {
			return formatDisplay(val)
		}
		if (type === 'checkbox') {
			return val ? 'Yes' : 'No'
		}
		return String(val)
	}

	function handleInputChange(event: Event) {
		const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
		if (type === 'number') {
			editValue = target.value === '' ? '' : Number(target.value)
		} else if (type === 'checkbox') {
			editValue = (target as HTMLInputElement).checked
		} else {
			editValue = target.value
		}
		validationError = null
	}
</script>

<div class="inline-editable-field">
	{#if label}
		<span class="text-sm font-medium opacity-70 block mb-1">{label}</span>
	{/if}

	{#if isEditing}
		<div class="flex items-start gap-1 w-full">
			<div class="flex-1">
				{#if type === 'textarea'}
					<textarea
						bind:this={inputElement}
						class="textarea textarea-bordered w-full {validationError || error ? 'textarea-error' : ''}"
						{placeholder}
						{required}
						{rows}
						{maxLength}
						value={editValue as string}
						oninput={handleInputChange}
						onkeydown={handleKeyDown}
						disabled={isLoading}
					></textarea>
				{:else if type === 'select'}
					<select
						bind:this={inputElement}
						class="select select-bordered w-full {validationError || error ? 'select-error' : ''}"
						{required}
						value={editValue as string}
						onchange={handleInputChange}
						onkeydown={handleKeyDown}
						disabled={isLoading}
					>
						{#if !required}
							<option value="">-- Select --</option>
						{/if}
						{#each options as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				{:else if type === 'checkbox'}
					<label class="label cursor-pointer justify-start gap-2">
						<input
							bind:this={inputElement}
							type="checkbox"
							class="checkbox"
							checked={editValue as boolean}
							onchange={handleInputChange}
							disabled={isLoading}
						/>
						<span class="label-text">{editValue ? 'Yes' : 'No'}</span>
					</label>
				{:else}
					<input
						bind:this={inputElement}
						type={type}
						class="input input-bordered w-full {validationError || error ? 'input-error' : ''}"
						{placeholder}
						{required}
						{maxLength}
						{min}
						{max}
						value={editValue as string | number}
						oninput={handleInputChange}
						onkeydown={handleKeyDown}
						disabled={isLoading}
					/>
				{/if}
				{#if validationError || error}
					<label class="label">
						<span class="label-text-alt text-error">{validationError || error}</span>
					</label>
				{/if}
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
			</div>
		</div>
	{:else}
		<div
			class="flex items-center gap-2 group {disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}"
			onclick={startEdit}
			role="button"
			tabindex={disabled ? -1 : 0}
			onkeydown={(e) => {
				if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
					e.preventDefault()
					startEdit()
				}
			}}
		>
			{#if type === 'select' && value}
				<span class="badge badge-primary badge-sm {displayClass}">
					{formatValue(value)}
				</span>
			{:else}
				<p class="{displayClass || 'text-base'} {value === null || value === undefined || value === '' ? 'opacity-50' : ''}">
					{formatValue(value)}
				</p>
			{/if}
			{#if !disabled}
				<svg 
					xmlns="http://www.w3.org/2000/svg" 
					class="h-3 w-3 opacity-40 group-hover:opacity-60 transition-opacity flex-shrink-0" 
					fill="none" 
					viewBox="0 0 24 24" 
					stroke="currentColor"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
				</svg>
			{/if}
		</div>
	{/if}
</div>

