<script lang="ts">
	import { supabase } from '$lib/supabase'
	import type { Bug } from '$lib/schemas/bug'
	import { CheckCircle, XCircle, AlertTriangle, Ban, Plus, ChevronDown, ChevronUp, Image as ImageIcon, Clock, User } from 'lucide-svelte'
	import { formatDistanceToNow } from 'date-fns'
	import { toast } from '$lib/stores/toast'

	export interface TestingSession {
		id: number
		created_at: string
		updated_at: string
		bug_id: number
		tester_id: string | null
		title: string
		status: 'pass' | 'fail' | 'partial' | 'blocked'
		environment: string | null
		transcript: string | null
		summary: string | null
		media: Array<{ url: string; type: string; caption: string }> | null
		tested_issue_ids: number[] | null
		started_at: string | null
		completed_at: string | null
		profiles?: { full_name: string | null } | null
	}

	interface Props {
		bug: Bug
		sessions: TestingSession[]
		users: Array<{ id: string; full_name: string | null }>
	}

	let { bug, sessions, users }: Props = $props()

	let localSessions = $state<TestingSession[]>(sessions)
	let showCreateForm = $state(false)
	let expandedSession = $state<number | null>(null)
	let viewingImage = $state<{ url: string; caption: string } | null>(null)
	let creating = $state(false)

	// Create form state
	let newSession = $state({
		title: 'Testing Session',
		status: 'pass' as 'pass' | 'fail' | 'partial' | 'blocked',
		environment: '',
		transcript: '',
		summary: '',
		media: [] as Array<{ url: string; type: string; caption: string }>
	})

	// Media upload state
	let mediaUrl = $state('')
	let mediaCaption = $state('')
	let mediaType = $state<'screenshot' | 'recording' | 'gif'>('screenshot')

	function getStatusIcon(status: string) {
		switch (status) {
			case 'pass': return CheckCircle
			case 'fail': return XCircle
			case 'partial': return AlertTriangle
			case 'blocked': return Ban
			default: return CheckCircle
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'pass': return 'text-success'
			case 'fail': return 'text-error'
			case 'partial': return 'text-warning'
			case 'blocked': return 'text-base-content/50'
			default: return 'text-base-content/50'
		}
	}

	function getStatusBadge(status: string) {
		switch (status) {
			case 'pass': return 'badge-success'
			case 'fail': return 'badge-error'
			case 'partial': return 'badge-warning'
			case 'blocked': return 'badge-ghost'
			default: return 'badge-ghost'
		}
	}

	function getStatusLabel(status: string) {
		switch (status) {
			case 'pass': return 'Pass'
			case 'fail': return 'Fail'
			case 'partial': return 'Partial'
			case 'blocked': return 'Blocked'
			default: return status
		}
	}

	function addMedia() {
		if (!mediaUrl.trim()) return
		newSession.media = [...newSession.media, {
			url: mediaUrl.trim(),
			type: mediaType,
			caption: mediaCaption.trim() || `${mediaType} ${newSession.media.length + 1}`
		}]
		mediaUrl = ''
		mediaCaption = ''
	}

	function removeMedia(index: number) {
		newSession.media = newSession.media.filter((_, i) => i !== index)
	}

	async function createSession() {
		if (!newSession.transcript.trim() && !newSession.summary.trim()) {
			toast.error('Please add a transcript or summary')
			return
		}

		creating = true
		try {
			const { data: user } = await supabase.auth.getUser()
			
			const { data, error } = await supabase
				.from('phwb_bug_testing_sessions')
				.insert({
					bug_id: bug.id,
					tester_id: user?.user?.id || null,
					title: newSession.title || 'Testing Session',
					status: newSession.status,
					environment: newSession.environment || null,
					transcript: newSession.transcript || null,
					summary: newSession.summary || null,
					media: newSession.media.length > 0 ? newSession.media : [],
					tested_issue_ids: [bug.id],
					started_at: new Date().toISOString(),
					completed_at: new Date().toISOString()
				})
				.select()
				.single()

			if (error) throw error

			// Add tester profile info
			const testerProfile = users.find(u => u.id === user?.user?.id)
			const sessionWithProfile = {
				...data,
				profiles: testerProfile ? { full_name: testerProfile.full_name } : null
			}

			localSessions = [sessionWithProfile as TestingSession, ...localSessions]
			showCreateForm = false
			resetForm()
			toast.success('Testing session created')
		} catch (err: any) {
			console.error('Failed to create testing session:', err)
			toast.error('Failed to create testing session: ' + (err.message || 'Unknown error'))
		} finally {
			creating = false
		}
	}

	function resetForm() {
		newSession = {
			title: 'Testing Session',
			status: 'pass',
			environment: '',
			transcript: '',
			summary: '',
			media: []
		}
		mediaUrl = ''
		mediaCaption = ''
	}

	function toggleSession(id: number) {
		expandedSession = expandedSession === id ? null : id
	}

	// Simple markdown renderer
	function markdownToHtml(markdown: string): string {
		if (!markdown) return ''
		return markdown
			.replace(/^### (.*$)/gim, '<h3 class="font-bold text-base mt-3 mb-1">$1</h3>')
			.replace(/^## (.*$)/gim, '<h2 class="font-bold text-lg mt-4 mb-2">$1</h2>')
			.replace(/^# (.*$)/gim, '<h1 class="font-bold text-xl mt-4 mb-2">$1</h1>')
			.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
			.replace(/\*(.*?)\*/gim, '<em>$1</em>')
			.replace(/```([\s\S]*?)```/gim, '<pre class="bg-base-200 p-3 rounded-lg my-2 overflow-x-auto text-sm"><code>$1</code></pre>')
			.replace(/`([^`]+)`/gim, '<code class="bg-base-200 px-1.5 py-0.5 rounded text-sm">$1</code>')
			.replace(/^- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
			.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" class="link link-primary">$1</a>')
			.replace(/\n\n/gim, '</p><p class="mb-2">')
			.replace(/\n/gim, '<br>')
	}
</script>

<div class="space-y-4">
	<!-- Header with Create Button -->
	<div class="flex items-center justify-between">
		<h3 class="font-semibold text-lg">Testing Sessions ({localSessions.length})</h3>
		<button 
			class="btn btn-primary btn-sm gap-2"
			onclick={() => showCreateForm = !showCreateForm}
		>
			<Plus class="w-4 h-4" />
			{showCreateForm ? 'Cancel' : 'New Session'}
		</button>
	</div>

	<!-- Create Form -->
	{#if showCreateForm}
		<div class="card bg-base-200 shadow-sm">
			<div class="card-body p-4 space-y-3">
				<h4 class="font-medium">New Testing Session</h4>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div class="form-control">
						<label class="label py-1">
							<span class="label-text text-xs font-medium">Title</span>
						</label>
						<input
							type="text"
							class="input input-bordered input-sm"
							bind:value={newSession.title}
							placeholder="Testing Session"
						/>
					</div>
					<div class="form-control">
						<label class="label py-1">
							<span class="label-text text-xs font-medium">Result</span>
						</label>
						<select class="select select-bordered select-sm" bind:value={newSession.status}>
							<option value="pass">Pass</option>
							<option value="fail">Fail</option>
							<option value="partial">Partial</option>
							<option value="blocked">Blocked</option>
						</select>
					</div>
				</div>

				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-xs font-medium">Environment</span>
					</label>
					<input
						type="text"
						class="input input-bordered input-sm"
						bind:value={newSession.environment}
						placeholder="e.g. Chrome 120, macOS, localhost:5173"
					/>
				</div>

				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-xs font-medium">Summary</span>
					</label>
					<input
						type="text"
						class="input input-bordered input-sm"
						bind:value={newSession.summary}
						placeholder="Brief summary of test results"
					/>
				</div>

				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-xs font-medium">Transcript (Markdown)</span>
					</label>
					<textarea
						class="textarea textarea-bordered font-mono text-sm min-h-32"
						bind:value={newSession.transcript}
						placeholder="## Steps&#10;1. Navigate to /payroll&#10;2. Click on 'Type' column badge&#10;3. Verify dropdown appears&#10;&#10;## Results&#10;**PASS** - Dropdown shows W2, 1099, LLC, Roster options"
					></textarea>
				</div>

				<!-- Media Section -->
				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-xs font-medium">Media ({newSession.media.length})</span>
					</label>
					<div class="flex gap-2">
						<select class="select select-bordered select-sm w-32" bind:value={mediaType}>
							<option value="screenshot">Screenshot</option>
							<option value="recording">Recording</option>
							<option value="gif">GIF</option>
						</select>
						<input
							type="text"
							class="input input-bordered input-sm flex-1"
							bind:value={mediaUrl}
							placeholder="URL to screenshot/recording"
						/>
						<input
							type="text"
							class="input input-bordered input-sm w-40"
							bind:value={mediaCaption}
							placeholder="Caption"
						/>
						<button class="btn btn-sm btn-outline" onclick={addMedia} disabled={!mediaUrl.trim()}>
							Add
						</button>
					</div>
					{#if newSession.media.length > 0}
						<div class="mt-2 space-y-1">
							{#each newSession.media as item, i}
								<div class="flex items-center gap-2 text-sm bg-base-100 rounded px-2 py-1">
									<span class="badge badge-xs badge-ghost">{item.type}</span>
									<span class="flex-1 truncate">{item.caption}</span>
									<button class="btn btn-ghost btn-xs text-error" onclick={() => removeMedia(i)}>×</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="flex justify-end gap-2 pt-2">
					<button class="btn btn-ghost btn-sm" onclick={() => { showCreateForm = false; resetForm() }}>
						Cancel
					</button>
					<button 
						class="btn btn-primary btn-sm"
						onclick={createSession}
						disabled={creating}
					>
						{#if creating}
							<span class="loading loading-spinner loading-xs"></span>
						{/if}
						Save Session
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Sessions List -->
	{#if localSessions.length === 0 && !showCreateForm}
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body p-12 text-center">
				<CheckCircle class="w-16 h-16 mx-auto text-base-content/30 mb-4" />
				<h3 class="text-lg font-semibold mb-2">No Testing Sessions</h3>
				<p class="text-base-content/60">
					Create a testing session to document test results, screenshots, and transcripts.
				</p>
			</div>
		</div>
	{:else}
		<div class="space-y-2">
			{#each localSessions as session}
				{@const StatusIcon = getStatusIcon(session.status)}
				{@const isExpanded = expandedSession === session.id}
				{@const mediaCount = Array.isArray(session.media) ? session.media.length : 0}
				
				<div class="card bg-base-100 shadow-sm">
					<!-- Session Header (always visible) -->
					<button
						class="w-full text-left p-4 flex items-center gap-3 hover:bg-base-200/50 transition-colors rounded-t-2xl {isExpanded ? '' : 'rounded-b-2xl'}"
						onclick={() => toggleSession(session.id)}
					>
						<div class="{getStatusColor(session.status)}">
							<StatusIcon class="w-5 h-5" />
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<span class="font-medium text-sm">{session.title}</span>
								<span class="badge badge-sm {getStatusBadge(session.status)}">{getStatusLabel(session.status)}</span>
								{#if mediaCount > 0}
									<span class="badge badge-sm badge-ghost gap-1">
										<ImageIcon class="w-3 h-3" />
										{mediaCount}
									</span>
								{/if}
							</div>
							<div class="flex items-center gap-3 text-xs text-base-content/60 mt-0.5">
								{#if session.profiles?.full_name}
									<span class="flex items-center gap-1">
										<User class="w-3 h-3" />
										{session.profiles.full_name}
									</span>
								{/if}
								<span class="flex items-center gap-1">
									<Clock class="w-3 h-3" />
									{formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
								</span>
								{#if session.environment}
									<span class="truncate">{session.environment}</span>
								{/if}
							</div>
							{#if session.summary}
								<p class="text-sm text-base-content/70 mt-1 truncate">{session.summary}</p>
							{/if}
						</div>
						<div>
							{#if isExpanded}
								<ChevronUp class="w-4 h-4 text-base-content/40" />
							{:else}
								<ChevronDown class="w-4 h-4 text-base-content/40" />
							{/if}
						</div>
					</button>

					<!-- Expanded Content -->
					{#if isExpanded}
						<div class="border-t border-base-200 p-4 space-y-4">
							<!-- Transcript -->
							{#if session.transcript}
								<div>
									<h4 class="font-medium text-sm mb-2">Transcript</h4>
									<div class="bg-base-200/50 rounded-lg p-4 prose prose-sm max-w-none">
										{@html markdownToHtml(session.transcript)}
									</div>
								</div>
							{/if}

							<!-- Media Gallery -->
							{#if mediaCount > 0}
								<div>
									<h4 class="font-medium text-sm mb-2">Media ({mediaCount})</h4>
									<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
										{#each (session.media || []) as item}
											<div class="border border-base-300 rounded-lg overflow-hidden">
												{#if item.type === 'screenshot' || item.type === 'gif'}
													<div 
														class="aspect-video bg-base-200 cursor-pointer relative"
														onclick={() => viewingImage = { url: item.url, caption: item.caption }}
														role="button"
														tabindex="0"
														onkeydown={(e) => { if (e.key === 'Enter') viewingImage = { url: item.url, caption: item.caption } }}
													>
														<img 
															src={item.url} 
															alt={item.caption}
															class="w-full h-full object-cover"
															loading="lazy"
														/>
													</div>
												{:else}
													<div class="aspect-video bg-base-200 flex items-center justify-center">
														<a href={item.url} target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm">
															View Recording
														</a>
													</div>
												{/if}
												<div class="p-2">
													<p class="text-xs text-base-content/70">
														<span class="badge badge-xs badge-ghost mr-1">{item.type}</span>
														{item.caption}
													</p>
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Image Viewer Modal -->
{#if viewingImage}
	<div 
		class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
		onclick={() => viewingImage = null}
		role="dialog"
		aria-modal="true"
	>
		<div class="relative max-w-7xl max-h-full" onclick={(e) => e.stopPropagation()}>
			<button 
				class="absolute top-4 right-4 btn btn-circle btn-sm bg-base-100 hover:bg-base-200 z-10"
				onclick={() => viewingImage = null}
			>
				×
			</button>
			<img 
				src={viewingImage.url} 
				alt={viewingImage.caption}
				class="max-w-full max-h-[90vh] object-contain rounded-lg"
			/>
			{#if viewingImage.caption}
				<p class="text-white text-center mt-2 text-sm">{viewingImage.caption}</p>
			{/if}
		</div>
	</div>
{/if}
