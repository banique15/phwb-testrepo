<script lang="ts">
	import { supabase } from '$lib/supabase'
	import type { Bug } from '$lib/schemas/bug'
	import type { BugAttachment } from '$lib/schemas/bug-attachment'
	import { Download, Image as ImageIcon, X } from 'lucide-svelte'
	import { onMount } from 'svelte'

	interface Props {
		bug: Bug
		screenshots: Array<BugAttachment & { profiles?: { full_name: string | null } | null }>
	}

	let { bug, screenshots }: Props = $props()

	let screenshotUrls = $state<Map<number, string>>(new Map())
	let viewingImage = $state<{ url: string; name: string } | null>(null)

	// Simple markdown to HTML converter (basic support)
	function markdownToHtml(markdown: string): string {
		if (!markdown) return ''
		
		let html = markdown
			// Headers
			.replace(/^### (.*$)/gim, '<h3>$1</h3>')
			.replace(/^## (.*$)/gim, '<h2>$1</h2>')
			.replace(/^# (.*$)/gim, '<h1>$1</h1>')
			// Bold
			.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
			// Italic
			.replace(/\*(.*?)\*/gim, '<em>$1</em>')
			// Code blocks
			.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
			// Inline code
			.replace(/`([^`]+)`/gim, '<code>$1</code>')
			// Links
			.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
			// Line breaks
			.replace(/\n\n/gim, '</p><p>')
			.replace(/\n/gim, '<br>')
		
		// Wrap in paragraph if not already wrapped
		if (!html.startsWith('<')) {
			html = '<p>' + html + '</p>'
		}
		
		return html
	}

	// Load screenshot URLs
	onMount(async () => {
		const urls = new Map<number, string>()
		
		for (const screenshot of screenshots) {
			try {
				// Remove 'bug-attachments/' prefix if present, since getPublicUrl already knows the bucket
				let filePath = screenshot.file_path
				if (filePath.startsWith('bug-attachments/')) {
					filePath = filePath.replace('bug-attachments/', '')
				}
				
				const { data } = supabase.storage
					.from('bug-attachments')
					.getPublicUrl(filePath)
				
				if (data?.publicUrl) {
					urls.set(screenshot.id as number, data.publicUrl)
				}
			} catch (err) {
				console.error('Failed to get screenshot URL:', err)
			}
		}
		
		screenshotUrls = urls
	})

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

	function openImageViewer(url: string, name: string) {
		viewingImage = { url, name }
	}

	function closeImageViewer() {
		viewingImage = null
	}
</script>

<div class="space-y-6">
	{#if !bug.replication_data || (typeof bug.replication_data === 'object' && !bug.replication_data.report)}
		<!-- Empty State -->
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body p-12 text-center">
				<ImageIcon class="w-16 h-16 mx-auto text-base-content/30 mb-4" />
				<h3 class="text-lg font-semibold mb-2">No Replication Data</h3>
				<p class="text-base-content/60">
					Replication steps and screenshots will appear here once they are added.
				</p>
			</div>
		</div>
	{:else}
		{@const replicationData = bug.replication_data as { report: string; screenshot_ids?: number[] } | null}
		
		<!-- Markdown Report -->
		{#if replicationData?.report}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body p-6">
					<h3 class="font-semibold text-lg mb-4">Replication Report</h3>
					<div 
						class="prose max-w-none"
						style="max-width: none;"
					>
						{@html markdownToHtml(replicationData.report)}
					</div>
				</div>
			</div>
		{/if}

		<!-- Screenshot Gallery -->
		{#if screenshots.length > 0}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body p-6">
					<h3 class="font-semibold text-lg mb-4">Screenshots ({screenshots.length})</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{#each screenshots as screenshot}
							{@const url = screenshotUrls.get(screenshot.id as number)}
							<div class="border border-base-300 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
								{#if url}
									<div class="aspect-video bg-base-200 relative cursor-pointer" onclick={() => openImageViewer(url, screenshot.file_name)}>
										<img 
											src={url} 
											alt={screenshot.file_name}
											class="w-full h-full object-cover"
											loading="lazy"
										/>
										<div class="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center">
											<ImageIcon class="w-8 h-8 text-white opacity-0 hover:opacity-100 transition-opacity" />
										</div>
									</div>
								{:else}
									<div class="aspect-video bg-base-200 flex items-center justify-center">
										<ImageIcon class="w-12 h-12 text-base-content/30" />
									</div>
								{/if}
								<div class="p-3">
									<p class="text-sm font-medium truncate mb-1">{screenshot.file_name}</p>
									<button 
										class="btn btn-sm btn-ghost w-full gap-2"
										onclick={() => handleDownload(screenshot)}
									>
										<Download class="w-4 h-4" />
										Download
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Image Viewer Modal -->
{#if viewingImage}
	<div 
		class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
		onclick={closeImageViewer}
		role="dialog"
		aria-modal="true"
	>
		<div class="relative max-w-7xl max-h-full" onclick={(e) => e.stopPropagation()}>
			<button 
				class="absolute top-4 right-4 btn btn-circle btn-sm bg-base-100 hover:bg-base-200 z-10"
				onclick={closeImageViewer}
			>
				<X class="w-5 h-5" />
			</button>
			<img 
				src={viewingImage.url} 
				alt={viewingImage.name}
				class="max-w-full max-h-[90vh] object-contain rounded-lg"
			/>
		</div>
	</div>
{/if}

<style>
	:global(.prose) {
		color: inherit;
	}
	:global(.prose h1) {
		font-size: 2em;
		font-weight: bold;
		margin-top: 1em;
		margin-bottom: 0.5em;
	}
	:global(.prose h2) {
		font-size: 1.5em;
		font-weight: bold;
		margin-top: 0.8em;
		margin-bottom: 0.4em;
	}
	:global(.prose h3) {
		font-size: 1.25em;
		font-weight: bold;
		margin-top: 0.6em;
		margin-bottom: 0.3em;
	}
	:global(.prose p) {
		margin-bottom: 1em;
		line-height: 1.6;
	}
	:global(.prose code) {
		background-color: hsl(var(--b2));
		padding: 0.2em 0.4em;
		border-radius: 0.25rem;
		font-family: monospace;
		font-size: 0.9em;
	}
	:global(.prose pre) {
		background-color: hsl(var(--b2));
		padding: 1em;
		border-radius: 0.5rem;
		overflow-x: auto;
		margin: 1em 0;
	}
	:global(.prose pre code) {
		background-color: transparent;
		padding: 0;
	}
	:global(.prose a) {
		color: hsl(var(--p));
		text-decoration: underline;
	}
	:global(.prose a:hover) {
		color: hsl(var(--pf));
	}
	:global(.prose strong) {
		font-weight: bold;
	}
	:global(.prose em) {
		font-style: italic;
	}
</style>
