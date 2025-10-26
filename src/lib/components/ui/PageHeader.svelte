<script lang="ts">
	interface BreadcrumbItem {
		label: string
		href?: string
		current?: boolean
	}

	interface Props {
		title: string
		subtitle?: string
		icon?: string
		breadcrumbs?: BreadcrumbItem[]
		showBackButton?: boolean
		backHref?: string
		onBack?: () => void
		actions?: import('svelte').Snippet
		stats?: import('svelte').Snippet
		tabs?: import('svelte').Snippet
	}

	let {
		title,
		subtitle,
		icon,
		breadcrumbs = [],
		showBackButton = false,
		backHref,
		onBack,
		actions,
		stats,
		tabs
	}: Props = $props()

	function handleBackClick() {
		if (onBack) {
			onBack()
		} else if (backHref) {
			window.location.href = backHref
		} else {
			history.back()
		}
	}
</script>

<div class="space-y-2">
	<!-- Breadcrumbs -->
	{#if breadcrumbs.length > 0}
		<div class="text-sm breadcrumbs">
			<ul>
				{#each breadcrumbs as crumb}
					<li>
						{#if crumb.href && !crumb.current}
							<a href={crumb.href} class="link link-hover">
								{crumb.label}
							</a>
						{:else}
							<span class="opacity-60">
								{crumb.label}
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Main Header -->
	<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
		<div class="flex items-center gap-3">
			{#if showBackButton}
				<button
					class="btn btn-circle btn-outline btn-sm"
					onclick={handleBackClick}
					aria-label="Go back"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
					</svg>
				</button>
			{/if}

			<div class="flex items-center gap-2">
				{#if icon}
					<div class="text-xl">
						{icon}
					</div>
				{/if}

				<div>
					<h1 class="text-xl sm:text-2xl font-bold text-base-content leading-tight">
						{title}
					</h1>
					{#if subtitle}
						<p class="text-sm text-base-content/70">
							{subtitle}
						</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- Actions -->
		{#if actions}
			<div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
				{@render actions()}
			</div>
		{/if}
	</div>

	<!-- Stats or Additional Info -->
	{#if stats}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
			{@render stats()}
		</div>
	{/if}

	<!-- Tabs or Navigation -->
	{#if tabs}
		<div class="border-b border-base-300">
			{@render tabs()}
		</div>
	{/if}
</div>