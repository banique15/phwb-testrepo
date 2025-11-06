import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// MOCK DATA FOR DEMO PURPOSES
	// This showcases what the partner portal will look like with real data

	const partner = {
		id: 1,
		name: 'Lincoln Center',
		organization: 'Lincoln Center for the Performing Arts',
		description:
			'A world-renowned performing arts complex in New York City, home to the Metropolitan Opera, New York Philharmonic, and many other prestigious arts organizations.',
		website: 'https://www.lincolncenter.org',
		logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Lincoln_Center_logo.svg/1200px-Lincoln_Center_logo.svg.png',
		contacts: [
			{
				name: 'Sarah Johnson',
				title: 'Director of Community Programs',
				email: 'sjohnson@lincolncenter.org',
				phone: '(212) 875-5000',
				isPrimary: true
			}
		],
		created_at: '2024-01-15T10:00:00Z'
	};

	const programs = [
		{ id: 1, title: 'Community Concerts Series' },
		{ id: 2, title: 'Youth Education Program' },
		{ id: 3, title: 'Summer Festival Events' }
	];

	// Generate realistic event dates
	const today = new Date();
	const getDate = (daysOffset: number) => {
		const date = new Date(today);
		date.setDate(date.getDate() + daysOffset);
		return date.toISOString().split('T')[0];
	};

	const allEvents = [
		// Upcoming Events
		{
			id: 1,
			title: 'Spring Gala Concert',
			date: getDate(7),
			start_time: '19:00',
			end_time: '21:30',
			status: 'confirmed',
			program: 1,
			location_id: 1,
			phwb_programs: { id: 1, title: 'Community Concerts Series' },
			phwb_locations: {
				id: 1,
				name: 'Josie Robertson Plaza',
				address: '10 Lincoln Center Plaza, New York, NY 10023'
			}
		},
		{
			id: 2,
			title: 'Youth Orchestra Performance',
			date: getDate(14),
			start_time: '15:00',
			end_time: '17:00',
			status: 'confirmed',
			program: 2,
			location_id: 2,
			phwb_programs: { id: 2, title: 'Youth Education Program' },
			phwb_locations: {
				id: 2,
				name: 'David Geffen Hall',
				address: '10 Lincoln Center Plaza, New York, NY 10023'
			}
		},
		{
			id: 3,
			title: 'Jazz Under the Stars',
			date: getDate(21),
			start_time: '20:00',
			end_time: '22:00',
			status: 'confirmed',
			program: 3,
			location_id: 1,
			phwb_programs: { id: 3, title: 'Summer Festival Events' },
			phwb_locations: {
				id: 1,
				name: 'Josie Robertson Plaza',
				address: '10 Lincoln Center Plaza, New York, NY 10023'
			}
		},
		{
			id: 4,
			title: 'Children\'s Choir Workshop',
			date: getDate(28),
			start_time: '10:00',
			end_time: '12:00',
			status: 'pending',
			program: 2,
			location_id: 3,
			phwb_programs: { id: 2, title: 'Youth Education Program' },
			phwb_locations: {
				id: 3,
				name: 'The Juilliard School',
				address: '60 Lincoln Center Plaza, New York, NY 10023'
			}
		},
		{
			id: 5,
			title: 'Broadway Showcase',
			date: getDate(35),
			start_time: '18:30',
			end_time: '20:30',
			status: 'confirmed',
			program: 1,
			location_id: 2,
			phwb_programs: { id: 1, title: 'Community Concerts Series' },
			phwb_locations: {
				id: 2,
				name: 'David Geffen Hall',
				address: '10 Lincoln Center Plaza, New York, NY 10023'
			}
		},
		{
			id: 6,
			title: 'Summer Solstice Celebration',
			date: getDate(45),
			start_time: '17:00',
			end_time: '21:00',
			status: 'confirmed',
			program: 3,
			location_id: 1,
			phwb_programs: { id: 3, title: 'Summer Festival Events' },
			phwb_locations: {
				id: 1,
				name: 'Josie Robertson Plaza',
				address: '10 Lincoln Center Plaza, New York, NY 10023'
			}
		},
		// Past Events
		{
			id: 7,
			title: 'Winter Holiday Concert',
			date: getDate(-30),
			start_time: '19:00',
			end_time: '21:00',
			status: 'confirmed',
			program: 1,
			location_id: 2,
			phwb_programs: { id: 1, title: 'Community Concerts Series' },
			phwb_locations: {
				id: 2,
				name: 'David Geffen Hall',
				address: '10 Lincoln Center Plaza, New York, NY 10023'
			}
		},
		{
			id: 8,
			title: 'New Year\'s Eve Gala',
			date: getDate(-60),
			start_time: '20:00',
			end_time: '23:59',
			status: 'confirmed',
			program: 1,
			location_id: 1,
			phwb_programs: { id: 1, title: 'Community Concerts Series' },
			phwb_locations: {
				id: 1,
				name: 'Josie Robertson Plaza',
				address: '10 Lincoln Center Plaza, New York, NY 10023'
			}
		},
		{
			id: 9,
			title: 'Fall Music Workshop',
			date: getDate(-90),
			start_time: '14:00',
			end_time: '16:00',
			status: 'confirmed',
			program: 2,
			location_id: 3,
			phwb_programs: { id: 2, title: 'Youth Education Program' },
			phwb_locations: {
				id: 3,
				name: 'The Juilliard School',
				address: '60 Lincoln Center Plaza, New York, NY 10023'
			}
		},
		{
			id: 10,
			title: 'Thanksgiving Community Concert',
			date: getDate(-120),
			start_time: '18:00',
			end_time: '20:00',
			status: 'confirmed',
			program: 1,
			location_id: 2,
			phwb_programs: { id: 1, title: 'Community Concerts Series' },
			phwb_locations: {
				id: 2,
				name: 'David Geffen Hall',
				address: '10 Lincoln Center Plaza, New York, NY 10023'
			}
		},
		{
			id: 11,
			title: 'Piano Recital Series - Session 1',
			date: getDate(-150),
			start_time: '19:30',
			end_time: '21:00',
			status: 'confirmed',
			program: 2,
			location_id: 3,
			phwb_programs: { id: 2, title: 'Youth Education Program' },
			phwb_locations: {
				id: 3,
				name: 'The Juilliard School',
				address: '60 Lincoln Center Plaza, New York, NY 10023'
			}
		}
	];

	// Split events into upcoming and past
	const todayStr = new Date().toISOString().split('T')[0];
	const upcomingEvents = allEvents.filter((e) => e.date >= todayStr);
	const pastEvents = allEvents.filter((e) => e.date < todayStr);

	// Calculate statistics
	const stats = {
		totalEvents: allEvents.length,
		upcomingEvents: upcomingEvents.length,
		pastEvents: pastEvents.length,
		totalPrograms: programs.length
	};

	return {
		partner,
		programs,
		upcomingEvents: upcomingEvents.slice(0, 10), // Limit to next 10
		pastEvents: pastEvents.slice(0, 5), // Limit to last 5
		stats
	};
};
