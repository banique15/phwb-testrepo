<script lang="ts">
	import { Music, User } from 'lucide-svelte'
	import '../../../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</svelte:head>

<!-- Reset layout completely - no admin sidebar -->
<div class="h-screen overflow-hidden flex flex-col bg-base-200">
	<!-- Artist Portal Header -->
	<header class="navbar bg-secondary text-secondary-content shadow-lg px-2 md:px-4 flex-shrink-0">
		<div class="flex-1 min-w-0">
			<a href="/artists/portal" class="btn btn-ghost text-sm sm:text-base md:text-xl normal-case">
				<Music class="w-6 h-6 sm:w-8 sm:h-8" />
				<span class="hidden sm:inline">Sing for Hope Artist Portal</span>
				<span class="sm:hidden">Artist Portal</span>
			</a>
		</div>
		<div class="flex-none gap-1 sm:gap-2">
			<!-- Navigation items - hidden on mobile -->
			<a href="/artists/portal" class="btn btn-ghost btn-sm hidden md:flex">Dashboard</a>

			<!-- User menu -->
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar btn-sm sm:btn-md">
					<div
						class="w-8 sm:w-10 rounded-full bg-secondary-content text-secondary flex items-center justify-center"
					>
						<User class="w-4 h-4 sm:w-5 sm:h-5" />
					</div>
				</div>
				<ul
					tabindex="0"
					class="menu menu-sm dropdown-content bg-base-100 text-base-content rounded-box z-[1] mt-3 w-52 p-2 shadow"
				>
					<li><a href="/artists/portal">Dashboard</a></li>
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
