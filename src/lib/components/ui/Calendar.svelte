<script lang="ts">
	import { goto } from '$app/navigation'
	import { eventsStore, type EnhancedEvent } from '$lib/stores/events'
	import EventCreateForm from '../../../routes/events/components/EventCreateForm.svelte'

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

	// Local events state (for newly created events)
	let localEvents = $state<CalendarEvent[]>([])
	let allEvents = $derived([...localEvents, ...events])

	let currentDate = $state(new Date())
	let view = $state<'month' | 'week'>('week')
	let weekViewRef = $state<HTMLDivElement | null>(null)

	// View Drawer state
	let showViewDrawer = $state(false)
	let selectedEvent = $state<CalendarEvent | null>(null)
	let fullEventDetails = $state<EnhancedEvent | null>(null)
	let loadingDetails = $state(false)

	// Create Drawer state
	let showCreateDrawer = $state(false)
	let newEventDate = $state('')
	let newEventTime = $state('')

	// Blink animation state
	let blinkingEventId = $state<number | null>(null)

	const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December']

	const defaultStartHour = 8
	const defaultEndHour = 20

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
		return allEvents.filter(e => e.date === date)
	}

	function getEventsForDateAndHour(date: string, hour: number): CalendarEvent[] {
		return allEvents.filter(e => {
			if (e.date !== date) return false
			if (!e.start_time) return hour === 9
			const eventHour = parseInt(e.start_time.split(':')[0])
			return eventHour === hour
		})
	}

	function formatDateKey(year: number, month: number, day: number): string {
		return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
	}

	function getWeekEventHours(weekDays: Date[]): Set<number> {
		const hours = new Set<number>()
		weekDays.forEach(day => {
			const dateKey = formatDateKey(day.getFullYear(), day.getMonth(), day.getDate())
			const dayEvents = getEventsForDate(dateKey)
			dayEvents.forEach(event => {
				if (event.start_time) {
					const startHour = parseInt(event.start_time.split(':')[0])
					hours.add(startHour)
					if (event.end_time) {
						const endHour = parseInt(event.end_time.split(':')[0])
						for (let h = startHour; h <= endHour; h++) {
							hours.add(h)
						}
					}
				} else {
					hours.add(9)
				}
			})
		})
		return hours
	}

	function getVisibleHours(weekDays: Date[]): number[] {
		const eventHours = getWeekEventHours(weekDays)
		const visible: number[] = []

		for (let h = 0; h < 24; h++) {
			const inDefaultRange = h >= defaultStartHour && h <= defaultEndHour
			const hasEvent = eventHours.has(h)

			if (inDefaultRange || hasEvent) {
				visible.push(h)
			}
		}

		if (visible.length > 0) {
			const min = Math.min(...visible)
			const max = Math.max(...visible)
			const filled: number[] = []
			for (let h = min; h <= max; h++) {
				filled.push(h)
			}
			return filled
		}

		return visible
	}

	function hasEventsAtHour(weekDays: Date[], hour: number): boolean {
		return weekDays.some(day => {
			const dateKey = formatDateKey(day.getFullYear(), day.getMonth(), day.getDate())
			return getEventsForDateAndHour(dateKey, hour).length > 0
		})
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
		const ampm = h >= 12 ? 'PM' : 'AM'
		const hour12 = h % 12 || 12
		return `${hour12}:${minutes} ${ampm}`
	}

	function formatHour(hour: number): string {
		const ampm = hour >= 12 ? 'PM' : 'AM'
		const hour12 = hour % 12 || 12
		return `${hour12} ${ampm}`
	}

	function formatDateDisplay(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00')
		return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
	}

	function formatDateShort(dateStr: string | undefined): string {
		if (!dateStr) return 'Not set'
		const date = new Date(dateStr + 'T00:00:00')
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
	}

	async function handleEventClick(event: CalendarEvent, e: MouseEvent) {
		e.preventDefault()
		e.stopPropagation()
		selectedEvent = event
		showViewDrawer = true
		loadingDetails = true
		fullEventDetails = null

		try {
			const details = await eventsStore.enhanced.getById(event.id)
			if (details) {
				fullEventDetails = details
			}
		} catch (err) {
			console.error('Failed to load event details:', err)
		} finally {
			loadingDetails = false
		}
	}

	function handleDayClick(dateKey: string, e: MouseEvent) {
		if ((e.target as HTMLElement).closest('.event-item')) return
		newEventDate = dateKey
		newEventTime = ''
		showCreateDrawer = true
	}

	function handleTimeSlotClick(dateKey: string, hour: number, e: MouseEvent) {
		if ((e.target as HTMLElement).closest('.event-item')) return
		newEventDate = dateKey
		newEventTime = `${String(hour).padStart(2, '0')}:00`
		showCreateDrawer = true
	}

	function closeViewDrawer() {
		showViewDrawer = false
		selectedEvent = null
		fullEventDetails = null
	}

	function closeCreateDrawer() {
		showCreateDrawer = false
		newEventDate = ''
		newEventTime = ''
	}

	function handleCreateSuccess(createdEvent?: EnhancedEvent) {
		if (createdEvent) {
			// Add to local events
			const newCalendarEvent: CalendarEvent = {
				id: createdEvent.id!,
				title: createdEvent.title || 'New Event',
				date: createdEvent.date || '',
				start_time: createdEvent.start_time || null,
				end_time: createdEvent.end_time || null,
				status: createdEvent.status || 'planned'
			}
			localEvents = [newCalendarEvent, ...localEvents]

			// Navigate to the event's date/week
			if (createdEvent.date) {
				currentDate = new Date(createdEvent.date + 'T00:00:00')
			}

			// Trigger blink animation
			blinkingEventId = createdEvent.id!
			setTimeout(() => {
				blinkingEventId = null
			}, 3000)
		}
		closeCreateDrawer()
	}

	function viewFullEvent() {
		if (selectedEvent) {
			goto(`/events?id=${selectedEvent.id}`)
		}
	}

	function editEvent() {
		if (selectedEvent) {
			goto(`/events?id=${selectedEvent.id}&edit=true`)
		}
	}

	$effect(() => {
		if (view === 'week' && weekViewRef) {
			const firstHourIndex = visibleHours.indexOf(defaultStartHour)
			if (firstHourIndex > 0) {
				weekViewRef.scrollTop = 0
			}
		}
	})

	const monthDays = $derived(getMonthDays(currentDate))
	const weekDays = $derived(getWeekDays(currentDate))
	const currentYear = $derived(currentDate.getFullYear())
	const currentMonth = $derived(currentDate.getMonth())
	const visibleHours = $derived(getVisibleHours(weekDays))
