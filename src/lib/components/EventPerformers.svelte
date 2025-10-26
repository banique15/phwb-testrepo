<script lang="ts">
	import { onMount } from 'svelte'
	import { getEventPerformers } from '$lib/utils/performanceHistory'

	interface Props {
		eventId: number
		showDetails?: boolean
	}

	let { eventId, showDetails = true }: Props = $props()

	let performers = $state<any[]>([])
	let isLoading = $state(true)
	let error = $state<string | null>(null)

	onMount(async () => {
		await loadPerformers()
	})

	async function loadPerformers() {
		isLoading = true
		error = null

		try {
			performers = await getEventPerformers(eventId)
		} catch (err: any) {
			error = err.message || 'Failed to load performers'
			console.error('Error loading performers:', err)
		} finally {
			isLoading = false
		}
	}

	function formatInstruments(instruments: any): string {
		if (!instruments) return ''
		if (Array.isArray(instruments)) {
			return instruments.join(', ')
		}
		if (typeof instruments === 'object') {
			return Object.values(instruments).join(', ')
		}
		return String(instruments)
	}

	function formatGenres(genres: any): string {
		if (!genres) return ''
		if (Array.isArray(genres)) {
			return genres.join(', ')
		}
		if (typeof genres === 'object') {
			return Object.values(genres).join(', ')
		}
		return String(genres)
	}
</script>

<div class="space-y-3">
	<h3 class="text-lg font-semibold border-b pb-2">Performers ({performers.length})</h3>

	{#if isLoading}
		<div class="flex justify-center items-center py-8">
			<span class="loading loading-spinner loading-md"></span>
		</div>
	{:else if error}
		<div class="alert alert-error">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span>{error}</span>
		</div>
	{:else if performers.length === 0}
		<div class="alert alert-info">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span>No performers assigned to this event yet.</span>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
			{#each performers as performer}
				<div class="card bg-base-200 hover:bg-base-300 transition-colors">
					<div class="card-body p-4">
						<div class="flex items-start gap-3">
							<!-- Profile Photo -->
							{#if performer.profile_photo}
								<div class="avatar">
									<div class="w-12 h-12 rounded-full">
										<img src={performer.profile_photo} alt={performer.full_name || performer.artist_name} />
									</div>
								</div>
							{:else}
								<div class="avatar placeholder">
									<div class="bg-neutral text-neutral-content rounded-full w-12 h-12">
										<span class="text-xl">
											{(performer.full_name || performer.artist_name || 'A').charAt(0).toUpperCase()}
										</span>
									</div>
								</div>
							{/if}

							<!-- Artist Info -->
							<div class="flex-1 min-w-0">
								<a href="/artists?id={performer.id}" class="link link-hover font-semibold text-base">
									{performer.full_name || performer.artist_name || 'Unknown Artist'}
								</a>

								{#if performer.artist_name && performer.full_name && performer.artist_name !== performer.full_name}
									<div class="text-sm opacity-70">aka {performer.artist_name}</div>
								{/if}

								{#if showDetails}
									<!-- Instruments -->
									{#if performer.instruments}
										<div class="flex items-center gap-1 mt-2 text-sm">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
											</svg>
											<span class="opacity-70 truncate">{formatInstruments(performer.instruments) || 'Not specified'}</span>
										</div>
									{/if}

									<!-- Genres -->
									{#if performer.genres}
										<div class="flex items-center gap-1 mt-1 text-sm">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
											</svg>
											<span class="opacity-70 truncate">{formatGenres(performer.genres) || 'Not specified'}</span>
										</div>
									{/if}

									<!-- Contact Info -->
									<div class="flex flex-wrap gap-3 mt-2 text-xs">
										{#if performer.email}
											<a href="mailto:{performer.email}" class="link link-hover flex items-center gap-1">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
												</svg>
												Email
											</a>
										{/if}

										{#if performer.phone}
											<a href="tel:{performer.phone}" class="link link-hover flex items-center gap-1">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
												</svg>
												Phone
											</a>
										{/if}
									</div>

									<!-- Location -->
									{#if performer.location}
										<div class="text-xs opacity-70 mt-2">
											📍 {performer.location}
										</div>
									{/if}
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
