<script lang="ts">
	import type { Artist } from '$lib/schemas/artist'
	import type { ComponentType, SvelteComponent } from 'svelte'
	import { User, Briefcase, FileText, Globe, ScrollText, Settings, Image } from 'lucide-svelte'
	import InlineEditableField from '$lib/components/ui/InlineEditableField.svelte'
	import InlineEditableMultiSelect from '$lib/components/ui/InlineEditableMultiSelect.svelte'
	import PerformanceHistory from '$lib/components/PerformanceHistory.svelte'
	import ArtistPhotoGallery from './ArtistPhotoGallery.svelte'

	interface Props {
		artist: Artist
		onUpdateField: (field: string, value: any) => Promise<void>
		onDelete: () => void
	}

	let { artist, onUpdateField, onDelete }: Props = $props()

	const tabs: Array<{ id: string; label: string; icon: ComponentType<SvelteComponent> }> = [
		{ id: 'profile', label: 'Profile', icon: User },
		{ id: 'professional', label: 'Professional', icon: Briefcase },
		{ id: 'biography', label: 'Biography', icon: FileText },
		{ id: 'social', label: 'Social', icon: Globe },
		{ id: 'photos', label: 'Photos', icon: Image },
		{ id: 'history', label: 'History', icon: ScrollText },
		{ id: 'settings', label: 'Settings', icon: Settings }
	]

	let activeTab = $state<string>(
		(typeof window !== 'undefined' ? localStorage.getItem('phwb-artist-active-tab') : null) || 'profile'
	)

	function setActiveTab(tabId: string) {
		activeTab = tabId
		if (typeof window !== 'undefined') {
			localStorage.setItem('phwb-artist-active-tab', tabId)
		}
	}

	function getArrayDisplayValue(arr: any): string {
		if (!arr || !Array.isArray(arr)) return ''
		return arr.join(', ')
	}

	function handleArrayFieldUpdate(field: string, value: string) {
		const items = value ? value.split(',').map(item => item.trim()).filter(Boolean) : []
		return onUpdateField(field, items)
	}

	const employmentStatusOptions = [
		{ value: 'Employee', label: 'Employee/W2' },
		{ value: '1099', label: 'LLC/1099' },
		{ value: 'Trial', label: 'Trial' }
	]

	const shirtSizeOptions = [
		{ value: 'XS', label: 'XS' },
		{ value: 'S', label: 'S' },
		{ value: 'M', label: 'M' },
		{ value: 'L', label: 'L' },
		{ value: 'XL', label: 'XL' },
		{ value: 'XXL', label: 'XXL' },
		{ value: '3XL', label: '3XL' }
	]

	const metropolitanHubOptions = [
		{ value: 'New York', label: 'New York' },
		{ value: 'Los Angeles', label: 'Los Angeles' },
		{ value: 'Chicago', label: 'Chicago' },
		{ value: 'Houston', label: 'Houston' },
		{ value: 'Philadelphia', label: 'Philadelphia' }
	]
</script>

