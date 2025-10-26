<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { supabase } from '$lib/supabase'

	interface Artist {
		id: string
		full_name?: string
		legal_first_name?: string
		legal_last_name?: string
		artist_name?: string
	}

	interface Props {
		value?: string
		placeholder?: string
		error?: string
		required?: boolean
		disabled?: boolean
	}

	let {
		value = '',
		placeholder = 'Search for an artist...',
		error = '',
		required = false,
		disabled = false
	}: Props = $props()

	const dispatch = createEventDispatcher<{
		change: { value: string; artist: Artist | null }
	}>()

	// Component state
	let searchQuery = $state('')
	let isOpen = $state(false)
	let isLoading = $state(false)
	let artists = $state<Artist[]>([])
	let selectedArtist = $state<Artist | null>(null)
	let highlightedIndex = $state(-1)
	let searchTimeout: ReturnType<typeof setTimeout> | undefined

	// Input element reference for focus management
	let inputElement: HTMLInputElement

	// Watch for value changes to update selected artist
	$effect(() => {
		if (value && value !== selectedArtist?.id) {
			loadSelectedArtist(value)
		} else if (!value) {
			selectedArtist = null
			searchQuery = ''
		}
	})

	// Load the selected artist by ID
	async function loadSelectedArtist(artistId: string) {
		try {
			const { data, error } = await supabase
				.from('phwb_artists')
				.select('id, full_name, legal_first_name, legal_last_name, artist_name')
				.eq('id', artistId)
				.single()

			if (error) throw error

			if (data) {
				selectedArtist = data
				searchQuery = getArtistDisplayName(data)
			}
		} catch (err) {
			console.error('Failed to load artist:', err)
		}
	}

	// Search for artists
	async function searchArtists(query: string) {
		if (!query.trim()) {
			artists = []
			return
		}

		isLoading = true
		try {
			const { data, error } = await supabase
				.from('phwb_artists')
				.select('id, full_name, legal_first_name, legal_last_name, artist_name')
				.or(`full_name.ilike.%${query}%,legal_first_name.ilike.%${query}%,legal_last_name.ilike.%${query}%,artist_name.ilike.%${query}%`)
				.order('full_name')
				.limit(10)

			if (error) throw error

			artists = data || []
		} catch (err) {
			console.error('Failed to search artists:', err)
			artists = []
		} finally {
			isLoading = false
		}
	}

	// Get display name for an artist
	function getArtistDisplayName(artist: Artist): string {
		if (artist.full_name) return artist.full_name
		if (artist.legal_first_name && artist.legal_last_name) {
			return `${artist.legal_first_name} ${artist.legal_last_name}`
		}
		if (artist.artist_name) return artist.artist_name
		return 'Unknown Artist'
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
			if (searchQuery !== getArtistDisplayName(selectedArtist || {} as Artist)) {
				selectedArtist = null
				dispatch('change', { value: '', artist: null })
			}
			searchArtists(searchQuery)
			isOpen = searchQuery.length > 0
			highlightedIndex = -1
		}, 300)
	}

	// Handle artist selection
	function selectArtist(artist: Artist) {
		selectedArtist = artist
		searchQuery = getArtistDisplayName(artist)
		isOpen = false
		highlightedIndex = -1
		artists = []
		
		dispatch('change', { value: artist.id, artist })
	}

	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault()
				highlightedIndex = Math.min(highlightedIndex + 1, artists.length - 1)
				break
			case 'ArrowUp':
				event.preventDefault()
				highlightedIndex = Math.max(highlightedIndex - 1, -1)
				break
			case 'Enter':
				event.preventDefault()
				if (highlightedIndex >= 0 && artists[highlightedIndex]) {
					selectArtist(artists[highlightedIndex])
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
		if (searchQuery && !selectedArtist) {
			searchArtists(searchQuery)
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
		selectedArtist = null
		searchQuery = ''
		artists = []
		isOpen = false
		dispatch('change', { value: '', artist: null })
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
		{#if selectedArtist && !disabled}
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
		{#if isOpen && (artists.length > 0 || isLoading)}
			<div class="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
				{#if isLoading}
					<div class="px-4 py-3 text-center text-base-content/60">
						<span class="loading loading-spinner loading-sm mr-2"></span>
						Searching artists...
					</div>
				{:else if artists.length === 0}
					<div class="px-4 py-3 text-center text-base-content/60">
						No artists found
					</div>
				{:else}
					{#each artists as artist, index}
						<button
							type="button"
							class="w-full px-4 py-3 text-left hover:bg-base-200 flex items-center justify-between {index === highlightedIndex ? 'bg-base-200' : ''}"
							onclick={() => selectArtist(artist)}
						>
							<div>
								<div class="font-medium">
									{getArtistDisplayName(artist)}
								</div>
								{#if artist.artist_name && artist.artist_name !== artist.full_name}
									<div class="text-sm text-base-content/60">
										Stage name: {artist.artist_name}
									</div>
								{/if}
							</div>
							<div class="text-xs text-base-content/40 font-mono">
								{artist.id.slice(0, 8)}...
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

	<!-- Help text showing selected artist ID -->
	{#if selectedArtist}
		<!-- Removed: <div class="label">
			<span class="label-text-alt text-base-content/60">
				Selected: {selectedArtist.id}
			</span>
		</div> -->
	{/if}
</div>
