export interface HelpSection {
	id: string
	title: string
	content: string
	icon?: string
}

export const artistsHelpContent: HelpSection[] = [
	{
		id: 'overview',
		title: 'Artists Overview',
		icon: '🎨',
		content: `
			<p>The Artists page helps you manage all artist profiles and information in your PHWB system. Here you can:</p>
			<ul>
				<li>View all registered artists (currently 115 total)</li>
				<li>Search and filter through artist profiles</li>
				<li>View detailed artist information including personal, professional, and contact details</li>
				<li>Add new artists to the system</li>
				<li>Edit existing artist profiles</li>
			</ul>
		`
	},
	{
		id: 'navigation',
		title: 'Page Navigation',
		icon: '🧭',
		content: `
			<p>This page uses a master-detail layout for efficient artist management:</p>
			<ul>
				<li><strong>Left Panel:</strong> List of all artists with search and pagination</li>
				<li><strong>Right Panel:</strong> Detailed view of selected artist</li>
				<li><strong>Search Bar:</strong> Type to filter artists by name, email, or other details</li>
				<li><strong>Pagination:</strong> Navigate through artist lists (10 per page)</li>
			</ul>
			<p>Select any artist from the left list to view their full profile on the right.</p>
		`
	},
	{
		id: 'searching',
		title: 'Searching & Filtering',
		icon: '🔍',
		content: `
			<p>Use the search functionality to quickly find specific artists:</p>
			<ul>
				<li><strong>Real-time Search:</strong> Results update as you type</li>
				<li><strong>Search Fields:</strong> Name, email, artist name, location</li>
				<li><strong>Clear Search:</strong> Delete search text to see all artists</li>
			</ul>
			<p><strong>Search Tips:</strong></p>
			<ul>
				<li>Search by first name, last name, or full name</li>
				<li>Use email addresses for exact matches</li>
				<li>Search by location or metropolitan hub</li>
				<li>Artist stage names are also searchable</li>
			</ul>
		`
	},
	{
		id: 'artist-details',
		title: 'Artist Profile Information',
		icon: '👤',
		content: `
			<p>Each artist profile contains comprehensive information organized into sections:</p>
			
			<h4>Personal Information</h4>
			<ul>
				<li><strong>Full Name & Legal Name:</strong> Official and preferred names</li>
				<li><strong>Contact Details:</strong> Email, phone, address, location</li>
				<li><strong>Date of Birth:</strong> For age verification and records</li>
			</ul>

			<h4>Professional Information</h4>
			<ul>
				<li><strong>Employment Status:</strong> Current work status</li>
				<li><strong>Metropolitan Hub:</strong> Primary working area</li>
				<li><strong>Genres:</strong> Musical styles and specializations</li>
				<li><strong>Instruments:</strong> Primary and secondary instruments</li>
				<li><strong>Languages:</strong> Spoken and performance languages</li>
				<li><strong>Skills:</strong> Sight reading, soloist capabilities</li>
			</ul>

			<h4>Biography & Marketing</h4>
			<ul>
				<li><strong>One Sentence Bio:</strong> Quick professional summary</li>
				<li><strong>Full Bio:</strong> Detailed artist background</li>
				<li><strong>Social Links:</strong> Website, Instagram, Facebook</li>
			</ul>
		`
	},
	{
		id: 'adding-editing',
		title: 'Adding & Editing Artists',
		icon: '✏️',
		content: `
			<h4>Adding New Artists</h4>
			<p>Click the <strong>"Add Artist"</strong> button in the page header to create a new artist profile.</p>
			<ul>
				<li>Fill out required fields (name, email)</li>
				<li>Add optional professional information</li>
				<li>Include biography and social links</li>
				<li>Save to add to the artist database</li>
			</ul>

			<h4>Editing Existing Artists</h4>
			<p>Select an artist and click the <strong>"Edit"</strong> button to modify their profile:</p>
			<ul>
				<li>Update contact information</li>
				<li>Modify professional skills and genres</li>
				<li>Edit biography and social links</li>
				<li>Changes are saved automatically</li>
			</ul>

			<p><strong>Important:</strong> Always verify artist information before saving to maintain data accuracy.</p>
		`
	},
	{
		id: 'keyboard-shortcuts',
		title: 'Keyboard Shortcuts',
		icon: '⌨️',
		content: `
			<p>Use these keyboard shortcuts for faster navigation:</p>
			<ul>
				<li><kbd>Ctrl + ?</kbd> - Open/close this help panel</li>
				<li><kbd>Esc</kbd> - Close help panel or cancel current action</li>
				<li><kbd>/</kbd> - Focus search box</li>
				<li><kbd>↑/↓</kbd> - Navigate through artist list</li>
				<li><kbd>Enter</kbd> - Select highlighted artist</li>
				<li><kbd>Ctrl + N</kbd> - Add new artist (when implemented)</li>
			</ul>
		`
	},
	{
		id: 'best-practices',
		title: 'Best Practices',
		icon: '⭐',
		content: `
			<h4>Data Management Tips</h4>
			<ul>
				<li><strong>Consistent Naming:</strong> Use standard formats for names and locations</li>
				<li><strong>Complete Profiles:</strong> Fill out as much information as possible</li>
				<li><strong>Regular Updates:</strong> Keep contact information current</li>
				<li><strong>Professional Photos:</strong> Use high-quality headshots when available</li>
			</ul>

			<h4>Search Optimization</h4>
			<ul>
				<li>Include common name variations and nicknames</li>
				<li>Add multiple genres if artists are versatile</li>
				<li>Include all instruments, even secondary ones</li>
				<li>Use consistent location naming (city, state format)</li>
			</ul>

			<h4>Privacy & Security</h4>
			<ul>
				<li>Only store necessary personal information</li>
				<li>Verify consent for public information use</li>
				<li>Keep sensitive data (SSN, banking) in separate systems</li>
				<li>Regularly audit and clean up inactive profiles</li>
			</ul>
		`
	}
]

export const dashboardHelpContent: HelpSection[] = [
	{
		id: 'overview',
		title: 'Dashboard Overview',
		icon: '🏠',
		content: `
			<p>Your PHWB Admin dashboard provides a comprehensive overview of your organization's key metrics and quick access to important functions.</p>
		`
	}
	// Add more dashboard-specific content as needed
]