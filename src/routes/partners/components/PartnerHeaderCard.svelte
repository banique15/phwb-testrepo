<script lang="ts">
	import type { Partner } from '$lib/schemas/partner'
	import InlineEditableField from '$lib/components/ui/InlineEditableField.svelte'

	interface Props {
		partner: Partner
		facilitiesCount?: number
		eventsCount?: number
		onUpdateField: (field: string, value: any) => Promise<void>
	}

	let {
		partner,
		facilitiesCount = 0,
		eventsCount = 0,
		onUpdateField
	}: Props = $props()

	let isEditingLogoUrl = $state(false)

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		return new Date(dateStr).toLocaleDateString()
	}

	async function handleLogoUrlSave(value: any) {
		await onUpdateField('logo', value)
		isEditingLogoUrl = false
	}
</script>

<div class="card bg-base-100 shadow-none mb-4">
	<div class="card-body p-4">
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Left Side: Basic Information (2 columns on large screens) -->
			<div class="lg:col-span-2 space-y-3">
				<!-- Title and Organization -->
				<div class="space-y-3">
					<div>
						<InlineEditableField
							value={partner.name}
							field="name"
							type="text"
							placeholder="Enter partner name"
							required={true}
							maxLength={200}
							onSave={(value) => onUpdateField('name', value)}
							formatDisplay={(val) => val || 'Unnamed Partner'}
							displayClass="text-3xl font-bold"
						/>
					</div>
					<div>
						<InlineEditableField
							value={partner.organization}
							field="organization"
							type="text"
							placeholder="Enter organization"
							maxLength={200}
							onSave={(value) => onUpdateField('organization', value)}
							formatDisplay={(val) => val || ''}
						/>
					</div>
				</div>

				<!-- Website -->
				<div>
					<InlineEditableField
						value={partner.website}
						field="website"
						type="url"
						placeholder="https://example.com"
						label="Website"
						onSave={(value) => onUpdateField('website', value)}
					/>
				</div>

				<!-- Description -->
				<div>
					<InlineEditableField
						value={partner.description}
						field="description"
						type="textarea"
						placeholder="Enter partner description"
						maxLength={2000}
						rows={3}
						label="Description"
						onSave={(value) => onUpdateField('description', value)}
					/>
				</div>

				<!-- Quick Stats -->
				<div class="flex items-center gap-3 pt-2 border-t border-base-300">
					{#if facilitiesCount > 0}
						<div class="stat stat-compact p-0">
							<div class="stat-title text-xs">Facilities</div>
							<div class="stat-value text-lg">{facilitiesCount}</div>
						</div>
					{/if}
					{#if eventsCount > 0}
						<div class="stat stat-compact p-0">
							<div class="stat-title text-xs">Events</div>
							<div class="stat-value text-lg">{eventsCount}</div>
						</div>
					{/if}
					<div class="stat stat-compact p-0">
						<div class="stat-title text-xs">Created</div>
						<div class="stat-value text-sm">{formatDate(partner.created_at)}</div>
					</div>
				</div>
			</div>

			<!-- Right Side: Logo (1 column on large screens) -->
			<div class="lg:col-span-1">
				<div class="space-y-2">
					{#if partner.logo}
						{#key `${partner.id}-${partner.logo}`}
							<div class="rounded-lg overflow-hidden border border-base-300 relative group">
								<img 
									src={partner.logo} 
									alt={partner.name || 'Partner'} 
									class="w-full h-auto object-cover"
									onerror={(e) => {
										(e.target as HTMLImageElement).style.display = 'none'
									}}
								/>
								{#if !isEditingLogoUrl}
									<div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
										<button
											type="button"
											class="btn btn-xs btn-ghost bg-base-100/80 backdrop-blur-sm"
											onclick={() => isEditingLogoUrl = true}
											title="Edit logo URL"
										>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
											</svg>
										</button>
									</div>
								{/if}
							</div>
						{/key}
					{:else}
						<div class="rounded-lg border-2 border-dashed border-base-300 bg-base-200 flex items-center justify-center h-48">
							<div class="text-center text-base-content/50">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								<p class="text-sm">No logo</p>
							</div>
						</div>
					{/if}
					{#if !partner.logo || isEditingLogoUrl}
						<InlineEditableField
							value={partner.logo}
							field="logo"
							type="url"
							placeholder="Enter logo URL"
							label="Logo URL"
							onSave={handleLogoUrlSave}
							onCancel={() => isEditingLogoUrl = false}
						/>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

