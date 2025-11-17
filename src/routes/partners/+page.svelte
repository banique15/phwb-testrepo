<script lang="ts">
	import { onMount } from "svelte";
	import { get } from "svelte/store";
	import { Handshake } from "lucide-svelte";
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { partnersStore } from "$lib/stores/partners";
	import type { Partner } from "$lib/schemas/partner";
	import { updatePartnerSchema } from "$lib/schemas/partner";
	import { z } from "zod";
	import { supabase } from "$lib/supabase";
	import ErrorBoundary from "$lib/components/ui/ErrorBoundary.svelte";
	import MasterDetail from "$lib/components/ui/MasterDetail.svelte";
	import PartnerHeaderCard from "./components/PartnerHeaderCard.svelte";
	import PartnerTabs from "./components/PartnerTabs.svelte";
	import CreatePartner from "./components/modals/CreatePartner.svelte";
	import DeletePartner from "./components/modals/DeletePartner.svelte";
	import PartnersFilters from "./components/PartnersFilters.svelte";

	interface Props {
		data: {
			partners: Partner[];
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

	let selectedPartner = $state<Partner | null>(null);
	let isCreateModalOpen = $state(false);
	let isDeleteModalOpen = $state(false);
	let clientLoading = $state(false);
	let partnerFacilitiesCount = $state(0);
	let partnerEventsCount = $state(0);

	// Sorting and filtering state (with localStorage persistence)
	const STORAGE_KEY_SORT = "phwb-partners-sort";
	const STORAGE_KEY_FILTER = "phwb-partners-organization-filter";
	const STORAGE_KEY_LAST_OPENED = "phwb-partners-last-opened";

	let sortBy = $state<string>("last_opened");
	let sortOrder = $state<"asc" | "desc">("desc");
	let organizationFilter = $state<string>("");

	// Use derived state to avoid infinite loops
	let partners = $derived(data.partners);
	let pagination = $derived(data.pagination);
	let currentFilters = $derived(data.filters);
	let performanceMetrics = $derived(data.performance);

	// Keep selected partner in sync with updated data
	$effect(() => {
		if (selectedPartner?.id && partners.length > 0) {
			const partnerId = selectedPartner.id;
			const updatedPartner = partners.find((p) => p.id === partnerId);
			if (updatedPartner && updatedPartner !== selectedPartner) {
				selectedPartner = updatedPartner;
			}
		}
	});

	// Get last opened timestamps from localStorage
	function getLastOpenedTimestamps(): Record<string, number> {
		if (typeof window === "undefined") return {};
		try {
			const stored = localStorage.getItem(STORAGE_KEY_LAST_OPENED);
			return stored ? JSON.parse(stored) : {};
		} catch {
			return {};
		}
	}

	// Track when a partner is opened
	function trackPartnerOpened(partnerId: number) {
		if (typeof window === "undefined") return;
		try {
			const timestamps = getLastOpenedTimestamps();
			timestamps[String(partnerId)] = Date.now();
			localStorage.setItem(
				STORAGE_KEY_LAST_OPENED,
				JSON.stringify(timestamps),
			);
		} catch (err) {
			console.error("Failed to track partner opened:", err);
		}
	}

	// Get unique organizations from partners
	let uniqueOrganizations = $derived.by(() => {
		const orgs = new Set<string>();
		partners.forEach((p) => {
			if (p.organization && p.organization.trim()) {
				orgs.add(p.organization);
			}
		});
		return Array.from(orgs).sort();
	});

	// Filter and sort partners client-side
	let filteredAndSortedPartners = $derived.by(() => {
		let result = [...partners];

		// Apply organization filter
		if (organizationFilter) {
			result = result.filter(
				(p) => p.organization === organizationFilter,
			);
		}

		// Apply sorting
		const lastOpened = getLastOpenedTimestamps();

		if (sortBy === "last_opened") {
			result.sort((a, b) => {
				const aTime = a.id ? lastOpened[String(a.id)] || 0 : 0;
				const bTime = b.id ? lastOpened[String(b.id)] || 0 : 0;
				return sortOrder === "desc" ? bTime - aTime : aTime - bTime;
			});
		} else if (sortBy === "name") {
			result.sort((a, b) => {
				const aName = (a.name || "").toLowerCase();
				const bName = (b.name || "").toLowerCase();
				if (sortOrder === "asc") {
					return aName.localeCompare(bName);
				} else {
					return bName.localeCompare(aName);
				}
			});
		}

		return result;
	});

	function handleSortChange(newSortBy: string, newSortOrder: "asc" | "desc") {
		sortBy = newSortBy;
		sortOrder = newSortOrder;
		if (typeof window !== "undefined") {
			localStorage.setItem(
				STORAGE_KEY_SORT,
				JSON.stringify({ sortBy, sortOrder }),
			);
		}
	}

	function handleOrganizationFilterChange(filter: string) {
		organizationFilter = filter;
		if (typeof window !== "undefined") {
			localStorage.setItem(STORAGE_KEY_FILTER, filter);
		}
	}

	onMount(() => {
		// Load sort and filter preferences from localStorage
		if (typeof window !== "undefined") {
			try {
				const savedSort = localStorage.getItem(STORAGE_KEY_SORT);
				if (savedSort) {
					const parsed = JSON.parse(savedSort);
					if (parsed.sortBy) sortBy = parsed.sortBy;
					if (parsed.sortOrder) sortOrder = parsed.sortOrder;
				}

				const savedFilter = localStorage.getItem(STORAGE_KEY_FILTER);
				if (savedFilter) {
					organizationFilter = savedFilter;
				}
			} catch (err) {
				console.error("Failed to load preferences:", err);
			}
		}

		// Restore selected partner from localStorage on initial client-side mount
		const storageKey = "phwb-selected-partner";
		const savedId = localStorage.getItem(storageKey);
		if (savedId && data.partners.length > 0) {
			const savedPartner = data.partners.find(
				(partner) => String(partner.id) === savedId,
			);
			if (savedPartner) {
				selectedPartner = savedPartner;
				if (savedPartner.id) {
					loadPartnerCounts(savedPartner.id);
					trackPartnerOpened(savedPartner.id);
				}
			}
		}

		// Subscribe to real-time changes for new/updated partners
		partnersStore.subscribe(() => {
			// Handle real-time updates if needed
		});
	});

	// Client-side navigation for search and pagination
	async function updateUrlAndFetch(
		newFilters: Partial<typeof currentFilters>,
	) {
		clientLoading = true;

		try {
			// Update URL with new parameters
			const searchParams = new URLSearchParams($page.url.searchParams);

			Object.entries({ ...currentFilters, ...newFilters }).forEach(
				([key, value]) => {
					if (value !== undefined && value !== null && value !== "") {
						if (Array.isArray(value)) {
							searchParams.set(key, value.join(","));
						} else {
							searchParams.set(key, String(value));
						}
					} else {
						searchParams.delete(key);
					}
				},
			);

			// Navigate to the new URL, which will trigger server load function
			await goto(`?${searchParams.toString()}`, {
				keepFocus: true,
				replaceState: true,
			});
		} catch (err) {
			console.error("Failed to update partners:", err);
		} finally {
			clientLoading = false;
		}
	}

	async function handleSearch(event: CustomEvent<{ value: string }>) {
		await updateUrlAndFetch({
			search: event.detail.value || undefined,
			page: 1, // Reset to first page when searching
		});
	}

	async function handlePageChange(event: CustomEvent<{ page: number }>) {
		await updateUrlAndFetch({
			page: event.detail.page,
		});
	}

	async function handleSelectPartner(event: CustomEvent<{ item: Partner }>) {
		const partnerFromList = event.detail.item;

		// Check if there's a more recent version in the store
		let latestPartner = partnerFromList;
		if (partnerFromList?.id) {
			// Get the latest version from the store if available
			const storeState = get(partnersStore);
			const storePartner = storeState.items.find(
				(p) => p.id === partnerFromList.id,
			);
			if (storePartner) {
				latestPartner = storePartner;
			}
		}

		selectedPartner = latestPartner;
		if (selectedPartner?.id) {
			trackPartnerOpened(selectedPartner.id);
			await loadPartnerCounts(selectedPartner.id);
		}
	}

	async function loadPartnerCounts(partnerId: number) {
		try {
			// Load facilities count
			const { count: facilitiesCount, error: facilitiesError } =
				await supabase
					.from("phwb_facilities")
					.select("*", { count: "exact", head: true })
					.eq("partner", partnerId);

			if (facilitiesError) {
				console.error(
					"Error loading partner facilities count:",
					facilitiesError,
				);
			} else {
				partnerFacilitiesCount = facilitiesCount || 0;
			}

			// Load events count (through programs - events don't have direct partner_id)
			// First get programs for this partner, then count events in those programs
			const { data: programs, error: programsError } = await supabase
				.from("phwb_programs")
				.select("id")
				.eq("partner", partnerId);

			if (programsError) {
				console.error("Error loading partner programs:", programsError);
				partnerEventsCount = 0;
			} else if (programs && programs.length > 0) {
				const programIds = programs.map((p) => p.id);
				const { count: eventsCount, error: eventsError } =
					await supabase
						.from("phwb_events")
						.select("*", { count: "exact", head: true })
						.in("program", programIds);

				if (eventsError) {
					console.error(
						"Error loading partner events count:",
						eventsError,
					);
				} else {
					partnerEventsCount = eventsCount || 0;
				}
			} else {
				partnerEventsCount = 0;
			}
		} catch (err) {
			console.error("Failed to load partner counts:", err);
		}
	}

	async function updatePartnerField(field: string, value: any) {
		if (!selectedPartner?.id) return;

		try {
			// Validate the field
			const fieldSchema =
				updatePartnerSchema.shape[
					field as keyof typeof updatePartnerSchema.shape
				];
			if (fieldSchema) {
				fieldSchema.parse(value);
			}

			// Prepare update data
			const updateData: any = { [field]: value === "" ? null : value };

			// Update partner
			const updatedPartner = await partnersStore.update(
				selectedPartner.id,
				updateData,
			);
			selectedPartner = updatedPartner;

			// Refresh the page data
			await updateUrlAndFetch({});
		} catch (error) {
			if (error instanceof z.ZodError) {
				throw new Error(
					error.errors[0]?.message || "Validation failed",
				);
			}
			throw error;
		}
	}

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return "Not specified";
		return new Date(dateStr).toLocaleDateString();
	}

	// MasterDetail configuration functions
	function getPartnerTitle(item: any): string {
		return item.name || "Unnamed Partner";
	}

	function getPartnerSubtitle(item: any): string {
		// Try to show primary contact name with title, otherwise organization
		if (
			item.contacts &&
			Array.isArray(item.contacts) &&
			item.contacts.length > 0
		) {
			const primaryContact =
				item.contacts.find((c: any) => c.isPrimary) || item.contacts[0];
			if (primaryContact.name) {
				return primaryContact.title
					? `${primaryContact.name} - ${primaryContact.title}`
					: primaryContact.name;
			}
		}
		return item.organization || "No organization";
	}

	function getPartnerDetail(item: any): string {
		return item.description
			? item.description.substring(0, 100) +
					(item.description.length > 100 ? "..." : "")
			: "";
	}

	function openCreateModal() {
		isCreateModalOpen = true;
	}

	function closeCreateModal() {
		isCreateModalOpen = false;
	}

	async function handlePartnerCreated(event: CustomEvent<{ partner: any }>) {
		// The partner will be automatically added to the store by the create function
		// We can optionally select the newly created partner
		selectedPartner = event.detail.partner;

		// Close the modal
		isCreateModalOpen = false;

		// Load counts for the new partner
		if (selectedPartner?.id) {
			await loadPartnerCounts(selectedPartner.id);
		}

		// Refresh the page data to ensure we have the latest list
		await updateUrlAndFetch({});
	}

	function openDeleteModal() {
		if (selectedPartner) {
			isDeleteModalOpen = true;
		}
	}

	function closeDeleteModal() {
		isDeleteModalOpen = false;
	}

	function handleDeleteSuccess() {
		// Clear the selected partner since it was deleted
		selectedPartner = null;

		// Close the modal
		isDeleteModalOpen = false;

		// Refresh the page data to ensure we have the latest list
		updateUrlAndFetch({});
	}

	async function handlePartnerUpdate(updatedPartner: Partner) {
		// Update the selected partner with the new data
		selectedPartner = updatedPartner;

		// Refresh the page data to ensure we have the latest list
		await updateUrlAndFetch({});
	}
</script>

<ErrorBoundary>
	<div class="h-full flex flex-col overflow-hidden">
		<!-- Scrollable Content Area -->
		<div class="flex-1 min-h-0 flex flex-col">
			<div class="flex-1 min-h-0">
				<MasterDetail
					items={filteredAndSortedPartners as any}
					selectedItem={selectedPartner as any}
					loading={clientLoading}
					searchPlaceholder="Search partners..."
					searchValue={currentFilters.search || ""}
					masterTitle="Partners"
					getItemTitle={getPartnerTitle}
					getItemSubtitle={getPartnerSubtitle}
					getItemDetail={getPartnerDetail}
					detailEmptyIcon={Handshake}
					detailEmptyTitle="Select a partner"
					detailEmptyMessage="Choose a partner from the list to view their full profile"
					storageKey="phwb-selected-partner"
					on:search={handleSearch}
					on:select={handleSelectPartner}
				>
					{#snippet masterActions()}
						<button
							class="btn btn-primary btn-xs"
							onclick={openCreateModal}
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
						<PartnersFilters
							{sortBy}
							{sortOrder}
							{organizationFilter}
							organizations={uniqueOrganizations}
							onSortChange={handleSortChange}
							onOrganizationFilterChange={handleOrganizationFilterChange}
						/>
					{/snippet}
					{#snippet children(props)}
						{@const partner = props.item as Partner}
						{#if partner}
							<div class="flex flex-col h-full overflow-hidden">
								<!-- Header Card -->
								<div class="flex-none">
									<PartnerHeaderCard
										{partner}
										facilitiesCount={partnerFacilitiesCount}
										eventsCount={partnerEventsCount}
										onUpdateField={updatePartnerField}
									/>
								</div>

								<!-- Tabs Section -->
								<div class="flex-1 min-h-0 overflow-y-auto">
									<PartnerTabs
										{partner}
										onDelete={openDeleteModal}
										onUpdate={handlePartnerUpdate}
									/>
								</div>
							</div>
						{/if}
					{/snippet}
				</MasterDetail>
			</div>
		</div>
	</div>

	<!-- Create Partner Modal -->
	<CreatePartner
		open={isCreateModalOpen}
		on:close={closeCreateModal}
		on:submit={handlePartnerCreated}
	/>

	<!-- Delete Partner Modal -->
	<DeletePartner
		open={isDeleteModalOpen}
		partner={selectedPartner}
		onClose={closeDeleteModal}
		onSuccess={handleDeleteSuccess}
	/>
</ErrorBoundary>
