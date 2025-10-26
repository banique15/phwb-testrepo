<script lang="ts">
	interface Props {
		title: string
		value: string | number
		icon?: string
		iconColor?: string
		change?: {
			value: number
			period: string
			trend: 'up' | 'down' | 'neutral'
		}
		subtitle?: string
		loading?: boolean
		href?: string
		onClick?: () => void
		size?: 'sm' | 'md' | 'lg'
		variant?: 'default' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error'
	}

	let {
		title,
		value,
		icon,
		iconColor,
		change,
		subtitle,
		loading = false,
		href,
		onClick,
		size = 'md',
		variant = 'default'
	}: Props = $props()

	function handleClick() {
		if (onClick) {
			onClick()
		} else if (href) {
			window.location.href = href
		}
	}

	function formatValue(val: string | number): string {
		if (typeof val === 'number') {
			// Format large numbers with commas
			if (val >= 1000000) {
				return (val / 1000000).toFixed(1) + 'M'
			} else if (val >= 1000) {
				return (val / 1000).toFixed(1) + 'K'
			} else {
				return val.toLocaleString()
			}
		}
		return String(val)
	}

	function formatChange(changeVal: number): string {
		const sign = changeVal >= 0 ? '+' : ''
		return `${sign}${changeVal.toFixed(1)}%`
	}

	const sizeClasses = {
		sm: {
			card: 'p-4',
			icon: 'text-2xl',
			value: 'text-2xl',
			title: 'text-sm',
			subtitle: 'text-xs',
			change: 'text-xs'
		},
		md: {
			card: 'p-6',
			icon: 'text-3xl',
			value: 'text-3xl',
			title: 'text-base',
			subtitle: 'text-sm',
			change: 'text-sm'
		},
		lg: {
			card: 'p-8',
			icon: 'text-4xl',
			value: 'text-4xl',
			title: 'text-lg',
			subtitle: 'text-base',
			change: 'text-base'
		}
	}

	const variantClasses = {
		default: 'bg-base-100 border-base-300',
		primary: 'bg-primary/5 border-primary/20',
		secondary: 'bg-secondary/5 border-secondary/20',
		accent: 'bg-accent/5 border-accent/20',
		info: 'bg-info/5 border-info/20',
		success: 'bg-success/5 border-success/20',
		warning: 'bg-warning/5 border-warning/20',
		error: 'bg-error/5 border-error/20'
	}

	const classes = sizeClasses[size]
	const clickable = onClick || href
</script>

<div
	class="card border {variantClasses[variant]} {classes.card} transition-all duration-200 min-w-[140px]"
	class:cursor-pointer={clickable}
	class:hover:scale-[1.02]={clickable}
	onclick={handleClick}
	role={clickable ? 'button' : undefined}
	tabindex={clickable ? 0 : undefined}
	onkeydown={(e) => clickable && e.key === 'Enter' && handleClick()}
>
	{#if loading}
		<div class="flex items-center justify-center">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else}
		<div class="flex flex-col space-y-3">
			<!-- Header with title and icon -->
			<div class="flex items-center justify-between">
				<h3 class="font-medium {classes.title} text-base-content/70 truncate">
					{title}
				</h3>
				{#if icon}
					<div class="{classes.icon} {iconColor || 'text-base-content/30'} flex-shrink-0">
						<span class="block">{icon}</span>
					</div>
				{/if}
			</div>
			
			<!-- Value and change indicator -->
			<div class="flex items-center gap-x-2">
				<div class="font-bold {classes.value} text-base-content">
					{formatValue(value)}
				</div>
				{#if change}
					<span 
						class="inline-flex items-center gap-x-1 {classes.change} font-medium"
						class:text-success={change.trend === 'up'}
						class:text-error={change.trend === 'down'}
						class:text-base-content={change.trend === 'neutral'}
						class:opacity-70={change.trend === 'neutral'}
					>
						{#if change.trend === 'up'}
							<svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
								<polyline points="16 7 22 7 22 13"/>
							</svg>
						{:else if change.trend === 'down'}
							<svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/>
								<polyline points="16 17 22 17 22 11"/>
							</svg>
						{:else}
							<svg class="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="5" y1="12" x2="19" y2="12"/>
							</svg>
						{/if}
						{formatChange(change.value)}
					</span>
				{/if}
			</div>
			
			<!-- Subtitle and period -->
			{#if subtitle || change?.period}
				<div class="flex items-center justify-between">
					{#if subtitle}
						<p class="{classes.subtitle} text-base-content/60 truncate">
							{subtitle}
						</p>
					{/if}
					{#if change?.period}
						<span class="{classes.change} text-base-content/50 truncate">
							{change.period}
						</span>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>