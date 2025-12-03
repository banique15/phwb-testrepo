<script lang="ts">
	type CalendarEvent = {
		id: number
		title: string
		date: string
		start_time: string | null
		end_time: string | null
		status: string
	}

	interface Props {
		events: CalendarEvent[]
	}

	let { events }: Props = $props()

	let currentDate = $state(new Date())
	let view = $state<'month' | 'week'>('month')

	const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December']

	function getMonthDays(date: Date) {
		const year = date.getFullYear()
		const month = date.getMonth()
		const firstDay = new Date(year, month, 1)
		const lastDay = new Date(year, month + 1, 0)
		const daysInMonth = lastDay.getDate()
		const startingDay = firstDay.getDay()

		const days: (number | null)[] = []

		// Add empty slots for days before the 1st
		for (let i = 0; i < startingDay; i++) {
			days.push(null)
		}

		// Add days of the month
		for (let i = 1; i <= daysInMonth; i++) {
			days.push(i)
		}

		return days
	}

	function getWeekDays(date: Date) {
		const day = date.getDay()
		const diff = date.getDate() - day
		const weekStart = new Date(date)
		weekStart.setDate(diff)

		const days: Date[] = []
		for (let i = 0; i < 7; i++) {
			const d = new Date(weekStart)
			d.setDate(weekStart.getDate() + i)
			days.push(d)
		}
		return days
	}

	function getEventsForDate(date: string): CalendarEvent[] {
		return events.filter(e => e.date === date)
	}

	function formatDateKey(year: number, month: number, day: number): string {
		return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
	}

	function prevPeriod() {
		if (view === 'month') {
			currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
		} else {
			const d = new Date(currentDate)
			d.setDate(d.getDate() - 7)
			currentDate = d
		}
	}

	function nextPeriod() {
		if (view === 'month') {
			currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
		} else {
			const d = new Date(currentDate)
			d.setDate(d.getDate() + 7)
			currentDate = d
		}
	}

	function goToToday() {
		currentDate = new Date()
	}

	function isToday(year: number, month: number, day: number): boolean {
		const today = new Date()
		return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'confirmed': return 'bg-success text-success-content'
			case 'completed': return 'bg-info text-info-content'
			case 'cancelled': return 'bg-error text-error-content'
			case 'in_progress': return 'bg-warning text-warning-content'
			default: return 'bg-primary text-primary-content'
		}
	}

	function formatTime(time: string | null): string {
		if (!time) return ''
		const [hours, minutes] = time.split(':')
		const h = parseInt(hours)
		const ampm = h >= 12 ? 'p' : 'a'
		const hour12 = h % 12 || 12
		return `${hour12}:${minutes}${ampm}`
	}

	const monthDays = $derived(getMonthDays(currentDate))
	const weekDays = $derived(getWeekDays(currentDate))
	const currentYear = $derived(currentDate.getFullYear())
	const currentMonth = $derived(currentDate.getMonth())
</script>

