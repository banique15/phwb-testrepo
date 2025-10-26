<script lang="ts">
	import { PaymentStatus } from '$lib/schemas/payroll'
	import type { PaymentStatusType } from '$lib/schemas/payroll'

	export let status: PaymentStatusType
	export let size: 'xs' | 'sm' | 'md' | 'lg' = 'sm'
	export let showIcon: boolean = true

	function getStatusConfig(status: PaymentStatusType) {
		switch (status) {
			case PaymentStatus.PLANNED:
				return {
					class: 'badge-warning',
					icon: '📅',
					label: 'Planned'
				}
			case PaymentStatus.APPROVED:
				return {
					class: 'badge-info',
					icon: '✅',
					label: 'Approved'
				}
			case PaymentStatus.PAID:
				return {
					class: 'badge-success',
					icon: '💳',
					label: 'Paid'
				}
			case PaymentStatus.COMPLETED:
				return {
					class: 'badge-primary',
					icon: '🎯',
					label: 'Completed'
				}
			case PaymentStatus.CANCELLED:
				return {
					class: 'badge-error',
					icon: '❌',
					label: 'Cancelled'
				}
			default:
				return {
					class: 'badge-neutral',
					icon: '❓',
					label: status
				}
		}
	}

	$: config = getStatusConfig(status)
	$: sizeClass = `badge-${size}`
</script>

<span class="badge {config.class} {sizeClass} max-w-full min-w-0">
	{#if showIcon}
		<span class="mr-1 flex-shrink-0">{config.icon}</span>
	{/if}
	<span class="truncate">{config.label}</span>
</span>