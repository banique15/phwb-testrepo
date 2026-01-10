<script lang="ts">
	import type { ComponentType, SvelteComponent } from 'svelte'
	import type { Event } from '$lib/schemas/event'
	import { ClipboardList, CheckCircle, Music, PartyPopper, XCircle } from 'lucide-svelte'
	import { getEventStatusIcon } from '$lib/utils/icon-mapping'
	
	interface Props {
		event: Event
		onStatusChange?: (newStatus: string) => void
		readonly?: boolean
	}
	
	let { event, onStatusChange, readonly = false }: Props = $props()
	
	// Status workflow definitions
	const statusWorkflow: Record<string, {
		label: string
		color: string
		icon: ComponentType<SvelteComponent>
		description: string
		nextStates: string[]
	}> = {
		planned: {
			label: 'Planned',
			color: 'badge-outline',
			icon: ClipboardList,
			description: 'Event is in planning phase',
			nextStates: ['confirmed', 'cancelled']
		},
		confirmed: {
			label: 'Confirmed',
			color: 'badge-primary',
			icon: CheckCircle,
			description: 'Event is confirmed and scheduled',
			nextStates: ['in_progress', 'cancelled']
		},
		in_progress: {
			label: 'In Progress',
			color: 'badge-info',
			icon: Music,
			description: 'Event is currently happening',
			nextStates: ['completed', 'cancelled']
		},
		completed: {
			label: 'Completed',
			color: 'badge-success',
			icon: PartyPopper,
			description: 'Event has been completed successfully',
			nextStates: []
		},
		cancelled: {
			label: 'Cancelled',
			color: 'badge-error',
			icon: XCircle,
			description: 'Event has been cancelled',
			nextStates: ['planned']
		},
		draft: {
			label: 'Draft',
			color: 'badge-ghost',
			icon: ClipboardList,
			description: 'Event is saved as a draft',
			nextStates: ['planned', 'confirmed']
		}
	}
	
	let currentStatus = $derived(event.status || 'planned')
	let currentStatusInfo = $derived(statusWorkflow[currentStatus] || statusWorkflow.planned)
	let availableTransitions = $derived(currentStatusInfo.nextStates || [])
	
	let showTransitionModal = $state(false)
	let selectedNewStatus = $state('')
	let transitionReason = $state('')
	let confirming = $state(false)
	
	function openStatusTransition(newStatus: string) {
		selectedNewStatus = newStatus
		transitionReason = ''
		showTransitionModal = true
	}
	
	function closeTransitionModal() {
		showTransitionModal = false
		selectedNewStatus = ''
		transitionReason = ''
		confirming = false
	}
	
	async function confirmStatusChange() {
		if (!selectedNewStatus) return
		
		confirming = true
		try {
			await onStatusChange?.(selectedNewStatus)
			closeTransitionModal()
		} catch (error) {
			console.error('Failed to update status:', error)
		} finally {
			confirming = false
		}
	}
	
	function getStatusTransitionWarning(newStatus: string): string {
		switch (newStatus) {
			case 'cancelled':
				return 'This will cancel the event. Artists and venues should be notified.'
			case 'completed':
				return 'This will mark the event as completed. This action should only be done after the event has finished.'
			case 'in_progress':
				return 'This indicates the event is currently happening. Use this during live events.'
			case 'confirmed':
				return 'This confirms the event is scheduled and all arrangements are in place.'
			case 'planned':
				return 'This moves the event back to planning phase.'
			default:
				return ''
		}
	}
	
	function isEventInPast(): boolean {
		if (!event.date) return false
		const eventDate = new Date(event.date)
		const today = new Date()
		today.setHours(0, 0, 0, 0)
		return eventDate < today
	}
	
	function isEventToday(): boolean {
		if (!event.date) return false
		const eventDate = new Date(event.date)
		const today = new Date()
		return eventDate.toDateString() === today.toDateString()
	}
	
	function isEventInFuture(): boolean {
		if (!event.date) return false
		const eventDate = new Date(event.date)
		const today = new Date()
		today.setHours(23, 59, 59, 999)
		return eventDate > today
	}
	
	// Smart status suggestions based on event date
	let suggestedActions = $derived(() => {
		const suggestions = []
		
		if (isEventToday() && currentStatus === 'confirmed') {
			suggestions.push({
				status: 'in_progress',
				reason: 'Event is scheduled for today',
				priority: 'high'
			})
		}
		
		if (isEventInPast() && currentStatus === 'in_progress') {
			suggestions.push({
				status: 'completed',
				reason: 'Event date has passed',
				priority: 'high'
			})
		}
		
		if (isEventInFuture() && currentStatus === 'planned') {
			suggestions.push({
				status: 'confirmed',
				reason: 'Ready to confirm event details',
				priority: 'medium'
			})
		}
		
		return suggestions
	})
