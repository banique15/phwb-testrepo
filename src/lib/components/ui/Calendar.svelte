<script lang="ts">
	import { goto } from '$app/navigation'

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
	let view = $state<'month' | 'week'>('week')

	// Popup state
	let selectedEvent = $state<CalendarEvent | null>(null)
	let popupPosition = $state({ x: 0, y: 0 })
	let showPopup = $state(false)

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

		for (let i = 0; i < startingDay; i++) {
			days.push(null)
		}

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
		closePopup()
		if (view === 'month') {
			currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
		} else {
			const d = new Date(currentDate)
			d.setDate(d.getDate() - 7)
			currentDate = d
		}
	}

	function nextPeriod() {
		closePopup()
		if (view === 'month') {
			currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
		} else {
			const d = new Date(currentDate)
			d.setDate(d.getDate() + 7)
			currentDate = d
		}
	}

	function goToToday() {
		closePopup()
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

	function getStatusBadgeColor(status: string): string {
		switch (status) {
			case 'confirmed': return 'badge-success'
			case 'completed': return 'badge-info'
			case 'cancelled': return 'badge-error'
			case 'in_progress': return 'badge-warning'
			default: return 'badge-primary'
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

	function formatDateDisplay(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00')
		return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
	}

	function handleEventClick(event: CalendarEvent, e: MouseEvent) {
		e.preventDefault()
		e.stopPropagation()
		selectedEvent = event

		const rect = (e.target as HTMLElement).getBoundingClientRect()
		const calendarRect = (e.target as HTMLElement).closest('.card')?.getBoundingClientRect()

		if (calendarRect) {
			popupPosition = {
				x: Math.min(rect.left - calendarRect.left, calendarRect.width - 280),
				y: rect.bottom - calendarRect.top + 8
			}
		}
		showPopup = true
	}

	function handleDayClick(dateKey: string, e: MouseEvent) {
		if ((e.target as HTMLElement).closest('.event-item')) return
		closePopup()
		goto(`/events?action=new&date=${dateKey}`)
	}

	function closePopup() {
		showPopup = false
		selectedEvent = null
	}

	function viewEvent() {
		if (selectedEvent) {
			goto(`/events?id=${selectedEvent.id}`)
		}
	}

	function editEvent() {
		if (selectedEvent) {
			goto(`/events?id=${selectedEvent.id}&edit=true`)
		}
	}

	const monthDays = $derived(getMonthDays(currentDate))
	const weekDays = $derived(getWeekDays(currentDate))
	const currentYear = $derived(currentDate.getFullYear())
	const currentMonth = $derived(currentDate.getMonth())
</script>

<svelte:window onclick={closePopup} />

<div class="card bg-base-100 shadow-sm border border-base-300 relative">
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
				<div class="join">
					<button
						class="btn btn-sm join-item"
						class:btn-active={view === 'week'}
						onclick={() => { view = 'week'; closePopup() }}
					>
						Week
					</button>
					<button
						class="btn btn-sm join-item"
						class:btn-active={view === 'month'}
						onclick={() => { view = 'month'; closePopup() }}
					>
						Month
					</button>
				</div>
				<div class="join">
					<button class="btn btn-sm btn-ghost join-item" onclick={prevPeriod} aria-label="Previous">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
						</svg>
					</button>
					<button class="btn btn-sm btn-ghost join-item" onclick={nextPeriod} aria-label="Next">
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
				{#each daysOfWeek as day}
					<div class="bg-base-200 p-2 text-center text-xs font-semibold text-base-content/70">
						{day}
					</div>
				{/each}

				{#each monthDays as day}
					{@const dateKey = day ? formatDateKey(currentYear, currentMonth, day) : ''}
					{@const dayEvents = day ? getEventsForDate(dateKey) : []}
					{@const todayClass = day && isToday(currentYear, currentMonth, day) ? 'ring-2 ring-primary ring-inset' : ''}

					<div
						class="bg-base-100 min-h-24 p-1 {todayClass} {day ? 'cursor-pointer hover:bg-base-200/50' : ''}"
						onclick={(e) => day && handleDayClick(dateKey, e)}
						role={day ? 'button' : undefined}
						tabindex={day ? 0 : undefined}
					>
						{#if day}
							<div class="text-xs font-medium mb-1 {isToday(currentYear, currentMonth, day) ? 'text-primary font-bold' : 'text-base-content/60'}">
								{day}
							</div>
							<div class="space-y-0.5 overflow-y-auto max-h-16">
								{#each dayEvents.slice(0, 3) as event}
									<button
										class="event-item block w-full text-left text-xs px-1 py-0.5 rounded truncate {getStatusColor(event.status)} hover:opacity-80 transition-opacity"
										onclick={(e) => handleEventClick(event, e)}
										title="{event.title}{event.start_time ? ` at ${formatTime(event.start_time)}` : ''}"
									>
										{#if event.start_time}
											<span class="font-medium">{formatTime(event.start_time)}</span>
										{/if}
										{event.title}
									</button>
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
				{#each weekDays as day, i}
					{@const isCurrentDay = isToday(day.getFullYear(), day.getMonth(), day.getDate())}
					<div class="bg-base-200 p-2 text-center">
						<div class="text-xs font-semibold text-base-content/70">{daysOfWeek[i]}</div>
						<div class="text-lg font-bold {isCurrentDay ? 'text-primary' : ''}">{day.getDate()}</div>
					</div>
				{/each}

				{#each weekDays as day}
					{@const dateKey = formatDateKey(day.getFullYear(), day.getMonth(), day.getDate())}
					{@const dayEvents = getEventsForDate(dateKey)}
					{@const isCurrentDay = isToday(day.getFullYear(), day.getMonth(), day.getDate())}

					<div
						class="bg-base-100 min-h-48 p-2 cursor-pointer hover:bg-base-200/50 {isCurrentDay ? 'ring-2 ring-primary ring-inset' : ''}"
						onclick={(e) => handleDayClick(dateKey, e)}
						role="button"
						tabindex="0"
					>
						<div class="space-y-1">
							{#each dayEvents as event}
								<button
									class="event-item block w-full text-left text-xs p-2 rounded {getStatusColor(event.status)} hover:opacity-80 transition-opacity"
									onclick={(e) => handleEventClick(event, e)}
								>
									{#if event.start_time}
										<div class="font-semibold">{formatTime(event.start_time)}{event.end_time ? ` - ${formatTime(event.end_time)}` : ''}</div>
									{/if}
									<div class="truncate">{event.title}</div>
								</button>
							{/each}
							{#if dayEvents.length === 0}
								<div class="text-xs text-base-content/30 text-center py-4 pointer-events-none">
									Click to add event
								</div>
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

	<!-- Event Popup -->
	{#if showPopup && selectedEvent}
		<div
			class="absolute z-50 w-72 bg-base-100 rounded-lg shadow-xl border border-base-300 p-4"
			style="left: {popupPosition.x}px; top: {popupPosition.y}px;"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-label="Event details"
		>
			<div class="flex items-start justify-between mb-3">
				<div class="flex-1 min-w-0">
					<h3 class="font-bold text-base truncate">{selectedEvent.title}</h3>
					<p class="text-sm text-base-content/60">{formatDateDisplay(selectedEvent.date)}</p>
				</div>
				<button class="btn btn-ghost btn-xs btn-circle" onclick={closePopup} aria-label="Close">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="space-y-2 mb-4">
				{#if selectedEvent.start_time}
					<div class="flex items-center gap-2 text-sm">
						<svg class="w-4 h-4 text-base-content/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span>{formatTime(selectedEvent.start_time)}{selectedEvent.end_time ? ` - ${formatTime(selectedEvent.end_time)}` : ''}</span>
					</div>
				{/if}
				<div class="flex items-center gap-2">
					<span class="badge badge-sm {getStatusBadgeColor(selectedEvent.status)}">{selectedEvent.status}</span>
				</div>
			</div>

			<div class="flex gap-2">
				<button class="btn btn-primary btn-sm flex-1" onclick={viewEvent}>
					View
				</button>
				<button class="btn btn-outline btn-sm flex-1" onclick={editEvent}>
					Edit
				</button>
			</div>
		</div>
	{/if}
</div>
