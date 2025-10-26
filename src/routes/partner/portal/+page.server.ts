import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	// For mockup: Using a demo partner ID
	// In production, this would come from the authenticated user's partner association
	const demoPartnerId = 1; // TODO: Replace with actual partner ID from user session

	try {
		// Fetch partner details
		const { data: partner, error: partnerError } = await supabase
			.from('phwb_partners')
			.select('*')
			.eq('id', demoPartnerId)
			.single();

		if (partnerError) throw partnerError;
		if (!partner) throw error(404, 'Partner not found');

		// Fetch programs associated with this partner
		const { data: programs, error: programsError } = await supabase
			.from('phwb_programs')
			.select('id, title')
			.eq('partner', demoPartnerId);

		if (programsError) throw programsError;

		const programIds = programs?.map((p) => p.id) || [];

		// Fetch events associated with partner's programs
		let allEvents: any[] = [];
		if (programIds.length > 0) {
			const { data: events, error: eventsError } = await supabase
				.from('phwb_events')
				.select(
					`
					*,
					phwb_programs!phwb_events_program_fkey (
						id,
						title
					),
					phwb_locations (
						id,
						name,
						address
					)
				`
				)
				.in('program', programIds)
				.order('date', { ascending: false });

			if (eventsError) throw eventsError;
			allEvents = events || [];
		}

		// Split events into upcoming and past
		const today = new Date().toISOString().split('T')[0];
		const upcomingEvents = allEvents.filter((e) => e.date >= today);
		const pastEvents = allEvents.filter((e) => e.date < today);

		// Calculate statistics
		const stats = {
			totalEvents: allEvents.length,
			upcomingEvents: upcomingEvents.length,
			pastEvents: pastEvents.length,
			totalPrograms: programs?.length || 0
		};

		return {
			partner,
			programs: programs || [],
			upcomingEvents: upcomingEvents.slice(0, 10), // Limit to next 10
			pastEvents: pastEvents.slice(0, 5), // Limit to last 5
			stats
		};
	} catch (err) {
		console.error('Error loading partner portal data:', err);
		throw error(500, 'Failed to load partner portal data');
	}
};
