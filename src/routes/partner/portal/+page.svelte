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
	<!-- Welcome Section -->
	<div class="hero bg-base-100 rounded-lg shadow-xl">
		<div class="hero-content flex-col lg:flex-row-reverse gap-8 py-8">
			{#if data.partner.logo}
				<img
					src={data.partner.logo}
					alt={data.partner.name}
					class="max-w-xs rounded-lg shadow-2xl"
				/>
			{:else}
				<div class="w-64 h-64 bg-primary/10 rounded-lg flex items-center justify-center">
					<span class="text-8xl">🤝</span>
				</div>
			{/if}
			<div>
				<h1 class="text-5xl font-bold">{data.partner.name}</h1>
				{#if data.partner.organization}
					<p class="text-xl text-base-content/70 mt-2">{data.partner.organization}</p>
				{/if}
				{#if data.partner.description}
					<p class="py-6 max-w-2xl">{data.partner.description}</p>
				{/if}
				<button onclick={openRequestModal} class="btn btn-primary btn-lg gap-2">
					<span class="text-xl">➕</span>
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
		<div class="card-body">
			<div class="flex justify-between items-center mb-4">
				<h2 class="card-title text-2xl">Your Events</h2>

				<!-- Event View Toggle -->
				<div class="join">
					<button
						class="join-item btn btn-sm"
						class:btn-active={showEventView === 'upcoming'}
						onclick={() => (showEventView = 'upcoming')}
					>
						Upcoming ({data.stats.upcomingEvents})
					</button>
					<button
						class="join-item btn btn-sm"
						class:btn-active={showEventView === 'past'}
						onclick={() => (showEventView = 'past')}
					>
						Past ({data.stats.pastEvents})
					</button>
				</div>
			</div>

			{#if eventsToShow.length === 0}
				<div class="alert">
					<span class="text-2xl">📭</span>
					<span>
						{showEventView === 'upcoming'
							? 'No upcoming events scheduled.'
							: 'No past events found.'}
					</span>
				</div>
			{:else}
				<div class="overflow-x-auto">
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
			{/if}

			{#if showEventView === 'upcoming' && data.stats.upcomingEvents > 10}
				<div class="card-actions justify-center mt-4">
					<button class="btn btn-outline btn-sm">View All Upcoming Events</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Programs Section -->
	{#if data.programs.length > 0}
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title text-2xl">Your Programs</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{#each data.programs as program}
						<div class="card bg-base-200 shadow">
							<div class="card-body">
								<h3 class="card-title text-lg">{program.title}</h3>
								<div class="card-actions justify-end">
									<button class="btn btn-primary btn-sm">View Details</button>
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
		<div class="modal-box max-w-2xl">
			<h3 class="font-bold text-2xl mb-4">Request New Event</h3>

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
