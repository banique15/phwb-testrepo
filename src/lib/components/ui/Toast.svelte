<script lang="ts">
	import { toastStore, removeToast, type Toast } from '$lib/stores/toast'
	import { fly } from 'svelte/transition'
	import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-svelte'
	import type { ComponentType, SvelteComponent } from 'svelte'
	import { getToastIcon } from '$lib/utils/icon-mapping'

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

	function getToastIconComponent(type: Toast['type']): ComponentType<SvelteComponent> {
		return getToastIcon(type)
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
				<svelte:component this={getToastIconComponent(toast.type)} class="w-5 h-5 flex-shrink-0" />
				<div class="flex-1">
					<div class="text-sm font-medium">{toast.message}</div>
				</div>
				<button 
					class="btn btn-sm btn-circle btn-ghost"
					onclick={() => removeToast(toast.id)}
				>
					<X class="w-4 h-4" />
				</button>
			</div>
		</div>
	{/each}
</div>