<script lang="ts">
	interface Props {
		schedule?: any
	}
	
	let { schedule }: Props = $props()
	
	// Parse schedule data safely
	let scheduleBlocks = $derived(() => {
		if (!schedule) return []
		
		// Handle different possible formats
		if (Array.isArray(schedule)) {
			return schedule
		}
		
		if (typeof schedule === 'object') {
			if (schedule.blocks && Array.isArray(schedule.blocks)) {
				return schedule.blocks
			}
			
			// Handle single schedule object
			if (schedule.time || schedule.description) {
				return [schedule]
			}
		}
		
		// Try to parse as JSON string
		if (typeof schedule === 'string') {
			try {
				const parsed = JSON.parse(schedule)
				if (Array.isArray(parsed)) return parsed
				if (parsed.blocks && Array.isArray(parsed.blocks)) return parsed.blocks
				return [parsed]
			} catch {
				return []
			}
		}
		
		return []
	})
	
	function formatTime(timeStr: string | undefined) {
		if (!timeStr) return 'Time TBD'
		
		// Handle various time formats
		if (timeStr.includes(':')) {
			// Already formatted as HH:MM
			return timeStr.slice(0, 5)
		}
		
		// Handle timestamp or other formats
		try {
			const date = new Date(timeStr)
			return date.toLocaleTimeString('en-US', { 
				hour: 'numeric', 
				minute: '2-digit', 
				hour12: true 
			})
		} catch {
			return timeStr
		}
	}
</script>

{#if scheduleBlocks.length > 0}
	<div class="space-y-3">
		{#each scheduleBlocks as block, index}
			<div class="bg-base-200 p-4 rounded-lg border-l-4 border-primary">
				<div class="flex items-start justify-between">
					<div class="flex-1">
						<div class="flex items-center gap-3 mb-2">
							<span class="badge badge-primary badge-sm">#{index + 1}</span>
							{#if block.time}
								<span class="font-semibold text-primary">
									{formatTime(block.time)}
								</span>
							{/if}
							{#if block.duration}
								<span class="text-xs opacity-60">
									({block.duration} min)
								</span>
							{/if}
						</div>
						
						{#if block.title || block.name}
							<h4 class="font-medium text-base mb-1">
								{block.title || block.name}
							</h4>
						{/if}
						
						{#if block.description}
							<p class="text-sm opacity-80 mb-2">
								{block.description}
							</p>
						{/if}
						
						{#if block.location}
							<div class="text-xs opacity-60">
								📍 {block.location}
							</div>
						{/if}
						
						{#if block.notes}
							<div class="text-xs italic opacity-70 mt-2">
								Note: {block.notes}
							</div>
						{/if}
					</div>
					
					{#if block.status}
						<span class="badge badge-outline badge-sm">
							{block.status}
						</span>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{:else}
	<div class="bg-base-200 p-4 rounded-lg text-center opacity-60">
		<span class="text-4xl">📅</span>
		<p class="mt-2 text-sm">No schedule blocks defined</p>
	</div>
{/if}