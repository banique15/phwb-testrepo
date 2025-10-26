<script lang="ts">
	import { onMount } from 'svelte'

	interface Props {
		value?: string
		placeholder?: string
		debounceMs?: number
		onSearch?: (value: string) => void
		disabled?: boolean
		size?: 'sm' | 'md' | 'lg'
		showClearButton?: boolean
		loading?: boolean
	}

	let {
		value = '',
		placeholder = 'Search...',
		debounceMs = 300,
		onSearch,
		disabled = false,
		size = 'md',
		showClearButton = true,
		loading = false
	}: Props = $props()

	let inputValue = $state(value)
	let debounceTimer: ReturnType<typeof setTimeout> | null = null
	let inputElement: HTMLInputElement

	// Watch for external value changes
	$effect(() => {
		if (value !== inputValue) {
			inputValue = value
		}
	})

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement
		inputValue = target.value

		// Clear existing timer
		if (debounceTimer) {
			clearTimeout(debounceTimer)
		}

		// Set new timer
		debounceTimer = setTimeout(() => {
			onSearch?.(inputValue)
		}, debounceMs)
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			// Cancel debounce and search immediately
			if (debounceTimer) {
				clearTimeout(debounceTimer)
			}
			onSearch?.(inputValue)
		} else if (event.key === 'Escape') {
			clearSearch()
		}
	}

	function clearSearch() {
		inputValue = ''
		onSearch?.('')
		inputElement?.focus()
	}

	function handleClear() {
		clearSearch()
	}

	onMount(() => {
		return () => {
			if (debounceTimer) {
				clearTimeout(debounceTimer)
			}
		}
	})

	// Size classes
	const sizeClasses = {
		sm: 'input-sm',
		md: '',
		lg: 'input-lg'
	}
</script>

<div class="form-control w-full max-w-xs">
	<div class="input-group">
		<input 
			bind:this={inputElement}
			type="text"
			{placeholder}
			{disabled}
			class="input input-bordered w-full {sizeClasses[size]}"
			class:input-disabled={disabled}
			value={inputValue}
			oninput={handleInput}
			onkeydown={handleKeydown}
		/>
		
		<div class="btn-group">
			{#if showClearButton && inputValue}
				<button 
					type="button"
					class="btn btn-square {sizeClasses[size]}"
					onclick={handleClear}
					disabled={disabled}
					title="Clear search"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}
			
			<button 
				type="button"
				class="btn btn-square {sizeClasses[size]}"
				onclick={() => onSearch?.(inputValue)}
				disabled={disabled || loading}
				title="Search"
			>
				{#if loading}
					<span class="loading loading-spinner loading-sm"></span>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
					</svg>
				{/if}
			</button>
		</div>
	</div>
</div>