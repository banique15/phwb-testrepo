<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { partnersStore } from '$lib/stores/partners'
	import type { Partner } from '$lib/schemas/partner'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import PageHeader from '$lib/components/ui/PageHeader.svelte'
	import MasterDetail from '$lib/components/ui/MasterDetail.svelte'
	import CreatePartner from './components/modals/CreatePartner.svelte'
	import DeletePartner from './components/modals/DeletePartner.svelte'

	interface Props {
		data: {
			partners: Partner[]
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

	let selectedPartner = $state<Partner | null>(null)
	let isCreateModalOpen = $state(false)
	let isDeleteModalOpen = $state(false)
	let clientLoading = $state(false)
	let isInlineEditing = $state(false)
	let editFormData = $state<any>({})
	let isSubmittingEdit = $state(false)
	let editErrors = $state<Record<string, string>>({})

	// Use derived state to avoid infinite loops
	let partners = $derived(data.partners)
	let pagination = $derived(data.pagination)
	let currentFilters = $derived(data.filters)
	let performanceMetrics = $derived(data.performance)

	onMount(() => {
		// Restore selected partner from localStorage on initial client-side mount
		const storageKey = 'phwb-selected-partner'
		const savedId = localStorage.getItem(storageKey)
		if (savedId && data.partners.length > 0) {
			const savedPartner = data.partners.find(partner => String(partner.id) === savedId)
			if (savedPartner) {
				selectedPartner = savedPartner
			}
		}

		// Subscribe to real-time changes for new/updated partners
		partnersStore.subscribe(() => {
			// Handle real-time updates if needed
		})
		
		// Log performance metrics in development
		if (import.meta.env.DEV) {
			console.log('Partners page performance:', performanceMetrics)
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
			console.error('Failed to update partners:', err)
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

	function handleSelectPartner(event: CustomEvent<{ item: Partner }>) {
		selectedPartner = event.detail.item
	}

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		return new Date(dateStr).toLocaleDateString()
	}

	// MasterDetail configuration functions
	function getPartnerTitle(item: any): string {
		return item.name || 'Unnamed Partner'
	}

	function getPartnerSubtitle(item: any): string {
		// Try to show primary contact name with title, otherwise organization
		if (item.contacts && Array.isArray(item.contacts) && item.contacts.length > 0) {
			const primaryContact = item.contacts.find((c: any) => c.isPrimary) || item.contacts[0]
			if (primaryContact.name) {
				return primaryContact.title
					? `${primaryContact.name} - ${primaryContact.title}`
					: primaryContact.name
			}
		}
		return item.organization || 'No organization'
	}

	function getPartnerDetail(item: any): string {
		return item.description ? item.description.substring(0, 100) + (item.description.length > 100 ? '...' : '') : ''
	}

	function openCreateModal() {
		isCreateModalOpen = true
	}

	function closeCreateModal() {
		isCreateModalOpen = false
	}

	function handlePartnerCreated(event: CustomEvent<{ partner: any }>) {
		// The partner will be automatically added to the store by the create function
		// We can optionally select the newly created partner
		selectedPartner = event.detail.partner
		
		// Close the modal
		isCreateModalOpen = false
		
		// Refresh the page data to ensure we have the latest list
		updateUrlAndFetch({})
		
		console.log('Partner created successfully:', event.detail.partner.name)
	}


	function openDeleteModal() {
		if (selectedPartner) {
			isDeleteModalOpen = true
		}
	}

	function closeDeleteModal() {
		isDeleteModalOpen = false
	}

	function handleDeleteSuccess() {
		// Clear the selected partner since it was deleted
		selectedPartner = null
		
		// Close the modal
		isDeleteModalOpen = false
		
		// Refresh the page data to ensure we have the latest list
		updateUrlAndFetch({})
		
		console.log('Partner deleted successfully')
	}

	// Inline editing functions
	function startInlineEdit() {
		if (selectedPartner) {
			isInlineEditing = true
			editFormData = {
				name: selectedPartner.name || '',
				organization: selectedPartner.organization || '',
				description: selectedPartner.description || '',
				website: selectedPartner.website || '',
				logo: selectedPartner.logo || ''
			}
			editErrors = {}
		}
	}

	function cancelInlineEdit() {
		isInlineEditing = false
		editFormData = {}
		editErrors = {}
	}

	async function saveInlineEdit() {
		if (!selectedPartner) return

		isSubmittingEdit = true
		editErrors = {}

		try {
			// Prepare the data for update (excluding contacts - they should be managed separately)
			const updateData = {
				name: editFormData.name,
				organization: editFormData.organization,
				description: editFormData.description,
				website: editFormData.website,
				logo: editFormData.logo
			}

			// Remove empty strings and convert to undefined
			Object.keys(updateData).forEach(key => {
				if (typeof updateData[key] === 'string' && updateData[key].trim() === '') {
					updateData[key] = undefined
				}
			})

			const updatedPartner = await partnersStore.update(selectedPartner.id!, updateData)
			selectedPartner = updatedPartner
			isInlineEditing = false

			// Refresh the page data to ensure we have the latest list
			updateUrlAndFetch({})

			console.log('Partner updated successfully:', updatedPartner.name)
		} catch (error) {
			console.error('Failed to update partner:', error)
			editErrors.general = 'Failed to update partner. Please try again.'
		} finally {
			isSubmittingEdit = false
		}
	}
</script>

<ErrorBoundary>
	<div class="flex flex-col h-full">
		<!-- Fixed Page Header -->
		<div class="sticky top-0 z-30 flex-none px-4 py-2 bg-base-100 border-b border-base-200 shadow-sm">
			<PageHeader
				title="Partners"
				subtitle="Manage partnership and sponsor relationships"
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
						Add Partner
					</button>
				{/snippet}
			</PageHeader>
		</div>
		
		<!-- Scrollable Content Area -->
		<div class="flex-1 p-6 min-h-0">
			<MasterDetail
				items={partners as any}
				selectedItem={selectedPartner as any}
				loading={clientLoading}
				searchPlaceholder="Search partners..."
				searchValue={currentFilters.search || ''}
				masterTitle="Partners"
				getItemTitle={getPartnerTitle}
				getItemSubtitle={getPartnerSubtitle}
				getItemDetail={getPartnerDetail}
				detailEmptyIcon="🤝"
				detailEmptyTitle="Select a partner"
				detailEmptyMessage="Choose a partner from the list to view their full profile"
				storageKey="phwb-selected-partner"
				on:search={handleSearch}
				on:select={handleSelectPartner}
			>
				{#snippet children(props)}
					{@const partner = props.item}
					{#if partner}
						<div class="overflow-y-auto h-full">
							<div class="flex items-start justify-between mb-6">
								<div>
									<h2 class="card-title text-2xl">
										{partner.name || 'Unnamed Partner'}
									</h2>
									{#if partner.organization}
										<p class="text-lg opacity-70">{partner.organization}</p>
									{/if}
								</div>
							<div class="flex gap-2">
								{#if isInlineEditing}
									<button 
										class="btn btn-sm btn-primary"
										onclick={saveInlineEdit}
										disabled={isSubmittingEdit}
										title="Save changes"
									>
										{#if isSubmittingEdit}
											<span class="loading loading-spinner loading-sm"></span>
										{:else}
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
										{/if}
										Save
									</button>
									<button 
										class="btn btn-sm btn-outline"
										onclick={cancelInlineEdit}
										disabled={isSubmittingEdit}
										title="Cancel editing"
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
										Cancel
									</button>
								{:else}
									<button 
										class="btn btn-sm btn-outline"
										onclick={startInlineEdit}
										title="Edit partner information"
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
										</svg>
										Edit
									</button>
									<button 
										class="btn btn-sm btn-outline btn-error"
										onclick={openDeleteModal}
										title="Delete partner"
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
										Delete
									</button>
								{/if}
							</div>
						</div>

						{#if editErrors.general}
							<div class="alert alert-error mb-4">
								<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span>{editErrors.general}</span>
							</div>
						{/if}

						<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
							<!-- Basic Information -->
							<div class="space-y-4">
								<h3 class="text-lg font-semibold border-b pb-2">Basic Information</h3>
								<div class="space-y-3">
									<div>
										{#if isInlineEditing}
											<label class="text-sm font-medium opacity-70" for="partner-name">Partner Name</label>
											<input 
												id="partner-name"
												type="text" 
												class="input input-bordered input-sm w-full"
												bind:value={editFormData.name}
												placeholder="Enter partner name"
											/>
										{:else}
											<p class="text-sm font-medium opacity-70">Partner Name</p>
											<p class="text-base">{partner.name || 'Not specified'}</p>
										{/if}
									</div>
									<div>
										{#if isInlineEditing}
											<label class="text-sm font-medium opacity-70" for="partner-organization">Organization</label>
											<input 
												id="partner-organization"
												type="text" 
												class="input input-bordered input-sm w-full"
												bind:value={editFormData.organization}
												placeholder="Enter organization name"
											/>
										{:else}
											<p class="text-sm font-medium opacity-70">Organization</p>
											<p class="text-base">{partner.organization || 'Not specified'}</p>
										{/if}
									</div>
									<div>
										{#if isInlineEditing}
											<label class="text-sm font-medium opacity-70" for="partner-website">Website</label>
											<input 
												id="partner-website"
												type="url" 
												class="input input-bordered input-sm w-full"
												bind:value={editFormData.website}
												placeholder="https://partner-website.com"
											/>
										{:else}
											<p class="text-sm font-medium opacity-70">Website</p>
											{#if partner.website}
												<a href={partner.website} target="_blank" class="link link-primary text-base">
													{partner.website}
												</a>
											{:else}
												<p class="text-base">Not specified</p>
											{/if}
										{/if}
									</div>
									<div>
										<p class="text-sm font-medium opacity-70">Created</p>
										<p class="text-base">{formatDate(partner.created_at)}</p>
									</div>
								</div>
							</div>

							<!-- Contact Information -->
							<div class="space-y-4">
								<h3 class="text-lg font-semibold border-b pb-2">Contact Information</h3>
								<div class="space-y-3">
									{#if isInlineEditing}
										<p class="text-sm opacity-70 italic">Note: Edit contacts in the create/edit modal for full contact management</p>
									{:else}
										{#if partner.contacts && Array.isArray(partner.contacts) && partner.contacts.length > 0}
											<div class="space-y-4">
												{#each partner.contacts as contact, index}
													<div class="card bg-base-200 p-3">
														<div class="flex items-center gap-2 mb-2">
															<p class="font-semibold text-sm">
																{contact.name || 'Unnamed Contact'}
															</p>
															{#if contact.isPrimary}
																<span class="badge badge-primary badge-xs">Primary</span>
															{/if}
														</div>
														{#if contact.title}
															<p class="text-xs opacity-70 mb-2">{contact.title}</p>
														{/if}
														<div class="space-y-1">
															{#if contact.email}
																<div class="flex items-center gap-2 text-sm">
																	<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
																	</svg>
																	<a href={`mailto:${contact.email}`} class="link link-primary text-xs">{contact.email}</a>
																</div>
															{/if}
															{#if contact.phone}
																<div class="flex items-center gap-2 text-sm">
																	<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
																	</svg>
																	<span class="text-xs">{contact.phone}</span>
																</div>
															{/if}
															{#if contact.address}
																<div class="flex items-start gap-2 text-sm">
																	<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 opacity-60 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
																		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
																	</svg>
																	<span class="text-xs">{contact.address}</span>
																</div>
															{/if}
														</div>
													</div>
												{/each}
											</div>
										{:else}
											<p class="text-base opacity-70">No contact information available</p>
										{/if}
									{/if}
								</div>
							</div>

							<!-- Description -->
							<div class="md:col-span-2 space-y-4">
								<h3 class="text-lg font-semibold border-b pb-2">Description</h3>
								<div>
									{#if isInlineEditing}
										<textarea 
											class="textarea textarea-bordered textarea-sm w-full h-24"
											bind:value={editFormData.description}
											placeholder="Brief description of the partner and partnership"
										></textarea>
									{:else}
										<p class="text-base whitespace-pre-wrap">{partner.description || 'No description provided'}</p>
									{/if}
								</div>
							</div>

							<!-- Logo -->
							{#if isInlineEditing || partner.logo}
								<div class="md:col-span-2 space-y-4">
									<h3 class="text-lg font-semibold border-b pb-2">Logo</h3>
									<div>
									{#if isInlineEditing}
										<div class="space-y-2">
											<label class="text-sm font-medium opacity-70" for="partner-logo-url">Logo URL</label>
											<input 
												id="partner-logo-url"
												type="url" 
												class="input input-bordered input-sm w-full"
												bind:value={editFormData.logo}
												placeholder="https://example.com/logo.png"
											/>
										</div>
										{:else if partner.logo}
											<img
												src={partner.logo}
												alt="Partner logo"
												class="max-w-xs h-auto rounded-lg shadow-md"
												onerror={(e) => {
													const target = e.currentTarget as HTMLImageElement
													const next = target.nextElementSibling as HTMLElement
													target.style.display = 'none'
													if (next) next.style.display = 'block'
												}}
											/>
											<div class="text-sm opacity-60" style="display: none;">
												Logo could not be loaded
											</div>
										{/if}
									</div>
								</div>
							{/if}

							<!-- History -->
							{#if partner.history && typeof partner.history === 'object' && Object.keys(partner.history).length > 0}
								<div class="md:col-span-2 space-y-4">
									<h3 class="text-lg font-semibold border-b pb-2">Partnership History</h3>
									<div class="bg-base-200 p-4 rounded-lg">
										<pre class="text-sm whitespace-pre-wrap">{JSON.stringify(partner.history, null, 2)}</pre>
									</div>
								</div>
							{/if}
						</div>
					</div>
					{/if}
				{/snippet}
			</MasterDetail>
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
