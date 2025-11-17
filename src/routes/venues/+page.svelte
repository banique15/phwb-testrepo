<script lang="ts">
	import { onMount, onDestroy } from 'svelte'
	import { Landmark } from 'lucide-svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { venuesStore } from '$lib/stores/venues'
	import type { Venue } from '$lib/schemas/venue'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import PageHeader from '$lib/components/ui/PageHeader.svelte'
	import MasterDetail from '$lib/components/ui/MasterDetail.svelte'
	import CreateVenue from './components/modals/CreateVenue.svelte'
	import EditVenue from './components/modals/EditVenue.svelte'
	import DeleteVenue from './components/modals/DeleteVenue.svelte'

	interface Props {
		data: {
			venues: Venue[]
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

	let selectedVenue = $state<Venue | null>(null)
	let isCreateModalOpen = $state(false)
	let isEditModalOpen = $state(false)
	let isDeleteModalOpen = $state(false)
	let clientLoading = $state(false)

	// Use derived state to avoid infinite loops
	let venues = $derived(data.venues)
	let pagination = $derived(data.pagination)
	let currentFilters = $derived(data.filters)
	let performanceMetrics = $derived(data.performance)

	onMount(() => {
		// Restore selected venue from localStorage on initial client-side mount
		const storageKey = 'phwb-selected-venue'
		const savedId = localStorage.getItem(storageKey)
		if (savedId && data.venues.length > 0) {
			const savedVenue = data.venues.find(venue => String(venue.id) === savedId)
			if (savedVenue) {
				selectedVenue = savedVenue
			}
		}

		// Subscribe to real-time changes for new/updated venues
		let realtimeSubscription = venuesStore.subscribeToChanges()

		// Cleanup subscription on component destroy
		onDestroy(() => {
			if (realtimeSubscription) {
				venuesStore.unsubscribeFromChanges()
			}
		})

		// Log performance metrics in development
		if (import.meta.env.DEV) {
			console.log('Venues page performance:', performanceMetrics)
		}
	})

	// Client-side navigation for search and pagination
	async function updateUrlAndFetch(newFilters: Partial<typeof currentFilters>) {
		clientLoading = true
		
		try {
			// Update URL with new parameters
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

			// Navigate to the new URL, which will trigger server load function
			await goto(`?${searchParams.toString()}`, { 
				keepFocus: true,
				replaceState: true
			})
		} catch (err) {
			console.error('Failed to update venues:', err)
		} finally {
			clientLoading = false
		}
	}

	async function handleSearch(event: CustomEvent<{ value: string }>) {
		await updateUrlAndFetch({
			search: event.detail.value || undefined,
			page: 1 // Reset to first page when searching
		})
	}

	async function handlePageChange(event: CustomEvent<{ page: number }>) {
		await updateUrlAndFetch({
			page: event.detail.page
		})
	}

	function handleSelectVenue(event: CustomEvent<{ item: Venue }>) {
		selectedVenue = event.detail.item
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
			case 'healing arts':
				return 'badge-success'
			case 'performance':
				return 'badge-secondary'
			case 'community':
				return 'badge-accent'
			case 'education':
				return 'badge-info'
			case 'conference':
				return 'badge-warning'
			case 'workshop':
				return 'badge-primary'
			default:
				return 'badge-neutral'
		}
	}

	// MasterDetail configuration functions
	function getVenueTitle(item: any): string {
		return item.name || 'Unnamed Venue'
	}

	function getVenueSubtitle(item: any): string {
		return item.address || 'No address specified'
	}

	function getVenueDetail(item: any): string {
		const type = item.type || 'Unknown type'
		const reference = item.reference ? ` • ${item.reference}` : ''
		return `${type}${reference}`
	}

	function openCreateModal() {
		isCreateModalOpen = true
	}

	function closeCreateModal() {
		isCreateModalOpen = false
	}

	function handleVenueCreated(event: CustomEvent<{ venue: any }>) {
		// The venue will be automatically added to the store by the create function
		// We can optionally select the newly created venue
		selectedVenue = event.detail.venue
		
		// Close the modal
		isCreateModalOpen = false
		
		console.log('Venue created successfully:', event.detail.venue.name)
	}

	function openEditModal() {
		if (selectedVenue) {
			isEditModalOpen = true
		}
	}

	function closeEditModal() {
		isEditModalOpen = false
	}

	function handleEditSuccess(event: CustomEvent<{ venue: Venue }>) {
		// Update the selected venue with the updated data
		selectedVenue = event.detail.venue
		
		// The store will handle the update automatically
		console.log('Venue updated successfully:', event.detail.venue.name)
	}

	function openDeleteModal() {
		if (selectedVenue) {
			isDeleteModalOpen = true
		}
	}

	function closeDeleteModal() {
		isDeleteModalOpen = false
	}

	function handleDeleteSuccess() {
		// Clear the selected venue since it was deleted
		selectedVenue = null
		
		// Close the modal
		isDeleteModalOpen = false
		
		console.log('Venue deleted successfully')
	}
</script>

<ErrorBoundary>
	<div class="h-full flex flex-col overflow-hidden">
		<!-- Fixed Page Header -->
		<div class="sticky top-0 z-30 flex-none px-4 py-2 bg-base-100 border-b border-base-200 shadow-sm">
			<PageHeader
				title="Venues"
				subtitle="Manage venue information and locations"
			>
				{#snippet actions()}
					<!-- Performance indicator (development only) -->
					{#if import.meta.env.DEV && performanceMetrics}
						<div class="btn btn-ghost btn-sm text-xs opacity-60" title="Server load time">
							⚡ {performanceMetrics.totalTime}ms
						</div>
					{/if}
					<button class="btn btn-primary" onclick={openCreateModal}>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Add Venue
					</button>
				{/snippet}
			</PageHeader>
		</div>

		<!-- Scrollable Content Area -->
		<div class="flex-1 p-6 min-h-0 flex flex-col ">
			<div class="flex-1 min-h-0">
				<MasterDetail
					items={venues as any}
					selectedItem={selectedVenue as any}
					loading={clientLoading}
					searchPlaceholder="Search venues..."
					searchValue={currentFilters.search || ''}
					masterTitle="Venues"
					getItemTitle={getVenueTitle}
					getItemSubtitle={getVenueSubtitle}
					getItemDetail={getVenueDetail}
					detailEmptyIcon={Landmark}
					detailEmptyTitle="Select a venue"
					detailEmptyMessage="Choose a venue from the list to view its full information"
					storageKey="phwb-selected-venue"
					on:search={handleSearch}
					on:select={handleSelectVenue}
				>
					{#snippet children(props)}
					{@const venue = props.item}
					{#if venue}
						<div class="overflow-y-auto h-full">
							<div class="flex items-start justify-between mb-6">
								<div>
									<h2 class="card-title text-2xl">
										{venue.name || 'Unnamed Venue'}
									</h2>
									<div class="flex items-center gap-3 mt-2">
										<span class="badge {getTypeColor(venue.type)}">
											{venue.type || 'Unknown Type'}
										</span>
										{#if venue.reference}
											<span class="badge badge-outline">
												{venue.reference}
											</span>
										{/if}
									</div>
								</div>
								<div class="flex gap-2">
									<button 
										class="btn btn-sm btn-outline"
										onclick={openEditModal}
										title="Edit venue information"
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
										</svg>
										Edit
									</button>
									<button 
										class="btn btn-sm btn-outline btn-error"
										onclick={openDeleteModal}
										title="Delete venue"
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
											<span class="text-sm font-medium opacity-70">Venue Name</span>
											<p class="text-base {!venue.name ? 'border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1 inline-block' : ''}">{venue.name || 'Not specified'}</p>
										</div>
										<div>
											<span class="text-sm font-medium opacity-70">Type</span>
											<span class="badge {getTypeColor(venue.type)} {!venue.type ? 'border border-yellow-400 dark:border-yellow-600' : ''}">
												{venue.type || 'Not specified'}
											</span>
										</div>
										<div>
											<span class="text-sm font-medium opacity-70">Reference</span>
											<p class="text-base {!venue.reference ? 'border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1 inline-block' : ''}">{venue.reference || 'Not specified'}</p>
										</div>
										<div>
											<span class="text-sm font-medium opacity-70">Address</span>
											<p class="text-base {!venue.address ? 'border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1 inline-block' : ''}">{venue.address || 'Not specified'}</p>
										</div>
										<div>
											<span class="text-sm font-medium opacity-70">Created</span>
											<p class="text-base">{formatDate(venue.created_at)}</p>
										</div>
									</div>
								</div>

								<!-- Contact Information -->
								<div class="space-y-4">
									<h3 class="text-lg font-semibold border-b-2 border-accent pb-2 text-accent">Contact Information</h3>
									<div class="space-y-3">
										{#if venue.contacts && formatContacts(venue.contacts).length > 0}
											{#each formatContacts(venue.contacts) as contact}
												<div>
													<span class="text-sm font-medium opacity-70 capitalize">{contact.key}</span>
													<p class="text-base {!contact.value ? 'border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1 inline-block' : ''}">{contact.value || 'Not specified'}</p>
												</div>
											{/each}
										{:else}
											<p class="text-base opacity-70 border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1 inline-block">No contact information available</p>
										{/if}
									</div>
								</div>

								<!-- Description -->
								<div class="md:col-span-2 space-y-4">
									<h3 class="text-lg font-semibold border-b-2 border-secondary pb-2 text-secondary">Description</h3>
									<div>
										<p class="text-base whitespace-pre-wrap {!venue.description ? 'border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1 inline-block' : ''}">{venue.description || 'No description provided'}</p>
									</div>
								</div>

								<!-- Venue Image -->
								{#if venue.image}
									<div class="md:col-span-2 space-y-4">
										<h3 class="text-lg font-semibold border-b-2 border-info pb-2 text-info">Venue Image</h3>
										<div>
											<img src={venue.image} alt={`${venue.name || 'Venue'}`} class="max-w-full h-auto rounded-lg shadow-md" />
										</div>
									</div>
								{/if}

								<!-- Parking Information -->
								{#if venue.parking}
									<div class="md:col-span-2 space-y-4">
										<h3 class="text-lg font-semibold border-b-2 border-warning pb-2 text-warning">Parking Information</h3>
										<div class="bg-base-200 p-4 rounded-lg">
											{#if formatParking(venue.parking).length > 0}
												<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
													{#each formatParking(venue.parking) as parking}
														<div>
															<span class="text-sm font-medium opacity-70 capitalize">{parking.key}</span>
															<p class="text-base {!parking.value ? 'border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1 inline-block' : ''}">{parking.value || 'Not specified'}</p>
														</div>
													{/each}
												</div>
											{:else}
												<p class="text-base opacity-70 border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1 inline-block">No parking information available</p>
											{/if}
										</div>
									</div>
								{/if}

								<!-- Venue Features -->
								<div class="md:col-span-2 space-y-4">
									<h3 class="text-lg font-semibold border-b-2 border-success pb-2 text-success">Venue Features</h3>
									<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
										<div class="stat bg-base-200 rounded-lg p-4">
											<div class="stat-title text-xs">Type</div>
											<div class="stat-value text-sm">{venue.type || 'Unknown'}</div>
										</div>
										<div class="stat bg-base-200 rounded-lg p-4">
											<div class="stat-title text-xs">Reference</div>
											<div class="stat-value text-sm">{venue.reference || 'None'}</div>
										</div>
										<div class="stat bg-base-200 rounded-lg p-4">
											<div class="stat-title text-xs">Contact Available</div>
											<div class="stat-value text-sm">{venue.contacts ? 'Yes' : 'No'}</div>
										</div>
										<div class="stat bg-base-200 rounded-lg p-4">
											<div class="stat-title text-xs">Parking Info</div>
											<div class="stat-value text-sm">{venue.parking ? 'Available' : 'Unknown'}</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}
				{/snippet}
			</MasterDetail>
			</div>
		</div>
	</div>

	<!-- Create Venue Modal -->
	<CreateVenue 
		open={isCreateModalOpen}
		on:close={closeCreateModal}
		on:success={handleVenueCreated}
	/>

	<!-- Edit Venue Modal -->
	<EditVenue 
		open={isEditModalOpen}
		venue={selectedVenue}
		on:close={closeEditModal}
		on:success={handleEditSuccess}
	/>

	<!-- Delete Venue Modal -->
	<DeleteVenue
		open={isDeleteModalOpen}
		venue={selectedVenue}
		on:close={closeDeleteModal}
		on:success={handleDeleteSuccess}
	/>
</ErrorBoundary>