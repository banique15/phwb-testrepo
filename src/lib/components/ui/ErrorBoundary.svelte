<script lang="ts">
	import { errorStore } from '$lib/stores/error'
	
	interface Props {
		children: any
	}
	
	let { children }: Props = $props()
	let hasError = $state(false)
	let errorMessage = $state('')
	
	function handleError(error: any) {
		console.error('ErrorBoundary caught error:', error)
		hasError = true
		errorMessage = error?.message || 'An unexpected error occurred'
		errorStore.handleError(error, 'ErrorBoundary')
	}
	
	function retry() {
		hasError = false
		errorMessage = ''
	}
</script>

{#if hasError}
	<div class="alert alert-error">
		<div>
			<h3 class="font-bold">Something went wrong!</h3>
			<div class="text-xs">{errorMessage}</div>
		</div>
		<div class="flex-none">
			<button class="btn btn-sm btn-outline" onclick={retry}>
				Try Again
			</button>
		</div>
	</div>
{:else}
	{@render children()}
{/if}