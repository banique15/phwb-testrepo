<script lang="ts">
	import type { Partner, ContactPerson } from '$lib/schemas/partner'
	import type { ComponentType, SvelteComponent } from 'svelte'
	import { Phone, ScrollText, Settings, Plus, Pencil, Trash, X, Check, Building } from 'lucide-svelte'
	import { partnersStore } from '$lib/stores/partners'
	import { contactPersonSchema } from '$lib/schemas/partner'
	import { z } from 'zod'
	import { supabase } from '$lib/supabase'
	import type { Facility } from '$lib/schemas/facility'
	import { goto } from '$app/navigation'

	interface Props {
		partner: Partner
		onDelete: () => void
		onUpdate?: (updatedPartner: Partner) => void
	}

	let { partner, onDelete, onUpdate }: Props = $props()

	const tabs: Array<{ id: string; label: string; icon: ComponentType<SvelteComponent> }> = [
		{ id: 'contacts', label: 'Contacts', icon: Phone },
		{ id: 'facilities', label: 'Facilities', icon: Building },
		{ id: 'history', label: 'History', icon: ScrollText },
		{ id: 'settings', label: 'Settings', icon: Settings }
	]

	let activeTab = $state<string>('contacts')

	function setActiveTab(tabId: string) {
		activeTab = tabId
		if (typeof window !== 'undefined') {
			localStorage.setItem('phwb-partner-active-tab', tabId)
		}
	}

	// Initialize from localStorage on mount
	$effect(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('phwb-partner-active-tab')
			if (saved && ['contacts', 'facilities', 'history', 'settings'].includes(saved)) {
				activeTab = saved
			}
		}
	})

	// Facilities state
	let facilities = $state<Facility[]>([])
	let isLoadingFacilities = $state(false)
	let facilitiesError = $state<string | null>(null)

	// Load facilities when facilities tab is active
	$effect(() => {
		if (activeTab === 'facilities' && partner?.id) {
			loadFacilities()
		}
	})

	async function loadFacilities() {
		if (!partner?.id) return
		
		isLoadingFacilities = true
		facilitiesError = null
		
		try {
			const { data, error } = await supabase
				.from('phwb_facilities')
				.select('*')
				.eq('partner', partner.id)
				.order('name', { ascending: true })
			
			if (error) throw error
			
			facilities = data || []
		} catch (err) {
			facilitiesError = err instanceof Error ? err.message : 'Failed to load facilities'
			console.error('Error loading facilities:', err)
		} finally {
			isLoadingFacilities = false
		}
	}

	function navigateToFacility(facilityId: number) {
		// Set the facility in localStorage so it gets selected when navigating
		if (typeof window !== 'undefined') {
			localStorage.setItem('phwb-selected-facility', String(facilityId))
		}
		goto('/facilities')
	}

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		return new Date(dateStr).toLocaleDateString()
	}

	// Contact management state
	let editingContactIndex = $state<number | null>(null)
	let isAddingContact = $state(false)
	let isLoading = $state(false)
	let error = $state<string | null>(null)

	// New contact form data
	let newContact = $state<ContactPerson>({
		name: '',
		title: '',
		email: '',
		phone: '',
		address: '',
		isPrimary: false
	})

	// Editing contact form data
	let editingContact = $state<ContactPerson | null>(null)

	// Get current contacts array
	const contacts = $derived(partner?.contacts && Array.isArray(partner.contacts) ? partner.contacts : [])

	async function addContact() {
		if (!partner?.id) return

		error = null
		
		// Validate contact
		try {
			contactPersonSchema.parse(newContact)
		} catch (err) {
			if (err instanceof z.ZodError) {
				error = err.errors[0]?.message || 'Validation failed'
				return
			}
		}

		isLoading = true
		try {
			const updatedContacts = [...contacts]
			
			// If this is the first contact or user marked it as primary, set it as primary
			if (updatedContacts.length === 0 || newContact.isPrimary) {
				updatedContacts.forEach(c => c.isPrimary = false)
				newContact.isPrimary = true
			}
			
			updatedContacts.push(newContact)
			
			const updatedPartner = await partnersStore.update(partner.id, { contacts: updatedContacts })
			
			// Reset form
			newContact = {
				name: '',
				title: '',
				email: '',
				phone: '',
				address: '',
				isPrimary: false
			}
			isAddingContact = false
			
			// Notify parent
			onUpdate?.(updatedPartner)
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add contact'
		} finally {
			isLoading = false
		}
	}

	function startEditContact(index: number) {
		if (index < 0 || index >= contacts.length) return
		editingContactIndex = index
		editingContact = { ...contacts[index] }
		error = null
	}

	function cancelEditContact() {
		editingContactIndex = null
		editingContact = null
		error = null
	}

	async function saveContact(index: number) {
		if (!partner?.id || !editingContact || index < 0 || index >= contacts.length) return

		error = null
		
		// Validate contact
		try {
			contactPersonSchema.parse(editingContact)
		} catch (err) {
			if (err instanceof z.ZodError) {
				error = err.errors[0]?.message || 'Validation failed'
				return
			}
		}

		isLoading = true
		try {
			const updatedContacts = [...contacts]
			
			// Handle primary contact logic
			if (editingContact.isPrimary) {
				// If setting this as primary, unset all others
				updatedContacts.forEach((c, i) => {
					if (i !== index) c.isPrimary = false
				})
			} else if (updatedContacts.length === 1) {
				// If this is the only contact, it must be primary
				editingContact.isPrimary = true
			} else if (contacts[index].isPrimary && !editingContact.isPrimary) {
				// If unchecking primary and there are other contacts, make the first non-primary one primary
				const firstNonPrimary = updatedContacts.find((c, i) => i !== index && !c.isPrimary)
				if (firstNonPrimary) {
					firstNonPrimary.isPrimary = true
				} else if (updatedContacts.length > 1) {
					// If all others are already non-primary, make the first one primary
					updatedContacts[0].isPrimary = true
				}
			}
			
			updatedContacts[index] = editingContact
			
			const updatedPartner = await partnersStore.update(partner.id, { contacts: updatedContacts })
			
			editingContactIndex = null
			editingContact = null
			
			// Notify parent
			onUpdate?.(updatedPartner)
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update contact'
		} finally {
			isLoading = false
		}
	}

	async function deleteContact(index: number) {
		if (!partner?.id || index < 0 || index >= contacts.length) return
		
		if (!confirm('Are you sure you want to delete this contact?')) return

		isLoading = true
		error = null
		try {
			const updatedContacts = [...contacts]
			const wasPrimary = updatedContacts[index].isPrimary
			updatedContacts.splice(index, 1)
			
			// If we deleted the primary contact and there are others, make the first one primary
			if (wasPrimary && updatedContacts.length > 0) {
				updatedContacts[0].isPrimary = true
			}
			
			const updatedPartner = await partnersStore.update(partner.id, { contacts: updatedContacts })
			
			// Notify parent
			onUpdate?.(updatedPartner)
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete contact'
		} finally {
			isLoading = false
		}
	}

	async function setPrimaryContact(index: number) {
		if (!partner?.id || index < 0 || index >= contacts.length) return

		isLoading = true
		error = null
		try {
			const updatedContacts = [...contacts]
			updatedContacts.forEach((c, i) => {
				c.isPrimary = i === index
			})
			
			const updatedPartner = await partnersStore.update(partner.id, { contacts: updatedContacts })
			
			// Notify parent
			onUpdate?.(updatedPartner)
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to set primary contact'
		} finally {
			isLoading = false
		}
	}

	function cancelAddContact() {
		isAddingContact = false
		newContact = {
			name: '',
			title: '',
			email: '',
			phone: '',
			address: '',
			isPrimary: false
		}
		error = null
	}
