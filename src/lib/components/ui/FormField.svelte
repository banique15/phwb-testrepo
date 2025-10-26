<script lang="ts">
	interface Props {
		label: string
		type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'textarea' | 'select' | 'date' | 'datetime-local' | 'time'
		value: string | number
		error?: string | string[]
		warning?: string
		success?: string
		placeholder?: string
		required?: boolean
		disabled?: boolean
		readonly?: boolean
		options?: { value: string | number; label: string }[]
		rows?: number
		min?: string | number
		max?: string | number
		step?: string | number
		pattern?: string
		helpText?: string
		showValid?: boolean
		onchange?: (value: string | number) => void
		onblur?: (value: string | number) => void
		onfocus?: (value: string | number) => void
	}
	
	let { 
		label, 
		type = 'text', 
		value = '', 
		error, 
		warning,
		success,
		placeholder, 
		required = false, 
		disabled = false,
		readonly = false,
		options = [],
		rows = 3,
		min,
		max,
		step,
		pattern,
		helpText,
		showValid = false,
		onchange,
		onblur,
		onfocus
	}: Props = $props()
	
	let focused = $state(false)
	let hasInteracted = $state(false)
	
	function handleInput(event: Event) {
		hasInteracted = true
		const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
		const newValue = type === 'number' ? Number(target.value) : target.value
		onchange?.(newValue)
	}
	
	function handleBlur(event: Event) {
		focused = false
		const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
		const newValue = type === 'number' ? Number(target.value) : target.value
		onblur?.(newValue)
	}
	
	function handleFocus(event: Event) {
		focused = true
		const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
		const newValue = type === 'number' ? Number(target.value) : target.value
		onfocus?.(newValue)
	}
	
	// Determine field state
	const hasError = $derived(error && (Array.isArray(error) ? error.length > 0 : true))
	const hasWarning = $derived(warning && !hasError)
	const hasSuccess = $derived(success && !hasError && !hasWarning && showValid)
	const isValid = $derived(!hasError && !hasWarning && hasInteracted && value !== '' && value !== null && value !== undefined)
	
	// Get error messages as array
	const errorMessages = $derived(() => {
		if (!error) return []
		return Array.isArray(error) ? error : [error]
	})
</script>

<div class="form-control w-full">
	<label class="label">
		<span class="label-text">
			{label}
			{#if required}
				<span class="text-error">*</span>
			{/if}
		</span>
		{#if helpText}
			<span class="label-text-alt text-base-content/60 tooltip tooltip-left" data-tip={helpText}>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</span>
		{/if}
	</label>
	
	{#if type === 'textarea'}
		<textarea 
			class="textarea textarea-bordered w-full transition-colors"
			class:textarea-error={hasError}
			class:textarea-warning={hasWarning}
			class:textarea-success={hasSuccess || (showValid && isValid)}
			class:ring-2={focused}
			class:ring-primary={focused && !hasError}
			class:ring-error={focused && hasError}
			{placeholder}
			{disabled}
			{readonly}
			{required}
			{value}
			{rows}
			{pattern}
			oninput={handleInput}
			onblur={handleBlur}
			onfocus={handleFocus}
		></textarea>
	{:else if type === 'select'}
		<select 
			class="select select-bordered w-full transition-colors"
			class:select-error={hasError}
			class:select-warning={hasWarning}
			class:select-success={hasSuccess || (showValid && isValid)}
			class:ring-2={focused}
			class:ring-primary={focused && !hasError}
			class:ring-error={focused && hasError}
			{disabled}
			{required}
			{value}
			onchange={handleInput}
			onblur={handleBlur}
			onfocus={handleFocus}
		>
			<option value="" disabled>Choose...</option>
			{#each options as option}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	{:else}
		<input 
			class="input input-bordered w-full transition-colors"
			class:input-error={hasError}
			class:input-warning={hasWarning}
			class:input-success={hasSuccess || (showValid && isValid)}
			class:ring-2={focused}
			class:ring-primary={focused && !hasError}
			class:ring-error={focused && hasError}
			{type}
			{placeholder}
			{disabled}
			{readonly}
			{required}
			{value}
			{min}
			{max}
			{step}
			{pattern}
			oninput={handleInput}
			onblur={handleBlur}
			onfocus={handleFocus}
		/>
	{/if}
	
	<!-- Messages -->
	<div class="label min-h-[1.5rem]">
		{#if hasError}
			<div class="space-y-1">
				{#each errorMessages as errorMsg}
					<span class="label-text-alt text-error flex items-center gap-1">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						{errorMsg}
					</span>
				{/each}
			</div>
		{:else if hasWarning}
			<span class="label-text-alt text-warning flex items-center gap-1">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.182 16.5c-.77.833.192 2.5 1.732 2.5z" />
				</svg>
				{warning}
			</span>
		{:else if hasSuccess}
			<span class="label-text-alt text-success flex items-center gap-1">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				</svg>
				{success}
			</span>
		{:else if showValid && isValid}
			<span class="label-text-alt text-success flex items-center gap-1">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				</svg>
				Valid
			</span>
		{/if}
	</div>
</div>