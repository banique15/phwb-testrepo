<script lang="ts">
	import type { Facility } from '$lib/schemas/facility'
	import type { Location } from '$lib/schemas/location'
	import type { ComponentType, SvelteComponent } from 'svelte'
	import { Calendar, ClipboardList, Phone, ScrollText, BarChart, Settings } from 'lucide-svelte'
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

	const tabs: Array<{ id: string; label: string; icon: ComponentType<SvelteComponent> }> = [
		{ id: 'calendar', label: 'Calendar', icon: Calendar },
		{ id: 'events', label: 'Events', icon: ClipboardList },
		{ id: 'contacts', label: 'Contacts', icon: Phone },
		{ id: 'history', label: 'History', icon: ScrollText },
		{ id: 'reports', label: 'Reports', icon: BarChart },
		{ id: 'settings', label: 'Settings', icon: Settings }
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
				<svelte:component this={tab.icon} class="w-4 h-4 mr-2" />
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

