<script lang="ts">
	import type { ComponentType, SvelteComponent } from 'svelte'
	import { PaymentStatus } from '$lib/schemas/payroll'
	import type { PaymentStatusType } from '$lib/schemas/payroll'
	import { Calendar, CheckCircle, CreditCard, Target, XCircle, HelpCircle } from 'lucide-svelte'
	import { getPaymentStatusIcon } from '$lib/utils/icon-mapping'

	export let status: PaymentStatusType
	export let size: 'xs' | 'sm' | 'md' | 'lg' = 'sm'
	export let showIcon: boolean = true

	function getStatusConfig(status: PaymentStatusType) {
		switch (status) {
			case PaymentStatus.PLANNED:
				return {
					class: 'badge-warning',
					icon: Calendar,
					label: 'Planned'
				}
			case PaymentStatus.APPROVED:
				return {
					class: 'badge-info',
					icon: CheckCircle,
					label: 'Approved'
				}
			case PaymentStatus.PAID:
				return {
					class: 'badge-success',
					icon: CreditCard,
					label: 'Paid'
				}
			case PaymentStatus.COMPLETED:
				return {
					class: 'badge-primary',
					icon: Target,
					label: 'Completed'
				}
			case PaymentStatus.CANCELLED:
				return {
					class: 'badge-error',
					icon: XCircle,
					label: 'Cancelled'
				}
			default:
				return {
					class: 'badge-neutral',
					icon: HelpCircle,
					label: status
				}
		}
	}

	$: config = getStatusConfig(status)
	$: sizeClass = `badge-${size}`
	$: iconSize = size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-3.5 h-3.5' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'
</script>

<span class="badge {config.class} {sizeClass} max-w-full min-w-0">
	{#if showIcon}
		<svelte:component this={config.icon} class="{iconSize} mr-1 flex-shrink-0" />
	{/if}
	<span class="truncate">{config.label}</span>
</span>