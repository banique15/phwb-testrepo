<script lang="ts">
	import { Calendar, MapPin } from 'lucide-svelte'
	
	interface ScheduleBlock {
		id?: string
		time?: string
		duration?: number
		activity?: string
		title?: string
		name?: string
		description?: string
		notes?: string
		artist_id?: string
		artist_name?: string
		is_auto_generated?: boolean
		location?: string
		status?: string
	}
	
	interface Props {
		schedule?: any
		event?: {
			start_time?: string | null
			end_time?: string | null
			artists?: {
				assignments?: Array<{
					artist_id: string
					artist_name?: string
					role?: string
				}>
			}
		}
	}
	
	let { schedule, event }: Props = $props()
	
	
	function calculateDurationMinutes(startTime: string, endTime: string): number {
		try {
			const [startHours, startMins] = startTime.split(':').map(Number)
			const [endHours, endMins] = endTime.split(':').map(Number)
			const startTotal = startHours * 60 + startMins
			const endTotal = endHours * 60 + endMins
			return endTotal - startTotal
		} catch {
			return 60
		}
	}
	
	// Parse schedule data safely and auto-generate from artists if needed
	let scheduleBlocks = $derived.by(() => {
		let blocks: ScheduleBlock[] = []
		
		// First, try to parse existing schedule
		if (schedule) {
			// Handle different possible formats
			if (Array.isArray(schedule)) {
				blocks = schedule
			} else if (typeof schedule === 'object' && schedule !== null) {
				if (schedule.blocks && Array.isArray(schedule.blocks)) {
					blocks = schedule.blocks
				} else if (schedule.time || schedule.description) {
					// Handle single schedule object
					blocks = [schedule]
				}
			} else if (typeof schedule === 'string') {
				// Try to parse as JSON string
				try {
					const parsed = JSON.parse(schedule)
					if (Array.isArray(parsed)) {
						blocks = parsed
					} else if (parsed.blocks && Array.isArray(parsed.blocks)) {
						blocks = parsed.blocks
					} else {
						blocks = [parsed]
					}
				} catch {
					blocks = []
				}
			}
		}
		
		// If no schedule exists but we have artists and times, auto-generate blocks
		if (blocks.length === 0 && event) {
			// Check if we have the required data for auto-generation
			const startTime = event.start_time
			const endTime = event.end_time
			const hasStartTime = startTime && typeof startTime === 'string' && startTime.trim() !== ''
			const hasEndTime = endTime && typeof endTime === 'string' && endTime.trim() !== ''
			const assignments = event.artists?.assignments
			const hasArtists = assignments && Array.isArray(assignments) && assignments.length > 0
			
			if (hasStartTime && hasEndTime && hasArtists) {
				const duration = calculateDurationMinutes(startTime, endTime)
				
				blocks = assignments.map((assignment, index) => ({
					id: `auto-${assignment.artist_id}-${index}`,
					time: startTime,
					duration: duration,
					activity: 'Performance',
					notes: assignment.role ? `Role: ${assignment.role}` : '',
					artist_id: assignment.artist_id,
					artist_name: assignment.artist_name || 'Unknown Artist',
					is_auto_generated: true
				}))
			}
		}
		
		return blocks
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
	
	function getBlockPosition(block: ScheduleBlock, hourRow: number): { top: number; height: number } {
		if (!block.time) return { top: 0, height: 0 }
		
		const [blockHours, blockMinutes] = block.time.split(':').map(Number)
		const startMinutes = blockHours * 60 + blockMinutes
		const rowStartMinutes = hourRow * 60
		
		// Calculate position relative to the hour row (0-100%)
		const minutesIntoRow = Math.max(0, startMinutes - rowStartMinutes)
		const top = (minutesIntoRow / 60) * 100 // Percentage within the hour
		const duration = block.duration || 60
		const height = Math.min(100, (duration / 60) * 100) // Percentage based on duration, capped at 100%
		
		return { top, height }
	}
	
	function getBlockForHour(block: ScheduleBlock, hour: number): boolean {
		if (!block.time) return false
		const [blockHour] = block.time.split(':').map(Number)
		const duration = block.duration || 60
		const blockEndHour = blockHour + Math.ceil(duration / 60)
		return blockHour === hour || (blockHour < hour && blockEndHour > hour)
	}
	
	function formatTime12Hour(time: string): string {
		if (!time) return ''
		const [hours, minutes] = time.split(':')
		const hour = parseInt(hours)
		const ampm = hour >= 12 ? 'PM' : 'AM'
		const displayHour = hour % 12 || 12
		return `${displayHour}:${minutes} ${ampm}`
	}
	
	// Get visible time range based on blocks
	function getVisibleTimeRange(): { start: number; end: number } {
		if (scheduleBlocks.length === 0) {
			return { start: 8, end: 20 } // Default 8 AM to 8 PM
		}
		
		let minHour = 24
		let maxHour = 0
		
		for (const block of scheduleBlocks) {
			if (block.time) {
				const [hours] = block.time.split(':').map(Number)
				const duration = block.duration || 60
				const endHour = hours + Math.ceil(duration / 60)
				minHour = Math.min(minHour, hours)
				maxHour = Math.max(maxHour, endHour)
			}
		}
		
		return {
			start: Math.max(0, minHour - 1),
			end: Math.min(24, maxHour + 1)
		}
	}
</script>

{#if scheduleBlocks.length > 0}
	{@const timeRange = getVisibleTimeRange()}
	{@const hours = Array.from({ length: timeRange.end - timeRange.start }, (_, i) => timeRange.start + i)}
	<!-- Calendar View -->
	<div class="card bg-base-100 border">
		<div class="card-body p-4">
			<div class="relative">
				<div class="space-y-1">
					{#each hours as hour}
						<div class="flex items-start gap-2 min-h-[60px] border-b border-base-200">
							<!-- Time label -->
							<div class="w-20 text-right text-xs text-base-content/60 pt-1">
								{formatTime12Hour(`${hour.toString().padStart(2, '0')}:00`)}
							</div>
							
							<!-- Blocks container -->
							<div class="flex-1 relative min-h-[60px]">
								{#each scheduleBlocks.filter(block => getBlockForHour(block, hour)) as block}
									{@const position = getBlockPosition(block, hour)}
									{@const isOverlapping = scheduleBlocks.filter(b => {
										if (!b.time || !block.time) return false
										const [bHour, bMin] = b.time.split(':').map(Number)
										const [blockHour, blockMin] = block.time.split(':').map(Number)
										const bStart = bHour * 60 + bMin
										const bEnd = bStart + (b.duration || 60)
										const blockStart = blockHour * 60 + blockMin
										const blockEnd = blockStart + (block.duration || 60)
										return b.id !== block.id && bStart < blockEnd && bEnd > blockStart
									}).length > 0}
									
									<div
										class="absolute left-0 right-0 rounded px-2 py-1 text-xs text-white shadow-sm border border-white/20 {block.is_auto_generated ? 'bg-primary' : 'bg-secondary'} {isOverlapping ? 'z-10' : 'z-0'}"
										style="top: {position.top}%; height: {position.height}%; min-height: 24px;"
										title="{block.artist_name || block.activity || block.title || block.name} - {formatTime12Hour(block.time)} ({block.duration || 60} min)"
									>
										<div class="font-semibold truncate">
											{block.artist_name || block.activity || block.title || block.name || 'Schedule Block'}
										</div>
										<div class="text-[10px] opacity-90 truncate">
											{formatTime12Hour(block.time)} - {calculateEndTime(block.time, block.duration || 60)}
										</div>
										{#if block.notes}
											<div class="text-[10px] opacity-75 truncate mt-0.5">{block.notes}</div>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="bg-base-200 p-4 rounded-lg text-center opacity-60">
		<Calendar class="w-16 h-16 mx-auto text-base-content/70" />
		<p class="mt-2 text-sm">No schedule blocks defined</p>
		{#if event?.artists?.assignments && event.artists.assignments.length > 0}
			<p class="text-xs mt-1 opacity-70">
				{#if !event?.start_time || !event?.end_time}
					Add start and end times to auto-generate schedule from assigned artists
				{:else}
					Click "Edit" to generate schedule from assigned artists
				{/if}
			</p>
		{:else}
			<p class="text-xs mt-1 opacity-70">
				Assign artists to this event to generate a schedule
			</p>
		{/if}
	</div>
{/if}