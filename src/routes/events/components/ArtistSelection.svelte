<script lang="ts">
	import { Search, Users, FileText, Music } from 'lucide-svelte'
	import { artistsStore } from '$lib/stores/artists'
	import { supabase } from '$lib/supabase'
	import { onMount } from 'svelte'
	import type { Artist } from '$lib/schemas/artist'
	import type { Ensemble } from '$lib/schemas/ensemble'

	interface ArtistAssignment {
		artist_id: string
		artist_name?: string
		role?: string
		status?: 'pending' | 'confirmed' | 'declined'
		num_hours?: number
		hourly_rate?: number
		notes?: string
	}

	interface Props {
		selectedArtists?: string[] // Array of artist IDs
		assignments?: ArtistAssignment[] // Full assignments with details
		onUpdate?: (artistIds: string[]) => void
		onAssignmentsUpdate?: (assignments: ArtistAssignment[]) => void
		readonly?: boolean
	}

	let { selectedArtists = [], assignments = [], onUpdate, onAssignmentsUpdate, readonly = false }: Props = $props()

	// Component state
	let artists = $state<Artist[]>([])
	let loading = $state(true)
	let searchTerm = $state('')
	let selectedIds = $state<Set<string>>(new Set(selectedArtists))
	let localAssignments = $state<ArtistAssignment[]>([...assignments])
	let editingAssignment = $state<string | null>(null) // artist_id being edited
	let expandedAssignment = $state<string | null>(null) // artist_id of expanded assignment card

	// Ensemble state
	let ensembles = $state<(Ensemble & { member_count?: number })[]>([])
	let ensemblesLoading = $state(true)
	let showEnsembleSelector = $state(false)
	let assigningEnsemble = $state<string | null>(null) // ensemble_id being assigned

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
		{ value: 'confirmed', label: 'Confirmed', class: 'badge-success' },
		{ value: 'declined', label: 'Declined', class: 'badge-error' }
	]

	// Load artists and ensembles on mount
	onMount(async () => {
		try {
			console.log('ArtistSelection: Starting to load artists...')

			// Use direct Supabase query as a fallback since that's what works in ArtistAssignment
			const { data: directData, error: directError } = await supabase
				.from('phwb_artists')
				.select('*')
				.order('full_name')

			if (directError) {
				console.error('ArtistSelection: Direct Supabase query failed:', directError)
			} else {
				console.log('ArtistSelection: Direct query successful:', directData?.length)
				artists = directData || []
				console.log('ArtistSelection: Artists state after assignment:', artists.length)
			}

			// Load ensembles with member counts
			const { data: ensembleData, error: ensembleError } = await supabase
				.from('phwb_ensembles')
				.select('*, phwb_ensemble_members(count)')
				.eq('status', 'active')
				.order('name')

			if (ensembleError) {
				console.error('ArtistSelection: Failed to load ensembles:', ensembleError)
			} else {
				ensembles = (ensembleData || []).map(e => ({
					...e,
					member_count: e.phwb_ensemble_members?.[0]?.count || 0
				}))
			}
		} catch (error) {
			console.error('ArtistSelection: Failed to load artists:', error)
		} finally {
			loading = false
			ensemblesLoading = false
		}
	})

	// Track the last synced assignments to avoid infinite loops
	let lastSyncedAssignmentsJson = ''

	// Sync assignments when props change (but only when necessary)
	// Using $effect.pre to run before render and avoid reading reactive state we're writing to
	$effect.pre(() => {
		// Create a stable string representation to compare
		const assignmentsJson = JSON.stringify(assignments.map(a => a.artist_id).sort())

		// Only update if the assignments prop actually changed
		if (assignmentsJson !== lastSyncedAssignmentsJson) {
			lastSyncedAssignmentsJson = assignmentsJson

			// Ensure assignments have artist names by looking up missing ones
			const updatedAssignments = assignments.map(assignment => {
				// If artist_name is missing or empty, look it up from the artists list
				if (!assignment.artist_name || assignment.artist_name === 'Unknown') {
					const artist = artists.find(a => a.id === assignment.artist_id)
					return {
						...assignment,
						artist_name: artist?.full_name || artist?.artist_name || 'Unknown Artist'
					}
				}
				return { ...assignment }
			})

			localAssignments = updatedAssignments

			// Build selectedIds directly from assignments (don't read the current selectedIds)
			selectedIds = new Set(assignments.map(a => a.artist_id))
		}
	})

	// Filter artists based on search term
	let displayedArtists = $derived.by(() => {
		console.log('ArtistSelection: Derived displayedArtists called, artists.length:', artists.length)
		if (!searchTerm.trim()) {
			return artists
		}
		
		const searchLower = searchTerm.toLowerCase()
		const filtered = artists.filter(artist => 
			artist.full_name?.toLowerCase().includes(searchLower) ||
			artist.artist_name?.toLowerCase().includes(searchLower) ||
			artist.email?.toLowerCase().includes(searchLower)
		)
		console.log('ArtistSelection: Filtered artists:', filtered.length)
		return filtered
	})

	// Toggle artist selection
	function toggleArtist(artistId: string) {
		const artist = artists.find(a => a.id === artistId)
		if (!artist) return

		if (selectedIds.has(artistId)) {
			// Remove artist
			selectedIds.delete(artistId)
			localAssignments = localAssignments.filter(a => a.artist_id !== artistId)
		} else {
			// Add artist with default assignment
			selectedIds.add(artistId)
			const newAssignment: ArtistAssignment = {
				artist_id: artistId,
				artist_name: artist.full_name || artist.artist_name || 'Unknown',
				role: '',
				status: 'pending',
				num_hours: 0,
				hourly_rate: 0,
				notes: ''
			}
			localAssignments.push(newAssignment)
		}
		
		selectedIds = new Set(selectedIds) // Trigger reactivity
		onUpdate?.(Array.from(selectedIds))
		onAssignmentsUpdate?.(localAssignments)
	}

	// Clear all selections
	function clearAll() {
		selectedIds.clear()
		selectedIds = new Set()
		localAssignments = []
		onUpdate?.([])
		onAssignmentsUpdate?.([])
	}

	// Select all visible artists
	function selectAllVisible() {
		displayedArtists.forEach(artist => {
			if (!selectedIds.has(artist.id!)) {
				selectedIds.add(artist.id!)
				const newAssignment: ArtistAssignment = {
					artist_id: artist.id!,
					artist_name: artist.full_name || artist.artist_name || 'Unknown',
					role: '',
					status: 'pending',
					num_hours: 0,
					hourly_rate: 0,
					notes: ''
				}
				localAssignments.push(newAssignment)
			}
		})
		selectedIds = new Set(selectedIds)
		onUpdate?.(Array.from(selectedIds))
		onAssignmentsUpdate?.(localAssignments)
	}

	// Assign all members of an ensemble
	async function assignEnsemble(ensembleId: string) {
		assigningEnsemble = ensembleId
		try {
			// Fetch active ensemble members with artist data
			const { data: members, error } = await supabase
				.from('phwb_ensemble_members')
				.select('artist_id, role, phwb_artists(id, full_name, artist_name)')
				.eq('ensemble_id', ensembleId)
				.eq('is_active', true)

			if (error) {
				console.error('Failed to fetch ensemble members:', error)
				return
			}

			if (members && members.length > 0) {
				let addedCount = 0
				members.forEach((member: any) => {
					if (!selectedIds.has(member.artist_id)) {
						selectedIds.add(member.artist_id)
						const artist = member.phwb_artists
						const newAssignment: ArtistAssignment = {
							artist_id: member.artist_id,
							artist_name: artist?.full_name || artist?.artist_name || 'Unknown',
							role: member.role || 'Ensemble Member',
							status: 'pending',
							num_hours: 0,
							hourly_rate: 0,
							notes: ''
						}
						localAssignments.push(newAssignment)
						addedCount++
					}
				})

				if (addedCount > 0) {
					selectedIds = new Set(selectedIds)
					onUpdate?.(Array.from(selectedIds))
					onAssignmentsUpdate?.(localAssignments)
				}
			}
		} finally {
			assigningEnsemble = null
		}
	}

	// Update assignment details
	function updateAssignment(artistId: string, field: keyof ArtistAssignment, value: any) {
		const assignmentIndex = localAssignments.findIndex(a => a.artist_id === artistId)
		if (assignmentIndex !== -1) {
			localAssignments[assignmentIndex] = { 
				...localAssignments[assignmentIndex], 
				[field]: value 
			}
			onAssignmentsUpdate?.(localAssignments)
		}
	}

	// Toggle assignment card expansion (accordion behavior)
	function toggleAssignmentExpansion(artistId: string) {
		expandedAssignment = expandedAssignment === artistId ? null : artistId
	}

	// Auto-expand first assignment when assignments change
	$effect(() => {
		// Only auto-expand if no assignment is currently expanded
		if (localAssignments.length > 0 && !expandedAssignment) {
			expandedAssignment = localAssignments[0].artist_id
		} else if (localAssignments.length === 0) {
			expandedAssignment = null
		}
	})

	// Calculate total cost
	function getTotalCost() {
		return localAssignments.reduce((total, assignment) => {
			return total + ((assignment.num_hours || 0) * (assignment.hourly_rate || 0))
		}, 0)
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h4 class="text-lg font-semibold">Artist Assignment</h4>
		{#if selectedIds.size > 0}
			<div class="flex gap-2">
				<span class="badge badge-primary">{selectedIds.size} selected</span>
				<button class="btn btn-outline btn-sm" onclick={clearAll}>
					Clear All
				</button>
			</div>
		{/if}
	</div>

	<!-- Search -->
	<div class="form-control">
		<input
			type="text"
			bind:value={searchTerm}
			placeholder="Search artists by name or email..."
			class="input input-bordered"
		/>
	</div>

	<!-- Ensemble Selector -->
	{#if !readonly && ensembles.length > 0}
		<div class="space-y-2">
			<button
				class="btn btn-outline btn-sm gap-2"
				onclick={() => showEnsembleSelector = !showEnsembleSelector}
			>
				<Music class="w-4 h-4" />
				{showEnsembleSelector ? 'Hide Ensembles' : 'Assign Ensemble'}
				<svg
					class="w-4 h-4 transition-transform {showEnsembleSelector ? 'rotate-180' : ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>

			{#if showEnsembleSelector}
				<div class="border border-base-300 rounded-lg bg-base-100 p-4">
					<p class="text-sm text-base-content/70 mb-3">
						Select an ensemble to add all its members:
					</p>
					<div class="space-y-2 max-h-48 overflow-y-auto">
						{#each ensembles as ensemble}
							<div class="flex items-center justify-between p-2 hover:bg-base-200 rounded-lg">
								<div class="flex items-center gap-2">
									<Music class="w-4 h-4 text-primary" />
									<div>
										<span class="font-medium">{ensemble.name}</span>
										{#if ensemble.ensemble_type}
											<span class="text-xs text-base-content/60 ml-2">({ensemble.ensemble_type})</span>
										{/if}
									</div>
								</div>
								<div class="flex items-center gap-2">
									<span class="badge badge-ghost badge-sm">
										{ensemble.member_count || 0} members
									</span>
									<button
										class="btn btn-primary btn-xs"
										onclick={() => assignEnsemble(ensemble.id!)}
										disabled={assigningEnsemble === ensemble.id || (ensemble.member_count || 0) === 0}
									>
										{#if assigningEnsemble === ensemble.id}
											<span class="loading loading-spinner loading-xs"></span>
										{:else}
											Add All
										{/if}
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Main content area with side-by-side layout -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Left Column: Artist Selection -->
		<div class="space-y-4">
			<h5 class="font-medium text-lg">Select Artists</h5>
			
			{#if loading}
				<div class="text-center py-8">
					<span class="loading loading-spinner loading-lg"></span>
					<p class="mt-2">Loading artists...</p>
				</div>
			{:else if displayedArtists.length > 0}
				<div class="border border-base-300 rounded-lg">
					<!-- Header with bulk actions -->
					<div class="bg-base-200 px-4 py-2 border-b border-base-300 flex items-center justify-between">
						<span class="font-medium">
							{displayedArtists.length} artists
						</span>
						{#if displayedArtists.length > 1}
							<button 
								class="btn btn-outline btn-xs"
								onclick={selectAllVisible}
							>
								Select All
							</button>
						{/if}
					</div>

					<!-- Artist list -->
					<div class="max-h-96 overflow-y-auto">
						{#each displayedArtists as artist}
							<label class="flex items-center p-3 hover:bg-base-100 border-b border-base-300 last:border-b-0 cursor-pointer">
								<input
									type="checkbox"
									class="checkbox checkbox-primary mr-3"
									checked={selectedIds.has(artist.id!)}
									onchange={() => toggleArtist(artist.id!)}
									disabled={readonly}
								/>
								<div class="flex-1">
									<div class="font-medium">
										{artist.full_name || artist.artist_name || 'Unknown Name'}
									</div>
									{#if artist.email}
										<div class="text-sm text-base-content/60">
											{artist.email}
										</div>
									{/if}
								</div>
							</label>
						{/each}
					</div>
				</div>
			{:else if searchTerm}
				<div class="text-center py-8 bg-base-200 rounded-lg">
					<Search class="w-16 h-16 mx-auto text-base-content/70" />
					<p class="mt-2 text-lg">No artists found</p>
					<p class="text-sm opacity-60">Try adjusting your search terms</p>
				</div>
			{:else}
				<div class="text-center py-8 bg-base-200 rounded-lg">
					<Users class="w-16 h-16 mx-auto text-base-content/70" />
					<p class="mt-2 text-lg">No artists available</p>
					<p class="text-sm opacity-60">No artists found in the database</p>
				</div>
			{/if}

			<!-- Selected Artists Summary -->
			{#if selectedIds.size > 0}
				<div class="border border-primary/20 bg-primary/5 rounded-lg p-4">
					<h5 class="font-medium text-primary mb-2">
						Selected Artists ({selectedIds.size})
					</h5>
					<div class="flex flex-wrap gap-2">
						{#each Array.from(selectedIds) as artistId}
							{@const artist = artists.find(a => a.id === artistId)}
							{#if artist}
								<span class="badge badge-primary gap-2">
									{artist.full_name || artist.artist_name || 'Unknown'}
									<button 
										class="text-xs opacity-70 hover:opacity-100"
										onclick={() => toggleArtist(artistId)}
										disabled={readonly}
									>
										✕
									</button>
								</span>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Right Column: Assignment Details -->
		<div class="space-y-4">
			{#if localAssignments.length > 0 && !readonly}
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<h5 class="font-medium text-lg">Assignment Details</h5>
						<div class="text-sm text-base-content/60">
							Total Cost: <span class="font-mono font-bold">${getTotalCost().toFixed(2)}</span>
						</div>
					</div>
					
					<!-- Assignment Cards -->
					<div class="space-y-3">
						{#each localAssignments as assignment}
							{@const artist = artists.find(a => a.id === assignment.artist_id)}
							{@const isExpanded = expandedAssignment === assignment.artist_id}
							{@const cost = (assignment.num_hours || 0) * (assignment.hourly_rate || 0)}
							{@const statusOption = statusOptions.find(s => s.value === assignment.status)}
							
							<div class="border border-base-300 rounded-lg bg-base-100">
								<!-- Card Header (always visible) -->
								<button 
									class="w-full p-3 text-left hover:bg-base-200 rounded-t-lg flex items-center justify-between"
									onclick={() => toggleAssignmentExpansion(assignment.artist_id)}
								>
									<div class="flex items-center gap-3">
										<div class="font-medium">
											{assignment.artist_name || artist?.full_name || 'Unknown'}
										</div>
										{#if assignment.role}
											<span class="badge badge-outline badge-sm">{assignment.role}</span>
										{/if}
										{#if statusOption}
											<span class="badge badge-sm {statusOption.class}">
												{statusOption.label}
											</span>
										{/if}
									</div>
									<div class="flex items-center gap-2">
										{#if cost > 0}
											<span class="font-mono text-sm">${cost.toFixed(2)}</span>
										{/if}
										<svg 
											class="w-4 h-4 transition-transform {isExpanded ? 'rotate-180' : ''}" 
											fill="none" 
											stroke="currentColor" 
											viewBox="0 0 24 24"
										>
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										</svg>
									</div>
								</button>
								
								<!-- Card Body (collapsible) -->
								{#if isExpanded}
									<div class="p-4 border-t border-base-300 space-y-4">
										<!-- Role and Status Row -->
										<div class="grid grid-cols-2 gap-4">
											<div class="form-control">
												<label class="label">
													<span class="label-text font-medium">Role</span>
												</label>
												<select 
													class="select select-bordered"
													value={assignment.role || ''}
													onchange={(e) => updateAssignment(assignment.artist_id, 'role', (e.target as HTMLSelectElement)?.value || '')}
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
													value={assignment.status || 'pending'}
													onchange={(e) => updateAssignment(assignment.artist_id, 'status', (e.target as HTMLSelectElement)?.value || 'pending')}
												>
													{#each statusOptions as status}
														<option value={status.value}>{status.label}</option>
													{/each}
												</select>
											</div>
										</div>
										
										<!-- Hours and Rate Row -->
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
													value={assignment.num_hours || 0}
													onchange={(e) => updateAssignment(assignment.artist_id, 'num_hours', parseFloat((e.target as HTMLInputElement)?.value || '0') || 0)}
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
													value={assignment.hourly_rate || 0}
													onchange={(e) => updateAssignment(assignment.artist_id, 'hourly_rate', parseFloat((e.target as HTMLInputElement)?.value || '0') || 0)}
												/>
											</div>
											
											<div class="form-control">
												<label class="label">
													<span class="label-text font-medium">Total Cost</span>
												</label>
												<div class="input input-bordered bg-base-200 flex items-center">
													<span class="font-mono">${cost.toFixed(2)}</span>
												</div>
											</div>
										</div>
										
										<!-- Notes -->
										<div class="form-control">
											<label class="label">
												<span class="label-text font-medium">Notes</span>
											</label>
											<textarea 
												class="textarea textarea-bordered"
												placeholder="Additional notes or details..."
												rows="2"
												value={assignment.notes || ''}
												onchange={(e) => updateAssignment(assignment.artist_id, 'notes', (e.target as HTMLTextAreaElement)?.value || '')}
											></textarea>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{:else if selectedIds.size > 0 && !readonly}
				<div class="text-center py-8 bg-base-200 rounded-lg">
					<FileText class="w-16 h-16 mx-auto text-base-content/70" />
					<p class="mt-2 text-lg">Assignment Details</p>
					<p class="text-sm opacity-60">Select artists to configure their assignments</p>
				</div>
			{:else}
				<div class="text-center py-8 bg-base-200 rounded-lg">
					<FileText class="w-16 h-16 mx-auto text-base-content/70" />
					<p class="mt-2 text-lg">Assignment Details</p>
					<p class="text-sm opacity-60">
						{readonly ? 'Assignment details will appear here' : 'Select artists to configure their assignments'}
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>