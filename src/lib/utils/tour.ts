import { driver, type Config, type DriveStep } from 'driver.js'

export interface TourStep {
	element: string
	title: string
	description: string
	side?: 'top' | 'bottom' | 'left' | 'right'
	align?: 'start' | 'center' | 'end'
}

export function createTour(steps: TourStep[], options?: Partial<Config>) {
	const driverSteps: DriveStep[] = steps.map((step) => ({
		element: step.element,
		popover: {
			title: step.title,
			description: step.description,
			side: step.side || 'bottom',
			align: step.align || 'center'
		}
	}))

	return driver({
		animate: true,
		smoothScroll: true,
		overlayColor: 'rgba(0, 0, 0, 0.75)',
		stagePadding: 10,
		stageRadius: 8,
		allowClose: true,
		showProgress: true,
		progressText: '{{current}} of {{total}}',
		popoverClass: 'sfh-tour-popover',
		nextBtnText: 'Next',
		prevBtnText: 'Back',
		doneBtnText: 'Done',
		...options,
		steps: driverSteps
	})
}
