<script lang="ts">
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import { browser } from "$app/environment";
	import { onMount } from "svelte";
	import { authStore } from "$lib/auth";
	import { sidebarStore } from "$lib/stores/sidebar";
	import { themeStore } from "$lib/stores/theme.svelte";
	import { supabase } from "$lib/supabase";
	import ThemeToggle from "./ThemeToggle.svelte";
	import type { Profile } from "$lib/schemas/profile";
	import type { Notification } from "$lib/schemas/notification";
	import {
		notificationsStore,
		subscribe as notificationsSubscribe,
		subscribeToNotificationChanges,
		unsubscribeFromNotificationChanges
	} from "$lib/stores/notifications";
	import { Bell } from "lucide-svelte";
	import { formatDistanceToNow } from "date-fns";

const navItems = [
		{ name: "Dashboard", href: "/", disabled: false },
		{ name: "Artists", href: "/artists", disabled: false },
		{ name: "Production Managers", href: "/production-managers", disabled: false },
		{ name: "Ensembles", href: "/ensembles", disabled: false },
		{ name: "Partners", href: "/partners", disabled: false },
		{ name: "Programs", href: "/programs", disabled: false },
		{ name: "Facilities", href: "/facilities", disabled: false },
		{ name: "Events", href: "/events", disabled: false },
		{ name: "Reports", href: "/reports", disabled: false },
		{ name: "Payroll", href: "/payroll", disabled: false },
	];

	// Settings is now a top-level nav item that opens a second-level sidebar
	// when on /settings/** routes (handled by src/routes/settings/+layout.svelte)
	const isOnSettingsPage = $derived($page.url.pathname.startsWith('/settings'));

	let isMobile = $state(false);
	let isDrawerOpen = $state(false);
	let touchStartX = 0;
	let touchStartY = 0;
	let profile = $state<Profile | null>(null);
	let notifications = $state<Notification[]>([]);
	let unreadCount = $derived(notifications.filter((n) => !n.is_read).length);
	let notificationTab = $state<'unread' | 'read'>('unread');
	let showNotifications = $state(false);
	let bellRef = $state<HTMLButtonElement | null>(null);
	let panelRef = $state<HTMLDivElement | null>(null);

	const filteredNotifications = $derived(
		notificationTab === 'unread'
			? notifications.filter((n) => !n.is_read)
			: notifications.filter((n) => n.is_read)
	);
	const readCount = $derived(notifications.filter((n) => n.is_read).length);

	function toggleNotifications() {
		showNotifications = !showNotifications;
	}

	function handleClickOutside(event: MouseEvent) {
		if (
			showNotifications &&
			bellRef &&
			panelRef &&
			!bellRef.contains(event.target as Node) &&
			!panelRef.contains(event.target as Node)
		) {
			showNotifications = false;
		}
	}

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

	async function loadNotifications() {
		try {
			const items = await notificationsStore.getForCurrentUser(20);
			notifications = items;
		} catch (err) {
			console.error("Failed to load notifications", err);
		}
	}

	function setupNotificationRealtime() {
		subscribeToNotificationChanges({
			onInsert: (payload) => {
				const notification = payload.new as Notification;
				notifications = [notification, ...notifications];
			},
			onUpdate: (payload) => {
				const updated = payload.new as Notification;
				notifications = notifications.map((n) =>
					n.id === updated.id ? updated : n
				);
			},
			onDelete: (payload) => {
				const deleted = payload.old as Notification;
				notifications = notifications.filter((n) => n.id !== deleted.id);
			}
		});
	}

	async function handleNotificationClick(notification: Notification) {
		if (!notification.is_read && notification.id != null) {
			try {
				const updated = await notificationsStore.markAsRead(notification.id);
				notifications = notifications.map((n) =>
					n.id === updated.id ? updated : n
				);
			} catch (err) {
				console.error("Failed to mark notification as read", err);
			}
		}
		showNotifications = false;
		handleNavClick();

		if (notification.bug_id) {
			goto(`/bugs/${notification.bug_id}?tab=comments`);
		}
	}

	async function markAllNotificationsAsRead() {
		try {
			await notificationsStore.markAllAsReadForCurrentUser();
			const nowIso = new Date().toISOString();
			notifications = notifications.map((n) => ({
				...n,
				is_read: true,
				read_at: n.read_at || nowIso
			}));
		} catch (err) {
			console.error("Failed to mark all notifications as read", err);
		}
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

			// Subscribe to notifications store to keep local state in sync
			const unsubscribeNotifications = notificationsSubscribe((state) => {
				if (state.items) {
					notifications = state.items as Notification[];
				}
			});

			loadNotifications();
			setupNotificationRealtime();

			document.addEventListener("click", handleClickOutside);

			return () => {
				document.body.removeEventListener(
					"touchstart",
					handleTouchStart,
				);
				document.body.removeEventListener("touchend", handleTouchEnd);
				document.removeEventListener("click", handleClickOutside);
				unsubscribeSidebar();
				unsubscribeFromNotificationChanges();
				unsubscribeNotifications();
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
				{#if $authStore}
					<button
						bind:this={bellRef}
						class="btn btn-ghost btn-sm btn-circle relative"
						onclick={toggleNotifications}
					>
						<Bell class="w-4 h-4" />
						{#if unreadCount > 0}
							<span class="badge badge-xs badge-primary absolute -top-1 -right-1">
								{unreadCount > 9 ? '9+' : unreadCount}
							</span>
						{/if}
					</button>
				{/if}
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

				<li class="pt-2 mt-2 border-t border-base-300/60 w-full">
					<a
						href="/settings/notifications"
						data-sveltekit-preload-data="hover"
						data-sveltekit-preload-code="eager"
						class="flex items-center gap-3 py-3 px-4 transition-all duration-200 w-full rounded-lg text-sm font-medium"
						class:bg-primary={isOnSettingsPage}
						class:text-primary-content={isOnSettingsPage}
						class:shadow-sm={isOnSettingsPage}
						class:hover:bg-base-300={!isOnSettingsPage}
						class:text-base-content={!isOnSettingsPage}
						onclick={handleNavClick}
						aria-current={isOnSettingsPage ? 'page' : undefined}
					>
						<span>Settings</span>
						{#if isOnSettingsPage}
							<svg class="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
						{/if}
					</a>
				</li>
			</ul>
		</nav>

		<!-- Footer with Issues link and swipe hint for mobile -->
		<div class="flex-none border-t border-base-300">
			{#if isMobile}
				<div class="p-2 lg:hidden">
					<div class="text-xs text-base-content/60 text-center mb-2">
						Swipe from left edge to open menu
					</div>
				</div>
			{/if}
			<div class="p-2">
				<a
					href="/bugs"
					data-sveltekit-preload-data="hover"
					data-sveltekit-preload-code="eager"
					class="flex items-center gap-3 py-3 px-4 transition-all duration-200 w-full rounded-lg text-sm font-medium"
					class:bg-primary={isActive("/bugs")}
					class:text-primary-content={isActive("/bugs")}
					class:shadow-sm={isActive("/bugs")}
					class:hover:bg-base-300={!isActive("/bugs")}
					class:text-base-content={!isActive("/bugs")}
					onclick={handleNavClick}
					aria-current={isActive("/bugs") ? "page" : undefined}
				>
					<span>Issues</span>
				</a>
			</div>
		</div>

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

<!-- Notification panel: fixed position so it escapes all stacking contexts -->
{#if showNotifications}
	<div
		bind:this={panelRef}
		class="fixed top-[80px] left-[196px] z-[9999] w-80 max-h-96 overflow-y-auto bg-base-100 rounded-lg shadow-2xl border border-base-300"
	>
		<div class="px-3 pt-3 pb-2 border-b border-base-300">
			<div class="flex items-center justify-between mb-2 text-xs text-base-content/60">
				<span class="font-semibold uppercase tracking-wide">
					Notifications
				</span>
				{#if unreadCount > 0}
					<button
						class="btn btn-ghost btn-xs"
						onclick={markAllNotificationsAsRead}
					>
						Mark all read
					</button>
				{/if}
			</div>
			<div class="flex gap-2 text-xs">
				<button
					type="button"
					class="flex-1 btn btn-xs {notificationTab === 'unread' ? 'btn-primary' : 'btn-ghost'}"
					onclick={() => { notificationTab = 'unread'; }}
				>
					Unread ({unreadCount})
				</button>
				<button
					type="button"
					class="flex-1 btn btn-xs {notificationTab === 'read' ? 'btn-primary' : 'btn-ghost'}"
					onclick={() => { notificationTab = 'read'; }}
				>
					Read ({readCount})
				</button>
			</div>
		</div>
		<div class="p-2">
			{#if filteredNotifications.length === 0}
				<div class="px-1 py-3 text-xs text-base-content/60">
					{notificationTab === 'unread'
						? 'No unread notifications.'
						: 'No read notifications.'}
				</div>
			{:else}
				{#each filteredNotifications as notification}
					<a
						href={notification.bug_id ? `/bugs/${notification.bug_id}` : '#'}
						class="block px-2 py-2 rounded-lg mb-1 cursor-pointer {notification.is_read ? 'opacity-60' : 'bg-base-200/60 hover:bg-base-200'}"
						onclick={(event) => {
							event.preventDefault();
							handleNotificationClick(notification);
						}}
					>
						<div class="text-sm font-medium">
							{notification.title}
						</div>
						{#if notification.message}
							<div class="text-xs text-base-content/80 mt-1 whitespace-normal">
								{notification.message}
							</div>
						{/if}
						{#if notification.created_at}
							<div class="text-[10px] text-base-content/60 mt-1">
								{formatDistanceToNow(new Date(notification.created_at), {
									addSuffix: true
								})}
							</div>
						{/if}
					</a>
				{/each}
			{/if}
		</div>
	</div>
{/if}
