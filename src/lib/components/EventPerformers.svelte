<script lang="ts">
	import { onMount } from 'svelte'
	import { MapPin, ChevronRight, ChevronLeft, Users, DollarSign } from 'lucide-svelte'
	import { supabase } from '$lib/supabase'
	import { rateCardStore } from '$lib/stores/rate-cards'

	interface Props {
		eventId: number
		showDetails?: boolean
	}

	let { eventId, showDetails = true }: Props = $props()

	let allArtists = $state<any[]>([])
	let allEnsembles = $state<any[]>([])
	let isLoading = $state(true)
	let error = $state<string | null>(null)
	let artistSearch = $state('')
	let selectedLeftArtistId = $state<string | null>(null)
	let selectedCenterArtistId = $state<string | null>(null)
	let selectedRightArtistId = $state<string | null>(null)
	let updating = $state(false)
	let assignments = $state<any[]>([])
	let eventData = $state<any>(null)
	let activeRateCard = $state<any>(null)
	let rateRule = $state<any>(null)
	let eventDuration = $state<number | null>(null)

	// Clear all state when eventId changes
	function clearState() {
		assignments = []
		allArtists = []
		allEnsembles = []
		isLoading = true
		error = null
		artistSearch = ''
		selectedLeftArtistId = null
		selectedCenterArtistId = null
		selectedRightArtistId = null
		updating = false
		eventData = null
		activeRateCard = null
		rateRule = null
		eventDuration = null
	}

	// Watch for eventId changes and reload data
	$effect(() => {
		if (eventId) {
			clearState()
			loadAllData()
		}
	})

	async function loadAllData() {
		await Promise.all([loadEventData(), loadAssignments(), loadAllArtists(), loadAllEnsembles(), loadRateCard()])
	}

	// Load event data including program for rate calculation
	async function loadEventData() {
		try {
			const { data, error: eventError } = await supabase
				.from('phwb_events')
				.select(`
					id,
					title,
					date,
					start_time,
					end_time,
					status,
					program,
					programs:program(id, title, program_type)
				`)
				.eq('id', eventId)
				.single()

			if (eventError) throw eventError
			eventData = data

			// Calculate event duration from times
			if (data?.start_time && data?.end_time) {
				eventDuration = calculateHoursFromTimes(data.start_time, data.end_time)
			}

			// Load rate rule for this program type
			// Note: programs is a single object from the join, but TS may infer it as array
			const programData = data?.programs as unknown as { id: number; title: string; program_type: string | null } | null
			if (programData?.program_type && activeRateCard?.id) {
				await loadRateRuleForProgram(programData.program_type)
			}
		} catch (err: any) {
			console.error('Error loading event data:', err)
		}
	}

	// Load active rate card
	async function loadRateCard() {
		try {
			activeRateCard = await rateCardStore.getActiveRateCard()
			
			// If we already have event data, load the rate rule
			const programData = eventData?.programs as { id: number; title: string; program_type: string | null } | null
			if (programData?.program_type && activeRateCard?.id) {
				await loadRateRuleForProgram(programData.program_type)
			}
		} catch (err: any) {
			console.error('Error loading rate card:', err)
		}
	}

	// Load rate rule for a program type
	async function loadRateRuleForProgram(programType: string) {
		if (!activeRateCard?.id) return
		try {
			rateRule = await rateCardStore.getRuleForProgramType(activeRateCard.id, programType)
		} catch (err: any) {
			console.error('Error loading rate rule:', err)
		}
	}

	// Calculate hours from event start/end times
	function calculateHoursFromTimes(startTime: string, endTime: string): number | null {
		if (!startTime || !endTime) return null
		try {
			const [startHours, startMins] = startTime.split(':').map(Number)
			const [endHours, endMins] = endTime.split(':').map(Number)
			const startTotal = startHours * 60 + startMins
			const endTotal = endHours * 60 + endMins
			const durationMinutes = endTotal - startTotal
			if (durationMinutes <= 0) return null
			return durationMinutes / 60
		} catch {
			return null
		}
	}

	// Calculate pay for an artist based on rate rule
	function calculateArtistPay(hours: number, isLeader: boolean = false, musicianCount: number = 1): { rate: number; totalPay: number; notes: string } | null {
		if (!rateRule) return null

		let basePay = 0
		let rate = 0
		let notes = ''

		switch (rateRule.rate_type) {
			case 'tiered':
				if (hours <= 1) {
					basePay = hours * (rateRule.first_hour_rate || 0)
					rate = rateRule.first_hour_rate || 0
					notes = `${hours}hr × $${rateRule.first_hour_rate}`
				} else {
					const firstHourPay = rateRule.first_hour_rate || 0
					const subsequentHours = hours - 1
					const subsequentPay = subsequentHours * (rateRule.subsequent_hour_rate || 0)
					basePay = firstHourPay + subsequentPay
					rate = rateRule.first_hour_rate || 0
					notes = `1hr × $${rateRule.first_hour_rate} + ${subsequentHours}hr × $${rateRule.subsequent_hour_rate}`
				}
				break
			case 'hourly':
				basePay = hours * (rateRule.hourly_rate || 0)
				rate = rateRule.hourly_rate || 0
				notes = `${hours}hr × $${rateRule.hourly_rate}/hr`
				break
			case 'flat':
				basePay = rateRule.flat_rate || 0
				rate = rateRule.flat_rate || 0
				notes = `Flat rate: $${rateRule.flat_rate}`
				break
		}

		return {
			rate,
			totalPay: basePay,
			notes
		}
	}

	// Format currency
	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
	}

	onMount(async () => {
		if (eventId) {
			await loadAllData()
		}
	})

	async function loadAssignments() {
		isLoading = true
		error = null

		try {
			// Get event with artist assignments
			const { data: event, error: eventError } = await supabase
				.from('phwb_events')
				.select('artists')
				.eq('id', eventId)
				.single()

			if (eventError) throw eventError

			// Extract assignments
			let artistIds: string[] = []
			let assignmentData: any[] = []
			
			if (!event?.artists) {
				assignments = []
				isLoading = false
				return
			} else if (Array.isArray(event.artists)) {
				// Simple array format - convert to assignments
				artistIds = event.artists.filter(id => typeof id === 'string')
				assignmentData = artistIds.map((id: string) => ({
					artist_id: id,
					status: 'assigned'
				}))
			} else if (event.artists.assignments) {
				// Assignments format
				assignmentData = event.artists.assignments
				artistIds = assignmentData.map((a: any) => a.artist_id).filter((id: any) => typeof id === 'string')
			}

			if (artistIds.length === 0) {
				assignments = []
				isLoading = false
				return
			}

			// Fetch artist details
			const { data: artists, error: artistsError } = await supabase
				.from('phwb_artists')
				.select(`
					id,
					full_name,
					artist_name,
					email,
					phone,
					profile_photo,
					instruments,
					genres,
					location
				`)
				.in('id', artistIds)

			if (artistsError) throw artistsError

			// Merge artist details with assignments (preserving rate info)
			assignments = (artists || []).map(artist => {
				const assignment = assignmentData.find((a: any) => a.artist_id === artist.id)
				return {
					...artist,
					status: assignment?.status || 'assigned',
					role: assignment?.role,
					ensemble_id: assignment?.ensemble_id,
					ensemble_name: assignment?.ensemble_name,
					num_hours: assignment?.num_hours,
					hourly_rate: assignment?.hourly_rate,
					calculated_pay: assignment?.calculated_pay,
					rate_card_id: assignment?.rate_card_id,
					rate_rule_id: assignment?.rate_rule_id,
					rate_notes: assignment?.rate_notes
				}
			})
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
				.select('id, full_name, artist_name, legal_first_name, legal_last_name, email, profile_photo')
				.order('full_name')

			if (artistsError) throw artistsError
			allArtists = data || []
		} catch (err: any) {
			console.error('Error loading artists:', err)
			allArtists = []
		}
	}

	async function loadAllEnsembles() {
		try {
			const { data: ensembleData, error: ensemblesError } = await supabase
				.from('phwb_ensembles')
				.select('id, name, description, ensemble_type, status')
				.eq('status', 'active')
				.order('name')

			if (ensemblesError) throw ensemblesError

			// Get member counts for each ensemble
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
		}
	}

	// Check if an ensemble is fully assigned (all members are assigned)
	function isEnsembleFullyAssigned(ensembleId: string): boolean {
		// We'll check this dynamically by fetching members if needed
		// For now, we'll consider an ensemble available if not all members are assigned
		// This is a simplified check - in practice, we might want to cache member lists
		return false // Always show ensembles, let the assignment logic handle duplicates
	}

	// Get program type from event data (with proper type handling)
	let programType = $derived.by(() => {
		const prog = eventData?.programs as { program_type?: string | null } | null
		return prog?.program_type || null
	})

	// Create combined list of artists and ensembles
	let availableItems = $derived.by(() => {
		// Combine artists and ensembles with type indicators
		const artistItems = allArtists
			.filter(artist => !assignments.some(a => a.id === artist.id))
			.map(artist => ({ ...artist, type: 'artist' as const }))

		const ensembleItems = allEnsembles
			.filter(ensemble => !isEnsembleFullyAssigned(ensemble.id))
			.map(ensemble => ({ ...ensemble, type: 'ensemble' as const }))

		// Combine and sort by name
		const combined = [...artistItems, ...ensembleItems].sort((a, b) => {
			const nameA = a.type === 'artist' 
				? getArtistDisplayName(a).toLowerCase()
				: (a.name || '').toLowerCase()
			const nameB = b.type === 'artist'
				? getArtistDisplayName(b).toLowerCase()
				: (b.name || '').toLowerCase()
			return nameA.localeCompare(nameB)
		})

		// Apply search filter
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

	// Split assignments into pending (booking/hold/assigned) and confirmed
	let pendingArtists = $derived.by(() => {
		return assignments.filter(a => 
			!a.status || 
			a.status === 'booking' || 
			a.status === 'hold' || 
			a.status === 'assigned' ||
			a.status === 'pending'
		)
	})

	let confirmedArtists = $derived.by(() => {
		return assignments.filter(a => a.status === 'confirmed')
	})

	function getArtistDisplayName(artist: any): string {
		return artist.full_name || 
			   `${artist.legal_first_name || ''} ${artist.legal_last_name || ''}`.trim() ||
			   artist.artist_name ||
			   'Unknown Artist'
	}

	async function updateAssignments(updatedAssignments: any[]) {
		const { error: updateError } = await supabase
			.from('phwb_events')
			.update({ 
				artists: updatedAssignments.length > 0 ? { assignments: updatedAssignments } : null
			})
			.eq('id', eventId)

		if (updateError) throw updateError
		await loadAssignments()
	}

	async function assignArtist(artistId: string) {
		if (!artistId) return

		updating = true
		try {
			// Get current event
			const { data: event, error: eventError } = await supabase
				.from('phwb_events')
				.select('artists')
				.eq('id', eventId)
				.single()

			if (eventError) throw eventError

			// Check if this is an ensemble or artist
			const ensemble = allEnsembles.find(e => e.id === artistId)
			
			// Calculate rate info based on event duration and rate rule
			const hours = eventDuration || rateRule?.min_hours || 1
			
			if (ensemble) {
				// Handle ensemble assignment - fetch all members and add them
				const { data: members, error: membersError } = await supabase
					.from('phwb_ensemble_members')
					.select('artist_id, role, phwb_artists(id, full_name, artist_name, legal_first_name, legal_last_name)')
					.eq('ensemble_id', artistId)
					.eq('is_active', true)

				if (membersError) throw membersError

				if (!members || members.length === 0) {
					throw new Error('Ensemble has no active members')
				}

				// Get existing assignments
				let existingAssignments: any[] = []
				if (event.artists) {
					if (Array.isArray(event.artists)) {
						existingAssignments = event.artists.map((id: string) => ({
							artist_id: id,
							status: 'assigned'
						}))
					} else if (event.artists.assignments) {
						existingAssignments = [...event.artists.assignments]
					}
				}

				// Calculate musician count for bandleader fee
				const totalMusicians = existingAssignments.length + members.length

				// Create assignments for all ensemble members with rate info
				const existingArtistIds = new Set(existingAssignments.map(a => a.artist_id))
				const newAssignments = members
					.filter((member: any) => !existingArtistIds.has(member.artist_id))
					.map((member: any, index: number) => {
						const artist = member.phwb_artists
						const artistName = artist?.full_name || 
							`${artist?.legal_first_name || ''} ${artist?.legal_last_name || ''}`.trim() ||
							artist?.artist_name || 
							'Unknown Artist'
						const isLeader = member.role === 'leader' || member.role === 'bandleader' || index === 0
						const rateCalc = calculateArtistPay(hours, isLeader, totalMusicians)
						
						return {
							artist_id: member.artist_id,
							artist_name: artistName,
							role: member.role || 'Ensemble Member',
							status: 'assigned',
							ensemble_id: ensemble.id,
							ensemble_name: ensemble.name,
							num_hours: hours,
							hourly_rate: rateCalc?.rate || null,
							calculated_pay: rateCalc?.totalPay || null,
							rate_card_id: activeRateCard?.id || null,
							rate_rule_id: rateRule?.id || null,
							rate_notes: rateCalc?.notes || null
						}
					})

				await updateAssignments([...existingAssignments, ...newAssignments])
			} else {
				// Handle artist assignment
				const artist = allArtists.find(a => a.id === artistId)
				if (!artist) throw new Error('Artist not found')

				// Get existing assignments
				let existingAssignments: any[] = []
				if (event.artists) {
					if (Array.isArray(event.artists)) {
						existingAssignments = event.artists.map((id: string) => ({
							artist_id: id,
							status: 'assigned'
						}))
					} else if (event.artists.assignments) {
						existingAssignments = [...event.artists.assignments]
					}
				}

				// Calculate rate info - first assignment is leader by default
				const isLeader = existingAssignments.length === 0
				const musicianCount = existingAssignments.length + 1
				const rateCalc = calculateArtistPay(hours, isLeader, musicianCount)

				// Prepare new assignment with 'assigned' status and rate info
				const newAssignment = {
					artist_id: artistId,
					artist_name: getArtistDisplayName(artist),
					status: 'assigned',
					num_hours: hours,
					hourly_rate: rateCalc?.rate || null,
					calculated_pay: rateCalc?.totalPay || null,
					rate_card_id: activeRateCard?.id || null,
					rate_rule_id: rateRule?.id || null,
					rate_notes: rateCalc?.notes || null
				}

				// Add new assignment
				await updateAssignments([...existingAssignments, newAssignment])
			}

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

		updating = true
		try {
			// Get current event
			const { data: event, error: eventError } = await supabase
				.from('phwb_events')
				.select('artists')
				.eq('id', eventId)
				.single()

			if (eventError) throw eventError

			// Get existing assignments
			let existingAssignments: any[] = []
			if (event.artists?.assignments) {
				existingAssignments = event.artists.assignments.map((a: any) => 
					a.artist_id === artistId 
						? { ...a, status: 'confirmed' }
						: a
				)
			}

			await updateAssignments(existingAssignments)
			selectedCenterArtistId = null
		} catch (err: any) {
			console.error('Error confirming artist:', err)
			error = err.message || 'Failed to confirm artist'
		} finally {
			updating = false
		}
	}

	async function unconfirmArtist(artistId: string) {
		if (!artistId) return

		updating = true
		try {
			// Get current event
			const { data: event, error: eventError } = await supabase
				.from('phwb_events')
				.select('artists')
				.eq('id', eventId)
				.single()

			if (eventError) throw eventError

			// Get existing assignments
			let existingAssignments: any[] = []
			if (event.artists?.assignments) {
				existingAssignments = event.artists.assignments.map((a: any) => 
					a.artist_id === artistId 
						? { ...a, status: 'assigned' }
						: a
				)
			}

			await updateAssignments(existingAssignments)
			selectedRightArtistId = null
		} catch (err: any) {
			console.error('Error unconfirming artist:', err)
			error = err.message || 'Failed to unconfirm artist'
		} finally {
			updating = false
		}
	}

	async function unassignArtist(artistId: string) {
		if (!artistId) return

		updating = true
		try {
			// Get current event
			const { data: event, error: eventError } = await supabase
				.from('phwb_events')
				.select('artists')
				.eq('id', eventId)
				.single()

			if (eventError) throw eventError

			// Get existing assignments and remove the one
			let existingAssignments: any[] = []
			if (event.artists?.assignments) {
				existingAssignments = event.artists.assignments.filter((a: any) => a.artist_id !== artistId)
			}

			await updateAssignments(existingAssignments)
			selectedCenterArtistId = null
			selectedRightArtistId = null
		} catch (err: any) {
			console.error('Error unassigning artist:', err)
			error = err.message || 'Failed to unassign artist'
		} finally {
			updating = false
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
	<div class="flex items-center justify-between border-b pb-2">
		<h3 class="text-lg font-semibold">Performers ({assignments.length})</h3>
	</div>

	<!-- Rate Info Banner -->
	{#if activeRateCard && programType}
		<div class="alert alert-info py-2">
			<DollarSign class="w-4 h-4" />
			<div class="text-sm">
				<span class="font-medium">Auto-calculating rates:</span>
				{rateCardStore.getProgramTypeLabel(programType)}
				{#if rateRule}
					<span class="opacity-70">
						({rateCardStore.getRateTypeLabel(rateRule.rate_type)}
						{#if eventDuration}
							• {eventDuration}hr event
						{/if})
					</span>
				{/if}
				<span class="opacity-50 text-xs ml-2">Rate Card: {activeRateCard.name}</span>
			</div>
		</div>
	{:else if !activeRateCard}
		<div class="alert alert-warning py-2">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<span class="text-sm">No active rate card. Rates will not be auto-calculated.</span>
		</div>
	{:else if !programType}
		<div class="alert py-2">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span class="text-sm opacity-70">No program type set. Assign a program to enable rate calculation.</span>
		</div>
	{/if}

	{#if error}
		<div class="alert alert-error">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span>{error}</span>
		</div>
	{:else}
		<div class="flex gap-1 items-start">
			<!-- Left Panel: Available Artists -->
			<div class="flex flex-col border border-base-300 rounded-lg max-h-[400px] flex-1 min-w-0">
				<div class="p-3 border-b border-base-300 flex-shrink-0">
					<h4 class="font-semibold mb-2">Available Artists & Ensembles</h4>
					<input
						type="text"
						bind:value={artistSearch}
						placeholder="Search artists and ensembles..."
						class="input input-bordered input-sm w-full"
						disabled={updating || isLoading}
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
							<button
								type="button"
								class="w-full text-left px-4 py-3 hover:bg-base-200 border-b border-base-300 last:border-b-0 transition-colors {selectedLeftArtistId === item.id ? 'bg-primary/20' : ''}"
								onclick={() => selectedLeftArtistId = selectedLeftArtistId === item.id ? null : item.id}
								disabled={updating}
							>
								<div class="flex items-center gap-3">
									{#if item.type === 'ensemble'}
										<div class="avatar placeholder">
											<div class="bg-primary text-primary-content rounded-full w-8 h-8">
												<Users class="w-4 h-4" />
											</div>
										</div>
									{:else if item.profile_photo}
										<div class="avatar">
											<div class="w-8 h-8 rounded-full">
												<img src={item.profile_photo} alt={getArtistDisplayName(item)} />
											</div>
										</div>
									{:else}
										<div class="avatar placeholder">
											<div class="bg-neutral text-neutral-content rounded-full w-8 h-8">
												<span class="text-xs">
													{getArtistDisplayName(item).charAt(0).toUpperCase()}
												</span>
											</div>
										</div>
									{/if}
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 min-w-0">
											{#if item.type === 'ensemble'}
												<Users class="w-3.5 h-3.5 text-success flex-shrink-0" />
											{/if}
											<div class="font-medium text-sm truncate flex-1 min-w-0">
												{item.type === 'ensemble' ? item.name : getArtistDisplayName(item)}
											</div>
										</div>
										{#if item.type === 'ensemble'}
											<div class="text-xs text-base-content/60 truncate">
												{item.member_count || 0} {item.member_count === 1 ? 'member' : 'members'}
												{#if item.ensemble_type}
													• {item.ensemble_type}
												{/if}
											</div>
										{:else}
											{#if item.artist_name && item.artist_name !== getArtistDisplayName(item)}
												<div class="text-xs text-base-content/60 truncate">
													{item.artist_name}
												</div>
											{/if}
											{#if item.email}
												<div class="text-xs text-base-content/60 truncate">{item.email}</div>
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
			<div class="flex flex-col justify-center items-center gap-2 self-center w-12">
				<button
					class="btn btn-primary btn-circle btn-sm"
					onclick={() => selectedLeftArtistId && assignArtist(selectedLeftArtistId)}
					disabled={!selectedLeftArtistId || updating || isLoading}
					title="Assign selected artist or ensemble"
				>
					<ChevronRight class="w-4 h-4" />
				</button>
				<button
					class="btn btn-outline btn-circle btn-sm"
					onclick={() => selectedCenterArtistId && unassignArtist(selectedCenterArtistId)}
					disabled={!selectedCenterArtistId || updating || isLoading}
					title="Unassign selected artist or ensemble"
				>
					<ChevronLeft class="w-4 h-4" />
				</button>
				{#if updating}
					<span class="loading loading-spinner loading-xs"></span>
				{/if}
			</div>

			<!-- Center Panel: Booking/Hold/Assigned Artists -->
			<div class="flex flex-col border border-base-300 rounded-lg max-h-[400px] flex-1 min-w-0">
				<div class="p-3 border-b border-base-300 flex-shrink-0">
					<h4 class="font-semibold">Booking/Hold/Assigned ({pendingArtists.length})</h4>
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
							<button
								type="button"
								class="w-full text-left px-4 py-3 hover:bg-base-200 border-b border-base-300 last:border-b-0 transition-colors {selectedCenterArtistId === artist.id ? 'bg-primary/20' : ''}"
								onclick={() => selectedCenterArtistId = selectedCenterArtistId === artist.id ? null : artist.id}
								disabled={updating}
							>
								<div class="flex items-center gap-3">
									{#if artist.profile_photo}
										<div class="avatar">
											<div class="w-8 h-8 rounded-full">
												<img src={artist.profile_photo} alt={artist.full_name || artist.artist_name} />
											</div>
										</div>
									{:else}
										<div class="avatar placeholder">
											<div class="bg-neutral text-neutral-content rounded-full w-8 h-8">
												<span class="text-xs">
													{(artist.full_name || artist.artist_name || 'A').charAt(0).toUpperCase()}
												</span>
											</div>
										</div>
									{/if}
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm truncate">
											{artist.full_name || artist.artist_name || 'Unknown Artist'}
										</div>
										{#if artist.artist_name && artist.artist_name !== artist.full_name}
											<div class="text-xs text-base-content/60 truncate">
												{artist.artist_name}
											</div>
										{/if}
										{#if artist.email}
											<div class="text-xs text-base-content/60 truncate">{artist.email}</div>
										{/if}
										{#if artist.calculated_pay}
											<div class="flex items-center gap-1 mt-1">
												<DollarSign class="w-3 h-3 text-success" />
												<span class="text-xs text-success font-medium">
													{formatCurrency(artist.calculated_pay)}
												</span>
												{#if artist.num_hours}
													<span class="text-xs text-base-content/50">
														({artist.num_hours}hr)
													</span>
												{/if}
											</div>
										{/if}
										{#if showDetails && artist.instruments}
											<div class="text-xs text-base-content/50 mt-1 truncate">
												{formatInstruments(artist.instruments)}
											</div>
										{/if}
									</div>
								</div>
							</button>
						{/each}
					{/if}
				</div>
			</div>

			<!-- Center Column 2: Action Buttons (Center to Right) -->
			<div class="flex flex-col justify-center items-center gap-2 self-center w-12">
				<button
					class="btn btn-success btn-circle btn-sm"
					onclick={() => selectedCenterArtistId && confirmArtist(selectedCenterArtistId)}
					disabled={!selectedCenterArtistId || updating || isLoading}
					title="Confirm selected artist or ensemble"
				>
					<ChevronRight class="w-4 h-4" />
				</button>
				<button
					class="btn btn-outline btn-circle btn-sm"
					onclick={() => selectedRightArtistId && unconfirmArtist(selectedRightArtistId)}
					disabled={!selectedRightArtistId || updating || isLoading}
					title="Unconfirm selected artist or ensemble"
				>
					<ChevronLeft class="w-4 h-4" />
				</button>
			</div>

			<!-- Right Panel: Confirmed Artists -->
			<div class="flex flex-col border border-base-300 rounded-lg max-h-[400px] flex-1 min-w-0">
				<div class="p-3 border-b border-base-300 flex-shrink-0">
					<h4 class="font-semibold">Confirmed ({confirmedArtists.length})</h4>
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
							<button
								type="button"
								class="w-full text-left px-4 py-3 hover:bg-base-200 border-b border-base-300 last:border-b-0 transition-colors {selectedRightArtistId === artist.id ? 'bg-primary/20' : ''}"
								onclick={() => selectedRightArtistId = selectedRightArtistId === artist.id ? null : artist.id}
								disabled={updating}
							>
								<div class="flex items-center gap-3">
									{#if artist.profile_photo}
										<div class="avatar">
											<div class="w-8 h-8 rounded-full">
												<img src={artist.profile_photo} alt={artist.full_name || artist.artist_name} />
											</div>
										</div>
									{:else}
										<div class="avatar placeholder">
											<div class="bg-neutral text-neutral-content rounded-full w-8 h-8">
												<span class="text-xs">
													{(artist.full_name || artist.artist_name || 'A').charAt(0).toUpperCase()}
												</span>
											</div>
										</div>
									{/if}
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm truncate">
											{artist.full_name || artist.artist_name || 'Unknown Artist'}
										</div>
										{#if artist.artist_name && artist.artist_name !== artist.full_name}
											<div class="text-xs text-base-content/60 truncate">
												{artist.artist_name}
											</div>
										{/if}
										{#if artist.email}
											<div class="text-xs text-base-content/60 truncate">{artist.email}</div>
										{/if}
										{#if artist.calculated_pay}
											<div class="flex items-center gap-1 mt-1">
												<DollarSign class="w-3 h-3 text-success" />
												<span class="text-xs text-success font-medium">
													{formatCurrency(artist.calculated_pay)}
												</span>
												{#if artist.num_hours}
													<span class="text-xs text-base-content/50">
														({artist.num_hours}hr)
													</span>
												{/if}
											</div>
										{/if}
										{#if showDetails && artist.instruments}
											<div class="text-xs text-base-content/50 mt-1 truncate">
												{formatInstruments(artist.instruments)}
											</div>
										{/if}
									</div>
								</div>
							</button>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
