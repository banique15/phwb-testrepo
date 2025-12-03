<script lang="ts">
	import type { EnhancedEvent } from '$lib/stores/events'
	import type { ComponentType, SvelteComponent } from 'svelte'
	import { Calendar, ClipboardList, Theater, FileText, ScrollText, Settings, DollarSign } from 'lucide-svelte'
	import InlineEditableField from '$lib/components/ui/InlineEditableField.svelte'
	import ScheduleDisplay from './ScheduleDisplay.svelte'
	import RequirementsDisplay from './RequirementsDisplay.svelte'
	import EventPerformers from '$lib/components/EventPerformers.svelte'
	import EventPayrollLink from './EventPayrollLink.svelte'

	interface Props {
		event: EnhancedEvent
		onUpdateField: (field: string, value: any) => Promise<void>
		onDelete: () => void
		externalActiveTab?: string | null
	}

	let { event, onUpdateField, onDelete, externalActiveTab = null }: Props = $props()

	const tabs: Array<{ id: string; label: string; icon: ComponentType<SvelteComponent> }> = [
		{ id: 'schedule', label: 'Schedule', icon: Calendar },
		{ id: 'requirements', label: 'Requirements', icon: ClipboardList },
		{ id: 'performers', label: 'Performers', icon: Theater },
		{ id: 'notes', label: 'Notes', icon: FileText },
		{ id: 'history', label: 'History', icon: ScrollText },
		{ id: 'settings', label: 'Settings', icon: Settings }
	]

	let activeTab = $state<string>(
		(typeof window !== 'undefined' ? localStorage.getItem('phwb-event-active-tab') : null) || 'schedule'
	)

	// Watch for external tab changes
	$effect(() => {
		if (externalActiveTab && tabs.some(t => t.id === externalActiveTab)) {
			activeTab = externalActiveTab
		}
	})

	function setActiveTab(tabId: string) {
		activeTab = tabId
		if (typeof window !== 'undefined') {
			localStorage.setItem('phwb-event-active-tab', tabId)
		}
	}

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		const date = new Date(dateStr)
		return date.toLocaleDateString('en-US', {
			month: '2-digit',
			day: '2-digit',
			year: 'numeric'
		})
	}
</script>

<div class="space-y-3">
	<!-- Tab Navigation -->
	<div class="tabs tabs-boxed">
		{#each tabs as tab}
			<button
				class="tab {activeTab === tab.id ? 'tab-active' : ''}"
				onclick={() => setActiveTab(tab.id)}
			>
				<svelte:component this={tab.icon} class="w-4 h-4 mr-2" />
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Tab Content -->
	<div class="tab-content block">
		{#if activeTab === 'schedule'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Event Schedule</h3>
				{#if event.schedule}
					<ScheduleDisplay schedule={event.schedule} />
				{:else}
					<div class="text-center py-8 border-2 border-dashed border-base-300 rounded-lg bg-base-50">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
						<p class="text-base opacity-70 mb-2">No schedule information available</p>
						<p class="text-sm opacity-50">Add schedule details to track event timeline</p>
					</div>
				{/if}
			</div>
		{:else if activeTab === 'requirements'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Event Requirements</h3>
				{#if event.requirements}
					<RequirementsDisplay requirements={event.requirements} />
				{:else}
					<p class="text-base opacity-70">No requirements specified</p>
				{/if}
			</div>
		{:else if activeTab === 'performers'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Performers</h3>
				{#if event.id}
					<EventPerformers eventId={event.id} showDetails={true} />
				{:else}
					<p class="text-base opacity-70">No performers assigned</p>
				{/if}
			</div>
		{:else if activeTab === 'notes'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Notes</h3>
				<div>
					<InlineEditableField
						value={event.notes}
						field="notes"
						type="textarea"
						placeholder="Enter event notes"
						maxLength={2000}
						rows={8}
						onSave={(value) => onUpdateField('notes', value)}
					/>
				</div>
			</div>
		{:else if activeTab === 'history'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Event History</h3>
				<div class="space-y-3">
					<div>
						<p class="text-sm font-medium opacity-70">Created</p>
						<p class="text-base">{formatDate(event.created_at)}</p>
					</div>
					{#if event.feedback && event.feedback.internal_notes && event.feedback.internal_notes.length > 0}
						<div class="space-y-3">
							<h4 class="text-md font-semibold">Internal Notes</h4>
							{#each event.feedback.internal_notes as note, index}
								<div class="bg-base-200 p-4 rounded-lg border-l-4 border-warning">
									<div class="flex items-start gap-3">
										<span class="badge badge-warning badge-sm">#{index + 1}</span>
										<div class="flex-1">
											{#if typeof note === 'string'}
												<p class="text-base whitespace-pre-wrap">{note}</p>
											{:else if note.content || note.note || note.text}
												<p class="text-base whitespace-pre-wrap">{note.content || note.note || note.text}</p>
												{#if note.author}
													<div class="text-xs opacity-60 mt-2">— {note.author}</div>
												{/if}
												{#if note.timestamp || note.date}
													<div class="text-xs opacity-60 mt-1">
														{formatDate(note.timestamp || note.date)}
													</div>
												{/if}
											{:else}
												<pre class="text-sm bg-base-300 p-2 rounded overflow-x-auto">
{JSON.stringify(note, null, 2)}
												</pre>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{:else if activeTab === 'settings'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Settings</h3>
				<div class="space-y-4">
					<button
						class="btn btn-outline btn-error"
						onclick={onDelete}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
						Delete Event
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