</script>

<div class="space-y-3">
	<!-- Tab Navigation -->
	<div class="tabs tabs-boxed">
		{#each tabs as tab}
			<button
				type="button"
				class="tab {activeTab === tab.id ? 'tab-active' : ''}"
				onclick={() => setActiveTab(tab.id)}
			>
				<svelte:component this={tab.icon} class="w-4 h-4 mr-2" />
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Tab Content -->
	<div class="tab-content block">
		{#if activeTab === 'contacts'}
			<div class="space-y-4 p-4">
				<div class="flex items-center justify-between border-b pb-2">
					<h3 class="text-lg font-semibold">Contact Information</h3>
					<button
						type="button"
						class="btn btn-sm btn-primary"
						onclick={() => isAddingContact = true}
						disabled={isLoading || isAddingContact}
					>
						<Plus class="w-4 h-4 mr-1" />
						Add Contact
					</button>
				</div>

				{#if error}
					<div class="alert alert-error">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span>{error}</span>
					</div>
				{/if}

				{#if isAddingContact}
					<div class="card bg-base-200 p-4 border-2 border-primary">
						<h4 class="font-semibold mb-3">Add New Contact</h4>
						<div class="space-y-3">
							<div>
								<label class="label">
									<span class="label-text">Name <span class="text-error">*</span></span>
								</label>
								<input
									type="text"
									class="input input-bordered w-full"
									placeholder="Contact name"
									bind:value={newContact.name}
									disabled={isLoading}
								/>
							</div>
							<div>
								<label class="label">
									<span class="label-text">Title</span>
								</label>
								<input
									type="text"
									class="input input-bordered w-full"
									placeholder="Job title"
									bind:value={newContact.title}
									disabled={isLoading}
								/>
							</div>
							<div>
								<label class="label">
									<span class="label-text">Email</span>
								</label>
								<input
									type="email"
									class="input input-bordered w-full"
									placeholder="email@example.com"
									bind:value={newContact.email}
									disabled={isLoading}
								/>
							</div>
							<div>
								<label class="label">
									<span class="label-text">Phone</span>
								</label>
								<input
									type="text"
									class="input input-bordered w-full"
									placeholder="Phone number"
									bind:value={newContact.phone}
									disabled={isLoading}
								/>
							</div>
							<div>
								<label class="label">
									<span class="label-text">Address</span>
								</label>
								<textarea
									class="textarea textarea-bordered w-full"
									placeholder="Address"
									bind:value={newContact.address}
									disabled={isLoading}
									rows="2"
								></textarea>
							</div>
							<div class="form-control">
								<label class="label cursor-pointer justify-start gap-2">
									<input
										type="checkbox"
										class="checkbox checkbox-primary"
										bind:checked={newContact.isPrimary}
										disabled={isLoading || contacts.length === 0}
									/>
									<span class="label-text">
										Set as primary contact
										{#if contacts.length === 0}
											<span class="text-xs opacity-60">(will be set automatically for first contact)</span>
										{/if}
									</span>
								</label>
							</div>
							<div class="flex gap-2 justify-end">
								<button
									type="button"
									class="btn btn-sm btn-ghost"
									onclick={cancelAddContact}
									disabled={isLoading}
								>
									<X class="w-4 h-4 mr-1" />
									Cancel
								</button>
								<button
									type="button"
									class="btn btn-sm btn-primary"
									onclick={addContact}
									disabled={isLoading || !newContact.name.trim()}
								>
									{#if isLoading}
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										<Check class="w-4 h-4 mr-1" />
									{/if}
									Save
								</button>
							</div>
						</div>
					</div>
				{/if}

				{#if contacts.length > 0}
					<div class="space-y-4">
						{#each contacts as contact, index}
							<div class="card bg-base-200 p-4">
								{#if editingContactIndex === index && editingContact}
									<!-- Edit Mode -->
									<h4 class="font-semibold mb-3">Edit Contact</h4>
									<div class="space-y-3">
										<div>
											<label class="label">
												<span class="label-text">Name <span class="text-error">*</span></span>
											</label>
											<input
												type="text"
												class="input input-bordered w-full"
												placeholder="Contact name"
												bind:value={editingContact.name}
												disabled={isLoading}
											/>
										</div>
										<div>
											<label class="label">
												<span class="label-text">Title</span>
											</label>
											<input
												type="text"
												class="input input-bordered w-full"
												placeholder="Job title"
												bind:value={editingContact.title}
												disabled={isLoading}
											/>
										</div>
										<div>
											<label class="label">
												<span class="label-text">Email</span>
											</label>
											<input
												type="email"
												class="input input-bordered w-full"
												placeholder="email@example.com"
												bind:value={editingContact.email}
												disabled={isLoading}
											/>
										</div>
										<div>
											<label class="label">
												<span class="label-text">Phone</span>
											</label>
											<input
												type="text"
												class="input input-bordered w-full"
												placeholder="Phone number"
												bind:value={editingContact.phone}
												disabled={isLoading}
											/>
										</div>
										<div>
											<label class="label">
												<span class="label-text">Address</span>
											</label>
											<textarea
												class="textarea textarea-bordered w-full"
												placeholder="Address"
												bind:value={editingContact.address}
												disabled={isLoading}
												rows="2"
											></textarea>
										</div>
										<div class="form-control">
											<label class="label cursor-pointer justify-start gap-2">
												<input
													type="checkbox"
													class="checkbox checkbox-primary"
													bind:checked={editingContact.isPrimary}
													disabled={isLoading || contacts.length === 1}
												/>
												<span class="label-text">
													Set as primary contact
													{#if contacts.length === 1}
														<span class="text-xs opacity-60">(required for single contact)</span>
													{/if}
												</span>
											</label>
										</div>
										<div class="flex gap-2 justify-end">
											<button
												type="button"
												class="btn btn-sm btn-ghost"
												onclick={cancelEditContact}
												disabled={isLoading}
											>
												<X class="w-4 h-4 mr-1" />
												Cancel
											</button>
											<button
												type="button"
												class="btn btn-sm btn-primary"
												onclick={() => saveContact(index)}
												disabled={isLoading || !editingContact.name.trim()}
											>
												{#if isLoading}
													<span class="loading loading-spinner loading-xs"></span>
												{:else}
													<Check class="w-4 h-4 mr-1" />
												{/if}
												Save
											</button>
										</div>
									</div>
								{:else}
									<!-- Display Mode -->
									<div class="flex items-start justify-between mb-3">
										<div class="flex-1">
											<div class="flex items-center gap-2 mb-2">
												<p class="font-semibold text-sm">
													{contact.name || 'Unnamed Contact'}
												</p>
												{#if contact.isPrimary}
													<span class="badge badge-primary badge-xs">Primary</span>
												{/if}
											</div>
											{#if contact.title}
												<p class="text-xs opacity-70 mb-2">{contact.title}</p>
											{/if}
											<div class="space-y-1">
												{#if contact.email}
													<div class="flex items-center gap-2 text-sm">
														<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
														</svg>
														<a href={`mailto:${contact.email}`} class="link link-primary text-xs">{contact.email}</a>
													</div>
												{/if}
												{#if contact.phone}
													<div class="flex items-center gap-2 text-sm">
														<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
														</svg>
														<span class="text-xs">{contact.phone}</span>
													</div>
												{/if}
												{#if contact.address}
													<div class="flex items-start gap-2 text-sm">
														<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 opacity-60 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
														</svg>
														<span class="text-xs">{contact.address}</span>
													</div>
												{/if}
											</div>
										</div>
										<div class="flex gap-2 ml-2">
											{#if !contact.isPrimary && contacts.length > 1}
												<button
													type="button"
													class="btn btn-xs btn-outline"
													onclick={() => setPrimaryContact(index)}
													disabled={isLoading}
													title="Set as primary contact"
												>
													Set Primary
												</button>
											{/if}
											<button
												type="button"
												class="btn btn-xs btn-ghost"
												onclick={() => startEditContact(index)}
												disabled={isLoading || isAddingContact}
												title="Edit contact"
											>
												<Pencil class="w-3 h-3" />
											</button>
											<button
												type="button"
												class="btn btn-xs btn-ghost text-error"
												onclick={() => deleteContact(index)}
												disabled={isLoading || isAddingContact}
												title="Delete contact"
											>
												<Trash class="w-3 h-3" />
											</button>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else if !isAddingContact}
					<p class="text-base opacity-70 p-4 text-center">No contact information available. Click "Add Contact" to add one.</p>
				{/if}
			</div>
		{:else if activeTab === 'facilities'}
			<div class="space-y-4 p-4">
				<div class="flex items-center justify-between border-b pb-2">
					<h3 class="text-lg font-semibold">Facilities</h3>
					{#if facilities.length > 0}
						<span class="badge badge-neutral">{facilities.length}</span>
					{/if}
				</div>

				{#if isLoadingFacilities}
					<div class="flex justify-center py-8">
						<span class="loading loading-spinner loading-md"></span>
					</div>
				{:else if facilitiesError}
					<div class="alert alert-error">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span>{facilitiesError}</span>
					</div>
				{:else if facilities.length > 0}
					<div class="space-y-3">
						{#each facilities as facility}
							<div class="card bg-base-200 p-4 hover:bg-base-300 transition-colors">
								<div class="flex items-start justify-between">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 mb-2">
											<h4 class="font-semibold text-base">
												{facility.name || 'Unnamed Facility'}
											</h4>
											{#if facility.type}
												<span class="badge badge-sm badge-neutral">{facility.type}</span>
											{/if}
										</div>
										{#if facility.address}
											<div class="flex items-start gap-2 text-sm mb-2">
												<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 opacity-60 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
												</svg>
												<span class="opacity-70">{facility.address}</span>
											</div>
										{/if}
										{#if facility.description}
											<p class="text-sm opacity-70 line-clamp-2">{facility.description}</p>
										{/if}
									</div>
									<div class="ml-4 flex-shrink-0">
										<button
											type="button"
											class="btn btn-sm btn-ghost"
											onclick={() => facility.id && navigateToFacility(facility.id)}
											title="View facility details"
										>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
											</svg>
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-base opacity-70 p-4 text-center">No facilities associated with this partner.</p>
				{/if}
			</div>
		{:else if activeTab === 'history'}
			<div class="space-y-4 p-4">
				<h3 class="text-lg font-semibold border-b pb-2">Partnership History</h3>
				{#if partner?.history && typeof partner.history === 'object' && Object.keys(partner.history).length > 0}
					<div class="bg-base-200 p-4 rounded-lg">
						<pre class="text-sm whitespace-pre-wrap">{JSON.stringify(partner.history, null, 2)}</pre>
					</div>
				{:else}
					<p class="text-base opacity-70">No partnership history available</p>
				{/if}
			</div>
		{:else if activeTab === 'settings'}
			<div class="space-y-4 p-4">
				<h3 class="text-lg font-semibold border-b pb-2">Settings</h3>
				<div class="space-y-4">
					<button
						class="btn btn-outline btn-error"
						onclick={onDelete}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
						Delete Partner
					</button>
				</div>
			</div>
		{:else}
			<div class="text-center py-8 p-4">
				<p class="text-base opacity-70">Unknown tab: "{activeTab}"</p>
			</div>
		{/if}
	</div>
</div>
