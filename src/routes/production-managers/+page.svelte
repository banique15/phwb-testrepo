<script lang="ts">
	import { onMount } from 'svelte'
	import { invalidateAll } from '$app/navigation'
	import { page } from '$app/stores'
	import { User } from 'lucide-svelte'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import MasterDetail from '$lib/components/ui/MasterDetail.svelte'
	import { supabase } from '$lib/supabase'
	import {
		productionManagersStore,
		updateProductionManager,
		type ProductionManager
	} from '$lib/stores/productionManagers'
	import { updateProductionManagerSchema } from '$lib/schemas/productionManager'
	import { z } from 'zod'
	import { normalizePhoneForDB } from '$lib/utils/phone'

	interface PageData {
		productionManagers: ProductionManager[]
	}

	interface Props {
		data: PageData
	}

	let { data }: Props = $props()

	let selectedManager = $state<ProductionManager | null>(null)
	let clientLoading = $state(false)

	let searchQuery = $state('')

	let managers = $state<ProductionManager[]>(data.productionManagers)

	$effect(() => {
		managers = data.productionManagers
	})

	let filteredManagers = $derived.by(() => {
		let result = [...managers]

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase()
			result = result.filter(pm => {
				if (pm.full_name?.toLowerCase().includes(query)) return true
				if (pm.legal_first_name?.toLowerCase().includes(query)) return true
				if (pm.legal_last_name?.toLowerCase().includes(query)) return true
				if (pm.email?.toLowerCase().includes(query)) return true
				if (pm.phone?.toLowerCase().includes(query)) return true
				if (pm.location?.toLowerCase().includes(query)) return true
				return false
			})
		}

		return result
	})

	onMount(() => {
		;(async () => {
			const urlPmId = $page.url.searchParams.get('id')
			if (urlPmId && data.productionManagers.length > 0) {
				let urlPm = data.productionManagers.find(pm => pm.id === urlPmId)

				if (!urlPm) {
					const { data: fetchedPm } = await supabase
						.from('phwb_production_managers')
						.select('*')
						.eq('id', urlPmId)
						.single()

					if (fetchedPm) {
						urlPm = fetchedPm as ProductionManager
					}
				}

				if (urlPm) {
					selectedManager = urlPm
					productionManagersStore.subscribeToChanges({
						onInsert: (payload) => {
							const newPm = payload.new as ProductionManager
							if (!managers.some(p => p.id === newPm.id)) {
								managers = [newPm, ...managers]
							}
						},
						onUpdate: (payload) => {
							const updatedPm = payload.new as ProductionManager
							managers = managers.map(p => p.id === updatedPm.id ? updatedPm : p)
							if (selectedManager?.id === updatedPm.id) {
								selectedManager = updatedPm
							}
						},
						onDelete: (payload) => {
							const deletedId = (payload.old as ProductionManager).id
							managers = managers.filter(p => p.id !== deletedId)
							if (selectedManager?.id === deletedId) {
								selectedManager = null
							}
						}
					})
					return
				}
			}

			productionManagersStore.subscribeToChanges({
				onInsert: (payload) => {
					const newPm = payload.new as ProductionManager
					if (!managers.some(p => p.id === newPm.id)) {
						managers = [newPm, ...managers]
					}
				},
				onUpdate: (payload) => {
					const updatedPm = payload.new as ProductionManager
					managers = managers.map(p => p.id === updatedPm.id ? updatedPm : p)
					if (selectedManager?.id === updatedPm.id) {
						selectedManager = updatedPm
					}
				},
				onDelete: (payload) => {
					const deletedId = (payload.old as ProductionManager).id
					managers = managers.filter(p => p.id !== deletedId)
					if (selectedManager?.id === deletedId) {
						selectedManager = null
					}
				}
			})
		})()

		return () => {
			productionManagersStore.unsubscribeFromChanges()
		}
	})

	function handleSearch(event: CustomEvent<{ value: string }>) {
		searchQuery = event.detail.value
	}

	async function handleSelect(event: CustomEvent<{ item: ProductionManager }>) {
		selectedManager = event.detail.item
	}

	async function updateManagerField(field: string, value: any) {
		if (!selectedManager?.id) return

		try {
			const fieldSchema =
				updateProductionManagerSchema.shape[
					field as keyof typeof updateProductionManagerSchema.shape
				]
			if (fieldSchema) {
				fieldSchema.parse(value)
			}

			let updateData: any
			if (Array.isArray(value)) {
				updateData = { [field]: value }
			} else {
				updateData = { [field]: value === "" ? null : value }
			}

			if (field === 'phone' && value) {
				updateData.phone = normalizePhoneForDB(value)
			}

			const updated = await updateProductionManager(selectedManager.id, updateData)
			selectedManager = updated
		} catch (error) {
			if (error instanceof z.ZodError) {
				throw new Error(error.errors[0]?.message || 'Validation failed')
			}
			throw error
		}
	}

	function getPmTitle(item: any): string {
		const fullName =
			item.full_name ||
			(item.legal_first_name && item.legal_last_name
				? `${item.legal_first_name} ${item.legal_last_name}`
				: item.legal_first_name) ||
			'No name'
		return fullName
	}

	function getPmSubtitle(item: any): string {
		const parts: string[] = []
		if (item.location) {
			parts.push(item.location)
		}
		if (item.email) {
			parts.push(item.email)
		}
		return parts.join(' · ')
	}

	function getPmDetail(): string {
		return ''
	}
