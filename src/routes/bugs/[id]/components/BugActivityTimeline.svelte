<script lang="ts">
	import { formatDistanceToNow } from 'date-fns'
	import { User, MessageSquare, Paperclip, Tag, CheckCircle, XCircle, ArrowRight } from 'lucide-svelte'
	import type { BugActivity } from '$lib/schemas/bug-activity'

	interface Props {
		activity: Array<BugActivity & { profiles?: { full_name: string | null; avatar_url: string | null } | null }>
	}

	let { activity }: Props = $props()

	function getActionIcon(action: BugActivity['action']) {
		switch (action) {
			case 'created':
				return CheckCircle
			case 'commented':
				return MessageSquare
			case 'attachment_added':
				return Paperclip
			case 'label_added':
			case 'label_removed':
				return Tag
			case 'status_changed':
			case 'assigned':
				return ArrowRight
			case 'resolved':
				return CheckCircle
			case 'closed':
				return XCircle
			default:
				return User
		}
	}

	function getActionColor(action: BugActivity['action']): string {
		switch (action) {
			case 'created':
			case 'resolved':
				return 'text-success'
			case 'closed':
				return 'text-base-content/60'
			case 'status_changed':
			case 'assigned':
				return 'text-info'
			default:
				return 'text-base-content'
		}
	}

	function formatAction(action: BugActivity['action'], oldValue?: string | null, newValue?: string | null): string {
		switch (action) {
			case 'created':
				return 'created this bug'
			case 'status_changed':
				return `changed status from ${oldValue || 'unknown'} to ${newValue || 'unknown'}`
			case 'assigned':
				return oldValue === 'unassigned' || !oldValue
					? `assigned to ${newValue || 'unknown'}`
					: `reassigned from ${oldValue} to ${newValue || 'unknown'}`
			case 'commented':
				return 'added a comment'
			case 'attachment_added':
				return 'added an attachment'
			case 'label_added':
				return 'added a label'
			case 'label_removed':
				return 'removed a label'
			case 'reopened':
				return 'reopened this bug'
			case 'resolved':
				return 'resolved this bug'
			case 'closed':
				return 'closed this bug'
			case 'updated':
				return 'updated this bug'
			default:
				return action
		}
	}
</script>

<div class="space-y-4">
	{#each activity as entry}
		<div class="flex gap-4">
			<!-- Timeline line -->
			<div class="flex flex-col items-center">
				<div class="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center">
					<svelte:component this={getActionIcon(entry.action)} class="w-5 h-5 {getActionColor(entry.action)}" />
				</div>
				{#if entry !== activity[activity.length - 1]}
					<div class="w-0.5 h-full bg-base-300 mt-2"></div>
				{/if}
			</div>

			<!-- Content -->
			<div class="flex-1 pb-4">
				<div class="flex items-center gap-2 mb-1">
					<span class="font-medium">
						{entry.profiles?.full_name || 'Unknown'}
					</span>
					<span class="text-sm text-base-content/60">
						{formatAction(entry.action, entry.old_value, entry.new_value)}
					</span>
				</div>
				<div class="text-xs text-base-content/50">
					{formatDistanceToNow(new Date(entry.created_at || ''), { addSuffix: true })}
				</div>
			</div>
		</div>
	{:else}
		<div class="text-center py-8 text-base-content/60">
			No activity yet.
		</div>
	{/each}
</div>
