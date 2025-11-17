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

	function isEmpty(val: any): boolean {
		if (val === null || val === undefined || val === '') return true
		if (Array.isArray(val) && val.length === 0) return true
		return false
	}

	// For blank fields, always show in edit mode
	let isEditing = $derived.by(() => {
		if (disabled) return false
		// If field is blank, always show as editable
		return isEmpty(value)
	})
	
	let editValue = $state<string | number | boolean>('')
	let isLoading = $state(false)
	let validationError = $state<string | null>(null)
	let inputElement: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null = $state(null)
	let isManuallyEditing = $state(false) // Track if user manually entered edit mode

	// Initialize edit value when entering edit mode
	function startEdit() {
		if (disabled) return
		isManuallyEditing = true
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
		isManuallyEditing = false
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
			isManuallyEditing = false
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

	let isBlank = $derived(isEmpty(value))
	
	// Determine if we should show edit mode
	let shouldShowEdit = $derived(isEditing || isManuallyEditing)
	
	// Check if the current edit value is valid and different from the original
	function isValidInput(val: any): boolean {
		// Empty values are not valid (unless it's a checkbox, which is always valid)
		if (type === 'checkbox') {
			return true // Checkboxes are always valid
		}
		
		// For other types, check if value is not empty
		if (val === null || val === undefined || val === '') {
			return false
		}
		
		// For numbers, check if it's a valid number
		if (type === 'number') {
			const numValue = Number(val)
			if (isNaN(numValue)) return false
			if (min !== undefined && numValue < min) return false
			if (max !== undefined && numValue > max) return false
		}
		
		// For URLs, check if it's a valid URL
		if (type === 'url' && typeof val === 'string') {
			try {
				new URL(val)
			} catch {
				return false
			}
		}
		
		// Check max length
		if (maxLength && typeof val === 'string' && val.length > maxLength) {
			return false
		}
		
		return true
	}
	
	// Check if value has changed and is valid
	let canSave = $derived.by(() => {
		if (!shouldShowEdit) return false
		
		// Value must be valid
		if (!isValidInput(editValue)) return false
		
		// Value must be different from current value
		if (editValue === value) return false
		
		// For required fields, make sure it's not empty
		if (required && (editValue === '' || editValue === null || editValue === undefined)) {
			return false
		}
		
		return true
	})
	
	// Initialize edit value when value changes and we're in auto-edit mode
	$effect(() => {
		if (isEditing && !isManuallyEditing) {
			editValue = value ?? (type === 'number' ? 0 : type === 'checkbox' ? false : '')
		}
	})
</script>

<div class="inline-editable-field">
	{#if label}
		<div class="flex items-center gap-2 mb-1">
			<span class="text-sm font-medium opacity-70">{label}</span>
			{#if !disabled && !shouldShowEdit}
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

	{#if shouldShowEdit}
		<div class="flex items-start gap-1 w-full">
			<div class="flex-1">
				{#if type === 'textarea'}
					<textarea
						bind:this={inputElement}
						class="textarea textarea-bordered w-full {validationError || error ? 'textarea-error' : ''} {isBlank && !validationError && !error ? 'border-yellow-400 dark:border-yellow-600' : ''}"
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
						class="select select-bordered w-full {validationError || error ? 'select-error' : ''} {isBlank && !validationError && !error ? 'border-yellow-400 dark:border-yellow-600' : ''}"
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
						class="input input-bordered w-full {validationError || error ? 'input-error' : ''} {isBlank && !validationError && !error ? 'border-yellow-400 dark:border-yellow-600' : ''}"
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
				{#if canSave}
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
				{/if}
				{#if isManuallyEditing}
					<!-- Only show cancel button if user manually entered edit mode -->
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
		<!-- Display mode: Show selectable text -->
		<div class="flex items-start gap-2">
			<div class="flex-1 min-w-0">
				{#if type === 'select' && value}
					<span class="badge badge-sm {displayClass || 'badge-primary'}">
						{formatValue(value)}
					</span>
				{:else if type === 'url' && value && typeof value === 'string' && value.trim() !== ''}
					<a
						href={value}
						target="_blank"
						rel="noopener noreferrer"
						class="{displayClass || 'text-base'} link link-primary select-text break-all"
						style="user-select: text; -webkit-user-select: text;"
						onclick={(e) => e.stopPropagation()}
					>
						{formatValue(value)}
					</a>
				{:else}
					<p 
						class="{displayClass || 'text-base'} select-text {value === null || value === undefined || value === '' ? 'opacity-50' : ''}"
						style="user-select: text; -webkit-user-select: text; cursor: text;"
					>
						{formatValue(value)}
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

