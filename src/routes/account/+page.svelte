<script lang="ts">
	import { profilesStore } from '$lib/stores/profiles'
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import type { AccountPageData } from './+page.server'

	interface Props {
		data: AccountPageData
	}

	let { data }: Props = $props()

	let fullName = $state(data.profile?.full_name || '')
	let username = $state(data.profile?.username || '')
	let avatarUrl = $state(data.profile?.avatar_url || '')
	let website = $state(data.profile?.website || '')

	let saving = $state(false)
	let saveMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null)

	async function handleSave() {
		saving = true
		saveMessage = null

		try {
			await profilesStore.update(data.user.id, {
				full_name: fullName || undefined,
				username: username || undefined,
				avatar_url: avatarUrl || undefined,
				website: website || undefined
			})
			saveMessage = { type: 'success', text: 'Profile updated successfully' }
		} catch (err) {
			saveMessage = { type: 'error', text: err instanceof Error ? err.message : 'Failed to save profile' }
		} finally {
			saving = false
		}
	}
</script>

<ErrorBoundary>
	<div class="h-full flex flex-col">
		<!-- Fixed Header -->
		<div class="sticky top-0 z-30 flex-none px-4 py-2 bg-base-100 border-b border-base-200 shadow-sm">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
				<div>
					<h1 class="text-xl sm:text-2xl font-bold text-base-content leading-tight">Account</h1>
					<p class="text-sm text-base-content/60">
						Manage your profile and account settings
					</p>
				</div>
			</div>
		</div>

		<!-- Scrollable Content -->
		<div class="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 fade-in">
			<!-- Profile Section -->
			<div class="card bg-base-100 shadow-sm border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-lg">Profile Information</h2>
					<p class="text-sm text-base-content/60 mb-4">Update your personal information</p>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<!-- Email (read-only) -->
						<div class="form-control">
							<label class="label" for="email">
								<span class="label-text font-medium">Email</span>
							</label>
							<input
								id="email"
								type="email"
								class="input input-bordered bg-base-200"
								value={data.user.email}
								disabled
							/>
							<label class="label">
								<span class="label-text-alt text-base-content/50">Email cannot be changed</span>
							</label>
						</div>

						<!-- Full Name -->
						<div class="form-control">
							<label class="label" for="fullName">
								<span class="label-text font-medium">Full Name</span>
							</label>
							<input
								id="fullName"
								type="text"
								class="input input-bordered"
								placeholder="Enter your full name"
								bind:value={fullName}
								maxlength={200}
							/>
						</div>

						<!-- Username -->
						<div class="form-control">
							<label class="label" for="username">
								<span class="label-text font-medium">Username</span>
							</label>
							<input
								id="username"
								type="text"
								class="input input-bordered"
								placeholder="Choose a username"
								bind:value={username}
								minlength={3}
								maxlength={50}
							/>
							<label class="label">
								<span class="label-text-alt text-base-content/50">3-50 characters</span>
							</label>
						</div>

						<!-- Website -->
						<div class="form-control">
							<label class="label" for="website">
								<span class="label-text font-medium">Website</span>
							</label>
							<input
								id="website"
								type="url"
								class="input input-bordered"
								placeholder="https://example.com"
								bind:value={website}
							/>
						</div>

						<!-- Avatar URL -->
						<div class="form-control md:col-span-2">
							<label class="label" for="avatarUrl">
								<span class="label-text font-medium">Avatar URL</span>
							</label>
							<input
								id="avatarUrl"
								type="url"
								class="input input-bordered"
								placeholder="https://example.com/avatar.jpg"
								bind:value={avatarUrl}
							/>
						</div>
					</div>

					<!-- Avatar Preview -->
					{#if avatarUrl}
						<div class="mt-4">
							<p class="text-sm font-medium mb-2">Avatar Preview</p>
							<div class="avatar">
								<div class="w-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
									<img src={avatarUrl} alt="Avatar preview" />
								</div>
							</div>
						</div>
					{/if}

					<!-- Save Message -->
					{#if saveMessage}
						<div class="alert mt-4" class:alert-success={saveMessage.type === 'success'} class:alert-error={saveMessage.type === 'error'}>
							<span>{saveMessage.text}</span>
						</div>
					{/if}

					<!-- Save Button -->
					<div class="card-actions justify-end mt-4">
						<button
							class="btn btn-primary"
							onclick={handleSave}
							disabled={saving}
						>
							{#if saving}
								<span class="loading loading-spinner loading-sm"></span>
								Saving...
							{:else}
								Save Changes
							{/if}
						</button>
					</div>
				</div>
			</div>

			<!-- Account Info Section -->
			<div class="card bg-base-100 shadow-sm border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-lg">Account Details</h2>
					<p class="text-sm text-base-content/60 mb-4">Your account information</p>

					<div class="overflow-x-auto">
						<table class="table table-sm">
							<tbody>
								<tr>
									<td class="font-medium text-base-content/70">User ID</td>
									<td class="font-mono text-sm">{data.user.id}</td>
								</tr>
								<tr>
									<td class="font-medium text-base-content/70">Email</td>
									<td>{data.user.email}</td>
								</tr>
								{#if data.profile?.updated_at}
									<tr>
										<td class="font-medium text-base-content/70">Profile Last Updated</td>
										<td>{new Date(data.profile.updated_at).toLocaleString()}</td>
									</tr>
								{/if}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	</div>
</ErrorBoundary>
