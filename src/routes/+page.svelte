<script lang="ts">
	import { authStore } from '$lib/auth'
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import type { DashboardPageData } from './+page.server'

	interface Props {
		data: DashboardPageData
	}

	let { data }: Props = $props()

	const fallbackStats = { artists: 0, events: 0, partners: 0, facilities: 0, locations: 0 }
	const hasStats = $derived(Boolean(data?.stats))
	const stats = $derived(data?.stats ?? fallbackStats)
</script>

<ErrorBoundary>
	{#if !hasStats}
		<div class="min-h-full flex items-center justify-center p-8">
			<LoadingSpinner size="lg" text="Loading dashboard statistics..." />
		</div>
	{:else}
		<div class="h-full flex flex-col">
			<!-- Fixed Dashboard Header -->
			<div class="sticky top-0 z-30 flex-none px-4 py-2 bg-base-100 border-b border-base-200 shadow-sm">
				<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
					<div>
						<h1 class="text-xl sm:text-2xl font-bold text-base-content leading-tight">Dashboard</h1>
						<p class="text-sm text-base-content/60">
							Welcome back{#if data.firstName}, <span class="font-medium">{data.firstName}</span>{/if}
						</p>
					</div>
					<div class="text-xs sm:text-sm text-base-content/50">
						{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
					</div>
				</div>
			</div>

			<!-- Scrollable Content -->
			<div class="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 fade-in">

				<!-- Summary Stats -->
				<div>
					<h2 class="text-lg font-bold text-base-content mb-3">Overview</h2>
					<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
					<a href="/artists" class="card bg-gradient-to-br from-base-100 to-base-200 shadow-depth-1 border border-base-300 transition-all duration-300 hover:scale-105 cursor-pointer group">
						<div class="card-body p-4 lg:p-6">
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<p class="text-xs lg:text-sm font-medium text-base-content/60 group-hover:text-primary transition-colors">Artists</p>
									<p class="text-2xl lg:text-3xl font-bold text-base-content mt-2">{stats.artists}</p>
									<p class="text-xs text-base-content/50 mt-1 hidden lg:block">Total registered</p>
								</div>
								<div class="text-primary/20 group-hover:text-primary/40 transition-colors">
									<svg class="w-8 h-8 lg:w-10 lg:h-10" fill="currentColor" viewBox="0 0 20 20">
										<path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
									</svg>
								</div>
							</div>
						</div>
					</a>

					<a href="/events" class="card bg-gradient-to-br from-base-100 to-base-200 shadow-depth-1 border border-base-300 transition-all duration-300 hover:scale-105 cursor-pointer group">
						<div class="card-body p-4 lg:p-6">
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<p class="text-xs lg:text-sm font-medium text-base-content/60 group-hover:text-secondary transition-colors">Events</p>
									<p class="text-2xl lg:text-3xl font-bold text-base-content mt-2">{stats.events}</p>
									<p class="text-xs text-base-content/50 mt-1 hidden lg:block">Scheduled</p>
								</div>
								<div class="text-secondary/20 group-hover:text-secondary/40 transition-colors">
									<svg class="w-8 h-8 lg:w-10 lg:h-10" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
									</svg>
								</div>
						</div>
						</div>
					</a>

					<a href="/partners" class="card bg-gradient-to-br from-base-100 to-base-200 shadow-depth-1 border border-base-300 transition-all duration-300 hover:scale-105 cursor-pointer group">
						<div class="card-body p-4 lg:p-6">
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<p class="text-xs lg:text-sm font-medium text-base-content/60 group-hover:text-accent transition-colors">Partners</p>
									<p class="text-2xl lg:text-3xl font-bold text-base-content mt-2">{stats.partners}</p>
									<p class="text-xs text-base-content/50 mt-1 hidden lg:block">Active partnerships</p>
								</div>
								<div class="text-accent/20 group-hover:text-accent/40 transition-colors">
									<svg class="w-8 h-8 lg:w-10 lg:h-10" fill="currentColor" viewBox="0 0 20 20">
										<path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
									</svg>
								</div>
						</div>
						</div>
					</a>

					<a href="/facilities" class="card bg-gradient-to-br from-base-100 to-base-200 shadow-depth-1 border border-base-300 transition-all duration-300 hover:scale-105 cursor-pointer group">
						<div class="card-body p-4 lg:p-6">
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<p class="text-xs lg:text-sm font-medium text-base-content/60 group-hover:text-info transition-colors">Facilities</p>
									<p class="text-2xl lg:text-3xl font-bold text-base-content mt-2">{stats.facilities}</p>
									<p class="text-xs text-base-content/50 mt-1 hidden lg:block">{stats.locations} locations</p>
								</div>
								<div class="text-info/20 group-hover:text-info/40 transition-colors">
									<svg class="w-8 h-8 lg:w-10 lg:h-10" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clip-rule="evenodd"/>
									</svg>
								</div>
						</div>
						</div>
					</a>
					</div>
				</div>

				<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
					<div class="card bg-base-100 shadow-depth-1 border border-base-300">
						<div class="card-body p-4">
							<h2 class="text-base font-bold text-base-content mb-3">Recent Activity</h2>
							<div class="space-y-3">
								<div class="flex items-center gap-3 p-3 rounded-lg bg-base-200/50">
									<div class="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
									<div class="text-sm text-base-content/60">No recent activity</div>
								</div>
							</div>
						</div>
					</div>

					<div class="card bg-base-100 shadow-depth-1 border border-base-300">
						<div class="card-body p-4">
							<h2 class="text-base font-bold text-base-content mb-3">Quick Actions</h2>
							<div class="grid grid-cols-2 gap-3">
								<a href="/artists" data-sveltekit-preload-data="hover" class="btn btn-primary btn-sm gap-2 justify-start">
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
										<path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"/>
									</svg>
									<span>Add Artist</span>
								</a>
								<a href="/events" data-sveltekit-preload-data="hover" class="btn btn-secondary btn-sm gap-2 justify-start">
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/>
									</svg>
									<span>Create Event</span>
								</a>
								<a href="/venues" data-sveltekit-preload-data="hover" class="btn btn-accent btn-sm gap-2 justify-start">
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
									</svg>
									<span>Add Venue</span>
								</a>
								<a href="/reports" data-sveltekit-preload-data="hover" class="btn btn-outline btn-sm gap-2 justify-start">
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
										<path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
									</svg>
									<span>View Reports</span>
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</ErrorBoundary>
