<script lang="ts">
	import { goto } from '$app/navigation'
	import { eventsStore, type EnhancedEvent } from '$lib/stores/events'
	import { enhancedLookup } from '$lib/stores/lookup'
	import EventCreateForm from '../../../routes/events/components/EventCreateForm.svelte'

	type CalendarEvent = {
		id: number
		title: string
		date: string
		start_time: string | null
		end_time: string | null
		status: string
		program_id: number | null
		program_name: string | null
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

	// Program color palette - distinctive colors for different programs
	const programColors = [
		{ bg: 'bg-blue-500', text: 'text-white', hex: '#3b82f6' },
		{ bg: 'bg-emerald-500', text: 'text-white', hex: '#10b981' },
		{ bg: 'bg-violet-500', text: 'text-white', hex: '#8b5cf6' },
		{ bg: 'bg-amber-500', text: 'text-white', hex: '#f59e0b' },
		{ bg: 'bg-rose-500', text: 'text-white', hex: '#f43f5e' },
		{ bg: 'bg-cyan-500', text: 'text-white', hex: '#06b6d4' },
		{ bg: 'bg-pink-500', text: 'text-white', hex: '#ec4899' },
		{ bg: 'bg-lime-500', text: 'text-white', hex: '#84cc16' },
		{ bg: 'bg-orange-500', text: 'text-white', hex: '#f97316' },
		{ bg: 'bg-teal-500', text: 'text-white', hex: '#14b8a6' },
	]

	// Get color index for a program (consistent hashing based on program_id)
	function getProgramColorIndex(programId: number | null): number {
		if (!programId) return 0
		return programId % programColors.length
	}

	function getProgramColor(programId: number | null): string {
		const color = programColors[getProgramColorIndex(programId)]
		return `${color.bg} ${color.text}`
	}

	// Get unique programs from events for the legend
	let uniquePrograms = $derived.by(() => {
		const programMap = new Map<number, string>()
		allEvents.forEach(event => {
			if (event.program_id && event.program_name) {
				programMap.set(event.program_id, event.program_name)
			}
		})
		return Array.from(programMap.entries()).map(([id, name]) => ({
			id,
			name,
			color: programColors[getProgramColorIndex(id)]
		}))
	})

	// Check if there are events without programs
	let hasEventsWithoutProgram = $derived(allEvents.some(e => !e.program_id))

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
				status: createdEvent.status || 'planned',
				program_id: createdEvent.program_id || null,
				program_name: createdEvent.program_name || null
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

	// Toast state for copy feedback
	let toastMessage = $state('')
	let showToast = $state(false)

	function showCopyToast(message: string) {
		toastMessage = message
		showToast = true
		setTimeout(() => {
			showToast = false
		}, 2000)
	}

	// Clipboard helper
	async function copyToClipboard(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text)
			showCopyToast(`${label} copied!`)
		} catch (err) {
			console.error('Failed to copy:', err)
		}
	}

	// Status transition functions
	let updatingStatus = $state(false)

	async function updateEventStatus(newStatus: 'planned' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled') {
		if (!selectedEvent || updatingStatus) return
		updatingStatus = true
		try {
			await eventsStore.enhanced.update(selectedEvent.id, { status: newStatus })
			if (fullEventDetails) {
				fullEventDetails = { ...fullEventDetails, status: newStatus }
			}
			// Update local events list
			localEvents = localEvents.map(e =>
				e.id === selectedEvent!.id ? { ...e, status: newStatus } : e
			)
			showCopyToast(`Event ${newStatus}`)
		} catch (err) {
			console.error('Failed to update status:', err)
		} finally {
			updatingStatus = false
		}
	}

	// Communication functions
	function sendReminder() {
		if (!fullEventDetails?.artist_details) return
		const emails = fullEventDetails.artist_details
			.map(a => a.email)
			.filter(Boolean)
			.join(', ')
		if (emails) {
			copyToClipboard(emails, 'Artist emails')
		}
	}

	function shareEvent() {
		if (!fullEventDetails) return
		const date = fullEventDetails.date ? formatDateDisplay(fullEventDetails.date) : 'TBD'
		const time = fullEventDetails.start_time ? formatTime(fullEventDetails.start_time) : ''
		const endTime = fullEventDetails.end_time ? ` - ${formatTime(fullEventDetails.end_time)}` : ''
		const facility = fullEventDetails.facility_name || fullEventDetails.venue_name || ''
		const location = fullEventDetails.location_name || ''

		const summary = [
			fullEventDetails.title || 'Event',
			`${date}${time ? ` at ${time}${endTime}` : ''}`,
			facility + (location ? ` - ${location}` : ''),
		].filter(Boolean).join('\n')

		copyToClipboard(summary, 'Event details')
	}

	// Date helpers
	function isEventUpcoming(dateStr: string | undefined): boolean {
		if (!dateStr) return false
		const eventDate = new Date(dateStr + 'T23:59:59')
		return eventDate >= new Date()
	}

	function getMonthAbbrev(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00')
		return date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
	}

	function getDayNumber(dateStr: string): number {
		const date = new Date(dateStr + 'T00:00:00')
		return date.getDate()
	}

	function getDayOfWeek(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00')
		return date.toLocaleDateString('en-US', { weekday: 'long' })
	}

	function getArtistInitials(name: string): string {
		return name
			.split(' ')
			.map(n => n.charAt(0))
			.slice(0, 2)
			.join('')
			.toUpperCase()
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
										class="event-item block w-full text-left text-xs px-1 py-0.5 rounded {getProgramColor(event.program_id)} hover:opacity-80 transition-opacity {blinkingEventId === event.id ? 'animate-blink' : ''}"
										onclick={(e) => handleEventClick(event, e)}
										title="{event.title}{event.start_time ? ` at ${formatTime(event.start_time)}` : ''}{event.program_name ? ` (${event.program_name})` : ''}"
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
										class="event-item block w-full text-left text-xs p-1.5 rounded {getProgramColor(event.program_id)} hover:opacity-80 transition-opacity mb-0.5 {blinkingEventId === event.id ? 'animate-blink' : ''}"
										onclick={(e) => handleEventClick(event, e)}
										title="{event.program_name || 'No program'}"
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

		<!-- Legend - Programs -->
		{#if uniquePrograms.length > 0 || hasEventsWithoutProgram}
			<div class="flex flex-wrap gap-3 mt-4 text-xs">
				<span class="text-base-content/50 font-medium">Legend:</span>
				{#each uniquePrograms as program}
					<div class="flex items-center gap-1">
						<div class="w-3 h-3 rounded {program.color.bg}"></div>
						<span>{program.name}</span>
					</div>
				{/each}
				{#if hasEventsWithoutProgram}
					<div class="flex items-center gap-1">
						<div class="w-3 h-3 rounded bg-blue-500"></div>
						<span class="text-base-content/50">No Program</span>
					</div>
				{/if}
			</div>
		{/if}
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

				<!-- Compact Date & Time Card -->
				{#if fullEventDetails.date}
					<div class="flex items-center gap-4 p-4 bg-base-200/50 rounded-xl mb-4">
						<div class="flex-shrink-0 w-14 h-14 bg-primary/10 rounded-xl flex flex-col items-center justify-center">
							<span class="text-xs font-bold text-primary">{getMonthAbbrev(fullEventDetails.date)}</span>
							<span class="text-xl font-bold text-primary">{getDayNumber(fullEventDetails.date)}</span>
						</div>
						<div>
							<div class="font-semibold">{getDayOfWeek(fullEventDetails.date)}</div>
							{#if fullEventDetails.start_time}
								<div class="text-sm text-base-content/60">
									{formatTime(fullEventDetails.start_time)}{fullEventDetails.end_time ? ` - ${formatTime(fullEventDetails.end_time)}` : ''}
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Facility Section -->
				{#if fullEventDetails.facility_name || fullEventDetails.venue_name}
					<div class="card bg-base-200/50 mb-4">
						<div class="card-body p-4">
							<h4 class="font-semibold text-sm text-base-content/70 mb-3">Facility</h4>
							<div class="flex items-start gap-3">
								<svg class="w-5 h-5 text-accent mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
								</svg>
								<div>
									<div class="font-medium">{fullEventDetails.facility_name || fullEventDetails.venue_name}</div>
									{#if fullEventDetails.location_name}
										<div class="text-sm text-base-content/70 flex items-center gap-1 mt-1">
											<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
											</svg>
											<span>{fullEventDetails.location_name}</span>
											{#if fullEventDetails.location_object?.floor}
												<span class="text-base-content/50">({fullEventDetails.location_object.floor})</span>
											{/if}
										</div>
									{/if}
									{#if fullEventDetails.facility_object?.address || fullEventDetails.venue_object?.address}
										<div class="text-sm text-base-content/50 mt-1">
											{fullEventDetails.facility_object?.address || fullEventDetails.venue_object?.address}
										</div>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- Program Section -->
				{#if fullEventDetails.program_name || fullEventDetails.program_object}
					{@const program = fullEventDetails.program_object}
					<div class="card bg-base-200/50 mb-4">
						<div class="card-body p-4">
							<div class="flex items-center justify-between mb-3">
								<h4 class="font-semibold text-sm text-base-content/70">Program</h4>
								{#if fullEventDetails.program}
									<div class="flex gap-1">
										<a
											href="/programs?id={fullEventDetails.program}"
											class="btn btn-xs btn-ghost gap-1"
											title="Open program"
										>
											<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
											</svg>
											View
										</a>
										<a
											href="/programs?id={fullEventDetails.program}"
											target="_blank"
											rel="noopener noreferrer"
											class="btn btn-xs btn-ghost gap-1"
											title="Open program in new tab"
										>
											<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
											</svg>
										</a>
									</div>
								{/if}
							</div>
							<div class="flex items-start gap-3">
								<svg class="w-5 h-5 text-secondary mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
								</svg>
								<div class="flex-1">
									<div class="font-medium">{fullEventDetails.program_name || program?.title}</div>
									{#if program?.description}
										<p class="text-sm text-base-content/70 mt-1 line-clamp-2">{program.description}</p>
									{/if}
									<div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-base-content/60">
										{#if program?.geo_coverage}
											<span class="flex items-center gap-1">
												<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
												</svg>
												{program.geo_coverage}
											</span>
										{/if}
										{#if program?.programmer}
											<span class="flex items-center gap-1">
												<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
												</svg>
												{program.programmer}
											</span>
										{/if}
										{#if program?.start_date || program?.end_date}
											<span class="flex items-center gap-1">
												<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
												</svg>
												{#if program.start_date && program.end_date}
													{formatDateShort(program.start_date)} - {formatDateShort(program.end_date)}
												{:else if program.start_date}
													From {formatDateShort(program.start_date)}
												{:else if program.end_date}
													Until {formatDateShort(program.end_date)}
												{/if}
											</span>
										{/if}
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}

	
				<!-- Notes Section -->
				{@const notesText = typeof fullEventDetails.notes === 'string'
					? fullEventDetails.notes
					: fullEventDetails.notes?.description || ''}
				{#if notesText}
					<div class="card bg-base-200/50 mb-4">
						<div class="card-body p-4">
							<h4 class="font-semibold text-sm text-base-content/70 mb-3">Notes</h4>
							<p class="text-sm whitespace-pre-wrap">{notesText}</p>
						</div>
					</div>
				{/if}

				<!-- Assigned Artists Section -->
				{#if fullEventDetails.artist_assignments && fullEventDetails.artist_assignments.length > 0}
					<div class="card bg-base-200/50 mb-4">
						<div class="card-body p-4">
							<h4 class="font-semibold text-sm text-base-content/70 mb-3">
								Assigned Artists ({fullEventDetails.artist_assignments.length})
							</h4>
							<div class="space-y-3">
								{#each fullEventDetails.artist_assignments as artist, i}
									{@const artistData = fullEventDetails.artist_details?.[i] || enhancedLookup.getArtist(artist.artist_id)}
									<div class="bg-base-100 rounded-lg p-3">
										<div class="flex items-start gap-3">
											<!-- Profile Photo -->
											<div class="avatar flex-shrink-0">
												<div class="w-12 h-12 rounded-full">
													{#if artistData?.profile_photo}
														<img src={artistData.profile_photo} alt={artist.artist_name} class="object-cover" />
													{:else}
														<div class="bg-primary text-primary-content w-full h-full flex items-center justify-center">
															<span class="text-lg font-semibold">{getArtistInitials(artist.artist_name || 'A')}</span>
														</div>
													{/if}
												</div>
											</div>

											<!-- Artist Info -->
											<div class="flex-1 min-w-0">
												<div class="font-semibold">{artist.artist_name || 'Unknown Artist'}</div>
												{#if artist.role && artist.role !== 'performer'}
													<div class="text-xs text-base-content/60 capitalize">{artist.role}</div>
												{/if}

												<!-- Contact Actions -->
												{#if artistData?.phone || artistData?.email}
													<div class="flex flex-wrap gap-1 mt-2">
														{#if artistData.phone}
															<button
																class="btn btn-xs btn-ghost gap-1"
																onclick={() => copyToClipboard(artistData.phone!, 'Phone')}
															>
																<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
																</svg>
																Copy Phone
															</button>
														{/if}
														{#if artistData.email}
															<button
																class="btn btn-xs btn-ghost gap-1"
																onclick={() => copyToClipboard(artistData.email!, 'Email')}
															>
																<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
																</svg>
																Copy Email
															</button>
														{/if}
													</div>
												{/if}
											</div>
										</div>
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

				<!-- Quick Actions -->
				<div class="card bg-base-200/50 mb-4">
					<div class="card-body p-4">
						<h4 class="font-semibold text-sm text-base-content/70 mb-3">Quick Actions</h4>

						<!-- Status Transitions -->
						<div class="flex flex-wrap gap-2 mb-3">
							{#if fullEventDetails.status === 'planned'}
								<button
									class="btn btn-sm btn-success gap-1"
									onclick={() => updateEventStatus('confirmed')}
									disabled={updatingStatus}
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
									</svg>
									Confirm
								</button>
							{/if}
							{#if fullEventDetails.status === 'confirmed' && isEventUpcoming(fullEventDetails.date)}
								<button
									class="btn btn-sm btn-warning gap-1"
									onclick={() => updateEventStatus('in_progress')}
									disabled={updatingStatus}
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									Start
								</button>
							{/if}
							{#if fullEventDetails.status === 'in_progress'}
								<button
									class="btn btn-sm btn-info gap-1"
									onclick={() => updateEventStatus('completed')}
									disabled={updatingStatus}
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									Complete
								</button>
							{/if}
							{#if fullEventDetails.status !== 'cancelled' && fullEventDetails.status !== 'completed'}
								<button
									class="btn btn-sm btn-outline btn-error gap-1"
									onclick={() => updateEventStatus('cancelled')}
									disabled={updatingStatus}
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
									Cancel
								</button>
							{/if}
						</div>

						<!-- Communication Actions -->
						<div class="flex flex-wrap gap-2">
							{#if fullEventDetails.artist_details && fullEventDetails.artist_details.length > 0 && isEventUpcoming(fullEventDetails.date)}
								<button class="btn btn-sm btn-outline gap-1" onclick={sendReminder}>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
									</svg>
									Copy Emails
								</button>
							{/if}
							<button class="btn btn-sm btn-outline gap-1" onclick={shareEvent}>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
								</svg>
								Share Details
							</button>
						</div>
					</div>
				</div>

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

<!-- Toast Notification -->
{#if showToast}
	<div class="toast toast-top toast-center z-[60]">
		<div class="alert alert-success py-2 px-4">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
			</svg>
			<span class="text-sm">{toastMessage}</span>
		</div>
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
