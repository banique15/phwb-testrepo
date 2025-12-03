<script lang="ts">
	import { createArtist } from '$lib/stores/artists'
	import type { Artist } from '$lib/schemas/artist'

	interface Props {
		onSuccess?: (artist: Artist) => void
		onCancel?: () => void
	}

	let { onSuccess, onCancel }: Props = $props()

	let loading = $state(false)
	let error = $state('')

	// Form fields - only require name initially
	let legalFirstName = $state('')
	let legalLastName = $state('')

	let canSave = $derived(legalFirstName.trim().length > 0 && legalLastName.trim().length > 0)

	async function handleSave() {
		if (!canSave) return

		loading = true
		error = ''

		try {
			// Create minimal artist with just the name
			const fullName = `${legalFirstName.trim()} ${legalLastName.trim()}`
			const newArtist = await createArtist({
				legal_first_name: legalFirstName.trim(),
				legal_last_name: legalLastName.trim(),
				full_name: fullName
			})

			onSuccess?.(newArtist)
		} catch (err: any) {
			error = err.message || 'Failed to create artist'
			loading = false
		}
	}

	function handleCancel() {
		onCancel?.()
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && canSave && !loading) {
			e.preventDefault()
			handleSave()
		} else if (e.key === 'Escape') {
			handleCancel()
		}
	}
</script>

<div class="h-full flex flex-col">
	<!-- Header -->
	<div class="flex-none border-b border-base-200 pb-4 mb-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-2xl font-bold">New Artist</h2>
				<p class="text-sm text-base-content/60 mt-1">Enter the artist's legal name to get started</p>
			</div>
			<button
				class="btn btn-ghost btn-sm"
				onclick={handleCancel}
				disabled={loading}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>

	<!-- Form -->
	<div class="flex-1 overflow-y-auto">
		<div class="max-w-md space-y-4">
			{#if error}
				<div class="alert alert-error text-sm py-2">
					<span>{error}</span>
				</div>
			{/if}

			<div class="form-control">
				<label class="label" for="legal-first-name">
					<span class="label-text font-medium">Legal First Name <span class="text-error">*</span></span>
				</label>
				<input
					id="legal-first-name"
					type="text"
					class="input input-bordered"
					placeholder="Enter first name"
					bind:value={legalFirstName}
					onkeydown={handleKeydown}
					disabled={loading}
					autofocus
				/>
			</div>

			<div class="form-control">
				<label class="label" for="legal-last-name">
					<span class="label-text font-medium">Legal Last Name <span class="text-error">*</span></span>
				</label>
				<input
					id="legal-last-name"
					type="text"
					class="input input-bordered"
					placeholder="Enter last name"
					bind:value={legalLastName}
					onkeydown={handleKeydown}
					disabled={loading}
				/>
			</div>

			<div class="pt-4 flex gap-2">
				<button
					class="btn btn-primary"
					onclick={handleSave}
					disabled={!canSave || loading}
				>
					{#if loading}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Create Artist
				</button>
				<button
					class="btn btn-ghost"
					onclick={handleCancel}
					disabled={loading}
				>
					Cancel
				</button>
			</div>

			<p class="text-xs text-base-content/50 pt-2">
				After creating the artist, you can add more details like contact info, instruments, and bio.
			</p>
		</div>
	</div>
</div>
