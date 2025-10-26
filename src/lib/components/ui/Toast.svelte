<script lang="ts">
	import { toastStore, removeToast, type Toast } from '$lib/stores/toast'
	import { fly } from 'svelte/transition'

	let toasts = $state<Toast[]>([])

	// Subscribe to toast store
	$effect(() => {
		const unsubscribe = toastStore.subscribe((state) => {
			toasts = state.toasts
		})
		return unsubscribe
	})

	function getToastClasses(type: Toast['type']): string {
		switch (type) {
			case 'success':
				return 'alert-success'
			case 'error':
				return 'alert-error'
			case 'warning':
				return 'alert-warning'
			case 'info':
				return 'alert-info'
			default:
				return 'alert-info'
		}
	}

	function getToastIcon(type: Toast['type']): string {
		switch (type) {
			case 'success':
				return '✅'
			case 'error':
				return '❌'
			case 'warning':
				return '⚠️'
			case 'info':
				return 'ℹ️'
			default:
				return 'ℹ️'
		}
	}
</script>

<!-- Toast Container -->
<div class="toast toast-top toast-end z-50">
	{#each toasts as toast (toast.id)}
		<div 
			class="alert {getToastClasses(toast.type)} shadow-lg max-w-96"
			in:fly={{ x: 300, duration: 300 }}
			out:fly={{ x: 300, duration: 300 }}
		>
			<div class="flex items-center gap-2">
				<span class="text-lg">{getToastIcon(toast.type)}</span>
				<div class="flex-1">
					<div class="text-sm font-medium">{toast.message}</div>
				</div>
				<button 
					class="btn btn-sm btn-circle btn-ghost"
					onclick={() => removeToast(toast.id)}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>
	{/each}
</div>