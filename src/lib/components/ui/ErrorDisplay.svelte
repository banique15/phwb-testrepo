<script lang="ts">
	import { errorStore } from '$lib/stores/error'
	import type { AppError } from '$lib/stores/error'
	
	let errors = $derived($errorStore)
	
	function getAlertClass(type: string) {
		switch (type) {
			case 'error': return 'alert-error'
			case 'warning': return 'alert-warning'
			case 'info': return 'alert-info'
			default: return 'alert-info'
		}
	}
</script>

<div class="fixed top-4 right-4 z-50 space-y-2 max-w-md">
	{#each errors as error (error.id)}
		<div class="alert {getAlertClass(error.type)} shadow-lg">
			<div>
				<span>{error.message}</span>
			</div>
			<div class="flex-none">
				<button class="btn btn-sm btn-circle btn-ghost" onclick={() => errorStore.remove(error.id)}>
					✕
				</button>
			</div>
		</div>
	{/each}
</div>