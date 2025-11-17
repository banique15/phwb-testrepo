<script lang="ts">
	import type { Partner, ContactPerson } from '$lib/schemas/partner'

	interface Props {
		partner: Partner
		onDelete: () => void
	}

	let { partner, onDelete }: Props = $props()

	const tabs = [
		{ id: 'contacts', label: 'Contacts', icon: '📞' },
		{ id: 'history', label: 'History', icon: '📜' },
		{ id: 'settings', label: 'Settings', icon: '⚙️' }
	]

	let activeTab = $state<string>(
		(typeof window !== 'undefined' ? localStorage.getItem('phwb-partner-active-tab') : null) || 'contacts'
	)

	function setActiveTab(tabId: string) {
		activeTab = tabId
		if (typeof window !== 'undefined') {
			localStorage.setItem('phwb-partner-active-tab', tabId)
		}
	}

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		return new Date(dateStr).toLocaleDateString()
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
				<span class="mr-2">{tab.icon}</span>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Tab Content -->
	<div class="tab-content">
		{#if activeTab === 'contacts'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Contact Information</h3>
				{#if partner.contacts && Array.isArray(partner.contacts) && partner.contacts.length > 0}
					<div class="space-y-4">
						{#each partner.contacts as contact, index}
							<div class="card bg-base-200 p-3">
								<div class="flex items-center gap-2 mb-2">
									<p class="font-semibold text-sm">
										{contact.name || 'Unnamed Contact'}
									</p>
									{#if contact.isPrimary}
										<span class="badge badge-primary badge-xs">Primary</span>
									{/if}
								</div>
								{#if contact.title}
									<p class="text-xs opacity-70 mb-2">{contact.title}</p>
								{/if}
								<div class="space-y-1">
									{#if contact.email}
										<div class="flex items-center gap-2 text-sm">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
											</svg>
											<a href={`mailto:${contact.email}`} class="link link-primary text-xs">{contact.email}</a>
										</div>
									{/if}
									{#if contact.phone}
										<div class="flex items-center gap-2 text-sm">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
											</svg>
											<span class="text-xs">{contact.phone}</span>
										</div>
									{/if}
									{#if contact.address}
										<div class="flex items-start gap-2 text-sm">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 opacity-60 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
											</svg>
											<span class="text-xs">{contact.address}</span>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-base opacity-70">No contact information available</p>
				{/if}
			</div>
		{:else if activeTab === 'history'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Partnership History</h3>
				{#if partner.history && typeof partner.history === 'object' && Object.keys(partner.history).length > 0}
					<div class="bg-base-200 p-4 rounded-lg">
						<pre class="text-sm whitespace-pre-wrap">{JSON.stringify(partner.history, null, 2)}</pre>
					</div>
				{:else}
					<p class="text-base opacity-70">No partnership history available</p>
				{/if}
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
						Delete Partner
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