<div class="card bg-base-100 shadow-sm border border-base-300">
	<div class="card-body p-4">
		<!-- Header -->
		<div class="flex items-center justify-between mb-4">
			<div class="flex items-center gap-2">
				<h2 class="text-lg font-bold">
					{monthNames[currentMonth]} {currentYear}
				</h2>
				<button class="btn btn-xs btn-ghost" onclick={goToToday}>Today</button>
			</div>
			<div class="flex items-center gap-2">
				<div class="btn-group">
					<button
						class="btn btn-sm"
						class:btn-active={view === 'month'}
						onclick={() => view = 'month'}
					>
						Month
					</button>
					<button
						class="btn btn-sm"
						class:btn-active={view === 'week'}
						onclick={() => view = 'week'}
					>
						Week
					</button>
				</div>
				<div class="btn-group">
					<button class="btn btn-sm btn-ghost" onclick={prevPeriod}>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
						</svg>
					</button>
					<button class="btn btn-sm btn-ghost" onclick={nextPeriod}>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
					</button>
				</div>
			</div>
		</div>

		<!-- Month View -->
		{#if view === 'month'}
			<div class="grid grid-cols-7 gap-px bg-base-300 rounded-lg overflow-hidden">
				<!-- Day headers -->
				{#each daysOfWeek as day}
					<div class="bg-base-200 p-2 text-center text-xs font-semibold text-base-content/70">
						{day}
					</div>
				{/each}

				<!-- Calendar days -->
				{#each monthDays as day}
					{@const dateKey = day ? formatDateKey(currentYear, currentMonth, day) : ''}
					{@const dayEvents = day ? getEventsForDate(dateKey) : []}
					{@const todayClass = day && isToday(currentYear, currentMonth, day) ? 'ring-2 ring-primary ring-inset' : ''}

					<div class="bg-base-100 min-h-24 p-1 {todayClass}">
						{#if day}
							<div class="text-xs font-medium mb-1 {isToday(currentYear, currentMonth, day) ? 'text-primary font-bold' : 'text-base-content/60'}">
								{day}
							</div>
							<div class="space-y-0.5 overflow-y-auto max-h-16">
								{#each dayEvents.slice(0, 3) as event}
									<a
										href="/events?id={event.id}"
										class="block text-xs px-1 py-0.5 rounded truncate {getStatusColor(event.status)} hover:opacity-80 transition-opacity"
										title="{event.title}{event.start_time ? ` at ${formatTime(event.start_time)}` : ''}"
									>
										{#if event.start_time}
											<span class="font-medium">{formatTime(event.start_time)}</span>
										{/if}
										{event.title}
									</a>
								{/each}
								{#if dayEvents.length > 3}
									<div class="text-xs text-base-content/50 px-1">
										+{dayEvents.length - 3} more
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- Week View -->
		{#if view === 'week'}
			<div class="grid grid-cols-7 gap-px bg-base-300 rounded-lg overflow-hidden">
				<!-- Day headers with dates -->
				{#each weekDays as day, i}
					{@const isCurrentDay = isToday(day.getFullYear(), day.getMonth(), day.getDate())}
					<div class="bg-base-200 p-2 text-center">
						<div class="text-xs font-semibold text-base-content/70">{daysOfWeek[i]}</div>
						<div class="text-lg font-bold {isCurrentDay ? 'text-primary' : ''}">{day.getDate()}</div>
					</div>
				{/each}

				<!-- Events for each day -->
				{#each weekDays as day}
					{@const dateKey = formatDateKey(day.getFullYear(), day.getMonth(), day.getDate())}
					{@const dayEvents = getEventsForDate(dateKey)}
					{@const isCurrentDay = isToday(day.getFullYear(), day.getMonth(), day.getDate())}

					<div class="bg-base-100 min-h-48 p-2 {isCurrentDay ? 'ring-2 ring-primary ring-inset' : ''}">
						<div class="space-y-1">
							{#each dayEvents as event}
								<a
									href="/events?id={event.id}"
									class="block text-xs p-2 rounded {getStatusColor(event.status)} hover:opacity-80 transition-opacity"
								>
									{#if event.start_time}
										<div class="font-semibold">{formatTime(event.start_time)}{event.end_time ? ` - ${formatTime(event.end_time)}` : ''}</div>
									{/if}
									<div class="truncate">{event.title}</div>
								</a>
							{/each}
							{#if dayEvents.length === 0}
								<div class="text-xs text-base-content/30 text-center py-4">No events</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Legend -->
		<div class="flex flex-wrap gap-3 mt-4 text-xs">
			<div class="flex items-center gap-1">
				<div class="w-3 h-3 rounded bg-primary"></div>
				<span>Planned</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="w-3 h-3 rounded bg-success"></div>
				<span>Confirmed</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="w-3 h-3 rounded bg-warning"></div>
				<span>In Progress</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="w-3 h-3 rounded bg-info"></div>
				<span>Completed</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="w-3 h-3 rounded bg-error"></div>
				<span>Cancelled</span>
			</div>
		</div>
	</div>
</div>
