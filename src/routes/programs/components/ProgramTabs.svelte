<script lang="ts">
	import type { Program } from '$lib/schemas/program'
	import type { ComponentType, SvelteComponent } from 'svelte'
	import { ClipboardList, Calendar, Users, BarChart, Settings } from 'lucide-svelte'
	import InlineEditableField from '$lib/components/ui/InlineEditableField.svelte'
	import type { Event } from '$lib/schemas/event'
	import { supabase } from '$lib/supabase'
	import { goto } from '$app/navigation'

	interface Props {
		program: Program
		onUpdateField: (field: string, value: any) => Promise<void>
		onDelete: () => void
	}

	let { program, onUpdateField, onDelete }: Props = $props()

	const tabs: Array<{ id: string; label: string; icon: ComponentType<SvelteComponent> }> = [
		{ id: 'details', label: 'Details', icon: ClipboardList },
		{ id: 'events', label: 'Events', icon: Calendar },
		{ id: 'participants', label: 'Participants', icon: Users },
		{ id: 'reports', label: 'Reports', icon: BarChart },
		{ id: 'settings', label: 'Settings', icon: Settings }
	]

	let activeTab = $state<string>(
		(typeof window !== 'undefined' ? localStorage.getItem('phwb-program-active-tab') : null) || 'details'
	)

	// Events state
	let events = $state<Event[]>([])
	let eventsLoading = $state(false)
	let searchQuery = $state('')
	let sortBy = $state<'date' | 'title' | 'status'>('date')
	let sortOrder = $state<'asc' | 'desc'>('asc')

	function setActiveTab(tabId: string) {
		activeTab = tabId
		if (typeof window !== 'undefined') {
			localStorage.setItem('phwb-program-active-tab', tabId)
		}
		// Load events when switching to events tab
		if (tabId === 'events' && program.id) {
			loadEvents()
		}
	}

	$effect(() => {
		// Reload events when program changes or when events tab is active
		if (activeTab === 'events' && program.id) {
			loadEvents()
		}
	})

	async function loadEvents() {
		if (!program.id) {
			events = []
			return
		}

		eventsLoading = true
		try {
			let query = supabase
				.from('phwb_events')
				.select('*')
				.eq('program', program.id)

			// Apply search
			if (searchQuery) {
				query = query.or(`title.ilike.%${searchQuery}%,notes.ilike.%${searchQuery}%`)
			}

			// Apply sorting
			query = query.order(sortBy, { ascending: sortOrder === 'asc' })

			const { data, error } = await query

			if (error) {
				console.error('Error loading events:', error)
				events = []
			} else {
				events = data || []
			}
		} catch (err) {
			console.error('Failed to load events:', err)
			events = []
		} finally {
			eventsLoading = false
		}
	}

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		// Append 'T00:00:00' to treat date as local time, not UTC
		const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
		return date.toLocaleDateString('en-US', { 
			year: 'numeric', 
			month: 'short', 
			day: 'numeric' 
		})
	}

	function formatTime(timeStr: string | undefined) {
		if (!timeStr) return ''
		return timeStr.slice(0, 5)
	}

	function getStatusBadgeClass(status: string | undefined) {
		switch (status) {
			case 'confirmed': return 'badge-success'
			case 'completed': return 'badge-info'
			case 'cancelled': return 'badge-error'
			case 'in_progress': return 'badge-warning'
			default: return 'badge-neutral'
		}
	}

	function handleCreateEvent() {
		const params = new URLSearchParams()
		if (program.id) {
			params.set('program', String(program.id))
		}
		goto(`/events?${params.toString()}`)
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
	<div class="tab-content">
		{#if activeTab === 'details'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Program Details</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<InlineEditableField
							value={program.geo_coverage}
							field="geo_coverage"
							type="text"
							placeholder="Enter geographic coverage"
							label="Geographic Coverage"
							maxLength={200}
							onSave={(value) => onUpdateField('geo_coverage', value)}
						/>
					</div>
					<div>
						<InlineEditableField
							value={program.partner ? String(program.partner) : ''}
							field="partner"
							type="text"
							placeholder="Enter partner ID"
							label="Partner ID"
							onSave={(value) => onUpdateField('partner', value ? Number(value) : null)}
							formatDisplay={(val) => val ? String(val) : 'No partner assigned'}
						/>
					</div>
					<div>
						<InlineEditableField
							value={program.programmer}
							field="programmer"
							type="text"
							placeholder="Enter programmer name"
							label="Programmer"
							maxLength={200}
							onSave={(value) => onUpdateField('programmer', value)}
						/>
					</div>
					<div>
						<InlineEditableField
							value={program.funder}
							field="funder"
							type="text"
							placeholder="Enter funder name"
							label="Funder"
							maxLength={200}
							onSave={(value) => onUpdateField('funder', value)}
						/>
					</div>
					<div>
						<p class="text-sm font-medium opacity-70">Created</p>
						<p class="text-base">{formatDate(program.created_at)}</p>
					</div>
				</div>
			</div>
		{:else if activeTab === 'events'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Program Events</h3>
				
				<!-- Header with Search and Actions -->
				<div class="flex items-center justify-between gap-3">
					<div class="flex-1">
						<input
							type="text"
							placeholder="Search events..."
							class="input input-bordered w-full max-w-xs"
							bind:value={searchQuery}
							oninput={loadEvents}
						/>
					</div>
					<div class="flex items-center gap-2">
						<select
							class="select select-bordered select-sm"
							bind:value={sortBy}
							onchange={loadEvents}
						>
							<option value="date">Sort by Date</option>
							<option value="title">Sort by Title</option>
							<option value="status">Sort by Status</option>
						</select>
						<button
							class="btn btn-sm btn-primary"
							onclick={handleCreateEvent}
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
							</svg>
							Add Event
						</button>
					</div>
				</div>

				<!-- Events List -->
				{#if eventsLoading}
					<div class="flex items-center justify-center py-6">
						<span class="loading loading-spinner loading-lg"></span>
					</div>
				{:else if events.length === 0}
					<div class="text-center py-6 bg-base-200 rounded-lg">
						<ClipboardList class="w-16 h-16 mx-auto text-base-content/70" />
						<p class="mt-2 text-lg">No events found</p>
						<p class="text-sm opacity-60">
							{searchQuery ? 'Try adjusting your search' : 'No events associated with this program yet'}
						</p>
					</div>
				{:else}
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
						{#each events as event}
							<div class="card bg-base-100 cursor-pointer" onclick={() => goto(`/events?id=${event.id}`)}>
								<div class="card-body p-3">
									<h3 class="card-title text-lg {!event.title ? 'border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1 inline-block' : ''}">{event.title || 'Untitled Event'}</h3>
									<div class="space-y-1 text-sm">
										<div class="flex items-center gap-2">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
											</svg>
											<span class="{!event.date ? 'border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1 inline-block' : ''}">{formatDate(event.date)}</span>
										</div>
										<div class="flex items-center gap-2 {!event.start_time && !event.end_time ? 'border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1' : ''}">
											{#if event.start_time || event.end_time}
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
												</svg>
												<span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
												</svg>
												<span>No time specified</span>
											{/if}
										</div>
									</div>
									<div class="card-actions justify-end mt-2">
										<span class="badge {getStatusBadgeClass(event.status)} badge-sm {!event.status ? 'border border-yellow-400 dark:border-yellow-600' : ''}">
											{event.status || 'planned'}
										</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{:else if activeTab === 'participants'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Participants</h3>
				<p class="text-base opacity-70">Participant information will be displayed here.</p>
			</div>
		{:else if activeTab === 'reports'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Program Reports</h3>
				<p class="text-base opacity-70">Program reports and analytics will be displayed here.</p>
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
						Delete Program
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

