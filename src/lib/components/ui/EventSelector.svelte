<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { supabase } from '$lib/supabase'

	interface Event {
		id: number
		title: string
		date: string
		venue?: string
		venue_name?: string
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
		placeholder = 'Search for an event...',
		error = '',
		required = false,
		disabled = false
	}: Props = $props()

	const dispatch = createEventDispatcher<{
		change: { value: number | undefined; event: Event | null }
	}>()

	// Component state
	let searchQuery = $state('')
	let isOpen = $state(false)
	let isLoading = $state(false)
	let events = $state<Event[]>([])
	let selectedEvent = $state<Event | null>(null)
	let highlightedIndex = $state(-1)
	let searchTimeout: number | undefined

	// Input element reference for focus management
	let inputElement: HTMLInputElement

	// Watch for value changes to update selected event
	$effect(() => {
		if (value && value !== selectedEvent?.id) {
			loadSelectedEvent(value)
		} else if (!value) {
			selectedEvent = null
			searchQuery = ''
		}
	})

	// Load the selected event by ID
	async function loadSelectedEvent(eventId: number) {
		try {
			const { data, error } = await supabase
				.from('phwb_events')
				.select(`
					id, 
					title, 
					date,
					venues:venue(name)
				`)
				.eq('id', eventId)
				.single()

			if (error) throw error

			if (data) {
				const event = {
					...data,
					venue_name: data.venues?.name
				}
				selectedEvent = event
				searchQuery = getEventDisplayName(event)
			}
		} catch (err) {
			console.error('Failed to load event:', err)
		}
	}

	// Search for events
	async function searchEvents(query: string) {
		if (!query.trim()) {
			events = []
			return
		}

		isLoading = true
		try {
			const { data, error } = await supabase
				.from('phwb_events')
				.select(`
					id, 
					title, 
					date,
					venues:venue(name)
				`)
				.or(`title.ilike.%${query}%`)
				.order('date', { ascending: false })
				.limit(10)

			if (error) throw error

			events = (data || []).map(event => ({
				...event,
				venue_name: event.venues?.name
			}))
		} catch (err) {
			console.error('Failed to search events:', err)
			events = []
		} finally {
			isLoading = false
		}
	}

	// Get display name for an event
	function getEventDisplayName(event: Event): string {
		return event.title || 'Untitled Event'
	}

	// Handle input changes
	function handleInput(inputEvent: Event) {
		const target = inputEvent.target as HTMLInputElement
		searchQuery = target.value
		
		// Clear existing timeout
		if (searchTimeout) {
			clearTimeout(searchTimeout)
		}

		// Debounce search
		searchTimeout = setTimeout(() => {
			if (searchQuery !== getEventDisplayName(selectedEvent || {} as Event)) {
				selectedEvent = null
				dispatch('change', { value: undefined, event: null })
			}
			searchEvents(searchQuery)
			isOpen = searchQuery.length > 0
			highlightedIndex = -1
		}, 300)
	}

	// Handle event selection
	function selectEvent(event: Event) {
		selectedEvent = event
		searchQuery = getEventDisplayName(event)
		isOpen = false
		highlightedIndex = -1
		events = []
		
		dispatch('change', { value: event.id, event })
	}

	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault()
				highlightedIndex = Math.min(highlightedIndex + 1, events.length - 1)
				break
			case 'ArrowUp':
				event.preventDefault()
				highlightedIndex = Math.max(highlightedIndex - 1, -1)
				break
			case 'Enter':
				event.preventDefault()
				if (highlightedIndex >= 0 && events[highlightedIndex]) {
					selectEvent(events[highlightedIndex])
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
		if (searchQuery && !selectedEvent) {
			searchEvents(searchQuery)
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
		selectedEvent = null
		searchQuery = ''
		events = []
		isOpen = false
		dispatch('change', { value: undefined, event: null })
		inputElement?.focus()
	}

	// Format date for display
	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString()
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
		{#if selectedEvent && !disabled}
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
		{#if isOpen && (events.length > 0 || isLoading)}
			<div class="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
				{#if isLoading}
					<div class="px-4 py-3 text-center text-base-content/60">
						<span class="loading loading-spinner loading-sm mr-2"></span>
						Searching events...
					</div>
				{:else if events.length === 0}
					<div class="px-4 py-3 text-center text-base-content/60">
						No events found
					</div>
				{:else}
					{#each events as event, index}
						<button
							type="button"
							class="w-full px-4 py-3 text-left hover:bg-base-200 flex items-center justify-between {index === highlightedIndex ? 'bg-base-200' : ''}"
							onclick={() => selectEvent(event)}
						>
							<div class="flex-1">
								<div class="font-medium">
									{event.title || 'Untitled Event'}
								</div>
								<div class="text-sm text-base-content/60">
									{formatDate(event.date)}
									{#if event.venue_name}
										• {event.venue_name}
									{/if}
								</div>
							</div>
							<div class="text-xs text-base-content/40">
								ID: {event.id}
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

	<!-- Help text showing selected event ID -->
	{#if selectedEvent}
		<div class="label">
			<span class="label-text-alt text-base-content/60">
				Selected: {selectedEvent.title} (ID: {selectedEvent.id})
			</span>
		</div>
	{/if}
</div>
