<script lang="ts">
	import { onMount } from 'svelte'
	import { supabase } from '$lib/supabase'
	import type { LocationContact } from '$lib/schemas/locationContact'

	interface Props {
		value?: number | null
		onchange?: (contactId: number | null) => void
		disabled?: boolean
		required?: boolean
		placeholder?: string
		error?: string
		locationId?: number | null
		refreshTrigger?: number | string
	}

	let {
		value = null,
		onchange,
		disabled = false,
		required = false,
		placeholder = 'Select a contact',
		error,
		locationId = null,
		refreshTrigger
	}: Props = $props()

	let contacts = $state<LocationContact[]>([])
	let loading = $state(true)

	onMount(async () => {
		await loadContacts()
	})

	$effect(() => {
		if (locationId) {
			loadContacts()
		}
	})

	// Reload contacts when refreshTrigger changes
	$effect(() => {
		if (refreshTrigger !== undefined) {
			loadContacts()
		}
	})

	async function loadContacts() {
		loading = true
		try {
			let query = supabase
				.from('phwb_location_contacts')
				.select('*')
				.eq('active', true)

			if (locationId) {
				query = query.eq('location_id', locationId)
			}

			const { data, error: fetchError } = await query
				.order('primary_contact', { ascending: false })
				.order('name', { ascending: true })

			if (fetchError) {
				console.error('Error fetching location contacts:', fetchError)
				return
			}

			contacts = (data as LocationContact[]) || []
		} catch (err) {
			console.error('Error loading contacts:', err)
		} finally {
			loading = false
		}
	}

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement
		const selectedValue = target.value ? parseInt(target.value) : null
		if (onchange) {
			onchange(selectedValue)
		}
	}

	function formatContactName(contact: LocationContact): string {
		let name = contact.name
		if (contact.title) {
			name += ` - ${contact.title}`
		}
		if (contact.role) {
			name += ` (${contact.role})`
		}
		return name
	}

	function formatContactDisplay(contact: LocationContact): string {
		let display = formatContactName(contact)
		const contactInfo: string[] = []
		if (contact.email) {
			contactInfo.push(contact.email)
		}
		if (contact.phone) {
			let phone = contact.phone
			if (contact.phone_ext) {
				phone += ` ext. ${contact.phone_ext}`
			}
			contactInfo.push(phone)
		}
		if (contactInfo.length > 0) {
			display += ` • ${contactInfo.join(' • ')}`
		}
		return display
	}
</script>

<div class="form-control w-full">
	<select
		class="select select-bordered w-full"
		class:select-error={error}
		class:opacity-50={disabled}
		{disabled}
		{required}
		value={value ?? ''}
		onchange={handleChange}
	>
		<option value="" disabled selected={!value}>
			{loading ? 'Loading contacts...' : placeholder}
		</option>

		{#if !loading}
			{#each contacts as contact}
				<option value={contact.id} selected={value === contact.id}>
					{formatContactDisplay(contact)}
				</option>
			{/each}

			{#if contacts.length === 0}
				<option value="" disabled>No contacts available</option>
			{/if}
		{/if}
	</select>

	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}
</div>
