<script lang="ts">
	import { CheckCircle, Clock, AlertTriangle, Circle } from 'lucide-svelte'
	import type { EventConfirmationSummary } from '$lib/schemas/outreach'

	interface Props {
		summary: EventConfirmationSummary
		eventStatus?: string
		compact?: boolean
	}

	let { summary, eventStatus, compact = false }: Props = $props()

	// Show warning if event is "confirmed" but not all artists are confirmed
	const showWarning = $derived(
		eventStatus === 'confirmed' &&
		summary.total_artists > 0 &&
		summary.confirmed < summary.total_artists
	)

	const pendingCount = $derived(
		summary.awaiting_response + summary.not_contacted + summary.no_response + summary.contacted
	)
</script>

{#if compact}
	<!-- Compact view for header -->
	<div class="flex items-center gap-2 text-sm">
		{#if showWarning}
			<AlertTriangle class="w-4 h-4 text-warning" />
		{/if}

		{#if summary.confirmed > 0}
			<span class="flex items-center gap-1 text-success">
				<CheckCircle class="w-3.5 h-3.5" />
				{summary.confirmed}
			</span>
		{/if}

		{#if summary.awaiting_response > 0}
			<span class="flex items-center gap-1 text-warning">
				<Clock class="w-3.5 h-3.5" />
				{summary.awaiting_response}
			</span>
		{/if}

		{#if summary.not_contacted > 0}
			<span class="flex items-center gap-1 text-base-content/50">
				<Circle class="w-3.5 h-3.5" />
				{summary.not_contacted}
			</span>
		{/if}

		{#if summary.declined > 0}
			<span class="text-error text-xs">
				({summary.declined} declined)
			</span>
		{/if}
	</div>
{:else}
	<!-- Full view with progress bar -->
	<div class="space-y-2">
		{#if showWarning}
			<div class="flex items-center gap-2 text-warning text-sm">
				<AlertTriangle class="w-4 h-4" />
				<span>Event confirmed but {pendingCount} artist{pendingCount !== 1 ? 's' : ''} pending</span>
			</div>
		{/if}

		<!-- Summary text -->
		<div class="flex items-center gap-3 text-sm">
			{#if summary.confirmed > 0}
				<span class="flex items-center gap-1">
					<CheckCircle class="w-4 h-4 text-success" />
					<span class="font-medium">{summary.confirmed}</span>
					<span class="text-base-content/60">confirmed</span>
				</span>
			{/if}

			{#if summary.awaiting_response > 0}
				<span class="flex items-center gap-1">
					<Clock class="w-4 h-4 text-warning" />
					<span class="font-medium">{summary.awaiting_response}</span>
					<span class="text-base-content/60">awaiting</span>
				</span>
			{/if}

			{#if summary.not_contacted > 0}
				<span class="flex items-center gap-1">
					<Circle class="w-4 h-4 text-base-content/40" />
					<span class="font-medium">{summary.not_contacted}</span>
					<span class="text-base-content/60">not contacted</span>
				</span>
			{/if}

			{#if summary.declined > 0}
				<span class="text-error">
					{summary.declined} declined
				</span>
			{/if}
		</div>

		<!-- Progress bar -->
		{#if summary.total_artists > 0}
			<div class="w-full bg-base-300 rounded-full h-2 overflow-hidden flex">
				{#if summary.confirmed > 0}
					<div
						class="bg-success h-full"
						style="width: {(summary.confirmed / summary.total_artists) * 100}%"
					></div>
				{/if}
				{#if summary.awaiting_response > 0}
					<div
						class="bg-warning h-full"
						style="width: {(summary.awaiting_response / summary.total_artists) * 100}%"
					></div>
				{/if}
				{#if summary.contacted > 0}
					<div
						class="bg-info h-full"
						style="width: {(summary.contacted / summary.total_artists) * 100}%"
					></div>
				{/if}
				{#if summary.no_response > 0}
					<div
						class="bg-warning/50 h-full"
						style="width: {(summary.no_response / summary.total_artists) * 100}%"
					></div>
				{/if}
				{#if summary.declined > 0}
					<div
						class="bg-error h-full"
						style="width: {(summary.declined / summary.total_artists) * 100}%"
					></div>
				{/if}
				<!-- Not contacted fills remaining space with base-300 (already the background) -->
			</div>
		{/if}
	</div>
{/if}
