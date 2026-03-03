<script lang="ts">
	interface Props {
		value?: string | null // HH:MM format (24-hour)
		disabled?: boolean
		placeholder?: string
		onchange?: (value: string | null) => void
		onfocus?: () => void
		class?: string
		error?: boolean
		defaultPeriod?: 'AM' | 'PM'
	}

	let {
		value = $bindable(),
		disabled = false,
		placeholder = 'Select time',
		onchange,
		onfocus,
		class: className = '',
		error = false,
		defaultPeriod = 'AM'
	}: Props = $props()

	// Convert 24-hour format (HH:MM) to 12-hour format
	function parse24Hour(time: string | null | undefined): { hour: number; minute: number; period: 'AM' | 'PM' } | null {
		if (!time || !time.includes(':')) return null
		
		const [hours, minutes] = time.split(':').map(Number)
		if (isNaN(hours) || isNaN(minutes)) return null

		let hour12 = hours % 12
		if (hour12 === 0) hour12 = 12
		const period = hours >= 12 ? 'PM' : 'AM'
		
		return { hour: hour12, minute: minutes, period }
	}

	// Convert 12-hour format to 24-hour format (HH:MM)
	function format24Hour(hour: number, minute: number, period: 'AM' | 'PM'): string {
		let hour24 = hour
		if (period === 'PM' && hour !== 12) {
			hour24 = hour + 12
		} else if (period === 'AM' && hour === 12) {
			hour24 = 0
		}
		return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
	}

	// Initialize from value prop
	let parsed = $state(parse24Hour(value))
	let selectedHour = $state(parsed?.hour || 12)
	let selectedMinute = $state(parsed?.minute || 0)
	let selectedPeriod = $state<'AM' | 'PM'>(parsed?.period || defaultPeriod)

	// Update when value prop changes externally
	$effect(() => {
		const newParsed = parse24Hour(value)
		if (newParsed) {
			selectedHour = newParsed.hour
			selectedMinute = newParsed.minute
			selectedPeriod = newParsed.period
		} else if (!value) {
			// Reset to default if value is cleared
			selectedHour = 12
			selectedMinute = 0
			selectedPeriod = defaultPeriod
		}
	})

	// Generate options
	const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1)
	const minuteOptions = Array.from({ length: 60 }, (_, i) => i)

	function handleChange() {
		const time24 = format24Hour(selectedHour, selectedMinute, selectedPeriod)
		value = time24
		onchange?.(time24)
	}

	function handleHourChange(e: Event) {
		selectedHour = Number((e.target as HTMLSelectElement).value)
		handleChange()
	}

	function handleMinuteChange(e: Event) {
		selectedMinute = Number((e.target as HTMLSelectElement).value)
		handleChange()
	}

	function handlePeriodChange(e: Event) {
		selectedPeriod = (e.target as HTMLSelectElement).value as 'AM' | 'PM'
		handleChange()
	}
</script>

<div class="flex gap-1 items-center min-w-0 {className}">
	<!-- Hour -->
	<select
		class="select select-bordered select-sm flex-1 min-w-0 {error ? 'select-error' : ''}"
		value={selectedHour}
		onchange={handleHourChange}
		{disabled}
		onfocus={onfocus}
		aria-label="Hour"
	>
		{#each hourOptions as hour}
			<option value={hour}>{hour}</option>
		{/each}
	</select>

	<span class="text-base-content/60 flex-shrink-0">:</span>

	<!-- Minute -->
	<select
		class="select select-bordered select-sm flex-1 min-w-0 {error ? 'select-error' : ''}"
		value={selectedMinute}
		onchange={handleMinuteChange}
		{disabled}
		onfocus={onfocus}
		aria-label="Minute"
	>
		{#each minuteOptions as minute}
			<option value={minute}>{String(minute).padStart(2, '0')}</option>
		{/each}
	</select>

	<!-- AM/PM -->
	<select
		class="select select-bordered select-sm w-16 flex-shrink-0 {error ? 'select-error' : ''}"
		value={selectedPeriod}
		onchange={handlePeriodChange}
		{disabled}
		onfocus={onfocus}
		aria-label="AM/PM"
	>
		<option value="AM">AM</option>
		<option value="PM">PM</option>
	</select>
</div>
