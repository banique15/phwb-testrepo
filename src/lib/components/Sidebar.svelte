<script lang="ts">
	import { page } from "$app/stores";
	import { browser } from "$app/environment";
	import { onMount } from "svelte";
	import { authStore } from "$lib/auth";
	import { sidebarStore } from "$lib/stores/sidebar";
	import { themeStore } from "$lib/stores/theme.svelte";
	import { supabase } from "$lib/supabase";
	import ThemeToggle from "./ThemeToggle.svelte";
	import type { Profile } from "$lib/schemas/profile";

	const navItems = [
		{ name: "Dashboard", href: "/", disabled: false },
		{ name: "Artists", href: "/artists", disabled: false },
		{ name: "Ensembles", href: "/ensembles", disabled: false },
		{ name: "Partners", href: "/partners", disabled: false },
		{ name: "Programs", href: "/programs", disabled: false },
		{ name: "Facilities", href: "/facilities", disabled: false },
		{ name: "Events", href: "/events", disabled: false },
		{ name: "Reports", href: "/reports", disabled: false },
		{ name: "Payroll", href: "/payroll", disabled: false },
	];

	let isMobile = $state(false);
	let isDrawerOpen = $state(false);
	let touchStartX = 0;
	let touchStartY = 0;
	let profile = $state<Profile | null>(null);

	// Load user profile when auth state changes
	$effect(() => {
		if ($authStore?.id) {
			loadProfile($authStore.id);
		} else {
			profile = null;
		}
	});

	async function loadProfile(userId: string) {
		const { data } = await supabase
			.from('profiles')
			.select('*')
			.eq('id', userId)
			.single();
		profile = data;
	}

	function isActive(href: string): boolean {
		if (href === "/") {
			return $page.url.pathname === "/";
		}
		return $page.url.pathname.startsWith(href);
	}

	function closeDrawer() {
		isDrawerOpen = false;
		const drawerToggle = document.getElementById(
			"drawer-toggle",
		) as HTMLInputElement;
		if (drawerToggle) {
			drawerToggle.checked = false;
		}
	}

	function handleNavClick() {
		if (isMobile) {
			closeDrawer();
		}
	}

	// Touch gesture handling for swipe to open/close
	function handleTouchStart(event: TouchEvent) {
		touchStartX = event.touches[0].clientX;
		touchStartY = event.touches[0].clientY;
	}

	function handleTouchEnd(event: TouchEvent) {
		if (!isMobile) return;

		const touchEndX = event.changedTouches[0].clientX;
		const touchEndY = event.changedTouches[0].clientY;
		const deltaX = touchEndX - touchStartX;
		const deltaY = touchEndY - touchStartY;

		// Check if it's a horizontal swipe (more horizontal than vertical)
		if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
			const drawerToggle = document.getElementById(
				"drawer-toggle",
			) as HTMLInputElement;
			if (!drawerToggle) return;

			if (deltaX > 0 && touchStartX < 50) {
				// Swipe right from left edge - open drawer
				drawerToggle.checked = true;
				isDrawerOpen = true;
			} else if (deltaX < 0 && isDrawerOpen) {
				// Swipe left when drawer is open - close drawer
				closeDrawer();
			}
		}
	}

	onMount(() => {
		if (browser) {
			// Detect mobile
			const mediaQuery = window.matchMedia("(max-width: 1024px)");
			isMobile = mediaQuery.matches;
			mediaQuery.addEventListener("change", (e) => {
				isMobile = e.matches;
			});

			// Listen for drawer state changes
			const drawerToggle = document.getElementById(
				"drawer-toggle",
			) as HTMLInputElement;
			if (drawerToggle) {
				drawerToggle.addEventListener("change", (e) => {
					isDrawerOpen = (e.target as HTMLInputElement).checked;
				});
			}

			// Subscribe to sidebar store for force collapse state
			const unsubscribeSidebar = sidebarStore.subscribe((state) => {
				if (state.forceCollapse && isDrawerOpen) {
					// Close mobile drawer when sidebar is forcefully collapsed
					closeDrawer();
				}
			});

			// Add touch event listeners to body for swipe gestures
			document.body.addEventListener("touchstart", handleTouchStart, {
				passive: true,
			});
			document.body.addEventListener("touchend", handleTouchEnd, {
				passive: true,
			});

			return () => {
				document.body.removeEventListener(
					"touchstart",
					handleTouchStart,
				);
				document.body.removeEventListener("touchend", handleTouchEnd);
				unsubscribeSidebar();
			};
		}
	});
