<script lang="ts">
	import type { Facility } from "$lib/schemas/facility";
	import type { Location } from "$lib/schemas/location";

	interface Props {
		facility: Facility;
		locations: Location[];
		selectedLocationId: number | null;
		onDelete: () => void;
		onEditLocation?: (locationId: number | null) => void;
	}

	let { facility, locations, selectedLocationId, onDelete, onEditLocation }: Props = $props();

	function handleDelete() {
		if (onDelete) {
			onDelete();
		}
	}

	const selectedLocation = $derived(
		selectedLocationId !== null 
			? locations.find(l => l.id === selectedLocationId) ?? null 
			: null
	);

	function getAcousticsRating(acoustics: number | undefined): string {
		if (!acoustics || acoustics === 0) return 'Not Rated';
		const ratings = {
			1: '1 - Poor (echoey, noisy)',
			2: '2 - Fair (some echo/noise issues)',
			3: '3 - Good (adequate for most performances)',
			4: '4 - Very Good (minimal echo, good sound)',
			5: '5 - Excellent (purpose-built acoustics)'
		};
		return ratings[acoustics as keyof typeof ratings] || 'Not Rated';
	}

	function getAttributeValue(attributes: any, key: string): any {
		if (!attributes || typeof attributes !== 'object') return null;
		return attributes[key];
	}
</script>

<div class="space-y-4">
	{#if selectedLocation}
		<!-- Location Details -->
		<div class="card bg-base-100">
			<div class="card-body p-4">
				<div class="flex items-center justify-between mb-4">
					<h3 class="text-lg font-semibold">Location Settings</h3>
					<button
						type="button"
						class="btn btn-sm btn-outline"
						onclick={() => onEditLocation?.(selectedLocation.id ?? null)}
					>
						Edit Location
					</button>
				</div>
				
				<div class="space-y-4">
					<!-- Basic Info -->
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label class="label">
								<span class="label-text font-medium">Name</span>
							</label>
							<p class="text-base">{selectedLocation.name}</p>
						</div>
						{#if selectedLocation.floor}
							<div>
								<label class="label">
									<span class="label-text font-medium">Floor</span>
								</label>
								<p class="text-base">{selectedLocation.floor}</p>
							</div>
						{/if}
						{#if selectedLocation.capacity}
							<div>
								<label class="label">
									<span class="label-text font-medium">Capacity</span>
								</label>
								<p class="text-base">{selectedLocation.capacity}</p>
							</div>
						{/if}
						{#if selectedLocation.type}
							<div>
								<label class="label">
									<span class="label-text font-medium">Type</span>
								</label>
								<p class="text-base">{selectedLocation.type}</p>
							</div>
						{/if}
					</div>

					<!-- Acoustics Rating -->
					<div class="border-t border-base-300 pt-4">
						<label class="label">
							<span class="label-text font-medium">Acoustics Quality Rating</span>
						</label>
						{#if selectedLocation}
							{@const acoustics = getAttributeValue(selectedLocation.attributes, 'acoustics')}
							<div class="p-3 bg-base-200 rounded-lg">
								<p class="text-base font-semibold">
									{getAcousticsRating(typeof acoustics === 'number' ? acoustics : undefined)}
								</p>
								{#if (!acoustics || acoustics === 0)}
									<p class="text-sm text-base-content/60 mt-1">
										No acoustics rating set. Edit the location to set a rating.
									</p>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Attributes -->
					{#if selectedLocation.attributes && typeof selectedLocation.attributes === 'object'}
						{@const attrs = selectedLocation.attributes as Record<string, any>}
						{@const hasAttributes = Object.keys(attrs).some(key => key !== 'acoustics' && attrs[key])}
						{#if hasAttributes}
							<div class="border-t border-base-300 pt-4">
								<label class="label">
									<span class="label-text font-medium">Location Attributes</span>
								</label>
								<div class="flex flex-wrap gap-2 mt-2">
									{#if attrs.power}
										<span class="badge badge-outline">Power Available</span>
									{/if}
									{#if attrs.wifi}
										<span class="badge badge-outline">WiFi</span>
									{/if}
									{#if attrs.soundSystem}
										<span class="badge badge-outline">Sound System</span>
									{/if}
									{#if attrs.projector}
										<span class="badge badge-outline">Projector</span>
									{/if}
									{#if attrs.hvac}
										<span class="badge badge-outline">HVAC</span>
									{/if}
									{#if attrs.wheelchairAccess}
										<span class="badge badge-outline">Wheelchair Access</span>
									{/if}
									{#if attrs.elevator}
										<span class="badge badge-outline">Elevator</span>
									{/if}
									{#if attrs.naturalLight}
										<span class="badge badge-outline">Natural Light</span>
									{/if}
									{#if attrs.adjustableLighting}
										<span class="badge badge-outline">Adjustable Lighting</span>
									{/if}
									{#if attrs.storage}
										<span class="badge badge-outline">Storage Available</span>
									{/if}
								</div>
							</div>
						{/if}
					{/if}

					<!-- Description -->
					{#if selectedLocation.description}
						<div class="border-t border-base-300 pt-4">
							<label class="label">
								<span class="label-text font-medium">Description</span>
							</label>
							<p class="text-base whitespace-pre-wrap">{selectedLocation.description}</p>
						</div>
					{/if}

					<!-- Notes -->
					{#if selectedLocation.notes}
						<div class="border-t border-base-300 pt-4">
							<label class="label">
								<span class="label-text font-medium">Notes</span>
							</label>
							<p class="text-base whitespace-pre-wrap">{selectedLocation.notes}</p>
						</div>
					{/if}

					<!-- Active Status -->
					<div class="border-t border-base-300 pt-4">
						<label class="label">
							<span class="label-text font-medium">Status</span>
						</label>
						<div class="mt-2">
							<span class="badge {selectedLocation.active ? 'badge-success' : 'badge-warning'}">
								{selectedLocation.active ? 'Active' : 'Inactive'}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<!-- Facility Settings (when no location selected) -->
		<div class="card bg-base-100">
			<div class="card-body p-4">
				<h3 class="text-lg font-semibold mb-4">Facility Settings</h3>
				<p class="text-base-content/70 mb-4">
					Select a location from the dropdown above to view and edit location-specific settings, including acoustics rating.
				</p>
			</div>
		</div>
	{/if}

	<!-- Danger Zone -->
	<div class="card bg-base-100">
		<div class="card-body p-4">
			<h3 class="text-lg font-semibold mb-4">Danger Zone</h3>
			<div class="space-y-3">
				<div
					class="flex items-center justify-between p-3 bg-base-200 rounded-lg"
				>
					<div>
						<h4 class="font-medium">Delete Facility</h4>
						<p class="text-sm opacity-70 mt-1">
							Permanently delete this facility and all associated
							data. This action cannot be undone.
						</p>
					</div>
					<button
						type="button"
						class="btn btn-outline btn-error"
						onclick={handleDelete}
						title="Delete facility"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4 mr-2"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
							/>
						</svg>
						Delete Facility
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
