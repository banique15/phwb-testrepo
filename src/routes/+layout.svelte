<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { authStore } from '$lib/auth';
	import { page } from '$app/stores';
	import { sidebarStore } from '$lib/stores/sidebar';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import NavigationProgress from '$lib/components/NavigationProgress.svelte';
	import ErrorDisplay from '$lib/components/ui/ErrorDisplay.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';

	let { children } = $props();

	onMount(() => {
		authStore.initialize();
	});

	const isLoginPage = $derived($page.url.pathname === '/login');
	const shouldShowSidebar = $derived(!$sidebarStore.forceCollapse);
</script>

<!-- Global navigation progress indicator -->
<NavigationProgress />

{#if isLoginPage}
	{@render children()}
{:else}
	<div class="drawer" class:lg:drawer-open={shouldShowSidebar}>
		<input id="drawer-toggle" type="checkbox" class="drawer-toggle" />
		
		<div class="drawer-content flex flex-col h-screen">
			<!-- Mobile header with logo and menu button -->
			<div class="lg:hidden flex-none bg-base-100 shadow-sm px-4 py-2">
				<div class="flex items-center justify-between">
					<a href="/" class="flex items-center">
						<img
							src="/sfh-logo.png"
							alt="Sing for Hope"
							class="h-12 w-auto"
						/>
					</a>
					<label for="drawer-toggle" class="btn btn-square btn-ghost">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
						</svg>
					</label>
				</div>
			</div>

			<!-- Main content with bottom padding for mobile nav -->
			<main class="flex-1 bg-base-100 overflow-hidden min-h-0 pb-20 lg:pb-0">
				{@render children()}
			</main>

			<!-- Bottom Navigation (Mobile only) -->
			<BottomNav />
		</div>
		
		<Sidebar />
	</div>
	
	<!-- Global Error Display -->
	<ErrorDisplay />
	
	<!-- Toast Notifications -->
	<Toast />
{/if}
