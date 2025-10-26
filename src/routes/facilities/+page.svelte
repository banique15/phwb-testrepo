<script lang="ts">
	import { onMount, onDestroy } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { facilitiesStore } from '$lib/stores/facilities'
	import { getLocationsByFacility } from '$lib/stores/locations'
	import type { Facility } from '$lib/schemas/facility'
	import type { Location } from '$lib/schemas/location'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import PageHeader from '$lib/components/ui/PageHeader.svelte'
	import MasterDetail from '$lib/components/ui/MasterDetail.svelte'
	import CreateFacility from './components/modals/CreateFacility.svelte'
	import EditFacility from './components/modals/EditFacility.svelte'
	import DeleteFacility from './components/modals/DeleteFacility.svelte'
	import CreateLocation from './components/modals/CreateLocation.svelte'
	import EditLocation from './components/modals/EditLocation.svelte'
	import DeleteLocation from './components/modals/DeleteLocation.svelte'

	interface Props {
		data: {
			facilities: Facility[]
			pagination: {
				total: number
				page: number
				limit: number
				totalPages: number
			}
			filters: {
				search?: string
				sortBy: string
				sortOrder: 'asc' | 'desc'
				page?: number
			}
			performance: {
				totalTime: number
				queryTime: number
				itemCount: number
			}
			error?: string
		}
	}

	let { data }: Props = $props()

	let selectedFacility = $state<Facility | null>(null)
	let selectedLocation = $state<Location | null>(null)
	let facilityLocations = $state<Location[]>([])
	let isCreateFacilityModalOpen = $state(false)
	let isEditFacilityModalOpen = $state(false)
	let isDeleteFacilityModalOpen = $state(false)
	let isCreateLocationModalOpen = $state(false)
	let isEditLocationModalOpen = $state(false)
	let isDeleteLocationModalOpen = $state(false)
	let clientLoading = $state(false)

	// Use derived state to avoid infinite loops
	let facilities = $derived(data.facilities)
	let pagination = $derived(data.pagination)
	let currentFilters = $derived(data.filters)
	let performanceMetrics = $derived(data.performance)

	onMount(() => {
		// Restore selected facility from localStorage
		const storageKey = 'phwb-selected-facility'
		const savedId = localStorage.getItem(storageKey)
		if (savedId && data.facilities.length > 0) {
			const savedFacility = data.facilities.find(facility => String(facility.id) === savedId)
			if (savedFacility) {
				selectedFacility = savedFacility
				loadFacilityLocations(savedFacility.id!)
			}
		}

		// Subscribe to real-time changes
		let realtimeSubscription = facilitiesStore.subscribeToChanges()

		onDestroy(() => {
			if (realtimeSubscription) {
				facilitiesStore.unsubscribeFromChanges()
			}
		})

		if (import.meta.env.DEV) {
			console.log('Facilities page performance:', performanceMetrics)
		}
	})

	async function loadFacilityLocations(facilityId: number) {
		try {
			facilityLocations = await getLocationsByFacility(facilityId)
		} catch (err) {
			console.error('Failed to load facility locations:', err)
			facilityLocations = []
		}
	}

	async function updateUrlAndFetch(newFilters: Partial<typeof currentFilters>) {
		clientLoading = true

		try {
			const searchParams = new URLSearchParams($page.url.searchParams)

			Object.entries({ ...currentFilters, ...newFilters }).forEach(([key, value]) => {
				if (value !== undefined && value !== null && value !== '') {
					if (Array.isArray(value)) {
						searchParams.set(key, value.join(','))
					} else {
						searchParams.set(key, String(value))
					}
				} else {
					searchParams.delete(key)
				}
			})

			await goto(`?${searchParams.toString()}`, {
				keepFocus: true,
				replaceState: true
			})
		} catch (err) {
			console.error('Failed to update facilities:', err)
		} finally {
			clientLoading = false
		}
	}

	async function handleSearch(event: CustomEvent<{ value: string }>) {
		await updateUrlAndFetch({
			search: event.detail.value || undefined,
			page: 1
		})
	}

	async function handlePageChange(event: CustomEvent<{ page: number }>) {
		await updateUrlAndFetch({
			page: event.detail.page
		})
	}

	function handleSelectFacility(event: CustomEvent<{ item: Facility }>) {
		selectedFacility = event.detail.item
		selectedLocation = null
		if (selectedFacility?.id) {
			loadFacilityLocations(selectedFacility.id)
		}
	}

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		return new Date(dateStr).toLocaleDateString()
	}

	function formatContacts(contacts: any) {
		if (!contacts || typeof contacts !== 'object') return []
		return Object.entries(contacts).map(([key, value]) => ({ key, value }))
	}

	function formatParking(parking: any) {
		if (!parking || typeof parking !== 'object') return []
		return Object.entries(parking).map(([key, value]) => ({ key, value }))
	}

	function getTypeColor(type: string | undefined) {
		switch (type?.toLowerCase()) {
			case 'hospital':
				return 'badge-error'
			case 'school':
				return 'badge-info'
			case 'community center':
				return 'badge-success'
			case 'performance venue':
				return 'badge-secondary'
			case 'senior center':
				return 'badge-warning'
			default:
				return 'badge-neutral'
		}
	}

	function getFacilityTitle(item: any): string {
		return item.name || 'Unnamed Facility'
	}

	function getFacilitySubtitle(item: any): string {
		return item.address || 'No address specified'
	}

	function getFacilityDetail(item: any): string {
		const type = item.type || 'Unknown type'
		const locationCount = item.locations?.[0]?.count || 0
		return `${type} • ${locationCount} location${locationCount !== 1 ? 's' : ''}`
	}

	// Facility modals
	function openCreateFacilityModal() {
		isCreateFacilityModalOpen = true
	}

	function handleFacilityCreated(event: CustomEvent<{ facility: Facility }>) {
		selectedFacility = event.detail.facility
		isCreateFacilityModalOpen = false
		console.log('Facility created successfully:', event.detail.facility.name)
	}

	function openEditFacilityModal() {
		if (selectedFacility) {
			isEditFacilityModalOpen = true
		}
	}

	function handleFacilityEditSuccess(event: CustomEvent<{ facility: Facility }>) {
		selectedFacility = event.detail.facility
		console.log('Facility updated successfully:', event.detail.facility.name)
	}

	function openDeleteFacilityModal() {
		if (selectedFacility) {
			isDeleteFacilityModalOpen = true
		}
	}

	function handleFacilityDeleteSuccess() {
		selectedFacility = null
		facilityLocations = []
		isDeleteFacilityModalOpen = false
		console.log('Facility deleted successfully')
	}

	// Location modals
	function openCreateLocationModal() {
		if (selectedFacility) {
			isCreateLocationModalOpen = true
		}
	}

	function handleLocationCreated(event: CustomEvent<{ location: Location }>) {
		if (selectedFacility?.id) {
			loadFacilityLocations(selectedFacility.id)
		}
		isCreateLocationModalOpen = false
		console.log('Location created successfully:', event.detail.location.name)
	}

	function selectLocation(location: Location) {
		selectedLocation = location
		isEditLocationModalOpen = true
	}

	function handleLocationEditSuccess(event: CustomEvent<{ location: Location }>) {
		if (selectedFacility?.id) {
			loadFacilityLocations(selectedFacility.id)
		}
		selectedLocation = null
		console.log('Location updated successfully:', event.detail.location.name)
	}

	function openDeleteLocationModal(location: Location) {
		selectedLocation = location
		isDeleteLocationModalOpen = true
	}

	function handleLocationDeleteSuccess() {
		if (selectedFacility?.id) {
			loadFacilityLocations(selectedFacility.id)
		}
		selectedLocation = null
		isDeleteLocationModalOpen = false
		console.log('Location deleted successfully')
	}
