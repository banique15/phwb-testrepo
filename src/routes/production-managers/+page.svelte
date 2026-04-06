<script lang="ts">
	import { onMount } from 'svelte'
	import { User, Plus } from 'lucide-svelte'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import MasterDetail from '$lib/components/ui/MasterDetail.svelte'
	import CreateArtist from '../artists/components/modals/CreateArtist.svelte'
	import { updateArtist } from '$lib/stores/artists'
	import type { Artist } from '$lib/schemas/artist'
	import {
		productionManagersStore,
		createProductionManager,
		updateProductionManager,
		deleteProductionManager
	} from '$lib/stores/productionManagers'
	import type { ProductionManager } from '$lib/schemas/productionManager'

	let selectedManager = $state<ProductionManager | null>(null)
	let clientLoading = $state(false)
	let creating = $state(false)
	let createError = $state<string | null>(null)
	let editError = $state<string | null>(null)
	let showCreateModal = $state(false)
	let showCreateArtistModal = $state(false)
	let showEditModal = $state(false)
	let deleting = $state(false)
	let createType = $state<'artist' | 'non_artist'>('artist')
	let quickSourceType = $state<'artist' | 'non_artist'>('non_artist')

	let searchQuery = $state('')
	let managers = $state<ProductionManager[]>([])

	let nonArtistForm = $state({
		full_name: '',
		email: '',
		phone: '',
		location: '',
		notes: ''
	})

	let editForm = $state({
		full_name: '',
		email: '',
		phone: '',
		location: '',
		notes: '',
		source_type: 'non_artist' as 'artist' | 'non_artist'
	})

	let filteredManagers = $derived.by(() => {
		let result = [...managers]
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase()
			result = result.filter(pm => {
				if (pm.full_name?.toLowerCase().includes(query)) return true
				if (pm.legal_first_name?.toLowerCase().includes(query)) return true
				if (pm.legal_last_name?.toLowerCase().includes(query)) return true
				if (pm.email?.toLowerCase().includes(query)) return true
				if (pm.phone?.toLowerCase().includes(query)) return true
				if (pm.location?.toLowerCase().includes(query)) return true
				return false
			})
		}
		return result
	})

	async function loadManagers() {
		clientLoading = true
		try {
			const result = await productionManagersStore.fetchAll({ limit: 1000, sortBy: 'created_at', sortOrder: 'desc' })
			managers = result.data
			if (selectedManager?.id) {
				selectedManager = result.data.find(pm => pm.id === selectedManager?.id) || null
			}
		} catch (error) {
			console.error('Failed loading production managers:', error)
		} finally {
			clientLoading = false
		}
	}

	onMount(() => {
		void loadManagers()
	})

	$effect(() => {
		quickSourceType = selectedManager?.source_type || 'non_artist'
	})

	function resetCreateState() {
		createType = 'artist'
		createError = null
		creating = false
		nonArtistForm = {
			full_name: '',
			email: '',
			phone: '',
			location: '',
			notes: ''
		}
	}

	function resetEditState() {
		editError = null
		editForm = {
			full_name: '',
			email: '',
			phone: '',
			location: '',
			notes: '',
			source_type: 'non_artist'
		}
	}

	function handleSearch(event: CustomEvent<{ value: string }>) {
		searchQuery = event.detail.value
	}

	function handleSelect(event: CustomEvent<{ item: ProductionManager }>) {
		selectedManager = event.detail.item
	}

	async function handleCreateNonArtist(e: SubmitEvent) {
		e.preventDefault()
		if (!nonArtistForm.full_name.trim()) {
			createError = 'Full name is required'
			return
		}

		createError = null
		creating = true
		try {
			const parts = nonArtistForm.full_name.trim().split(/\s+/)
			const legalFirstName = parts[0] || nonArtistForm.full_name.trim()
			const legalLastName = parts.slice(1).join(' ') || undefined

			const created = await createProductionManager({
				full_name: nonArtistForm.full_name.trim(),
				legal_first_name: legalFirstName,
				legal_last_name: legalLastName,
				email: nonArtistForm.email || undefined,
				phone: nonArtistForm.phone || undefined,
				location: nonArtistForm.location || undefined,
				notes: nonArtistForm.notes || undefined,
				source_type: 'non_artist',
				artist_id: null
			})

			await loadManagers()
			selectedManager = created
			showCreateModal = false
			resetCreateState()
		} catch (error: any) {
			createError = error?.message || 'Failed to create production manager'
		} finally {
			creating = false
		}
	}

	async function handleArtistCreated(payload: { artist: Artist }) {
		const artist = payload.artist
		if (!artist?.id) return

		createError = null
		creating = true
		try {
			await updateArtist(artist.id, { is_production_manager: true })
			await loadManagers()
			const linked = managers.find(pm => pm.artist_id === artist.id)
			selectedManager = linked || null
			showCreateArtistModal = false
			showCreateModal = false
			resetCreateState()
		} catch (error: any) {
			createError = error?.message || 'Artist created, but failed to mark as production manager'
		} finally {
			creating = false
		}
	}

	function openEditModal() {
		if (!selectedManager) return
		resetEditState()
		editForm = {
			full_name: selectedManager.full_name || getPmTitle(selectedManager),
			email: selectedManager.email || '',
			phone: selectedManager.phone || '',
			location: selectedManager.location || '',
			notes: selectedManager.notes || '',
			source_type: selectedManager.source_type || 'non_artist'
		}
		showEditModal = true
	}

	async function handleSaveEdit(e: SubmitEvent) {
		e.preventDefault()
		if (!selectedManager?.id) return
		if (!editForm.full_name.trim()) {
			editError = 'Full name is required'
			return
		}

		creating = true
		editError = null
		try {
			const parts = editForm.full_name.trim().split(/\s+/)
			if (editForm.source_type === 'artist' && !selectedManager.artist_id) {
				editError = 'Non-artist PM cannot be switched to artist without linking an artist record first.'
				return
			}

			if (editForm.source_type === 'non_artist' && selectedManager.artist_id) {
				await updateArtist(selectedManager.artist_id, { is_production_manager: false })
			}

			await updateProductionManager(selectedManager.id, {
				full_name: editForm.full_name.trim(),
				legal_first_name: parts[0] || editForm.full_name.trim(),
				legal_last_name: parts.slice(1).join(' ') || undefined,
				email: editForm.email || undefined,
				phone: editForm.phone || undefined,
				location: editForm.location || undefined,
				notes: editForm.notes || undefined,
				source_type: editForm.source_type,
				artist_id: editForm.source_type === 'non_artist' ? null : selectedManager.artist_id
			})
			await loadManagers()
			showEditModal = false
			resetEditState()
		} catch (error: any) {
			editError = error?.message || 'Failed to update production manager'
		} finally {
			creating = false
		}
	}

	async function handleDeleteSelected() {
		if (!selectedManager?.id || deleting) return
		const isArtistBacked = !!selectedManager.artist_id
		const name = getPmTitle(selectedManager)
		const confirmed = window.confirm(
			isArtistBacked
				? `Remove production manager status from "${name}"?`
				: `Delete production manager "${name}"?`
		)
		if (!confirmed) return

		deleting = true
		try {
			if (isArtistBacked && selectedManager.artist_id) {
				await updateArtist(selectedManager.artist_id, { is_production_manager: false })
			} else {
				await deleteProductionManager(selectedManager.id)
			}
			selectedManager = null
			await loadManagers()
		} catch (error) {
			console.error('Failed to delete production manager:', error)
			alert('Failed to delete production manager.')
		} finally {
			deleting = false
		}
	}

	async function handleQuickTypeUpdate() {
		if (!selectedManager?.id) return
		if (quickSourceType === (selectedManager.source_type || 'non_artist')) return

		creating = true
		editError = null
		try {
			if (quickSourceType === 'artist' && !selectedManager.artist_id) {
				throw new Error('Non-artist PM cannot be switched to artist without linking an artist record first.')
			}

			if (quickSourceType === 'non_artist' && selectedManager.artist_id) {
				await updateArtist(selectedManager.artist_id, { is_production_manager: false })
			}

			await updateProductionManager(selectedManager.id, {
				source_type: quickSourceType,
				artist_id: quickSourceType === 'non_artist' ? null : selectedManager.artist_id
			})

			await loadManagers()
		} catch (error: any) {
			editError = error?.message || 'Failed to update production manager type'
			quickSourceType = selectedManager?.source_type || 'non_artist'
		} finally {
			creating = false
		}
	}

	function getPmTitle(item: ProductionManager): string {
		return (
			item.full_name ||
			(item.legal_first_name && item.legal_last_name
				? `${item.legal_first_name} ${item.legal_last_name}`
				: item.legal_first_name) ||
			'No name'
		)
	}

	function getPmSubtitle(item: ProductionManager): string {
		// Keep list minimal: name + PM type badge only.
		return ''
	}

	function getPmDetail(item: ProductionManager): string {
		return item.source_type === 'artist' ? 'Artist' : 'Non-artist'
	}
