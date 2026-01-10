<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { browser } from '$app/environment'
	import { eventsStore, type EnhancedEvent } from '$lib/stores/events'
	import { toast } from '$lib/stores/toast'
	import { updateEventSchema } from '$lib/schemas/event'
	import { z } from 'zod'
	import type { PageData } from './$types'
	import EventHeaderCard from '../components/EventHeaderCard.svelte'
	import EventTabs from '../components/EventTabs.svelte'
	import PageHeader from '$lib/components/ui/PageHeader.svelte'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import { ArrowLeft, Copy, ExternalLink } from 'lucide-svelte'
	import { getEventUrl, copyEventUrl } from '$lib/utils/eventLinks'
	// Lazy load delete modal
	const DeleteConfirm = () => import('../modals/DeleteConfirm.svelte')

	interface Props {
		data: PageData
	}

	let { data }: Props = $props()

	let event = $state<EnhancedEvent | null>(data.event || null)
	let eventArtistsCount = $state(0)
	let showDeleteModal = $state(false)
	let externalActiveTab = $state<string | null>(data.tab || null)

	// Handle tab from query params on initial load
	$effect(() => {
		if (data.tab && tabs.some(t => t.id === data.tab)) {
			externalActiveTab = data.tab
		}
	})

	// Watch for URL changes to update tab
	$effect(() => {
		if (browser) {
			const urlTab = $page.url.searchParams.get('tab')
			if (urlTab && tabs.some(t => t.id === urlTab)) {
				externalActiveTab = urlTab
			}
		}
	})

	// Update URL when tab changes
	function handleTabChange(tabId: string) {
		externalActiveTab = tabId
		if (browser && event?.id) {
			const url = getEventUrl(event.id)
			goto(`${url}?tab=${tabId}`, { replaceState: true, keepFocus: true })
		}
	}

	// Count artists
	$effect(() => {
		if (event?.artists) {
			if (Array.isArray(event.artists)) {
				eventArtistsCount = event.artists.length
			} else if (typeof event.artists === 'object' && (event.artists as any).assignments) {
				eventArtistsCount = (event.artists as any).assignments.length
			} else {
				eventArtistsCount = 0
			}
		} else {
			eventArtistsCount = 0
		}
	})

	async function updateEventField(field: string, value: any) {
		if (!event?.id) return

		try {
			// Prepare update data - handle null/empty values
			const finalValue = value === "" || value === null ? null : value
			const updateData: any = { [field]: finalValue }

			// Validate the field only if value is not null (for optional fields)
			if (finalValue !== null) {
				const fieldSchema =
					updateEventSchema.shape[
						field as keyof typeof updateEventSchema.shape
					]
				if (fieldSchema) {
					fieldSchema.parse(finalValue)
				}
			}

			// Update event
			const updatedEvent = await eventsStore.update(event.id, updateData)
			
			// Enhance the updated event
			const enhanced = eventsStore.enhanceEvents([updatedEvent])[0]
			event = enhanced
			
			toast.success('Event updated successfully')
		} catch (error) {
			if (error instanceof z.ZodError) {
				toast.error(error.errors[0]?.message || "Validation failed")
			} else {
				toast.error('Failed to update event')
			}
			throw error
		}
	}

	async function handleDelete() {
		showDeleteModal = true
	}

	async function handleDeleteSuccess() {
		toast.success('Event deleted successfully')
		// Navigate back to events list
		await goto('/events')
	}

	function handleDeleteCancel() {
		showDeleteModal = false
	}

	async function handleCopyLink() {
		if (!event?.id) return
		
		try {
			await copyEventUrl(event.id)
			toast.success('Event link copied to clipboard')
		} catch (error) {
			toast.error('Failed to copy link')
		}
	}

	function handleViewInList() {
		if (event?.id) {
			goto(`/events?id=${event.id}`)
		} else {
			goto('/events')
		}
	}

	const tabs = [
		{ id: 'schedule', label: 'Schedule' },
		{ id: 'requirements', label: 'Requirements' },
		{ id: 'performers', label: 'Performers' },
		{ id: 'payroll', label: 'Payroll' },
		{ id: 'notes', label: 'Notes' },
		{ id: 'history', label: 'History' },
		{ id: 'settings', label: 'Settings' }
	]
</script>

<ErrorBoundary>
	<div class="flex flex-col h-full overflow-hidden">
		<!-- Header -->
		<div class="flex-none px-4 sm:px-6 pt-4 pb-4 bg-base-100 border-b border-base-200">
			<PageHeader
				title={event?.title || 'Event Details'}
				subtitle={event?.date ? `Event on ${new Date(event.date).toLocaleDateString()}` : 'Loading event...'}
			>
				{#snippet actions()}
					<div class="flex gap-2">
						<button
							class="btn btn-ghost btn-sm"
							onclick={handleViewInList}
							title="View in list"
						>
							<ArrowLeft class="w-4 h-4 mr-2" />
							Back to List
						</button>
						<button
							class="btn btn-ghost btn-sm"
							onclick={handleCopyLink}
							title="Copy link to event"
						>
							<Copy class="w-4 h-4 mr-2" />
							Copy Link
						</button>
						{#if event?.id}
							<a
								href={getEventUrl(event.id)}
								target="_blank"
								rel="noopener noreferrer"
								class="btn btn-ghost btn-sm"
								title="Open in new tab"
							>
								<ExternalLink class="w-4 h-4" />
							</a>
						{/if}
					</div>
				{/snippet}
			</PageHeader>
		</div>

		<!-- Content -->
		<div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
			{#if !event}
				<div class="flex flex-col items-center justify-center h-full">
					<div class="text-center">
						<h2 class="text-2xl font-bold mb-2">Event Not Found</h2>
						<p class="text-base-content/70 mb-4">The event you're looking for doesn't exist or has been deleted.</p>
						<button class="btn btn-primary" onclick={() => goto('/events')}>
							<ArrowLeft class="w-4 h-4 mr-2" />
							Back to Events
						</button>
					</div>
				</div>
			{:else}
				<div class="flex flex-col h-full overflow-hidden max-w-6xl mx-auto">
					<!-- Header Card -->
					<div class="flex-none mb-4">
						<EventHeaderCard
							{event}
							artistsCount={eventArtistsCount}
							onUpdateField={updateEventField}
							onArtistCountClick={() => {
								externalActiveTab = 'performers'
								handleTabChange('performers')
							}}
						/>
					</div>

					<!-- Tabs Section -->
					<div class="flex-1 min-h-0 overflow-y-auto">
						<EventTabs
							{event}
							onUpdateField={updateEventField}
							onDelete={handleDelete}
							externalActiveTab={externalActiveTab}
							onTabChange={handleTabChange}
							onEventUpdated={(updated) => {
								event = updated
							}}
						/>
					</div>
				</div>
			{/if}
		</div>
	</div>
</ErrorBoundary>

<!-- Delete Modal - Lazy loaded -->
{#if showDeleteModal}
	{#await DeleteConfirm() then { default: DeleteConfirmComponent }}
		<DeleteConfirmComponent
			open={showDeleteModal}
			{event}
			onClose={handleDeleteCancel}
			onSuccess={handleDeleteSuccess}
		/>
	{/await}
{/if}
