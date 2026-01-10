<script lang="ts">
	import { supabase } from '$lib/supabase'
	import { invalidateAll } from '$app/navigation'
	import { Upload, Download, Trash2, File } from 'lucide-svelte'
	import { formatDistanceToNow } from 'date-fns'
	import type { BugAttachment } from '$lib/schemas/bug-attachment'

	interface Props {
		bugId: number
		attachments: Array<BugAttachment & { profiles?: { full_name: string | null } | null }>
	}

	let { bugId, attachments }: Props = $props()

	let uploading = $state(false)
	let currentUser = $state<{ id: string } | null>(null)

	import { onMount } from 'svelte'

	async function loadCurrentUser() {
		const { data: { user } } = await supabase.auth.getUser()
		currentUser = user
	}

	onMount(() => {
		loadCurrentUser()
	})

	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement
		const file = target.files?.[0]
		if (!file || !currentUser) return

		uploading = true
		try {
			const fileExt = file.name.split('.').pop()
			const fileName = `${bugId}/${Date.now()}.${fileExt}`
			const filePath = `bug-attachments/${fileName}`

			// Upload to Supabase Storage
			const { error: uploadError } = await supabase.storage
				.from('bug-attachments')
				.upload(filePath, file)

			if (uploadError) throw uploadError

			// Get public URL
			const { data: { publicUrl } } = supabase.storage
				.from('bug-attachments')
				.getPublicUrl(filePath)

			// Create attachment record
			const { error: insertError } = await supabase
				.from('phwb_bug_attachments')
				.insert({
					bug_id: bugId,
					user_id: currentUser.id,
					uploaded_by: currentUser.id,
					file_name: file.name,
					file_path: filePath,
					file_size: file.size,
					mime_type: file.type
				})

			if (insertError) throw insertError

			await invalidateAll()
			target.value = ''
		} catch (error) {
			console.error('Failed to upload file:', error)
			alert('Failed to upload file: ' + (error instanceof Error ? error.message : 'Unknown error'))
		} finally {
			uploading = false
		}
	}

	async function handleDownload(attachment: BugAttachment) {
		try {
			const { data, error } = await supabase.storage
				.from('bug-attachments')
				.download(attachment.file_path)

			if (error) throw error

			const url = URL.createObjectURL(data)
			const a = document.createElement('a')
			a.href = url
			a.download = attachment.file_name
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
			URL.revokeObjectURL(url)
		} catch (error) {
			console.error('Failed to download file:', error)
			alert('Failed to download file')
		}
	}

	async function handleDelete(attachmentId: number, filePath: string) {
		if (!confirm('Are you sure you want to delete this attachment?')) return

		try {
			// Delete from storage
			await supabase.storage
				.from('bug-attachments')
				.remove([filePath])

			// Delete record
			const { error } = await supabase
				.from('phwb_bug_attachments')
				.delete()
				.eq('id', attachmentId)

			if (error) throw error

			await invalidateAll()
		} catch (error) {
			console.error('Failed to delete attachment:', error)
			alert('Failed to delete attachment')
		}
	}

	function formatFileSize(bytes: number | undefined): string {
		if (!bytes) return 'Unknown size'
		if (bytes < 1024) return `${bytes} B`
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	}
</script>

<div class="space-y-4">
	<!-- Upload Form -->
	<div class="bg-base-100 rounded-lg p-4 border border-base-300">
		<label class="btn btn-outline w-full">
			<Upload class="w-4 h-4" />
			{uploading ? 'Uploading...' : 'Upload File'}
			<input
				type="file"
				class="hidden"
				onchange={handleFileUpload}
				disabled={uploading}
			/>
		</label>
	</div>

	<!-- Attachments List -->
	<div class="space-y-2">
		{#each attachments as attachment}
			<div class="bg-base-100 rounded-lg p-4 border border-base-300 flex items-center justify-between">
				<div class="flex items-center gap-3 flex-1 min-w-0">
					<File class="w-5 h-5 flex-shrink-0 text-base-content/60" />
					<div class="flex-1 min-w-0">
						<p class="font-medium truncate">{attachment.file_name}</p>
						<div class="flex items-center gap-4 text-xs text-base-content/60">
							<span>{formatFileSize(attachment.file_size)}</span>
							<span>{formatDistanceToNow(new Date(attachment.created_at || ''), { addSuffix: true })}</span>
							{#if attachment.profiles}
								<span>by {attachment.profiles.full_name || 'Unknown'}</span>
							{/if}
						</div>
					</div>
				</div>
				<div class="flex gap-2">
					<button
						class="btn btn-sm btn-ghost"
						onclick={() => handleDownload(attachment)}
					>
						<Download class="w-4 h-4" />
					</button>
					{#if currentUser?.id === attachment.uploaded_by}
						<button
							class="btn btn-sm btn-ghost text-error"
							onclick={() => handleDelete(attachment.id as number, attachment.file_path)}
						>
							<Trash2 class="w-4 h-4" />
						</button>
					{/if}
				</div>
			</div>
		{:else}
			<div class="text-center py-8 text-base-content/60">
				No attachments yet.
			</div>
		{/each}
	</div>
</div>
