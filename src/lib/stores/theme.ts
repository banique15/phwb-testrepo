import { browser } from '$app/environment'

// Single theme configuration for Sing for Hope
const SFH_THEME = 'sfh'

// Initialize theme on app load
if (browser) {
	// Clear any old theme data from localStorage
	localStorage.removeItem('phwb-theme')
	
	// Force apply the sfh theme
	document.documentElement.setAttribute('data-theme', SFH_THEME)
	
	// Also remove any old theme classes that might be lingering
	document.documentElement.className = document.documentElement.className
		.split(' ')
		.filter(cls => !cls.includes('theme-') && !cls.includes('dark') && !cls.includes('light'))
		.join(' ')
}