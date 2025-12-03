<script lang="ts">
	import { onMount } from 'svelte'
	import { artistPhotosStore } from '$lib/stores/artistPhotos'
	import type { ArtistPhoto } from '$lib/schemas/artistPhoto'
	import { Upload, X, Image, Pencil, Check, Loader2 } from 'lucide-svelte'

	interface Props {
		artistId: string
	}

	let { artistId }: Props = $props()

	let photos = $state<ArtistPhoto[]>([])
	let loading = $state(true)
	let uploading = $state(false)
	let dragOver = $state(false)
	let editingTitleId = $state<string | null>(null)
	let editingTitleValue = $state('')
	let fileInput: HTMLInputElement

	// Subscribe to store
	$effect(() => {
		const unsubscribe = artistPhotosStore.subscribe(state => {
			photos = state.photos
			loading = state.loading
			uploading = state.uploading
		})
		return unsubscribe
	})

	onMount(async () => {
		await artistPhotosStore.fetchByArtistId(artistId)
	})

	// Reload when artistId changes
	$effect(() => {
		if (artistId) {
			artistPhotosStore.fetchByArtistId(artistId)
		}
	})

	function handleDragOver(e: DragEvent) {
		e.preventDefault()
		dragOver = true
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault()
		dragOver = false
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault()
		dragOver = false
		const files = e.dataTransfer?.files
		if (files) {
			await uploadFiles(files)
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement
		if (input.files) {
			uploadFiles(input.files)
		}
	}

	async function uploadFiles(files: FileList) {
		for (const file of Array.from(files)) {
			try {
				await artistPhotosStore.uploadPhoto(artistId, file)
			} catch (error) {
				console.error('Upload failed:', error)
			}
		}
		// Clear input
		if (fileInput) {
			fileInput.value = ''
		}
	}

	async function handleDelete(photo: ArtistPhoto) {
		if (!photo.id || !photo.storage_path) return
		if (!confirm('Delete this photo?')) return

		try {
			await artistPhotosStore.deletePhoto(photo.id, photo.storage_path)
		} catch (error) {
			console.error('Delete failed:', error)
		}
	}

	function startEditingTitle(photo: ArtistPhoto) {
		editingTitleId = photo.id || null
		editingTitleValue = photo.title || ''
	}

	async function saveTitle() {
		if (!editingTitleId) return

		try {
			await artistPhotosStore.updateTitle(editingTitleId, editingTitleValue || null)
			editingTitleId = null
			editingTitleValue = ''
		} catch (error) {
			console.error('Failed to update title:', error)
		}
	}

	function cancelEditingTitle() {
		editingTitleId = null
		editingTitleValue = ''
	}
</script>

<div class="space-y-4">
	<!-- Upload Area -->
	<div
		class="border-2 border-dashed rounded-lg p-8 text-center transition-colors {dragOver ? 'border-primary bg-primary/5' : 'border-base-300'}"
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		role="button"
		tabindex="0"
		onclick={() => fileInput?.click()}
		onkeydown={(e) => e.key === 'Enter' && fileInput?.click()}
	>
		<input
			bind:this={fileInput}
			type="file"
			accept="image/jpeg,image/png,image/webp,image/gif"
			multiple
			class="hidden"
			onchange={handleFileSelect}
		/>

		{#if uploading}
			<div class="flex flex-col items-center gap-2">
				<Loader2 class="w-8 h-8 animate-spin text-primary" />
				<p class="text-sm">Uploading...</p>
			</div>
		{:else}
			<div class="flex flex-col items-center gap-2">
				<Upload class="w-8 h-8 opacity-50" />
				<p class="text-sm">
					<span class="font-medium text-primary">Click to upload</span> or drag and drop
				</p>
				<p class="text-xs opacity-50">JPEG, PNG, WebP, or GIF (max 5MB)</p>
			</div>
		{/if}
	</div>

	<!-- Photo Grid -->
	{#if loading && photos.length === 0}
		<div class="flex justify-center py-8">
			<Loader2 class="w-6 h-6 animate-spin" />
		</div>
	{:else if photos.length === 0}
		<div class="text-center py-8 opacity-50">
			<Image class="w-12 h-12 mx-auto mb-2" />
			<p>No photos yet</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each photos as photo (photo.id)}
				<div class="card bg-base-200 shadow-sm group relative">
					<!-- Photo -->
					<figure class="relative aspect-square">
						<img
							src={photo.photo_url}
							alt={photo.title || 'Artist photo'}
							class="w-full h-full object-cover"
						/>
						<!-- Delete button -->
						<button
							class="btn btn-circle btn-sm btn-error absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
							onclick={() => handleDelete(photo)}
							title="Delete photo"
						>
							<X class="w-4 h-4" />
						</button>
					</figure>

					<!-- Title -->
					<div class="card-body p-3">
						{#if editingTitleId === photo.id}
							<div class="flex gap-2">
								<input
									type="text"
									class="input input-sm input-bordered flex-1"
									placeholder="Enter title"
									bind:value={editingTitleValue}
									onkeydown={(e) => e.key === 'Enter' && saveTitle()}
								/>
								<button
									class="btn btn-sm btn-primary"
									onclick={saveTitle}
								>
									<Check class="w-4 h-4" />
								</button>
								<button
									class="btn btn-sm btn-ghost"
									onclick={cancelEditingTitle}
								>
									<X class="w-4 h-4" />
								</button>
							</div>
						{:else}
							<div class="flex items-center justify-between gap-2">
								<p class="text-sm truncate {!photo.title ? 'opacity-50 italic' : ''}">
									{photo.title || 'No title'}
								</p>
								<button
									class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-opacity"
									onclick={() => startEditingTitle(photo)}
									title="Edit title"
								>
									<Pencil class="w-3 h-3" />
								</button>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
