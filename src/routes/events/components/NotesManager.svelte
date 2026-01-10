<script lang="ts">
	import { Plus, X, Edit2, Trash2, Save } from 'lucide-svelte'
	import { supabase } from '$lib/supabase'
	import { get } from 'svelte/store'
	import { user } from '$lib/auth'

	interface Props {
		eventId: number
		notes: EventNote[]
		onUpdateNotes: (notes: EventNote[]) => Promise<void>
	}

	let { eventId, notes, onUpdateNotes }: Props = $props()

	interface EventNote {
		id: string
		content: string
		created_at: string
		updated_at?: string
		created_by?: string
		updated_by?: string
	}

	let saving = $state(false)
	let isAdding = $state(false)
	let editingId = $state<string | null>(null)

	// Local state for notes
	let localNotes = $state<EventNote[]>(notes || [])

	// Sync local state with props
	$effect(() => {
		localNotes = notes || []
	})

	// New note form state
	let newNoteContent = $state('')

	// Edit form state
	let editNoteContent = $state('')

	function formatTimestamp(timestamp: string | undefined): string {
		if (!timestamp) return ''
		const date = new Date(timestamp)
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		})
	}

	function startAdding() {
		isAdding = true
		newNoteContent = ''
	}

	function cancelAdding() {
		isAdding = false
		newNoteContent = ''
	}

	async function addNote() {
		if (!newNoteContent.trim()) return

		saving = true
		try {
			const currentUser = get(user)
			if (!currentUser) {
				throw new Error('User not authenticated')
			}

			// Insert note into database
			const { data, error } = await supabase
				.from('phwb_event_notes')
				.insert([
					{
						event_id: eventId,
						content: newNoteContent.trim(),
						created_by: currentUser.id
					}
				])
				.select()
				.single()

			if (error) throw error

			// Create history entry
			await supabase.from('phwb_event_history').insert([
				{
					event_id: eventId,
					action: 'note_added',
					metadata: {
						note_id: data.id,
						content_preview: data.content.substring(0, 100)
					},
					created_by: currentUser.id
				}
			])

			// Update local state
			localNotes = [...localNotes, data as EventNote]

			// Notify parent
			await onUpdateNotes(localNotes)

			cancelAdding()
		} catch (err) {
			console.error('Failed to add note:', err)
			alert('Failed to add note. Please try again.')
		} finally {
			saving = false
		}
	}

	function startEditing(note: EventNote) {
		editingId = note.id
		editNoteContent = note.content
	}

	function cancelEditing() {
		editingId = null
		editNoteContent = ''
	}

	async function saveEdit(noteId: string) {
		if (!editNoteContent.trim()) return

		saving = true
		try {
			const currentUser = get(user)
			if (!currentUser) {
				throw new Error('User not authenticated')
			}

			const note = localNotes.find(n => n.id === noteId)
			if (!note) return

			// Update note in database
			const { data, error } = await supabase
				.from('phwb_event_notes')
				.update({
					content: editNoteContent.trim(),
					updated_by: currentUser.id
				})
				.eq('id', noteId)
				.select()
				.single()

			if (error) throw error

			// Create history entry
			await supabase.from('phwb_event_history').insert([
				{
					event_id: eventId,
					action: 'note_updated',
					previous_value: note.content,
					new_value: data.content,
					metadata: {
						note_id: noteId,
						content_preview: data.content.substring(0, 100)
					},
					created_by: currentUser.id
				}
			])

			// Update local state
			localNotes = localNotes.map(n => (n.id === noteId ? data as EventNote : n))

			// Notify parent
			await onUpdateNotes(localNotes)

			cancelEditing()
		} catch (err) {
			console.error('Failed to update note:', err)
			alert('Failed to update note. Please try again.')
		} finally {
			saving = false
		}
	}

	async function deleteNote(noteId: string) {
		const note = localNotes.find(n => n.id === noteId)
		if (!note) return

		if (!confirm('Delete this note? This action cannot be undone.')) return

		saving = true
		try {
			const currentUser = get(user)
			if (!currentUser) {
				throw new Error('User not authenticated')
			}

			// Delete note from database
			const { error } = await supabase
				.from('phwb_event_notes')
				.delete()
				.eq('id', noteId)

			if (error) throw error

			// Create history entry
			await supabase.from('phwb_event_history').insert([
				{
					event_id: eventId,
					action: 'note_deleted',
					previous_value: note.content,
					metadata: {
						note_id: noteId,
						content_preview: note.content.substring(0, 100)
					},
					created_by: currentUser.id
				}
			])

			// Update local state
			localNotes = localNotes.filter(n => n.id !== noteId)

			// Notify parent
			await onUpdateNotes(localNotes)
		} catch (err) {
			console.error('Failed to delete note:', err)
			alert('Failed to delete note. Please try again.')
		} finally {
			saving = false
		}
	}
