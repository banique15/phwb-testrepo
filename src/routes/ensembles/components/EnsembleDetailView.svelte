<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { updateEnsemble } from '$lib/stores/ensembles'
	import type { Ensemble } from '$lib/schemas/ensemble'
	import { supabase } from '$lib/supabase'
	import AddEnsembleMember from './modals/AddEnsembleMember.svelte'

	interface Props {
		ensemble: Ensemble
	}

	let { ensemble }: Props = $props()

	const dispatch = createEventDispatcher<{
		update: { ensemble: Ensemble }
		delete: void
	}>()

	let isEditing = $state(false)
	let editData = $state<Partial<Ensemble>>({})
	let isLoading = $state(false)
	let error = $state<string | null>(null)
	let members = $state<any[]>([])
	let loadingMembers = $state(false)
	let showAddMemberModal = $state(false)
	let membersLoadRequestId = 0
	let lastLoadedEnsembleId: string | null = null
	let editingMemberId = $state<string | null>(null)
	let editingMemberRole = $state<string>('')
	let removingMemberId = $state<string | null>(null)

	// Reset edit data when ensemble changes
	$effect(() => {
		if (ensemble) {
			editData = { ...ensemble }
			isEditing = false
			error = null
			
			if (ensemble.id && ensemble.id !== lastLoadedEnsembleId) {
				lastLoadedEnsembleId = ensemble.id
				loadMembers()
			}
		}
	})

	async function loadMembers() {
		if (!ensemble.id) return

		const requestId = ++membersLoadRequestId
		loadingMembers = true

		try {
			const { data, error: membersError } = await supabase
				.from('phwb_ensemble_members')
				.select(`
					id,
					ensemble_id,
					artist_id,
					role,
					joined_at,
					left_at,
					is_active,
					artist:phwb_artists!inner(
						id,
						full_name,
						legal_first_name,
						artist_name,
						email
					)
				`)
				.eq('ensemble_id', ensemble.id)
				.eq('is_active', true)
				.order('joined_at', { ascending: false })

			if (membersError) throw membersError

			// Ignore stale responses from earlier requests.
			if (requestId === membersLoadRequestId) {
				members = data || []
			}
		} catch (err: any) {
			console.error('Failed to load members:', err)
			error = err.message || 'Failed to load members'
			if (requestId === membersLoadRequestId) {
				members = []
			}
		} finally {
			if (requestId === membersLoadRequestId) {
				loadingMembers = false
			}
		}
	}

	function startEdit() {
		editData = { ...ensemble }
		isEditing = true
		error = null
	}

	function cancelEdit() {
		isEditing = false
		editData = { ...ensemble }
		error = null
	}

	async function saveEdit() {
		if (!ensemble.id) return

		isLoading = true
		error = null

		try {
			const updatedEnsemble = await updateEnsemble(ensemble.id, editData)
			dispatch('update', { ensemble: updatedEnsemble })
			isEditing = false
		} catch (err: any) {
			error = err.message || 'Failed to update ensemble'
		} finally {
			isLoading = false
		}
	}

	function handleDelete() {
		dispatch('delete')
	}

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		return new Date(dateStr).toLocaleDateString()
	}

	function getArtistDisplayName(artist: any) {
		if (!artist) return 'Unknown Artist'
		return artist.full_name || artist.legal_first_name || artist.artist_name || 'Unnamed Artist'
	}

	function getLeaderDisplayName(): string {
		const leaderId = (isEditing ? editData.leader_id : ensemble.leader_id) || null
		if (!leaderId) return 'Not set'
		const leaderMember = members.find((member) => member.artist_id === leaderId)
		if (!leaderMember) return 'Not set'
		return getArtistDisplayName(leaderMember.artist)
	}

	function openAddMemberModal() {
		showAddMemberModal = true
	}

	function closeAddMemberModal() {
		showAddMemberModal = false
	}

	async function handleMemberAdded() {
		// Reload members list
		await loadMembers()
		closeAddMemberModal()
	}

	function startEditMember(member: any) {
		editingMemberId = member.id
		editingMemberRole = member.role || ''
	}

	function cancelEditMember() {
		editingMemberId = null
		editingMemberRole = ''
	}

	function handleRoleKeydown(e: KeyboardEvent, memberId: string) {
		if (e.key === 'Enter') {
			e.preventDefault()
			saveMemberRole(memberId)
		} else if (e.key === 'Escape') {
			e.preventDefault()
			cancelEditMember()
		}
	}

	async function saveMemberRole(memberId: string) {
		if (!memberId) return

		isLoading = true
		error = null

		try {
			const { error: updateError } = await supabase
				.from('phwb_ensemble_members')
				.update({
					role: editingMemberRole.trim() || null
				})
				.eq('id', memberId)

			if (updateError) throw updateError

			// Reload members to reflect changes
			await loadMembers()
			editingMemberId = null
			editingMemberRole = ''
		} catch (err: any) {
			console.error('Failed to update member role:', err)
			error = err.message || 'Failed to update member role'
		} finally {
			isLoading = false
		}
	}

	async function removeMember(memberId: string) {
		if (!memberId) return

		removingMemberId = memberId
		error = null

		try {
			const { error: updateError } = await supabase
				.from('phwb_ensemble_members')
				.update({
					is_active: false,
					left_at: new Date().toISOString()
				})
				.eq('id', memberId)

			if (updateError) throw updateError

			// Reload members to reflect changes
			await loadMembers()
		} catch (err: any) {
			console.error('Failed to remove member:', err)
			error = err.message || 'Failed to remove member'
		} finally {
			removingMemberId = null
		}
	}
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="flex-none px-6 py-4 border-b border-base-200 bg-base-50">
		<div class="flex items-start justify-between">
			<div class="flex-1">
				<h2 class="text-2xl font-bold mb-1">{ensemble.name}</h2>
				<div class="flex flex-wrap gap-2 mt-2">
					<span class="badge badge-primary badge-sm">{ensemble.ensemble_type}</span>
					<span class="badge badge-sm" class:badge-success={ensemble.status === 'active'} class:badge-ghost={ensemble.status !== 'active'}>
						{ensemble.status || 'active'}
					</span>
					<span class="badge badge-info badge-sm">{members.length} member{members.length !== 1 ? 's' : ''}</span>
				</div>
			</div>
			<div class="flex gap-2">
				{#if isEditing}
					<button
						class="btn btn-sm btn-ghost"
						onclick={cancelEdit}
						disabled={isLoading}
					>
						Cancel
					</button>
					<button
						class="btn btn-sm btn-primary"
						onclick={saveEdit}
						disabled={isLoading}
					>
						{#if isLoading}
							<span class="loading loading-spinner loading-xs"></span>
						{/if}
						Save
					</button>
				{:else}
					<button
						class="btn btn-sm btn-outline"
						onclick={startEdit}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
						</svg>
						Edit
					</button>
					<button
						class="btn btn-sm btn-error"
						onclick={handleDelete}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
						Delete
					</button>
				{/if}
			</div>
		</div>
		{#if error}
			<div class="alert alert-error mt-4">
				<span>{error}</span>
			</div>
		{/if}
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto px-6 py-4">
		<div class="space-y-6">
			<!-- Ensemble Info -->
			<div class="space-y-4">
				<h3 class="text-lg font-semibold">Ensemble Information</h3>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Name</span>
					</label>
					{#if isEditing}
						<input
							type="text"
							class="input input-sm input-bordered"
							bind:value={editData.name}
							required
						/>
					{:else}
						<p class="text-sm">{ensemble.name}</p>
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Ensemble Type</span>
					</label>
					{#if isEditing}
						<input
							type="text"
							class="input input-sm input-bordered"
							bind:value={editData.ensemble_type}
							required
						/>
					{:else}
						<p class="text-sm">{ensemble.ensemble_type}</p>
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Status</span>
					</label>
					{#if isEditing}
						<select
							class="select select-sm select-bordered"
							bind:value={editData.status}
						>
							<option value="active">Active</option>
							<option value="inactive">Inactive</option>
							<option value="archived">Archived</option>
						</select>
					{:else}
						<p class="text-sm capitalize">{ensemble.status || 'active'}</p>
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Bandleader</span>
					</label>
					{#if isEditing}
						<select
							class="select select-sm select-bordered"
							bind:value={editData.leader_id}
						>
							<option value="">No bandleader selected</option>
							{#each members as member}
								<option value={member.artist_id}>{getArtistDisplayName(member.artist)}</option>
							{/each}
						</select>
					{:else}
						<p class="text-sm">{getLeaderDisplayName()}</p>
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Website</span>
					</label>
					{#if isEditing}
						<input
							type="url"
							class="input input-sm input-bordered"
							bind:value={editData.website}
							placeholder="https://example.com"
						/>
					{:else}
						{#if ensemble.website}
							<a href={ensemble.website} target="_blank" rel="noopener noreferrer" class="text-sm link link-primary">
								{ensemble.website}
							</a>
						{:else}
							<p class="text-sm">-</p>
						{/if}
					{/if}
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text text-xs font-semibold">Description</span>
					</label>
					{#if isEditing}
						<textarea
							class="textarea textarea-bordered h-24 text-sm"
							bind:value={editData.description}
							placeholder="Brief description of the ensemble"
						></textarea>
					{:else}
						<p class="text-sm whitespace-pre-wrap">{ensemble.description || '-'}</p>
					{/if}
				</div>
			</div>

			<div class="divider"></div>

			<!-- Members List -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-semibold">Members</h3>
					<button
						class="btn btn-sm btn-outline"
						onclick={openAddMemberModal}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Add Member
					</button>
				</div>

				{#if loadingMembers}
					<div class="flex justify-center py-8">
						<span class="loading loading-spinner loading-md"></span>
					</div>
				{:else if members.length === 0}
					<div class="text-center py-8 bg-base-200 rounded-lg">
						<p class="text-sm text-base-content/60">No members yet</p>
					</div>
				{:else}
					<div class="space-y-2">
						{#each members as member}
							<div class="flex items-center justify-between p-3 bg-base-200 rounded-lg gap-3">
								<div class="flex-1 min-w-0">
									<p class="font-medium text-sm">{getArtistDisplayName(member.artist)}</p>
									{#if editingMemberId === member.id}
										<input
											type="text"
											bind:value={editingMemberRole}
											placeholder="Role (optional)"
											class="input input-xs input-bordered mt-1 w-full max-w-xs"
											disabled={isLoading}
											onkeydown={(e) => handleRoleKeydown(e, member.id)}
										/>
									{:else}
										{#if member.role}
											<p class="text-xs text-base-content/60">{member.role}</p>
										{:else}
											<p class="text-xs text-base-content/40 italic">No role specified</p>
										{/if}
									{#if ensemble.leader_id === member.artist_id}
										<p class="text-xs text-warning font-semibold">Bandleader</p>
									{/if}
									{/if}
									{#if member.artist?.email}
										<p class="text-xs text-base-content/60">{member.artist.email}</p>
									{/if}
									<p class="text-xs text-base-content/60 mt-1">
										Joined {formatDate(member.joined_at)}
									</p>
								</div>
								<div class="flex gap-2 flex-shrink-0">
									{#if editingMemberId === member.id}
										<button
											class="btn btn-xs btn-primary"
											onclick={() => saveMemberRole(member.id)}
											disabled={isLoading}
										>
											Save
										</button>
										<button
											class="btn btn-xs btn-ghost"
											onclick={cancelEditMember}
											disabled={isLoading}
										>
											Cancel
										</button>
									{:else}
										<button
											class="btn btn-xs btn-outline"
											onclick={() => startEditMember(member)}
											disabled={isLoading || removingMemberId === member.id}
											title="Edit role"
										>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
											</svg>
										</button>
										<button
											class="btn btn-xs btn-error btn-outline"
											onclick={() => removeMember(member.id)}
											disabled={isLoading || removingMemberId === member.id}
											title="Remove member"
										>
											{#if removingMemberId === member.id}
												<span class="loading loading-spinner loading-xs"></span>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
												</svg>
											{/if}
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Add Member Modal -->
<AddEnsembleMember
	open={showAddMemberModal}
	ensemble={ensemble}
	onClose={closeAddMemberModal}
	onSuccess={handleMemberAdded}
/>
