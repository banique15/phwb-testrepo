<script lang="ts">
	import { createBug, bugsStore } from '$lib/stores/bugs'
	import { createBugSchema, type CreateBug } from '$lib/schemas/bug'
	import { X } from 'lucide-svelte'
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
		category: '',
		assigned_to: null,
		due_date: null,
		reported_by: undefined
	})

	let errors = $state<Record<string, string>>({})
	let submitting = $state(false)
	let users = $state<Array<{ id: string; full_name: string | null }>>([])

	// Load current user and available users
	async function loadUsers() {
		const { data: { user } } = await supabase.auth.getUser()
		if (user) {
			formData.reported_by = user.id
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
				category: '',
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
			category: '',
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
				<h2 class="text-2xl font-bold">Report New Bug</h2>
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

				<!-- Priority and Severity -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Priority</span>
						</label>
						<select class="select select-bordered" bind:value={formData.priority}>
							<option value="low">Low</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
							<option value="critical">Critical</option>
						</select>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Severity</span>
						</label>
						<select class="select select-bordered" bind:value={formData.severity}>
							<option value="cosmetic">Cosmetic</option>
							<option value="minor">Minor</option>
							<option value="moderate">Moderate</option>
							<option value="major">Major</option>
							<option value="critical">Critical</option>
						</select>
					</div>
				</div>

				<!-- Category and Status -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Category</span>
						</label>
						<input
							type="text"
							class="input input-bordered"
							placeholder="e.g., UI, Backend, Database, API"
							bind:value={formData.category}
						/>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Status</span>
						</label>
						<select class="select select-bordered" bind:value={formData.status}>
							<option value="new">New</option>
							<option value="triage">Triage</option>
							<option value="in_progress">In Progress</option>
						</select>
					</div>
				</div>

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
					<button type="submit" class="btn btn-primary" disabled={submitting}>
						{submitting ? 'Creating...' : 'Create Bug'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
