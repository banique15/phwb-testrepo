<script lang="ts">
	import type { Facility } from '$lib/schemas/facility'
	import type { Location } from '$lib/schemas/location'
	import InlineEditableField from '$lib/components/ui/InlineEditableField.svelte'
	import { facilitiesStore } from '$lib/stores/facilities'
	import { locationsStore } from '$lib/stores/locations'

	interface Props {
		facility: Facility
		locations: Location[]
		selectedLocationId: number | null
	}

	let { facility, locations, selectedLocationId }: Props = $props()

	let facilityContacts = $derived(() => {
		if (!facility.contacts || typeof facility.contacts !== 'object') return []
		return Object.entries(facility.contacts).map(([key, value]) => ({ key, value: String(value) }))
	})

	let locationContacts = $derived(() => {
		if (selectedLocationId === null) return []
		const location = locations.find(l => l.id === selectedLocationId)
		if (!location) return []
		// Check if contacts field exists (it may not be in the type yet)
		const contacts = (location as any).contacts
		if (!contacts || typeof contacts !== 'object') return []
		return Object.entries(contacts).map(([key, value]) => ({ key, value: String(value) }))
	})

	async function updateFacilityContact(contactKey: string, contactValue: string) {
		if (!facility.id) return

		const contacts = facility.contacts && typeof facility.contacts === 'object' 
			? { ...facility.contacts } 
			: {}

		if (contactValue.trim() === '') {
			delete contacts[contactKey]
		} else {
			contacts[contactKey] = contactValue.trim()
		}

		const updateData = Object.keys(contacts).length > 0 ? { contacts } : { contacts: null }
		await facilitiesStore.update(facility.id, updateData)
		// Note: Facility prop will update via parent component reactivity
	}

	async function addFacilityContact() {
		if (!facility.id) return

		const contacts = facility.contacts && typeof facility.contacts === 'object' 
			? { ...facility.contacts } 
			: {}

		const newKey = `contact_${Date.now()}`
		contacts[newKey] = ''

		await facilitiesStore.update(facility.id, { contacts })
	}

	async function removeFacilityContact(contactKey: string) {
		if (!facility.id) return

		const contacts = facility.contacts && typeof facility.contacts === 'object' 
			? { ...facility.contacts } 
			: {}

		delete contacts[contactKey]

		const updateData = Object.keys(contacts).length > 0 ? { contacts } : { contacts: null }
		await facilitiesStore.update(facility.id, updateData)
	}

	async function updateLocationContact(contactKey: string, contactValue: string) {
		if (!selectedLocationId) return

		const location = locations.find(l => l.id === selectedLocationId)
		if (!location) return

		const contacts = (location as any).contacts && typeof (location as any).contacts === 'object' 
			? { ...(location as any).contacts } 
			: {}

		if (contactValue.trim() === '') {
			delete contacts[contactKey]
		} else {
			contacts[contactKey] = contactValue.trim()
		}

		const updateData = Object.keys(contacts).length > 0 ? { contacts } : { contacts: null }
		await locationsStore.update(selectedLocationId, updateData)
		// Note: Locations prop will update via parent component reactivity
	}

	async function addLocationContact() {
		if (!selectedLocationId) return

		const location = locations.find(l => l.id === selectedLocationId)
		if (!location) return

		const contacts = (location as any).contacts && typeof (location as any).contacts === 'object' 
			? { ...(location as any).contacts } 
			: {}

		const newKey = `contact_${Date.now()}`
		contacts[newKey] = ''

		await locationsStore.update(selectedLocationId, { contacts })
	}

	async function removeLocationContact(contactKey: string) {
		if (!selectedLocationId) return

		const location = locations.find(l => l.id === selectedLocationId)
		if (!location) return

		const contacts = (location as any).contacts && typeof (location as any).contacts === 'object' 
			? { ...(location as any).contacts } 
			: {}

		delete contacts[contactKey]

		const updateData = Object.keys(contacts).length > 0 ? { contacts } : { contacts: null }
		await locationsStore.update(selectedLocationId, updateData)
	}
