<script lang="ts">
	import type { Bug } from '$lib/schemas/bug'
	import { ChevronDown } from 'lucide-svelte'

	interface Props {
		bug: Bug
		onStatusChange: (status: Bug['status']) => void
	}

	let { bug, onStatusChange }: Props = $props()

	const statusOptions: Array<{ value: Bug['status']; label: string }> = [
		{ value: 'new', label: 'New' },
		{ value: 'triage', label: 'Triage' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'testing', label: 'Testing' },
		{ value: 'resolved', label: 'Resolved' },
		{ value: 'closed', label: 'Closed' },
		{ value: 'reopened', label: 'Reopened' }
	]

	function getStatusBadgeClass(status: Bug['status']): string {
		const classes: Record<string, string> = {
			new: 'badge-info',
			triage: 'badge-warning',
			in_progress: 'badge-primary',
			testing: 'badge-secondary',
			resolved: 'badge-success',
			closed: 'badge-neutral',
			reopened: 'badge-error'
		}
		return classes[status] || 'badge-neutral'
	}

	function getStatusLabel(status: Bug['status']): string {
		return statusOptions.find(opt => opt.value === status)?.label || status
	}
</script>

<div class="dropdown dropdown-end">
	<label tabindex="0" class="btn btn-sm {getStatusBadgeClass(bug.status)}">
		{getStatusLabel(bug.status)}
		<ChevronDown class="w-4 h-4 ml-1" />
	</label>
	<ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow-lg border border-base-300">
		{#each statusOptions as option}
			<li>
				<button
					class="btn btn-sm btn-ghost justify-start {option.value === bug.status ? 'btn-active' : ''}"
					onclick={() => onStatusChange(option.value)}
				>
					{option.label}
				</button>
			</li>
		{/each}
	</ul>
</div>
