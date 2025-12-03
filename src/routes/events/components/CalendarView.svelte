<script lang="ts">
	import type { EnhancedEvent } from '$lib/stores/events'

	interface Props {
		events: EnhancedEvent[]
		selectedEvent?: EnhancedEvent | null
		onSelectEvent: (event: EnhancedEvent) => void
	}

	let { events, selectedEvent = null, onSelectEvent }: Props = $props()

	// Calendar state
	let currentDate = $state(new Date())

	// Expanded date for showing all events popover
	let expandedDate = $state<string | null>(null)
	let currentMonth = $derived(currentDate.getMonth())
	let currentYear = $derived(currentDate.getFullYear())

	// Month navigation
	function previousMonth() {
		currentDate = new Date(currentYear, currentMonth - 1, 1)
	}

	function nextMonth() {
		currentDate = new Date(currentYear, currentMonth + 1, 1)
	}

	function goToToday() {
		currentDate = new Date()
	}

	// Get days in month
	function getDaysInMonth(year: number, month: number): number {
		return new Date(year, month + 1, 0).getDate()
	}

	// Get first day of month (0 = Sunday, 6 = Saturday)
	function getFirstDayOfMonth(year: number, month: number): number {
		return new Date(year, month, 1).getDay()
	}

	// Generate calendar days
	let calendarDays = $derived.by(() => {
		const daysInMonth = getDaysInMonth(currentYear, currentMonth)
		const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
		const days: Array<{ day: number; date: Date; isCurrentMonth: boolean }> = []

		// Add previous month days
		const prevMonthDays = getDaysInMonth(currentYear, currentMonth - 1)
		for (let i = firstDay - 1; i >= 0; i--) {
			days.push({
				day: prevMonthDays - i,
				date: new Date(currentYear, currentMonth - 1, prevMonthDays - i),
				isCurrentMonth: false
			})
		}

		// Add current month days
		for (let day = 1; day <= daysInMonth; day++) {
			days.push({
				day,
				date: new Date(currentYear, currentMonth, day),
				isCurrentMonth: true
			})
		}

		// Add next month days to complete the grid
		const remainingDays = 42 - days.length // 6 rows × 7 days
		for (let day = 1; day <= remainingDays; day++) {
			days.push({
				day,
				date: new Date(currentYear, currentMonth + 1, day),
				isCurrentMonth: false
			})
		}

		return days
	})

	// Get events for a specific date
	function getEventsForDate(date: Date): EnhancedEvent[] {
		const dateStr = formatDateForComparison(date)
		return events.filter(event => {
			if (!event.date) return false
			const eventDateStr = formatDateForComparison(new Date(event.date))
			return eventDateStr === dateStr
		})
	}

	function formatDateForComparison(date: Date): string {
		return date.toISOString().split('T')[0]
	}

	function isToday(date: Date): boolean {
		const today = new Date()
		return formatDateForComparison(date) === formatDateForComparison(today)
	}

	function formatMonthYear(date: Date): string {
		return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
	}

	function getStatusColor(status: string | undefined): string {
		switch (status?.toLowerCase()) {
			case 'confirmed':
				return 'bg-primary'
			case 'completed':
				return 'bg-success'
			case 'cancelled':
				return 'bg-error'
			case 'in_progress':
				return 'bg-warning'
			default:
				return 'bg-base-300'
		}
	}
</script>

<div class="h-full flex flex-col">
	<!-- Calendar Header -->
	<div class="flex items-center justify-between mb-6">
		<h2 class="text-2xl font-bold">{formatMonthYear(currentDate)}</h2>
		<div class="flex gap-2">
			<button class="btn btn-sm btn-ghost" onclick={previousMonth}>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</button>
			<button class="btn btn-sm btn-outline" onclick={goToToday}>
				Today
			</button>
			<button class="btn btn-sm btn-ghost" onclick={nextMonth}>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</button>
		</div>
	</div>

	<!-- Calendar Grid -->
	<div class="flex-1 overflow-auto">
		<div class="min-w-full">
			<!-- Day headers -->
			<div class="grid grid-cols-7 gap-px bg-base-300 border border-base-300 rounded-t-lg overflow-hidden">
				{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
					<div class="bg-base-200 p-2 text-center text-sm font-semibold">
						{day}
					</div>
				{/each}
			</div>

			<!-- Calendar days -->
			<div class="grid grid-cols-7 gap-px bg-base-300 border-x border-b border-base-300 rounded-b-lg overflow-hidden">
				{#each calendarDays as { day, date, isCurrentMonth }}
					{@const dayEvents = getEventsForDate(date)}
					{@const isTodayDate = isToday(date)}
					<div
						class="bg-base-100 p-2 min-h-24 relative {!isCurrentMonth ? 'opacity-40' : ''} {isTodayDate ? 'ring-2 ring-primary' : ''}"
					>
						<!-- Day number -->
						<div class="text-sm font-medium mb-1 {isTodayDate ? 'text-primary font-bold' : ''}">
							{day}
						</div>

						<!-- Events for this day -->
						<div class="space-y-1">
							{#each dayEvents.slice(0, 3) as event}
								<button
									class="w-full text-left text-xs p-1 rounded truncate transition-colors hover:opacity-80 {getStatusColor(event.status)} {selectedEvent?.id === event.id ? 'ring-2 ring-offset-1 ring-base-content' : ''}"
									onclick={() => onSelectEvent(event)}
									title={event.title || 'Untitled Event'}
								>
									<div class="text-white font-medium truncate">
										{#if event.start_time}
											{event.start_time.slice(0, 5)}
										{/if}
										{event.title || 'Untitled'}
									</div>
								</button>
							{/each}
							{#if dayEvents.length > 3}
								<div class="text-xs text-center opacity-60">
									+{dayEvents.length - 3} more
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Legend -->
	<div class="mt-4 flex flex-wrap gap-4 text-xs">
		<div class="flex items-center gap-2">
			<div class="w-3 h-3 rounded bg-primary"></div>
			<span>Confirmed</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="w-3 h-3 rounded bg-success"></div>
			<span>Completed</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="w-3 h-3 rounded bg-warning"></div>
			<span>In Progress</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="w-3 h-3 rounded bg-error"></div>
			<span>Cancelled</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="w-3 h-3 rounded bg-base-300"></div>
			<span>Planned</span>
		</div>
	</div>
</div>
