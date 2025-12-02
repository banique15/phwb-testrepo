<script lang="ts">
	import type { Artist } from '$lib/schemas/artist'
	import InlineEditableField from '$lib/components/ui/InlineEditableField.svelte'
	import InlineEditableMultiSelect from '$lib/components/ui/InlineEditableMultiSelect.svelte'
	import { Mail, Phone, MapPin } from 'lucide-svelte'

	interface Props {
		artist: Artist
		eventsCount?: number
		onUpdateField: (field: string, value: any) => Promise<void>
	}

	let {
		artist,
		eventsCount = 0,
		onUpdateField
	}: Props = $props()

	let isEditingProfilePhotoUrl = $state(false)

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		return new Date(dateStr).toLocaleDateString()
	}

	function getDisplayName(): string {
		return artist.full_name ||
			(artist.legal_first_name && artist.legal_last_name
				? `${artist.legal_first_name} ${artist.legal_last_name}`
				: artist.legal_first_name) ||
			artist.artist_name ||
			'Unnamed Artist'
	}

	async function handleProfilePhotoUrlSave(value: any) {
		await onUpdateField('profile_photo', value)
		isEditingProfilePhotoUrl = false
	}

</script>

<div class="card bg-base-100 shadow-none mb-4">
	<div class="card-body p-3">
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
			<!-- Left Side: Basic Information (2 columns on large screens) -->
			<div class="lg:col-span-2 space-y-2">
				<!-- Name, Artist Name, and Email Row -->
				<div class="space-y-1">
					<div>
						<InlineEditableField
							value={artist.full_name || (artist.legal_first_name && artist.legal_last_name ? `${artist.legal_first_name} ${artist.legal_last_name}` : artist.legal_first_name || artist.artist_name)}
							field="full_name"
							type="text"
							placeholder="Enter full name"
							maxLength={200}
							onSave={(value) => onUpdateField('full_name', value)}
							formatDisplay={(val) => val || getDisplayName()}
							displayClass="text-2xl font-bold"
						/>
					</div>
					<div class="flex items-center gap-3 flex-wrap">
						<InlineEditableField
							value={artist.artist_name}
							field="artist_name"
							type="text"
							placeholder="Enter artist name"
							maxLength={200}
							onSave={(value) => onUpdateField('artist_name', value)}
							formatDisplay={(val) => val || ''}
						/>
						<div class="flex items-center gap-1.5">
							<Mail class="w-4 h-4 opacity-60" />
							<InlineEditableField
								value={artist.email}
								field="email"
								type="text"
								placeholder="Enter email"
								onSave={(value) => onUpdateField('email', value)}
							/>
						</div>
						{#if artist.can_be_soloist}
							<span class="badge badge-accent badge-sm">Soloist</span>
						{/if}
						{#if artist.sightreads}
							<span class="badge badge-info badge-sm">Sight Reads</span>
						{/if}
					</div>
				</div>

				<!-- Phone and Location Row -->
				<div class="flex items-center gap-4 flex-wrap">
					<div class="flex items-center gap-1.5">
						<Phone class="w-4 h-4 opacity-60" />
						<InlineEditableField
							value={artist.phone}
							field="phone"
							type="phone"
							placeholder="(555) 123-4567"
							onSave={(value) => onUpdateField('phone', value)}
						/>
					</div>
					<div class="flex items-center gap-1.5">
						<MapPin class="w-4 h-4 opacity-60" />
						<InlineEditableField
							value={artist.location}
							field="location"
							type="text"
							placeholder="Enter location"
							maxLength={200}
							onSave={(value) => onUpdateField('location', value)}
						/>
					</div>
				</div>

				<!-- Genres and Instruments Row -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
					<div>
						<InlineEditableMultiSelect
							value={artist.genres || []}
							field="genres"
							label="Genres"
							onSave={async (value) => {
								await onUpdateField('genres', value)
							}}
						/>
					</div>
					<div>
						<InlineEditableMultiSelect
							value={artist.instruments || []}
							field="instruments"
							label="Instruments"
							onSave={async (value) => {
								await onUpdateField('instruments', value)
							}}
						/>
					</div>
				</div>

				<!-- One Sentence Bio -->
				<div>
					<InlineEditableField
						value={artist.one_sentence_bio}
						field="one_sentence_bio"
						type="textarea"
						placeholder="Enter one sentence bio"
						maxLength={200}
						rows={1}
						label="One Sentence Bio"
						onSave={(value) => onUpdateField('one_sentence_bio', value)}
					/>
				</div>

				<!-- Quick Stats -->
				<div class="flex items-center gap-4 pt-1 border-t border-base-300">
					{#if eventsCount > 0}
						<div class="stat stat-compact p-0">
							<div class="stat-title text-xs">Events</div>
							<div class="stat-value text-base">{eventsCount}</div>
						</div>
					{/if}
					<div class="stat stat-compact p-0">
						<div class="stat-title text-xs">Created</div>
						<div class="stat-value text-xs">{formatDate(artist.created_at)}</div>
					</div>
				</div>
			</div>

			<!-- Right Side: Profile Photo (1 column on large screens) -->
			<div class="lg:col-span-1">
				<div class="space-y-1.5">
					{#if artist.profile_photo}
						{#key `${artist.id}-${artist.profile_photo}`}
							<div class="rounded-lg overflow-hidden border border-base-300 relative group">
								<img 
									src={artist.profile_photo} 
									alt={getDisplayName()} 
									class="w-full h-auto object-cover max-h-32"
									onerror={(e) => {
										(e.target as HTMLImageElement).style.display = 'none'
									}}
								/>
								{#if !isEditingProfilePhotoUrl}
									<div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
										<button
											type="button"
											class="btn btn-xs btn-ghost bg-base-100/80 backdrop-blur-sm"
											onclick={() => isEditingProfilePhotoUrl = true}
											title="Edit profile photo URL"
										>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
											</svg>
										</button>
									</div>
								{/if}
							</div>
						{/key}
					{:else}
						<div class="rounded-lg border-2 border-dashed border-base-300 bg-base-200 flex items-center justify-center h-24">
							<div class="text-center text-base-content/50">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
							</div>
						</div>
					{/if}
					{#if !artist.profile_photo || isEditingProfilePhotoUrl}
						<InlineEditableField
							value={artist.profile_photo}
							field="profile_photo"
							type="url"
							placeholder="Enter image URL"
							label="Profile Photo URL"
							onSave={handleProfilePhotoUrlSave}
							onCancel={() => isEditingProfilePhotoUrl = false}
						/>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

