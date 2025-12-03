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
			'Enter a custom title or leave blank. The system will auto-generate one like "Artist Name @ Venue".',
		side: 'bottom'
	},
	{
		element: '[data-tour="venue-selector"]',
		title: 'Select a Venue',
		description:
			'Search and select where the event takes place. Start typing to filter by name, address, or city. This field is required.',
		side: 'bottom'
	},
	{
		element: '[data-tour="date-time"]',
		title: 'Schedule Your Event',
		description:
			'Set the date (required) and optionally specify start/end times. End time options adjust based on your start time.',
		side: 'top'
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
			'Click "Create Event" when ready. Your event will be saved with the selected artists and settings.',
		side: 'top'
	}
]

export function startCreateEventTour() {
	const tour = createTour(steps)
	tour.drive()
	return tour
}