</script>

<ErrorBoundary>
	<div class="h-full flex flex-col overflow-hidden">
		<!-- Fixed Page Header -->
		<div class="flex-none px-6 pt-4 pb-4 bg-base-100 border-b border-base-200">
			<PageHeader
				title="Facilities"
				subtitle="Manage facilities and their specific locations"
			>
				{#snippet actions()}
					{#if import.meta.env.DEV && performanceMetrics}
						<div class="btn btn-ghost btn-sm text-xs opacity-60" title="Server load time">
							⚡ {performanceMetrics.totalTime}ms
						</div>
					{/if}
					<button class="btn btn-primary" onclick={openCreateFacilityModal}>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Add Facility
					</button>
				{/snippet}
			</PageHeader>
		</div>

		<!-- Scrollable Content Area -->
		<div class="flex-1 p-6 min-h-0 flex flex-col">
			<div class="flex-1 min-h-0">
				<MasterDetail
					items={facilities as any}
					selectedItem={selectedFacility as any}
					loading={clientLoading}
					searchPlaceholder="Search facilities..."
					searchValue={currentFilters.search || ''}
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
					{#snippet children(props)}
					{@const facility = props.item}
					{#if facility}
						<div class="overflow-y-auto h-full">
							<div class="flex items-start justify-between mb-6">
								<div>
									<h2 class="card-title text-2xl">
										{facility.name || 'Unnamed Facility'}
									</h2>
									<div class="flex items-center gap-3 mt-2">
										<span class="badge {getTypeColor(facility.type)}">
											{facility.type || 'Unknown Type'}
										</span>
										{#if facility.reference}
											<span class="badge badge-outline">
												{facility.reference}
											</span>
										{/if}
									</div>
								</div>
								<div class="flex gap-2">
									<button
										class="btn btn-sm btn-outline"
										onclick={openEditFacilityModal}
										title="Edit facility information"
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
										</svg>
										Edit
									</button>
									<button
										class="btn btn-sm btn-outline btn-error"
										onclick={openDeleteFacilityModal}
										title="Delete facility"
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
										Delete
									</button>
								</div>
							</div>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
								<!-- Basic Information -->
								<div class="space-y-4">
									<h3 class="text-lg font-semibold border-b-2 border-primary pb-2 text-primary">Basic Information</h3>
									<div class="space-y-3">
										<div>
											<span class="text-sm font-medium opacity-70">Facility Name</span>
											<p class="text-base">{facility.name || 'Not specified'}</p>
										</div>
										<div>
											<span class="text-sm font-medium opacity-70">Type</span>
											<span class="badge {getTypeColor(facility.type)}">
												{facility.type || 'Not specified'}
											</span>
										</div>
										<div>
											<span class="text-sm font-medium opacity-70">Reference</span>
											<p class="text-base">{facility.reference || 'Not specified'}</p>
										</div>
										<div>
											<span class="text-sm font-medium opacity-70">Address</span>
											<p class="text-base">{facility.address || 'Not specified'}</p>
										</div>
										<div>
											<span class="text-sm font-medium opacity-70">Created</span>
											<p class="text-base">{formatDate(facility.created_at)}</p>
										</div>
									</div>
								</div>

								<!-- Contact Information -->
								<div class="space-y-4">
									<h3 class="text-lg font-semibold border-b-2 border-accent pb-2 text-accent">Contact Information</h3>
									<div class="space-y-3">
										{#if facility.contacts && formatContacts(facility.contacts).length > 0}
											{#each formatContacts(facility.contacts) as contact}
												<div>
													<span class="text-sm font-medium opacity-70 capitalize">{contact.key}</span>
													<p class="text-base">{contact.value}</p>
												</div>
											{/each}
										{:else}
											<p class="text-base opacity-70">No contact information available</p>
										{/if}
									</div>
								</div>

								<!-- Description -->
								<div class="md:col-span-2 space-y-4">
									<h3 class="text-lg font-semibold border-b-2 border-secondary pb-2 text-secondary">Description</h3>
									<div>
										<p class="text-base whitespace-pre-wrap">{facility.description || 'No description provided'}</p>
									</div>
								</div>

								<!-- Facility Image -->
								{#if facility.image}
									<div class="md:col-span-2 space-y-4">
										<h3 class="text-lg font-semibold border-b-2 border-info pb-2 text-info">Facility Image</h3>
										<div>
											<img src={facility.image} alt={`${facility.name || 'Facility'}`} class="max-w-full h-auto rounded-lg shadow-md" />
										</div>
									</div>
								{/if}

								<!-- Parking Information -->
								{#if facility.parking}
									<div class="md:col-span-2 space-y-4">
										<h3 class="text-lg font-semibold border-b-2 border-warning pb-2 text-warning">Parking Information</h3>
										<div class="bg-base-200 p-4 rounded-lg">
											{#if formatParking(facility.parking).length > 0}
												<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
													{#each formatParking(facility.parking) as parking}
														<div>
															<span class="text-sm font-medium opacity-70 capitalize">{parking.key}</span>
															<p class="text-base">{parking.value}</p>
														</div>
													{/each}
												</div>
											{:else}
												<p class="text-base opacity-70">No parking information available</p>
											{/if}
										</div>
									</div>
								{/if}

								<!-- Locations within this Facility -->
								<div class="md:col-span-2 space-y-4">
									<div class="flex items-center justify-between">
										<h3 class="text-lg font-semibold border-b-2 border-success pb-2 text-success">Locations</h3>
										<button
											class="btn btn-sm btn-success"
											onclick={openCreateLocationModal}
											title="Add a new location to this facility"
										>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
											</svg>
											Add Location
										</button>
									</div>
									{#if facilityLocations.length > 0}
										<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
											{#each facilityLocations as location}
												<div class="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer" onclick={() => selectLocation(location)}>
													<div class="card-body p-4">
														<div class="flex items-start justify-between">
															<div class="flex-1">
																<h4 class="font-semibold">{location.name}</h4>
																{#if location.floor}
																	<p class="text-sm opacity-70">Floor: {location.floor}</p>
																{/if}
																{#if location.capacity}
																	<p class="text-sm opacity-70">Capacity: {location.capacity}</p>
																{/if}
																{#if location.description}
																	<p class="text-sm mt-2">{location.description}</p>
																{/if}
																{#if location.attributes && typeof location.attributes === 'object' && Object.keys(location.attributes).length > 0}
																	<div class="flex flex-wrap gap-1 mt-2">
																		{#if location.attributes.power}
																			<span class="badge badge-xs badge-outline">⚡ Power</span>
																		{/if}
																		{#if location.attributes.wifi}
																			<span class="badge badge-xs badge-outline">📶 WiFi</span>
																		{/if}
																		{#if location.attributes.soundSystem}
																			<span class="badge badge-xs badge-outline">🔊 Sound</span>
																		{/if}
																		{#if location.attributes.projector}
																			<span class="badge badge-xs badge-outline">📽️ Projector</span>
																		{/if}
																		{#if location.attributes.hvac}
																			<span class="badge badge-xs badge-outline">❄️ HVAC</span>
																		{/if}
																		{#if location.attributes.wheelchairAccess}
																			<span class="badge badge-xs badge-outline">♿ Wheelchair</span>
																		{/if}
																		{#if location.attributes.elevator}
																			<span class="badge badge-xs badge-outline">🛗 Elevator</span>
																		{/if}
																		{#if location.attributes.naturalLight}
																			<span class="badge badge-xs badge-outline">☀️ Natural Light</span>
																		{/if}
																		{#if location.attributes.adjustableLighting}
																			<span class="badge badge-xs badge-outline">💡 Adjustable Light</span>
																		{/if}
																		{#if location.attributes.storage}
																			<span class="badge badge-xs badge-outline">📦 Storage</span>
																		{/if}
																	</div>
																{/if}
															</div>
															<div class="flex gap-1">
																<button
																	class="btn btn-xs btn-ghost"
																	onclick={(e) => { e.stopPropagation(); openDeleteLocationModal(location); }}
																	title="Delete location"
																>
																	<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
																	</svg>
																</button>
															</div>
														</div>
													</div>
												</div>
											{/each}
										</div>
									{:else}
										<div class="alert alert-info">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											<span>No locations have been added to this facility yet. Click "Add Location" to create one.</span>
										</div>
									{/if}
								</div>
							</div>
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
		on:close={() => isCreateFacilityModalOpen = false}
		on:success={handleFacilityCreated}
	/>

	<EditFacility
		open={isEditFacilityModalOpen}
		facility={selectedFacility}
		on:close={() => isEditFacilityModalOpen = false}
		on:success={handleFacilityEditSuccess}
	/>

	<DeleteFacility
		open={isDeleteFacilityModalOpen}
		facility={selectedFacility}
		on:close={() => isDeleteFacilityModalOpen = false}
		on:success={handleFacilityDeleteSuccess}
	/>

	<!-- Location Modals -->
	<CreateLocation
		open={isCreateLocationModalOpen}
		facilityId={selectedFacility?.id}
		on:close={() => isCreateLocationModalOpen = false}
		on:success={handleLocationCreated}
	/>

	<EditLocation
		open={isEditLocationModalOpen}
		location={selectedLocation}
		on:close={() => { isEditLocationModalOpen = false; selectedLocation = null; }}
		on:success={handleLocationEditSuccess}
	/>

	<DeleteLocation
		open={isDeleteLocationModalOpen}
		location={selectedLocation}
		on:close={() => { isDeleteLocationModalOpen = false; selectedLocation = null; }}
		on:success={handleLocationDeleteSuccess}
	/>
</ErrorBoundary>