</script>

<div class="card bg-base-100 border">
	<div class="card-body p-4">
		<div class="flex items-center justify-between mb-4">
			<h4 class="card-title text-base">Event Status</h4>
			{#if !readonly && availableTransitions.length > 0}
				<div class="dropdown dropdown-end">
					<label tabindex="0" class="btn btn-sm btn-outline">
						Change Status
					</label>
					<ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-64">
						{#each availableTransitions as status}
							{@const statusInfo = statusWorkflow[status]}
							<li>
								<button onclick={() => openStatusTransition(status)}>
									<svelte:component this={statusInfo.icon} class="w-5 h-5" />
									<div class="flex-1 text-left">
										<div class="font-medium">{statusInfo.label}</div>
										<div class="text-xs opacity-60">{statusInfo.description}</div>
									</div>
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
		
		<!-- Current Status Display -->
		<div class="flex items-center gap-3 mb-4">
			<svelte:component this={currentStatusInfo.icon} class="w-8 h-8 flex-shrink-0" />
			<div class="flex-1">
				<div class="flex items-center gap-2">
					<span class="badge {currentStatusInfo.color}">
						{currentStatusInfo.label}
					</span>
				</div>
				<p class="text-sm opacity-70 mt-1">{currentStatusInfo.description}</p>
			</div>
		</div>
		
		<!-- Smart Suggestions -->
		{#if suggestedActions.length > 0 && !readonly}
			<div class="alert alert-info mb-4">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				</svg>
				<div class="flex-1">
					<h5 class="font-medium">Suggested Actions</h5>
					{#each suggestedActions as suggestion}
						{@const statusInfo = statusWorkflow[suggestion.status]}
						<div class="flex items-center justify-between mt-2">
							<div class="flex items-center gap-2">
								<svelte:component this={statusInfo.icon} class="w-4 h-4 flex-shrink-0" />
								<span class="text-sm">
									Mark as <strong>{statusInfo.label}</strong> - {suggestion.reason}
								</span>
							</div>
							<button 
								class="btn btn-xs btn-primary"
								onclick={() => openStatusTransition(suggestion.status)}
							>
								Apply
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}
		
		<!-- Status Timeline/History (placeholder for future enhancement) -->
		<div class="text-xs opacity-60">
			Last updated: {event.created_at ? new Date(event.created_at).toLocaleDateString() : 'Unknown'}
		</div>
	</div>
</div>

<!-- Status Transition Modal -->
{#if showTransitionModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg mb-4">Confirm Status Change</h3>
			
			{#if selectedNewStatus}
				{@const newStatusInfo = statusWorkflow[selectedNewStatus]}
				{@const warning = getStatusTransitionWarning(selectedNewStatus)}
				
				<div class="space-y-4">
				<!-- Transition Preview -->
				<div class="flex items-center justify-center gap-4 p-4 bg-base-200 rounded-lg">
					<div class="text-center">
						<div class="text-2xl mb-1">{currentStatusInfo.icon}</div>
						<div class="badge {currentStatusInfo.color} badge-sm">
							{currentStatusInfo.label}
						</div>
					</div>
					<div class="text-2xl">→</div>
					<div class="text-center">
						<div class="text-2xl mb-1">{newStatusInfo.icon}</div>
						<div class="badge {newStatusInfo.color} badge-sm">
							{newStatusInfo.label}
						</div>
					</div>
				</div>
				
				<!-- Warning -->
				{#if warning}
					<div class="alert alert-warning">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.99-.833-2.598 0L3.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
						</svg>
						<span>{warning}</span>
					</div>
				{/if}
				
				<!-- Reason Input -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Reason for status change (optional)</span>
					</label>
					<textarea
						bind:value={transitionReason}
						class="textarea textarea-bordered"
						placeholder="Enter a reason for this status change..."
						rows="3"
					></textarea>
				</div>
				
				</div>
				
				<!-- Modal Actions -->
				<div class="modal-action">
					<button 
						class="btn btn-outline"
						onclick={closeTransitionModal}
						disabled={confirming}
					>
						Cancel
					</button>
					<button 
						class="btn btn-primary"
						onclick={confirmStatusChange}
						disabled={confirming}
					>
						{#if confirming}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						Confirm Change
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}