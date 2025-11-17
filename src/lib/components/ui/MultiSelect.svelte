<script lang="ts">
	import { Search, X, ChevronDown } from 'lucide-svelte'
	import { onMount } from 'svelte'

	interface Props {
		options: string[]
		selected: string[]
		onChange: (selected: string[]) => void
		placeholder?: string
		label?: string
		disabled?: boolean
		allowCustom?: boolean
		maxHeight?: string
	}

	let {
		options = [],
		selected = [],
		onChange,
		placeholder = 'Select options...',
		label,
		disabled = false,
		allowCustom = true,
		maxHeight = '300px'
	}: Props = $props()

	let isOpen = $state(false)
	let searchTerm = $state('')
	let dropdownRef: HTMLDivElement | null = $state(null)
	let inputRef: HTMLInputElement | null = $state(null)

	// Filter options based on search term
	let filteredOptions = $derived.by(() => {
		if (!searchTerm.trim()) return options
		const term = searchTerm.toLowerCase()
		return options.filter(opt => 
			opt.toLowerCase().includes(term) && !selected.includes(opt)
		)
	})

	// Check if there are any unselected options
	let hasUnselectedOptions = $derived(
		filteredOptions.length > 0 || (allowCustom && searchTerm.trim() && !options.some(opt => opt.toLowerCase() === searchTerm.toLowerCase()))
	)

	function toggleOption(option: string) {
		if (disabled) return
		const newSelected = selected.includes(option)
			? selected.filter(s => s !== option)
			: [...selected, option]
		onChange(newSelected)
	}

	function removeOption(option: string) {
		if (disabled) return
		onChange(selected.filter(s => s !== option))
	}

	function addCustomOption() {
		if (disabled || !allowCustom || !searchTerm.trim()) return
		const trimmed = searchTerm.trim()
		// Don't add if it already exists (case-insensitive)
		if (options.some(opt => opt.toLowerCase() === trimmed.toLowerCase())) {
			return
		}
		// Don't add if already selected
		if (selected.includes(trimmed)) {
			searchTerm = ''
			return
		}
		onChange([...selected, trimmed])
		searchTerm = ''
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && hasUnselectedOptions) {
			event.preventDefault()
			if (filteredOptions.length > 0) {
				toggleOption(filteredOptions[0])
			} else if (allowCustom && searchTerm.trim()) {
				addCustomOption()
			}
		} else if (event.key === 'Escape') {
			isOpen = false
			searchTerm = ''
		}
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
			isOpen = false
			searchTerm = ''
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside)
		return () => {
			document.removeEventListener('click', handleClickOutside)
		}
	})

	// Focus input when dropdown opens
	$effect(() => {
		if (isOpen && inputRef) {
			setTimeout(() => inputRef?.focus(), 10)
		}
	})
</script>

<div class="form-control" class:disabled>
	{#if label}
		<label class="label">
			<span class="label-text">{label}</span>
		</label>
	{/if}

	<div class="relative" bind:this={dropdownRef}>
		<!-- Selected items display -->
		<div
			class="min-h-[2.5rem] input input-bordered w-full flex flex-wrap gap-1 items-center p-2 cursor-pointer {disabled ? 'input-disabled' : ''} {selected.length === 0 ? 'border-yellow-400 dark:border-yellow-600' : ''}"
			onclick={() => {
				if (!disabled) isOpen = !isOpen
			}}
			role="button"
			tabindex="0"
		>
			{#if selected.length === 0}
				<span class="text-base-content/50 text-sm">{placeholder}</span>
			{:else}
				{#each selected as option}
					<span class="badge badge-primary badge-sm gap-1">
						{option}
						{#if !disabled}
							<button
								type="button"
								class="btn btn-xs btn-ghost btn-circle p-0 h-4 w-4 min-h-0"
								onclick={(e) => {
									e.stopPropagation()
									removeOption(option)
								}}
							>
								<X class="h-3 w-3" />
							</button>
						{/if}
					</span>
				{/each}
			{/if}
			<div class="ml-auto flex items-center gap-1">
				<ChevronDown class="h-4 w-4 text-base-content/50 {isOpen ? 'rotate-180' : ''} transition-transform" />
			</div>
		</div>

		<!-- Dropdown -->
		{#if isOpen && !disabled}
			<div
				class="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg"
				style="max-height: {maxHeight}; overflow-y: auto;"
			>
				<!-- Search input -->
				<div class="p-2 border-b border-base-300 sticky top-0 bg-base-100">
					<div class="relative">
						<Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-base-content/50" />
						<input
							bind:this={inputRef}
							type="text"
							class="input input-sm input-bordered w-full pl-9"
							placeholder="Search or type to add..."
							bind:value={searchTerm}
							onkeydown={handleKeyDown}
							onclick={(e) => e.stopPropagation()}
						/>
					</div>
				</div>

				<!-- Options list -->
				<div class="p-1">
					{#if filteredOptions.length > 0}
						{#each filteredOptions as option}
							<button
								type="button"
								class="w-full text-left px-3 py-2 hover:bg-base-200 rounded-md text-sm flex items-center gap-2"
								onclick={() => toggleOption(option)}
							>
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={selected.includes(option)}
									readonly
								/>
								<span>{option}</span>
							</button>
						{/each}
					{/if}

					<!-- Add custom option -->
					{#if allowCustom && searchTerm.trim() && !options.some(opt => opt.toLowerCase() === searchTerm.toLowerCase()) && !selected.includes(searchTerm.trim())}
						<button
							type="button"
							class="w-full text-left px-3 py-2 hover:bg-base-200 rounded-md text-sm flex items-center gap-2 text-primary"
							onclick={() => addCustomOption()}
						>
							<span class="text-lg">+</span>
							<span>Add "{searchTerm.trim()}"</span>
						</button>
					{/if}

					{#if filteredOptions.length === 0 && (!allowCustom || !searchTerm.trim())}
						<div class="px-3 py-2 text-sm text-base-content/50 text-center">
							No options found
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.disabled {
		opacity: 0.6;
		pointer-events: none;
	}
</style>

