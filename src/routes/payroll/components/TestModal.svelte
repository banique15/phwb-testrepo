<script lang="ts">
	import { createEventDispatcher } from 'svelte'

	interface Props {
		open?: boolean
	}

	let { open = false }: Props = $props()

	const dispatch = createEventDispatcher<{
		close: void
	}>()

	function handleClose() {
		dispatch('close')
	}
</script>

{#if open}
	<div class="modal modal-open">
		<div class="modal-box max-w-md">
			<div class="flex items-center justify-between mb-4">
				<h3 class="font-bold text-lg">Test Button</h3>
				<button class="btn btn-sm btn-circle btn-ghost" onclick={handleClose}>✕</button>
			</div>

			<div class="py-6 text-center">
				<p class="text-xl font-semibold">TEST COMPLETE</p>
			</div>

			<div class="modal-action">
				<button class="btn btn-primary" onclick={handleClose}>Close</button>
			</div>
		</div>
	</div>
{/if}