</script>

<ErrorBoundary>
	<div class="h-full flex flex-col overflow-hidden">
		<div class="flex-1 min-h-0">
			<MasterDetail
				items={filteredManagers as any}
				selectedItem={selectedManager as any}
				loading={clientLoading}
				searchPlaceholder="Search production managers..."
				searchValue={searchQuery}
				masterTitle="Production Managers"
				getItemTitle={getPmTitle as any}
				getItemSubtitle={getPmSubtitle as any}
				getItemDetail={getPmDetail as any}
				stackMetaOnSecondRow={true}
				detailEmptyIcon={User}
				detailEmptyTitle="Select a production manager"
				detailEmptyMessage="Choose a production manager from the list to view their profile"
				storageKey="phwb-selected-production-manager"
				on:search={handleSearch}
				on:select={handleSelect}
			>
				{#snippet masterActions()}
					<button class="btn btn-primary btn-sm" onclick={() => { showCreateModal = true; resetCreateState() }}>
						<Plus class="w-4 h-4" />
						Add PM
					</button>
				{/snippet}
				{#snippet children(props)}
					{@const pm = props.item as ProductionManager}
					{#if pm}
						<div class="space-y-4">
							<div class="card bg-base-100 shadow-none border border-base-300">
								<div class="card-body p-4 space-y-3">
									<div class="flex items-center justify-between gap-2">
										<h2 class="text-2xl font-bold">{getPmTitle(pm)}</h2>
										<span class="badge badge-outline">
											{pm.source_type === 'artist' ? 'Artist' : 'Non-artist'}
										</span>
									</div>
									<div class="flex items-end gap-2">
										<div class="form-control w-full max-w-xs">
											<label class="label py-1">
												<span class="label-text text-xs text-base-content/70">Production manager type</span>
											</label>
											<select class="select select-bordered select-sm" bind:value={quickSourceType} disabled={creating}>
												<option value="artist">Artist</option>
												<option value="non_artist">Non-artist</option>
											</select>
										</div>
										<button
											class="btn btn-outline btn-sm"
											onclick={handleQuickTypeUpdate}
											disabled={creating || quickSourceType === (pm.source_type || 'non_artist')}
										>
											Apply Type
										</button>
									</div>
									<div class="flex gap-2">
										<button class="btn btn-outline btn-sm" onclick={openEditModal}>
											Edit
										</button>
										<button class="btn btn-error btn-outline btn-sm" onclick={handleDeleteSelected} disabled={deleting}>
											{pm.artist_id ? 'Remove PM' : 'Delete'}
										</button>
									</div>
									<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<div class="text-xs text-base-content/50 uppercase tracking-wide">Email</div>
											<div class="text-sm">{pm.email || 'Not set'}</div>
										</div>
										<div>
											<div class="text-xs text-base-content/50 uppercase tracking-wide">Phone</div>
											<div class="text-sm">{pm.phone || 'Not set'}</div>
										</div>
										<div>
											<div class="text-xs text-base-content/50 uppercase tracking-wide">Location</div>
											<div class="text-sm">{pm.location || 'Not set'}</div>
										</div>
									</div>
									{#if pm.notes}
										<div>
											<div class="text-xs text-base-content/50 uppercase tracking-wide mb-1">Notes</div>
											<p class="text-sm whitespace-pre-wrap">{pm.notes}</p>
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/if}
				{/snippet}
			</MasterDetail>
		</div>
	</div>

	<div class="modal" class:modal-open={showCreateModal}>
		<div class="modal-box w-full max-w-xl">
			<h3 class="font-semibold text-lg">Add Production Manager</h3>
			<p class="text-sm opacity-70 mt-1">Choose whether this production manager is an artist.</p>

			{#if createError}
				<div class="alert alert-error mt-4">
					<span>{createError}</span>
				</div>
			{/if}

			<div class="form-control mt-4">
				<label class="label" for="pm-type">
					<span class="label-text">Production manager type</span>
				</label>
				<select id="pm-type" class="select select-bordered w-full" bind:value={createType} disabled={creating}>
					<option value="artist">Artist</option>
					<option value="non_artist">Non-artist</option>
				</select>
			</div>

			{#if createType === 'artist'}
				<div class="mt-4 p-3 rounded-lg bg-base-200 text-sm">
					This opens the artist creation flow and will automatically mark the new artist as a production manager.
				</div>
			{:else}
				<form class="mt-4 space-y-3" onsubmit={handleCreateNonArtist}>
					<div class="form-control">
						<label class="label" for="pm-full-name">
							<span class="label-text">Full Name <span class="text-error">*</span></span>
						</label>
						<input
							id="pm-full-name"
							type="text"
							class="input input-bordered w-full"
							bind:value={nonArtistForm.full_name}
							required
							disabled={creating}
						/>
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						<div class="form-control">
							<label class="label" for="pm-email"><span class="label-text">Email</span></label>
							<input id="pm-email" type="email" class="input input-bordered w-full" bind:value={nonArtistForm.email} disabled={creating} />
						</div>
						<div class="form-control">
							<label class="label" for="pm-phone"><span class="label-text">Phone</span></label>
							<input id="pm-phone" type="text" class="input input-bordered w-full" bind:value={nonArtistForm.phone} disabled={creating} />
						</div>
					</div>
					<div class="form-control">
						<label class="label" for="pm-location"><span class="label-text">Location</span></label>
						<input id="pm-location" type="text" class="input input-bordered w-full" bind:value={nonArtistForm.location} disabled={creating} />
					</div>
					<div class="form-control">
						<label class="label" for="pm-notes"><span class="label-text">Notes</span></label>
						<textarea id="pm-notes" class="textarea textarea-bordered w-full" rows="3" bind:value={nonArtistForm.notes} disabled={creating}></textarea>
					</div>

					<div class="modal-action mt-2">
						<button type="button" class="btn btn-ghost" onclick={() => { showCreateModal = false; resetCreateState() }} disabled={creating}>
							Cancel
						</button>
						<button type="submit" class="btn btn-primary" disabled={creating}>
							{#if creating}<span class="loading loading-spinner loading-sm"></span>{/if}
							Create PM
						</button>
					</div>
				</form>
			{/if}

			{#if createType === 'artist'}
				<div class="modal-action">
					<button type="button" class="btn btn-ghost" onclick={() => { showCreateModal = false; resetCreateState() }} disabled={creating}>
						Cancel
					</button>
					<button
						type="button"
						class="btn btn-primary"
						onclick={() => {
							showCreateArtistModal = true
						}}
					>
						Continue to Artist Form
					</button>
				</div>
			{/if}
		</div>
	</div>

	<CreateArtist
		open={showCreateArtistModal}
		onClose={() => { showCreateArtistModal = false }}
		onSuccess={handleArtistCreated}
	/>

	<div class="modal" class:modal-open={showEditModal}>
		<div class="modal-box w-full max-w-xl">
			<h3 class="font-semibold text-lg">Edit Production Manager</h3>
			{#if editError}
				<div class="alert alert-error mt-3">
					<span>{editError}</span>
				</div>
			{/if}
			<form class="mt-4 space-y-3" onsubmit={handleSaveEdit}>
				<div class="form-control">
					<label class="label" for="edit-pm-full-name">
						<span class="label-text">Full Name <span class="text-error">*</span></span>
					</label>
					<input id="edit-pm-full-name" type="text" class="input input-bordered w-full" bind:value={editForm.full_name} required disabled={creating} />
				</div>
				<div class="form-control">
					<label class="label" for="edit-pm-type">
						<span class="label-text">Production manager type</span>
					</label>
					<select id="edit-pm-type" class="select select-bordered w-full" bind:value={editForm.source_type} disabled={creating}>
						<option value="artist">Artist</option>
						<option value="non_artist">Non-artist</option>
					</select>
				</div>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div class="form-control">
						<label class="label" for="edit-pm-email"><span class="label-text">Email</span></label>
						<input id="edit-pm-email" type="email" class="input input-bordered w-full" bind:value={editForm.email} disabled={creating} />
					</div>
					<div class="form-control">
						<label class="label" for="edit-pm-phone"><span class="label-text">Phone</span></label>
						<input id="edit-pm-phone" type="text" class="input input-bordered w-full" bind:value={editForm.phone} disabled={creating} />
					</div>
				</div>
				<div class="form-control">
					<label class="label" for="edit-pm-location"><span class="label-text">Location</span></label>
					<input id="edit-pm-location" type="text" class="input input-bordered w-full" bind:value={editForm.location} disabled={creating} />
				</div>
				<div class="form-control">
					<label class="label" for="edit-pm-notes"><span class="label-text">Notes</span></label>
					<textarea id="edit-pm-notes" class="textarea textarea-bordered w-full" rows="3" bind:value={editForm.notes} disabled={creating}></textarea>
				</div>
				<div class="modal-action">
					<button type="button" class="btn btn-ghost" onclick={() => { showEditModal = false; resetEditState() }} disabled={creating}>
						Cancel
					</button>
					<button type="submit" class="btn btn-primary" disabled={creating}>
						{#if creating}<span class="loading loading-spinner loading-sm"></span>{/if}
						Save
					</button>
				</div>
			</form>
		</div>
	</div>
</ErrorBoundary>

