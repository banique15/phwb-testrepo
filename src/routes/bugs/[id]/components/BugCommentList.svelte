<script lang="ts">
	import { createBugComment, bugCommentsStore, deleteBugComment } from '$lib/stores/bug-comments'
	import { supabase } from '$lib/supabase'
	import { invalidateAll } from '$app/navigation'
	import { Send, Edit, Trash2, Lock, AtSign } from 'lucide-svelte'
	import { formatDistanceToNow } from 'date-fns'
	import type { BugComment } from '$lib/schemas/bug-comment'
	import { onMount, tick } from 'svelte'

	function formatCommentDate(dateStr: string | null | undefined, fallback = '—'): string {
		if (dateStr == null || dateStr === '') return fallback
		const d = new Date(dateStr)
		if (Number.isNaN(d.getTime())) return fallback
		return formatDistanceToNow(d, { addSuffix: true })
	}

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
	
	// @mention state
	let showMentionDropdown = $state(false)
	let mentionQuery = $state('')
	let mentionStartIndex = $state(-1)
	let selectedMentionIndex = $state(0)
	let textareaRef = $state<HTMLTextAreaElement | null>(null)
	let mentionDropdownRef = $state<HTMLDivElement | null>(null)
	
	// Filter users based on mention query
	const filteredMentionUsers = $derived(() => {
		if (!mentionQuery) return users
		const query = mentionQuery.toLowerCase()
		return users.filter(u => 
			u.full_name?.toLowerCase().includes(query) || 
			u.id.toLowerCase().includes(query)
		)
	})

	async function loadCurrentUser() {
		const { data: { user } } = await supabase.auth.getUser()
		currentUser = user
	}

	onMount(() => {
		loadCurrentUser()
	})
	
	// Handle textarea input for @mentions
	function handleCommentInput(e: Event) {
		const textarea = e.target as HTMLTextAreaElement
		const cursorPos = textarea.selectionStart
		const text = textarea.value
		
		// Find if we're in a mention context (after @ but before space or end)
		const textBeforeCursor = text.slice(0, cursorPos)
		const lastAtIndex = textBeforeCursor.lastIndexOf('@')
		
		if (lastAtIndex !== -1) {
			const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1)
			// Check if there's a space after @ (which would end the mention)
			if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
				mentionStartIndex = lastAtIndex
				mentionQuery = textAfterAt
				showMentionDropdown = true
				selectedMentionIndex = 0
				return
			}
		}
		
		showMentionDropdown = false
		mentionQuery = ''
		mentionStartIndex = -1
	}
	
	// Handle keyboard navigation in mention dropdown
	function handleCommentKeydown(e: KeyboardEvent) {
		if (!showMentionDropdown) return
		
		const filtered = filteredMentionUsers()
		
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			selectedMentionIndex = Math.min(selectedMentionIndex + 1, filtered.length - 1)
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			selectedMentionIndex = Math.max(selectedMentionIndex - 1, 0)
		} else if (e.key === 'Enter' && filtered.length > 0) {
			e.preventDefault()
			insertMention(filtered[selectedMentionIndex])
		} else if (e.key === 'Escape') {
			showMentionDropdown = false
		}
	}
	
	// Insert selected mention into textarea
	async function insertMention(user: { id: string; full_name: string | null }) {
		if (mentionStartIndex === -1 || !textareaRef) return
		
		const displayName = user.full_name || user.id
		const beforeMention = newComment.slice(0, mentionStartIndex)
		const afterMention = newComment.slice(mentionStartIndex + mentionQuery.length + 1)
		
		newComment = `${beforeMention}@${displayName} ${afterMention}`
		showMentionDropdown = false
		mentionQuery = ''
		mentionStartIndex = -1
		
		// Focus textarea and move cursor after mention
		await tick()
		const newCursorPos = beforeMention.length + displayName.length + 2
		textareaRef.focus()
		textareaRef.setSelectionRange(newCursorPos, newCursorPos)
	}
	
	// Render comment content with highlighted @mentions
	function renderCommentWithMentions(content: string): string {
		// Match @mentions (word characters after @)
		const mentionRegex = /@([\w\s]+?)(?=\s@|\s|$)/g
		return content.replace(mentionRegex, '<span class="text-primary font-medium">@$1</span>')
	}

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
		<div class="form-control mb-3 relative">
			<textarea
				bind:this={textareaRef}
				class="textarea textarea-bordered"
				placeholder="Add a comment... Use @ to mention someone"
				bind:value={newComment}
				oninput={handleCommentInput}
				onkeydown={handleCommentKeydown}
				rows="3"
			></textarea>
			
			<!-- @mention dropdown -->
			{#if showMentionDropdown && filteredMentionUsers().length > 0}
				<div 
					bind:this={mentionDropdownRef}
					class="absolute left-0 right-0 top-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
				>
					<div class="p-2 text-xs text-base-content/60 border-b border-base-300 flex items-center gap-1">
						<AtSign class="w-3 h-3" />
						Mention a team member
					</div>
					{#each filteredMentionUsers() as user, index}
						<button
							class="w-full text-left px-3 py-2 hover:bg-base-200 flex items-center gap-2 {index === selectedMentionIndex ? 'bg-base-200' : ''}"
							onclick={() => insertMention(user)}
							onmouseenter={() => selectedMentionIndex = index}
						>
							<div class="avatar placeholder">
								<div class="bg-neutral text-neutral-content rounded-full w-6">
									<span class="text-xs">
										{user.full_name?.charAt(0).toUpperCase() || '?'}
									</span>
								</div>
							</div>
							<span class="font-medium text-sm">{user.full_name || 'Unknown'}</span>
						</button>
					{/each}
				</div>
			{/if}
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
								{formatCommentDate(comment.created_at)}
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
							<p class="whitespace-pre-wrap text-sm">{@html renderCommentWithMentions(comment.content)}</p>
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
