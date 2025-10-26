<script lang="ts">
	interface Requirement {
		id: string
		category: string
		item: string
		status: 'pending' | 'secured' | 'not_available'
		priority: 'high' | 'medium' | 'low'
		notes?: string
		quantity?: number
		assigned_to?: string
	}
	
	interface Props {
		requirements?: any // Can be JSON object, array, or string
		onUpdate?: (requirements: Requirement[]) => void
		readonly?: boolean
	}
	
	let { requirements, onUpdate, readonly = false }: Props = $props()
	
	// Component state
	let requirementsList = $state<Requirement[]>([])
	let showAddForm = $state(false)
	let editingIndex = $state<number | null>(null)
	let jsonEditMode = $state(false)
	let jsonString = $state('')
	let filterCategory = $state('all')
	let filterStatus = $state('all')
	
	// New requirement form
	let newRequirement = $state<Requirement>({
		id: '',
		category: 'equipment',
		item: '',
		status: 'pending',
		priority: 'medium',
		notes: '',
		quantity: 1,
		assigned_to: ''
	})
	
	// Categories and their icons
	const categories = [
		{ value: 'equipment', label: 'Equipment', icon: '🎤' },
		{ value: 'staging', label: 'Staging', icon: '🎭' },
		{ value: 'personnel', label: 'Personnel', icon: '👥' },
		{ value: 'logistics', label: 'Logistics', icon: '🚚' },
		{ value: 'catering', label: 'Catering', icon: '🍽️' },
		{ value: 'technical', label: 'Technical', icon: '⚡' },
		{ value: 'permits', label: 'Permits', icon: '📋' },
		{ value: 'other', label: 'Other', icon: '📝' }
	]
	
	// Status options
	const statusOptions = [
		{ value: 'pending', label: 'Pending', class: 'badge-warning', icon: '⏳' },
		{ value: 'secured', label: 'Secured', class: 'badge-success', icon: '✅' },
		{ value: 'not_available', label: 'Not Available', class: 'badge-error', icon: '❌' }
	]
	
	// Priority options
	const priorityOptions = [
		{ value: 'high', label: 'High', class: 'badge-error' },
		{ value: 'medium', label: 'Medium', class: 'badge-warning' },
		{ value: 'low', label: 'Low', class: 'badge-info' }
	]
	
	// Common equipment templates
	const equipmentTemplates = [
		'Microphones (wireless)',
		'Microphones (wired)',
		'Sound System/PA',
		'Piano/Keyboard',
		'Music Stands',
		'Amplifiers',
		'Chairs',
		'Tables',
		'Stage Lighting',
		'Extension Cords',
		'Backdrop/Banner',
		'Projector/Screen'
	]
	
	// Parse initial requirements
	$effect(() => {
		parseRequirements()
	})
	
	function parseRequirements() {
		if (!requirements) {
			requirementsList = []
			return
		}
		
		try {
			let parsed: any
			
			if (typeof requirements === 'string') {
				if (requirements.trim().startsWith('{') || requirements.trim().startsWith('[')) {
					parsed = JSON.parse(requirements)
				} else {
					// Parse as simple text list
					const lines = requirements.split('\n').filter(line => line.trim())
					parsed = lines.map((line, index) => ({
						id: `req-${index}`,
						category: 'other',
						item: line.trim(),
						status: 'pending',
						priority: 'medium',
						notes: '',
						quantity: 1
					}))
				}
			} else if (Array.isArray(requirements)) {
				parsed = requirements
			} else if (typeof requirements === 'object') {
				// Convert object to array
				parsed = Object.entries(requirements).map(([key, value], index) => ({
					id: `req-${index}`,
					category: 'other',
					item: key,
					status: 'pending',
					priority: 'medium',
					notes: String(value),
					quantity: 1
				}))
			}
			
			// Ensure all requirements have required fields
			requirementsList = (parsed || []).map((req: any, index: number) => ({
				id: req.id || `req-${index}`,
				category: req.category || 'other',
				item: req.item || req.name || String(req),
				status: req.status || 'pending',
				priority: req.priority || 'medium',
				notes: req.notes || '',
				quantity: Number(req.quantity) || 1,
				assigned_to: req.assigned_to || ''
			}))
			
			updateJsonString()
		} catch (error) {
			console.error('Failed to parse requirements:', error)
			requirementsList = []
		}
	}
	
	function updateJsonString() {
		jsonString = JSON.stringify(requirementsList, null, 2)
	}
	
	// Filtered requirements
	let filteredRequirements = $derived(() => {
		return requirementsList.filter(req => {
			const categoryMatch = filterCategory === 'all' || req.category === filterCategory
			const statusMatch = filterStatus === 'all' || req.status === filterStatus
			return categoryMatch && statusMatch
		})
	})
	
	function addRequirement() {
		if (!newRequirement.item.trim()) return
		
		const requirement: Requirement = {
			...newRequirement,
			id: `req-${Date.now()}`,
			item: newRequirement.item.trim()
		}
		
		requirementsList.push(requirement)
		onUpdate?.(requirementsList)
		updateJsonString()
		
		// Reset form
		newRequirement = {
			id: '',
			category: 'equipment',
			item: '',
			status: 'pending',
			priority: 'medium',
			notes: '',
			quantity: 1,
			assigned_to: ''
		}
		showAddForm = false
	}
	
	function removeRequirement(index: number) {
		const actualIndex = requirementsList.findIndex(req => req.id === filteredRequirements[index].id)
		if (actualIndex !== -1) {
			requirementsList.splice(actualIndex, 1)
			onUpdate?.(requirementsList)
			updateJsonString()
		}
	}
	
	function startEdit(index: number) {
		const actualIndex = requirementsList.findIndex(req => req.id === filteredRequirements[index].id)
		editingIndex = actualIndex
	}
	
	function cancelEdit() {
		editingIndex = null
		parseRequirements() // Reset changes
	}
	
	function saveEdit() {
		onUpdate?.(requirementsList)
		updateJsonString()
		editingIndex = null
	}
	
	function useTemplate(template: string) {
		newRequirement.item = template
		newRequirement.category = 'equipment'
	}
	
	function toggleJsonMode() {
		if (jsonEditMode) {
			try {
				const parsed = JSON.parse(jsonString)
				requirementsList = parsed
				onUpdate?.(requirementsList)
			} catch (error) {
				console.error('Invalid JSON:', error)
				return
			}
		} else {
			updateJsonString()
		}
		jsonEditMode = !jsonEditMode
	}
	
	function getCategoryIcon(category: string): string {
		return categories.find(c => c.value === category)?.icon || '📝'
	}
	
	function getCategoryLabel(category: string): string {
		return categories.find(c => c.value === category)?.label || 'Other'
	}
	
	function getStatusInfo(status: string) {
		return statusOptions.find(s => s.value === status) || statusOptions[0]
	}
	
	function getPriorityInfo(priority: string) {
		return priorityOptions.find(p => p.value === priority) || priorityOptions[1]
	}
	
	function getCompletionStats() {
		const total = requirementsList.length
		const secured = requirementsList.filter(req => req.status === 'secured').length
		const pending = requirementsList.filter(req => req.status === 'pending').length
		const notAvailable = requirementsList.filter(req => req.status === 'not_available').length
		
		return { total, secured, pending, notAvailable }
	}
