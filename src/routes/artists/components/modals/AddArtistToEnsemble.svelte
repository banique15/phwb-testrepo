<script lang="ts">
	import { supabase } from '$lib/supabase'
	import type { Artist } from '$lib/schemas/artist'
	import type { Ensemble } from '$lib/schemas/ensemble'

	interface Props {
		open?: boolean
		artist: Artist
		onClose?: () => void
		onSuccess?: () => void
	}

	let { open = false, artist, onClose, onSuccess }: Props = $props()

	let modalElement: HTMLDialogElement
	let ensembleSearch = $state('')
	let selectedEnsembleId = $state<string | null>(null)
	let role = $state('')
	let ensembles = $state<Ensemble[]>([])
	let artistEnsembleIds = $state<Set<string>>(new Set())
	let loadingEnsembles = $state(true)
	let submitting = $state(false)
	let error = $state<string | null>(null)

	// Load ensembles and artist's current ensembles on mount
	$effect(() => {
		if (open && artist?.id) {
			loadData()
		}
	})

	async function loadData() {
		loadingEnsembles = true
		error = null
		try {
			// Load all active ensembles
			const { data: ensemblesData, error: ensemblesError } = await supabase
				.from('phwb_ensembles')
				.select('id, name, ensemble_type, description, status')
				.eq('status', 'active')
				.order('name')

			if (ensemblesError) throw ensemblesError
			ensembles = ensemblesData || []

			// Load artist's current ensemble memberships
			if (artist.id) {
				const { data: memberships, error: membershipsError } = await supabase
					.from('phwb_ensemble_members')
					.select('ensemble_id')
					.eq('artist_id', artist.id)
					.eq('is_active', true)

				if (membershipsError) throw membershipsError
				artistEnsembleIds = new Set((memberships || []).map(m => m.ensemble_id))
			}
		} catch (err: any) {
			console.error('Failed to load data:', err)
			error = 'Failed to load ensembles'
		} finally {
			loadingEnsembles = false
		}
	}

	// Control modal visibility
	$effect(() => {
		if (modalElement) {
			if (open) {
				modalElement.showModal()
			} else {
				modalElement.close()
			}
		}
	})

	// Filter ensembles based on search and exclude already-member ensembles
	let filteredEnsembles = $derived.by(() => {
		let result = ensembles.filter(ensemble => !artistEnsembleIds.has(ensemble.id!))

		if (ensembleSearch.trim()) {
			const searchLower = ensembleSearch.toLowerCase()
			result = result.filter(ensemble =>
				ensemble.name?.toLowerCase().includes(searchLower) ||
				ensemble.description?.toLowerCase().includes(searchLower) ||
				ensemble.ensemble_type?.toLowerCase().includes(searchLower)
			)
		}

		return result
	})

	// Get selected ensemble name
	let selectedEnsembleName = $derived.by(() => {
		if (!selectedEnsembleId) return ''
		const ensemble = ensembles.find(e => e.id === selectedEnsembleId)
		return ensemble?.name || ''
	})

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault()

		if (!selectedEnsembleId) {
			error = 'Please select an ensemble'
			return
		}

		if (!artist.id) {
			error = 'Invalid artist'
			return
		}

		submitting = true
		error = null

		try {
			// Check if artist is already a member
			const { data: existing, error: checkError } = await supabase
				.from('phwb_ensemble_members')
				.select('id')
				.eq('ensemble_id', selectedEnsembleId)
				.eq('artist_id', artist.id)
				.eq('is_active', true)
				.single()

			if (existing) {
				error = 'This artist is already a member of this ensemble'
				submitting = false
				return
			}

			// Add the member
			const { error: insertError } = await supabase
				.from('phwb_ensemble_members')
				.insert({
					ensemble_id: selectedEnsembleId,
					artist_id: artist.id,
					role: role.trim() || null,
					joined_at: new Date().toISOString(),
					is_active: true
				})

			if (insertError) throw insertError

			// Success - reset form and notify parent
			resetForm()
			onSuccess?.()
			onClose?.()

		} catch (err: any) {
			console.error('Error adding artist to ensemble:', err)
			error = err.message || 'Failed to add artist to ensemble'
		} finally {
			submitting = false
		}
	}

	function resetForm() {
		selectedEnsembleId = null
		role = ''
		ensembleSearch = ''
		error = null
	}

	function handleClose() {
		resetForm()
		onClose?.()
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === modalElement) {
			handleClose()
		}
	}

	function selectEnsemble(ensembleId: string) {
		selectedEnsembleId = ensembleId
		ensembleSearch = ''
	}

	function clearEnsembleSelection() {
		selectedEnsembleId = null
		ensembleSearch = ''
	}

	function getArtistDisplayName(): string {
		return artist.full_name || artist.artist_name || artist.legal_first_name || 'Unknown Artist'
	}
