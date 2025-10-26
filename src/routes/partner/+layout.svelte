<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { children } = $props();
</script>

<div class="min-h-screen bg-base-200">
	<!-- Partner Portal Header -->
	<header class="navbar bg-primary text-primary-content shadow-lg">
		<div class="flex-1">
			<a href="/partner/portal" class="btn btn-ghost text-xl">
				<span class="text-2xl">🎨</span>
				Sing for Hope Partner Portal
			</a>
		</div>
		<div class="flex-none gap-2">
			<!-- Navigation items -->
			<a href="/partner/portal" class="btn btn-ghost btn-sm">Dashboard</a>

			<!-- User menu -->
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar">
					<div class="w-10 rounded-full bg-primary-content text-primary flex items-center justify-center">
						<span class="text-lg">👤</span>
					</div>
				</div>
				<ul
					tabindex="0"
					class="menu menu-sm dropdown-content bg-base-100 text-base-content rounded-box z-[1] mt-3 w-52 p-2 shadow"
				>
					<li><a href="/partner/portal">Dashboard</a></li>
					<li><a>Settings</a></li>
					<li><a>Logout</a></li>
				</ul>
			</div>
		</div>
	</header>

	<!-- Main content -->
	<main class="container mx-auto px-4 py-8">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="footer footer-center p-4 bg-base-300 text-base-content mt-8">
		<aside>
			<p>© 2025 Sing for Hope. All rights reserved.</p>
		</aside>
	</footer>
</div>
