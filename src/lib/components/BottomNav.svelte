<script lang="ts">
	import { page } from '$app/stores';

	const navItems = [
		{
			name: 'Home',
			href: '/',
			icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
			disabled: false
		},
		{
			name: 'Artists',
			href: '/artists',
			icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
			disabled: false
		},
		{
			name: 'Events',
			href: '/events',
			icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
			disabled: false
		},
		{
			name: 'Payroll',
			href: '/payroll',
			icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
			disabled: false
		},
		{
			name: 'Reports',
			href: '/reports',
			icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
			disabled: false
		}
	];

	function isActive(href: string): boolean {
		if (href === '/') {
			return $page.url.pathname === '/';
		}
		return $page.url.pathname.startsWith(href);
	}
</script>

<!-- Fixed bottom navigation - only visible on mobile -->
<div class="fixed bottom-0 left-0 right-0 lg:hidden z-50 border-t border-base-300 bg-base-100 shadow-lg">
	<div class="grid grid-cols-5 h-16">
		{#each navItems as item}
			{#if item.disabled}
				<span
					class="flex flex-col items-center justify-center gap-1 opacity-40 cursor-not-allowed"
					aria-disabled="true"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
					</svg>
					<span class="text-[10px] font-medium">{item.name}</span>
				</span>
			{:else}
				<a
					href={item.href}
					data-sveltekit-preload-data="tap"
					data-sveltekit-preload-code="eager"
					class="flex flex-col items-center justify-center gap-1 transition-colors duration-200 hover:bg-base-200"
					class:text-primary={isActive(item.href)}
					class:bg-base-200={isActive(item.href)}
					aria-current={isActive(item.href) ? 'page' : undefined}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
					</svg>
					<span class="text-[10px] font-medium">{item.name}</span>
				</a>
			{/if}
		{/each}
	</div>
</div>
