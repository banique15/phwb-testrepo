<script lang="ts">
	import { onMount } from 'svelte'
	import { payrollStore } from '$lib/stores/payroll'
	import type { PayrollAudit } from '$lib/schemas/payroll-audit'
	import { AuditAction } from '$lib/schemas/payroll-audit'

	interface AuditLogEntry extends PayrollAudit {
		users?: {
			id: string
			email?: string
			full_name?: string
		}
	}

	export let paymentId: number
	export let isOpen: boolean = false

	let auditLog: AuditLogEntry[] = []
	let isLoading = false
	let error: string | null = null

	$: if (isOpen && paymentId) {
		loadAuditLog()
	}

	async function loadAuditLog() {
		isLoading = true
		error = null
		
		try {
			auditLog = await payrollStore.getAuditLog(paymentId)
		} catch (err) {
			error = 'Failed to load audit log'
			console.error('Audit log error:', err)
		} finally {
			isLoading = false
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleString()
	}

	function getActionIcon(action: string): string {
		switch (action) {
			case AuditAction.CREATE:
				return '➕'
			case AuditAction.UPDATE:
				return '✏️'
			case AuditAction.DELETE:
				return '🗑️'
			case AuditAction.APPROVE:
				return '✅'
			case AuditAction.REJECT:
				return '❌'
			case AuditAction.PROCESS:
				return '💳'
			case AuditAction.RECONCILE:
				return '🔄'
			case AuditAction.EXPORT:
				return '📤'
			default:
				return '📝'
		}
	}

	function getActionColor(action: string): string {
		switch (action) {
			case AuditAction.CREATE:
				return 'badge-success'
			case AuditAction.UPDATE:
				return 'badge-info'
			case AuditAction.DELETE:
				return 'badge-error'
			case AuditAction.APPROVE:
				return 'badge-success'
			case AuditAction.REJECT:
				return 'badge-error'
			case AuditAction.PROCESS:
				return 'badge-primary'
			case AuditAction.RECONCILE:
				return 'badge-accent'
			case AuditAction.EXPORT:
				return 'badge-info'
			default:
				return 'badge-neutral'
		}
	}

	function formatFieldChanges(previous: any, current: any): string {
		if (!previous || !current) return ''
		
		const changes = []
		for (const [key, newValue] of Object.entries(current)) {
			const oldValue = previous[key]
			if (oldValue !== newValue) {
				changes.push(`${key}: ${oldValue} → ${newValue}`)
			}
		}
		return changes.join(', ')
	}
</script>

{#if isOpen}
	<div class="modal modal-open">
		<div class="modal-box w-11/12 max-w-4xl">
			<div class="flex items-center justify-between mb-6">
				<h3 class="font-bold text-lg">Payment Audit Log</h3>
				<button class="btn btn-sm btn-circle btn-ghost" on:click={() => isOpen = false}>✕</button>
			</div>

			{#if isLoading}
				<div class="flex justify-center items-center py-12">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{:else if error}
				<div class="alert alert-error">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>{error}</span>
				</div>
			{:else if auditLog.length === 0}
				<div class="text-center py-12">
					<div class="text-4xl mb-4">📋</div>
					<h4 class="text-lg font-medium mb-2">No Audit Trail</h4>
					<p class="text-base-content/60">No audit entries found for this payment.</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each auditLog as entry}
						<div class="card bg-base-100 border border-base-300">
							<div class="card-body p-4">
								<div class="flex items-start justify-between">
									<div class="flex items-start space-x-3">
										<div class="text-2xl">{getActionIcon(entry.action)}</div>
										<div class="flex-1">
											<div class="flex items-center space-x-2 mb-2">
												<span class="badge {getActionColor(entry.action)} badge-sm">
													{entry.action.toUpperCase()}
												</span>
												<span class="text-sm font-medium">
													{entry.users?.full_name || entry.users?.email || 'Unknown User'}
												</span>
											</div>
											
											{#if entry.notes}
												<p class="text-sm text-base-content/80 mb-2">{entry.notes}</p>
											{/if}

											{#if entry.previous_values && entry.new_values}
												<div class="bg-base-200 rounded p-2 text-xs">
													<strong>Changes:</strong>
													<div class="mt-1 font-mono text-xs">
														{formatFieldChanges(entry.previous_values, entry.new_values)}
													</div>
												</div>
											{/if}

											{#if entry.ip_address}
												<div class="text-xs text-base-content/60 mt-2">
													IP: {entry.ip_address}
												</div>
											{/if}
										</div>
									</div>
									<div class="text-xs text-base-content/60 text-right">
										{formatDate(entry.created_at || '')}
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Summary Stats -->
				<div class="divider">Activity Summary</div>
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
					{#each Object.values(AuditAction) as action}
						{@const count = auditLog.filter(entry => entry.action === action).length}
						{#if count > 0}
							<div class="stat bg-base-200 rounded-lg">
								<div class="stat-figure text-2xl">{getActionIcon(action)}</div>
								<div class="stat-title text-xs capitalize">{action}</div>
								<div class="stat-value text-lg">{count}</div>
							</div>
						{/if}
					{/each}
				</div>
			{/if}

			<!-- Actions -->
			<div class="modal-action">
				<button class="btn btn-ghost" on:click={() => isOpen = false}>
					Close
				</button>
				<button class="btn btn-primary" on:click={loadAuditLog} disabled={isLoading}>
					{#if isLoading}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						Refresh
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}