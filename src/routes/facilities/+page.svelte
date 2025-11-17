<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { facilitiesStore } from "$lib/stores/facilities";
	import {
		getLocationsByFacility,
		locationsStore,
	} from "$lib/stores/locations";
	import type { Facility } from "$lib/schemas/facility";
	import type { Location } from "$lib/schemas/location";
	import { updateFacilitySchema } from "$lib/schemas/facility";
	import { updateLocationSchema } from "$lib/schemas/location";
	import { z } from "zod";
	import ErrorBoundary from "$lib/components/ui/ErrorBoundary.svelte";
	import MasterDetail from "$lib/components/ui/MasterDetail.svelte";
	import FacilityHeaderCard from "./components/FacilityHeaderCard.svelte";
	import FacilityTabs from "./components/FacilityTabs.svelte";
	import CreateFacility from "./components/modals/CreateFacility.svelte";
	import DeleteFacility from "./components/modals/DeleteFacility.svelte";
	import CreateLocation from "./components/modals/CreateLocation.svelte";
	import DeleteLocation from "./components/modals/DeleteLocation.svelte";
	import FacilitiesFilters from "./components/FacilitiesFilters.svelte";
	import { supabase } from "$lib/supabase";
	import type { FacilityFilters } from "$lib/utils/filters";

	interface Props {
		data: {
			facilities: Facility[];
			pagination: {
				total: number;
				page: number;
				limit: number;
				totalPages: number;
			};
			filters: {
				search?: string;
				sortBy: string;
				sortOrder: "asc" | "desc";
				page?: number;
				type?: string;
				partner?: number;
				city?: string;
				state?: string;
				has_locations?: boolean;
				has_contacts?: boolean;
				location_count_min?: number;
				location_count_max?: number;
			};
			lookupData: {
				partners: Array<{ id: number; name: string }>;
				facilityTypes: string[];
				cities: string[];
				states: string[];
			};
			performance: {
				totalTime: number;
				queryTime: number;
				itemCount: number;
			};
			error?: string;
		};
	}

	let { data }: Props = $props();

	let selectedFacility = $state<Facility | null>(null);
	let selectedLocation = $state<Location | null>(null);
	let facilityLocations = $state<Location[]>([]);
	let selectedLocationId = $state<number | null>(null);
	let upcomingEventsCount = $state(0);
	let isCreateFacilityModalOpen = $state(false);
	let isDeleteFacilityModalOpen = $state(false);
	let isCreateLocationModalOpen = $state(false);
	let isDeleteLocationModalOpen = $state(false);
	let clientLoading = $state(false);

	// Use derived state to avoid infinite loops
	let facilities = $derived(data.facilities);
	let pagination = $derived(data.pagination);
	let currentFilters = $derived(data.filters);
	let performanceMetrics = $derived(data.performance);

	onMount(() => {
		// Restore selected facility from localStorage
		const storageKey = "phwb-selected-facility";
		const savedId = localStorage.getItem(storageKey);
		if (savedId && data.facilities.length > 0) {
			const savedFacility = data.facilities.find(
				(facility) => String(facility.id) === savedId,
			);
			if (savedFacility) {
				selectedFacility = savedFacility;
				loadFacilityLocations(savedFacility.id!);
			}
		}

		// Subscribe to real-time changes
		let realtimeSubscription = facilitiesStore.subscribeToChanges();

		onDestroy(() => {
			if (realtimeSubscription) {
				facilitiesStore.unsubscribeFromChanges();
			}
		});

		if (import.meta.env.DEV) {
			console.log("Facilities page performance:", performanceMetrics);
		}
	});

	async function loadFacilityLocations(facilityId: number) {
		try {
			facilityLocations = await getLocationsByFacility(facilityId);
			selectedLocationId = null; // Reset location context when facility changes
			await loadUpcomingEventsCount(facilityId);
		} catch (err) {
			console.error("Failed to load facility locations:", err);
			facilityLocations = [];
		}
	}

	async function loadUpcomingEventsCount(facilityId: number) {
		try {
			const today = new Date().toISOString().split("T")[0];
			const locationIds = facilityLocations
				.map((l) => l.id)
				.filter(Boolean) as number[];

			if (locationIds.length === 0) {
				upcomingEventsCount = 0;
				return;
			}

			const { data, error } = await supabase
				.from("phwb_events")
				.select("id", { count: "exact" })
				.in("location_id", locationIds)
				.gte("date", today)
				.in("status", ["planned", "confirmed", "in_progress"]);

			if (error) {
				console.error("Error loading upcoming events count:", error);
				upcomingEventsCount = 0;
			} else {
				upcomingEventsCount = data?.length || 0;
			}
		} catch (err) {
			console.error("Failed to load upcoming events count:", err);
			upcomingEventsCount = 0;
		}
	}

	function handleSelectLocationContext(locationId: number | null) {
		selectedLocationId = locationId;
	}

	async function updateUrlAndFetch(newFilters: Partial<FacilityFilters>) {
		clientLoading = true;

		try {
			const searchParams = new URLSearchParams($page.url.searchParams);

			// Merge current filters with new filters
			const mergedFilters = { ...currentFilters, ...newFilters };

			Object.entries(mergedFilters).forEach(([key, value]) => {
				if (value !== undefined && value !== null && value !== "") {
					if (Array.isArray(value)) {
						searchParams.set(key, value.join(","));
					} else if (typeof value === "boolean") {
						searchParams.set(key, String(value));
					} else {
						searchParams.set(key, String(value));
					}
				} else {
					searchParams.delete(key);
				}
			});

			await goto(`?${searchParams.toString()}`, {
				keepFocus: true,
				replaceState: true,
			});
		} catch (err) {
			console.error("Failed to update facilities:", err);
		} finally {
			clientLoading = false;
		}
	}

	async function handleFiltersChange(newFilters: Partial<FacilityFilters>) {
		clientLoading = true;
		try {
			const searchParams = new URLSearchParams($page.url.searchParams);

			// Apply filter changes
			Object.entries(newFilters).forEach(([key, value]) => {
				if (value !== undefined && value !== null && value !== "") {
					if (typeof value === "boolean") {
						searchParams.set(key, String(value));
					} else {
						searchParams.set(key, String(value));
					}
				} else {
					searchParams.delete(key);
				}
			});

			// Reset to page 1 when filters change
			searchParams.set("page", "1");

			await goto(`?${searchParams.toString()}`, {
				keepFocus: true,
				replaceState: true,
			});
		} catch (err) {
			console.error("Failed to update facilities:", err);
		} finally {
			clientLoading = false;
		}
	}

	async function handleSearch(event: CustomEvent<{ value: string }>) {
		clientLoading = true;
		try {
			const searchParams = new URLSearchParams($page.url.searchParams);
			const searchValue = event.detail.value || undefined;
			if (searchValue) {
				searchParams.set("search", searchValue);
			} else {
				searchParams.delete("search");
			}
			searchParams.set("page", "1");
			await goto(`?${searchParams.toString()}`, {
				keepFocus: true,
				replaceState: true,
			});
		} catch (err) {
			console.error("Failed to update facilities:", err);
		} finally {
			clientLoading = false;
		}
	}

	async function handlePageChange(event: CustomEvent<{ page: number }>) {
		clientLoading = true;
		try {
			const searchParams = new URLSearchParams($page.url.searchParams);
			searchParams.set("page", event.detail.page.toString());
			await goto(`?${searchParams.toString()}`, {
				keepFocus: true,
				replaceState: true,
			});
		} catch (err) {
			console.error("Failed to update facilities:", err);
		} finally {
			clientLoading = false;
		}
	}

	function handleSelectFacility(event: CustomEvent<{ item: Facility }>) {
		selectedFacility = event.detail.item;
		selectedLocation = null;
		selectedLocationId = null;
		if (selectedFacility?.id) {
			loadFacilityLocations(selectedFacility.id);
		}
	}

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return "Not specified";
		return new Date(dateStr).toLocaleDateString();
	}

	function formatContacts(contacts: any) {
		if (!contacts || typeof contacts !== "object") return [];
		return Object.entries(contacts).map(([key, value]) => ({ key, value }));
	}

	function formatParking(parking: any) {
		if (!parking || typeof parking !== "object") return [];
		return Object.entries(parking).map(([key, value]) => ({ key, value }));
	}

	function getTypeColor(type: string | undefined) {
		switch (type?.toLowerCase()) {
			case "hospital":
				return "badge-error";
			case "school":
				return "badge-info";
			case "community center":
				return "badge-success";
			case "performance venue":
				return "badge-secondary";
			case "senior center":
				return "badge-warning";
			default:
				return "badge-neutral";
		}
	}

	function getFacilityTitle(item: any): string {
		return item.name || "Unnamed Facility";
	}

	function getFacilitySubtitle(item: any): string {
		return item.address || "No address specified";
	}

	function getFacilityDetail(item: any): string {
		const type = item.type || "Unknown type";
		const locationCount = item.locations?.[0]?.count || 0;
		return `${type} • ${locationCount} location${locationCount !== 1 ? "s" : ""}`;
	}

	// Facility modals
	function openCreateFacilityModal() {
		isCreateFacilityModalOpen = true;
	}

	function handleFacilityCreated(event: CustomEvent<{ facility: Facility }>) {
		selectedFacility = event.detail.facility;
		isCreateFacilityModalOpen = false;
		console.log(
			"Facility created successfully:",
			event.detail.facility.name,
		);
	}

	function openDeleteFacilityModal() {
		if (selectedFacility) {
			isDeleteFacilityModalOpen = true;
		}
	}

	function handleFacilityDeleteSuccess() {
		selectedFacility = null;
		facilityLocations = [];
		isDeleteFacilityModalOpen = false;
		console.log("Facility deleted successfully");
	}

	// Location modals
	function openCreateLocationModal() {
		if (selectedFacility) {
			isCreateLocationModalOpen = true;
		}
	}

	async function handleLocationCreated(
		event: CustomEvent<{ location: Location }>,
	) {
		if (selectedFacility?.id) {
			await loadFacilityLocations(selectedFacility.id);
		}
		isCreateLocationModalOpen = false;
		console.log(
			"Location created successfully:",
			event.detail.location.name,
		);
	}

	function openDeleteLocationModal(location: Location) {
		selectedLocation = location;
		isDeleteLocationModalOpen = true;
	}

	async function handleLocationDeleteSuccess() {
		if (selectedFacility?.id) {
			await loadFacilityLocations(selectedFacility.id);
		}
		selectedLocation = null;
		selectedLocationId = null; // Reset location context if deleted location was selected
		isDeleteLocationModalOpen = false;
		console.log("Location deleted successfully");
	}

	// Inline editing functions
	async function updateFacilityField(field: string, value: any) {
		if (!selectedFacility?.id) return;

		try {
			// Validate the field
			const fieldSchema =
				updateFacilitySchema.shape[
					field as keyof typeof updateFacilitySchema.shape
				];
			if (fieldSchema) {
				fieldSchema.parse(value);
			}

			// Prepare update data
			const updateData: any = { [field]: value === "" ? null : value };

			// Special handling for contacts and parking
			if (field === "contacts" || field === "parking") {
				// These are handled separately
				return;
			}

			// Update facility
			const updatedFacility = await facilitiesStore.update(
				selectedFacility.id,
				updateData,
			);
			selectedFacility = updatedFacility;

			// Refresh facilities list if needed
			await updateUrlAndFetch({});

			// Reload upcoming events count
			if (selectedFacility?.id) {
				await loadUpcomingEventsCount(selectedFacility.id);
			}
		} catch (error) {
			if (error instanceof z.ZodError) {
				throw new Error(
					error.errors[0]?.message || "Validation failed",
				);
			}
			throw error;
		}
	}

	async function updateLocationField(
		locationId: number,
		field: string,
		value: any,
	) {
		try {
			// Validate the field
			const fieldSchema =
				updateLocationSchema.shape[
					field as keyof typeof updateLocationSchema.shape
				];
			if (fieldSchema) {
				fieldSchema.parse(value);
			}

			// Prepare update data
			const updateData: any = { [field]: value === "" ? null : value };

			// Update location
			await locationsStore.update(locationId, updateData);

			// Reload locations for the facility
			if (selectedFacility?.id) {
				loadFacilityLocations(selectedFacility.id);
			}
		} catch (error) {
			if (error instanceof z.ZodError) {
				throw new Error(
					error.errors[0]?.message || "Validation failed",
				);
			}
			throw error;
		}
	}

	async function updateFacilityContact(
		contactKey: string,
		contactValue: string,
	) {
		if (!selectedFacility?.id) return;

		const contacts =
			selectedFacility.contacts &&
			typeof selectedFacility.contacts === "object"
				? { ...selectedFacility.contacts }
				: {};

		if (contactValue.trim() === "") {
			// Remove contact if value is empty
			delete contacts[contactKey];
		} else {
			contacts[contactKey] = contactValue.trim();
		}

		const updateData =
			Object.keys(contacts).length > 0
				? { contacts }
				: { contacts: null };
		const updatedFacility = await facilitiesStore.update(
			selectedFacility.id,
			updateData,
		);
		selectedFacility = updatedFacility;
		await updateUrlAndFetch({});
	}

	async function addFacilityContact() {
		if (!selectedFacility?.id) return;

		const contacts =
			selectedFacility.contacts &&
			typeof selectedFacility.contacts === "object"
				? { ...selectedFacility.contacts }
				: {};

		const newKey = `contact_${Date.now()}`;
		contacts[newKey] = "";

		const updatedFacility = await facilitiesStore.update(
			selectedFacility.id,
			{ contacts },
		);
		selectedFacility = updatedFacility;
		await updateUrlAndFetch({});
	}

	async function removeFacilityContact(contactKey: string) {
		if (!selectedFacility?.id) return;

		const contacts =
			selectedFacility.contacts &&
			typeof selectedFacility.contacts === "object"
				? { ...selectedFacility.contacts }
				: {};

		delete contacts[contactKey];

		const updateData =
			Object.keys(contacts).length > 0
				? { contacts }
				: { contacts: null };
		const updatedFacility = await facilitiesStore.update(
			selectedFacility.id,
			updateData,
		);
		selectedFacility = updatedFacility;
		await updateUrlAndFetch({});
	}

	async function updateFacilityParking(
		parkingKey: string,
		parkingValue: string,
	) {
		if (!selectedFacility?.id) return;

		const parking =
			selectedFacility.parking &&
			typeof selectedFacility.parking === "object"
				? { ...selectedFacility.parking }
				: {};

		if (parkingValue.trim() === "") {
			delete parking[parkingKey];
		} else {
			parking[parkingKey] = parkingValue.trim();
		}

		const updateData =
			Object.keys(parking).length > 0 ? { parking } : { parking: null };
		const updatedFacility = await facilitiesStore.update(
			selectedFacility.id,
			updateData,
		);
		selectedFacility = updatedFacility;
		await updateUrlAndFetch({});
	}

	async function addFacilityParking() {
		if (!selectedFacility?.id) return;

		const parking =
			selectedFacility.parking &&
			typeof selectedFacility.parking === "object"
				? { ...selectedFacility.parking }
				: {};

		const newKey = `parking_${Date.now()}`;
		parking[newKey] = "";

		const updatedFacility = await facilitiesStore.update(
			selectedFacility.id,
			{ parking },
		);
		selectedFacility = updatedFacility;
		await updateUrlAndFetch({});
	}

	async function removeFacilityParking(parkingKey: string) {
		if (!selectedFacility?.id) return;

		const parking =
			selectedFacility.parking &&
			typeof selectedFacility.parking === "object"
				? { ...selectedFacility.parking }
				: {};

		delete parking[parkingKey];

		const updateData =
			Object.keys(parking).length > 0 ? { parking } : { parking: null };
		const updatedFacility = await facilitiesStore.update(
			selectedFacility.id,
			updateData,
		);
		selectedFacility = updatedFacility;
		await updateUrlAndFetch({});
	}

	async function toggleLocationAttribute(
		locationId: number,
		attribute: string,
	) {
		try {
			const location = facilityLocations.find((l) => l.id === locationId);
			if (!location) return;

			const attributes =
				location.attributes && typeof location.attributes === "object"
					? { ...location.attributes }
					: {};

			// Toggle the attribute
			if (attributes[attribute]) {
				delete attributes[attribute];
			} else {
				attributes[attribute] = true;
			}

			await locationsStore.update(locationId, { attributes });

			// Reload locations
			if (selectedFacility?.id) {
				loadFacilityLocations(selectedFacility.id);
			}
		} catch (error) {
			console.error("Failed to toggle location attribute:", error);
		}
	}

	// Facility type options
	const facilityTypes = [
		{ value: "Healing Arts", label: "Healing Arts" },
		{ value: "Performance", label: "Performance" },
		{ value: "Community", label: "Community" },
		{ value: "Education", label: "Education" },
		{ value: "Conference", label: "Conference" },
		{ value: "Workshop", label: "Workshop" },
		{ value: "Other", label: "Other" },
	];
