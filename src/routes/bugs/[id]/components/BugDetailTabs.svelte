<script lang="ts">
	import type { Bug } from '$lib/schemas/bug'
	import type { BugComment } from '$lib/schemas/bug-comment'
	import type { BugAttachment } from '$lib/schemas/bug-attachment'
	import type { BugLabel } from '$lib/schemas/bug-label'
	import type { BugActivity } from '$lib/schemas/bug-activity'
	import type { BugTimeTracking as BugTimeTrackingType } from '$lib/schemas/bug-time-tracking'
	import BugCommentList from './BugCommentList.svelte'
	import BugAttachments from './BugAttachments.svelte'
	import BugActivityTimeline from './BugActivityTimeline.svelte'
	import BugRelations from './BugRelations.svelte'
	import BugTimeTracking from './BugTimeTracking.svelte'
	import BugReplication from './BugReplication.svelte'

	interface Props {
		bug: Bug
		activeTab: 'description' | 'comments' | 'attachments' | 'activity' | 'time' | 'replication'
		onTabChange: (tab: 'description' | 'comments' | 'attachments' | 'activity' | 'time' | 'replication') => void
		comments: Array<BugComment & { profiles?: { full_name: string | null; avatar_url: string | null } | null }>
		attachments: Array<BugAttachment & { profiles?: { full_name: string | null } | null }>
		labels: BugLabel[]
		relations: Array<any>
		activity: Array<BugActivity & { profiles?: { full_name: string | null; avatar_url: string | null } | null }>
		timeTracking: Array<BugTimeTrackingType & { profiles?: { full_name: string | null } | null }>
		allLabels: BugLabel[]
		users: Array<{ id: string; full_name: string | null; avatar_url: string | null }>
		replicationScreenshots: Array<BugAttachment & { profiles?: { full_name: string | null } | null }>
		onDescriptionChange: (description: string) => Promise<void>
	}

	let {
		bug,
		activeTab,
		onTabChange,
		comments,
		attachments,
		labels,
		relations,
		activity,
		timeTracking,
		allLabels,
		users,
		replicationScreenshots,
		onDescriptionChange
	}: Props = $props()

	let descriptionValue = $state(bug.description || '')

	// Update description value only when bug.description actually changes
	$effect(() => {
		const newDescription = bug.description || ''
		if (descriptionValue !== newDescription) {
			descriptionValue = newDescription
		}
	})
</script>

<div class="flex-1 flex flex-col min-h-0">
	<!-- Tab Navigation -->
	<div class="tabs tabs-boxed mb-4 flex-shrink-0 bg-base-100 shadow-sm">
		<button
			class="tab {activeTab === 'description' ? 'tab-active' : ''}"
			onclick={() => onTabChange('description')}
		>
			Description
		</button>
		<button
			class="tab {activeTab === 'comments' ? 'tab-active' : ''}"
			onclick={() => onTabChange('comments')}
		>
			Comments
			{#if comments.length > 0}
				<span class="badge badge-sm badge-primary ml-2">{comments.length}</span>
			{/if}
		</button>
		<button
			class="tab {activeTab === 'attachments' ? 'tab-active' : ''}"
			onclick={() => onTabChange('attachments')}
		>
			Attachments
			{#if attachments.length > 0}
				<span class="badge badge-sm badge-primary ml-2">{attachments.length}</span>
			{/if}
		</button>
		<button
			class="tab {activeTab === 'activity' ? 'tab-active' : ''}"
			onclick={() => onTabChange('activity')}
		>
			Activity
			{#if activity.length > 0}
				<span class="badge badge-sm badge-ghost ml-2">{activity.length}</span>
			{/if}
		</button>
		<button
			class="tab {activeTab === 'time' ? 'tab-active' : ''}"
			onclick={() => onTabChange('time')}
		>
			Time Tracking
			{#if timeTracking.length > 0}
				<span class="badge badge-sm badge-ghost ml-2">{timeTracking.length}</span>
			{/if}
		</button>
		<button
			class="tab {activeTab === 'replication' ? 'tab-active' : ''}"
			onclick={() => onTabChange('replication')}
		>
			Replication
			{#if bug.replication_data && typeof bug.replication_data === 'object' && (bug.replication_data as any).report}
				<span class="badge badge-sm badge-primary ml-2">✓</span>
			{/if}
		</button>
	</div>

	<!-- Tab Content -->
	<div class="flex-1 overflow-y-auto min-h-0">
		{#if activeTab === 'description'}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body p-6">
					<div class="mb-4">
						<h3 class="font-semibold text-lg mb-2">Description</h3>
						<textarea
							class="textarea textarea-bordered w-full min-h-48 font-mono text-sm"
							placeholder="Add a detailed description of the bug..."
							bind:value={descriptionValue}
							onblur={() => onDescriptionChange(descriptionValue)}
						></textarea>
						<p class="text-xs text-base-content/60 mt-2">
							Changes are saved automatically when you click away
						</p>
					</div>

					<!-- Labels -->
					{#if labels.length > 0}
						<div class="divider my-4"></div>
						<div>
							<h3 class="font-semibold mb-3">Labels</h3>
							<div class="flex flex-wrap gap-2">
								{#each labels as label}
									<span
										class="badge badge-lg"
										style="background-color: {label.color}; color: white; border: none;"
									>
										{label.name}
									</span>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Relations -->
					{#if relations.length > 0}
						<div class="divider my-4"></div>
						<div>
							<h3 class="font-semibold mb-3">Related Bugs</h3>
							<BugRelations relations={relations} />
						</div>
					{/if}
				</div>
			</div>
		{:else if activeTab === 'comments'}
			<BugCommentList bugId={bug.id as number} comments={comments} users={users} />
		{:else if activeTab === 'attachments'}
			<BugAttachments bugId={bug.id as number} attachments={attachments} />
		{:else if activeTab === 'activity'}
			<BugActivityTimeline activity={activity} />
		{:else if activeTab === 'time'}
			<BugTimeTracking bugId={bug.id as number} timeTracking={timeTracking} users={users} />
		{:else if activeTab === 'replication'}
			<BugReplication bug={bug} screenshots={replicationScreenshots} />
		{/if}
	</div>
</div>
