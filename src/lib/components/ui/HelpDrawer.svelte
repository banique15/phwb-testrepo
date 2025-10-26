<script lang="ts">
	interface HelpSection {
		id: string
		title: string
		content: string
		icon?: string
	}

	interface Props {
		isOpen: boolean
		sections: HelpSection[]
		title: string
		onClose: () => void
	}

	let { isOpen = $bindable(), sections, title, onClose }: Props = $props()

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose()
		}
	}

	function handleEscapeKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose()
		}
	}
</script>

<svelte:window on:keydown={handleEscapeKey} />

{#if isOpen}
	<!-- Backdrop -->
	<div 
		class="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
		on:click={handleBackdropClick}
		role="button"
		tabindex="-1"
	></div>

	<!-- Help Drawer -->
	<div class="fixed top-0 right-0 h-full w-full md:w-96 bg-base-100 shadow-xl z-50 transform transition-transform duration-300 ease-in-out">
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b border-base-300">
			<div class="flex items-center gap-2">
				<span class="text-xl">❓</span>
				<h2 class="text-lg font-semibold">{title} Help</h2>
			</div>
			<button 
				class="btn btn-sm btn-ghost btn-circle"
				on:click={onClose}
				aria-label="Close help"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Content -->
		<div class="overflow-y-auto h-full pb-20 p-4">
			<div class="space-y-6">
				{#each sections as section}
					<div class="collapse collapse-arrow bg-base-200">
						<input type="checkbox" class="peer" />
						<div class="collapse-title text-sm font-medium flex items-center gap-2">
							{#if section.icon}
								<span>{section.icon}</span>
							{/if}
							{section.title}
						</div>
						<div class="collapse-content">
							<div class="prose prose-sm max-w-none">
								{@html section.content}
							</div>
						</div>
					</div>
				{/each}

				<!-- Quick Tips -->
				<div class="bg-info bg-opacity-10 p-4 rounded-lg border border-info border-opacity-30">
					<h3 class="font-semibold text-info flex items-center gap-2 mb-2">
						💡 Quick Tip
					</h3>
					<p class="text-sm opacity-80">
						Press <kbd class="kbd kbd-xs">Ctrl</kbd> + <kbd class="kbd kbd-xs">?</kbd> to quickly open help on any page, or <kbd class="kbd kbd-xs">Esc</kbd> to close this panel.
					</p>
				</div>
			</div>
		</div>
	</div>
{/if}