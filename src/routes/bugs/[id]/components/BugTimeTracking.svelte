<script lang="ts">
	import { supabase } from '$lib/supabase'
	import { invalidateAll } from '$app/navigation'
	import { Clock, Plus } from 'lucide-svelte'
	import { formatDistanceToNow } from 'date-fns'
	import type { BugTimeTracking } from '$lib/schemas/bug-time-tracking'

	interface Props {
		bugId: number
		timeTracking: Array<BugTimeTracking & { profiles?: { full_name: string | null } | null }>
		users: Array<{ id: string; full_name: string | null; avatar_url: string | null }>
	}

	let { bugId, timeTracking, users }: Props = $props()

	let showForm = $state(false)
	let timeSpent = $state('')
	let description = $state('')
	let date = $state(new Date().toISOString().split('T')[0])
	let submitting = $state(false)
	let currentUser = $state<{ id: string } | null>(null)

	import { onMount } from 'svelte'

	async function loadCurrentUser() {
		const { data: { user } } = await supabase.auth.getUser()
		currentUser = user
	}

	onMount(() => {
		loadCurrentUser()
	})

	async function handleSubmit() {
		if (!timeSpent || !currentUser) return

		const minutes = parseInt(timeSpent, 10)
		if (isNaN(minutes) || minutes <= 0) {
			alert('Please enter a valid time in minutes')
			return
		}

		submitting = true
		try {
			const { error } = await supabase
				.from('phwb_bug_time_tracking')
				.insert({
					bug_id: bugId,
					user_id: currentUser.id,
					time_spent_minutes: minutes,
					description: description || null,
					date: date
				})

			if (error) throw error

			timeSpent = ''
			description = ''
			date = new Date().toISOString().split('T')[0]
			showForm = false
			await invalidateAll()
		} catch (error) {
			console.error('Failed to log time:', error)
			alert('Failed to log time')
		} finally {
			submitting = false
		}
	}

	function formatTime(minutes: number): string {
		const hours = Math.floor(minutes / 60)
		const mins = minutes % 60
		if (hours > 0 && mins > 0) {
			return `${hours}h ${mins}m`
		} else if (hours > 0) {
			return `${hours}h`
		}
		return `${mins}m`
	}

	function getTotalTime(): number {
		return timeTracking.reduce((sum, entry) => sum + (entry.time_spent_minutes || 0), 0)
	}
</script>

<div class="space-y-4">
	<!-- Summary -->
	<div class="bg-base-200 rounded-lg p-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Clock class="w-5 h-5" />
				<span class="font-semibold">Total Time Logged</span>
			</div>
			<span class="text-2xl font-bold">{formatTime(getTotalTime())}</span>
		</div>
	</div>

	<!-- Add Time Form -->
	{#if showForm}
		<div class="bg-base-100 rounded-lg p-4 border border-base-300">
			<h3 class="font-semibold mb-4">Log Time</h3>
			<div class="space-y-4">
				<div class="form-control">
					<label class="label">
						<span class="label-text">Time Spent (minutes)</span>
					</label>
					<input
						type="number"
						class="input input-bordered"
						placeholder="60"
						bind:value={timeSpent}
						min="1"
					/>
				</div>
				<div class="form-control">
					<label class="label">
						<span class="label-text">Date</span>
					</label>
					<input
						type="date"
						class="input input-bordered"
						bind:value={date}
					/>
				</div>
				<div class="form-control">
					<label class="label">
						<span class="label-text">Description (optional)</span>
					</label>
					<textarea
						class="textarea textarea-bordered"
						placeholder="What did you work on?"
						bind:value={description}
						rows="3"
					></textarea>
				</div>
				<div class="flex gap-2">
					<button class="btn btn-primary" onclick={handleSubmit} disabled={submitting}>
						{submitting ? 'Logging...' : 'Log Time'}
					</button>
					<button class="btn btn-ghost" onclick={() => showForm = false}>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{:else}
		<button class="btn btn-outline w-full" onclick={() => showForm = true}>
			<Plus class="w-4 h-4" />
			Log Time
		</button>
	{/if}

	<!-- Time Entries -->
	<div class="space-y-2">
		{#each timeTracking as entry}
			<div class="bg-base-100 rounded-lg p-4 border border-base-300">
				<div class="flex items-center justify-between">
					<div>
						<div class="font-medium">{formatTime(entry.time_spent_minutes)}</div>
						<div class="text-sm text-base-content/60">
							{entry.profiles?.full_name || 'Unknown'} • {new Date(entry.date).toLocaleDateString()}
						</div>
						{#if entry.description}
							<div class="text-sm mt-1">{entry.description}</div>
						{/if}
					</div>
					<div class="text-xs text-base-content/50">
						{formatDistanceToNow(new Date(entry.created_at || ''), { addSuffix: true })}
					</div>
				</div>
			</div>
		{:else}
			<div class="text-center py-8 text-base-content/60">
				No time entries yet.
			</div>
		{/each}
	</div>
</div>
