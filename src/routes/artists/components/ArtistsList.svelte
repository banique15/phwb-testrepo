<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { Search } from 'lucide-svelte'
	import type { Artist } from '$lib/schemas/artist'

	interface Props {
		items: Artist[]
		selectedItem: Artist | null
		loading?: boolean
		searchQuery?: string
		filters?: {
			genres: string[]
			instruments: string[]
			status: string
			canBeSoloist: boolean | null
			sightReads: boolean | null
			hideIncomplete: boolean
			positionStatus: 'all' | 'active' | 'terminated'
			employmentType: 'all' | 'W-2' | '1099'
		}
	}

	let {
		items,
		selectedItem,
		loading = false,
		searchQuery = $bindable(''),
		filters = $bindable({
			genres: [],
			instruments: [],
			status: 'all',
			canBeSoloist: null,
			sightReads: null,
			hideIncomplete: false,
			positionStatus: 'all',
			employmentType: 'all'
		})
	}: Props = $props()

	const dispatch = createEventDispatcher()

	let showFilters = $state(false)

	// Filter items based on search and filters
	let filteredItems = $derived.by(() => {
		let result = [...items]

		// Hide incomplete contacts filter (placeholder emails and no valid phone)
		if (filters.hideIncomplete) {
			result = result.filter(artist => {
				// Check for placeholder emails
				const hasPlaceholderEmail =
					!artist.email ||
					artist.email.includes('@placeholder.local') ||
					artist.email.includes('@example.com') ||
					artist.email.includes('test@')

				// Check for placeholder or missing phone
				const hasValidPhone =
					artist.phone &&
					artist.phone !== '000-000-0000' &&
					artist.phone.trim() !== ''

				// Include only if has valid email AND valid phone
				return !hasPlaceholderEmail && hasValidPhone
			})
		}

		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase()
			result = result.filter(artist =>
				artist.full_name?.toLowerCase().includes(query) ||
				artist.artist_name?.toLowerCase().includes(query) ||
				artist.email?.toLowerCase().includes(query) ||
				artist.legal_first_name?.toLowerCase().includes(query) ||
				artist.legal_last_name?.toLowerCase().includes(query)
			)
		}

		// Genres filter
		if (filters.genres.length > 0) {
			result = result.filter(artist =>
				artist.genres && filters.genres.some(g => artist.genres.includes(g))
			)
		}

		// Instruments filter
		if (filters.instruments.length > 0) {
			result = result.filter(artist =>
				artist.instruments && filters.instruments.some(i => artist.instruments.includes(i))
			)
		}

		// Can be soloist filter
		if (filters.canBeSoloist !== null) {
			result = result.filter(artist => artist.can_be_soloist === filters.canBeSoloist)
		}

		// Sight reads filter
		if (filters.sightReads !== null) {
			result = result.filter(artist => artist.sightreads === filters.sightReads)
		}

		// Position status filter
		if (filters.positionStatus !== 'all') {
			result = result.filter(artist => artist.position_status === filters.positionStatus)
		}

		// Employment type filter
		if (filters.employmentType !== 'all') {
			result = result.filter(artist => artist.employment_status === filters.employmentType)
		}

		return result
	})

	function selectArtist(artist: Artist) {
		dispatch('select', { item: artist })
	}

	function getArtistName(artist: Artist): string {
		return artist.full_name ||
			   (artist.legal_first_name && artist.legal_last_name
				? `${artist.legal_first_name} ${artist.legal_last_name}`
				: artist.legal_first_name) ||
			   artist.artist_name ||
			   'No name'
	}

	function getArtistSubtitle(artist: Artist): string {
		return artist.artist_name || artist.email || ''
	}

	function clearFilters() {
		searchQuery = ''
		filters = {
			genres: [],
			instruments: [],
			status: 'all',
			canBeSoloist: null,
			sightReads: null,
			hideIncomplete: false,
			positionStatus: 'all',
			employmentType: 'all'
		}
	}

	let hasActiveFilters = $derived(
		searchQuery.trim() !== '' ||
		filters.genres.length > 0 ||
		filters.instruments.length > 0 ||
		filters.canBeSoloist !== null ||
		filters.sightReads !== null ||
		filters.hideIncomplete ||
		filters.positionStatus !== 'all' ||
		filters.employmentType !== 'all'
	)

	// Helper to get job title display name
	function getJobTitleLabel(jobTitle: string | undefined | null): string {
		if (!jobTitle) return ''
		const titles: Record<string, string> = {
			'MUSC - MUSICIAN': 'Musician',
			'ARPRT - ARTIST PARTNER': 'Artist Partner',
			'ARPTS - ARTIST PARTNERS': 'Artist Partner',
			'ARTST - ARTIST': 'Artist',
			'PIAN - PIANIST': 'Pianist',
			'SLAC - SFH LAB ACCOMPANIST': 'Accompanist',
			'PRLD - PROGRAM LEADER': 'Program Leader',
			'PPMG - PROGRAM & PRODUCTION MANAGER': 'Prod Manager',
			'PRMG - PRODUCTION MANAGER': 'Prod Manager',
			'CPTR - CAMP TEACHER': 'Camp Teacher',
			'CPADM - CAMP ADMIN': 'Camp Admin',
			'PLNO - PROJECT LEADER SFH PIANOS NEW ORLEANS': 'NOLA Lead',
			'CAAA - CREATIVE AGING ADMIN ASSISTANT': 'CA Admin'
		}
		return titles[jobTitle] || jobTitle.split(' - ')[0] || jobTitle
	}
