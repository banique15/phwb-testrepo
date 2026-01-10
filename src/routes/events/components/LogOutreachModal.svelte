<script lang="ts">
	import { Mail, Phone, MessageSquare, User, MoreHorizontal, X, CheckCircle, XCircle, Clock } from 'lucide-svelte'
	import type { OutreachMethod, ResponseType, CreateOutreachInput } from '$lib/schemas/outreach'

	interface Props {
		isOpen: boolean
		eventId: number
		artistId: string
		artistName: string
		onClose: () => void
		onSubmit: (data: CreateOutreachInput) => Promise<void>
	}

	let { isOpen, eventId, artistId, artistName, onClose, onSubmit }: Props = $props()

	let method = $state<OutreachMethod>('email')
	let notes = $state('')
	let recordResponse = $state(false)
	let responseType = $state<ResponseType | null>(null)
	let saving = $state(false)
	let error = $state<string | null>(null)

	const methods: { value: OutreachMethod; label: string; icon: typeof Mail }[] = [
		{ value: 'email', label: 'Email', icon: Mail },
		{ value: 'phone', label: 'Phone', icon: Phone },
		{ value: 'text', label: 'Text', icon: MessageSquare },
		{ value: 'in_person', label: 'In Person', icon: User },
		{ value: 'other', label: 'Other', icon: MoreHorizontal }
	]

	const responses: { value: ResponseType; label: string; icon: typeof CheckCircle; class: string }[] = [
		{ value: 'confirmed', label: 'Confirmed', icon: CheckCircle, class: 'btn-success' },
		{ value: 'declined', label: 'Declined', icon: XCircle, class: 'btn-error' },
		{ value: 'no_response', label: 'No Response', icon: Clock, class: 'btn-warning btn-outline' }
	]

	function resetForm() {
		method = 'email'
		notes = ''
		recordResponse = false
		responseType = null
		error = null
	}

	function handleClose() {
		resetForm()
		onClose()
	}

	async function handleSubmit(e: Event) {
		e.preventDefault()
		saving = true
		error = null

		try {
			const data: CreateOutreachInput = {
				event_id: eventId,
				artist_id: artistId,
				method,
				notes: notes.trim() || undefined,
				response_type: recordResponse && responseType ? responseType : undefined
			}

			await onSubmit(data)
			handleClose()
		} catch (err: any) {
			error = err.message || 'Failed to save outreach'
		} finally {
			saving = false
		}
	}
</script>

{#if isOpen}
	<dialog class="modal modal-open">
		<div class="modal-box max-w-md">
			<form onsubmit={handleSubmit}>
				<!-- Header -->
				<div class="flex items-center justify-between mb-4">
					<h3 class="font-bold text-lg">Log Outreach</h3>
					<button
						type="button"
						class="btn btn-ghost btn-sm btn-circle"
						onclick={handleClose}
						disabled={saving}
					>
						<X class="w-5 h-5" />
					</button>
				</div>

				<p class="text-sm text-base-content/70 mb-4">
					Recording outreach to <span class="font-medium">{artistName}</span>
				</p>

				{#if error}
					<div class="alert alert-error mb-4">
						<span>{error}</span>
					</div>
				{/if}

				<!-- Method Selection -->
				<div class="form-control mb-4">
					<label class="label">
						<span class="label-text font-medium">Method</span>
					</label>
					<div class="flex flex-wrap gap-2">
						{#each methods as m}
							{@const Icon = m.icon}
							<button
								type="button"
								class="btn btn-sm gap-2 {method === m.value ? 'btn-primary' : 'btn-outline'}"
								onclick={() => method = m.value}
								disabled={saving}
							>
								<Icon class="w-4 h-4" />
								{m.label}
							</button>
						{/each}
					</div>
				</div>

				<!-- Notes -->
				<div class="form-control mb-4">
					<label class="label">
						<span class="label-text font-medium">Notes (optional)</span>
					</label>
					<textarea
						bind:value={notes}
						class="textarea textarea-bordered h-24"
						placeholder="Any details about this outreach..."
						disabled={saving}
						maxlength={2000}
					></textarea>
				</div>

				<!-- Record Response -->
				<div class="form-control mb-4">
					<label class="label cursor-pointer justify-start gap-3">
						<input
							type="checkbox"
							bind:checked={recordResponse}
							class="checkbox checkbox-sm"
							disabled={saving}
						/>
						<span class="label-text">Record response now</span>
					</label>
				</div>

				{#if recordResponse}
					<div class="form-control mb-4 pl-7">
						<div class="flex flex-wrap gap-2">
							{#each responses as r}
								{@const Icon = r.icon}
								<button
									type="button"
									class="btn btn-sm gap-2 {responseType === r.value ? r.class : 'btn-ghost'}"
									onclick={() => responseType = r.value}
									disabled={saving}
								>
									<Icon class="w-4 h-4" />
									{r.label}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Actions -->
				<div class="modal-action">
					<button
						type="button"
						class="btn btn-ghost"
						onclick={handleClose}
						disabled={saving}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="btn btn-primary"
						disabled={saving || (recordResponse && !responseType)}
					>
						{#if saving}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						Log Outreach
					</button>
				</div>
			</form>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={handleClose} disabled={saving}>close</button>
		</form>
	</dialog>
{/if}
