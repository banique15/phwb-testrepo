<script lang="ts">
	import type { Facility } from '$lib/schemas/facility'
	import type { Location } from '$lib/schemas/location'
	import LocationContextSelector from './LocationContextSelector.svelte'
	import CalendarTab from './tabs/CalendarTab.svelte'
	import EventsTab from './tabs/EventsTab.svelte'
	import ContactsTab from './tabs/ContactsTab.svelte'
	import HistoryTab from './tabs/HistoryTab.svelte'
	import ReportsTab from './tabs/ReportsTab.svelte'
	import SettingsTab from './tabs/SettingsTab.svelte'

	interface Props {
		facility: Facility
		locations: Location[]
		selectedLocationId: number | null
		onSelectLocation: (locationId: number | null) => void
		onDelete: () => void
	}

	let { facility, locations, selectedLocationId, onSelectLocation, onDelete }: Props = $props()

	const tabs = [
		{ id: 'calendar', label: 'Calendar', icon: '📅' },
		{ id: 'events', label: 'Events', icon: '📋' },
		{ id: 'contacts', label: 'Contacts', icon: '📞' },
		{ id: 'history', label: 'History', icon: '📜' },
		{ id: 'reports', label: 'Reports', icon: '📊' },
		{ id: 'settings', label: 'Settings', icon: '⚙️' }
	]

	let activeTab = $state<string>(
		(typeof window !== 'undefined' ? localStorage.getItem('phwb-facility-active-tab') : null) || 'calendar'
	)

	function setActiveTab(tabId: string) {
		activeTab = tabId
		if (typeof window !== 'undefined') {
			localStorage.setItem('phwb-facility-active-tab', tabId)
		}
	}
</script>

<div class="space-y-3">
	<!-- Location Context Selector -->
	<LocationContextSelector
		{locations}
		{selectedLocationId}
		{onSelectLocation}
	/>

	<!-- Tab Navigation -->
	<div class="tabs tabs-boxed">
		{#each tabs as tab}
			<button
				class="tab {activeTab === tab.id ? 'tab-active' : ''}"
				onclick={() => setActiveTab(tab.id)}
			>
				<span class="mr-2">{tab.icon}</span>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Tab Content -->
	<div class="tab-content">
		{#if activeTab === 'calendar'}
			<CalendarTab
				{facility}
				{locations}
				{selectedLocationId}
			/>
		{:else if activeTab === 'events'}
			<EventsTab
				{facility}
				{locations}
				{selectedLocationId}
			/>
		{:else if activeTab === 'contacts'}
			<ContactsTab
				{facility}
				{locations}
				{selectedLocationId}
			/>
		{:else if activeTab === 'history'}
			<HistoryTab
				{facility}
				{locations}
				{selectedLocationId}
			/>
		{:else if activeTab === 'reports'}
			<ReportsTab
				{facility}
				{locations}
				{selectedLocationId}
			/>
		{:else if activeTab === 'settings'}
			<SettingsTab
				{facility}
				{locations}
				{selectedLocationId}
				{onDelete}
			/>
		{/if}
	</div>
</div>

