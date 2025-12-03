<script lang="ts">
	import { onMount } from 'svelte'
	import type { Artist } from '$lib/schemas/artist'
	import InlineEditableField from '$lib/components/ui/InlineEditableField.svelte'
	import InlineEditableMultiSelect from '$lib/components/ui/InlineEditableMultiSelect.svelte'
	import { Mail, Phone, MapPin, Users, Upload, Loader2, X } from 'lucide-svelte'
	import { supabase } from '$lib/supabase'

	const BUCKET_NAME = 'artist-photos'
	const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
	const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

	interface EnsembleMember {
		artist_id: string
		role: string | null
		artist: {
			id: string
			full_name: string | null
			artist_name: string | null
		}
	}

	interface EnsembleMembership {
		id: number
		role: string | null
		ensemble: {
			id: number
			name: string
			ensemble_type: string | null
		}
		members?: EnsembleMember[]
	}

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
	let ensembles = $state<EnsembleMembership[]>([])
	let loadingEnsembles = $state(false)

	// Load ensembles when artist changes
	$effect(() => {
		if (artist?.id) {
			loadArtistEnsembles(artist.id)
		}
	})

	async function loadArtistEnsembles(artistId: string) {
		loadingEnsembles = true
		try {
			// First get the ensembles this artist belongs to
			const { data, error } = await supabase
				.from('phwb_ensemble_members')
				.select(`
					id,
					role,
					ensemble:phwb_ensembles(id, name, ensemble_type)
				`)
				.eq('artist_id', artistId)
				.eq('is_active', true)

			if (!error && data) {
				const memberships = data as unknown as EnsembleMembership[]

				// For each ensemble, fetch all members
				for (const membership of memberships) {
					if (membership.ensemble?.id) {
						const { data: members } = await supabase
							.from('phwb_ensemble_members')
							.select(`
								artist_id,
								role,
								artist:phwb_artists(id, full_name, artist_name)
							`)
							.eq('ensemble_id', membership.ensemble.id)
							.eq('is_active', true)

						membership.members = (members || []) as unknown as EnsembleMember[]
					}
				}

				ensembles = memberships
			}
		} catch (err) {
			console.error('Failed to load artist ensembles:', err)
		} finally {
			loadingEnsembles = false
		}
	}

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
	<div class="card-body p-4">
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Left Side: Basic Information (2 columns on large screens) -->
			<div class="lg:col-span-2 space-y-3">
				<!-- Name Row -->
				<div class="flex items-start justify-between gap-2">
					<div class="flex-1">
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
					<div class="flex items-center gap-1 flex-shrink-0 pt-1">
						{#if artist.can_be_soloist}
							<span class="badge badge-accent badge-sm">Soloist</span>
						{/if}
						{#if artist.sightreads}
							<span class="badge badge-info badge-sm">Sight Reads</span>
						{/if}
					</div>
				</div>

				<!-- Artist Name Row -->
				<div>
					<span class="text-xs text-base-content/50 uppercase tracking-wide">Artist Name</span>
					<InlineEditableField
						value={artist.artist_name}
						field="artist_name"
						type="text"
						placeholder="Enter artist/stage name"
						maxLength={200}
						onSave={(value) => onUpdateField('artist_name', value)}
						formatDisplay={(val) => val || 'Not set'}
					/>
				</div>

				<!-- Contact Info Row -->
				<div class="flex flex-wrap gap-x-6 gap-y-2">
					<div class="min-w-[180px]">
						<span class="text-xs text-base-content/50 uppercase tracking-wide flex items-center gap-1">
							<Mail class="w-3 h-3" /> Email
						</span>
						<InlineEditableField
							value={artist.email}
							field="email"
							type="text"
							placeholder="Enter email"
							onSave={(value) => onUpdateField('email', value)}
							formatDisplay={(val) => val || 'Not set'}
						/>
					</div>
					<div class="min-w-[140px]">
						<span class="text-xs text-base-content/50 uppercase tracking-wide flex items-center gap-1">
							<Phone class="w-3 h-3" /> Phone
						</span>
						<InlineEditableField
							value={artist.phone}
							field="phone"
							type="phone"
							placeholder="(555) 123-4567"
							onSave={(value) => onUpdateField('phone', value)}
							formatDisplay={(val) => val || 'Not set'}
						/>
					</div>
					<div class="min-w-[140px]">
						<span class="text-xs text-base-content/50 uppercase tracking-wide flex items-center gap-1">
							<MapPin class="w-3 h-3" /> Location
						</span>
						<InlineEditableField
							value={artist.location}
							field="location"
							type="text"
							placeholder="Enter location"
							maxLength={200}
							onSave={(value) => onUpdateField('location', value)}
							formatDisplay={(val) => val || 'Not set'}
						/>
					</div>
				</div>

				<!-- Ensembles Section -->
				{#if ensembles.length > 0 || loadingEnsembles}
					<div class="space-y-2">
						<span class="text-xs text-base-content/50 uppercase tracking-wide flex items-center gap-1">
							<Users class="w-3 h-3" /> Ensembles
						</span>
						{#if loadingEnsembles}
							<div class="flex items-center gap-2 text-sm text-base-content/50">
								<span class="loading loading-spinner loading-xs"></span>
								Loading ensembles...
							</div>
						{:else}
							<div class="flex flex-wrap gap-3">
								{#each ensembles as membership}
									<div class="card bg-base-200 shadow-sm">
										<div class="card-body p-3">
											<div class="flex items-center justify-between gap-4">
												<div>
													<a
														href="/ensembles?id={membership.ensemble.id}"
														class="font-medium hover:text-primary transition-colors"
													>
														{membership.ensemble.name}
													</a>
													{#if membership.ensemble.ensemble_type}
														<span class="text-xs text-base-content/50 ml-2">({membership.ensemble.ensemble_type})</span>
													{/if}
													{#if membership.role}
														<div class="text-xs text-primary mt-0.5">Your role: {membership.role}</div>
													{/if}
												</div>
											</div>
											{#if membership.members && membership.members.length > 0}
												<div class="mt-2 pt-2 border-t border-base-300">
													<div class="text-xs text-base-content/50 mb-1">Members ({membership.members.length})</div>
													<div class="flex flex-wrap gap-1">
														{#each membership.members as member}
															{@const isCurrentArtist = member.artist_id === artist.id}
															{@const displayName = member.artist?.full_name || member.artist?.artist_name || 'Unknown'}
															<a
																href="/artists?id={member.artist_id}"
																class="badge badge-sm {isCurrentArtist ? 'badge-primary' : 'badge-ghost'} hover:badge-primary transition-colors"
																title={member.role ? `${displayName} - ${member.role}` : displayName}
															>
																{displayName}
																{#if member.role}
																	<span class="opacity-60 ml-1 text-[10px]">({member.role})</span>
																{/if}
															</a>
														{/each}
													</div>
												</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Genres and Instruments Row -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
				<div class="flex items-center gap-6 pt-2 border-t border-base-200 text-sm">
					{#if eventsCount > 0}
						<div>
							<span class="text-base-content/50">Events:</span>
							<span class="font-medium ml-1">{eventsCount}</span>
						</div>
					{/if}
					<div>
						<span class="text-base-content/50">Created:</span>
						<span class="font-medium ml-1">{formatDate(artist.created_at)}</span>
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

