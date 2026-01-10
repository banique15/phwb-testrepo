<script lang="ts">
	import type { Facility } from "$lib/schemas/facility";
	import type { Location } from "$lib/schemas/location";

	interface Props {
		facility: Facility;
		locations: Location[];
		selectedLocationId: number | null;
		onDelete: () => void;
	}

	let { facility, locations, selectedLocationId, onDelete }: Props = $props();

	function handleDelete() {
		if (onDelete) {
			onDelete();
		}
	}
</script>

<div class="space-y-4">
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