</script>

<div class="flex flex-col h-full bg-base-200/30">
	<!-- Search and Filter Bar -->
	<div class="p-4 lg:p-6 border-b border-base-300 bg-base-100 space-y-3">
		<div class="flex gap-3">
			<div class="flex-1 relative">
				<input
					type="text"
					placeholder="Search artists by name, email, or location..."
					class="input input-bordered w-full pr-10"
					bind:value={searchQuery}
				/>
				{#if searchQuery}
					<button
						class="absolute right-3 top-1/2 -translate-y-1/2 btn btn-ghost btn-sm btn-circle"
						onclick={() => searchQuery = ''}
						aria-label="Clear search"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				{/if}
			</div>
			<button
				class="btn btn-outline"
				class:btn-active={showFilters}
				onclick={() => showFilters = !showFilters}
				aria-label="Toggle filters"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
				</svg>
				Filters
			</button>
		</div>

		{#if showFilters}
			<div class="space-y-2 p-2 bg-base-200/50 rounded-lg">
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold">Filters</span>
					{#if hasActiveFilters}
						<button class="btn btn-xs btn-ghost" onclick={clearFilters}>Clear all</button>
					{/if}
				</div>

				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-2 py-1">
						<input
							type="checkbox"
							class="checkbox checkbox-xs checkbox-primary"
							bind:checked={filters.hideIncomplete}
						/>
						<span class="label-text text-xs font-medium">Hide incomplete contacts</span>
					</label>
					<p class="text-xs opacity-60 ml-5 -mt-1">Excludes placeholder emails & missing phone numbers</p>
				</div>

				<div class="divider my-1"></div>

				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-2 py-1">
						<input
							type="checkbox"
							class="checkbox checkbox-xs"
							checked={filters.canBeSoloist === true}
							onchange={(e) => {
								filters.canBeSoloist = e.currentTarget.checked ? true : null
							}}
						/>
						<span class="label-text text-xs">Can be soloist</span>
					</label>
				</div>

				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-2 py-1">
						<input
							type="checkbox"
							class="checkbox checkbox-xs"
							checked={filters.sightReads === true}
							onchange={(e) => {
								filters.sightReads = e.currentTarget.checked ? true : null
							}}
						/>
						<span class="label-text text-xs">Sight reads</span>
					</label>
				</div>

				<div class="divider my-1"></div>

				<!-- Position Status Filter -->
				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-xs font-medium">Position Status</span>
					</label>
					<div class="flex gap-2">
						<label class="label cursor-pointer justify-start gap-1 py-0">
							<input
								type="radio"
								name="positionStatus"
								class="radio radio-xs"
								checked={filters.positionStatus === 'all'}
								onchange={() => filters.positionStatus = 'all'}
							/>
							<span class="label-text text-xs">All</span>
						</label>
						<label class="label cursor-pointer justify-start gap-1 py-0">
							<input
								type="radio"
								name="positionStatus"
								class="radio radio-xs radio-success"
								checked={filters.positionStatus === 'active'}
								onchange={() => filters.positionStatus = 'active'}
							/>
							<span class="label-text text-xs">Active</span>
						</label>
						<label class="label cursor-pointer justify-start gap-1 py-0">
							<input
								type="radio"
								name="positionStatus"
								class="radio radio-xs radio-error"
								checked={filters.positionStatus === 'terminated'}
								onchange={() => filters.positionStatus = 'terminated'}
							/>
							<span class="label-text text-xs">Terminated</span>
						</label>
					</div>
				</div>

				<!-- Employment Type Filter -->
				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-xs font-medium">Employment Type</span>
					</label>
					<div class="flex gap-2">
						<label class="label cursor-pointer justify-start gap-1 py-0">
							<input
								type="radio"
								name="employmentType"
								class="radio radio-xs"
								checked={filters.employmentType === 'all'}
								onchange={() => filters.employmentType = 'all'}
							/>
							<span class="label-text text-xs">All</span>
						</label>
						<label class="label cursor-pointer justify-start gap-1 py-0">
							<input
								type="radio"
								name="employmentType"
								class="radio radio-xs radio-info"
								checked={filters.employmentType === 'W-2'}
								onchange={() => filters.employmentType = 'W-2'}
							/>
							<span class="label-text text-xs">W-2</span>
						</label>
						<label class="label cursor-pointer justify-start gap-1 py-0">
							<input
								type="radio"
								name="employmentType"
								class="radio radio-xs radio-warning"
								checked={filters.employmentType === '1099'}
								onchange={() => filters.employmentType = '1099'}
							/>
							<span class="label-text text-xs">1099</span>
						</label>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Results Count -->
	<div class="px-4 lg:px-6 py-3 text-sm text-base-content/70 border-b border-base-300 bg-base-100">
		<span class="font-semibold">{filteredItems.length}</span> {filteredItems.length === 1 ? 'artist' : 'artists'}
		{#if hasActiveFilters}
			<span class="opacity-60 ml-1">(filtered from {items.length})</span>
		{/if}
	</div>

	<!-- Artists Grid -->
	<div class="flex-1 overflow-y-auto p-4 lg:p-6">
		{#if loading}
			<div class="flex items-center justify-center p-12">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{:else if filteredItems.length === 0}
			<div class="text-center p-12">
				<Search class="w-16 h-16 mx-auto mb-4 text-base-content/70" />
				<p class="text-lg font-medium text-base-content/90 mb-2">No artists found</p>
				<p class="text-sm text-base-content/60 mb-4">Try adjusting your search or filters</p>
				{#if hasActiveFilters}
					<button class="btn btn-primary btn-sm" onclick={clearFilters}>Clear all filters</button>
				{/if}
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-6">
				{#each filteredItems as artist (artist.id)}
					<button
						class="card bg-gradient-to-br from-base-100 to-base-200 shadow-depth-1 border border-base-300 transition-all duration-300 hover:scale-105 cursor-pointer group text-left"
						onclick={() => selectArtist(artist)}
					>
						<div class="card-body p-4 lg:p-5">
							<!-- Artist Name & Icon -->
							<div class="flex items-start justify-between mb-3">
								<div class="flex-1 min-w-0">
									<h3 class="font-bold text-base lg:text-lg text-base-content truncate group-hover:text-primary transition-colors">
										{getArtistName(artist)}
									</h3>
									{#if getArtistSubtitle(artist)}
										<p class="text-xs text-base-content/60 truncate mt-0.5">
											{getArtistSubtitle(artist)}
										</p>
									{/if}
								</div>
								<div class="text-primary/20 group-hover:text-primary/40 transition-colors ml-2 flex-shrink-0">
									<svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
										<path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
									</svg>
								</div>
							</div>

							<!-- Contact Info -->
							<div class="space-y-1.5 mb-3">
								<div class="flex items-center gap-2 text-xs text-base-content/70">
									<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
									</svg>
									<span class="truncate {!artist.email ? 'border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1' : ''}">{artist.email || 'No email'}</span>
								</div>
								<div class="flex items-center gap-2 text-xs text-base-content/70">
									<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
									</svg>
									<span class="{!artist.phone ? 'border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1' : ''}">{artist.phone || 'No phone'}</span>
								</div>
								<div class="flex items-center gap-2 text-xs text-base-content/70">
									<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
									</svg>
									<span class="truncate {!artist.location ? 'border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1' : ''}">{artist.location || 'No location'}</span>
								</div>
							</div>

							<!-- Status Badges -->
							<div class="flex flex-wrap gap-1 mb-2">
								{#if artist.position_status === 'terminated'}
									<span class="badge badge-xs badge-error">Terminated</span>
								{/if}
								{#if artist.employment_status}
									<span class="badge badge-xs {artist.employment_status === 'W-2' || artist.employment_status === 'W2' ? 'badge-info' : 'badge-warning'}">{artist.employment_status}</span>
								{/if}
								{#if artist.job_title}
									<span class="badge badge-xs badge-ghost">{getJobTitleLabel(artist.job_title)}</span>
								{/if}
							</div>

							<!-- Skills & Tags -->
							<div class="flex flex-wrap gap-1.5 mt-auto">
								{#if artist.can_be_soloist}
									<span class="badge badge-sm badge-primary">Soloist</span>
								{/if}
								{#if artist.sightreads}
									<span class="badge badge-sm badge-secondary">Sight Reads</span>
								{/if}
								{#if artist.instruments && artist.instruments.length > 0}
									<span class="badge badge-sm badge-outline">{artist.instruments[0]}</span>
									{#if artist.instruments.length > 1}
										<span class="badge badge-sm badge-ghost">+{artist.instruments.length - 1}</span>
									{/if}
								{/if}
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
