import { writable } from 'svelte/store'

export interface Toast {
	id: string
	message: string
	type: 'success' | 'error' | 'warning' | 'info'
	timeout?: number
}

interface ToastStore {
	toasts: Toast[]
}

export const toastStore = writable<ToastStore>({
	toasts: []
})

export const toast = {
	success: (message: string, timeout: number = 5000) => {
		addToast({ message, type: 'success', timeout })
	},
	error: (message: string, timeout: number = 8000) => {
		addToast({ message, type: 'error', timeout })
	},
	warning: (message: string, timeout: number = 6000) => {
		addToast({ message, type: 'warning', timeout })
	},
	info: (message: string, timeout: number = 5000) => {
		addToast({ message, type: 'info', timeout })
	}
}

function addToast(toastData: Omit<Toast, 'id'>) {
	const id = Math.random().toString(36).substr(2, 9)
	const newToast: Toast = {
		id,
		...toastData
	}

	toastStore.update(state => ({
		toasts: [...state.toasts, newToast]
	}))

	// Auto-remove after timeout
	if (newToast.timeout && newToast.timeout > 0) {
		setTimeout(() => {
			removeToast(id)
		}, newToast.timeout)
	}
}

export function removeToast(id: string) {
	toastStore.update(state => ({
		toasts: state.toasts.filter(toast => toast.id !== id)
	}))
}