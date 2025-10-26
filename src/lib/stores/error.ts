import { writable } from 'svelte/store'

export interface AppError {
	id: string
	message: string
	type: 'error' | 'warning' | 'info'
	timestamp: number
	details?: any
}

export const errors = writable<AppError[]>([])

let errorId = 0

export const errorStore = {
	subscribe: errors.subscribe,
	
	add(message: string, type: AppError['type'] = 'error', details?: any) {
		const error: AppError = {
			id: `error-${++errorId}`,
			message,
			type,
			timestamp: Date.now(),
			details
		}
		
		errors.update(current => [...current, error])
		
		// Auto-remove after 5 seconds for non-error types
		if (type !== 'error') {
			setTimeout(() => {
				this.remove(error.id)
			}, 5000)
		}
		
		return error.id
	},
	
	remove(id: string) {
		errors.update(current => current.filter(error => error.id !== id))
	},
	
	clear() {
		errors.set([])
	},
	
	handleError(error: any, context?: string) {
		console.error(context ? `${context}:` : 'Error:', error)
		
		let message = 'An unexpected error occurred'
		
		if (error?.message) {
			message = error.message
		} else if (typeof error === 'string') {
			message = error
		} else if (error?.error?.message) {
			message = error.error.message
		}
		
		return this.add(message, 'error', error)
	}
}