<script lang="ts">
	import { onMount } from 'svelte'
	
	interface ScheduleBlock {
		id: string
		time: string
		duration: number // minutes
		activity: string
		notes?: string
		required_participants?: string[]
	}
	
	interface Props {
		schedule?: any // Can be JSON object, array, or string
		onUpdate?: (schedule: ScheduleBlock[]) => void
		readonly?: boolean
	}
	
	let { schedule, onUpdate, readonly = false }: Props = $props()
	
	// Component state
	let scheduleBlocks = $state<ScheduleBlock[]>([])
	let showAddForm = $state(false)
	let editingIndex = $state<number | null>(null)
	let jsonEditMode = $state(false)
	let jsonString = $state('')
	
	// New block form
	let newBlock = $state<ScheduleBlock>({
		id: '',
		time: '',
		duration: 60,
		activity: '',
		notes: '',
		required_participants: []
	})
	
	// Activity templates
	const activityTemplates = [
		{ name: 'Sound Check', duration: 30 },
		{ name: 'Rehearsal', duration: 60 },
		{ name: 'Performance', duration: 45 },
		{ name: 'Setup', duration: 30 },
		{ name: 'Break', duration: 15 },
		{ name: 'Meet & Greet', duration: 20 },
		{ name: 'Photo Session', duration: 15 },
		{ name: 'Cleanup', duration: 30 }
	]
	
	// Parse initial schedule on mount
	onMount(() => {
		parseSchedule()
	})
	
	// Watch for changes in schedule prop
	$effect(() => {
		parseSchedule()
	})
	
	function parseSchedule() {
		if (!schedule) {
			scheduleBlocks = []
			return
		}
		
		try {
			let parsed: any
			
			if (typeof schedule === 'string') {
				if (schedule.trim().startsWith('{') || schedule.trim().startsWith('[')) {
					parsed = JSON.parse(schedule)
				} else {
					// Try to parse as simple text schedule
					const lines = schedule.split('\n').filter(line => line.trim())
					parsed = lines.map((line, index) => ({
						id: `block-${index}`,
						time: '',
						duration: 60,
						activity: line.trim(),
						notes: ''
					}))
				}
			} else if (Array.isArray(schedule)) {
				parsed = schedule
			} else if (typeof schedule === 'object') {
				if (schedule.blocks) {
					parsed = schedule.blocks
				} else {
					// Convert object to array format
					parsed = Object.entries(schedule).map(([key, value], index) => ({
						id: `block-${index}`,
						time: key,
						duration: 60,
						activity: String(value),
						notes: ''
					}))
				}
			}
			
			// Ensure all blocks have required fields
			scheduleBlocks = (parsed || []).map((block: any, index: number) => ({
				id: block.id || `block-${index}`,
				time: block.time || '',
				duration: Number(block.duration) || 60,
				activity: block.activity || block.name || String(block),
				notes: block.notes || '',
				required_participants: Array.isArray(block.required_participants) 
					? block.required_participants 
					: []
			}))
			
			updateJsonString()
		} catch (error) {
			console.error('Failed to parse schedule:', error)
			scheduleBlocks = []
		}
	}
	
	function updateJsonString() {
		jsonString = JSON.stringify(scheduleBlocks, null, 2)
	}
	
	function addBlock() {
		if (!newBlock.activity.trim()) return
		
		const block: ScheduleBlock = {
			...newBlock,
			id: `block-${Date.now()}`,
			activity: newBlock.activity.trim()
		}
		
		scheduleBlocks.push(block)
		onUpdate?.(scheduleBlocks)
		updateJsonString()
		
		// Reset form
		newBlock = {
			id: '',
			time: '',
			duration: 60,
			activity: '',
			notes: '',
			required_participants: []
		}
		showAddForm = false
	}
	
	function removeBlock(index: number) {
		scheduleBlocks.splice(index, 1)
		onUpdate?.(scheduleBlocks)
		updateJsonString()
	}
	
	function moveBlock(index: number, direction: 'up' | 'down') {
		const newIndex = direction === 'up' ? index - 1 : index + 1
		if (newIndex < 0 || newIndex >= scheduleBlocks.length) return
		
		const temp = scheduleBlocks[index]
		scheduleBlocks[index] = scheduleBlocks[newIndex]
		scheduleBlocks[newIndex] = temp
		
		onUpdate?.(scheduleBlocks)
		updateJsonString()
	}
	
	function startEdit(index: number) {
		editingIndex = index
	}
	
	function cancelEdit() {
		editingIndex = null
		parseSchedule() // Reset any unsaved changes
	}
	
	function saveEdit(index: number) {
		onUpdate?.(scheduleBlocks)
		updateJsonString()
		editingIndex = null
	}
	
	function useTemplate(template: { name: string; duration: number }) {
		newBlock.activity = template.name
		newBlock.duration = template.duration
	}
	
	function toggleJsonMode() {
		if (jsonEditMode) {
			// Save JSON changes
			try {
				const parsed = JSON.parse(jsonString)
				scheduleBlocks = parsed
				onUpdate?.(scheduleBlocks)
			} catch (error) {
				console.error('Invalid JSON:', error)
				// Don't switch modes if JSON is invalid
				return
			}
		} else {
			updateJsonString()
		}
		jsonEditMode = !jsonEditMode
	}
	
	function calculateEndTime(startTime: string, duration: number): string {
		if (!startTime) return ''
		
		try {
			const [hours, minutes] = startTime.split(':').map(Number)
			const totalMinutes = hours * 60 + minutes + duration
			const endHours = Math.floor(totalMinutes / 60) % 24
			const endMins = totalMinutes % 60
			
			return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
		} catch {
			return ''
		}
	}
	
	function getTotalDuration(): number {
		return scheduleBlocks.reduce((total, block) => total + block.duration, 0)
	}
	
	function formatDuration(minutes: number): string {
		const hours = Math.floor(minutes / 60)
		const mins = minutes % 60
		if (hours > 0) {
			return `${hours}h ${mins}m`
		}
		return `${mins}m`
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h4 class="text-lg font-semibold">Event Schedule</h4>
			<p class="text-sm opacity-60">
				Total duration: {formatDuration(getTotalDuration())}
			</p>
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
						{showAddForm ? 'Cancel' : 'Add Block'}
					</button>
				{/if}
			</div>
		{/if}
	</div>

	{#if jsonEditMode}
		<!-- JSON Editor -->
		<div class="card bg-base-200">
			<div class="card-body p-4">
				<h5 class="card-title text-base">JSON Schedule Editor</h5>
				<textarea
					bind:value={jsonString}
					class="textarea textarea-bordered font-mono text-sm"
					rows="15"
					placeholder="Enter schedule as JSON..."
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
		
		<!-- Add Block Form -->
		{#if showAddForm && !readonly}
			<div class="card bg-base-200 border">
				<div class="card-body p-4">
					<h5 class="card-title text-base">Add Schedule Block</h5>
					
					<!-- Templates -->
					<div class="mb-4">
						<label class="label">
							<span class="label-text">Quick Templates</span>
						</label>
						<div class="flex flex-wrap gap-2">
							{#each activityTemplates as template}
								<button
									type="button"
									class="btn btn-xs btn-outline"
									onclick={() => useTemplate(template)}
								>
									{template.name} ({template.duration}m)
								</button>
							{/each}
						</div>
					</div>
					
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<!-- Time -->
						<div>
							<label class="label">
								<span class="label-text">Start Time</span>
							</label>
							<input
								type="time"
								bind:value={newBlock.time}
								class="input input-bordered w-full"
							/>
						</div>
						
						<!-- Duration -->
						<div>
							<label class="label">
								<span class="label-text">Duration (minutes)</span>
							</label>
							<input
								type="number"
								bind:value={newBlock.duration}
								min="1"
								step="5"
								class="input input-bordered w-full"
								placeholder="60"
							/>
							{#if newBlock.time}
								<div class="text-xs opacity-60 mt-1">
									Ends at: {calculateEndTime(newBlock.time, newBlock.duration)}
								</div>
							{/if}
						</div>
						
						<!-- Activity -->
						<div>
							<label class="label">
								<span class="label-text">Activity *</span>
							</label>
							<input
								type="text"
								bind:value={newBlock.activity}
								class="input input-bordered w-full"
								placeholder="e.g., Sound Check"
								required
							/>
						</div>
						
						<!-- Notes -->
						<div class="md:col-span-3">
							<label class="label">
								<span class="label-text">Notes</span>
							</label>
							<textarea
								bind:value={newBlock.notes}
								class="textarea textarea-bordered w-full"
								rows="2"
								placeholder="Additional notes for this schedule block..."
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
							onclick={addBlock}
							disabled={!newBlock.activity.trim()}
						>
							Add Block
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Schedule Blocks -->
		{#if scheduleBlocks.length > 0}
			<div class="space-y-2">
				{#each scheduleBlocks as block, index}
					<div class="card bg-base-100 border">
						<div class="card-body p-4">
							<div class="flex items-start justify-between">
								<div class="flex-1">
									{#if editingIndex === index}
										<!-- Edit Mode -->
										<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
											<div>
												<label class="label">
													<span class="label-text">Start Time</span>
												</label>
												<input
													type="time"
													bind:value={block.time}
													class="input input-bordered input-sm w-full"
												/>
											</div>
											<div>
												<label class="label">
													<span class="label-text">Duration (min)</span>
												</label>
												<input
													type="number"
													bind:value={block.duration}
													min="1"
													step="5"
													class="input input-bordered input-sm w-full"
												/>
											</div>
											<div>
												<label class="label">
													<span class="label-text">Activity</span>
												</label>
												<input
													type="text"
													bind:value={block.activity}
													class="input input-bordered input-sm w-full"
												/>
											</div>
											<div class="md:col-span-3">
												<label class="label">
													<span class="label-text">Notes</span>
												</label>
												<textarea
													bind:value={block.notes}
													class="textarea textarea-bordered textarea-sm w-full"
													rows="2"
												></textarea>
											</div>
										</div>
									{:else}
										<!-- View Mode -->
										<div class="flex items-center gap-4">
											{#if block.time}
												<div class="text-sm font-mono bg-base-200 px-2 py-1 rounded">
													{block.time} - {calculateEndTime(block.time, block.duration)}
												</div>
											{/if}
											<div class="badge badge-outline">
												{formatDuration(block.duration)}
											</div>
											<div class="font-medium">{block.activity}</div>
										</div>
										{#if block.notes}
											<p class="text-sm opacity-70 mt-2">{block.notes}</p>
										{/if}
									{/if}
								</div>
								
								{#if !readonly}
									<div class="flex items-center gap-1 ml-4">
										{#if editingIndex === index}
											<button 
												class="btn btn-xs btn-success"
												onclick={() => saveEdit(index)}
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
												onclick={() => moveBlock(index, 'up')}
												disabled={index === 0}
											>
												↑
											</button>
											<button 
												class="btn btn-xs btn-outline"
												onclick={() => moveBlock(index, 'down')}
												disabled={index === scheduleBlocks.length - 1}
											>
												↓
											</button>
											<button 
												class="btn btn-xs btn-outline"
												onclick={() => startEdit(index)}
											>
												Edit
											</button>
											<button 
												class="btn btn-xs btn-error"
												onclick={() => removeBlock(index)}
											>
												×
											</button>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-center py-8 bg-base-200 rounded-lg">
				<span class="text-4xl">📅</span>
				<p class="mt-2 text-lg">No schedule blocks</p>
				<p class="text-sm opacity-60">
					{readonly ? 'No schedule defined for this event' : 'Click "Add Block" to create a schedule'}
				</p>
			</div>
		{/if}
	{/if}
</div>