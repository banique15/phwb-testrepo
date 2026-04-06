<script lang="ts">
	import { createBug, bugsStore } from '$lib/stores/bugs'
	import { createBugSchema, type CreateBug } from '$lib/schemas/bug'
	import { X, Loader2 } from 'lucide-svelte'
	import { supabase } from '$lib/supabase'
	import { invalidateAll } from '$app/navigation'

	interface Props {
		isOpen?: boolean
		onSuccess?: (() => void)
	}

	let { isOpen = $bindable(false), onSuccess }: Props = $props()

	let formData = $state<CreateBug>({
		title: '',
		description: '',
		status: 'new',
		priority: 'medium',
		severity: 'moderate',
		category: 'UI/UX',
		assigned_to: null,
		due_date: null,
		reported_by: undefined
	})

	let errors = $state<Record<string, string>>({})
	let submitting = $state(false)
	let users = $state<Array<{ id: string; full_name: string | null }>>([])
	let currentUserName = $state<string>('')

	const categoryOptions = ['Artists', 'Events', 'Events/Payroll', 'Facilities', 'Feature Request', 'Payroll', 'Programs', 'UI/UX']
	const statusOptions = ['new', 'planning', 'in_progress', 'testing', 'review', 'resolved', 'closed'] as const

	// Load current user and available users
	async function loadUsers() {
		const { data: { user } } = await supabase.auth.getUser()
		if (user) {
			formData.reported_by = user.id
			const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
			currentUserName = profile?.full_name ?? user.email ?? 'You'
		}

		const { data } = await supabase
			.from('profiles')
			.select('id, full_name')
			.order('full_name', { ascending: true })
		
		users = data || []
	}

	$effect(() => {
		if (isOpen) {
			loadUsers()
		}
	})

	async function handleSubmit() {
		errors = {}
		submitting = true

		try {
			// Validate form data
			const validated = createBugSchema.parse(formData)
			
			// Create bug
			await createBug(validated)
			
			// Reset form
			formData = {
				title: '',
				description: '',
				status: 'new',
				priority: 'medium',
				severity: 'moderate',
				category: 'UI/UX',
				assigned_to: null,
				due_date: null,
				reported_by: undefined
			}
			
			// Invalidate and close
			await invalidateAll()
			isOpen = false
			
			if (onSuccess) {
				onSuccess()
			}
		} catch (error: any) {
			if (error.errors) {
				// Zod validation errors
				errors = {}
				for (const err of error.errors) {
					if (err.path) {
						errors[err.path[0]] = err.message
					}
				}
			} else {
				errors.general = error.message || 'Failed to create bug'
			}
		} finally {
			submitting = false
		}
	}

	function handleClose() {
		isOpen = false
		errors = {}
		formData = {
			title: '',
			description: '',
			status: 'new',
			priority: 'medium',
			severity: 'moderate',
			category: 'UI/UX',
			assigned_to: null,
			due_date: null,
			reported_by: undefined
		}
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={handleClose}>
		<div class="bg-base-100 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4" onclick={(e) => e.stopPropagation()}>
			<!-- Header -->
			<div class="flex items-center justify-between p-6 border-b border-base-300">
				<h2 class="text-2xl font-bold">Create New Issue</h2>
				<button class="btn btn-sm btn-circle btn-ghost" onclick={handleClose}>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Form -->
			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="p-6 space-y-4">
				{#if errors.general}
					<div class="alert alert-error">
						<span>{errors.general}</span>
					</div>
				{/if}

				<!-- Title -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Title <span class="text-error">*</span></span>
					</label>
					<input
						type="text"
						class="input input-bordered {errors.title ? 'input-error' : ''}"
						placeholder="Brief description of the bug"
						bind:value={formData.title}
					/>
					{#if errors.title}
						<label class="label">
							<span class="label-text-alt text-error">{errors.title}</span>
						</label>
					{/if}
				</div>

				<!-- Description -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Description</span>
					</label>
					<textarea
						class="textarea textarea-bordered {errors.description ? 'textarea-error' : ''} h-32"
						placeholder="Detailed description of the bug, steps to reproduce, expected vs actual behavior..."
						bind:value={formData.description}
					></textarea>
					{#if errors.description}
						<label class="label">
							<span class="label-text-alt text-error">{errors.description}</span>
						</label>
					{/if}
				</div>

				<!-- Status (matches table) -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Status</span>
					</label>
					<select class="select select-bordered" bind:value={formData.status}>
						{#each statusOptions as s}
							<option value={s}>{s.replace('_', ' ')}</option>
						{/each}
					</select>
				</div>

				<!-- Priority -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Priority</span>
					</label>
					<select class="select select-bordered" bind:value={formData.priority}>
						<option value="low">Low - Minor issue, can be addressed later</option>
						<option value="medium">Medium - Should be fixed soon</option>
						<option value="high">High - Important, needs attention quickly</option>
						<option value="critical">Critical - Urgent, blocks work or major impact</option>
					</select>
				</div>

				<!-- Category (same options as bugs table/detail) -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Category</span>
					</label>
					<select class="select select-bordered" bind:value={formData.category}>
						<option value="">— Select category —</option>
						{#each categoryOptions as c}
							<option value={c}>{c}</option>
						{/each}
					</select>
				</div>

				<!-- Reported by (read-only, matches table) -->
				{#if currentUserName}
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Reported by</span>
						</label>
						<p class="text-sm text-base-content/70">{currentUserName}</p>
					</div>
				{/if}

				<!-- Assignee and Due Date -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Assign To</span>
						</label>
						<select class="select select-bordered" bind:value={formData.assigned_to}>
							<option value={null}>Unassigned</option>
							{#each users as user}
								<option value={user.id}>{user.full_name || 'Unknown'}</option>
							{/each}
						</select>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Due Date</span>
						</label>
						<input
							type="date"
							class="input input-bordered"
							bind:value={formData.due_date}
						/>
					</div>
				</div>

				<!-- Actions -->
				<div class="flex justify-end gap-2 pt-4 border-t border-base-300">
					<button type="button" class="btn btn-ghost" onclick={handleClose} disabled={submitting}>
						Cancel
					</button>
					<button type="submit" class="btn btn-primary gap-2" disabled={submitting}>
						{#if submitting}
							<Loader2 class="w-4 h-4 animate-spin" />
							Creating...
						{:else}
							Create Issue
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
