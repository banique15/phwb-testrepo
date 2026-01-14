<script lang="ts">
	import { untrack } from 'svelte'
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
		onchange?: (e: CustomEvent<{ value: number | undefined; program: Program | null }>) => void
	}

	let {
		value,
		placeholder = 'Search for a program...',
		error = '',
		required = false,
		disabled = false,
		onchange
	}: Props = $props()

	// Helper to emit change events via callback prop
	function emitChange(detail: { value: number | undefined; program: Program | null }) {
		if (onchange) {
			const event = new CustomEvent('change', { detail })
			onchange(event)
		}
	}

	// Component state
	let searchQuery = $state('')
	let isOpen = $state(false)
	let isLoading = $state(false)
	let programs = $state<Program[]>([])
	let selectedProgram = $state<Program | null>(null)
	let highlightedIndex = $state(-1)
	let searchTimeout: number | undefined
	let lastLoadedValue: number | null = null
	let isSelecting = $state(false) // Flag to prevent $effect from interfering during selection

	// Input element reference for focus management
	let inputElement: HTMLInputElement

	// All programs cache for client-side filtering
	let allPrograms = $state<Program[]>([])
	let programsLoaded = $state(false)

	// Watch for value changes to update selected program
	$effect(() => {
		// Read value (this creates the dependency)
		const currentValue = value
		
		// Use untrack to prevent tracking other state changes
		untrack(() => {
			// Don't interfere if user is actively selecting
			if (isSelecting) return
			
			// Only load if value changed and we haven't already loaded this value
			if (currentValue != null && currentValue !== lastLoadedValue) {
				lastLoadedValue = currentValue
				loadSelectedProgram(currentValue)
			} else if (currentValue == null && lastLoadedValue !== null) {
				// Only clear if value is explicitly null (not just undefined)
				lastLoadedValue = null
				selectedProgram = null
				searchQuery = ''
			} else if (currentValue != null && selectedProgram && selectedProgram.id !== currentValue) {
				// Value changed from parent - sync the selection
				lastLoadedValue = currentValue
				loadSelectedProgram(currentValue)
			}
		})
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

	// Load all programs once for client-side filtering
	async function loadAllPrograms(force = false) {
		if (programsLoaded && !force) return
		
		isLoading = true
		try {
			const { data, error } = await supabase
				.from('phwb_programs')
				.select('id, title, description, geo_coverage')
				.order('title')

			if (error) throw error
			allPrograms = data || []
			programsLoaded = true
		} catch (err) {
			console.error('Failed to load programs:', err)
			allPrograms = []
		} finally {
			isLoading = false
		}
	}

	// Expose refresh function
	async function refreshPrograms() {
		programsLoaded = false
		await loadAllPrograms(true)
	}

	// Search for programs (client-side filtering)
	function searchPrograms(query: string) {
		const searchLower = query.toLowerCase().trim()
		
		if (!searchLower) {
			// Show all programs if no search query
			programs = allPrograms.slice(0, 50)
			return
		}
		
		// Filter programs by title, description, or geo_coverage
		programs = allPrograms.filter(program => {
			const title = program.title?.toLowerCase() || ''
			const description = program.description?.toLowerCase() || ''
			const geoCoverage = program.geo_coverage?.toLowerCase() || ''
			
			return title.includes(searchLower) ||
				description.includes(searchLower) ||
				geoCoverage.includes(searchLower)
		}).slice(0, 50)
	}

	// Handle input changes
	async function handleInput(event: Event) {
		const target = event.target as HTMLInputElement
		searchQuery = target.value
		
		// Clear existing timeout
		if (searchTimeout) {
			clearTimeout(searchTimeout)
		}

		// Load programs if not already loaded
		if (!programsLoaded) {
			await loadAllPrograms()
		}

		// Debounce search
		searchTimeout = setTimeout(() => {
			// Don't clear selection when typing - just show search results
			// Selection will only be cleared if user explicitly selects a different program
			// or clears it via the clear button
			searchPrograms(searchQuery)
			isOpen = true
			highlightedIndex = -1
		}, 300)
	}

	// Handle program selection
	function selectProgram(program: Program) {
		isSelecting = true
		lastLoadedValue = program.id
		selectedProgram = program
		searchQuery = program.title
		isOpen = false
		highlightedIndex = -1
		programs = []
		
		emitChange({ value: program.id, program })
		
		// Reset selecting flag after a brief delay to allow parent to update
		// This prevents $effect from interfering with the selection
		setTimeout(() => {
			isSelecting = false
			// Ensure lastLoadedValue and selectedProgram match the value prop after parent updates
			if (value === program.id) {
				lastLoadedValue = program.id
				// Keep the selected program if value matches
				if (!selectedProgram || selectedProgram.id !== program.id) {
					selectedProgram = program
					searchQuery = program.title
				}
			} else if (value !== null && value !== undefined) {
				// Value changed from parent - sync it
				lastLoadedValue = value
				loadSelectedProgram(value)
			}
		}, 300)
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

	// Handle focus - show all programs immediately
	async function handleFocus() {
		// Load programs on focus if not already loaded
		if (!programsLoaded) {
			await loadAllPrograms()
		}
		
		// If no selection, show all programs on focus
		if (!selectedProgram) {
			if (searchQuery) {
				searchPrograms(searchQuery)
			} else {
				// Show all programs
				programs = allPrograms.slice(0, 50)
			}
			isOpen = true
		}
	}

	// Expose refresh function - can be called externally
	export async function refresh() {
		await refreshPrograms()
	}

	// Handle blur (with delay to allow for clicks)
	function handleBlur() {
		setTimeout(() => {
			isOpen = false
			highlightedIndex = -1
			// Restore search query to match selected program if one is selected
			// This prevents clearing the selection when user clicks away
			if (selectedProgram && searchQuery !== selectedProgram.title) {
				searchQuery = selectedProgram.title
			}
		}, 150)
	}

	// Clear selection
	function clearSelection() {
		lastLoadedValue = null
		selectedProgram = null
		searchQuery = ''
		programs = []
		isOpen = false
		emitChange({ value: undefined, program: null })
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
		{#if isOpen}
			<div class="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-xl shadow-xl max-h-80 overflow-y-auto">
				{#if isLoading}
					<div class="px-4 py-6 text-center text-base-content/60">
						<span class="loading loading-spinner loading-md mb-2"></span>
						<p class="text-sm">Loading programs...</p>
					</div>
				{:else if programs.length === 0 && searchQuery.trim()}
					<div class="px-4 py-6 text-center">
						<div class="text-base-content/40 mb-2">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
							</svg>
						</div>
						<p class="text-sm text-base-content/60">No programs found for "{searchQuery}"</p>
						<p class="text-xs text-base-content/40 mt-1">Try searching by title, description, or coverage</p>
					</div>
				{:else if programs.length === 0}
					<div class="px-4 py-6 text-center text-base-content/60">
						<p class="text-sm">No programs available</p>
					</div>
				{:else}
					<!-- Header showing result count -->
					<div class="px-3 py-2 bg-base-200/50 border-b border-base-300 text-xs text-base-content/60">
						{#if searchQuery.trim()}
							{programs.length} program{programs.length !== 1 ? 's' : ''} found
						{:else}
							Select a program ({allPrograms.length} total)
						{/if}
					</div>
					
					{#each programs as program, index}
						<button
							type="button"
							class="w-full px-4 py-3 text-left transition-colors hover:bg-base-200 border-b border-base-200 last:border-b-0 {index === highlightedIndex ? 'bg-primary/5 border-l-2 border-l-primary' : ''}"
							onclick={() => selectProgram(program)}
						>
							<div class="flex items-start justify-between gap-3">
								<div class="flex-1 min-w-0">
									<div class="font-medium text-base-content">
										{program.title}
									</div>
									{#if program.description}
										<div class="text-sm text-base-content/60 mt-1 line-clamp-2">
											{program.description}
										</div>
									{/if}
									{#if program.geo_coverage}
										<div class="flex items-center gap-1 mt-1">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											<span class="text-xs text-base-content/50">Coverage: {program.geo_coverage}</span>
										</div>
									{/if}
								</div>
								<div class="text-xs text-base-content/40 shrink-0">
									ID: {program.id}
								</div>
							</div>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>

	<!-- Error message -->
	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}

</div>