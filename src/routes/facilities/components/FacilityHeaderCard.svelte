<script lang="ts">
	import type { Facility } from "$lib/schemas/facility";
	import InlineEditableField from "$lib/components/ui/InlineEditableField.svelte";

	interface Props {
		facility: Facility;
		facilityTypes: Array<{ value: string; label: string }>;
		locationCount: number;
		upcomingEventsCount?: number;
		onUpdateField: (field: string, value: any) => Promise<void>;
		onDelete?: () => void;
	}

	let {
		facility,
		facilityTypes,
		locationCount,
		upcomingEventsCount = 0,
		onUpdateField,
		onDelete,
	}: Props = $props();

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return "Not specified";
		return new Date(dateStr).toLocaleDateString();
	}
</script>

<div class="card bg-base-100 shadow-none mb-4">
	<div class="card-body p-4">
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Left Side: Basic Information (2 columns on large screens) -->
			<div class="lg:col-span-2 space-y-3">
				<!-- Title and Type -->
				<div class="space-y-3">
					<div>
						<InlineEditableField
							value={facility.name}
							field="name"
							type="text"
							placeholder="Enter facility name"
							required={true}
							maxLength={200}
							onSave={(value) => onUpdateField("name", value)}
							formatDisplay={(val) => val || "Unnamed Facility"}
							displayClass="text-3xl font-bold"
						/>
					</div>
					<div class="flex items-center gap-3 flex-wrap">
						<InlineEditableField
							value={facility.type}
							field="type"
							type="select"
							options={facilityTypes}
							placeholder="Select facility type"
							onSave={(value) => onUpdateField("type", value)}
							formatDisplay={(val) => val || "Unknown Type"}
						/>
						<InlineEditableField
							value={facility.reference}
							field="reference"
							type="text"
							placeholder="Enter reference"
							maxLength={200}
							onSave={(value) =>
								onUpdateField("reference", value)}
							formatDisplay={(val) => val || ""}
						/>
					</div>
				</div>

				<!-- Address -->
				<div>
					<InlineEditableField
						value={facility.address}
						field="address"
						type="textarea"
						placeholder="Enter address"
						maxLength={500}
						rows={2}
						label="Address"
						onSave={(value) => onUpdateField("address", value)}
					/>
				</div>

				<!-- Description Preview -->
				<div>
					<InlineEditableField
						value={facility.description}
						field="description"
						type="textarea"
						placeholder="Enter facility description"
						maxLength={2000}
						rows={3}
						label="Description"
						onSave={(value) => onUpdateField("description", value)}
					/>
				</div>

				<!-- Quick Stats and Actions -->
				<div
					class="flex items-center justify-between gap-3 pt-2 border-t border-base-300"
				>
					<div class="flex items-center gap-3">
						<div class="stat stat-compact p-0">
							<div class="stat-title text-xs">Locations</div>
							<div class="stat-value text-lg">
								{locationCount}
							</div>
						</div>
						{#if upcomingEventsCount > 0}
							<div class="stat stat-compact p-0">
								<div class="stat-title text-xs">
									Upcoming Events
								</div>
								<div class="stat-value text-lg">
									{upcomingEventsCount}
								</div>
							</div>
						{/if}
						<div class="stat stat-compact p-0">
							<div class="stat-title text-xs">Created</div>
							<div class="stat-value text-sm">
								{formatDate(facility.created_at)}
							</div>
						</div>
					</div>
					{#if onDelete}
						<button
							type="button"
							class="btn btn-sm btn-outline btn-error"
							onclick={onDelete}
							title="Delete facility"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-4 w-4 mr-1"
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
							Delete
						</button>
					{/if}
				</div>
			</div>

			<!-- Right Side: Featured Image (1 column on large screens) -->
			<div class="lg:col-span-1">
				<div class="space-y-2">
					<h3 class="text-sm font-semibold opacity-70">
						Featured Image
					</h3>
					<div class="space-y-2">
						<InlineEditableField
							value={facility.image}
							field="image"
							type="url"
							placeholder="Enter image URL"
							label="Image URL"
							onSave={(value) => onUpdateField("image", value)}
						/>
						{#if facility.image}
							<div
								class="mt-3 rounded-lg overflow-hidden border border-base-300"
							>
								<img
									src={facility.image}
									alt={`${facility.name || "Facility"}`}
									class="w-full h-auto object-cover"
									onerror={(e) => {
										(
											e.target as HTMLImageElement
										).style.display = "none";
									}}
								/>
							</div>
						{:else}
							<div
								class="mt-3 rounded-lg border-2 border-dashed border-base-300 bg-base-200 flex items-center justify-center h-48"
							>
								<div class="text-center text-base-content/50">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-12 w-12 mx-auto mb-2"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
										/>
									</svg>
									<p class="text-sm">No image</p>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
