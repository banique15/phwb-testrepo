<script lang="ts">
	import { Settings, Bell, DollarSign } from 'lucide-svelte';

	const settingsGroups = [
		{
			title: 'Notifications',
			description: 'Configure email notification templates, policies, and delivery settings.',
			href: '/settings/notifications',
			icon: Bell
		},
		{
			title: 'Rate Cards',
			description: 'Manage artist compensation rate cards and program-specific fee rules.',
			href: '/settings/rate-cards',
			icon: DollarSign
		}
	];
</script>

<div class="p-6 max-w-3xl mx-auto">
	<div class="flex items-center gap-3 mb-6">
		<Settings class="w-6 h-6 text-primary" />
		<h1 class="text-2xl font-bold">Settings</h1>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		{#each settingsGroups as group}
			<a
				href={group.href}
				class="card bg-base-200 hover:bg-base-300 transition-colors duration-200 shadow-sm"
			>
				<div class="card-body gap-3">
					<div class="flex items-center gap-3">
						<div class="p-2 rounded-lg bg-primary/10 text-primary">
							<group.icon class="w-5 h-5" />
						</div>
						<h2 class="card-title text-base">{group.title}</h2>
					</div>
					<p class="text-sm text-base-content/70">{group.description}</p>
				</div>
			</a>
		{/each}
	</div>
</div>