</script>

<div class="space-y-4">
	<!-- Header with Add button -->
	<div class="flex items-center justify-between">
		<h3 class="text-lg font-semibold">Notes ({localNotes.length})</h3>
		{#if !isAdding}
			<button
				type="button"
				class="btn btn-primary btn-sm gap-2"
				onclick={startAdding}
				disabled={saving}
			>
				<Plus class="w-4 h-4" />
				Add Note
			</button>
		{/if}
	</div>

	<!-- Add Note Form -->
	{#if isAdding}
		<div class="card bg-base-200 p-4">
			<div class="flex items-center justify-between mb-3">
				<span class="font-medium text-sm">Add New Note</span>
				<button
					type="button"
					class="btn btn-ghost btn-xs btn-circle"
					onclick={cancelAdding}
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="form-control">
				<textarea
					bind:value={newNoteContent}
					placeholder="Enter your note..."
					class="textarea textarea-bordered textarea-sm w-full"
					rows="4"
					disabled={saving}
				></textarea>
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-2 mt-4">
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={cancelAdding}
					disabled={saving}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn-primary btn-sm"
					onclick={addNote}
					disabled={saving || !newNoteContent.trim()}
				>
					{#if saving}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<Save class="w-4 h-4" />
					{/if}
					Add Note
				</button>
			</div>
		</div>
	{/if}

	<!-- Notes List -->
	{#if localNotes.length === 0}
		<div class="text-center py-8 border-2 border-dashed border-base-300 rounded-lg">
			<p class="text-base opacity-70 mb-2">No notes yet</p>
			<p class="text-sm opacity-50">Click "Add Note" to create your first note</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each localNotes as note (note.id)}
				<div class="card bg-base-200 hover:bg-base-300 transition-colors group">
					<div class="card-body p-4">
						{#if editingId === note.id}
							<!-- Edit Mode -->
							<div class="space-y-3">
								<textarea
									bind:value={editNoteContent}
									class="textarea textarea-bordered textarea-sm w-full"
									rows="4"
									disabled={saving}
								></textarea>

								<div class="flex justify-end gap-2">
									<button
										type="button"
										class="btn btn-ghost btn-xs"
										onclick={cancelEditing}
										disabled={saving}
									>
										Cancel
									</button>
									<button
										type="button"
										class="btn btn-primary btn-xs"
										onclick={() => saveEdit(note.id)}
										disabled={saving || !editNoteContent.trim()}
									>
										{#if saving}
											<span class="loading loading-spinner loading-xs"></span>
										{:else}
											<Save class="w-3 h-3" />
										{/if}
										Save
									</button>
								</div>
							</div>
						{:else}
							<!-- View Mode -->
							<div class="flex items-start gap-3">
								<div class="flex-1 min-w-0">
									<p class="text-sm whitespace-pre-wrap">{note.content}</p>
									<div class="flex items-center gap-2 mt-2 text-xs opacity-60">
										<span>Created {formatTimestamp(note.created_at)}</span>
										{#if note.updated_at && note.updated_at !== note.created_at}
											<span>•</span>
											<span>Updated {formatTimestamp(note.updated_at)}</span>
										{/if}
									</div>
								</div>
								<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
									<button
										type="button"
										class="btn btn-ghost btn-xs btn-circle"
										onclick={() => startEditing(note)}
										disabled={saving}
										title="Edit"
									>
										<Edit2 class="w-3 h-3" />
									</button>
									<button
										type="button"
										class="btn btn-ghost btn-xs btn-circle text-error"
										onclick={() => deleteNote(note.id)}
										disabled={saving}
										title="Delete"
									>
										<Trash2 class="w-3 h-3" />
									</button>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Saving indicator -->
	{#if saving}
		<div class="flex items-center justify-center gap-2 text-sm opacity-70">
			<span class="loading loading-spinner loading-xs"></span>
			Saving...
		</div>
	{/if}
</div>

