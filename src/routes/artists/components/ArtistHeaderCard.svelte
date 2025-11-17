<script lang="ts">
	import type { Artist } from '$lib/schemas/artist'
	import InlineEditableField from '$lib/components/ui/InlineEditableField.svelte'
	import InlineEditableMultiSelect from '$lib/components/ui/InlineEditableMultiSelect.svelte'
	import { formatPhone } from '$lib/utils/phone'

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

</script>

<div class="card bg-base-100 shadow-none mb-4">
	<div class="card-body p-4">
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Left Side: Basic Information (2 columns on large screens) -->
			<div class="lg:col-span-2 space-y-3">
				<!-- Name -->
				<div class="space-y-3">
					<div>
						<InlineEditableField
							value={artist.full_name || (artist.legal_first_name && artist.legal_last_name ? `${artist.legal_first_name} ${artist.legal_last_name}` : artist.legal_first_name || artist.artist_name)}
							field="full_name"
							type="text"
							placeholder="Enter full name"
							maxLength={200}
							onSave={(value) => onUpdateField('full_name', value)}
							formatDisplay={(val) => val || getDisplayName()}
							displayClass="text-3xl font-bold"
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
						{#if artist.can_be_soloist}
							<span class="badge badge-accent badge-sm">Soloist</span>
						{/if}
						{#if artist.sightreads}
							<span class="badge badge-info badge-sm">Sight Reads</span>
						{/if}
					</div>
				</div>

				<!-- Contact Info -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div>
						<InlineEditableField
							value={artist.email}
							field="email"
							type="text"
							placeholder="Enter email"
							label="Email"
							onSave={(value) => onUpdateField('email', value)}
						/>
					</div>
					<div>
						<InlineEditableField
							value={artist.phone}
							field="phone"
							type="text"
							placeholder="Enter phone"
							label="Phone"
							onSave={(value) => onUpdateField('phone', value)}
							formatDisplay={(val) => val ? formatPhone(val) : 'Not specified'}
						/>
					</div>
				</div>

				<!-- Location -->
				<div>
					<InlineEditableField
						value={artist.location}
						field="location"
						type="text"
						placeholder="Enter location"
						label="Location"
						maxLength={200}
						onSave={(value) => onUpdateField('location', value)}
					/>
				</div>

				<!-- Genres and Instruments -->
				<div class="space-y-3">
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
						rows={2}
						label="One Sentence Bio"
						onSave={(value) => onUpdateField('one_sentence_bio', value)}
					/>
				</div>

				<!-- Quick Stats -->
				<div class="flex items-center gap-3 pt-2 border-t border-base-300">
					{#if eventsCount > 0}
						<div class="stat stat-compact p-0">
							<div class="stat-title text-xs">Events</div>
							<div class="stat-value text-lg">{eventsCount}</div>
						</div>
					{/if}
					<div class="stat stat-compact p-0">
						<div class="stat-title text-xs">Created</div>
						<div class="stat-value text-sm">{formatDate(artist.created_at)}</div>
					</div>
				</div>
			</div>

			<!-- Right Side: Profile Image (1 column on large screens) -->
			<div class="lg:col-span-1">
				<div class="space-y-2">
					<h3 class="text-sm font-semibold opacity-70">Profile Photo</h3>
					<div class="space-y-2">
						<InlineEditableField
							value={artist.profile_photo}
							field="profile_photo"
							type="url"
							placeholder="Enter image URL"
							label="Image URL"
							onSave={(value) => onUpdateField('profile_photo', value)}
						/>
						{#if artist.profile_photo}
							<div class="mt-3 rounded-lg overflow-hidden border border-base-300">
								<img 
									src={artist.profile_photo} 
									alt={getDisplayName()} 
									class="w-full h-auto object-cover"
									onerror={(e) => {
										(e.target as HTMLImageElement).style.display = 'none'
									}}
								/>
							</div>
						{:else}
							<div class="mt-3 rounded-lg border-2 border-dashed border-base-300 bg-base-200 flex items-center justify-center h-48">
								<div class="text-center text-base-content/50">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
									</svg>
									<p class="text-sm">No photo</p>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

