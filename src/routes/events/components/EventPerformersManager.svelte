<script lang="ts">
	import { onMount } from 'svelte'
	import { MapPin, X, Plus, Search, UserPlus, Send, ChevronDown, ChevronUp } from 'lucide-svelte'
	import { getEventPerformers } from '$lib/utils/performanceHistory'
	import { supabase } from '$lib/supabase'
	import type { Artist } from '$lib/schemas/artist'
	import { artistOutreachStore } from '$lib/stores/artistOutreach'
	import type { ConfirmationStatus, OutreachAttemptWithUser, CreateOutreachInput } from '$lib/schemas/outreach'
	import { normalizeConfirmationStatus } from '$lib/schemas/outreach'
	import ArtistConfirmationStatus from './ArtistConfirmationStatus.svelte'
	import OutreachTimeline from './OutreachTimeline.svelte'
	import LogOutreachModal from './LogOutreachModal.svelte'

	interface Props {
		eventId: number
		currentArtists: any // The current artists JSONB field from the event
		onUpdateArtists: (artists: any) => Promise<void>
	}

	let { eventId, currentArtists, onUpdateArtists }: Props = $props()

	let performers = $state<any[]>([])
	let isLoading = $state(true)
	let error = $state<string | null>(null)
	let isAdding = $state(false)
	let searchTerm = $state('')
	let allArtists = $state<Artist[]>([])
	let loadingArtists = $state(false)
	let saving = $state(false)

	// Outreach state
	let outreachSummary = $state<Map<string, {
		artist_id: string
		confirmation_status: ConfirmationStatus
		last_outreach_date?: string
		last_outreach_method?: string
		outreach_count: number
		confirmation_date?: string
	}>>(new Map())
	let expandedPerformers = $state<Set<string>>(new Set())
	let performerOutreach = $state<Map<string, OutreachAttemptWithUser[]>>(new Map())
	let loadingOutreach = $state<Set<string>>(new Set())

	// Modal state
	let showOutreachModal = $state(false)
	let selectedArtistForOutreach = $state<{ id: string; name: string } | null>(null)

	// Get the current list of assigned artist IDs
	let assignedArtistIds = $derived.by(() => {
		const ids = new Set<string>()
		if (Array.isArray(currentArtists)) {
			currentArtists.forEach(id => ids.add(id))
		} else if (currentArtists?.assignments) {
			currentArtists.assignments.forEach((a: any) => ids.add(a.artist_id))
		}
		return ids
	})

	// Get assignment data for a performer (status, notes, etc.)
	function getAssignment(performerId: string) {
		if (currentArtists?.assignments) {
			return currentArtists.assignments.find((a: any) => a.artist_id === performerId)
		}
		return null
	}

	// Get confirmation status for a performer
	function getConfirmationStatus(performerId: string): ConfirmationStatus {
		// First check outreach summary (derived from actual outreach records)
		const summary = outreachSummary.get(performerId)
		if (summary) {
			return summary.confirmation_status
		}

		// Fall back to assignment status
		const assignment = getAssignment(performerId)
		return normalizeConfirmationStatus(assignment?.status, assignment?.confirmation_status)
	}

	// Helper to get display name for an artist
	function getArtistDisplayName(artist: Artist): string {
		if (artist.full_name) return artist.full_name
		if (artist.artist_name) return artist.artist_name
		const parts = [artist.legal_first_name, artist.legal_last_name].filter(Boolean)
		if (parts.length > 0) return parts.join(' ')
		return 'Unknown Artist'
	}

	// Filter artists for the search dropdown (exclude already assigned)
	let filteredArtists = $derived.by(() => {
		let result = allArtists.filter(a => !assignedArtistIds.has(a.id!))
		if (searchTerm.trim()) {
			const search = searchTerm.toLowerCase()
			result = result.filter(a =>
				a.full_name?.toLowerCase().includes(search) ||
				a.artist_name?.toLowerCase().includes(search) ||
				a.legal_first_name?.toLowerCase().includes(search) ||
				a.legal_last_name?.toLowerCase().includes(search) ||
				a.email?.toLowerCase().includes(search)
			)
		}
		return result.slice(0, 10) // Limit to 10 results
	})

	onMount(async () => {
		await Promise.all([
			loadPerformers(),
			loadOutreachSummary()
		])
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

	async function loadOutreachSummary() {
		try {
			outreachSummary = await artistOutreachStore.getEventOutreachSummary(eventId)
		} catch (err) {
			console.error('Failed to load outreach summary:', err)
		}
	}

	async function loadPerformerOutreach(artistId: string) {
		if (performerOutreach.has(artistId)) return

		loadingOutreach = new Set([...loadingOutreach, artistId])
		try {
			const history = await artistOutreachStore.getOutreachHistory(eventId, artistId)
			performerOutreach = new Map([...performerOutreach, [artistId, history]])
		} catch (err) {
			console.error('Failed to load outreach for artist:', err)
		} finally {
			loadingOutreach = new Set([...loadingOutreach].filter(id => id !== artistId))
		}
	}

	async function loadAllArtists() {
		if (allArtists.length > 0) return // Already loaded
		loadingArtists = true
		try {
			const { data, error: supabaseError } = await supabase
				.from('phwb_artists')
				.select('*')
				.order('full_name')

			if (supabaseError) throw supabaseError
			allArtists = data || []
			console.log(`[EventPerformersManager] Loaded ${allArtists.length} artists`)
		} catch (err) {
			console.error('Failed to load artists:', err)
		} finally {
			loadingArtists = false
		}
	}

	function startAdding() {
		isAdding = true
		loadAllArtists()
	}

	function cancelAdding() {
		isAdding = false
		searchTerm = ''
	}

	async function addArtist(artist: Artist) {
		saving = true
		try {
			// Build new assignments list
			const existingAssignments = currentArtists?.assignments || []
			const newAssignment = {
				artist_id: artist.id,
				artist_name: getArtistDisplayName(artist),
				role: 'performer',
				status: 'pending',
				confirmation_status: 'not_contacted',
				num_hours: 0,
				hourly_rate: 0,
				notes: ''
			}

			const newArtists = {
				assignments: [...existingAssignments, newAssignment]
			}

			await onUpdateArtists(newArtists)
			// Update local state immediately for instant UI feedback
			performers = [...performers, artist]
			searchTerm = ''
		} catch (err) {
			console.error('Failed to add artist:', err)
		} finally {
			saving = false
		}
	}

	async function removeArtist(artistId: string) {
		if (!confirm('Remove this performer from the event?')) return

		saving = true
		try {
			const existingAssignments = currentArtists?.assignments || []
			const newAssignments = existingAssignments.filter((a: any) => a.artist_id !== artistId)

			const newArtists = newAssignments.length > 0
				? { assignments: newAssignments }
				: null

			await onUpdateArtists(newArtists)
			// Update local state immediately for instant UI feedback
			performers = performers.filter(p => p.id !== artistId)
		} catch (err) {
			console.error('Failed to remove artist:', err)
		} finally {
			saving = false
		}
	}

	function toggleExpanded(performerId: string) {
		const newExpanded = new Set(expandedPerformers)
		if (newExpanded.has(performerId)) {
			newExpanded.delete(performerId)
		} else {
			newExpanded.add(performerId)
			// Load outreach data when expanding
			loadPerformerOutreach(performerId)
		}
		expandedPerformers = newExpanded
	}

	function openOutreachModal(performer: any) {
		selectedArtistForOutreach = {
			id: performer.id,
			name: getPerformerDisplayName(performer)
		}
		showOutreachModal = true
	}

	async function handleOutreachSubmit(data: CreateOutreachInput) {
		await artistOutreachStore.addOutreach(data)
		// Refresh outreach data
		await loadOutreachSummary()
		// Clear cached outreach for this artist so it reloads
		const newPerformerOutreach = new Map(performerOutreach)
		newPerformerOutreach.delete(data.artist_id)
		performerOutreach = newPerformerOutreach
		// If expanded, reload
		if (expandedPerformers.has(data.artist_id)) {
			loadPerformerOutreach(data.artist_id)
		}
	}

	async function handleDeleteOutreach(outreachId: string, artistId: string) {
		try {
			await artistOutreachStore.deleteOutreach(outreachId)
			// Refresh data
			await loadOutreachSummary()
			const newPerformerOutreach = new Map(performerOutreach)
			newPerformerOutreach.delete(artistId)
			performerOutreach = newPerformerOutreach
			if (expandedPerformers.has(artistId)) {
				loadPerformerOutreach(artistId)
			}
		} catch (err) {
			console.error('Failed to delete outreach:', err)
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

	// Helper to get display name for a performer
	function getPerformerDisplayName(performer: any): string {
		if (performer.full_name) return performer.full_name
		if (performer.artist_name) return performer.artist_name
		const parts = [performer.legal_first_name, performer.legal_last_name].filter(Boolean)
		if (parts.length > 0) return parts.join(' ')
		return 'Unknown Artist'
	}

	function formatRelativeDate(dateStr: string): string {
		const date = new Date(dateStr)
		const now = new Date()
		const diffMs = now.getTime() - date.getTime()
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

		if (diffDays === 0) return 'Today'
		if (diffDays === 1) return 'Yesterday'
		if (diffDays < 7) return `${diffDays} days ago`
		if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
	}
</script>

<div class="space-y-4">
	<!-- Header with Add button -->
	<div class="flex items-center justify-between">
		<h3 class="text-lg font-semibold">Artists {#if !isLoading}({performers.length}){/if}</h3>
		{#if !isAdding}
			<button
				type="button"
				class="btn btn-primary btn-sm gap-2"
				onclick={startAdding}
				disabled={saving}
			>
				<UserPlus class="w-4 h-4" />
				Add Artist
			</button>
		{/if}
	</div>

	<!-- Add Artist Search UI -->
	{#if isAdding}
		<div class="card bg-base-200 p-4">
			<div class="flex items-center gap-2 mb-3">
				<Search class="w-4 h-4 opacity-70" />
				<span class="font-medium text-sm">Search for artists to add</span>
				<button
					type="button"
					class="btn btn-ghost btn-xs btn-circle ml-auto"
					onclick={cancelAdding}
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<input
				type="text"
				bind:value={searchTerm}
				placeholder="Search by name or email..."
				class="input input-bordered input-sm w-full mb-2"
				disabled={saving}
			/>

			{#if loadingArtists}
				<div class="flex justify-center py-4">
					<span class="loading loading-spinner loading-sm"></span>
				</div>
			{:else if filteredArtists.length > 0}
				{@const availableCount = allArtists.filter(a => !assignedArtistIds.has(a.id!)).length}
				{#if !searchTerm.trim() && availableCount > 10}
					<div class="text-xs text-base-content/60 mb-2">
						Showing 10 of {availableCount} available artists. Type to search for more.
					</div>
				{/if}
				<div class="border border-base-300 rounded-lg max-h-64 overflow-y-auto">
					{#each filteredArtists as artist}
						<button
							type="button"
							class="flex items-center gap-3 w-full p-3 hover:bg-base-300 transition-colors text-left border-b border-base-300 last:border-b-0"
							onclick={() => addArtist(artist)}
							disabled={saving}
						>
							{#if artist.profile_photo}
								<div class="avatar">
									<div class="w-8 h-8 rounded-full">
										<img src={artist.profile_photo} alt={getArtistDisplayName(artist)} />
									</div>
								</div>
							{:else}
								<div class="avatar placeholder">
									<div class="bg-neutral text-neutral-content rounded-full w-8 h-8">
										<span class="text-sm">
											{getArtistDisplayName(artist).charAt(0).toUpperCase()}
										</span>
									</div>
								</div>
							{/if}
							<div class="flex-1 min-w-0">
								<div class="font-medium text-sm truncate">
									{getArtistDisplayName(artist)}
								</div>
								{#if artist.instruments}
									<div class="text-xs opacity-70 truncate">
										{formatInstruments(artist.instruments)}
									</div>
								{/if}
							</div>
							<Plus class="w-4 h-4 text-primary flex-shrink-0" />
						</button>
					{/each}
				</div>
			{:else if searchTerm.trim()}
				{@const allMatching = allArtists.filter(a => {
					const search = searchTerm.toLowerCase()
					return a.full_name?.toLowerCase().includes(search) ||
						a.artist_name?.toLowerCase().includes(search) ||
						a.legal_first_name?.toLowerCase().includes(search) ||
						a.legal_last_name?.toLowerCase().includes(search) ||
						a.email?.toLowerCase().includes(search)
				})}
				<div class="text-center py-4 text-sm opacity-70">
					{#if allMatching.length > 0}
						All matching artists are already assigned to this event
					{:else}
						No artists found matching "{searchTerm}"
					{/if}
				</div>
			{:else if allArtists.length === 0}
				<div class="text-center py-4 text-sm opacity-70">
					No artists available
				</div>
			{:else}
				<div class="text-center py-4 text-sm opacity-70">
					All artists are already assigned to this event
				</div>
			{/if}
		</div>
	{/if}

	<!-- Loading State -->
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
		<div class="text-center py-8 border-2 border-dashed border-base-300 rounded-lg">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
			</svg>
			<p class="text-base opacity-70 mb-2">No artists assigned yet</p>
			<p class="text-sm opacity-50">Click "Add Artist" to assign artists to this event</p>
		</div>
	{:else}
		<!-- Performers List -->
		<div class="grid grid-cols-1 gap-3">
			{#each performers as performer}
				{@const isExpanded = expandedPerformers.has(performer.id)}
				{@const confirmationStatus = getConfirmationStatus(performer.id)}
				{@const summary = outreachSummary.get(performer.id)}
				<div class="card bg-base-200 hover:bg-base-300/50 transition-colors group">
					<div class="card-body p-4">
						<div class="flex items-start gap-3">
							<!-- Profile Photo -->
							{#if performer.profile_photo}
								<div class="avatar">
									<div class="w-12 h-12 rounded-full">
										<img src={performer.profile_photo} alt={getPerformerDisplayName(performer)} />
									</div>
								</div>
							{:else}
								<div class="avatar placeholder">
									<div class="bg-neutral text-neutral-content rounded-full w-12 h-12">
										<span class="text-xl">
											{getPerformerDisplayName(performer).charAt(0).toUpperCase()}
										</span>
									</div>
								</div>
							{/if}

							<!-- Artist Info -->
							<div class="flex-1 min-w-0">
								<div class="flex items-start justify-between gap-2">
									<div>
										<a href="/artists?id={performer.id}" class="link link-hover font-semibold text-base">
											{getPerformerDisplayName(performer)}
										</a>
										<!-- Confirmation Status Badge -->
										<div class="mt-1">
											<ArtistConfirmationStatus status={confirmationStatus} size="xs" />
										</div>
									</div>
									<div class="flex items-center gap-1">
										<!-- Log Outreach Button -->
										<button
											type="button"
											class="btn btn-ghost btn-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
											onclick={() => openOutreachModal(performer)}
											disabled={saving}
											title="Log outreach"
										>
											<Send class="w-3 h-3" />
											Log Outreach
										</button>
										<!-- Remove Button -->
										<button
											type="button"
											class="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100 transition-opacity text-error"
											onclick={() => removeArtist(performer.id)}
											disabled={saving}
											title="Remove performer"
										>
											<X class="w-4 h-4" />
										</button>
									</div>
								</div>

								{#if performer.artist_name && performer.full_name && performer.artist_name !== performer.full_name}
									<div class="text-sm opacity-70">aka {performer.artist_name}</div>
								{/if}

								<!-- Last Outreach Info -->
								{#if summary?.last_outreach_date}
									<div class="text-xs text-base-content/60 mt-1">
										Last contacted: {formatRelativeDate(summary.last_outreach_date)}
										{#if summary.outreach_count > 1}
											<span class="ml-1">({summary.outreach_count} attempts)</span>
										{/if}
									</div>
								{/if}

								<!-- Instruments -->
								{#if performer.instruments}
									<div class="flex items-center gap-1 mt-2 text-sm">
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
										</svg>
										<span class="opacity-70 truncate">{formatInstruments(performer.instruments) || 'Not specified'}</span>
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

									{#if performer.location}
										<span class="flex items-center gap-1 opacity-70">
											<MapPin class="w-3 h-3" />
											{performer.location}
										</span>
									{/if}
								</div>

								<!-- Expand/Collapse button for outreach history -->
								{#if summary?.outreach_count && summary.outreach_count > 0}
									<button
										type="button"
										class="btn btn-ghost btn-xs mt-2 gap-1"
										onclick={() => toggleExpanded(performer.id)}
									>
										{#if isExpanded}
											<ChevronUp class="w-3 h-3" />
											Hide outreach history
										{:else}
											<ChevronDown class="w-3 h-3" />
											Show outreach history
										{/if}
									</button>
								{/if}
							</div>
						</div>

						<!-- Expanded Outreach Timeline -->
						{#if isExpanded}
							<div class="mt-4 pt-4 border-t border-base-300">
								{#if loadingOutreach.has(performer.id)}
									<div class="flex justify-center py-4">
										<span class="loading loading-spinner loading-sm"></span>
									</div>
								{:else}
									<OutreachTimeline
										outreachHistory={performerOutreach.get(performer.id) || []}
										showDelete={true}
										onDelete={(outreachId) => handleDeleteOutreach(outreachId, performer.id)}
									/>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Saving indicator -->
	{#if saving}
		<div class="flex items-center justify-center gap-2 text-sm opacity-70">
			<span class="loading loading-spinner loading-xs"></span>
			Saving...
		</div>
	{/if}
</div>

<!-- Log Outreach Modal -->
{#if selectedArtistForOutreach}
	<LogOutreachModal
		isOpen={showOutreachModal}
		eventId={eventId}
		artistId={selectedArtistForOutreach.id}
		artistName={selectedArtistForOutreach.name}
		onClose={() => {
			showOutreachModal = false
			selectedArtistForOutreach = null
		}}
		onSubmit={handleOutreachSubmit}
	/>
{/if}