</script>

<ErrorBoundary>
	<div class="h-full flex flex-col overflow-hidden">
		<!-- Scrollable Content Area -->
		<div class="flex-1 p-4 min-h-0 flex flex-col">
			<div class="flex-1 min-h-0">
				<MasterDetail
					items={facilities as any}
					selectedItem={selectedFacility as any}
					loading={clientLoading}
					searchPlaceholder="Search facilities..."
					searchValue={currentFilters.search || ""}
					masterTitle="Facilities"
					getItemTitle={getFacilityTitle}
					getItemSubtitle={getFacilitySubtitle}
					getItemDetail={getFacilityDetail}
					detailEmptyIcon="🏢"
					detailEmptyTitle="Select a facility"
					detailEmptyMessage="Choose a facility from the list to view its details and locations"
					storageKey="phwb-selected-facility"
					on:search={handleSearch}
					on:select={handleSelectFacility}
				>
					{#snippet masterActions()}
						<button
							class="btn btn-primary btn-xs"
							onclick={openCreateFacilityModal}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-3 w-3 mr-1"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 4v16m8-8H4"
								/>
							</svg>
							Add
						</button>
					{/snippet}
					{#snippet filters()}
						<FacilitiesFilters
							filters={currentFilters as FacilityFilters}
							lookupData={data.lookupData}
							onFiltersChange={handleFiltersChange}
						/>
					{/snippet}
					{#snippet children(props)}
						{@const facility = props.item as Facility}
						{#if facility}
							<div class="overflow-y-auto h-full">
								<!-- Header Card -->
								<FacilityHeaderCard
									{facility}
									{facilityTypes}
									locationCount={facilityLocations.length}
									{upcomingEventsCount}
									onUpdateField={updateFacilityField}
								/>

								<!-- Tabs Section -->
								<FacilityTabs
									{facility}
									locations={facilityLocations}
									{selectedLocationId}
									onSelectLocation={handleSelectLocationContext}
									onDelete={openDeleteFacilityModal}
								/>
							</div>
						{/if}
					{/snippet}
				</MasterDetail>
			</div>
		</div>
	</div>

	<!-- Facility Modals -->
	<CreateFacility
		open={isCreateFacilityModalOpen}
		on:close={() => (isCreateFacilityModalOpen = false)}
		on:success={handleFacilityCreated}
	/>

	<DeleteFacility
		open={isDeleteFacilityModalOpen}
		facility={selectedFacility}
		on:close={() => (isDeleteFacilityModalOpen = false)}
		on:success={handleFacilityDeleteSuccess}
	/>

	<!-- Location Modals -->
	<CreateLocation
		open={isCreateLocationModalOpen}
		facilityId={selectedFacility?.id}
		on:close={() => (isCreateLocationModalOpen = false)}
		on:success={handleLocationCreated}
	/>

	<DeleteLocation
		open={isDeleteLocationModalOpen}
		location={selectedLocation}
		on:close={() => {
			isDeleteLocationModalOpen = false;
			selectedLocation = null;
		}}
		on:success={handleLocationDeleteSuccess}
	/>
</ErrorBoundary>
