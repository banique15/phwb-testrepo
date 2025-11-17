<script lang="ts">
	import type { Program } from '$lib/schemas/program'
	import InlineEditableField from '$lib/components/ui/InlineEditableField.svelte'

	interface Props {
		program: Program
		onUpdateField: (field: string, value: any) => Promise<void>
		onDelete: () => void
	}

	let { program, onUpdateField, onDelete }: Props = $props()

	const tabs = [
		{ id: 'details', label: 'Details', icon: '📋' },
		{ id: 'events', label: 'Events', icon: '📅' },
		{ id: 'participants', label: 'Participants', icon: '👥' },
		{ id: 'reports', label: 'Reports', icon: '📊' },
		{ id: 'settings', label: 'Settings', icon: '⚙️' }
	]

	let activeTab = $state<string>(
		(typeof window !== 'undefined' ? localStorage.getItem('phwb-program-active-tab') : null) || 'details'
	)

	function setActiveTab(tabId: string) {
		activeTab = tabId
		if (typeof window !== 'undefined') {
			localStorage.setItem('phwb-program-active-tab', tabId)
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
				<p class="text-base opacity-70">Events associated with this program will be displayed here.</p>
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

