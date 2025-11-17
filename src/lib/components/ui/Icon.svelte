<script lang="ts">
	import type { ComponentType, SvelteComponent } from 'svelte'
	import { FileText } from 'lucide-svelte'
	import { getIconFromEmoji } from '$lib/utils/icon-mapping'

	interface Props {
		icon?: string | ComponentType<SvelteComponent>
		class?: string
		size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | string
	}

	let { icon, class: className = '', size = 'md' }: Props = $props()

	const sizeClasses: Record<string, string> = {
		xs: 'w-3 h-3',
		sm: 'w-4 h-4',
		md: 'w-5 h-5',
		lg: 'w-6 h-6',
		xl: 'w-16 h-16',
		'2xl': 'w-24 h-24'
	}
	
	const sizeClass = $derived(sizeClasses[size] || sizeClasses.md)

	const iconComponent = $derived.by(() => {
		if (!icon) return FileText
		if (typeof icon === 'string') {
			return getIconFromEmoji(icon) || FileText
		}
		return icon
	})

	const isEmojiString = $derived.by(() => typeof icon === 'string' && !getIconFromEmoji(icon))
</script>

{#if isEmojiString}
	<span class="{sizeClass} {className}">{icon}</span>
{:else}
	<svelte:component this={iconComponent} class="{sizeClass} {className}" />
{/if}

