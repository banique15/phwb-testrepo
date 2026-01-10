<script lang="ts">
	import { createBugComment, bugCommentsStore, deleteBugComment } from '$lib/stores/bug-comments'
	import { supabase } from '$lib/supabase'
	import { invalidateAll } from '$app/navigation'
	import { Send, Edit, Trash2, Lock } from 'lucide-svelte'
	import { formatDistanceToNow } from 'date-fns'
	import type { BugComment } from '$lib/schemas/bug-comment'

	interface Props {
		bugId: number
		comments: Array<BugComment & { profiles?: { full_name: string | null; avatar_url: string | null } | null }>
		users: Array<{ id: string; full_name: string | null; avatar_url: string | null }>
	}

	let { bugId, comments, users }: Props = $props()

	let newComment = $state('')
	let isInternal = $state(false)
	let submitting = $state(false)
	let editingCommentId = $state<number | null>(null)
	let editContent = $state('')
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
		if (!newComment.trim() || !currentUser) return

		submitting = true
		try {
			await createBugComment({
				bug_id: bugId,
				user_id: currentUser.id,
				content: newComment.trim(),
				is_internal: isInternal
			})
			newComment = ''
			isInternal = false
			await invalidateAll()
		} catch (error) {
			console.error('Failed to create comment:', error)
		} finally {
			submitting = false
		}
	}

	async function handleEdit(comment: BugComment) {
		editingCommentId = comment.id as number
		editContent = comment.content
	}

	async function saveEdit(commentId: number) {
		try {
			await bugCommentsStore.updateComment(commentId, { content: editContent })
			editingCommentId = null
			await invalidateAll()
		} catch (error) {
			console.error('Failed to update comment:', error)
		}
	}

	async function handleDelete(commentId: number) {
		if (!confirm('Are you sure you want to delete this comment?')) return
		try {
			await deleteBugComment(commentId)
			await invalidateAll()
		} catch (error) {
			console.error('Failed to delete comment:', error)
		}
	}

	function canEdit(comment: BugComment): boolean {
		return currentUser?.id === comment.user_id
	}
</script>

<div class="space-y-6">
	<!-- Comment Form -->
	<div class="bg-base-100 rounded-lg p-4 border border-base-300">
		<div class="form-control mb-3">
			<textarea
				class="textarea textarea-bordered"
				placeholder="Add a comment..."
				bind:value={newComment}
				rows="3"
			></textarea>
		</div>
		<div class="flex items-center justify-between">
			<label class="label cursor-pointer gap-2">
				<input type="checkbox" class="checkbox checkbox-sm" bind:checked={isInternal} />
				<span class="label-text text-sm flex items-center gap-1">
					<Lock class="w-3 h-3" />
					Internal note (team only)
				</span>
			</label>
			<button
				class="btn btn-primary btn-sm"
				onclick={handleSubmit}
				disabled={!newComment.trim() || submitting}
			>
				<Send class="w-4 h-4" />
				{submitting ? 'Posting...' : 'Post Comment'}
			</button>
		</div>
	</div>

	<!-- Comments List -->
	<div class="space-y-4">
		{#each comments as comment}
			<div class="bg-base-100 rounded-lg p-4 border border-base-300 {comment.is_internal ? 'bg-warning/10' : ''}">
				<div class="flex items-start gap-3">
					<!-- Avatar -->
					<div class="avatar placeholder">
						<div class="bg-neutral text-neutral-content rounded-full w-10">
							<span class="text-xs">
								{comment.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
							</span>
						</div>
					</div>

					<!-- Content -->
					<div class="flex-1">
						<div class="flex items-center gap-2 mb-1">
							<span class="font-medium">
								{comment.profiles?.full_name || 'Unknown'}
							</span>
							{#if comment.is_internal}
								<span class="badge badge-xs badge-warning flex items-center gap-1">
									<Lock class="w-3 h-3" />
									Internal
								</span>
							{/if}
							<span class="text-xs text-base-content/60">
								{formatDistanceToNow(new Date(comment.created_at || ''), { addSuffix: true })}
							</span>
							{#if comment.edited_at}
								<span class="text-xs text-base-content/40 italic">(edited)</span>
							{/if}
						</div>

						{#if editingCommentId === comment.id}
							<div class="space-y-2">
								<textarea
									class="textarea textarea-bordered w-full"
									bind:value={editContent}
									rows="3"
								></textarea>
								<div class="flex gap-2">
									<button class="btn btn-sm btn-success" onclick={() => saveEdit(comment.id as number)}>
										Save
									</button>
									<button class="btn btn-sm btn-ghost" onclick={() => editingCommentId = null}>
										Cancel
									</button>
								</div>
							</div>
						{:else}
							<p class="whitespace-pre-wrap text-sm">{comment.content}</p>
						{/if}

						<!-- Actions -->
						{#if canEdit(comment)}
							<div class="flex gap-2 mt-2">
								<button
									class="btn btn-xs btn-ghost"
									onclick={() => handleEdit(comment)}
								>
									<Edit class="w-3 h-3" />
									Edit
								</button>
								<button
									class="btn btn-xs btn-ghost text-error"
									onclick={() => handleDelete(comment.id as number)}
								>
									<Trash2 class="w-3 h-3" />
									Delete
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{:else}
			<div class="text-center py-8 text-base-content/60">
				No comments yet. Be the first to comment!
			</div>
		{/each}
	</div>
</div>
