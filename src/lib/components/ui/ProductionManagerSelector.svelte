<script lang="ts">
	import { onMount } from 'svelte'
	import { supabase } from '$lib/supabase'

	interface ArtistInfo {
		full_name: string | null
		artist_name: string | null
		legal_first_name: string | null
		legal_last_name: string | null
	}

	interface ProductionManagerOption {
		id: string
		full_name: string | null
		legal_first_name: string | null
		legal_last_name: string | null
		email: string | null
		phone: string | null
		location: string | null
		artist_id: string | null
		source_type: 'artist' | 'non_artist' | null
		phwb_artists?: ArtistInfo[] | ArtistInfo | null
	}

	interface Props {
		value?: string | null
		placeholder?: string
		disabled?: boolean
		error?: boolean
		onchange?: (productionManagerId: string | null, productionManager: ProductionManagerOption | null) => void
	}

	let {
		value = null,
		placeholder = 'Select production manager (optional)',
		disabled = false,
		error = false,
		onchange
	}: Props = $props()

	let options = $state<ProductionManagerOption[]>([])
	let loading = $state(true)

	function getDisplayName(pm: ProductionManagerOption): string {
		const artist = Array.isArray(pm.phwb_artists) ? pm.phwb_artists[0] : pm.phwb_artists
		if (pm.full_name) return pm.full_name
		if (pm.legal_first_name || pm.legal_last_name) {
			return [pm.legal_first_name || '', pm.legal_last_name || ''].filter(Boolean).join(' ')
		}
		if (artist?.full_name) return artist.full_name
		if (artist?.artist_name) return artist.artist_name
		if (artist?.legal_first_name || artist?.legal_last_name) {
			return [artist.legal_first_name || '', artist.legal_last_name || ''].filter(Boolean).join(' ')
		}
		return 'Unknown'
	}

	function getOptionLabel(pm: ProductionManagerOption): string {
		const suffix = pm.artist_id ? 'Artist' : 'Non-artist'
		return `${getDisplayName(pm)} (${suffix})`
	}

	async function loadOptions() {
		loading = true
		try {
			const { data, error: queryError } = await supabase
				.from('phwb_production_managers')
				.select('id, full_name, legal_first_name, legal_last_name, email, phone, location, artist_id, source_type, phwb_artists(full_name, artist_name, legal_first_name, legal_last_name)')
				.order('full_name', { ascending: true, nullsFirst: false })

			if (queryError) throw queryError
			options = (data || []) as unknown as ProductionManagerOption[]
		} catch (e) {
			console.error('Failed to load production managers:', e)
			options = []
		} finally {
			loading = false
		}
	}

	onMount(() => {
		void loadOptions()
	})

	function handleChange(e: Event) {
		const select = e.target as HTMLSelectElement
		const id = select.value || null
		const selected = id ? options.find((o) => o.id === id) || null : null
		onchange?.(id, selected)
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
			{#each options as pm}
				<option value={pm.id}>{getOptionLabel(pm)}</option>
			{/each}
		{/if}
	</select>
</div>
