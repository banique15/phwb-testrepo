<script lang="ts">
	import type { EnhancedEvent } from '$lib/stores/events'
	import InlineEditableField from '$lib/components/ui/InlineEditableField.svelte'
	import FacilityLocationSelector from '$lib/components/ui/FacilityLocationSelector.svelte'
	import ProgramSelector from '$lib/components/ui/ProgramSelector.svelte'
	import { Copy, ExternalLink } from 'lucide-svelte'
	import { copyEventUrl, getEventUrl } from '$lib/utils/eventLinks'
	import { toast } from '$lib/stores/toast'
	import { browser } from '$app/environment'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import ProductionManagerSelector from '$lib/components/ui/ProductionManagerSelector.svelte'
	import { X } from 'lucide-svelte'

	interface Props {
		event: EnhancedEvent
		artistsCount?: number
		onUpdateField: (field: string, value: any) => Promise<void>
		onArtistCountClick?: () => void
		onDelete?: () => void
	}

	let {
		event,
		artistsCount = 0,
		onUpdateField,
		onArtistCountClick,
		onDelete
	}: Props = $props()


	async function handleCopyLink() {
		if (!event?.id || !browser) return
		
		try {
			await copyEventUrl(event.id)
			toast.success('Event link copied to clipboard')
		} catch (error) {
			toast.error('Failed to copy link')
		}
	}

	function handleViewFullPage() {
		if (event?.id && browser) {
			goto(getEventUrl(event.id))
		}
	}

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		// Append 'T00:00:00' to treat date as local time, not UTC
		const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
		return date.toLocaleDateString('en-US', {
			month: '2-digit',
			day: '2-digit',
			year: 'numeric'
		})
	}

	function formatTime(timeStr: string | undefined) {
		if (!timeStr) return 'Not specified'
		return timeStr.slice(0, 5) // Remove seconds
	}

	function getStatusBadgeClass(status: string | undefined) {
		switch (status?.toLowerCase()) {
			case 'scheduled':
			case 'confirmed':
				return 'badge-info'
			case 'completed':
				return 'badge-success'
			case 'cancelled':
				return 'badge-error'
			case 'in_progress':
				return 'badge-primary'
			case 'draft':
				return 'badge-ghost'
			default:
				return 'badge-outline'
		}
	}

	const statusOptions = [
		{ value: 'planned', label: 'Planned' },
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' },
		{ value: 'draft', label: 'Draft' }
	]

	async function handleLocationChange(locationId: number | null, location?: any) {
		await onUpdateField('location_id', locationId)
	}

	async function handleProgramChange(e: CustomEvent<{ value: number | undefined; program: any | null }>) {
		// Only update if value is explicitly provided (not undefined from typing/blur)
		// undefined means "no change", null means "clear selection"
		if (e.detail.value !== undefined) {
			await onUpdateField('program', e.detail.value ?? null)
		}
	}
</script>

<div class="card bg-base-100 shadow-none mb-4">
	<div class="card-body p-4">
		<div class="grid grid-cols-1 {event.digital_flyer_link ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-4">
			<!-- Left Side: Basic Information (2 columns on large screens if flyer exists, full width otherwise) -->
			<div class="{event.digital_flyer_link ? 'lg:col-span-2' : 'lg:col-span-1'} space-y-3">
				<!-- Title and Status -->
				<div class="space-y-3">
					<div class="flex items-start gap-2">
						<div class="flex-1">
							<InlineEditableField
								value={event.title}
								field="title"
								type="text"
								placeholder="Enter event title"
								maxLength={200}
								onSave={(value) => onUpdateField('title', value)}
								formatDisplay={(val) => val || 'Unnamed Event'}
								displayClass="text-3xl font-bold"
							/>
						</div>
					{#if event.id && browser}
						<div class="flex gap-1">
							<button
								class="btn btn-ghost btn-sm btn-square mt-1"
								onclick={handleCopyLink}
								title="Copy link to event"
							>
								<Copy class="w-4 h-4" />
							</button>
							{#if $page.route.id !== '/events/[id]'}
								<button
									class="btn btn-ghost btn-sm btn-square mt-1"
									onclick={handleViewFullPage}
									title="View full page"
								>
									<ExternalLink class="w-4 h-4" />
								</button>
							{/if}
							{#if onDelete}
								<button
									class="btn btn-ghost btn-sm btn-square mt-1 text-error hover:bg-error/10"
									onclick={onDelete}
									title="Delete event"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
									</svg>
								</button>
							{/if}
						</div>
					{/if}
					</div>
					<div class="flex items-center gap-2">
						<InlineEditableField
							value={event.status}
							field="status"
							type="select"
							options={statusOptions}
							placeholder="Select status"
							onSave={(value) => onUpdateField('status', value)}
							formatDisplay={(val) => val || 'Unknown Status'}
							displayClass={getStatusBadgeClass(event.status)}
						/>
					</div>
				</div>

				<!-- Date, Start Time, and End Time -->
				<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
					<div>
						<InlineEditableField
							value={event.date}
							field="date"
							type="text"
							placeholder="YYYY-MM-DD"
							label="Date"
							onSave={(value) => onUpdateField('date', value)}
							formatDisplay={(val) => val ? formatDate(val) : 'Not specified'}
						/>
					</div>
					<div>
						<InlineEditableField
							value={event.start_time}
							field="start_time"
							type="time"
							label="Start Time"
							onSave={(value) => onUpdateField('start_time', value)}
							formatDisplay={(val) => formatTime(val)}
						/>
					</div>
					<div>
						<InlineEditableField
							value={event.end_time}
							field="end_time"
							type="time"
							label="End Time"
							onSave={(value) => onUpdateField('end_time', value)}
							formatDisplay={(val) => formatTime(val)}
						/>
					</div>
				</div>

				<!-- Facility and Location -->
				<div class="form-control">
					<FacilityLocationSelector
						value={event.location_id}
						placeholder="Select facility and location"
						onchange={handleLocationChange}
					/>
				</div>

				<!-- Program and Production Manager (artist) -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div>
						<label class="text-sm font-medium opacity-70 block mb-1">Program</label>
						<ProgramSelector
							value={event.program}
							placeholder={event.program ? "Search for a program..." : "Not assigned"}
							onchange={handleProgramChange}
						/>
					</div>
					<div>
						<label class="text-sm font-medium opacity-70 block mb-1">Production Manager</label>
						<ProductionManagerSelector
							value={event.production_manager_id ?? null}
							placeholder="Select a production manager (optional)"
							onchange={async (productionManagerId, productionManager) => {
								await onUpdateField('production_manager_id', productionManagerId)
								await onUpdateField('production_manager_artist_id', productionManager?.artist_id ?? null)
							}}
						/>
					</div>
				</div>

			</div>

			<!-- Right Side: Event Image/Visual (1 column on large screens) - Only show if flyer exists -->
			{#if event.digital_flyer_link}
				<div class="lg:col-span-1">
					<div class="space-y-2">
						<h3 class="text-sm font-semibold opacity-70">Event Flyer</h3>
						<div class="mt-3 rounded-lg overflow-hidden border border-base-300">
							<img 
								src={event.digital_flyer_link} 
								alt={event.title || 'Event'} 
								class="w-full h-auto object-cover"
								onerror={(e) => {
									(e.target as HTMLImageElement).style.display = 'none'
								}}
							/>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
