<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { browser } from '$app/environment'
	import { eventsStore, type EnhancedEvent } from '$lib/stores/events'
	import { toast } from '$lib/stores/toast'
	import { updateEventSchema } from '$lib/schemas/event'
	import { z } from 'zod'
	import { generatePayrollForEvent, previewCompletedEventPayrollChanges } from '$lib/services/payroll-generator'
	import type { GeneratedPayrollEntry } from '$lib/schemas/rate-card'
	import type { PayrollReconcilePreviewRow } from '$lib/services/payroll-generator'
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
	let showPayrollReviewModal = $state(false)
	let showPayrollImpactModal = $state(false)
	let showPayrollChangePreviewModal = $state(false)
	let payrollPreviewLoading = $state(false)
	let payrollPreviewEntries = $state<GeneratedPayrollEntry[]>([])
	let payrollImpactResolver: ((confirmed: boolean) => void) | null = null
	let payrollChangePreviewRows = $state<PayrollReconcilePreviewRow[]>([])
	let payrollChangePreviewResolver: ((confirmed: boolean) => void) | null = null

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
			const normalizedStatusValue =
				field === 'status' && typeof finalValue === 'string'
					? finalValue.trim().toLowerCase()
					: null

			// In the active event detail flow, intercept completion to review payroll first.
			if (field === 'status' && normalizedStatusValue === 'completed') {
				payrollPreviewLoading = true
				const preview = await generatePayrollForEvent(event.id, { dryRun: true })
				payrollPreviewEntries = preview.entries.map((entry) => ({ ...entry }))
				showPayrollReviewModal = true
				return
			}

			const payrollDriverFields = new Set([
				'artists',
				'start_time',
				'end_time',
				'number_of_musicians',
				'pm_hours',
				'pm_rate',
				'production_manager_id',
				'production_manager_artist_id'
			])
			if (event.status === 'completed' && payrollDriverFields.has(field)) {
				const confirmed = await confirmPayrollImpact()
				if (!confirmed) return

				const previewResult = await previewCompletedEventPayrollChanges(event.id, {
					eventOverride: { [field]: finalValue }
				})
				if (!previewResult.success) {
					toast.error(previewResult.errors.join('; ') || 'Failed to preview payroll changes')
					return
				}
				payrollChangePreviewRows = previewResult.rows
				if (previewResult.rows.length > 0) {
					const apply = await confirmPayrollChangePreview()
					if (!apply) return
				}
			}

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
		} finally {
			payrollPreviewLoading = false
		}
	}

	async function confirmPayrollImpact(): Promise<boolean> {
		showPayrollImpactModal = true
		return await new Promise((resolve) => {
			payrollImpactResolver = resolve
		})
	}

	function resolvePayrollImpact(confirmed: boolean) {
		showPayrollImpactModal = false
		payrollImpactResolver?.(confirmed)
		payrollImpactResolver = null
	}

	async function confirmPayrollChangePreview(): Promise<boolean> {
		showPayrollChangePreviewModal = true
		return await new Promise((resolve) => {
			payrollChangePreviewResolver = resolve
		})
	}

	function resolvePayrollChangePreview(confirmed: boolean) {
		showPayrollChangePreviewModal = false
		payrollChangePreviewResolver?.(confirmed)
		payrollChangePreviewResolver = null
	}

	function updatePreviewEntry(index: number, field: 'hours' | 'rate' | 'additional_pay', value: number) {
		const next = [...payrollPreviewEntries]
		const current = { ...next[index] }
		current[field] = value
		current.total_pay = Number((current.hours * current.rate + current.additional_pay).toFixed(2))
		next[index] = current
		payrollPreviewEntries = next
	}

	async function confirmPayrollReviewAndComplete() {
		if (!event?.id) return
		payrollPreviewLoading = true
		try {
			const updatedEvent = await eventsStore.update(event.id, {
				status: 'completed',
				__reviewedPayrollEntries: payrollPreviewEntries
			} as any)
			const enhanced = eventsStore.enhanceEvents([updatedEvent])[0]
			event = enhanced
			showPayrollReviewModal = false
			toast.success('Event completed and payroll generated')
		} catch (error) {
			console.error('Failed to complete event with reviewed payroll:', error)
			toast.error((error as any)?.message || 'Failed to complete event with payroll review')
		} finally {
			payrollPreviewLoading = false
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

{#if showPayrollImpactModal}
	<div class="modal modal-open">
		<div class="modal-box max-w-lg">
			<h3 class="font-bold text-lg">Review Payroll Impact</h3>
			<p class="text-sm opacity-80 mt-2">
				This completed-event edit affects payroll. Continue and review/reconcile payroll updates?
			</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => resolvePayrollImpact(false)}>Cancel</button>
				<button class="btn btn-primary" onclick={() => resolvePayrollImpact(true)}>Continue</button>
			</div>
		</div>
	</div>
{/if}

{#if showPayrollChangePreviewModal}
	<div class="modal modal-open">
		<div class="modal-box max-w-4xl">
			<h3 class="font-bold text-lg">Payroll Changes Preview</h3>
			<p class="text-sm opacity-80 mt-2">Review current vs new payroll before applying this completed-event edit.</p>
			<div class="overflow-x-auto mt-4 max-h-[50vh]">
				<table class="table table-zebra table-sm">
					<thead>
						<tr>
							<th>Payee</th>
							<th>Action</th>
							<th>Current</th>
							<th>New</th>
							<th>Difference</th>
							<th>Note</th>
						</tr>
					</thead>
					<tbody>
						{#each payrollChangePreviewRows as row}
							<tr>
								<td>
									{row.payee_name}
									{#if row.is_production_manager}
										<span class="badge badge-secondary badge-xs ml-2">PM</span>
									{/if}
								</td>
								<td><span class="badge badge-outline badge-xs">{row.action}</span></td>
								<td>${row.current_total.toFixed(2)}</td>
								<td>${row.new_total.toFixed(2)}</td>
								<td class={row.delta >= 0 ? 'text-success' : 'text-error'}>
									{row.delta >= 0 ? '+' : ''}${row.delta.toFixed(2)}
								</td>
								<td class="text-xs opacity-80">{row.note || '-'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => resolvePayrollChangePreview(false)}>Cancel</button>
				<button class="btn btn-primary" onclick={() => resolvePayrollChangePreview(true)}>Apply Changes</button>
			</div>
		</div>
	</div>
{/if}

{#if showPayrollReviewModal}
	<div class="modal modal-open">
		<div class="modal-box max-w-5xl">
			<h3 class="font-bold text-lg">Review Payroll Before Completion</h3>
			<p class="text-sm opacity-70 mt-1">Adjust entries as needed before payroll is generated for this completed event.</p>
			<div class="overflow-x-auto mt-4 max-h-[50vh]">
				<table class="table table-zebra table-sm">
					<thead>
						<tr>
							<th>Payee</th>
							<th>Date</th>
							<th>Hours</th>
							<th>Rate</th>
							<th>Additional</th>
							<th>Total</th>
						</tr>
					</thead>
					<tbody>
						{#each payrollPreviewEntries as entry, index}
							<tr>
								<td>
									{entry.payee_name || entry.artist_name}
									{#if entry.is_production_manager}
										<span class="badge badge-secondary badge-xs ml-2">PM</span>
									{/if}
								</td>
								<td>{entry.event_date}</td>
								<td>
									<input
										type="number"
										class="input input-bordered input-xs w-24"
										min="0"
										step="0.25"
										value={entry.hours}
										oninput={(e) => updatePreviewEntry(index, 'hours', Number(e.currentTarget.value || 0))}
									/>
								</td>
								<td>
									<input
										type="number"
										class="input input-bordered input-xs w-24"
										min="0"
										step="0.01"
										value={entry.rate}
										oninput={(e) => updatePreviewEntry(index, 'rate', Number(e.currentTarget.value || 0))}
									/>
								</td>
								<td>
									<input
										type="number"
										class="input input-bordered input-xs w-24"
										step="0.01"
										value={entry.additional_pay}
										oninput={(e) => updatePreviewEntry(index, 'additional_pay', Number(e.currentTarget.value || 0))}
									/>
								</td>
								<td>${entry.total_pay.toFixed(2)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => showPayrollReviewModal = false} disabled={payrollPreviewLoading}>Cancel</button>
				<button class="btn btn-primary" onclick={confirmPayrollReviewAndComplete} disabled={payrollPreviewLoading}>
					{#if payrollPreviewLoading}<span class="loading loading-spinner loading-sm"></span>{/if}
					Complete Event & Generate Payroll
				</button>
			</div>
		</div>
	</div>
{/if}
