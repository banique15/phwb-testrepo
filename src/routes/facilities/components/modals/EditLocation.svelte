<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import Modal from '$lib/components/ui/Modal.svelte'
	import { updateLocationSchema, type Location, type UpdateLocation } from '$lib/schemas/location'
	import { locationsStore } from '$lib/stores/locations'
	import { locationTypesStore } from '$lib/stores/locationTypes'
	import { onMount } from 'svelte'
	import { z } from 'zod'
	import type { LocationType } from '$lib/schemas/locationType'

	interface Props {
		open?: boolean
		location?: Location | null
	}

	let { open = false, location }: Props = $props()

	const dispatch = createEventDispatcher<{
		close: void
		success: { location: Location }
	}>()

	let formData = $state<UpdateLocation>({})
	let isLoading = $state(false)
	let formErrors = $state<Record<string, string>>({})
	let submitError = $state<string | null>(null)

	// Location types
	let locationTypes = $state<LocationType[]>([])
	let loadingLocationTypes = $state(false)

	onMount(async () => {
		await loadLocationTypes()
	})

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

	$effect(() => {
		if (location) {
			formData = {
				facility_id: location.facility_id,
				name: location.name,
				description: location.description,
				floor: location.floor,
				capacity: location.capacity,
				type: location.type || null,
				accessibility_features: location.accessibility_features,
				equipment_available: location.equipment_available,
				attributes: location.attributes,
				notes: location.notes,
				active: location.active
			}

			// Load existing attributes into checkbox state
			if (location.attributes && typeof location.attributes === 'object') {
				const attrs = location.attributes as Record<string, any>
				attributesState.power = !!attrs.power
				attributesState.wifi = !!attrs.wifi
				attributesState.soundSystem = !!attrs.soundSystem
				attributesState.projector = !!attrs.projector
				attributesState.hvac = !!attrs.hvac
				attributesState.wheelchairAccess = !!attrs.wheelchairAccess
				attributesState.elevator = !!attrs.elevator
				attributesState.naturalLight = !!attrs.naturalLight
				attributesState.adjustableLighting = !!attrs.adjustableLighting
				attributesState.storage = !!attrs.storage
				attributesState.acoustics = typeof attrs.acoustics === 'number' ? attrs.acoustics : 0
			} else {
				// Reset attributes state if no attributes
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
					storage: false,
					acoustics: 0
				}
			}
		}
	})

	function validateField(field: keyof UpdateLocation, value: any) {
		try {
			const fieldSchema = updateLocationSchema.shape[field]
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

	function handleInputChange(field: keyof UpdateLocation, value: any) {
		(formData as any)[field] = value
		validateField(field, value)
		submitError = null
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
		if (!location?.id) return

		formErrors = {}
		submitError = null
		isLoading = true

		try {
			updateLocationSchema.parse(formData)
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
			const updatedLocation = await locationsStore.update(location.id, formData)
			dispatch('success', { location: updatedLocation })
		} catch (error: any) {
			submitError = error.message || 'Failed to update location'
			console.error('Error updating location:', error)
		} finally {
			isLoading = false
		}
	}

	function handleClose() {
		if (!isLoading) {
			formErrors = {}
			submitError = null
			dispatch('close')
		}
	}
</script>

<Modal {open} title="Edit Location" size="lg" on:close={handleClose}>
	{#if location}
		<form onsubmit={handleSubmit} class="space-y-4">
			{#if submitError}
				<div class="alert alert-error">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>{submitError}</span>
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
					value={formData.name || ''}
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

			<!-- Floor -->
			<div class="form-control w-full">
				<label class="label">
					<span class="label-text">Floor</span>
				</label>
				<input
					type="text"
					placeholder="e.g., 1st Floor, Ground Level, Basement"
					class="input input-bordered w-full"
					class:input-error={formErrors.floor}
					value={formData.floor || ''}
					oninput={(e) => handleInputChange('floor', e.currentTarget.value)}
					disabled={isLoading}
				/>
			</div>

			<!-- Capacity -->
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
						Updating...
					{:else}
						Update Location
					{/if}
				</button>
			</div>
		</form>
	{/if}
</Modal>