</script>

<div class="space-y-4">
	<!-- Header with stats -->
	<div class="flex items-center justify-between">
		<div>
			<h4 class="text-lg font-semibold">Event Requirements</h4>
			{#snippet statsDisplay()}
				{@const stats = getCompletionStats()}
				<div class="flex gap-2 mt-1">
					<span class="badge badge-success badge-sm">{stats.secured} secured</span>
					<span class="badge badge-warning badge-sm">{stats.pending} pending</span>
					{#if stats.notAvailable > 0}
						<span class="badge badge-error badge-sm">{stats.notAvailable} unavailable</span>
					{/if}
				</div>
			{/snippet}
			{@render statsDisplay()}
		</div>
		{#if !readonly}
			<div class="flex gap-2">
				<button 
					class="btn btn-outline btn-sm"
					onclick={toggleJsonMode}
				>
					{jsonEditMode ? 'Visual Editor' : 'JSON Editor'}
				</button>
				{#if !jsonEditMode}
					<button 
						class="btn btn-primary btn-sm"
						onclick={() => showAddForm = !showAddForm}
					>
						{showAddForm ? 'Cancel' : 'Add Requirement'}
					</button>
				{/if}
			</div>
		{/if}
	</div>

	{#if jsonEditMode}
		<!-- JSON Editor -->
		<div class="card bg-base-200">
			<div class="card-body p-4">
				<h5 class="card-title text-base">JSON Requirements Editor</h5>
				<textarea
					bind:value={jsonString}
					class="textarea textarea-bordered font-mono text-sm"
					rows="15"
					placeholder="Enter requirements as JSON..."
					readonly={readonly}
				></textarea>
				{#if !readonly}
					<div class="flex justify-end gap-2 mt-2">
						<button 
							class="btn btn-outline btn-sm"
							onclick={() => jsonEditMode = false}
						>
							Cancel
						</button>
						<button 
							class="btn btn-primary btn-sm"
							onclick={toggleJsonMode}
						>
							Apply Changes
						</button>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Visual Editor -->
		
		<!-- Filters -->
		{#if requirementsList.length > 0}
			<div class="flex gap-4 items-center p-3 bg-base-200 rounded-lg">
				<div class="flex gap-2 items-center">
					<span class="text-sm font-medium">Filter:</span>
					<select bind:value={filterCategory} class="select select-bordered select-sm">
						<option value="all">All Categories</option>
						{#each categories as category}
							<option value={category.value}>{category.icon} {category.label}</option>
						{/each}
					</select>
					<select bind:value={filterStatus} class="select select-bordered select-sm">
						<option value="all">All Status</option>
						{#each statusOptions as status}
							<option value={status.value}>{status.icon} {status.label}</option>
						{/each}
					</select>
				</div>
			</div>
		{/if}
		
		<!-- Add Requirement Form -->
		{#if showAddForm && !readonly}
			<div class="card bg-base-200 border">
				<div class="card-body p-4">
					<h5 class="card-title text-base">Add New Requirement</h5>
					
					<!-- Equipment Templates -->
					<div class="mb-4">
						<label class="label">
							<span class="label-text">Equipment Templates</span>
						</label>
						<div class="flex flex-wrap gap-2">
							{#each equipmentTemplates as template}
								<button
									type="button"
									class="btn btn-xs btn-outline"
									onclick={() => useTemplate(template)}
								>
									{template}
								</button>
							{/each}
						</div>
					</div>
					
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						<!-- Category -->
						<div>
							<label class="label">
								<span class="label-text">Category</span>
							</label>
							<select bind:value={newRequirement.category} class="select select-bordered w-full">
								{#each categories as category}
									<option value={category.value}>{category.icon} {category.label}</option>
								{/each}
							</select>
						</div>
						
						<!-- Item -->
						<div>
							<label class="label">
								<span class="label-text">Item *</span>
							</label>
							<input
								type="text"
								bind:value={newRequirement.item}
								class="input input-bordered w-full"
								placeholder="e.g., Wireless Microphones"
								required
							/>
						</div>
						
						<!-- Quantity -->
						<div>
							<label class="label">
								<span class="label-text">Quantity</span>
							</label>
							<input
								type="number"
								bind:value={newRequirement.quantity}
								min="1"
								class="input input-bordered w-full"
								placeholder="1"
							/>
						</div>
						
						<!-- Priority -->
						<div>
							<label class="label">
								<span class="label-text">Priority</span>
							</label>
							<select bind:value={newRequirement.priority} class="select select-bordered w-full">
								{#each priorityOptions as priority}
									<option value={priority.value}>{priority.label}</option>
								{/each}
							</select>
						</div>
						
						<!-- Status -->
						<div>
							<label class="label">
								<span class="label-text">Status</span>
							</label>
							<select bind:value={newRequirement.status} class="select select-bordered w-full">
								{#each statusOptions as status}
									<option value={status.value}>{status.icon} {status.label}</option>
								{/each}
							</select>
						</div>
						
						<!-- Assigned To -->
						<div>
							<label class="label">
								<span class="label-text">Assigned To</span>
							</label>
							<input
								type="text"
								bind:value={newRequirement.assigned_to}
								class="input input-bordered w-full"
								placeholder="Person or team"
							/>
						</div>
						
						<!-- Notes -->
						<div class="md:col-span-2 lg:col-span-3">
							<label class="label">
								<span class="label-text">Notes</span>
							</label>
							<textarea
								bind:value={newRequirement.notes}
								class="textarea textarea-bordered w-full"
								rows="2"
								placeholder="Additional details or specifications..."
							></textarea>
						</div>
					</div>
					
					<!-- Form Actions -->
					<div class="flex justify-end gap-2 mt-4">
						<button 
							class="btn btn-outline btn-sm"
							onclick={() => showAddForm = false}
						>
							Cancel
						</button>
						<button 
							class="btn btn-primary btn-sm"
							onclick={addRequirement}
							disabled={!newRequirement.item.trim()}
						>
							Add Requirement
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Requirements List -->
		{#if filteredRequirements.length > 0}
			<div class="overflow-x-auto">
				<table class="table table-zebra">
					<thead>
						<tr>
							<th>Category</th>
							<th>Item</th>
							<th>Qty</th>
							<th>Priority</th>
							<th>Status</th>
							<th>Assigned To</th>
							{#if !readonly}
								<th>Actions</th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each filteredRequirements as requirement, index}
							{@const actualIndex = requirementsList.findIndex(req => req.id === requirement.id)}
							{@const statusInfo = getStatusInfo(requirement.status)}
							{@const priorityInfo = getPriorityInfo(requirement.priority)}
							<tr>
								<td>
									<div class="flex items-center gap-2">
										<span class="text-lg">{getCategoryIcon(requirement.category)}</span>
										<span class="text-sm">{getCategoryLabel(requirement.category)}</span>
									</div>
								</td>
								<td>
									{#if editingIndex === actualIndex}
										<input
											type="text"
											bind:value={requirement.item}
											class="input input-bordered input-sm w-full"
										/>
									{:else}
										<div>
											<div class="font-medium">{requirement.item}</div>
											{#if requirement.notes}
												<div class="text-xs opacity-60">{requirement.notes}</div>
											{/if}
										</div>
									{/if}
								</td>
								<td>
									{#if editingIndex === actualIndex}
										<input
											type="number"
											bind:value={requirement.quantity}
											min="1"
											class="input input-bordered input-sm w-16"
										/>
									{:else}
										{requirement.quantity}
									{/if}
								</td>
								<td>
									{#if editingIndex === actualIndex}
										<select 
											bind:value={requirement.priority} 
											class="select select-bordered select-sm"
										>
											{#each priorityOptions as priority}
												<option value={priority.value}>{priority.label}</option>
											{/each}
										</select>
									{:else}
										<span class="badge badge-sm {priorityInfo.class}">
											{priorityInfo.label}
										</span>
									{/if}
								</td>
								<td>
									{#if editingIndex === actualIndex}
										<select 
											bind:value={requirement.status} 
											class="select select-bordered select-sm"
										>
											{#each statusOptions as status}
												<option value={status.value}>{status.label}</option>
											{/each}
										</select>
									{:else}
										<span class="badge badge-sm {statusInfo.class}">
											{statusInfo.icon} {statusInfo.label}
										</span>
									{/if}
								</td>
								<td>
									{#if editingIndex === actualIndex}
										<input
											type="text"
											bind:value={requirement.assigned_to}
											class="input input-bordered input-sm w-full"
											placeholder="Assignee"
										/>
									{:else}
										{requirement.assigned_to || '-'}
									{/if}
								</td>
								{#if !readonly}
									<td>
										<div class="flex gap-1">
											{#if editingIndex === actualIndex}
												<button 
													class="btn btn-xs btn-success"
													onclick={saveEdit}
												>
													Save
												</button>
												<button 
													class="btn btn-xs btn-outline"
													onclick={cancelEdit}
												>
													Cancel
												</button>
											{:else}
												<button 
													class="btn btn-xs btn-outline"
													onclick={() => startEdit(index)}
												>
													Edit
												</button>
												<button 
													class="btn btn-xs btn-error"
													onclick={() => removeRequirement(index)}
												>
													Remove
												</button>
											{/if}
										</div>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else if requirementsList.length === 0}
			<div class="text-center py-8 bg-base-200 rounded-lg">
				<span class="text-4xl">📋</span>
				<p class="mt-2 text-lg">No requirements defined</p>
				<p class="text-sm opacity-60">
					{readonly ? 'No requirements have been set for this event' : 'Click "Add Requirement" to define event requirements'}
				</p>
			</div>
		{:else}
			<div class="text-center py-4 bg-base-200 rounded-lg">
				<p class="text-sm opacity-60">No requirements match the current filters</p>
			</div>
		{/if}
	{/if}
</div>