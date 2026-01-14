<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import Modal from '$lib/components/ui/Modal.svelte'
	import { createLocationSchema, type CreateLocation } from '$lib/schemas/location'
	import { locationsStore } from '$lib/stores/locations'
	import { locationTypesStore } from '$lib/stores/locationTypes'
	import { supabase } from '$lib/supabase'
	import { z } from 'zod'
	import { onMount } from 'svelte'
	import type { LocationType } from '$lib/schemas/locationType'

	interface Props {
		open?: boolean
		facilityId?: number
	}

	let { open = false, facilityId }: Props = $props()

	const dispatch = createEventDispatcher<{
		close: void
		success: { location: any }
	}>()

	// Form state
	let formData = $state<CreateLocation>({
		facility_id: facilityId || 0,
		name: '',
		description: '',
		floor: '',
		capacity: undefined,
		accessibility_features: {},
		equipment_available: {},
		attributes: {},
		notes: '',
		active: true
	})

	// Attribute checkboxes state
	let attributesState = $state({
		power: false,
		wifi: false,
		soundSystem: false,
		projector: false,
		hvac: false,
		wheelchairAccess: false,
		elevator: false,
		naturalLight: false,
		adjustableLighting: false,
		storage: false,
		acoustics: 0 as number // 0 = not rated, 1-5 rating scale
	})

	let isLoading = $state(false)
	let formErrors = $state<Record<string, string>>({})
	let submitError = $state<string | null>(null)
	
	// Facilities list for selector (when facilityId is not provided)
	let facilities = $state<Array<{ id: number; name: string }>>([])
	let loadingFacilities = $state(false)
	let showFacilitySelector = $derived(!facilityId)

	// Location types
	let locationTypes = $state<LocationType[]>([])
	let loadingLocationTypes = $state(false)

	// Update facility_id when prop changes
	$effect(() => {
		if (facilityId) {
			formData.facility_id = facilityId
		}
	})

	// Load facilities when modal opens and facilityId is not provided
	$effect(() => {
		if (open && showFacilitySelector && facilities.length === 0) {
			loadFacilities()
		}
		if (open && locationTypes.length === 0) {
			loadLocationTypes()
		}
	})

	async function loadFacilities() {
		loadingFacilities = true
		try {
			const { data, error } = await supabase
				.from('phwb_facilities')
				.select('id, name')
				.order('name', { ascending: true })
			
			if (error) throw error
			facilities = data || []
		} catch (err) {
			console.error('Failed to load facilities:', err)
			facilities = []
		} finally {
			loadingFacilities = false
		}
	}

	async function loadLocationTypes() {
		loadingLocationTypes = true
		try {
			const result = await locationTypesStore.fetchAll({ limit: 1000 })
			locationTypes = result.data.filter(type => type.active)
		} catch (error) {
			console.error('Failed to load location types:', error)
		} finally {
			loadingLocationTypes = false
		}
	}

	function validateField(field: keyof CreateLocation, value: any) {
		try {
			const fieldSchema = createLocationSchema.shape[field]
			if (fieldSchema) {
				fieldSchema.parse(value)
				delete formErrors[field]
				formErrors = { ...formErrors }
			}
		} catch (error) {
			if (error instanceof z.ZodError) {
				formErrors[field] = error.errors[0]?.message || 'Invalid value'
				formErrors = { ...formErrors }
			}
		}
	}

	function handleInputChange(field: keyof CreateLocation, value: any) {
		(formData as any)[field] = value
		validateField(field, value)
		submitError = null
	}

	function resetForm() {
		formData = {
			facility_id: facilityId || 0,
			name: '',
			description: '',
			floor: '',
			capacity: undefined,
			type: null,
			accessibility_features: {},
			equipment_available: {},
			attributes: {},
			notes: '',
			active: true
		}
		attributesState = {
			power: false,
			wifi: false,
			soundSystem: false,
			projector: false,
			hvac: false,
			wheelchairAccess: false,
			elevator: false,
			naturalLight: false,
			adjustableLighting: false,
			storage: false
		}
		formErrors = {}
		submitError = null
		isLoading = false
	}

	function updateAttributes() {
		const attrs: Record<string, any> = {}
		if (attributesState.power) attrs.power = { available: true }
		if (attributesState.wifi) attrs.wifi = true
		if (attributesState.soundSystem) attrs.soundSystem = true
		if (attributesState.projector) attrs.projector = true
		if (attributesState.hvac) attrs.hvac = true
		if (attributesState.wheelchairAccess) attrs.wheelchairAccess = true
		if (attributesState.elevator) attrs.elevator = true
		if (attributesState.naturalLight) attrs.naturalLight = true
		if (attributesState.adjustableLighting) attrs.adjustableLighting = true
		if (attributesState.storage) attrs.storage = { available: true }
		if (attributesState.acoustics > 0) attrs.acoustics = attributesState.acoustics
		formData.attributes = Object.keys(attrs).length > 0 ? attrs : {}
	}

	async function handleSubmit(event?: SubmitEvent | MouseEvent) {
		event?.preventDefault()
		formErrors = {}
		submitError = null
		isLoading = true

		try {
			createLocationSchema.parse(formData)
		} catch (error) {
			if (error instanceof z.ZodError) {
				error.errors.forEach((err) => {
					const path = err.path[0] as string
					formErrors[path] = err.message
				})
				formErrors = { ...formErrors }
			}
			isLoading = false
			return
		}

		try {
			const newLocation = await locationsStore.create(formData)
			dispatch('success', { location: newLocation })
			resetForm()
		} catch (error: any) {
			submitError = error.message || 'Failed to create location'
			console.error('Error creating location:', error)
		} finally {
			isLoading = false
		}
	}

	function handleClose() {
		if (!isLoading) {
			resetForm()
			dispatch('close')
		}
	}
