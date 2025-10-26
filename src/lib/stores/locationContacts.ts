import { createBaseStore } from './base'
import { locationContactSchema, type LocationContact, type CreateLocationContact, type UpdateLocationContact, type LocationContactWithLocation } from '$lib/schemas/locationContact'
import { supabase } from '$lib/supabase'

export const locationContactsStore = createBaseStore<LocationContact, CreateLocationContact, UpdateLocationContact>({
	tableName: 'phwb_location_contacts',
	schema: locationContactSchema,
	searchFields: ['name', 'title', 'role', 'email', 'phone'],
	defaultSortBy: 'name',
	defaultSortOrder: 'asc'
})

// Helper function to get contacts for a specific location
export async function getContactsByLocation(locationId: number): Promise<LocationContact[]> {
	const { data, error } = await supabase
		.from('phwb_location_contacts')
		.select('*')
		.eq('location_id', locationId)
		.eq('active', true)
		.order('primary_contact', { ascending: false })
		.order('name', { ascending: true })

	if (error) {
		console.error('Error fetching location contacts:', error)
		throw new Error(`Failed to fetch location contacts: ${error.message}`)
	}

	return data as LocationContact[]
}

// Helper function to get the primary contact for a location
export async function getPrimaryContactForLocation(locationId: number): Promise<LocationContact | null> {
	const { data, error } = await supabase
		.from('phwb_location_contacts')
		.select('*')
		.eq('location_id', locationId)
		.eq('primary_contact', true)
		.eq('active', true)
		.single()

	if (error) {
		if (error.code === 'PGRST116') {
			// No primary contact found
			return null
		}
		console.error('Error fetching primary contact:', error)
		throw new Error(`Failed to fetch primary contact: ${error.message}`)
	}

	return data as LocationContact
}

// Helper function to get contacts with location details
export async function getContactsWithLocationDetails(facilityId?: number): Promise<LocationContactWithLocation[]> {
	let query = supabase
		.from('phwb_location_contacts')
		.select(`
			*,
			location:phwb_locations(id, name, facility_id, floor)
		`)
		.eq('active', true)

	if (facilityId) {
		// Filter by facility through location join
		query = query.eq('location.facility_id', facilityId)
	}

	const { data, error } = await query
		.order('name', { ascending: true })

	if (error) {
		console.error('Error fetching contacts with location details:', error)
		throw new Error(`Failed to fetch contacts: ${error.message}`)
	}

	return data as LocationContactWithLocation[]
}

// Helper function to set primary contact (ensures only one primary per location)
export async function setPrimaryContact(contactId: number, locationId: number): Promise<void> {
	// Start a transaction-like operation
	// First, unset all primary contacts for this location
	const { error: unsetError } = await supabase
		.from('phwb_location_contacts')
		.update({ primary_contact: false })
		.eq('location_id', locationId)

	if (unsetError) {
		console.error('Error unsetting primary contacts:', unsetError)
		throw new Error(`Failed to update primary contact: ${unsetError.message}`)
	}

	// Then set the new primary contact
	const { error: setError } = await supabase
		.from('phwb_location_contacts')
		.update({ primary_contact: true })
		.eq('id', contactId)

	if (setError) {
		console.error('Error setting primary contact:', setError)
		throw new Error(`Failed to set primary contact: ${setError.message}`)
	}
}

// Helper function to assign contacts to an event
export async function assignContactToEvent(eventId: number, contactId: number, isPrimary: boolean = false, notes?: string): Promise<void> {
	const { error } = await supabase
		.from('phwb_event_location_contacts')
		.insert({
			event_id: eventId,
			location_contact_id: contactId,
			is_primary_for_event: isPrimary,
			notes: notes
		})

	if (error) {
		console.error('Error assigning contact to event:', error)
		throw new Error(`Failed to assign contact to event: ${error.message}`)
	}
}

// Helper function to remove contact assignment from an event
export async function removeContactFromEvent(eventId: number, contactId: number): Promise<void> {
	const { error } = await supabase
		.from('phwb_event_location_contacts')
		.delete()
		.eq('event_id', eventId)
		.eq('location_contact_id', contactId)

	if (error) {
		console.error('Error removing contact from event:', error)
		throw new Error(`Failed to remove contact from event: ${error.message}`)
	}
}

// Helper function to get contacts assigned to an event
export async function getEventContacts(eventId: number): Promise<LocationContact[]> {
	const { data, error } = await supabase
		.from('phwb_event_location_contacts')
		.select(`
			*,
			contact:phwb_location_contacts(*)
		`)
		.eq('event_id', eventId)
		.order('is_primary_for_event', { ascending: false })

	if (error) {
		console.error('Error fetching event contacts:', error)
		throw new Error(`Failed to fetch event contacts: ${error.message}`)
	}

	return data.map((item: any) => item.contact) as LocationContact[]
}
