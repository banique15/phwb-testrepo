<script lang="ts">
	import { Mail, Phone, MessageSquare, User, MoreHorizontal, CheckCircle, XCircle, HelpCircle, Clock, Trash2 } from 'lucide-svelte'
	import type { OutreachAttemptWithUser, OutreachMethod, ResponseType } from '$lib/schemas/outreach'

	interface Props {
		outreachHistory: OutreachAttemptWithUser[]
		onDelete?: (outreachId: string) => void
		showDelete?: boolean
	}

	let { outreachHistory, onDelete, showDelete = false }: Props = $props()

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr)
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
		})
	}

	function formatTime(dateStr: string): string {
		const date = new Date(dateStr)
		return date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		})
	}

	function getMethodIcon(method: OutreachMethod) {
		switch (method) {
			case 'email': return Mail
			case 'phone': return Phone
			case 'text': return MessageSquare
			case 'in_person': return User
			case 'other': return MoreHorizontal
		}
	}

	function getMethodLabel(method: OutreachMethod): string {
		switch (method) {
			case 'email': return 'Email'
			case 'phone': return 'Phone call'
			case 'text': return 'Text message'
			case 'in_person': return 'In person'
			case 'other': return 'Other'
		}
	}

	function getResponseIcon(response: ResponseType) {
		switch (response) {
			case 'confirmed': return CheckCircle
			case 'declined': return XCircle
			case 'maybe': return HelpCircle
			case 'no_response': return Clock
		}
	}

	function getResponseLabel(response: ResponseType): string {
		switch (response) {
			case 'confirmed': return 'Confirmed'
			case 'declined': return 'Declined'
			case 'maybe': return 'Maybe'
			case 'no_response': return 'No response'
		}
	}

	function getResponseClass(response: ResponseType): string {
		switch (response) {
			case 'confirmed': return 'text-success'
			case 'declined': return 'text-error'
			case 'maybe': return 'text-warning'
			case 'no_response': return 'text-base-content/50'
		}
	}

	function handleDelete(outreachId: string) {
		if (confirm('Delete this outreach record?')) {
			onDelete?.(outreachId)
		}
	}
</script>

{#if outreachHistory.length === 0}
	<div class="text-center py-4 text-sm text-base-content/60">
		No outreach attempts recorded yet
	</div>
{:else}
	<div class="space-y-3">
		{#each outreachHistory as outreach (outreach.id)}
			{@const MethodIcon = getMethodIcon(outreach.method)}
			<div class="flex gap-3 group">
				<!-- Timeline marker -->
				<div class="flex flex-col items-center">
					<div class="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center flex-shrink-0">
						<MethodIcon class="w-4 h-4" />
					</div>
					<div class="w-0.5 bg-base-300 flex-1 mt-1"></div>
				</div>

				<!-- Content -->
				<div class="flex-1 pb-4">
					<div class="flex items-start justify-between">
						<div>
							<div class="font-medium text-sm">
								{getMethodLabel(outreach.method)}
							</div>
							<div class="text-xs text-base-content/60">
								{formatDate(outreach.outreach_date)} at {formatTime(outreach.outreach_date)}
								{#if outreach.performed_by_user?.full_name}
									<span class="mx-1">by</span>
									<span>{outreach.performed_by_user.full_name}</span>
								{/if}
							</div>
						</div>

						{#if showDelete && onDelete}
							<button
								type="button"
								class="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100 transition-opacity"
								onclick={() => handleDelete(outreach.id)}
								title="Delete outreach"
							>
								<Trash2 class="w-3 h-3" />
							</button>
						{/if}
					</div>

					{#if outreach.notes}
						<div class="mt-1 text-sm text-base-content/80 bg-base-200 rounded-lg px-3 py-2">
							{outreach.notes}
						</div>
					{/if}

					{#if outreach.response_type}
						{@const ResponseIcon = getResponseIcon(outreach.response_type)}
						<div class="mt-2 flex items-center gap-1.5 text-sm {getResponseClass(outreach.response_type)}">
							<ResponseIcon class="w-4 h-4" />
							<span class="font-medium">{getResponseLabel(outreach.response_type)}</span>
							{#if outreach.response_received_at}
								<span class="text-base-content/50 text-xs">
									on {formatDate(outreach.response_received_at)}
								</span>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}
