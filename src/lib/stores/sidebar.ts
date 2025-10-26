import { writable } from 'svelte/store'

interface SidebarState {
	isCollapsed: boolean
	forceCollapse: boolean // For programmatic control (e.g., when payroll edit opens)
}

const initialState: SidebarState = {
	isCollapsed: false,
	forceCollapse: false
}

export const sidebarState = writable<SidebarState>(initialState)

export const sidebarStore = {
	subscribe: sidebarState.subscribe,
	
	// Collapse sidebar (e.g., when payroll edit opens)
	collapse() {
		sidebarState.update(state => ({ ...state, forceCollapse: true }))
	},
	
	// Expand sidebar (e.g., when payroll edit closes)
	expand() {
		sidebarState.update(state => ({ ...state, forceCollapse: false }))
	},
	
	// Toggle sidebar state
	toggle() {
		sidebarState.update(state => ({ ...state, isCollapsed: !state.isCollapsed }))
	},
	
	// Set collapsed state
	setCollapsed(collapsed: boolean) {
		sidebarState.update(state => ({ ...state, isCollapsed: collapsed }))
	}
}