</script>

<dialog
	bind:this={modalElement}
	class="modal"
	onclick={handleBackdropClick}
>
	<div class="modal-box max-w-lg">
		<div class="flex items-center justify-between mb-6">
			<h3 class="font-bold text-lg">Add {getArtistDisplayName()} to Ensemble</h3>
			<button
				class="btn btn-sm btn-circle btn-ghost"
				onclick={handleClose}
				disabled={submitting}
			>
				✕
			</button>
		</div>

		{#if error}
			<div class="alert alert-error mb-4">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{error}</span>
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="space-y-4">
			<!-- Ensemble Selection -->
			<div class="form-control">
				<label class="label">
					<span class="label-text">Ensemble <span class="text-error">*</span></span>
				</label>

				{#if selectedEnsembleId && selectedEnsembleName}
					<!-- Display selected ensemble -->
					<div class="flex gap-2">
						<input
							type="text"
							value={selectedEnsembleName}
							class="input input-bordered flex-1"
							disabled
						/>
						<button
							type="button"
							class="btn btn-outline"
							onclick={clearEnsembleSelection}
							disabled={submitting}
						>
							Change
						</button>
					</div>
				{:else}
					<!-- Search input -->
					<input
						type="text"
						bind:value={ensembleSearch}
						placeholder="Search ensembles by name, type, or description..."
						class="input input-bordered"
						disabled={submitting || loadingEnsembles}
						autocomplete="off"
					/>

					<!-- Ensemble list -->
					{#if loadingEnsembles}
						<div class="text-center py-4">
							<span class="loading loading-spinner loading-sm"></span>
						</div>
					{:else if filteredEnsembles.length > 0}
						<div class="border border-base-300 rounded-lg mt-2 max-h-64 overflow-y-auto">
							{#each filteredEnsembles as ensemble}
								<button
									type="button"
									class="w-full text-left px-4 py-3 hover:bg-base-200 border-b border-base-300 last:border-b-0"
									onclick={() => selectEnsemble(ensemble.id!)}
									disabled={submitting}
								>
									<div class="font-medium text-sm">{ensemble.name}</div>
									<div class="flex items-center gap-2 mt-1">
										{#if ensemble.ensemble_type}
											<span class="badge badge-sm badge-outline">{ensemble.ensemble_type}</span>
										{/if}
										{#if ensemble.description}
											<span class="text-xs text-base-content/60 line-clamp-1">
												{ensemble.description}
											</span>
										{/if}
									</div>
								</button>
							{/each}
						</div>
					{:else if ensembleSearch}
						<div class="text-center py-4 text-sm text-base-content/60">
							No ensembles found
						</div>
					{:else if artistEnsembleIds.size === ensembles.length}
						<div class="text-center py-4 text-sm text-base-content/60">
							This artist is already a member of all active ensembles
						</div>
					{/if}
				{/if}
			</div>

			<!-- Role (Optional) -->
			<div class="form-control">
				<label class="label">
					<span class="label-text">Role (Optional)</span>
				</label>
				<input
					type="text"
					bind:value={role}
					placeholder="e.g., Lead Vocalist, Pianist, etc."
					class="input input-bordered"
					maxlength="100"
					disabled={submitting}
				/>
				<label class="label">
					<span class="label-text-alt">Specify the artist's role or instrument in this ensemble</span>
				</label>
			</div>

			<!-- Form Actions -->
			<div class="modal-action">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={handleClose}
					disabled={submitting}
				>
					Cancel
				</button>
				<button
					type="submit"
					class="btn btn-primary"
					disabled={submitting || !selectedEnsembleId}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-sm"></span>
						Adding...
					{:else}
						Add to Ensemble
					{/if}
				</button>
			</div>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button onclick={handleClose}>close</button>
	</form>
</dialog>