</script>

<div class="space-y-4">
	<!-- Facility Contacts -->
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold">Facility Contacts</h3>
			<button
				class="btn btn-xs btn-outline"
				onclick={addFacilityContact}
				title="Add contact"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				Add
			</button>
		</div>
		{#if facilityContacts.length > 0}
			<div class="space-y-2">
				{#each facilityContacts as contact}
					<div class="flex items-start gap-2 p-2 bg-base-200 rounded-lg">
						<div class="flex-1 space-y-1">
							<InlineEditableField
								value={contact.key}
								field="facility_contact_key_{contact.key}"
								type="text"
								placeholder="Contact type (e.g., phone, email)"
								label=""
								onSave={async (value) => {
									if (value !== contact.key && facility.id) {
										const contacts = facility.contacts && typeof facility.contacts === 'object' 
											? { ...facility.contacts } 
											: {}
										const oldValue = contacts[contact.key]
										delete contacts[contact.key]
										if (value && value.trim()) {
											contacts[value.trim()] = oldValue
										}
										const updateData = Object.keys(contacts).length > 0 ? { contacts } : { contacts: null }
										await facilitiesStore.update(facility.id, updateData)
									}
								}}
							/>
							<InlineEditableField
								value={contact.value}
								field="facility_contact_value_{contact.key}"
								type="text"
								placeholder="Contact value"
								label=""
								onSave={(value) => updateFacilityContact(contact.key, value)}
							/>
						</div>
						<button
							class="btn btn-xs btn-ghost text-error"
							onclick={() => removeFacilityContact(contact.key)}
							title="Remove contact"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-base opacity-70 text-center py-2">No facility contacts. Click "Add" to create one.</p>
		{/if}
	</div>

	<!-- Location Contacts (only shown when location is selected) -->
	{#if selectedLocationId !== null}
		<div class="space-y-3 border-t border-base-300 pt-4">
			<div class="flex items-center justify-between">
				<h3 class="text-lg font-semibold">Location Contacts</h3>
				<button
					class="btn btn-xs btn-outline"
					onclick={addLocationContact}
					title="Add contact"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
					Add
				</button>
			</div>
			{#if locationContacts.length > 0}
				<div class="space-y-2">
					{#each locationContacts as contact}
						<div class="flex items-start gap-2 p-2 bg-base-200 rounded-lg">
							<div class="flex-1 space-y-1">
								<InlineEditableField
									value={contact.key}
									field="location_contact_key_{contact.key}"
									type="text"
									placeholder="Contact type (e.g., phone, email)"
									label=""
									onSave={async (value) => {
										if (value !== contact.key && selectedLocationId) {
											const location = locations.find(l => l.id === selectedLocationId)
											if (!location) return
											const contacts = (location as any).contacts && typeof (location as any).contacts === 'object' 
												? { ...(location as any).contacts } 
												: {}
											const oldValue = contacts[contact.key]
											delete contacts[contact.key]
											if (value && value.trim()) {
												contacts[value.trim()] = oldValue
											}
											const updateData = Object.keys(contacts).length > 0 ? { contacts } : { contacts: null }
											await locationsStore.update(selectedLocationId, updateData)
										}
									}}
								/>
								<InlineEditableField
									value={contact.value}
									field="location_contact_value_{contact.key}"
									type="text"
									placeholder="Contact value"
									label=""
									onSave={(value) => updateLocationContact(contact.key, value)}
								/>
							</div>
							<button
								class="btn btn-xs btn-ghost text-error"
								onclick={() => removeLocationContact(contact.key)}
								title="Remove contact"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-base opacity-70 text-center py-2">No location contacts. Click "Add" to create one.</p>
			{/if}
		</div>
	{/if}
</div>

