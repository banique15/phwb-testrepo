<script lang="ts">
	import { onMount } from 'svelte'
	import { facilityTypesStore } from '$lib/stores/facilityTypes'
	import { locationTypesStore } from '$lib/stores/locationTypes'
	import type { FacilityType } from '$lib/schemas/facilityType'
	import type { LocationType } from '$lib/schemas/locationType'
	import CreateFacilityType from './modals/CreateFacilityType.svelte'
	import CreateLocationType from './modals/CreateLocationType.svelte'
	import DeleteFacilityType from './modals/DeleteFacilityType.svelte'
	import DeleteLocationType from './modals/DeleteLocationType.svelte'

	let activeTab = $state<'facility' | 'location'>('facility')
	let showCreateFacilityType = $state(false)
	let showCreateLocationType = $state(false)
	let editingFacilityType: FacilityType | null = $state(null)
	let editingLocationType: LocationType | null = $state(null)
	let deletingFacilityType: FacilityType | null = $state(null)
	let deletingLocationType: LocationType | null = $state(null)

	let facilityTypes = $state<FacilityType[]>([])
	let locationTypes = $state<LocationType[]>([])
	let loadingFacilityTypes = $state(false)
	let loadingLocationTypes = $state(false)

	onMount(() => {
		loadFacilityTypes()
		loadLocationTypes()
	})

	async function loadFacilityTypes() {
		loadingFacilityTypes = true
		try {
			const result = await facilityTypesStore.fetchAll({ limit: 1000 })
			facilityTypes = result.data
		} catch (error) {
			console.error('Failed to load facility types:', error)
		} finally {
			loadingFacilityTypes = false
		}
	}

	async function loadLocationTypes() {
		loadingLocationTypes = true
		try {
			const result = await locationTypesStore.fetchAll({ limit: 1000 })
			locationTypes = result.data
		} catch (error) {
			console.error('Failed to load location types:', error)
		} finally {
			loadingLocationTypes = false
		}
	}

	function handleCreateFacilityType() {
		editingFacilityType = null
		showCreateFacilityType = true
	}

	function handleEditFacilityType(type: FacilityType) {
		editingFacilityType = type
		showCreateFacilityType = true
	}

	function handleDeleteFacilityType(type: FacilityType) {
		deletingFacilityType = type
	}

	function handleCreateLocationType() {
		editingLocationType = null
		showCreateLocationType = true
	}

	function handleEditLocationType(type: LocationType) {
		editingLocationType = type
		showCreateLocationType = true
	}

	function handleDeleteLocationType(type: LocationType) {
		deletingLocationType = type
	}

	function handleFacilityTypeSuccess() {
		showCreateFacilityType = false
		editingFacilityType = null
		loadFacilityTypes()
	}

	function handleLocationTypeSuccess() {
		showCreateLocationType = false
		editingLocationType = null
		loadLocationTypes()
	}

	function handleFacilityTypeDeleted() {
		deletingFacilityType = null
		loadFacilityTypes()
	}

	function handleLocationTypeDeleted() {
		deletingLocationType = null
		loadLocationTypes()
	}
</script>

<div class="space-y-4">
	<!-- Tab Navigation -->
	<div class="tabs tabs-boxed">
		<button
			class="tab {activeTab === 'facility' ? 'tab-active' : ''}"
			onclick={() => activeTab = 'facility'}
		>
			Facility Types
		</button>
		<button
			class="tab {activeTab === 'location' ? 'tab-active' : ''}"
			onclick={() => activeTab = 'location'}
		>
			Location Types
		</button>
	</div>

	<!-- Facility Types Tab -->
	{#if activeTab === 'facility'}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<h3 class="text-lg font-semibold">Facility Types</h3>
				<button class="btn btn-primary btn-sm" onclick={handleCreateFacilityType}>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
					Add Facility Type
				</button>
			</div>

			{#if loadingFacilityTypes}
				<div class="flex justify-center py-8">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{:else if facilityTypes.length === 0}
				<div class="text-center py-8 text-base-content/60">
					<p>No facility types found. Create one to get started.</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="table table-zebra">
						<thead>
							<tr>
								<th>Name</th>
								<th>Description</th>
								<th>Status</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each facilityTypes as type}
								<tr>
									<td class="font-medium">{type.name}</td>
									<td class="text-sm opacity-75">{type.description || '—'}</td>
									<td>
										{#if type.active}
											<span class="badge badge-success badge-sm">Active</span>
										{:else}
											<span class="badge badge-error badge-sm">Inactive</span>
										{/if}
									</td>
									<td>
										<div class="flex gap-2">
											<button
												class="btn btn-ghost btn-xs"
												onclick={() => handleEditFacilityType(type)}
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
												</svg>
											</button>
											<button
												class="btn btn-ghost btn-xs text-error"
												onclick={() => handleDeleteFacilityType(type)}
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
												</svg>
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Location Types Tab -->
	{#if activeTab === 'location'}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<h3 class="text-lg font-semibold">Location Types</h3>
				<button class="btn btn-primary btn-sm" onclick={handleCreateLocationType}>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
					Add Location Type
				</button>
			</div>

			{#if loadingLocationTypes}
				<div class="flex justify-center py-8">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{:else if locationTypes.length === 0}
				<div class="text-center py-8 text-base-content/60">
					<p>No location types found. Create one to get started.</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="table table-zebra">
						<thead>
							<tr>
								<th>Name</th>
								<th>Description</th>
								<th>Status</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each locationTypes as type}
								<tr>
									<td class="font-medium">{type.name}</td>
									<td class="text-sm opacity-75">{type.description || '—'}</td>
									<td>
										{#if type.active}
											<span class="badge badge-success badge-sm">Active</span>
										{:else}
											<span class="badge badge-error badge-sm">Inactive</span>
										{/if}
									</td>
									<td>
										<div class="flex gap-2">
											<button
												class="btn btn-ghost btn-xs"
												onclick={() => handleEditLocationType(type)}
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
												</svg>
											</button>
											<button
												class="btn btn-ghost btn-xs text-error"
												onclick={() => handleDeleteLocationType(type)}
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
												</svg>
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Modals -->
<CreateFacilityType
	open={showCreateFacilityType}
	facilityType={editingFacilityType}
	on:close={() => { showCreateFacilityType = false; editingFacilityType = null }}
	on:success={handleFacilityTypeSuccess}
/>

<CreateLocationType
	open={showCreateLocationType}
	locationType={editingLocationType}
	on:close={() => { showCreateLocationType = false; editingLocationType = null }}
	on:success={handleLocationTypeSuccess}
/>

<DeleteFacilityType
	open={deletingFacilityType !== null}
	facilityType={deletingFacilityType}
	on:close={() => deletingFacilityType = null}
	on:success={handleFacilityTypeDeleted}
/>

<DeleteLocationType
	open={deletingLocationType !== null}
	locationType={deletingLocationType}
	on:close={() => deletingLocationType = null}
	on:success={handleLocationTypeDeleted}
/>
