<script lang="ts">
	import { Circle, Send, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-svelte'
	import type { ConfirmationStatus } from '$lib/schemas/outreach'
	import { getConfirmationStatusInfo } from '$lib/schemas/outreach'

	interface Props {
		status: ConfirmationStatus
		size?: 'xs' | 'sm' | 'md'
		showLabel?: boolean
	}

	let { status, size = 'sm', showLabel = true }: Props = $props()

	const statusInfo = $derived(getConfirmationStatusInfo(status))

	const sizeClasses = {
		xs: 'badge-xs text-xs',
		sm: 'badge-sm text-sm',
		md: 'badge-md'
	}

	const iconSize = {
		xs: 'w-3 h-3',
		sm: 'w-3.5 h-3.5',
		md: 'w-4 h-4'
	}
</script>

<span class="badge gap-1 {statusInfo.badgeClass} {sizeClasses[size]}">
	{#if status === 'not_contacted'}
		<Circle class={iconSize[size]} />
	{:else if status === 'contacted'}
		<Send class={iconSize[size]} />
	{:else if status === 'awaiting_response'}
		<Clock class={iconSize[size]} />
	{:else if status === 'confirmed'}
		<CheckCircle class={iconSize[size]} />
	{:else if status === 'declined'}
		<XCircle class={iconSize[size]} />
	{:else if status === 'no_response'}
		<AlertCircle class={iconSize[size]} />
	{/if}
	{#if showLabel}
		<span>{statusInfo.label}</span>
	{/if}
</span>
