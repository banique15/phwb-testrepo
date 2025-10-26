<script lang="ts">
	import { artistsStore } from '$lib/stores/artists'
	import { onMount } from 'svelte'
	import type { Artist } from '$lib/schemas/artist'
	
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
		assignments?: ArtistAssignment[]
		onUpdate?: (assignments: ArtistAssignment[]) => void
		readonly?: boolean
	}
	
	let { assignments = [], onUpdate, readonly = false }: Props = $props()
	
	// Component state
	let artists = $state<Artist[]>([])
	let loading = $state(true)
	let searchTerm = $state('')
	let editingIndex = $state<number | null>(null)
	let selectedArtistForAssignment = $state<Artist | null>(null)
	let showAssignmentForm = $state(false)
	let selectedArtistIds = $state<Set<string>>(new Set())
	
	// Local copy of assignments for editing
	let localAssignments = $state<ArtistAssignment[]>([...assignments])
	
	// New assignment form
	let newAssignment = $state<ArtistAssignment>({
		artist_id: '',
		role: '',
		status: 'pending',
		num_hours: 0,
		hourly_rate: 0,
		notes: ''
	})
	
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
	
	onMount(async () => {
		try {
			await artistsStore.fetchAll()
			artistsStore.subscribe(state => {
				artists = state.items
				loading = false
			})
		} catch (error) {
			console.error('Failed to load artists:', error)
			loading = false
		}
	})
	
	// Watch for changes in assignments prop
	$effect(() => {
		localAssignments = [...assignments]
	})
	
	// Filtered artists for search
	let filteredArtists = $derived(() => {
		let availableArtists = artists.filter(artist => {
			// Exclude already assigned artists
			return !localAssignments.some(assignment => String(assignment.artist_id) === String(artist.id))
		})
		
		if (!searchTerm) return availableArtists.slice(0, 10) // Limit initial results
		
		return availableArtists.filter(artist => {
			const fullName = artist.full_name?.toLowerCase() || ''
			const artistName = artist.artist_name?.toLowerCase() || ''
			const email = artist.email?.toLowerCase() || ''
			const search = searchTerm.toLowerCase()
			
			return fullName.includes(search) || 
				   artistName.includes(search) || 
				   email.includes(search)
		}).slice(0, 10)
	})
	
	// Get artist name from ID
	function getArtistName(artistId: string): string {
		const artist = artists.find(a => a.id === artistId)
		if (!artist) return 'Unknown Artist'
		
		return artist.full_name || 
			   artist.artist_name || 
			   `${artist.legal_first_name || ''} ${artist.legal_last_name || ''}`.trim() ||
			   'Unknown Artist'
	}
	
	function toggleArtistSelection(artist: Artist) {
		if (selectedArtistIds.has(artist.id!)) {
			selectedArtistIds.delete(artist.id!)
		} else {
			selectedArtistIds.add(artist.id!)
		}
		// Trigger reactivity
		selectedArtistIds = new Set(selectedArtistIds)
	}
	
	function assignSelectedArtists() {
		selectedArtistIds.forEach(artistId => {
			const artist = artists.find(a => a.id === artistId)
			if (artist) {
				const assignment: ArtistAssignment = {
					artist_id: artistId,
					artist_name: artist.full_name || artist.artist_name || 'Unknown',
					role: '',
					status: 'pending',
					num_hours: 0,
					hourly_rate: 0,
					notes: ''
				}
				localAssignments.push(assignment)
			}
		})
		
		onUpdate?.(localAssignments)
		selectedArtistIds.clear()
		selectedArtistIds = new Set(selectedArtistIds)
	}
	
	function addAssignment() {
		if (!newAssignment.artist_id) return
		
		const assignment: ArtistAssignment = {
			...newAssignment,
			artist_name: getArtistName(newAssignment.artist_id)
		}
		
		localAssignments.push(assignment)
		onUpdate?.(localAssignments)
		
		// Reset form
		newAssignment = {
			artist_id: '',
			role: '',
			status: 'pending',
			num_hours: 0,
			hourly_rate: 0,
			notes: ''
		}
		selectedArtistForAssignment = null
		showAssignmentForm = false
	}
	
	function cancelAssignment() {
		selectedArtistForAssignment = null
		showAssignmentForm = false
		newAssignment = {
			artist_id: '',
			role: '',
			status: 'pending',
			num_hours: 0,
			hourly_rate: 0,
			notes: ''
		}
	}
	
	function removeAssignment(index: number) {
		localAssignments.splice(index, 1)
		onUpdate?.(localAssignments)
	}
	
	function startEdit(index: number) {
		editingIndex = index
	}
	
	function cancelEdit() {
		editingIndex = null
	}
	
	function saveEdit(index: number) {
		// Update artist name in case it changed
		localAssignments[index].artist_name = getArtistName(localAssignments[index].artist_id)
		onUpdate?.(localAssignments)
		editingIndex = null
	}
	
	function navigateToArtists() {
		window.open('/artists', '_blank')
	}
	
	function getTotalCost() {
		return localAssignments.reduce((total, assignment) => {
			return total + ((assignment.num_hours || 0) * (assignment.hourly_rate || 0))
		}, 0)
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h4 class="text-lg font-semibold">Artist Assignments</h4>
		{#if !readonly}
			<button 
				class="btn btn-outline btn-sm"
				onclick={navigateToArtists}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
				</svg>
				Go to Artists to Add New
			</button>
		{/if}
	</div>
	
	{#if !readonly}
		<!-- Search Artists -->
		<div class="form-control">
			<label class="label">
				<span class="label-text">Search Available Artists</span>
				<span class="label-text-alt text-base-content/60">{filteredArtists.length} available</span>
			</label>
			<input
				type="text"
				bind:value={searchTerm}
				placeholder="Search by name, email, instruments, genres..."
				class="input input-bordered"
			/>
		</div>
	
		<!-- Available Artists List -->
		{#if loading}
			<div class="text-center py-8">
				<span class="loading loading-spinner loading-lg"></span>
				<p class="mt-2">Loading artists...</p>
			</div>
		{:else if filteredArtists.length > 0}
			<div class="border border-base-300 rounded-lg">
				<div class="bg-base-200 px-4 py-2 font-semibold border-b border-base-300 flex items-center justify-between">
					<span>Available Artists ({filteredArtists.length})</span>
					{#if selectedArtistIds.size > 0}
						<button 
							class="btn btn-primary btn-sm"
							onclick={assignSelectedArtists}
						>
							Assign Selected ({selectedArtistIds.size})
						</button>
					{/if}
				</div>
				<div class="max-h-64 overflow-y-auto">
					{#each filteredArtists as artist}
						<label class="flex items-center p-3 hover:bg-base-100 border-b border-base-300 last:border-b-0 cursor-pointer">
							<input
								type="checkbox"
								class="checkbox checkbox-primary mr-3"
								checked={selectedArtistIds.has(artist.id!)}
								onchange={() => toggleArtistSelection(artist)}
							/>
							<div class="flex-1">
								<div class="font-medium">
									{artist.full_name || artist.artist_name || 'Unknown Name'}
								</div>
								<div class="text-sm text-base-content/60">
									{artist.email || `ID: ${artist.id}`}
								</div>
							</div>
						</label>
					{/each}
				</div>
			</div>
		{:else if searchTerm}
			<div class="text-center py-8 bg-base-200 rounded-lg">
				<span class="text-4xl">🔍</span>
				<p class="mt-2 text-lg">No artists found</p>
				<p class="text-sm opacity-60">Try adjusting your search terms</p>
			</div>
		{:else}
			<div class="text-center py-8 bg-base-200 rounded-lg">
				<span class="text-4xl">👥</span>
				<p class="mt-2 text-lg">No available artists</p>
				<p class="text-sm opacity-60">All artists are already assigned to this event</p>
			</div>
		{/if}
	{/if}
	
	<!-- Assignment Details Form -->
	{#if showAssignmentForm && selectedArtistForAssignment && !readonly}
		<div class="card bg-base-100 border">
			<div class="card-body p-4">
				<h5 class="card-title text-base flex items-center">
					<span class="mr-2">Assign:</span>
					<span class="font-normal">{selectedArtistForAssignment.full_name || selectedArtistForAssignment.artist_name}</span>
				</h5>
				
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					
					<!-- Role -->
					<div>
						<label class="label">
							<span class="label-text">Role</span>
						</label>
						<select bind:value={newAssignment.role} class="select select-bordered w-full">
							<option value="">Select role...</option>
							{#each roleOptions as role}
								<option value={role}>{role}</option>
							{/each}
						</select>
					</div>
					
					<!-- Status -->
					<div>
						<label class="label">
							<span class="label-text">Status</span>
						</label>
						<select bind:value={newAssignment.status} class="select select-bordered w-full">
							{#each statusOptions as status}
								<option value={status.value}>{status.label}</option>
							{/each}
						</select>
					</div>
					
					<!-- Hours -->
					<div>
						<label class="label">
							<span class="label-text">Hours</span>
						</label>
						<input
							type="number"
							bind:value={newAssignment.num_hours}
							min="0"
							step="0.5"
							class="input input-bordered w-full"
							placeholder="0"
						/>
					</div>
					
					<!-- Hourly Rate -->
					<div>
						<label class="label">
							<span class="label-text">Hourly Rate ($)</span>
						</label>
						<input
							type="number"
							bind:value={newAssignment.hourly_rate}
							min="0"
							step="0.01"
							class="input input-bordered w-full"
							placeholder="0.00"
						/>
					</div>
					
					<!-- Notes -->
					<div class="md:col-span-2">
						<label class="label">
							<span class="label-text">Notes</span>
						</label>
						<textarea
							bind:value={newAssignment.notes}
							class="textarea textarea-bordered w-full"
							rows="2"
							placeholder="Additional notes about this assignment..."
						></textarea>
					</div>
				</div>
				
				<!-- Form Actions -->
				<div class="flex justify-end gap-2 mt-4">
					<button 
						class="btn btn-outline btn-sm"
						onclick={cancelAssignment}
					>
						Cancel
					</button>
					<button 
						class="btn btn-primary btn-sm"
						onclick={addAssignment}
					>
						Assign Artist
					</button>
				</div>
			</div>
		</div>
	{/if}
	
	<!-- Assignments List -->
	{#if localAssignments.length > 0}
		<div class="overflow-x-auto">
			<table class="table table-zebra">
				<thead>
					<tr>
						<th>Artist</th>
						<th>Role</th>
						<th>Status</th>
						<th>Hours</th>
						<th>Rate</th>
						<th>Cost</th>
						{#if !readonly}
							<th>Actions</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each localAssignments as assignment, index}
						<tr>
							<td>
								<div>
									<div class="font-medium">
										{assignment.artist_name || getArtistName(assignment.artist_id)}
									</div>
									<div class="text-xs opacity-60">ID: {assignment.artist_id}</div>
								</div>
							</td>
							<td>
								{#if editingIndex === index}
									<select 
										bind:value={assignment.role} 
										class="select select-sm select-bordered"
									>
										<option value="">No role</option>
										{#each roleOptions as role}
											<option value={role}>{role}</option>
										{/each}
									</select>
								{:else}
									{assignment.role || 'No role specified'}
								{/if}
							</td>
							<td>
								{#if editingIndex === index}
									<select 
										bind:value={assignment.status} 
										class="select select-sm select-bordered"
									>
										{#each statusOptions as status}
											<option value={status.value}>{status.label}</option>
										{/each}
									</select>
								{:else}
									{@const statusOption = statusOptions.find(s => s.value === assignment.status)}
									<span class="badge badge-sm {statusOption?.class || 'badge-outline'}">
										{statusOption?.label || assignment.status || 'Unknown'}
									</span>
								{/if}
							</td>
							<td>
								{#if editingIndex === index}
									<input 
										type="number" 
										bind:value={assignment.num_hours}
										min="0" 
										step="0.5"
										class="input input-sm input-bordered w-20"
									/>
								{:else}
									{assignment.num_hours || 0}
								{/if}
							</td>
							<td>
								{#if editingIndex === index}
									<input 
										type="number" 
										bind:value={assignment.hourly_rate}
										min="0" 
										step="0.01"
										class="input input-sm input-bordered w-24"
									/>
								{:else}
									${assignment.hourly_rate || 0}
								{/if}
							</td>
							<td>
								<span class="font-mono">
									${((assignment.num_hours || 0) * (assignment.hourly_rate || 0)).toFixed(2)}
								</span>
							</td>
							{#if !readonly}
								<td>
									<div class="flex gap-1">
										{#if editingIndex === index}
											<button 
												class="btn btn-xs btn-success"
												onclick={() => saveEdit(index)}
											>
												Save
											</button>
											<button 
												class="btn btn-xs btn-outline"
												onclick={cancelEdit}
											>
												Cancel
											</button>
										{:else}
											<button 
												class="btn btn-xs btn-outline"
												onclick={() => startEdit(index)}
											>
												Edit
											</button>
											<button 
												class="btn btn-xs btn-error"
												onclick={() => removeAssignment(index)}
											>
												Remove
											</button>
										{/if}
									</div>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr class="font-bold">
						<td colspan="5" class="text-right">Total Cost:</td>
						<td class="font-mono">${getTotalCost().toFixed(2)}</td>
						{#if !readonly}
							<td></td>
						{/if}
					</tr>
				</tfoot>
			</table>
		</div>
	{:else}
		<div class="text-center py-8 bg-base-200 rounded-lg">
			<span class="text-4xl">👥</span>
			<p class="mt-2 text-lg">No artists assigned</p>
			<p class="text-sm opacity-60">
				{readonly ? 'No artist assignments for this event' : 'Use the search above to find and assign artists to this event'}
			</p>
		</div>
	{/if}
</div>