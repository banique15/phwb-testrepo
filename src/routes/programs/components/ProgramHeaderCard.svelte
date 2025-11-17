<script lang="ts">
	import type { Program } from '$lib/schemas/program'
	import InlineEditableField from '$lib/components/ui/InlineEditableField.svelte'

	interface Props {
		program: Program
		eventsCount?: number
		onUpdateField: (field: string, value: any) => Promise<void>
	}

	let {
		program,
		eventsCount = 0,
		onUpdateField
	}: Props = $props()

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'Not specified'
		return new Date(dateStr).toLocaleDateString()
	}

	function calculateDuration(startDate: string | undefined, endDate: string | undefined) {
		if (!startDate || !endDate) return 'Unknown duration'
		const start = new Date(startDate)
		const end = new Date(endDate)
		const diffTime = Math.abs(end.getTime() - start.getTime())
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
		
		if (diffDays < 30) return `${diffDays} days`
		if (diffDays < 365) return `${Math.round(diffDays / 30)} months`
		return `${Math.round(diffDays / 365)} years`
	}

	function getStatusColor(startDate: string | undefined, endDate: string | undefined) {
		const now = new Date()
		const start = startDate ? new Date(startDate) : null
		const end = endDate ? new Date(endDate) : null
		
		if (start && start > now) return 'badge-info' // Future
		if (end && end < now) return 'badge-neutral' // Completed
		if (start && start <= now && (!end || end >= now)) return 'badge-success' // Active
		return 'badge-outline' // Unknown
	}

	function getStatusText(startDate: string | undefined, endDate: string | undefined) {
		const now = new Date()
		const start = startDate ? new Date(startDate) : null
		const end = endDate ? new Date(endDate) : null
		
		if (start && start > now) return 'Upcoming'
		if (end && end < now) return 'Completed'
		if (start && start <= now && (!end || end >= now)) return 'Active'
		return 'Unknown'
	}
</script>

<div class="card bg-base-100 shadow-none mb-4">
	<div class="card-body p-4">
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Left Side: Basic Information (2 columns on large screens) -->
			<div class="lg:col-span-2 space-y-3">
				<!-- Title and Status -->
				<div class="space-y-3">
					<div>
						<InlineEditableField
							value={program.title}
							field="title"
							type="text"
							placeholder="Enter program title"
							required={true}
							maxLength={200}
							onSave={(value) => onUpdateField('title', value)}
							formatDisplay={(val) => val || 'Unnamed Program'}
							displayClass="text-3xl font-bold"
						/>
					</div>
					<div class="flex items-center gap-3 flex-wrap">
						<span class="badge {getStatusColor(program.start_date, program.end_date)}">
							{getStatusText(program.start_date, program.end_date)}
						</span>
						<InlineEditableField
							value={program.geo_coverage}
							field="geo_coverage"
							type="text"
							placeholder="Enter geographic coverage"
							maxLength={200}
							onSave={(value) => onUpdateField('geo_coverage', value)}
							formatDisplay={(val) => val || ''}
						/>
					</div>
				</div>

				<!-- Description -->
				<div>
					<InlineEditableField
						value={program.description}
						field="description"
						type="textarea"
						placeholder="Enter program description"
						maxLength={2000}
						rows={3}
						label="Description"
						onSave={(value) => onUpdateField('description', value)}
					/>
				</div>

				<!-- Quick Stats -->
				<div class="flex items-center gap-3 pt-2 border-t border-base-300">
					{#if eventsCount > 0}
						<div class="stat stat-compact p-0">
							<div class="stat-title text-xs">Events</div>
							<div class="stat-value text-lg">{eventsCount}</div>
						</div>
					{/if}
					<div class="stat stat-compact p-0">
						<div class="stat-title text-xs">Duration</div>
						<div class="stat-value text-sm">{calculateDuration(program.start_date, program.end_date)}</div>
					</div>
					<div class="stat stat-compact p-0">
						<div class="stat-title text-xs">Created</div>
						<div class="stat-value text-sm">{formatDate(program.created_at)}</div>
					</div>
				</div>
			</div>

			<!-- Right Side: Timeline Visualization (1 column on large screens) -->
			<div class="lg:col-span-1">
				<div class="space-y-2">
					<h3 class="text-sm font-semibold opacity-70">Timeline</h3>
					{#if program.start_date}
						<div class="bg-base-200 p-4 rounded-lg">
							<div class="space-y-2">
								<div>
									<InlineEditableField
										value={program.start_date}
										field="start_date"
										type="text"
										placeholder="YYYY-MM-DD"
										label="Start Date"
										onSave={(value) => onUpdateField('start_date', value)}
									/>
								</div>
								<div>
									<InlineEditableField
										value={program.end_date}
										field="end_date"
										type="text"
										placeholder="YYYY-MM-DD"
										label="End Date"
										onSave={(value) => onUpdateField('end_date', value)}
									/>
								</div>
								{#if program.start_date && program.end_date}
									{@const now = new Date()}
									{@const start = new Date(program.start_date)}
									{@const end = new Date(program.end_date)}
									{@const total = end.getTime() - start.getTime()}
									{@const progress = Math.min(100, Math.max(0, ((now.getTime() - start.getTime()) / total) * 100))}
									
									<div class="relative mt-2 h-2 bg-base-300 rounded-full overflow-hidden">
										<div 
											class="h-full bg-primary transition-all duration-500 rounded-full"
											style="width: {progress}%"
										></div>
									</div>
									<div class="flex items-center justify-between text-xs mt-2 opacity-70">
										<span>{formatDate(program.start_date)}</span>
										<span>{formatDate(program.end_date)}</span>
									</div>
								{/if}
							</div>
						</div>
					{:else}
						<div class="bg-base-200 p-4 rounded-lg border-2 border-dashed border-base-300">
							<p class="text-sm text-base-content/50 text-center">No timeline set</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