<div class="space-y-3">
	<!-- Tab Navigation -->
	<div class="tabs tabs-boxed px-4">
		{#each tabs as tab}
			<button
				class="tab {activeTab === tab.id ? 'tab-active' : ''}"
				onclick={() => setActiveTab(tab.id)}
			>
				<svelte:component this={tab.icon} class="w-4 h-4 mr-2" />
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Tab Content -->
	<div class="tab-content block">
		{#if activeTab === 'profile'}
			<div class="space-y-4 p-4">
				<h3 class="text-lg font-semibold border-b pb-2">Profile Information</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<InlineEditableField
							value={artist.legal_first_name}
							field="legal_first_name"
							type="text"
							placeholder="Enter legal first name"
							required={true}
							label="Legal First Name"
							onSave={(value) => onUpdateField('legal_first_name', value)}
						/>
					</div>
					<div>
						<InlineEditableField
							value={artist.legal_last_name}
							field="legal_last_name"
							type="text"
							placeholder="Enter legal last name"
							label="Legal Last Name"
							onSave={(value) => onUpdateField('legal_last_name', value)}
						/>
					</div>
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
							type="phone"
							placeholder="(555) 123-4567"
							label="Phone"
							onSave={(value) => onUpdateField('phone', value)}
						/>
					</div>
					<div>
						<InlineEditableField
							value={artist.location}
							field="location"
							type="text"
							placeholder="Enter location"
							label="Location"
							onSave={(value) => onUpdateField('location', value)}
						/>
					</div>
					<div>
						<InlineEditableField
							value={artist.metropolitan_hub}
							field="metropolitan_hub"
							type="select"
							options={metropolitanHubOptions}
							placeholder="Select metropolitan hub"
							label="Metropolitan Hub"
							onSave={(value) => onUpdateField('metropolitan_hub', value)}
						/>
					</div>
					<div>
						<InlineEditableField
							value={artist.shirt_size}
							field="shirt_size"
							type="select"
							options={shirtSizeOptions}
							placeholder="Select shirt size"
							label="Shirt Size"
							onSave={(value) => onUpdateField('shirt_size', value)}
						/>
					</div>
				</div>
			</div>
		{:else if activeTab === 'professional'}
			<div class="space-y-4 p-4">
				<h3 class="text-lg font-semibold border-b pb-2">Professional Details</h3>
				<div class="space-y-4">
					<div>
						<InlineEditableField
							value={artist.employment_status}
							field="employment_status"
							type="select"
							options={employmentStatusOptions}
							placeholder="Select employment status"
							label="Employment Status"
							onSave={(value) => onUpdateField('employment_status', value)}
						/>
					</div>
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
					<div>
						<InlineEditableField
							value={getArrayDisplayValue(artist.languages)}
							field="languages"
							type="text"
							placeholder="Enter languages (comma-separated)"
							label="Languages"
							onSave={(value) => handleArrayFieldUpdate('languages', value)}
							formatDisplay={(val) => val || 'Not specified'}
						/>
					</div>
					<div class="flex gap-4">
						<div class="flex-1">
							<InlineEditableField
								value={artist.sightreads}
								field="sightreads"
								type="checkbox"
								label="Sight Reads"
								onSave={(value) => onUpdateField('sightreads', value)}
							/>
						</div>
						<div class="flex-1">
							<InlineEditableField
								value={artist.can_be_soloist}
								field="can_be_soloist"
								type="checkbox"
								label="Can Be Soloist"
								onSave={(value) => onUpdateField('can_be_soloist', value)}
							/>
						</div>
					</div>
				</div>
			</div>
		{:else if activeTab === 'biography'}
			<div class="space-y-4 p-4">
				<h3 class="text-lg font-semibold border-b pb-2">Biography</h3>
				<div class="space-y-4">
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
					<div>
						<InlineEditableField
							value={artist.bio}
							field="bio"
							type="textarea"
							placeholder="Enter full bio"
							maxLength={2000}
							rows={8}
							label="Full Bio"
							onSave={(value) => onUpdateField('bio', value)}
						/>
					</div>
				</div>
			</div>
		{:else if activeTab === 'social'}
			<div class="space-y-4 p-4">
				<h3 class="text-lg font-semibold border-b pb-2">Social Media & Web</h3>
				<div class="space-y-4">
					<div>
						<InlineEditableField
							value={artist.website}
							field="website"
							type="url"
							placeholder="https://example.com"
							label="Website"
							onSave={(value) => onUpdateField('website', value)}
						/>
					</div>
					<div>
						<InlineEditableField
							value={artist.instagram}
							field="instagram"
							type="text"
							placeholder="username (without @)"
							label="Instagram"
							onSave={(value) => onUpdateField('instagram', value)}
						/>
					</div>
					<div>
						<InlineEditableField
							value={artist.facebook}
							field="facebook"
							type="url"
							placeholder="https://facebook.com/artist"
							label="Facebook"
							onSave={(value) => onUpdateField('facebook', value)}
						/>
					</div>
				</div>
			</div>
		{:else if activeTab === 'photos'}
			<div class="space-y-4 p-4">
				<h3 class="text-lg font-semibold border-b pb-2">Photo Gallery</h3>
				{#if artist.id}
					<ArtistPhotoGallery artistId={artist.id} />
				{:else}
					<p class="text-sm opacity-70">Save the artist first to add photos</p>
				{/if}
			</div>
		{:else if activeTab === 'history'}
			<div class="space-y-4 p-4">
				<h3 class="text-lg font-semibold border-b pb-2">Performance History</h3>
				{#if artist.id}
					<PerformanceHistory artistId={artist.id} showStats={true} />
				{:else}
					<p class="text-sm opacity-70">No performance history available</p>
				{/if}
			</div>
		{:else if activeTab === 'settings'}
			<div class="space-y-4 p-4">
				<h3 class="text-lg font-semibold border-b pb-2">Settings</h3>
				<div class="space-y-4">
					<button
						class="btn btn-outline btn-error"
						onclick={onDelete}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
						Delete Artist
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

