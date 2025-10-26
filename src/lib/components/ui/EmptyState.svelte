<script lang="ts">
	interface Props {
		icon?: string
		title?: string
		message?: string
		size?: 'sm' | 'md' | 'lg'
		actionText?: string
		onAction?: () => void
		showCard?: boolean
	}

	let {
		icon = '📄',
		title = 'No data found',
		message = 'There are no items to display.',
		size = 'md',
		actionText,
		onAction,
		showCard = true
	}: Props = $props()

	const sizeConfig = {
		sm: {
			iconSize: 'text-4xl',
			titleSize: 'text-lg',
			messageSize: 'text-sm',
			padding: 'py-8'
		},
		md: {
			iconSize: 'text-6xl',
			titleSize: 'text-xl',
			messageSize: 'text-base',
			padding: 'py-12'
		},
		lg: {
			iconSize: 'text-8xl',
			titleSize: 'text-2xl',
			messageSize: 'text-lg',
			padding: 'py-16'
		}
	}

	const config = sizeConfig[size]
</script>

<div class="w-full">
	{#if showCard}
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<div class="text-center {config.padding}">
					<div class="mb-4">
						<span class="{config.iconSize}">{icon}</span>
					</div>
					<h3 class="font-semibold {config.titleSize} mb-2">
						{title}
					</h3>
					<p class="text-base-content/70 {config.messageSize} mb-4">
						{message}
					</p>
					{#if actionText && onAction}
						<button 
							class="btn btn-primary"
							onclick={onAction}
						>
							{actionText}
						</button>
					{/if}
					{#if $$slots.actions}
						<div class="mt-4">
							<slot name="actions" />
						</div>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<div class="text-center {config.padding}">
			<div class="mb-4">
				<span class="{config.iconSize}">{icon}</span>
			</div>
			<h3 class="font-semibold {config.titleSize} mb-2">
				{title}
			</h3>
			<p class="text-base-content/70 {config.messageSize} mb-4">
				{message}
			</p>
			{#if actionText && onAction}
				<button 
					class="btn btn-primary"
					onclick={onAction}
				>
					{actionText}
				</button>
			{/if}
			{#if $$slots.actions}
				<div class="mt-4">
					<slot name="actions" />
				</div>
			{/if}
		</div>
	{/if}
</div>