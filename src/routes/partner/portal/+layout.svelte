<script lang="ts">
	import '../../../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</svelte:head>

<!-- Reset layout completely - no admin sidebar -->
<div class="h-screen overflow-hidden flex flex-col bg-base-200">
	<!-- Partner Portal Header -->
	<header class="navbar bg-primary text-primary-content shadow-lg px-2 md:px-4 flex-shrink-0">
		<div class="flex-1 min-w-0">
			<a href="/partner/portal" class="btn btn-ghost text-sm sm:text-base md:text-xl normal-case">
				<span class="text-xl sm:text-2xl">🎨</span>
				<span class="hidden sm:inline">Sing for Hope Partner Portal</span>
				<span class="sm:hidden">Partner Portal</span>
			</a>
		</div>
		<div class="flex-none gap-1 sm:gap-2">
			<!-- Navigation items - hidden on mobile -->
			<a href="/partner/portal" class="btn btn-ghost btn-sm hidden md:flex">Dashboard</a>

			<!-- User menu -->
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar btn-sm sm:btn-md">
					<div
						class="w-8 sm:w-10 rounded-full bg-primary-content text-primary flex items-center justify-center"
					>
						<span class="text-base sm:text-lg">👤</span>
					</div>
				</div>
				<ul
					tabindex="0"
					class="menu menu-sm dropdown-content bg-base-100 text-base-content rounded-box z-[1] mt-3 w-52 p-2 shadow"
				>
					<li><a href="/partner/portal">Dashboard</a></li>
					<li><a href="#settings">Settings</a></li>
					<li><a href="/login">Logout</a></li>
				</ul>
			</div>
		</div>
	</header>

	<!-- Main content - scrollable -->
	<main class="flex-1 overflow-y-auto">
		<div class="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-7xl">
			{@render children()}
		</div>
	</main>

	<!-- Footer -->
	<footer class="footer footer-center p-4 bg-base-300 text-base-content flex-shrink-0">
		<aside>
			<p class="text-sm">© 2025 Sing for Hope. All rights reserved.</p>
		</aside>
	</footer>
</div>
