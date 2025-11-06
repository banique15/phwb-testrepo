<script lang="ts">
	import type { PageData } from './$types';
	import { format } from 'date-fns';

	let { data }: { data: PageData } = $props();

	let showRequestModal = $state(false);
	let showEventView = $state<'upcoming' | 'past'>('upcoming');

	// Event request form state
	let eventRequest = $state({
		program: '',
		title: '',
		preferredDate: '',
		location: '',
		description: '',
		specialRequirements: ''
	});

	function openRequestModal() {
		showRequestModal = true;
	}

	function closeRequestModal() {
		showRequestModal = false;
		// Reset form
		eventRequest = {
			program: '',
			title: '',
			preferredDate: '',
			location: '',
			description: '',
			specialRequirements: ''
		};
	}

	function submitEventRequest() {
		// TODO: Submit to backend
		console.log('Event request submitted:', eventRequest);
		alert('Event request submitted successfully! Our team will review and get back to you.');
		closeRequestModal();
	}

	function formatEventDate(dateStr: string) {
		try {
			return format(new Date(dateStr), 'MMM d, yyyy');
		} catch {
			return dateStr;
		}
	}

	function formatEventTime(timeStr: string | null) {
		if (!timeStr) return '';
		try {
			// Assuming time is in HH:mm format
			const [hours, minutes] = timeStr.split(':');
			const hour = parseInt(hours);
			const ampm = hour >= 12 ? 'PM' : 'AM';
			const displayHour = hour % 12 || 12;
			return `${displayHour}:${minutes} ${ampm}`;
		} catch {
			return timeStr;
		}
	}

	const eventsToShow = $derived(
		showEventView === 'upcoming' ? data.upcomingEvents : data.pastEvents
	);
</script>

<svelte:head>
	<title>Partner Portal - {data.partner.name}</title>
</svelte:head>

