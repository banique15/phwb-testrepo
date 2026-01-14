<script lang="ts">
	import type { ComponentType, SvelteComponent } from 'svelte'
	import { getRequirementIcon as getRequirementIconFromMapping } from '$lib/utils/icon-mapping'
	
	interface Props {
		requirements?: any
	}
	
	let { requirements }: Props = $props()
	
	// Parse requirements data safely
	let requirementsList = $derived.by(() => {
		if (!requirements) return []
		
		// Handle different possible formats
		if (Array.isArray(requirements)) {
			return requirements.map(req => {
				if (typeof req === 'string') {
					return { key: 'Requirement', value: req, type: 'text' }
				}
				return req
			})
		}
		
		if (typeof requirements === 'object') {
			// Convert object to key-value pairs
			return Object.entries(requirements).map(([key, value]) => ({
				key: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
				value: value,
				type: typeof value === 'boolean' ? 'boolean' : 'text'
			}))
		}
		
		// Try to parse as JSON string
		if (typeof requirements === 'string') {
			try {
				const parsed = JSON.parse(requirements)
				if (Array.isArray(parsed)) {
					return parsed.map(req => {
						if (typeof req === 'string') {
							return { key: 'Requirement', value: req, type: 'text' }
						}
						return req
					})
				}
				if (typeof parsed === 'object') {
					return Object.entries(parsed).map(([key, value]) => ({
						key: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
						value: value,
						type: typeof value === 'boolean' ? 'boolean' : 'text'
					}))
				}
			} catch {
				// If parsing fails, treat as single text requirement
				return [{ key: 'Requirement', value: requirements, type: 'text' }]
			}
		}
		
		return []
	})
	
	function getRequirementIcon(key: string, value: any): ComponentType<SvelteComponent> {
		return getRequirementIconFromMapping(key)
	}
	
	function formatValue(value: any, type: string) {
		if (type === 'boolean') {
			return value ? 'Yes' : 'No'
		}
		if (Array.isArray(value)) {
			return value.join(', ')
		}
		if (typeof value === 'object') {
			return JSON.stringify(value, null, 2)
		}
		return String(value)
	}
</script>

{#if requirementsList.length > 0}
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		{#each requirementsList as requirement}
			<div class="bg-base-200 p-4 rounded-lg">
				<div class="flex items-start gap-3">
					<svelte:component this={getRequirementIcon(requirement.key, requirement.value)} class="w-6 h-6 flex-shrink-0 mt-0.5" />
					<div class="flex-1">
						<h4 class="font-medium text-sm mb-1 capitalize">
							{requirement.key}
						</h4>
						<div class="text-base">
							{#if requirement.type === 'boolean'}
								<span class="badge {requirement.value ? 'badge-success' : 'badge-outline'}">
									{formatValue(requirement.value, requirement.type)}
								</span>
							{:else}
								<p class="whitespace-pre-wrap">
									{formatValue(requirement.value, requirement.type)}
								</p>
							{/if}
						</div>
						
						{#if requirement.priority}
							<div class="mt-2">
								<span class="badge badge-sm {requirement.priority === 'high' ? 'badge-error' : requirement.priority === 'medium' ? 'badge-warning' : 'badge-outline'}">
									{requirement.priority} priority
								</span>
							</div>
						{/if}
						
						{#if requirement.notes}
							<div class="text-xs italic opacity-70 mt-2">
								{requirement.notes}
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
{:else}
	<div class="bg-base-200 p-4 rounded-lg text-center opacity-60">
		<svelte:component this={getRequirementIcon('', null)} class="w-16 h-16 mx-auto text-base-content/70" />
		<p class="mt-2 text-sm">No specific requirements defined</p>
	</div>
{/if}