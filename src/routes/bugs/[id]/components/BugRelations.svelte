<script lang="ts">
	import { goto } from '$app/navigation'
	import { Link2, Copy, AlertTriangle } from 'lucide-svelte'

	interface Props {
		relations: Array<any>
	}

	let { relations }: Props = $props()

	function getRelationLabel(type: string): string {
		const labels: Record<string, string> = {
			duplicate: 'Duplicate of',
			related: 'Related to',
			blocks: 'Blocks',
			blocked_by: 'Blocked by',
			depends_on: 'Depends on'
		}
		return labels[type] || type
	}

	function getRelationIcon(type: string) {
		switch (type) {
			case 'duplicate':
				return Copy
			case 'blocks':
			case 'blocked_by':
				return AlertTriangle
			default:
				return Link2
		}
	}

	function getRelationColor(type: string): string {
		switch (type) {
			case 'duplicate':
				return 'badge-warning'
			case 'blocks':
			case 'blocked_by':
				return 'badge-error'
			default:
				return 'badge-info'
		}
	}
</script>

<div class="space-y-2">
	{#each relations as relation}
		<div class="flex items-center gap-2">
			<svelte:component this={getRelationIcon(relation.relation_type)} class="w-4 h-4 text-base-content/60" />
			<span class="badge badge-sm {getRelationColor(relation.relation_type)}">
				{getRelationLabel(relation.relation_type)}
			</span>
			{#if relation.related_bug}
				<button
					class="link link-primary text-sm"
					onclick={() => goto(`/bugs/${relation.related_bug.id}`)}
				>
					#{relation.related_bug.id} - {relation.related_bug.title}
				</button>
			{/if}
		</div>
	{:else}
		<p class="text-sm text-base-content/60">No related bugs</p>
	{/each}
</div>
