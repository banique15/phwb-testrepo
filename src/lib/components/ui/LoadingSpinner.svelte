<script lang="ts">
	interface Props {
		size?: 'sm' | 'md' | 'lg'
		text?: string
	}
	
	let { size = 'md', text }: Props = $props()
	
	const sizeClasses = {
		sm: 'loading-sm',
		md: 'loading-md', 
		lg: 'loading-lg'
	}
</script>

<div class="flex flex-col items-center justify-center p-4">
	<span class="loading loading-spinner {sizeClasses[size]}"></span>
	{#if text}
		<p class="mt-2 text-sm opacity-60">{text}</p>
	{/if}
</div>