<script lang="ts">
	import { onMount } from 'svelte'
	import { ClipboardList } from 'lucide-svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { programsStore } from '$lib/stores/programs'
	import type { Program } from '$lib/schemas/program'
	import { updateProgramSchema } from '$lib/schemas/program'
	import { z } from 'zod'
	import { supabase } from '$lib/supabase'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import MasterDetail from '$lib/components/ui/MasterDetail.svelte'
	import ProgramHeaderCard from './components/ProgramHeaderCard.svelte'
	import ProgramTabs from './components/ProgramTabs.svelte'
	import CreateProgram from './components/modals/CreateProgram.svelte'
	import DeleteProgram from './components/modals/DeleteProgram.svelte'

	interface Props {
		data: {
			programs: Program[]
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

	let selectedProgram = $state<Program | null>(null)
	let isCreateModalOpen = $state(false)
	let isDeleteModalOpen = $state(false)
	let clientLoading = $state(false)
	let programEventsCount = $state(0)

	// Filter state
	let hideEndedPrograms = $state(false)

	// Use derived state to avoid infinite loops
	let programs = $derived(data.programs)
	let pagination = $derived(data.pagination)
	let currentFilters = $derived(data.filters)
	let performanceMetrics = $derived(data.performance)

	// Filter programs client-side
	let filteredPrograms = $derived.by(() => {
		if (!hideEndedPrograms) return programs

		const now = new Date()
		return programs.filter(program => {
			if (!program.end_date) return true // Keep programs without end date
			const endDate = new Date(program.end_date)
			return endDate >= now // Only show if not ended
		})
	})

	onMount(() => {
		// Restore selected program from localStorage on initial client-side mount
		const storageKey = 'phwb-selected-program'
		const savedId = localStorage.getItem(storageKey)
		if (savedId && data.programs.length > 0) {
			const savedProgram = data.programs.find(program => String(program.id) === savedId)
			if (savedProgram) {
				selectedProgram = savedProgram
				if (savedProgram.id) {
					loadProgramEventsCount(savedProgram.id)
				}
			}
		}

		// Subscribe to real-time changes for new/updated programs
		programsStore.subscribe(() => {
			// Handle real-time updates if needed
		})
		
		// Log performance metrics in development
		if (import.meta.env.DEV) {
			console.log('Programs page performance:', performanceMetrics)
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
			console.error('Failed to update programs:', err)
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

	async function handleSelectProgram(event: CustomEvent<{ item: Program }>) {
		selectedProgram = event.detail.item
		if (selectedProgram?.id) {
			await loadProgramEventsCount(selectedProgram.id)
		}
	}

	async function loadProgramEventsCount(programId: number) {
		try {
			const { count, error } = await supabase
				.from('phwb_events')
				.select('*', { count: 'exact', head: true })
				.eq('program', programId)
			
			if (error) {
				console.error('Error loading program events count:', error)
				programEventsCount = 0
			} else {
				programEventsCount = count || 0
			}
		} catch (err) {
			console.error('Failed to load program events count:', err)
			programEventsCount = 0
		}
	}

	async function updateProgramField(field: string, value: any) {
		if (!selectedProgram?.id) return

		try {
			// Validate the field
			const fieldSchema =
				updateProgramSchema.shape[
					field as keyof typeof updateProgramSchema.shape
				]
			if (fieldSchema) {
				fieldSchema.parse(value)
			}

			// Prepare update data
			const updateData: any = { [field]: value === "" ? null : value }

			// Special handling for partner (convert string to number)
			if (field === 'partner' && value) {
				updateData.partner = Number(value)
			}

			// Update program
			const updatedProgram = await programsStore.update(selectedProgram.id, updateData)
			selectedProgram = updatedProgram

			// Refresh the page data
			await updateUrlAndFetch({})
		} catch (error) {
			if (error instanceof z.ZodError) {
				throw new Error(
					error.errors[0]?.message || "Validation failed",
				)
			}
			throw error
		}
	}

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		return new Date(dateStr).toLocaleDateString()
	}

	function calculateDuration(startDate: string | undefined, endDate: string | undefined) {
		if (!startDate || !endDate) return 'Unknown duration'
		const start = new Date(startDate)
		const end = new Date(endDate)
		const diffTime = Math.abs(end.getTime() - start.getTime())
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
		
		if (diffDays < 30) return `${diffDays} days`
		if (diffDays < 365) return `${Math.round(diffDays / 30)} months`
		return `${Math.round(diffDays / 365)} years`
	}

	function getStatusColor(startDate: string | undefined, endDate: string | undefined) {
		const now = new Date()
		const start = startDate ? new Date(startDate) : null
		const end = endDate ? new Date(endDate) : null
		
		if (start && start > now) return 'badge-info' // Future
		if (end && end < now) return 'badge-neutral' // Completed
		if (start && start <= now && (!end || end >= now)) return 'badge-success' // Active
		return 'badge-outline' // Unknown
	}

	function getStatusText(startDate: string | undefined, endDate: string | undefined) {
		const now = new Date()
		const start = startDate ? new Date(startDate) : null
		const end = endDate ? new Date(endDate) : null
		
		if (start && start > now) return 'Upcoming'
		if (end && end < now) return 'Completed'
		if (start && start <= now && (!end || end >= now)) return 'Active'
		return 'Unknown'
	}

	// MasterDetail configuration functions
	function getProgramTitle(item: any): string {
		return item.title || 'Unnamed Program'
	}

	function getProgramSubtitle(item: any): string {
		return item.geo_coverage || 'No coverage specified'
	}

	function getProgramDetail(item: any): string {
		const status = getStatusText(item.start_date, item.end_date)
		const startDate = item.start_date ? formatDate(item.start_date) : 'No start date'
		return `${status} • ${startDate}`
	}

	function openCreateModal() {
		isCreateModalOpen = true
	}

	function closeCreateModal() {
		isCreateModalOpen = false
	}

	async function handleProgramCreated(event: CustomEvent<{ program: any }>) {
		// The program will be automatically added to the store by the create function
		// We can optionally select the newly created program
		selectedProgram = event.detail.program
		
		// Close the modal
		isCreateModalOpen = false
		
		// Load counts for the new program
		if (selectedProgram?.id) {
			await loadProgramEventsCount(selectedProgram.id)
		}
		
		// Refresh the page data to ensure we have the latest list
		await updateUrlAndFetch({})
		
		console.log('Program created successfully:', event.detail.program.title)
	}

	function openDeleteModal() {
		if (selectedProgram) {
			isDeleteModalOpen = true
		}
	}

	function closeDeleteModal() {
		isDeleteModalOpen = false
	}

	function handleDeleteSuccess() {
		// Clear the selected program since it was deleted
		selectedProgram = null
		
		// Close the modal
		isDeleteModalOpen = false
		
		// Refresh the page data to ensure we have the latest list
		updateUrlAndFetch({})
		
		console.log('Program deleted successfully')
	}
</script>

<ErrorBoundary>
	<div class="h-full flex flex-col overflow-hidden">
		<!-- Scrollable Content Area -->
		<div class="flex-1 min-h-0 flex flex-col">
			<div class="flex-1 min-h-0">
				<MasterDetail
					items={filteredPrograms as any}
					selectedItem={selectedProgram as any}
					loading={clientLoading}
					searchPlaceholder="Search programs..."
					searchValue={currentFilters.search || ''}
					masterTitle="Programs"
					getItemTitle={getProgramTitle}
					getItemSubtitle={getProgramSubtitle}
					getItemDetail={getProgramDetail}
					stackMetaOnSecondRow={true}
					detailEmptyIcon={ClipboardList}
					detailEmptyTitle="Select a program"
					detailEmptyMessage="Choose a program from the list to view its full information"
					storageKey="phwb-selected-program"
					on:search={handleSearch}
					on:select={handleSelectProgram}
				>
					{#snippet masterActions()}
						<button
							class="btn btn-primary btn-sm"
							onclick={openCreateModal}
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
									d="M12 4v16m8-8H4"
								/>
							</svg>
							Add
						</button>
					{/snippet}
				{#snippet filters()}
					<div class="dropdown dropdown-end">
						<button tabindex="0" class="btn btn-sm btn-outline" class:btn-active={hideEndedPrograms}>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
							</svg>
							Filters
							{#if hideEndedPrograms}
								<span class="badge badge-sm badge-primary">•</span>
							{/if}
						</button>
						<div tabindex="0" class="dropdown-content z-[1] card card-compact w-64 p-4 shadow bg-base-100 border border-base-300 mt-2">
							<div class="space-y-3">
								<div class="flex items-center justify-between">
									<h3 class="font-semibold text-sm">Filter Programs</h3>
									{#if hideEndedPrograms}
										<button
											class="btn btn-ghost btn-xs"
											onclick={() => {
												hideEndedPrograms = false
											}}
										>
											Clear all
										</button>
									{/if}
								</div>

								<div class="divider my-1"></div>

								<div class="form-control">
									<label class="label cursor-pointer justify-start gap-2 py-1">
										<input
											type="checkbox"
											class="checkbox checkbox-sm checkbox-primary"
											bind:checked={hideEndedPrograms}
										/>
										<span class="label-text text-sm font-medium">Hide ended programs</span>
									</label>
									<p class="text-xs opacity-60 ml-6">Only show active and upcoming programs</p>
								</div>
							</div>
						</div>
					</div>
				{/snippet}
					{#snippet children(props)}
						{@const program = props.item as Program}
						{#if program}
							<div class="overflow-y-auto h-full">
								<!-- Header Card -->
								<ProgramHeaderCard
									{program}
									eventsCount={programEventsCount}
									onUpdateField={updateProgramField}
								/>

								<!-- Tabs Section -->
								<ProgramTabs
									{program}
									onUpdateField={updateProgramField}
									onDelete={openDeleteModal}
								/>
							</div>
						{/if}
					{/snippet}
				</MasterDetail>
			</div>
		</div>
	</div>

	<!-- Create Program Modal -->
	<CreateProgram 
		open={isCreateModalOpen}
		on:close={closeCreateModal}
		on:success={handleProgramCreated}
	/>

	<!-- Delete Program Modal -->
	<DeleteProgram
		open={isDeleteModalOpen}
		program={selectedProgram}
		on:close={closeDeleteModal}
		on:success={handleDeleteSuccess}
	/>
</ErrorBoundary>