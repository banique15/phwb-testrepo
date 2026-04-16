<script lang="ts">
	import { page } from '$app/stores';
	import { Settings, Bell, CreditCard, ChevronRight } from 'lucide-svelte';

	const settingsItems = [
		{
			name: 'Notifications',
			href: '/settings/notifications',
			description: 'Email templates & policies'
		},
		{
			name: 'Rate Cards',
			href: '/settings/rate-cards',
			description: 'Payroll rate management'
		}
	];

	function isActive(href: string): boolean {
		return $page.url.pathname.startsWith(href);
	}
</script>

<aside class="w-52 flex-none bg-base-200 border-r border-base-300 flex flex-col h-full overflow-y-auto">
	<!-- Header -->
	<div class="flex items-center gap-2 px-4 py-4 border-b border-base-300">
		<Settings class="w-4 h-4 text-primary flex-none" />
		<span class="text-sm font-semibold text-base-content uppercase tracking-wide">Settings</span>
	</div>

	<!-- Settings nav items -->
	<nav class="flex-1 p-2">
		<ul class="space-y-1">
			{#each settingsItems as item}
				<li>
					<a
						href={item.href}
						data-sveltekit-preload-data="hover"
						data-sveltekit-preload-code="eager"
						class="flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 text-sm group"
						class:bg-primary={isActive(item.href)}
						class:text-primary-content={isActive(item.href)}
						class:shadow-sm={isActive(item.href)}
						class:hover:bg-base-300={!isActive(item.href)}
						class:text-base-content={!isActive(item.href)}
						aria-current={isActive(item.href) ? 'page' : undefined}
					>
						{#if item.name === 'Notifications'}
							<Bell
								class="w-4 h-4 flex-none {isActive(item.href)
									? 'text-primary-content'
									: 'text-base-content/60 group-hover:text-base-content'}"
							/>
						{:else if item.name === 'Rate Cards'}
							<CreditCard
								class="w-4 h-4 flex-none {isActive(item.href)
									? 'text-primary-content'
									: 'text-base-content/60 group-hover:text-base-content'}"
							/>
						{/if}
						<div class="flex-1 min-w-0">
							<div class="font-medium truncate">{item.name}</div>
							<div
								class="text-xs truncate {isActive(item.href)
									? 'text-primary-content/70'
									: 'text-base-content/50'}"
							>
								{item.description}
							</div>
						</div>
						{#if isActive(item.href)}
							<ChevronRight class="w-3 h-3 flex-none text-primary-content/70" />
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</aside>
