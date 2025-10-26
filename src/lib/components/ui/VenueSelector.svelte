<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { supabase } from '$lib/supabase'

	interface Venue {
		id: number
		name: string
		address?: string
		type?: string
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
		placeholder = 'Search for a venue...',
		error = '',
		required = false,
		disabled = false
	}: Props = $props()

	const dispatch = createEventDispatcher<{
		change: { value: number | undefined; venue: Venue | null }
	}>()

	// Component state
	let searchQuery = $state('')
	let isOpen = $state(false)
	let isLoading = $state(false)
	let venues = $state<Venue[]>([])
	let selectedVenue = $state<Venue | null>(null)
	let highlightedIndex = $state(-1)
	let searchTimeout: number | undefined

	// Input element reference for focus management
	let inputElement: HTMLInputElement

	// Watch for value changes to update selected venue
	$effect(() => {
		if (value && value !== selectedVenue?.id) {
			loadSelectedVenue(value)
		} else if (!value) {
			selectedVenue = null
			searchQuery = ''
		}
	})

	// Load the selected venue by ID
	async function loadSelectedVenue(venueId: number) {
		try {
			const { data, error } = await supabase
				.from('phwb_venues')
				.select('id, name, address, type')
				.eq('id', venueId)
				.single()

			if (error) throw error

			if (data) {
				selectedVenue = data
				searchQuery = data.name
			}
		} catch (err) {
			console.error('Failed to load venue:', err)
		}
	}

	// Search for venues
	async function searchVenues(query: string) {
		if (!query.trim()) {
			venues = []
			return
		}

		isLoading = true
		try {
			const { data, error } = await supabase
				.from('phwb_venues')
				.select('id, name, address, type')
				.or(`name.ilike.%${query}%,address.ilike.%${query}%,type.ilike.%${query}%`)
				.order('name')
				.limit(10)

			if (error) throw error

			venues = data || []
		} catch (err) {
			console.error('Failed to search venues:', err)
			venues = []
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
			if (searchQuery !== (selectedVenue?.name || '')) {
				selectedVenue = null
				dispatch('change', { value: undefined, venue: null })
			}
			searchVenues(searchQuery)
			isOpen = searchQuery.length > 0
			highlightedIndex = -1
		}, 300)
	}

	// Handle venue selection
	function selectVenue(venue: Venue) {
		selectedVenue = venue
		searchQuery = venue.name
		isOpen = false
		highlightedIndex = -1
		venues = []
		
		dispatch('change', { value: venue.id, venue })
	}

	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault()
				highlightedIndex = Math.min(highlightedIndex + 1, venues.length - 1)
				break
			case 'ArrowUp':
				event.preventDefault()
				highlightedIndex = Math.max(highlightedIndex - 1, -1)
				break
			case 'Enter':
				event.preventDefault()
				if (highlightedIndex >= 0 && venues[highlightedIndex]) {
					selectVenue(venues[highlightedIndex])
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
		if (searchQuery && !selectedVenue) {
			searchVenues(searchQuery)
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
		selectedVenue = null
		searchQuery = ''
		venues = []
		isOpen = false
		dispatch('change', { value: undefined, venue: null })
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
		{#if selectedVenue && !disabled}
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
		{#if isOpen && (venues.length > 0 || isLoading)}
			<div class="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
				{#if isLoading}
					<div class="px-4 py-3 text-center text-base-content/60">
						<span class="loading loading-spinner loading-sm mr-2"></span>
						Searching venues...
					</div>
				{:else if venues.length === 0}
					<div class="px-4 py-3 text-center text-base-content/60">
						No venues found
					</div>
				{:else}
					{#each venues as venue, index}
						<button
							type="button"
							class="w-full px-4 py-3 text-left hover:bg-base-200 flex items-center justify-between {index === highlightedIndex ? 'bg-base-200' : ''}"
							onclick={() => selectVenue(venue)}
						>
							<div class="flex-1">
								<div class="font-medium">
									{venue.name}
								</div>
								{#if venue.address}
									<div class="text-sm text-base-content/60">
										{venue.address}
									</div>
								{/if}
								{#if venue.type}
									<div class="text-xs text-base-content/50 capitalize">
										{venue.type}
									</div>
								{/if}
							</div>
							<div class="text-xs text-base-content/40">
								ID: {venue.id}
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
