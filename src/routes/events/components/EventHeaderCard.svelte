<script lang="ts">
	import type { EnhancedEvent } from '$lib/stores/events'
	import InlineEditableField from '$lib/components/ui/InlineEditableField.svelte'
	import VenueSelector from '$lib/components/ui/VenueSelector.svelte'
	import ProgramSelector from '$lib/components/ui/ProgramSelector.svelte'

	interface Props {
		event: EnhancedEvent
		artistsCount?: number
		onUpdateField: (field: string, value: any) => Promise<void>
	}

	let {
		event,
		artistsCount = 0,
		onUpdateField
	}: Props = $props()

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		return new Date(dateStr).toLocaleDateString()
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
			default:
				return 'badge-outline'
		}
	}

	const statusOptions = [
		{ value: 'planned', label: 'Planned' },
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' }
	]

	async function handleVenueChange(e: CustomEvent<{ value: number | null }>) {
		await onUpdateField('venue', e.detail.value)
	}

	async function handleProgramChange(e: CustomEvent<{ value: number | null }>) {
		await onUpdateField('program', e.detail.value)
	}
</script>

<div class="card bg-base-100 shadow-none mb-4">
	<div class="card-body p-4">
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Left Side: Basic Information (2 columns on large screens) -->
			<div class="lg:col-span-2 space-y-3">
				<!-- Title and Status -->
				<div class="space-y-3">
					<div>
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
					<div class="flex items-center gap-3 flex-wrap">
						<InlineEditableField
							value={event.status}
							field="status"
							type="select"
							options={statusOptions}
							placeholder="Select status"
							onSave={(value) => onUpdateField('status', value)}
							formatDisplay={(val) => val || 'Unknown Status'}
						/>
						<span class="badge {getStatusBadgeClass(event.status)}">
							{event.status || 'Unknown'}
						</span>
					</div>
				</div>

				<!-- Date and Time -->
				<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
					<div>
						<InlineEditableField
							value={event.date}
							field="date"
							type="text"
							placeholder="YYYY-MM-DD"
							label="Date"
							onSave={(value) => onUpdateField('date', value)}
						/>
					</div>
					<div>
						<InlineEditableField
							value={event.start_time}
							field="start_time"
							type="text"
							placeholder="HH:MM"
							label="Start Time"
							onSave={(value) => onUpdateField('start_time', value)}
							formatDisplay={(val) => formatTime(val)}
						/>
					</div>
					<div>
						<InlineEditableField
							value={event.end_time}
							field="end_time"
							type="text"
							placeholder="HH:MM"
							label="End Time"
							onSave={(value) => onUpdateField('end_time', value)}
							formatDisplay={(val) => formatTime(val)}
						/>
					</div>
				</div>

				<!-- Venue and Program -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div>
						<label class="text-sm font-medium opacity-70 block mb-1">Venue</label>
						<VenueSelector
							value={event.venue}
							placeholder="Search for a venue..."
							onchange={handleVenueChange}
						/>
					</div>
					<div>
						<label class="text-sm font-medium opacity-70 block mb-1">Program</label>
						<ProgramSelector
							value={event.program}
							placeholder="Search for a program..."
							onchange={handleProgramChange}
						/>
					</div>
				</div>

				<!-- Quick Stats -->
				<div class="flex items-center gap-3 pt-2 border-t border-base-300">
					{#if artistsCount > 0}
						<div class="stat stat-compact p-0">
							<div class="stat-title text-xs">Artists</div>
							<div class="stat-value text-lg">{artistsCount}</div>
						</div>
					{/if}
					<div class="stat stat-compact p-0">
						<div class="stat-title text-xs">Created</div>
						<div class="stat-value text-sm">{formatDate(event.created_at)}</div>
					</div>
				</div>
			</div>

			<!-- Right Side: Event Image/Visual (1 column on large screens) -->
			<div class="lg:col-span-1">
				<div class="space-y-2">
					<h3 class="text-sm font-semibold opacity-70">Event Details</h3>
					<div class="space-y-2">
						{#if event.digital_flyer_link}
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
						{:else}
							<div class="mt-3 rounded-lg border-2 border-dashed border-base-300 bg-base-200 flex items-center justify-center h-48">
								<div class="text-center text-base-content/50">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
									<p class="text-sm">No flyer</p>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