</script>

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
						onclick={() => { view = 'week' }}
					>
						Week
					</button>
					<button
						class="btn btn-sm join-item"
						class:btn-active={view === 'month'}
						onclick={() => { view = 'month' }}
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
										class="event-item block w-full text-left text-xs px-1 py-0.5 rounded {getStatusColor(event.status)} hover:opacity-80 transition-opacity {blinkingEventId === event.id ? 'animate-blink' : ''}"
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

		<!-- Week View with Time Grid -->
		{#if view === 'week'}
			<!-- Day headers -->
			<div class="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] gap-px bg-base-300 rounded-t-lg overflow-hidden">
				<div class="bg-base-200 p-2"></div>
				{#each weekDays as day, i}
					{@const isCurrentDay = isToday(day.getFullYear(), day.getMonth(), day.getDate())}
					<div class="bg-base-200 p-2 text-center {isCurrentDay ? 'bg-base-300/20' : ''}">
						<div class="text-xs font-semibold text-base-content/70">{daysOfWeek[i]}</div>
						<div class="text-lg font-bold {isCurrentDay ? 'text-primary' : ''}">{day.getDate()}</div>
					</div>
				{/each}
			</div>

			<!-- Time grid -->
			<div
				bind:this={weekViewRef}
				class="max-h-[500px] overflow-y-auto border-x border-b border-base-300 rounded-b-lg"
			>
				<div class="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] gap-px bg-base-300">
					{#each visibleHours as hour}
						{@const hasEvents = hasEventsAtHour(weekDays, hour)}
						{@const rowHeight = hasEvents ? 'min-h-16' : 'min-h-8'}

						<!-- Time label -->
						<div class="bg-base-100 {rowHeight} flex items-start justify-end pr-2 pt-1">
							<span class="text-xs text-base-content/50">{formatHour(hour)}</span>
						</div>

						<!-- Day cells for this hour -->
						{#each weekDays as day}
							{@const dateKey = formatDateKey(day.getFullYear(), day.getMonth(), day.getDate())}
							{@const hourEvents = getEventsForDateAndHour(dateKey, hour)}

							<div
								class="bg-base-100 {rowHeight} p-0.5 border-t border-base-200 cursor-pointer hover:bg-base-200/30"
								onclick={(e) => handleTimeSlotClick(dateKey, hour, e)}
								role="button"
								tabindex="0"
							>
								{#each hourEvents as event}
									<button
										class="event-item block w-full text-left text-xs p-1.5 rounded {getStatusColor(event.status)} hover:opacity-80 transition-opacity mb-0.5 {blinkingEventId === event.id ? 'animate-blink' : ''}"
										onclick={(e) => handleEventClick(event, e)}
									>
										{#if event.start_time}
											<div class="text-[10px] opacity-80">{formatTime(event.start_time)}{#if event.end_time} - {formatTime(event.end_time)}{/if}</div>
										{/if}
										<div class="font-semibold leading-tight">{event.title}</div>
									</button>
								{/each}
							</div>
						{/each}
					{/each}
				</div>
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

<!-- Right Drawer for Event Details -->
{#if showViewDrawer}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/50 z-40"
		onclick={closeViewDrawer}
		role="button"
		tabindex="-1"
		aria-label="Close drawer"
	></div>

	<!-- Drawer -->
	<div class="fixed right-0 top-0 h-full w-full max-w-lg bg-base-100 shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
		<!-- Drawer Header -->
		<div class="flex-none flex items-center justify-between p-4 border-b border-base-300">
			<h2 class="text-xl font-bold">Event Details</h2>
			<button class="btn btn-ghost btn-sm btn-circle" onclick={closeViewDrawer} aria-label="Close">
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Drawer Content -->
		<div class="flex-1 overflow-y-auto p-4">
			{#if loadingDetails}
				<div class="flex items-center justify-center h-32">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{:else if fullEventDetails}
				<!-- Event Title & Status -->
				<div class="mb-6">
					<h3 class="text-2xl font-bold mb-2">{fullEventDetails.title}</h3>
					<span class="badge {getStatusBadgeColor(fullEventDetails.status || '')} badge-lg">
						{fullEventDetails.status || 'Unknown'}
					</span>
				</div>

				<!-- Date & Time Section -->
				<div class="card bg-base-200/50 mb-4">
					<div class="card-body p-4">
						<h4 class="font-semibold text-sm text-base-content/70 mb-3">Date & Time</h4>
						<div class="grid grid-cols-1 gap-3">
							<div class="flex items-center gap-3">
								<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								<div>
									<div class="text-sm text-base-content/60">Date</div>
									<div class="font-medium">{formatDateDisplay(fullEventDetails.date || '')}</div>
								</div>
							</div>
							{#if fullEventDetails.start_time || fullEventDetails.end_time}
								<div class="flex items-center gap-3">
									<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									<div>
										<div class="text-sm text-base-content/60">Time</div>
										<div class="font-medium">
											{formatTime(fullEventDetails.start_time || null)}{fullEventDetails.end_time ? ` - ${formatTime(fullEventDetails.end_time)}` : ''}
										</div>
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Venue Section -->
				{#if fullEventDetails.venue_name}
					<div class="card bg-base-200/50 mb-4">
						<div class="card-body p-4">
							<h4 class="font-semibold text-sm text-base-content/70 mb-3">Venue</h4>
							<div class="flex items-center gap-3">
								<svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
								<div>
									<div class="font-medium">{fullEventDetails.venue_name}</div>
									{#if fullEventDetails.venue_object?.address}
										<div class="text-sm text-base-content/60">{fullEventDetails.venue_object.address}</div>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- Program Section -->
				{#if fullEventDetails.program_name}
					<div class="card bg-base-200/50 mb-4">
						<div class="card-body p-4">
							<h4 class="font-semibold text-sm text-base-content/70 mb-3">Program</h4>
							<div class="flex items-center gap-3">
								<svg class="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
								</svg>
								<div class="font-medium">{fullEventDetails.program_name}</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- Partner Section -->
				{#if fullEventDetails.partner_name}
					<div class="card bg-base-200/50 mb-4">
						<div class="card-body p-4">
							<h4 class="font-semibold text-sm text-base-content/70 mb-3">Partner</h4>
							<div class="flex items-center gap-3">
								<svg class="w-5 h-5 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
								</svg>
								<div class="font-medium">{fullEventDetails.partner_name}</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- Notes Section -->
				{#if fullEventDetails.notes}
					<div class="card bg-base-200/50 mb-4">
						<div class="card-body p-4">
							<h4 class="font-semibold text-sm text-base-content/70 mb-3">Notes</h4>
							<p class="text-sm whitespace-pre-wrap">{fullEventDetails.notes}</p>
						</div>
					</div>
				{/if}

				<!-- Artists Section -->
				{#if fullEventDetails.artists && Array.isArray(fullEventDetails.artists) && fullEventDetails.artists.length > 0}
					<div class="card bg-base-200/50 mb-4">
						<div class="card-body p-4">
							<h4 class="font-semibold text-sm text-base-content/70 mb-3">
								Assigned Artists ({fullEventDetails.artists.length})
							</h4>
							<div class="space-y-2">
								{#each fullEventDetails.artists as artist}
									<div class="flex items-center gap-2 p-2 bg-base-100 rounded-lg">
										<div class="avatar placeholder">
											<div class="bg-primary text-primary-content rounded-full w-8">
												<span class="text-xs">{(artist.name || artist.artist_name || 'A').charAt(0)}</span>
											</div>
										</div>
										<span class="text-sm font-medium">{artist.name || artist.artist_name || 'Unknown Artist'}</span>
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}

				<!-- Event Flyer -->
				{#if fullEventDetails.digital_flyer_link}
					<div class="card bg-base-200/50 mb-4">
						<div class="card-body p-4">
							<h4 class="font-semibold text-sm text-base-content/70 mb-3">Event Flyer</h4>
							<img
								src={fullEventDetails.digital_flyer_link}
								alt={fullEventDetails.title || 'Event flyer'}
								class="rounded-lg w-full"
							/>
						</div>
					</div>
				{/if}

				<!-- Meta Info -->
				<div class="text-xs text-base-content/50 mt-6 pt-4 border-t border-base-300">
					<div class="flex justify-between">
						<span>Created: {formatDateShort(fullEventDetails.created_at)}</span>
						{#if fullEventDetails.updated_at}
							<span>Updated: {formatDateShort(fullEventDetails.updated_at)}</span>
						{/if}
					</div>
				</div>
			{:else if selectedEvent}
				<!-- Fallback to basic info -->
				<div class="mb-6">
					<h3 class="text-2xl font-bold mb-2">{selectedEvent.title}</h3>
					<span class="badge {getStatusBadgeColor(selectedEvent.status)} badge-lg">
						{selectedEvent.status}
					</span>
				</div>
				<div class="card bg-base-200/50 mb-4">
					<div class="card-body p-4">
						<div class="flex items-center gap-3">
							<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
							</svg>
							<div>
								<div class="text-sm text-base-content/60">Date</div>
								<div class="font-medium">{formatDateDisplay(selectedEvent.date)}</div>
							</div>
						</div>
						{#if selectedEvent.start_time}
							<div class="flex items-center gap-3 mt-3">
								<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<div>
									<div class="text-sm text-base-content/60">Time</div>
									<div class="font-medium">
										{formatTime(selectedEvent.start_time)}{selectedEvent.end_time ? ` - ${formatTime(selectedEvent.end_time)}` : ''}
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Drawer Footer -->
		<div class="flex-none p-4 border-t border-base-300 bg-base-100">
			<div class="flex gap-3">
				<button class="btn btn-primary flex-1" onclick={viewFullEvent}>
					<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
					</svg>
					View Full Details
				</button>
				<button class="btn btn-outline flex-1" onclick={editEvent}>
					<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
					</svg>
					Edit Event
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Right Drawer for Create Event -->
{#if showCreateDrawer}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/50 z-40"
		onclick={closeCreateDrawer}
		role="button"
		tabindex="-1"
		aria-label="Close drawer"
	></div>

	<!-- Drawer -->
	<div class="fixed right-0 top-0 h-full w-full max-w-lg bg-base-100 shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
		<EventCreateForm
			initialDate={newEventDate}
			initialTime={newEventTime}
			onSuccess={handleCreateSuccess}
			onCancel={closeCreateDrawer}
		/>
	</div>
{/if}

<style>
	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}

	:global(.animate-blink) {
		animation: blink 0.5s ease-in-out 6;
	}
</style>
