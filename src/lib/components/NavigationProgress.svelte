<script lang="ts">
	import { navigating } from '$app/stores'

	let progress = $state(0)
	let isNavigating = $derived($navigating !== null)

	// Simulate progress bar animation
	$effect(() => {
		if (isNavigating) {
			progress = 0
			const interval = setInterval(() => {
				if (progress < 90) {
					progress += Math.random() * 30
					if (progress > 90) progress = 90
				}
			}, 300)

			return () => clearInterval(interval)
		} else {
			progress = 100
			setTimeout(() => {
				progress = 0
			}, 400)
		}
	})
</script>

<!-- Navigation progress bar -->
{#if isNavigating || progress > 0}
	<div
		class="fixed top-0 left-0 right-0 h-1 bg-primary z-[100] transition-all duration-300"
		style="width: {progress}%; opacity: {progress === 100 ? 0 : 1}"
		role="progressbar"
		aria-valuenow={progress}
		aria-valuemin="0"
		aria-valuemax="100"
	></div>
{/if}
