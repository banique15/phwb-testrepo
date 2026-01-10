import { createTour, type TourStep } from '$lib/utils/tour'

const steps: TourStep[] = [
	{
		element: '[data-tour="modal-header"]',
		title: 'Welcome to Event Creation',
		description:
			'This form helps you create new events for Sing for Hope. Let me walk you through each section.',
		side: 'bottom'
	},
	{
		element: '[data-tour="event-title"]',
		title: 'Event Title (Optional)',
		description:
			'Enter a custom title or leave blank. The system will auto-generate one like "Artist Name @ Location".',
		side: 'bottom'
	},
	{
		element: '[data-tour="program-selector"]',
		title: 'Select a Program',
		description:
			'Choose the program this event belongs to. This field is required to create an event.',
		side: 'bottom'
	},
	{
		element: '[data-tour="location-selector"]',
		title: 'Select a Location',
		description:
			'Search and select where the event takes place. Use the + buttons to quickly create a new location or facility if needed. This field is required.',
		side: 'bottom'
	},
	{
		element: '[data-tour="date-time"]',
		title: 'Schedule Your Event',
		description:
			'Set the date (required) and optionally specify start/end times. You can select any specific time - the end time must be after the start time.',
		side: 'top'
	},
	{
		element: '[data-tour="status-selector"]',
		title: 'Event Status',
		description:
			'Set the initial status of your event. You can change this later if needed.',
		side: 'bottom'
	},
	{
		element: '[data-tour="manual-assignment"]',
		title: 'Manual Artist Assignment',
		description:
			'Select this to hand-pick artists from your roster. Use search to filter, then check the artists you want.',
		side: 'right'
	},
	{
		element: '[data-tour="ai-assignment"]',
		title: 'AI Auto-Match',
		description:
			'Let AI suggest artists based on instrument, genre, and ensemble size preferences. Great for finding the right fit!',
		side: 'left'
	},
	{
		element: '[data-tour="form-actions"]',
		title: 'Create Your Event',
		description:
			'Click "Create Event" when ready. Your event will be saved with the selected artists and settings. You can also save as a draft to complete later.',
		side: 'top'
	}
]

export function startCreateEventTour() {
	const tour = createTour(steps)
	tour.drive()
	return tour
}
