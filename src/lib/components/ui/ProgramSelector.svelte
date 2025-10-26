<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { supabase } from '$lib/supabase'

	interface Program {
		id: number
		title: string
		description?: string
		geo_coverage?: string
	}

	interface Props {
		value?: number
		placeholder?: string
		error?: string
		required?: boolean
		disabled?: boolean
	}

	let {
		value,
		placeholder = 'Search for a program...',
		error = '',
		required = false,
		disabled = false
	}: Props = $props()

	const dispatch = createEventDispatcher<{
		change: { value: number | undefined; program: Program | null }
	}>()

	// Component state
	let searchQuery = $state('')
	let isOpen = $state(false)
	let isLoading = $state(false)
	let programs = $state<Program[]>([])
	let selectedProgram = $state<Program | null>(null)
	let highlightedIndex = $state(-1)
	let searchTimeout: number | undefined

	// Input element reference for focus management
	let inputElement: HTMLInputElement

	// Watch for value changes to update selected program
	$effect(() => {
		if (value && value !== selectedProgram?.id) {
			loadSelectedProgram(value)
		} else if (!value) {
			selectedProgram = null
			searchQuery = ''
		}
	})

	// Load the selected program by ID
	async function loadSelectedProgram(programId: number) {
		try {
			const { data, error } = await supabase
				.from('phwb_programs')
				.select('id, title, description, geo_coverage')
				.eq('id', programId)
				.single()

			if (error) throw error

			if (data) {
				selectedProgram = data
				searchQuery = data.title
			}
		} catch (err) {
			console.error('Failed to load program:', err)
		}
	}

	// Search for programs
	async function searchPrograms(query: string) {
		if (!query.trim()) {
			programs = []
			return
		}

		isLoading = true
		try {
			const { data, error } = await supabase
				.from('phwb_programs')
				.select('id, title, description, geo_coverage')
				.or(`title.ilike.%${query}%,description.ilike.%${query}%,geo_coverage.ilike.%${query}%`)
				.order('title')
				.limit(10)

			if (error) throw error

			programs = data || []
		} catch (err) {
			console.error('Failed to search programs:', err)
			programs = []
		} finally {
			isLoading = false
		}
	}

	// Handle input changes
	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement
		searchQuery = target.value
		
		// Clear existing timeout
		if (searchTimeout) {
			clearTimeout(searchTimeout)
		}

		// Debounce search
		searchTimeout = setTimeout(() => {
			if (searchQuery !== (selectedProgram?.title || '')) {
				selectedProgram = null
				dispatch('change', { value: undefined, program: null })
			}
			searchPrograms(searchQuery)
			isOpen = searchQuery.length > 0
			highlightedIndex = -1
		}, 300)
	}

	// Handle program selection
	function selectProgram(program: Program) {
		selectedProgram = program
		searchQuery = program.title
		isOpen = false
		highlightedIndex = -1
		programs = []
		
		dispatch('change', { value: program.id, program })
	}

	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault()
				highlightedIndex = Math.min(highlightedIndex + 1, programs.length - 1)
				break
			case 'ArrowUp':
				event.preventDefault()
				highlightedIndex = Math.max(highlightedIndex - 1, -1)
				break
			case 'Enter':
				event.preventDefault()
				if (highlightedIndex >= 0 && programs[highlightedIndex]) {
					selectProgram(programs[highlightedIndex])
				}
				break
			case 'Escape':
				event.preventDefault()
				isOpen = false
				highlightedIndex = -1
				inputElement?.blur()
				break
		}
	}

	// Handle focus
	function handleFocus() {
		if (searchQuery && !selectedProgram) {
			searchPrograms(searchQuery)
			isOpen = true
		}
	}

	// Handle blur (with delay to allow for clicks)
	function handleBlur() {
		setTimeout(() => {
			isOpen = false
			highlightedIndex = -1
		}, 150)
	}

	// Clear selection
	function clearSelection() {
		selectedProgram = null
		searchQuery = ''
		programs = []
		isOpen = false
		dispatch('change', { value: undefined, program: null })
		inputElement?.focus()
	}
</script>

<div class="form-control w-full">
	<div class="relative">
		<input
			bind:this={inputElement}
			type="text"
			class="input input-bordered w-full {error ? 'input-error' : ''}"
			{placeholder}
			{disabled}
			{required}
			value={searchQuery}
			oninput={handleInput}
			onfocus={handleFocus}
			onblur={handleBlur}
			onkeydown={handleKeydown}
			autocomplete="off"
		/>

		<!-- Clear button -->
		{#if selectedProgram && !disabled}
			<button
				type="button"
				class="absolute right-3 top-1/2 transform -translate-y-1/2 text-base-content/50 hover:text-base-content"
				onclick={clearSelection}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}

		<!-- Loading indicator -->
		{#if isLoading}
			<div class="absolute right-3 top-1/2 transform -translate-y-1/2">
				<span class="loading loading-spinner loading-sm"></span>
			</div>
		{/if}

		<!-- Dropdown -->
		{#if isOpen && (programs.length > 0 || isLoading)}
			<div class="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
				{#if isLoading}
					<div class="px-4 py-3 text-center text-base-content/60">
						<span class="loading loading-spinner loading-sm mr-2"></span>
						Searching programs...
					</div>
				{:else if programs.length === 0}
					<div class="px-4 py-3 text-center text-base-content/60">
						No programs found
					</div>
				{:else}
					{#each programs as program, index}
						<button
							type="button"
							class="w-full px-4 py-3 text-left hover:bg-base-200 flex items-center justify-between {index === highlightedIndex ? 'bg-base-200' : ''}"
							onclick={() => selectProgram(program)}
						>
							<div class="flex-1">
								<div class="font-medium">
									{program.title}
								</div>
								{#if program.description}
									<div class="text-sm text-base-content/60">
										{program.description}
									</div>
								{/if}
								{#if program.geo_coverage}
									<div class="text-xs text-base-content/50">
										Coverage: {program.geo_coverage}
									</div>
								{/if}
							</div>
							<div class="text-xs text-base-content/40">
								ID: {program.id}
							</div>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>

	<!-- Error message -->
	{#if error}
		<div class="label">
			<span class="label-text-alt text-error">{error}</span>
		</div>
	{/if}

</div>