</script>

<Modal {open} title="Add Location" size="lg" on:close={handleClose}>
	<form onsubmit={handleSubmit} class="space-y-4">
		{#if submitError}
			<div class="alert alert-error">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{submitError}</span>
			</div>
		{/if}

		<!-- Facility Selector (only shown when facilityId is not provided) -->
		{#if showFacilitySelector}
			<div class="form-control w-full">
				<label class="label">
					<span class="label-text">Facility <span class="text-error">*</span></span>
				</label>
				{#if loadingFacilities}
					<div class="input input-bordered w-full flex items-center justify-center">
						<span class="loading loading-spinner loading-sm"></span>
						<span class="ml-2">Loading facilities...</span>
					</div>
				{:else}
					<select
						class="select select-bordered w-full {formErrors.facility_id ? 'select-error' : ''}"
						value={formData.facility_id || ''}
						onchange={(e) => {
							const value = Number(e.currentTarget.value)
							handleInputChange('facility_id', value || 0)
						}}
						disabled={isLoading}
						required
					>
						<option value="0">Select a facility...</option>
						{#each facilities as facility}
							<option value={facility.id}>{facility.name}</option>
						{/each}
					</select>
				{/if}
				{#if formErrors.facility_id}
					<label class="label">
						<span class="label-text-alt text-error">{formErrors.facility_id}</span>
					</label>
				{/if}
			</div>
		{/if}

		<!-- Location Name -->
		<div class="form-control w-full">
			<label class="label">
				<span class="label-text">Location Name <span class="text-error">*</span></span>
			</label>
			<input
				type="text"
				placeholder="e.g., Main Lobby, Cafeteria, Room 201"
				class="input input-bordered w-full"
				class:input-error={formErrors.name}
				value={formData.name}
				oninput={(e) => handleInputChange('name', e.currentTarget.value)}
				disabled={isLoading}
				required
			/>
			{#if formErrors.name}
				<label class="label">
					<span class="label-text-alt text-error">{formErrors.name}</span>
				</label>
			{/if}
		</div>

		<!-- Location Type -->
		<div class="form-control w-full">
			<label class="label">
				<span class="label-text">Location Type</span>
			</label>
			{#if loadingLocationTypes}
				<select class="select select-bordered w-full" disabled>
					<option>Loading types...</option>
				</select>
			{:else}
				<select
					class="select select-bordered w-full {formErrors.type ? 'select-error' : ''}"
					value={formData.type?.toString() || ''}
					onchange={(e) => {
						const value = e.currentTarget.value ? Number(e.currentTarget.value) : null
						handleInputChange('type', value)
					}}
					disabled={isLoading}
				>
					<option value="">Select location type (optional)</option>
					{#each locationTypes as type}
						<option value={type.id?.toString()}>{type.name}</option>
					{/each}
				</select>
			{/if}
			{#if formErrors.type}
				<label class="label">
					<span class="label-text-alt text-error">{formErrors.type}</span>
				</label>
			{/if}
		</div>

		<!-- Floor and Capacity -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div class="form-control w-full">
				<label class="label">
					<span class="label-text">Floor</span>
				</label>
				<input
					type="text"
					placeholder="e.g., 1st Floor, Ground Level"
					class="input input-bordered w-full"
					class:input-error={formErrors.floor}
					value={formData.floor || ''}
					oninput={(e) => handleInputChange('floor', e.currentTarget.value)}
					disabled={isLoading}
				/>
				{#if formErrors.floor}
					<label class="label">
						<span class="label-text-alt text-error">{formErrors.floor}</span>
					</label>
				{/if}
			</div>

			<div class="form-control w-full">
				<label class="label">
					<span class="label-text">Capacity</span>
				</label>
				<input
					type="number"
					placeholder="Maximum number of people"
					class="input input-bordered w-full"
					class:input-error={formErrors.capacity}
					value={formData.capacity ?? ''}
					oninput={(e) => handleInputChange('capacity', e.currentTarget.valueAsNumber || undefined)}
					disabled={isLoading}
					min="0"
				/>
				{#if formErrors.capacity}
					<label class="label">
						<span class="label-text-alt text-error">{formErrors.capacity}</span>
					</label>
				{/if}
			</div>
		</div>

		<!-- Description -->
		<div class="form-control w-full">
			<label class="label">
				<span class="label-text">Description</span>
			</label>
			<textarea
				class="textarea textarea-bordered w-full h-24"
				placeholder="Describe this location..."
				class:textarea-error={formErrors.description}
				value={formData.description || ''}
				oninput={(e) => handleInputChange('description', e.currentTarget.value)}
				disabled={isLoading}
			></textarea>
			{#if formErrors.description}
				<label class="label">
					<span class="label-text-alt text-error">{formErrors.description}</span>
				</label>
			{/if}
		</div>

		<!-- Location Attributes -->
		<div class="space-y-3">
			<h4 class="font-medium text-sm border-b pb-2">Location Attributes</h4>
			<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
				<label class="label cursor-pointer justify-start gap-2 p-2 border rounded hover:bg-base-200">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						bind:checked={attributesState.power}
						onchange={updateAttributes}
						disabled={isLoading}
					/>
					<span class="label-text text-sm">Power Available</span>
				</label>

				<label class="label cursor-pointer justify-start gap-2 p-2 border rounded hover:bg-base-200">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						bind:checked={attributesState.wifi}
						onchange={updateAttributes}
						disabled={isLoading}
					/>
					<span class="label-text text-sm">WiFi</span>
				</label>

				<label class="label cursor-pointer justify-start gap-2 p-2 border rounded hover:bg-base-200">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						bind:checked={attributesState.soundSystem}
						onchange={updateAttributes}
						disabled={isLoading}
					/>
					<span class="label-text text-sm">Sound System</span>
				</label>

				<label class="label cursor-pointer justify-start gap-2 p-2 border rounded hover:bg-base-200">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						bind:checked={attributesState.projector}
						onchange={updateAttributes}
						disabled={isLoading}
					/>
					<span class="label-text text-sm">Projector</span>
				</label>

				<label class="label cursor-pointer justify-start gap-2 p-2 border rounded hover:bg-base-200">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						bind:checked={attributesState.hvac}
						onchange={updateAttributes}
						disabled={isLoading}
					/>
					<span class="label-text text-sm">HVAC</span>
				</label>

				<label class="label cursor-pointer justify-start gap-2 p-2 border rounded hover:bg-base-200">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						bind:checked={attributesState.wheelchairAccess}
						onchange={updateAttributes}
						disabled={isLoading}
					/>
					<span class="label-text text-sm">Wheelchair Access</span>
				</label>

				<label class="label cursor-pointer justify-start gap-2 p-2 border rounded hover:bg-base-200">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						bind:checked={attributesState.elevator}
						onchange={updateAttributes}
						disabled={isLoading}
					/>
					<span class="label-text text-sm">Elevator</span>
				</label>

				<label class="label cursor-pointer justify-start gap-2 p-2 border rounded hover:bg-base-200">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						bind:checked={attributesState.naturalLight}
						onchange={updateAttributes}
						disabled={isLoading}
					/>
					<span class="label-text text-sm">Natural Light</span>
				</label>

				<label class="label cursor-pointer justify-start gap-2 p-2 border rounded hover:bg-base-200">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						bind:checked={attributesState.adjustableLighting}
						onchange={updateAttributes}
						disabled={isLoading}
					/>
					<span class="label-text text-sm">Adjustable Lighting</span>
				</label>

				<label class="label cursor-pointer justify-start gap-2 p-2 border rounded hover:bg-base-200">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						bind:checked={attributesState.storage}
						onchange={updateAttributes}
						disabled={isLoading}
					/>
					<span class="label-text text-sm">Storage Available</span>
				</label>
			</div>

			<!-- Acoustics Rating -->
			<div class="mt-4 p-3 border rounded bg-base-200/50">
				<label class="label">
					<span class="label-text font-medium">Acoustics Quality Rating</span>
				</label>
				<div class="flex items-center gap-2">
					<select
						class="select select-bordered select-sm flex-1"
						value={attributesState.acoustics}
						onchange={(e) => {
							attributesState.acoustics = parseInt(e.currentTarget.value)
							updateAttributes()
						}}
						disabled={isLoading}
					>
						<option value="0">Not Rated</option>
						<option value="1">1 - Poor (echoey, noisy)</option>
						<option value="2">2 - Fair (some echo/noise issues)</option>
						<option value="3">3 - Good (adequate for most performances)</option>
						<option value="4">4 - Very Good (minimal echo, good sound)</option>
						<option value="5">5 - Excellent (purpose-built acoustics)</option>
					</select>
				</div>
				<p class="text-xs text-base-content/60 mt-1">
					Rate the acoustic quality for musical performances
				</p>
			</div>
		</div>

		<!-- Notes -->
		<div class="form-control w-full">
			<label class="label">
				<span class="label-text">Notes</span>
			</label>
			<textarea
				class="textarea textarea-bordered w-full h-20"
				placeholder="Additional notes..."
				value={formData.notes || ''}
				oninput={(e) => handleInputChange('notes', e.currentTarget.value)}
				disabled={isLoading}
			></textarea>
		</div>

		<!-- Active Status -->
		<div class="form-control w-full">
			<label class="label cursor-pointer justify-start gap-4">
				<input
					type="checkbox"
					class="checkbox"
					checked={formData.active}
					onchange={(e) => handleInputChange('active', e.currentTarget.checked)}
					disabled={isLoading}
				/>
				<span class="label-text">Active (available for events)</span>
			</label>
		</div>

		<!-- Actions -->
		<div class="modal-action">
			<button type="button" class="btn" onclick={handleClose} disabled={isLoading}>
				Cancel
			</button>
			<button type="submit" class="btn btn-primary" disabled={isLoading}>
				{#if isLoading}
					<span class="loading loading-spinner"></span>
					Creating...
				{:else}
					Create Location
				{/if}
			</button>
		</div>
	</form>
</Modal>
