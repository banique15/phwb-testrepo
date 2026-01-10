<script lang="ts">
	import type { Bug } from '$lib/schemas/bug'
	import { ChevronDown } from 'lucide-svelte'

	interface Props {
		bug: Bug
		users: Array<{ id: string; full_name: string | null; avatar_url: string | null }>
		onAssigneeChange: (userId: string | null) => void
	}

	let { bug, users, onAssigneeChange }: Props = $props()

	function getAssigneeName(): string {
		if (!bug.assigned_to) return 'Unassigned'
		const user = users.find(u => u.id === bug.assigned_to)
		return user?.full_name || 'Unknown'
	}
</script>

<div class="dropdown dropdown-end">
	<label tabindex="0" class="btn btn-sm btn-ghost">
		{getAssigneeName()}
		<ChevronDown class="w-4 h-4 ml-1" />
	</label>
	<ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow-lg border border-base-300">
		<li>
			<button
				class="btn btn-sm btn-ghost justify-start {!bug.assigned_to ? 'btn-active' : ''}"
				onclick={() => onAssigneeChange(null)}
			>
				Unassigned
			</button>
		</li>
		{#each users as user}
			<li>
				<button
					class="btn btn-sm btn-ghost justify-start {user.id === bug.assigned_to ? 'btn-active' : ''}"
					onclick={() => onAssigneeChange(user.id)}
				>
					{user.full_name || 'Unknown'}
				</button>
			</li>
		{/each}
	</ul>
</div>
