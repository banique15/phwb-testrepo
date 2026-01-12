<script lang="ts">
	import { onMount } from 'svelte'
	import { ChevronRight, ChevronLeft, Users, Search, Edit2, X } from 'lucide-svelte'
	import { supabase } from '$lib/supabase'
	import type { Artist } from '$lib/schemas/artist'
	import type { Ensemble } from '$lib/schemas/ensemble'

	export interface ArtistAssignment {
		artist_id: string
		artist_name?: string
		role?: string
		status?: 'pending' | 'confirmed' | 'declined' | 'assigned' | 'booking' | 'hold'
		num_hours?: number
		hourly_rate?: number
		notes?: string
	}

	interface Props {
		// For create mode: pass assignments directly
		assignments?: ArtistAssignment[]
		onAssignmentsUpdate?: (assignments: ArtistAssignment[]) => void
		// For edit mode: pass eventId to load from database
		eventId?: number
		readonly?: boolean
		mode?: 'create' | 'edit' // 'create' uses assignments prop, 'edit' uses eventId
	}

	let { 
		assignments: initialAssignments = [], 
		onAssignmentsUpdate, 
		eventId,
		readonly = false,
		mode = eventId ? 'edit' : 'create'
	}: Props = $props()

	// Component state
	let allArtists = $state<Artist[]>([])
	let allEnsembles = $state<(Ensemble & { member_count?: number })[]>([])
	let isLoading = $state(true)
	let error = $state<string | null>(null)
	let artistSearch = $state('')
	let selectedLeftArtistId = $state<string | null>(null)
	let selectedCenterArtistId = $state<string | null>(null)
	let selectedRightArtistId = $state<string | null>(null)
	let updating = $state(false)
	let localAssignments = $state<ArtistAssignment[]>([...initialAssignments])
	let editingAssignmentId = $state<string | null>(null) // artist_id being edited
	let showAssignmentModal = $state(false)
	let modalAssignment = $state<ArtistAssignment | null>(null)

	// Role options
	const roleOptions = [
		'Lead Vocalist',
		'Background Vocalist', 
		'Pianist',
		'Guitarist',
		'Violinist',
		'Conductor',
		'Music Director',
		'Teaching Artist',
		'Accompanist',
		'Soloist',
		'Ensemble Member',
		'Other'
	]

	// Status options
	const statusOptions = [
		{ value: 'pending', label: 'Pending', class: 'badge-warning' },
		{ value: 'assigned', label: 'Assigned', class: 'badge-info' },
		{ value: 'booking', label: 'Booking', class: 'badge-info' },
		{ value: 'hold', label: 'Hold', class: 'badge-warning' },
		{ value: 'confirmed', label: 'Confirmed', class: 'badge-success' },
		{ value: 'declined', label: 'Declined', class: 'badge-error' }
	]

	// Load data on mount
	onMount(async () => {
		await loadAllData()
		if (mode === 'edit' && eventId) {
			await loadAssignments()
		}
		// loadAllData already sets isLoading = false in its finally block
	})

	// Watch for changes in assignments prop (create mode only)
	$effect(() => {
		if (mode === 'create' && !eventId && initialAssignments) {
			localAssignments = [...initialAssignments]
		}
	})

	// Watch for eventId changes (edit mode)
	$effect(() => {
		if (eventId && mode === 'edit') {
			loadAssignments()
		} else if (mode === 'edit' && !eventId && initialAssignments) {
			// Edit mode without eventId - use assignments prop directly
			localAssignments = [...initialAssignments]
			isLoading = false
		}
	})

	async function loadAllData() {
		isLoading = true
		try {
			await Promise.all([loadAllArtists(), loadAllEnsembles()])
		} finally {
			isLoading = false
		}
	}

	async function loadAssignments() {
		if (!eventId) return
		
		isLoading = true
		error = null

		try {
			const { data: event, error: eventError } = await supabase
				.from('phwb_events')
				.select('artists')
				.eq('id', eventId)
				.single()

			if (eventError) throw eventError

			if (!event?.artists) {
				localAssignments = []
				isLoading = false
				return
			}

			let assignmentData: ArtistAssignment[] = []
			
			if (Array.isArray(event.artists)) {
				assignmentData = event.artists.map((id: string) => ({
					artist_id: id,
					status: 'assigned'
				}))
			} else if (event.artists.assignments) {
				assignmentData = event.artists.assignments
			}

			if (assignmentData.length === 0) {
				localAssignments = []
				isLoading = false
				return
			}

			// Fetch artist details for assignments
			const artistIds = assignmentData.map(a => a.artist_id).filter(id => typeof id === 'string')
			if (artistIds.length > 0) {
				const { data: artists, error: artistsError } = await supabase
					.from('phwb_artists')
					.select('id, full_name, artist_name, email, profile_photo, instruments')
					.in('id', artistIds)

				if (artistsError) throw artistsError

				// Merge artist details with assignments
				localAssignments = assignmentData.map(assignment => {
					const artist = artists?.find(a => a.id === assignment.artist_id)
					return {
						...assignment,
						artist_name: assignment.artist_name || artist?.full_name || artist?.artist_name || 'Unknown Artist'
					}
				})
			} else {
				localAssignments = assignmentData
			}
		} catch (err: any) {
			error = err.message || 'Failed to load performers'
			console.error('Error loading performers:', err)
		} finally {
			isLoading = false
		}
	}

	async function loadAllArtists() {
		try {
			const { data, error: artistsError } = await supabase
				.from('phwb_artists')
				.select('id, full_name, artist_name, legal_first_name, legal_last_name, email, profile_photo, instruments')
				.order('full_name')

			if (artistsError) {
				console.error('Error loading artists:', artistsError)
				throw artistsError
			}
			allArtists = data || []
		} catch (err: any) {
			console.error('Error loading artists:', err)
			allArtists = []
			// Don't throw - allow component to continue with empty list
		}
	}

	async function loadAllEnsembles() {
		try {
			const { data: ensembleData, error: ensemblesError } = await supabase
				.from('phwb_ensembles')
				.select('id, name, description, ensemble_type, status')
				.eq('status', 'active')
				.order('name')

			if (ensemblesError) {
				console.error('Error loading ensembles:', ensemblesError)
				throw ensemblesError
			}

			const ensemblesWithCounts = await Promise.all(
				(ensembleData || []).map(async (ensemble) => {
					const { count, error: countError } = await supabase
						.from('phwb_ensemble_members')
						.select('*', { count: 'exact', head: true })
						.eq('ensemble_id', ensemble.id)
						.eq('is_active', true)

					return {
						...ensemble,
						member_count: countError ? 0 : (count || 0)
					}
				})
			)

			allEnsembles = ensemblesWithCounts
		} catch (err: any) {
			console.error('Error loading ensembles:', err)
			allEnsembles = []
			// Don't throw - allow component to continue with empty list
		}
	}

	// Create combined list of artists and ensembles
	let availableItems = $derived.by(() => {
		const assignedArtistIds = new Set(localAssignments.map(a => a.artist_id))
		
		const artistItems = allArtists
			.filter(artist => !assignedArtistIds.has(artist.id!))
			.map(artist => ({ ...artist, type: 'artist' as const }))

		const ensembleItems = allEnsembles
			.map(ensemble => ({ ...ensemble, type: 'ensemble' as const }))

		const combined = [...artistItems, ...ensembleItems].sort((a, b) => {
			const nameA = a.type === 'artist' 
				? getArtistDisplayName(a).toLowerCase()
				: (a.name || '').toLowerCase()
			const nameB = b.type === 'artist'
				? getArtistDisplayName(b).toLowerCase()
				: (b.name || '').toLowerCase()
			return nameA.localeCompare(nameB)
		})

		if (artistSearch.trim()) {
			const searchLower = artistSearch.toLowerCase()
			return combined.filter(item => {
				if (item.type === 'artist') {
					const name = getArtistDisplayName(item).toLowerCase()
					const email = (item.email || '').toLowerCase()
					return name.includes(searchLower) || email.includes(searchLower)
				} else {
					const name = (item.name || '').toLowerCase()
					const description = (item.description || '').toLowerCase()
					const type = (item.ensemble_type || '').toLowerCase()
					return name.includes(searchLower) || description.includes(searchLower) || type.includes(searchLower)
				}
			})
		}

		return combined
	})

	// Enrich assignments with artist data for display
	let enrichedAssignments = $derived.by(() => {
		return localAssignments.map(assignment => {
			const artist = allArtists.find(a => a.id === assignment.artist_id)
			return {
				...assignment,
				...artist,
				artist_id: assignment.artist_id,
				// Preserve assignment-specific fields
				role: assignment.role,
				status: assignment.status,
				num_hours: assignment.num_hours,
				hourly_rate: assignment.hourly_rate,
				notes: assignment.notes
			}
		})
	})

	// Split assignments into pending and confirmed
	let pendingArtists = $derived.by(() => {
		return enrichedAssignments.filter(a => 
			!a.status || 
			a.status === 'booking' || 
			a.status === 'hold' || 
			a.status === 'assigned' ||
			a.status === 'pending'
		)
	})

	let confirmedArtists = $derived.by(() => {
		return enrichedAssignments.filter(a => a.status === 'confirmed')
	})

	function getArtistDisplayName(artist: any): string {
		return artist.full_name || 
			   `${artist.legal_first_name || ''} ${artist.legal_last_name || ''}`.trim() ||
			   artist.artist_name ||
			   'Unknown Artist'
	}

	async function saveAssignments() {
		if (mode === 'edit' && eventId) {
			// Save to database
			updating = true
			try {
				const { error: updateError } = await supabase
					.from('phwb_events')
					.update({ 
						artists: localAssignments.length > 0 ? { assignments: localAssignments } : null
					})
					.eq('id', eventId)

				if (updateError) throw updateError
				await loadAssignments()
			} catch (err: any) {
				error = err.message || 'Failed to save assignments'
				console.error('Error saving assignments:', err)
			} finally {
				updating = false
			}
		}
		// Always notify parent (for both create and edit modes)
		// This allows parent components to handle saving when eventId is not provided
		onAssignmentsUpdate?.(localAssignments)
	}

	async function assignArtist(artistId: string) {
		if (!artistId) return

		updating = true
		try {
			const ensemble = allEnsembles.find(e => e.id === artistId)
			
			if (ensemble) {
				// Handle ensemble assignment
				const { data: members, error: membersError } = await supabase
					.from('phwb_ensemble_members')
					.select('artist_id, role, phwb_artists(id, full_name, artist_name, legal_first_name, legal_last_name)')
					.eq('ensemble_id', artistId)
					.eq('is_active', true)

				if (membersError) throw membersError

				if (!members || members.length === 0) {
					throw new Error('Ensemble has no active members')
				}

				const existingArtistIds = new Set(localAssignments.map(a => a.artist_id))
				const newAssignments = members
					.filter((member: any) => !existingArtistIds.has(member.artist_id))
					.map((member: any) => {
						const artist = member.phwb_artists
						const artistName = artist?.full_name || 
							`${artist?.legal_first_name || ''} ${artist?.legal_last_name || ''}`.trim() ||
							artist?.artist_name || 
							'Unknown Artist'
						return {
							artist_id: member.artist_id,
							artist_name: artistName,
							role: member.role || 'Ensemble Member',
							status: 'assigned' as const,
							num_hours: 0,
							hourly_rate: 0,
							notes: ''
						}
					})

				localAssignments = [...localAssignments, ...newAssignments]
			} else {
				// Handle artist assignment
				const artist = allArtists.find(a => a.id === artistId)
				if (!artist) throw new Error('Artist not found')

				const newAssignment: ArtistAssignment = {
					artist_id: artistId,
					artist_name: getArtistDisplayName(artist),
					status: 'assigned',
					num_hours: 0,
					hourly_rate: 0,
					notes: ''
				}

				localAssignments = [...localAssignments, newAssignment]
			}

			await saveAssignments()
			selectedLeftArtistId = null
		} catch (err: any) {
			console.error('Error assigning artist/ensemble:', err)
			error = err.message || 'Failed to assign artist/ensemble'
		} finally {
			updating = false
		}
	}

	async function confirmArtist(artistId: string) {
		if (!artistId) return

		const assignment = localAssignments.find(a => a.artist_id === artistId)
		if (assignment) {
			assignment.status = 'confirmed'
			await saveAssignments()
			selectedCenterArtistId = null
		}
	}

	async function unconfirmArtist(artistId: string) {
		if (!artistId) return

		const assignment = localAssignments.find(a => a.artist_id === artistId)
		if (assignment) {
			assignment.status = 'assigned'
			await saveAssignments()
			selectedRightArtistId = null
		}
	}

	async function unassignArtist(artistId: string) {
		if (!artistId) return

		localAssignments = localAssignments.filter(a => a.artist_id !== artistId)
		await saveAssignments()
		selectedCenterArtistId = null
		selectedRightArtistId = null
	}

	function openAssignmentModal(assignment: ArtistAssignment, event?: Event) {
		event?.stopPropagation()
		modalAssignment = { ...assignment }
		showAssignmentModal = true
	}

	function closeAssignmentModal() {
		showAssignmentModal = false
		modalAssignment = null
	}

	async function saveAssignmentDetails() {
		if (!modalAssignment) return

		const index = localAssignments.findIndex(a => a.artist_id === modalAssignment!.artist_id)
		if (index !== -1) {
			localAssignments[index] = { ...modalAssignment }
			await saveAssignments()
		}
		closeAssignmentModal()
	}

	function getTotalCost() {
		return localAssignments.reduce((total, assignment) => {
			return total + ((assignment.num_hours || 0) * (assignment.hourly_rate || 0))
		}, 0)
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
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between border-b pb-2">
		<h3 class="text-lg font-semibold">
			Performers ({localAssignments.length})
			{#if localAssignments.length > 0}
				<span class="text-sm font-normal text-base-content/60 ml-2">
					Total: <span class="font-mono">${getTotalCost().toFixed(2)}</span>
				</span>
			{/if}
		</h3>
	</div>

	{#if error}
		<div class="alert alert-error">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span>{error}</span>
		</div>
	{:else}
		<div class="flex flex-col lg:flex-row gap-2 items-start">
			<!-- Left Panel: Available Artists -->
			<div class="flex flex-col border border-base-300 rounded-lg max-h-[400px] flex-1 min-w-[200px] w-full lg:w-auto">
				<div class="p-3 border-b border-base-300 flex-shrink-0">
					<h4 class="font-semibold mb-2 text-sm">Available Artists & Ensembles</h4>
					<input
						type="text"
						bind:value={artistSearch}
						placeholder="Search artists and ensembles..."
						class="input input-bordered input-sm w-full"
						disabled={updating || isLoading || readonly}
					/>
				</div>
				<div class="overflow-y-auto flex-1 min-h-0">
					{#if isLoading}
						<div class="flex justify-center items-center py-8">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if availableItems.length === 0}
						<div class="p-4 text-center text-sm text-base-content/60">
							{#if artistSearch}
								No artists or ensembles found matching "{artistSearch}"
							{:else}
								All artists and ensembles are assigned
							{/if}
						</div>
					{:else}
						{#each availableItems as item}
							{@const displayName = item.type === 'ensemble' ? item.name : getArtistDisplayName(item)}
							<button
								type="button"
								class="w-full text-left px-3 py-2.5 hover:bg-base-200 border-b border-base-300 last:border-b-0 transition-colors {selectedLeftArtistId === item.id ? 'bg-primary/20' : ''}"
								onclick={() => selectedLeftArtistId = selectedLeftArtistId === item.id ? null : item.id}
								disabled={updating}
								title={displayName}
							>
								<div class="flex items-center gap-2.5">
									{#if item.type === 'ensemble'}
										<div class="avatar placeholder flex-shrink-0">
											<div class="bg-primary text-primary-content rounded-full w-7 h-7">
												<Users class="w-3.5 h-3.5" />
											</div>
										</div>
									{:else if item.profile_photo}
										<div class="avatar flex-shrink-0">
											<div class="w-7 h-7 rounded-full">
												<img src={item.profile_photo} alt={displayName} />
											</div>
										</div>
									{:else}
										<div class="avatar placeholder flex-shrink-0">
											<div class="bg-neutral text-neutral-content rounded-full w-7 h-7">
												<span class="text-xs">
													{displayName.charAt(0).toUpperCase()}
												</span>
											</div>
										</div>
									{/if}
									<div class="flex-1 min-w-0 overflow-hidden">
										<div class="flex items-center gap-1.5 min-w-0">
											{#if item.type === 'ensemble'}
												<Users class="w-3 h-3 text-success flex-shrink-0" />
											{/if}
											<div class="font-medium text-sm break-words line-clamp-2" title={displayName}>
												{displayName}
											</div>
										</div>
										{#if item.type === 'ensemble'}
											<div class="text-xs text-base-content/60 line-clamp-1">
												{item.member_count || 0} {item.member_count === 1 ? 'member' : 'members'}
												{#if item.ensemble_type}
													• {item.ensemble_type}
												{/if}
											</div>
										{:else}
											{#if item.artist_name && item.artist_name !== displayName}
												<div class="text-xs text-base-content/60 line-clamp-1" title={item.artist_name}>
													{item.artist_name}
												</div>
											{/if}
											{#if item.email}
												<div class="text-xs text-base-content/60 line-clamp-1" title={item.email}>{item.email}</div>
											{/if}
										{/if}
									</div>
								</div>
							</button>
						{/each}
					{/if}
				</div>
			</div>

			<!-- Center Column 1: Action Buttons (Left to Center) -->
			<div class="flex flex-row lg:flex-col justify-center items-center gap-2 self-center w-auto lg:w-12">
				<button
					class="btn btn-primary btn-circle btn-sm"
					onclick={() => selectedLeftArtistId && assignArtist(selectedLeftArtistId)}
					disabled={!selectedLeftArtistId || updating}
					title="Assign selected artist or ensemble"
				>
					<ChevronRight class="w-4 h-4" />
				</button>
				<button
					class="btn btn-outline btn-circle btn-sm"
					onclick={() => selectedCenterArtistId && unassignArtist(selectedCenterArtistId)}
					disabled={!selectedCenterArtistId || updating}
					title="Unassign selected artist or ensemble"
				>
					<ChevronLeft class="w-4 h-4" />
				</button>
				{#if updating}
					<span class="loading loading-spinner loading-xs"></span>
				{/if}
			</div>

			<!-- Center Panel: Booking/Hold/Assigned Artists -->
			<div class="flex flex-col border border-base-300 rounded-lg max-h-[400px] flex-1 min-w-[200px] w-full lg:w-auto">
				<div class="p-3 border-b border-base-300 flex-shrink-0">
					<h4 class="font-semibold text-sm">Booking/Hold/Assigned ({pendingArtists.length})</h4>
				</div>
				<div class="overflow-y-auto flex-1 min-h-0">
					{#if isLoading}
						<div class="flex justify-center items-center py-8">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if pendingArtists.length === 0}
						<div class="p-4 text-center text-sm text-base-content/60">
							No artists in booking/hold/assigned
						</div>
					{:else}
						{#each pendingArtists as artist}
							{@const cost = (artist.num_hours || 0) * (artist.hourly_rate || 0)}
							{@const artistName = artist.full_name || artist.artist_name || artist.artist_name || 'Unknown Artist'}
							<button
								type="button"
								class="w-full text-left px-3 py-2.5 hover:bg-base-200 border-b border-base-300 last:border-b-0 transition-colors {selectedCenterArtistId === artist.artist_id ? 'bg-primary/20' : ''}"
								onclick={() => selectedCenterArtistId = selectedCenterArtistId === artist.artist_id ? null : artist.artist_id}
								disabled={updating}
								title={artistName}
							>
								<div class="flex items-center gap-2.5">
									{#if artist.profile_photo}
										<div class="avatar flex-shrink-0">
											<div class="w-7 h-7 rounded-full">
												<img src={artist.profile_photo} alt={artistName} />
											</div>
										</div>
									{:else}
										<div class="avatar placeholder flex-shrink-0">
											<div class="bg-neutral text-neutral-content rounded-full w-7 h-7">
												<span class="text-xs">
													{artistName.charAt(0).toUpperCase()}
												</span>
											</div>
										</div>
									{/if}
									<div class="flex-1 min-w-0 overflow-hidden">
										<div class="font-medium text-sm break-words line-clamp-2" title={artistName}>
											{artistName}
										</div>
										{#if artist.artist_name && artist.artist_name !== artist.full_name}
											<div class="text-xs text-base-content/60 line-clamp-1" title={artist.artist_name}>
												{artist.artist_name}
											</div>
										{/if}
										{#if artist.email}
											<div class="text-xs text-base-content/60 line-clamp-1" title={artist.email}>{artist.email}</div>
										{/if}
										<div class="flex items-center gap-2 mt-1 flex-wrap">
											{#if artist.role}
												<span class="badge badge-outline badge-xs">{artist.role}</span>
											{/if}
											{#if cost > 0}
												<span class="text-xs font-mono text-primary">${cost.toFixed(2)}</span>
											{/if}
										</div>
									</div>
									{#if !readonly}
										<button
											type="button"
											class="btn btn-ghost btn-xs flex-shrink-0"
											onclick={(e) => openAssignmentModal(artist, e)}
											title="Edit assignment details"
										>
											<Edit2 class="w-3 h-3" />
										</button>
									{/if}
								</div>
							</button>
						{/each}
					{/if}
				</div>
			</div>

			<!-- Center Column 2: Action Buttons (Center to Right) -->
			<div class="flex flex-row lg:flex-col justify-center items-center gap-2 self-center w-auto lg:w-12">
				<button
					class="btn btn-success btn-circle btn-sm"
					onclick={() => selectedCenterArtistId && confirmArtist(selectedCenterArtistId)}
					disabled={!selectedCenterArtistId || updating}
					title="Confirm selected artist or ensemble"
				>
					<ChevronRight class="w-4 h-4" />
				</button>
				<button
					class="btn btn-outline btn-circle btn-sm"
					onclick={() => selectedRightArtistId && unconfirmArtist(selectedRightArtistId)}
					disabled={!selectedRightArtistId || updating}
					title="Unconfirm selected artist or ensemble"
				>
					<ChevronLeft class="w-4 h-4" />
				</button>
			</div>

			<!-- Right Panel: Confirmed Artists -->
			<div class="flex flex-col border border-base-300 rounded-lg max-h-[400px] flex-1 min-w-[200px] w-full lg:w-auto">
				<div class="p-3 border-b border-base-300 flex-shrink-0">
					<h4 class="font-semibold text-sm">Confirmed ({confirmedArtists.length})</h4>
				</div>
				<div class="overflow-y-auto flex-1 min-h-0">
					{#if isLoading}
						<div class="flex justify-center items-center py-8">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else if confirmedArtists.length === 0}
						<div class="p-4 text-center text-sm text-base-content/60">
							No confirmed artists yet
						</div>
					{:else}
						{#each confirmedArtists as artist}
							{@const cost = (artist.num_hours || 0) * (artist.hourly_rate || 0)}
							{@const artistName = artist.full_name || artist.artist_name || artist.artist_name || 'Unknown Artist'}
							<button
								type="button"
								class="w-full text-left px-3 py-2.5 hover:bg-base-200 border-b border-base-300 last:border-b-0 transition-colors {selectedRightArtistId === artist.artist_id ? 'bg-primary/20' : ''}"
								onclick={() => selectedRightArtistId = selectedRightArtistId === artist.artist_id ? null : artist.artist_id}
								disabled={updating}
								title={artistName}
							>
								<div class="flex items-center gap-2.5">
									{#if artist.profile_photo}
										<div class="avatar flex-shrink-0">
											<div class="w-7 h-7 rounded-full">
												<img src={artist.profile_photo} alt={artistName} />
											</div>
										</div>
									{:else}
										<div class="avatar placeholder flex-shrink-0">
											<div class="bg-neutral text-neutral-content rounded-full w-7 h-7">
												<span class="text-xs">
													{artistName.charAt(0).toUpperCase()}
												</span>
											</div>
										</div>
									{/if}
									<div class="flex-1 min-w-0 overflow-hidden">
										<div class="font-medium text-sm break-words line-clamp-2" title={artistName}>
											{artistName}
										</div>
										{#if artist.artist_name && artist.artist_name !== artist.full_name}
											<div class="text-xs text-base-content/60 line-clamp-1" title={artist.artist_name}>
												{artist.artist_name}
											</div>
										{/if}
										{#if artist.email}
											<div class="text-xs text-base-content/60 line-clamp-1" title={artist.email}>{artist.email}</div>
										{/if}
										<div class="flex items-center gap-2 mt-1 flex-wrap">
											{#if artist.role}
												<span class="badge badge-outline badge-xs">{artist.role}</span>
											{/if}
											{#if cost > 0}
												<span class="text-xs font-mono text-primary">${cost.toFixed(2)}</span>
											{/if}
										</div>
									</div>
									{#if !readonly}
										<button
											type="button"
											class="btn btn-ghost btn-xs flex-shrink-0"
											onclick={(e) => openAssignmentModal(artist, e)}
											title="Edit assignment details"
										>
											<Edit2 class="w-3 h-3" />
										</button>
									{/if}
								</div>
							</button>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Assignment Details Modal -->
{#if showAssignmentModal && modalAssignment}
	<div class="modal modal-open">
		<div class="modal-box">
			<div class="flex items-center justify-between mb-4">
				<h3 class="font-bold text-lg">Assignment Details</h3>
				<button class="btn btn-sm btn-circle btn-ghost" onclick={closeAssignmentModal}>
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="space-y-4">
				<div>
					<label class="label">
						<span class="label-text font-medium">Artist</span>
					</label>
					<div class="input input-bordered bg-base-200">
						{modalAssignment.artist_name || 'Unknown Artist'}
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Role</span>
						</label>
						<select 
							class="select select-bordered"
							value={modalAssignment.role || ''}
							onchange={(e) => modalAssignment = { ...modalAssignment, role: (e.target as HTMLSelectElement)?.value || '' }}
						>
							<option value="">Select role...</option>
							{#each roleOptions as role}
								<option value={role}>{role}</option>
							{/each}
						</select>
					</div>
					
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Status</span>
						</label>
						<select 
							class="select select-bordered"
							value={modalAssignment.status || 'assigned'}
							onchange={(e) => modalAssignment = { ...modalAssignment, status: (e.target as HTMLSelectElement)?.value as any || 'assigned' }}
						>
							{#each statusOptions as status}
								<option value={status.value}>{status.label}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="grid grid-cols-3 gap-4">
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Hours</span>
						</label>
						<input 
							type="number" 
							class="input input-bordered"
							min="0" 
							step="0.5"
							placeholder="0"
							value={modalAssignment.num_hours || 0}
							onchange={(e) => modalAssignment = { ...modalAssignment, num_hours: parseFloat((e.target as HTMLInputElement)?.value || '0') || 0 }}
						/>
					</div>
					
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Rate ($)</span>
						</label>
						<input 
							type="number" 
							class="input input-bordered"
							min="0" 
							step="0.01"
							placeholder="0.00"
							value={modalAssignment.hourly_rate || 0}
							onchange={(e) => modalAssignment = { ...modalAssignment, hourly_rate: parseFloat((e.target as HTMLInputElement)?.value || '0') || 0 }}
						/>
					</div>
					
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Total Cost</span>
						</label>
						<div class="input input-bordered bg-base-200 flex items-center">
							<span class="font-mono">${((modalAssignment.num_hours || 0) * (modalAssignment.hourly_rate || 0)).toFixed(2)}</span>
						</div>
					</div>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Notes</span>
					</label>
					<textarea 
						class="textarea textarea-bordered"
						placeholder="Additional notes or details..."
						rows="3"
						value={modalAssignment.notes || ''}
						onchange={(e) => modalAssignment = { ...modalAssignment, notes: (e.target as HTMLTextAreaElement)?.value || '' }}
					></textarea>
				</div>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeAssignmentModal}>
					Cancel
				</button>
				<button class="btn btn-primary" onclick={saveAssignmentDetails}>
					Save Changes
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop" onclick={closeAssignmentModal}>
			<button>close</button>
		</form>
	</div>
{/if}
