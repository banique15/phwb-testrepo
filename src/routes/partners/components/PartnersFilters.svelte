<script lang="ts">
	import { ArrowUpDown, Building2 } from 'lucide-svelte'

	interface Props {
		sortBy: string
		sortOrder: 'asc' | 'desc'
		organizationFilter: string
		organizations: string[]
		onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void
		onOrganizationFilterChange: (filter: string) => void
	}

	let {
		sortBy,
		sortOrder,
		organizationFilter,
		organizations,
		onSortChange,
		onOrganizationFilterChange
	}: Props = $props()

	function getSortLabel(): string {
		if (sortBy === 'last_opened') return 'Last Opened'
		if (sortBy === 'name' && sortOrder === 'asc') return 'Name (A-Z)'
		if (sortBy === 'name' && sortOrder === 'desc') return 'Name (Z-A)'
		return 'Sort'
	}

	function handleSortOption(sortOption: string) {
		const [newSortBy, newSortOrder] = sortOption.split('-')
		onSortChange(newSortBy, newSortOrder as 'asc' | 'desc')
	}

	function handleOrganizationSelect(org: string) {
		onOrganizationFilterChange(org)
	}
</script>

<div class="flex gap-1 items-center">
	<!-- Sort Dropdown -->
	<div class="dropdown dropdown-end">
		<button
			type="button"
			tabindex="0"
			class="btn btn-ghost btn-xs min-h-[44px] min-w-[44px]"
			title={getSortLabel()}
		>
			<ArrowUpDown class="w-4 h-4" />
		</button>
		<ul
			tabindex="0"
			class="dropdown-content menu z-[1] p-2 shadow bg-base-100 rounded-box w-48 border border-base-300"
		>
			<li>
				<button
					class={sortBy === 'last_opened' ? 'active' : ''}
					onclick={() => handleSortOption('last_opened-desc')}
				>
					Last Opened
				</button>
			</li>
			<li>
				<button
					class={sortBy === 'name' && sortOrder === 'asc' ? 'active' : ''}
					onclick={() => handleSortOption('name-asc')}
				>
					Name (A-Z)
				</button>
			</li>
			<li>
				<button
					class={sortBy === 'name' && sortOrder === 'desc' ? 'active' : ''}
					onclick={() => handleSortOption('name-desc')}
				>
					Name (Z-A)
				</button>
			</li>
		</ul>
	</div>

	<!-- Organization Filter Dropdown -->
	<div class="dropdown dropdown-end">
		<button
			type="button"
			tabindex="0"
			class="btn btn-ghost btn-xs min-h-[44px] min-w-[44px] {organizationFilter ? 'btn-active' : ''}"
			title={organizationFilter || 'Filter by organization'}
		>
			<Building2 class="w-4 h-4" />
		</button>
		<ul
			tabindex="0"
			class="dropdown-content menu z-[1] p-2 shadow bg-base-100 rounded-box w-64 max-h-96 overflow-y-auto border border-base-300"
		>
			<li>
				<button
					class={!organizationFilter ? 'active' : ''}
					onclick={() => handleOrganizationSelect('')}
				>
					All Organizations
				</button>
			</li>
			{#if organizations.length > 0}
				<li><hr class="my-1" /></li>
				{#each organizations as org}
					<li>
						<button
							class={organizationFilter === org ? 'active' : ''}
							onclick={() => handleOrganizationSelect(org)}
						>
							{org}
						</button>
					</li>
				{/each}
			{/if}
		</ul>
	</div>
</div>