</script>

<div class="drawer-side z-40">
	<label for="drawer-toggle" class="drawer-overlay"></label>
	<aside class="h-full w-48 bg-base-200 flex flex-col">
		<!-- Header -->
		<div
			class="w-full flex items-center justify-between p-4 border-b border-base-300"
		>
			<a href="/" class="flex items-center" onclick={handleNavClick}>
				<img
					src="/sfh-logo.png"
					alt="Sing for Hope"
					class="h-16 w-auto"
				/>
			</a>
			<div class="flex items-center gap-1">
				<ThemeToggle />
				{#if isMobile}
					<button
						class="btn btn-ghost btn-sm btn-circle lg:hidden"
						onclick={closeDrawer}
						aria-label="Close menu"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				{/if}
			</div>
		</div>

		<!-- Navigation -->
		<nav class="flex-1 overflow-y-auto w-full p-2">
			<ul class="menu p-0 space-y-1 w-full">
				{#each navItems as item}
					<li class="w-full">
						{#if item.disabled}
							<span
								class="flex items-center gap-3 py-3 px-4 w-full rounded-lg text-sm font-medium opacity-40 cursor-not-allowed text-base-content"
								aria-disabled="true"
							>
								<span>{item.name}</span>
							</span>
						{:else}
							<a
								href={item.href}
								data-sveltekit-preload-data="hover"
								data-sveltekit-preload-code="eager"
								class="flex items-center gap-3 py-3 px-4 transition-all duration-200 w-full rounded-lg text-sm font-medium"
								class:bg-primary={isActive(item.href)}
								class:text-primary-content={isActive(item.href)}
								class:shadow-sm={isActive(item.href)}
								class:hover:bg-base-300={!isActive(item.href)}
								class:text-base-content={!isActive(item.href)}
								onclick={handleNavClick}
								aria-current={isActive(item.href)
									? "page"
									: undefined}
							>
								<span>{item.name}</span>
							</a>
						{/if}
					</li>
				{/each}
			</ul>
		</nav>

		<!-- Footer with swipe hint for mobile -->
		{#if isMobile}
			<div class="p-2 border-t border-base-300 lg:hidden">
				<div class="text-xs text-base-content/60 text-center">
					Swipe from left edge to open menu
				</div>
			</div>
		{/if}

		<!-- User section -->
		{#if $authStore}
			<div class="p-4 border-t border-base-300">
				<div class="dropdown dropdown-top dropdown-start w-full">
					<div
						tabindex="0"
						role="button"
						class="btn btn-ghost w-full justify-start gap-3 p-2 h-auto"
					>
						{#if profile?.avatar_url}
							<div class="avatar">
								<div class="w-8 rounded-full">
									<img src={profile.avatar_url} alt="Avatar" />
								</div>
							</div>
						{:else}
							<div class="avatar placeholder">
								<div
									class="bg-primary text-primary-content rounded-full w-8"
								>
									<span class="text-xs font-bold">
										{(profile?.full_name || $authStore.email)?.charAt(0).toUpperCase()}
									</span>
								</div>
							</div>
						{/if}
						<div class="flex-1 min-w-0 text-left">
							<div class="text-sm font-medium truncate">
								{profile?.full_name || $authStore.email}
							</div>
							<div class="text-xs text-base-content/60 truncate">
								{profile?.full_name ? $authStore.email : 'Admin'}
							</div>
						</div>
						<svg
							class="w-4 h-4 opacity-60"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							></path>
						</svg>
					</div>
					<ul
						class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52"
					>
						<li>
							<span class="text-sm opacity-60"
								>{$authStore.email}</span
							>
						</li>
						<li><hr class="my-1" /></li>
						<li>
							<a href="/account" onclick={handleNavClick}>Account Settings</a>
						</li>
						<li>
							<button onclick={() => themeStore.toggle()}>
								{themeStore.isDark ? 'Light Mode' : 'Dark Mode'}
							</button>
						</li>
						<li>
							<button onclick={authStore.signOut}>Logout</button>
						</li>
					</ul>
				</div>
			</div>
		{/if}
	</aside>
</div>

<!-- Swipe indicator for mobile -->
{#if isMobile && !isDrawerOpen}
	<div class="fixed left-0 top-1/2 transform -translate-y-1/2 z-30 lg:hidden">
		<div class="w-1 h-16 bg-primary/30 rounded-r-full animate-pulse"></div>
	</div>
{/if}
