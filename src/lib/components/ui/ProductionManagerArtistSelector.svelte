<script lang="ts">
	import { onMount } from 'svelte'
	import { supabase } from '$lib/supabase'

	interface ArtistOption {
		id: string
		full_name: string | null
		legal_first_name: string | null
		legal_last_name: string | null
		artist_name: string | null
	}

	interface Props {
		value?: string | null
		placeholder?: string
		disabled?: boolean
		error?: boolean
		onchange?: (artistId: string | null, artist: ArtistOption | null) => void
	}

	let { value = null, placeholder = 'Select production manager (optional)', disabled = false, error = false, onchange }: Props = $props()

	let options = $state<ArtistOption[]>([])
	let loading = $state(true)

	function displayName(a: ArtistOption): string {
		if (a.full_name) return a.full_name
		const first = a.legal_first_name || ''
		const last = a.legal_last_name || ''
		if (first || last) return [first, last].filter(Boolean).join(' ')
		if (a.artist_name) return a.artist_name
		return 'Unknown'
	}

	onMount(async () => {
		loading = true
		try {
			const { data, err } = await supabase
				.from('phwb_artists')
				.select('id, full_name, legal_first_name, legal_last_name, artist_name')
				.eq('is_production_manager', true)
				.order('full_name')
			if (err) throw err
			options = (data || []) as ArtistOption[]
		} catch (e) {
			console.error('Failed to load production manager artists:', e)
			options = []
		} finally {
			loading = false
		}
	})

	function handleChange(e: Event) {
		const select = e.target as HTMLSelectElement
		const id = select.value || null
		const artist = id ? options.find((a) => a.id === id) || null : null
		onchange?.(id, artist)
	}
</script>

<div class="form-control">
	<select
		class="select select-bordered w-full {error ? 'select-error' : ''}"
		{disabled}
		value={value ?? ''}
		onchange={handleChange}
	>
		<option value="">{placeholder}</option>
		{#if loading}
			<option disabled>Loading...</option>
		{:else}
			{#each options as artist}
				<option value={artist.id}>{displayName(artist)}</option>
			{/each}
		{/if}
	</select>
</div>
