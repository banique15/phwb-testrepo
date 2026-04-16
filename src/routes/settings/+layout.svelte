<script lang="ts">
	import SettingsSidebar from '$lib/components/SettingsSidebar.svelte';

	let { children } = $props();
</script>

<div class="flex h-full w-full min-h-0 overflow-hidden">
	<!-- Second-level settings sidebar -->
	<SettingsSidebar />

	<!-- Settings page content -->
	<div class="flex-1 overflow-auto min-w-0">
		{@render children()}
	</div>
</div>