<div class="space-y-8">
	<!-- Demo Notice -->
	<div class="alert alert-info text-xs sm:text-sm">
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-5 h-5 sm:w-6 sm:h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
		<div>
			<h3 class="font-bold text-sm sm:text-base">Demo Mode - Mock Data</h3>
			<div class="text-xs sm:text-sm">This portal showcases sample data for demonstration purposes.</div>
			<div class="text-xs mt-1 hidden sm:block">Currently displaying: <strong>{data.partner.name}</strong> with {data.stats.totalEvents} sample events</div>
		</div>
	</div>

	<!-- Welcome Section -->
	<div class="hero bg-base-100 rounded-lg shadow-xl">
		<div class="hero-content flex-col lg:flex-row-reverse gap-4 sm:gap-8 py-4 sm:py-8 px-2 sm:px-4">
			{#if data.partner.logo}
				<img
					src={data.partner.logo}
					alt={data.partner.name}
					class="w-32 sm:w-48 lg:max-w-xs rounded-lg shadow-2xl"
				/>
			{:else}
				<div class="w-32 h-32 sm:w-48 sm:h-48 lg:w-64 lg:h-64 bg-primary/10 rounded-lg flex items-center justify-center">
					<span class="text-5xl sm:text-6xl lg:text-8xl">🤝</span>
				</div>
			{/if}
			<div class="text-center lg:text-left">
				<h1 class="text-2xl sm:text-3xl lg:text-5xl font-bold">{data.partner.name}</h1>
				{#if data.partner.organization}
					<p class="text-sm sm:text-base lg:text-xl text-base-content/70 mt-2">{data.partner.organization}</p>
				{/if}
				{#if data.partner.description}
					<p class="py-4 sm:py-6 max-w-2xl text-sm sm:text-base">{data.partner.description}</p>
				{/if}
				<button onclick={openRequestModal} class="btn btn-primary btn-sm sm:btn-md lg:btn-lg gap-2 w-full sm:w-auto">
					<span class="text-lg sm:text-xl">➕</span>
					Request New Event
				</button>
			</div>
		</div>
	</div>

	<!-- Statistics Cards -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
		<div class="stats shadow">
			<div class="stat bg-base-100">
				<div class="stat-figure text-primary">
					<span class="text-4xl">📅</span>
				</div>
				<div class="stat-title">Upcoming Events</div>
				<div class="stat-value text-primary">{data.stats.upcomingEvents}</div>
			</div>
		</div>

		<div class="stats shadow">
			<div class="stat bg-base-100">
				<div class="stat-figure text-secondary">
					<span class="text-4xl">✅</span>
				</div>
				<div class="stat-title">Past Events</div>
				<div class="stat-value text-secondary">{data.stats.pastEvents}</div>
			</div>
		</div>

		<div class="stats shadow">
			<div class="stat bg-base-100">
				<div class="stat-figure text-accent">
					<span class="text-4xl">🎪</span>
				</div>
				<div class="stat-title">Total Events</div>
				<div class="stat-value text-accent">{data.stats.totalEvents}</div>
			</div>
		</div>

		<div class="stats shadow">
			<div class="stat bg-base-100">
				<div class="stat-figure text-info">
					<span class="text-4xl">📋</span>
				</div>
				<div class="stat-title">Programs</div>
				<div class="stat-value text-info">{data.stats.totalPrograms}</div>
			</div>
		</div>
	</div>

	<!-- Events Section -->
	<div class="card bg-base-100 shadow-xl">
		<div class="card-body p-3 sm:p-6">
			<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
				<h2 class="card-title text-lg sm:text-2xl">Your Events</h2>

				<!-- Event View Toggle -->
				<div class="join w-full sm:w-auto">
					<button
						class="join-item btn btn-xs sm:btn-sm flex-1 sm:flex-none"
						class:btn-active={showEventView === 'upcoming'}
						onclick={() => (showEventView = 'upcoming')}
					>
						<span class="hidden sm:inline">Upcoming</span>
						<span class="sm:hidden">Up</span>
						({data.stats.upcomingEvents})
					</button>
					<button
						class="join-item btn btn-xs sm:btn-sm flex-1 sm:flex-none"
						class:btn-active={showEventView === 'past'}
						onclick={() => (showEventView = 'past')}
					>
						Past ({data.stats.pastEvents})
					</button>
				</div>
			</div>

			{#if eventsToShow.length === 0}
				<div class="alert text-sm">
					<span class="text-xl sm:text-2xl">📭</span>
					<span>
						{showEventView === 'upcoming'
							? 'No upcoming events scheduled.'
							: 'No past events found.'}
					</span>
				</div>
			{:else}
				<!-- Desktop Table View -->
				<div class="overflow-x-auto hidden md:block">
					<table class="table table-zebra">
						<thead>
							<tr>
								<th>Date</th>
								<th>Event</th>
								<th>Program</th>
								<th>Location</th>
								<th>Time</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{#each eventsToShow as event}
								<tr class="hover">
									<td class="font-medium">{formatEventDate(event.date)}</td>
									<td>
										<div class="font-semibold">{event.title || 'Untitled Event'}</div>
									</td>
									<td>
										{#if event.phwb_programs}
											<span class="badge badge-primary badge-sm">
												{event.phwb_programs.title}
											</span>
										{/if}
									</td>
									<td>
										{#if event.phwb_locations}
											<div class="text-sm">
												<div>{event.phwb_locations.name}</div>
												{#if event.phwb_locations.address}
													<div class="text-xs text-base-content/60">
														{event.phwb_locations.address}
													</div>
												{/if}
											</div>
										{:else}
											<span class="text-base-content/40">-</span>
										{/if}
									</td>
									<td>
										{#if event.start_time}
											<div class="text-sm">
												{formatEventTime(event.start_time)}
												{#if event.end_time}
													- {formatEventTime(event.end_time)}
												{/if}
											</div>
										{:else}
											<span class="text-base-content/40">TBD</span>
										{/if}
									</td>
									<td>
										{#if event.status}
											<span class="badge badge-sm" class:badge-success={event.status === 'confirmed'} class:badge-warning={event.status === 'pending'}>
												{event.status}
											</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Mobile Card View -->
				<div class="md:hidden space-y-3">
					{#each eventsToShow as event}
						<div class="card bg-base-200 shadow">
							<div class="card-body p-4">
								<div class="flex justify-between items-start gap-2">
									<h3 class="card-title text-base">{event.title || 'Untitled Event'}</h3>
									{#if event.status}
										<span class="badge badge-sm shrink-0" class:badge-success={event.status === 'confirmed'} class:badge-warning={event.status === 'pending'}>
											{event.status}
										</span>
									{/if}
								</div>

								<div class="space-y-2 text-sm">
									<div class="flex items-center gap-2">
										<span class="font-semibold">📅</span>
										<span>{formatEventDate(event.date)}</span>
									</div>

									{#if event.start_time}
										<div class="flex items-center gap-2">
											<span class="font-semibold">🕐</span>
											<span>
												{formatEventTime(event.start_time)}
												{#if event.end_time}
													- {formatEventTime(event.end_time)}
												{/if}
											</span>
										</div>
									{/if}

									{#if event.phwb_programs}
										<div class="flex items-center gap-2">
											<span class="font-semibold">📋</span>
											<span class="badge badge-primary badge-sm">
												{event.phwb_programs.title}
											</span>
										</div>
									{/if}

									{#if event.phwb_locations}
										<div class="flex items-start gap-2">
											<span class="font-semibold">📍</span>
											<div class="text-xs">
												<div>{event.phwb_locations.name}</div>
												{#if event.phwb_locations.address}
													<div class="text-base-content/60">
														{event.phwb_locations.address}
													</div>
												{/if}
											</div>
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if showEventView === 'upcoming' && data.stats.upcomingEvents > 10}
				<div class="card-actions justify-center mt-4">
					<button class="btn btn-outline btn-xs sm:btn-sm">View All Upcoming Events</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Programs Section -->
	{#if data.programs.length > 0}
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body p-3 sm:p-6">
				<h2 class="card-title text-lg sm:text-2xl">Your Programs</h2>
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
					{#each data.programs as program}
						<div class="card bg-base-200 shadow">
							<div class="card-body p-4">
								<h3 class="card-title text-sm sm:text-lg">{program.title}</h3>
								<div class="card-actions justify-end">
									<button class="btn btn-primary btn-xs sm:btn-sm">View Details</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Event Request Modal -->
{#if showRequestModal}
	<dialog class="modal modal-open">
		<div class="modal-box max-w-2xl w-full mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto">
			<h3 class="font-bold text-xl sm:text-2xl mb-4">Request New Event</h3>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					submitEventRequest();
				}}
				class="space-y-4"
			>
				<!-- Program Selection -->
				<div class="form-control">
					<label class="label" for="program">
						<span class="label-text font-medium">Program *</span>
					</label>
					<select
						id="program"
						bind:value={eventRequest.program}
						class="select select-bordered w-full"
						required
					>
						<option value="" disabled>Select a program</option>
						{#each data.programs as program}
							<option value={program.id}>{program.title}</option>
						{/each}
					</select>
				</div>

				<!-- Event Title -->
				<div class="form-control">
					<label class="label" for="title">
						<span class="label-text font-medium">Event Title *</span>
					</label>
					<input
						id="title"
						type="text"
						bind:value={eventRequest.title}
						placeholder="e.g., Spring Concert Series"
						class="input input-bordered w-full"
						required
					/>
				</div>

				<!-- Preferred Date -->
				<div class="form-control">
					<label class="label" for="preferred-date">
						<span class="label-text font-medium">Preferred Date *</span>
					</label>
					<input
						id="preferred-date"
						type="date"
						bind:value={eventRequest.preferredDate}
						class="input input-bordered w-full"
						required
					/>
				</div>

				<!-- Location -->
				<div class="form-control">
					<label class="label" for="location">
						<span class="label-text font-medium">Preferred Location</span>
					</label>
					<input
						id="location"
						type="text"
						bind:value={eventRequest.location}
						placeholder="e.g., Central Park, Your Venue Name"
						class="input input-bordered w-full"
					/>
				</div>

				<!-- Description -->
				<div class="form-control">
					<label class="label" for="description">
						<span class="label-text font-medium">Event Description *</span>
					</label>
					<textarea
						id="description"
						bind:value={eventRequest.description}
						placeholder="Describe the event, audience, and goals..."
						class="textarea textarea-bordered w-full h-24"
						required
					></textarea>
				</div>

				<!-- Special Requirements -->
				<div class="form-control">
					<label class="label" for="special-requirements">
						<span class="label-text font-medium">Special Requirements</span>
					</label>
					<textarea
						id="special-requirements"
						bind:value={eventRequest.specialRequirements}
						placeholder="Any special requests, equipment needs, accessibility requirements..."
						class="textarea textarea-bordered w-full h-24"
					></textarea>
				</div>

				<div class="modal-action">
					<button type="button" onclick={closeRequestModal} class="btn btn-ghost">Cancel</button>
					<button type="submit" class="btn btn-primary">Submit Request</button>
				</div>
			</form>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={closeRequestModal}>close</button>
		</form>
	</dialog>
{/if}