</script>

<ErrorBoundary>
	<div class="h-full flex flex-col overflow-hidden">
		<div class="flex-1 min-h-0 flex flex-col">
			<div class="flex-1 min-h-0">
				<MasterDetail
					items={filteredManagers as any}
					selectedItem={selectedManager as any}
					loading={clientLoading}
					searchPlaceholder="Search production managers..."
					searchValue={searchQuery}
					masterTitle="Production Managers"
					getItemTitle={getPmTitle}
					getItemSubtitle={getPmSubtitle}
					getItemDetail={getPmDetail}
					detailEmptyIcon={User}
					detailEmptyTitle="Select a production manager"
					detailEmptyMessage="Choose a production manager from the list to view their profile"
					storageKey="phwb-selected-production-manager"
					on:search={handleSearch}
					on:select={handleSelect}
				>
					{#snippet children(props)}
						{@const pm = props.item as ProductionManager}
						{#if pm}
							<div class="overflow-y-auto h-full space-y-4">
								<div class="card bg-base-100 shadow-none">
									<div class="card-body p-4 space-y-3">
										<h2 class="text-2xl font-bold">
											{pm.full_name ||
												(pm.legal_first_name && pm.legal_last_name
													? `${pm.legal_first_name} ${pm.legal_last_name}`
													: pm.legal_first_name) ||
												'Unnamed Production Manager'}
										</h2>
										<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div>
												<div class="text-xs text-base-content/50 uppercase tracking-wide">
													Email
												</div>
												<div class="text-sm">
													{pm.email || 'Not set'}
												</div>
											</div>
											<div>
												<div class="text-xs text-base-content/50 uppercase tracking-wide">
													Phone
												</div>
												<div class="text-sm">
													{pm.phone || 'Not set'}
												</div>
											</div>
											<div>
												<div class="text-xs text-base-content/50 uppercase tracking-wide">
													Location
												</div>
												<div class="text-sm">
													{pm.location || 'Not set'}
												</div>
											</div>
										</div>
										{#if pm.notes}
											<div>
												<div class="text-xs text-base-content/50 uppercase tracking-wide mb-1">
													Notes
												</div>
												<p class="text-sm whitespace-pre-wrap">
													{pm.notes}
												</p>
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
</ErrorBoundary>

