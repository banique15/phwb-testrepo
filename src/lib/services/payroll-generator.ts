/**
 * Payroll Generator Service
 * 
 * Generates payroll entries from completed events using rate card rules.
 * Handles automatic bandleader fee calculation for quartets/quintets.
 */

import { supabase } from '$lib/supabase'
import type { 
	RateRule, 
	AdditionalFee, 
	RateCalculationResult,
	GeneratedPayrollEntry,
	PayrollGenerationResult 
} from '$lib/schemas/rate-card'
import { PaymentStatus, PaymentType, EmployeeContractorStatus, CreationMethod } from '$lib/schemas/payroll'

// Types for event data
interface ArtistAssignment {
	artist_id: string
	artist_name?: string
	role?: string
	status?: string
	num_hours?: number
	hourly_rate?: number
	confirmation_status?: string
}

interface EventWithAssignments {
	id: number
	title: string
	date: string
	start_time: string | null
	end_time: string | null
	status: string
	program: number | null
	venue: number | null
	number_of_musicians: number | null
	pm_hours: number | null
	pm_rate: number | null
	artists: {
		assignments?: ArtistAssignment[]
	} | null
	programs?: {
		id: number
		title: string
		program_type: string | null
	} | null
}

interface GenerationOptions {
	dryRun: boolean
	userId?: string
	rateCardId?: number
	overriddenEntries?: GeneratedPayrollEntry[]
}

/**
 * Get the Monday of the week containing the given date
 */
export function getWeekMonday(date: Date): Date {
	const d = new Date(date)
	const day = d.getDay()
	const diff = d.getDate() - day + (day === 0 ? -6 : 1)
	d.setDate(diff)
	d.setHours(0, 0, 0, 0)
	return d
}

/**
 * Get the Sunday of the week containing the given date
 */
export function getWeekSunday(date: Date): Date {
	const monday = getWeekMonday(date)
	const sunday = new Date(monday)
	sunday.setDate(monday.getDate() + 6)
	sunday.setHours(23, 59, 59, 999)
	return sunday
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
	return date.toISOString().split('T')[0]
}

/**
 * Calculate hours from event start/end times
 */
function calculateHoursFromEventTimes(startTime: string | null, endTime: string | null): number | null {
	if (!startTime || !endTime) return null
	
	try {
		const [startHours, startMins] = startTime.split(':').map(Number)
		const [endHours, endMins] = endTime.split(':').map(Number)
		const startTotal = startHours * 60 + startMins
		const endTotal = endHours * 60 + endMins
		const durationMinutes = endTotal - startTotal
		
		if (durationMinutes <= 0) return null
		return durationMinutes / 60
	} catch {
		return null
	}
}

/**
 * Get the active rate card
 */
async function getActiveRateCard(): Promise<{ id: number; name: string } | null> {
	const { data, error } = await supabase
		.from('phwb_rate_cards')
		.select('id, name')
		.eq('is_active', true)
		.single()
	
	if (error || !data) {
		console.error('Failed to get active rate card:', error)
		return null
	}
	
	return data
}

/**
 * Get rate rule for a specific program type
 */
async function getRateRule(rateCardId: number, programType: string): Promise<RateRule | null> {
	const { data, error } = await supabase
		.from('phwb_rate_rules')
		.select('*')
		.eq('rate_card_id', rateCardId)
		.eq('program_type', programType)
		.single()
	
	if (error) {
		// Try fallback to 'other' type
		const { data: fallback } = await supabase
			.from('phwb_rate_rules')
			.select('*')
			.eq('rate_card_id', rateCardId)
			.eq('program_type', 'other')
			.single()
		
		return fallback || null
	}
	
	return data
}

/**
 * Get bandleader fee from rate card
 */
async function getBandleaderFee(rateCardId: number): Promise<AdditionalFee | null> {
	const { data, error } = await supabase
		.from('phwb_additional_fees')
		.select('*')
		.eq('rate_card_id', rateCardId)
		.eq('fee_type', 'bandleader')
		.single()
	
	if (error) {
		console.error('Failed to get bandleader fee:', error)
		return null
	}
	
	return data
}

/**
 * Calculate pay for an artist based on rate rule.
 * musicianCount is used only to determine bandleader fee eligibility (e.g. quartet+);
 * additionalPay (e.g. bandleader fee) is never multiplied by musicianCount.
 */
function calculateArtistPay(
	hours: number,
	rateRule: RateRule,
	isLeader: boolean,
	musicianCount: number,
	bandleaderFee: AdditionalFee | null
): RateCalculationResult {
	let basePay = 0
	let calculationNotes = ''
	
	switch (rateRule.rate_type) {
		case 'tiered':
			// Healing Arts style: first hour rate + subsequent hour rate
			if (hours <= 1) {
				basePay = hours * (rateRule.first_hour_rate || 0)
				calculationNotes = `${hours}hr × $${rateRule.first_hour_rate} (first hour rate)`
			} else {
				const firstHourPay = rateRule.first_hour_rate || 0
				const subsequentHours = hours - 1
				const subsequentPay = subsequentHours * (rateRule.subsequent_hour_rate || 0)
				basePay = firstHourPay + subsequentPay
				calculationNotes = `1hr × $${rateRule.first_hour_rate} + ${subsequentHours}hr × $${rateRule.subsequent_hour_rate}`
			}
			break
			
		case 'hourly':
			basePay = hours * (rateRule.hourly_rate || 0)
			calculationNotes = `${hours}hr × $${rateRule.hourly_rate}/hr`
			break
			
		case 'flat':
			basePay = rateRule.flat_rate || 0
			calculationNotes = `Flat rate: $${rateRule.flat_rate}`
			break
	}
	
	// Bandleader fee: applied once per leader when ensemble size meets threshold (e.g. 4+).
	// additionalPay is never scaled by musicianCount.
	let additionalPay = 0
	let additionalPayReason: string | null = null
	
	if (bandleaderFee && isLeader && musicianCount >= (bandleaderFee.min_musicians || 4)) {
		additionalPay = bandleaderFee.amount
		additionalPayReason = 'Project Leader'
		calculationNotes += ` + $${bandleaderFee.amount} bandleader fee`
	}
	
	return {
		basePay,
		additionalPay,
		additionalPayReason,
		totalPay: basePay + additionalPay,
		calculationNotes,
		rateRuleId: rateRule.id,
		rateCardId: rateRule.rate_card_id
	}
}

/**
 * Check if an assignment is the leader
 * First assignment in the list is considered the leader unless role is specified
 */
function isLeaderAssignment(assignment: ArtistAssignment, allAssignments: ArtistAssignment[]): boolean {
	if (assignment.role === 'leader' || assignment.role === 'bandleader') {
		return true
	}
	// First assignment is the leader by default
	return allAssignments.indexOf(assignment) === 0
}

/**
 * Get events that already have payroll generated
 */
async function getEventsWithPayroll(eventIds: number[]): Promise<Set<number>> {
	if (eventIds.length === 0) return new Set()
	
	const { data, error } = await supabase
		.from('phwb_payroll')
		.select('source_event_id')
		.in('source_event_id', eventIds)
	
	if (error) {
		console.error('Failed to check existing payroll:', error)
		return new Set()
	}
	
	return new Set(data?.map(p => p.source_event_id).filter(Boolean) || [])
}

/**
 * Main function: Generate payroll for a date range
 */
export async function generatePayrollForDateRange(
	startDate: Date,
	endDate: Date,
	options: GenerationOptions
): Promise<PayrollGenerationResult> {
	const result: PayrollGenerationResult = {
		success: false,
		eventsProcessed: 0,
		entriesCreated: 0,
		totalAmount: 0,
		skippedEvents: 0,
		entries: [],
		errors: [],
		weekStart: formatDate(startDate),
		weekEnd: formatDate(endDate)
	}
	
	try {
		// 1. Get rate card (use specified or active)
		let rateCard: { id: number; name: string } | null = null
		
		if (options.rateCardId) {
			const { data, error } = await supabase
				.from('phwb_rate_cards')
				.select('id, name')
				.eq('id', options.rateCardId)
				.single()
			
			if (!error && data) {
				rateCard = data
			}
		}
		
		if (!rateCard) {
			rateCard = await getActiveRateCard()
		}
		
		if (!rateCard) {
			result.errors.push('No active rate card found')
			return result
		}
		
		// 2. Get bandleader fee
		const bandleaderFee = await getBandleaderFee(rateCard.id)
		
		// 3. Fetch completed events in date range
		const { data: events, error: eventsError } = await supabase
			.from('phwb_events')
			.select(`
				id,
				title,
				date,
				start_time,
				end_time,
				status,
				program,
				venue,
				number_of_musicians,
				pm_hours,
				pm_rate,
				artists,
				programs:program(id, title, program_type)
			`)
			.eq('status', 'completed')
			.gte('date', formatDate(startDate))
			.lte('date', formatDate(endDate))
		
		if (eventsError) {
			result.errors.push(`Failed to fetch events: ${eventsError.message}`)
			return result
		}
		
		if (!events || events.length === 0) {
			result.success = true
			return result
		}
		
		// 4. Check for existing payroll entries
		const existingPayrollEventIds = await getEventsWithPayroll(events.map(e => e.id))
		
		// 5. Filter events that don't have payroll yet
		const eventsToProcess = events.filter(e => !existingPayrollEventIds.has(e.id)) as unknown as EventWithAssignments[]
		result.skippedEvents = events.length - eventsToProcess.length
		
		// 6. Process each event
		for (const event of eventsToProcess) {
			try {
				const assignments = event.artists?.assignments || []
				const musicianCount = assignments.length || event.number_of_musicians || 1
				const programType = event.programs?.program_type || 'other'
				
				// Get rate rule for this program type
				const rateRule = await getRateRule(rateCard.id, programType)
				if (!rateRule) {
					result.errors.push(`No rate rule found for program type "${programType}" in event "${event.title}"`)
					continue
				}
				
				// Calculate gig duration from event times
				const gigDuration = calculateHoursFromEventTimes(event.start_time, event.end_time)
				
				// Process each artist assignment
				for (const assignment of assignments) {
					const isLeader = isLeaderAssignment(assignment, assignments)
					
					// Determine hours: use assignment hours, or calculated duration, or default from rate rule
					const hours = assignment.num_hours && assignment.num_hours > 0 
						? assignment.num_hours 
						: gigDuration || rateRule.min_hours || 1
					
					// Calculate pay
					const calculation = calculateArtistPay(
						hours,
						rateRule,
						isLeader,
						musicianCount,
						bandleaderFee
					)
					
					// Use assignment rate if specified, otherwise use calculated rate
					const effectiveRate = assignment.hourly_rate && assignment.hourly_rate > 0
						? assignment.hourly_rate
						: (rateRule.rate_type === 'hourly' ? rateRule.hourly_rate : rateRule.first_hour_rate) || 0
					
					const entry: GeneratedPayrollEntry = {
						event_id: event.id,
						event_date: event.date,
						artist_id: assignment.artist_id,
						artist_name: assignment.artist_name || 'Unknown Artist',
						venue_id: event.venue,
						program_id: event.program,
						hours,
						rate: effectiveRate,
						additional_pay: calculation.additionalPay,
						additional_pay_reason: calculation.additionalPayReason,
						total_pay: calculation.totalPay,
						number_of_musicians: musicianCount,
						gig_duration: gigDuration,
						employee_contractor_status: EmployeeContractorStatus.CONTRACTOR,
						rate_card_id: rateCard.id,
						rate_rule_id: rateRule.id,
						status: PaymentStatus.PLANNED,
						payment_type: PaymentType.PERFORMANCE,
						creation_method: CreationMethod.EVENT_AUTOMATION,
						source_event_id: event.id,
						notes: `Auto-generated from event: ${event.title}. ${calculation.calculationNotes}`
					}
					
					result.entries.push(entry)
					result.totalAmount += calculation.totalPay
				}
				
				// Process PM hours if set
				if (event.pm_hours && event.pm_hours > 0) {
					const pmRateRule = await getRateRule(rateCard.id, 'pm')
					const pmRate = event.pm_rate || pmRateRule?.hourly_rate || 39.79
					const pmTotalPay = event.pm_hours * pmRate
					
					const pmEntry: GeneratedPayrollEntry = {
						event_id: event.id,
						event_date: event.date,
						artist_id: null,
						artist_name: 'Production Manager',
						venue_id: event.venue,
						program_id: event.program,
						hours: event.pm_hours,
						rate: pmRate,
						additional_pay: 0,
						additional_pay_reason: null,
						total_pay: pmTotalPay,
						number_of_musicians: musicianCount,
						gig_duration: gigDuration,
						employee_contractor_status: EmployeeContractorStatus.CONTRACTOR,
						rate_card_id: rateCard.id,
						rate_rule_id: pmRateRule?.id || 0,
						status: PaymentStatus.PLANNED,
						payment_type: PaymentType.OTHER,
						creation_method: CreationMethod.EVENT_AUTOMATION,
						source_event_id: event.id,
						notes: `Production Manager - Auto-generated from event: ${event.title}`
					}
					
					result.entries.push(pmEntry)
					result.totalAmount += pmTotalPay
				}
				
				result.eventsProcessed++
			} catch (err) {
				result.errors.push(`Error processing event "${event.title}": ${err instanceof Error ? err.message : 'Unknown error'}`)
			}
		}
		
		// 7. Save entries if not dry run
		if (!options.dryRun && result.entries.length > 0) {
			// Use overridden entries if provided, otherwise use calculated entries
			const finalEntries = options.overriddenEntries || result.entries
			
			// Prepare entries for insert (remove artist_name which isn't in the table)
			const entriesToInsert = finalEntries.map(entry => ({
				event_date: entry.event_date,
				artist_id: entry.artist_id,
				venue_id: entry.venue_id,
				event_id: entry.event_id,
				hours: entry.hours,
				rate: entry.rate,
				additional_pay: entry.additional_pay,
				additional_pay_reason: entry.additional_pay_reason,
				status: entry.status,
				payment_type: entry.payment_type,
				employee_contractor_status: entry.employee_contractor_status,
				program_id: entry.program_id,
				number_of_musicians: entry.number_of_musicians,
				gig_duration: entry.gig_duration,
				rate_card_id: entry.rate_card_id,
				rate_rule_id: entry.rate_rule_id,
				creation_method: entry.creation_method,
				source_event_id: entry.source_event_id,
				notes: entry.notes,
				created_by: options.userId || 'system'
			}))
			
			const { error: insertError } = await supabase
				.from('phwb_payroll')
				.insert(entriesToInsert)
			
			if (insertError) {
				result.errors.push(`Failed to save payroll entries: ${insertError.message}`)
				return result
			}
			
			result.entriesCreated = result.entries.length
			
			// Log the generation
			await supabase.from('phwb_payroll_generation_log').insert({
				week_start: result.weekStart,
				week_end: result.weekEnd,
				events_processed: result.eventsProcessed,
				entries_created: result.entriesCreated,
				total_amount: result.totalAmount,
				skipped_events: result.skippedEvents,
				errors: result.errors.length > 0 ? result.errors : null,
				generated_by: options.userId || null,
				generation_method: 'manual'
			})
		}
		
		result.success = true
		return result
		
	} catch (err) {
		result.errors.push(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`)
		return result
	}
}

/**
 * Generate payroll for a specific week (Monday to Sunday)
 */
export async function generatePayrollForWeek(
	weekDate: Date,
	options: GenerationOptions
): Promise<PayrollGenerationResult> {
	const monday = getWeekMonday(weekDate)
	const sunday = getWeekSunday(weekDate)
	return generatePayrollForDateRange(monday, sunday, options)
}

/**
 * Get preview of payroll that would be generated for a date range
 */
export async function previewPayrollGeneration(
	startDate: Date,
	endDate: Date
): Promise<PayrollGenerationResult> {
	return generatePayrollForDateRange(startDate, endDate, { dryRun: true })
}

/**
 * Generate payroll for a single event (typically called when event is marked as completed)
 */
export async function generatePayrollForEvent(
	eventId: number,
	options: { dryRun?: boolean; userId?: string } = {}
): Promise<PayrollGenerationResult> {
	const result: PayrollGenerationResult = {
		success: false,
		eventsProcessed: 0,
		entriesCreated: 0,
		totalAmount: 0,
		skippedEvents: 0,
		entries: [],
		errors: [],
		weekStart: '',
		weekEnd: ''
	}

	try {
		// 1. Check if payroll already exists for this event
		const { data: existingPayroll, error: checkError } = await supabase
			.from('phwb_payroll')
			.select('id')
			.eq('source_event_id', eventId)
			.limit(1)

		if (checkError) {
			result.errors.push(`Failed to check existing payroll: ${checkError.message}`)
			return result
		}

		if (existingPayroll && existingPayroll.length > 0) {
			result.skippedEvents = 1
			result.success = true
			return result
		}

		// 2. Get the event with program data
		const { data: event, error: eventError } = await supabase
			.from('phwb_events')
			.select(`
				id,
				title,
				date,
				start_time,
				end_time,
				status,
				program,
				venue,
				number_of_musicians,
				pm_hours,
				pm_rate,
				artists,
				programs:program(id, title, program_type)
			`)
			.eq('id', eventId)
			.single()

		if (eventError || !event) {
			result.errors.push(`Failed to fetch event: ${eventError?.message || 'Event not found'}`)
			return result
		}

		result.weekStart = event.date
		result.weekEnd = event.date

		// 3. Get active rate card
		const rateCard = await getActiveRateCard()
		if (!rateCard) {
			result.errors.push('No active rate card found')
			return result
		}

		// 4. Get bandleader fee
		const bandleaderFee = await getBandleaderFee(rateCard.id)

		// 5. Process the event
		const typedEvent = event as unknown as EventWithAssignments
		const assignments = typedEvent.artists?.assignments || []
		const musicianCount = assignments.length || typedEvent.number_of_musicians || 1
		const programType = typedEvent.programs?.program_type || 'other'

		// Get rate rule for this program type
		const rateRule = await getRateRule(rateCard.id, programType)
		if (!rateRule) {
			result.errors.push(`No rate rule found for program type "${programType}"`)
			return result
		}

		// Calculate gig duration from event times
		const gigDuration = calculateHoursFromEventTimes(typedEvent.start_time, typedEvent.end_time)

		// Process each artist assignment
		for (const assignment of assignments) {
			const isLeader = isLeaderAssignment(assignment, assignments)

			// Determine hours: use assignment hours, or calculated duration, or default from rate rule
			const hours = assignment.num_hours && assignment.num_hours > 0
				? assignment.num_hours
				: gigDuration || rateRule.min_hours || 1

			// Calculate pay
			const calculation = calculateArtistPay(
				hours,
				rateRule,
				isLeader,
				musicianCount,
				bandleaderFee
			)

			// Use assignment rate if specified, otherwise use calculated rate
			const effectiveRate = assignment.hourly_rate && assignment.hourly_rate > 0
				? assignment.hourly_rate
				: (rateRule.rate_type === 'hourly' ? rateRule.hourly_rate : rateRule.first_hour_rate) || 0

			const entry: GeneratedPayrollEntry = {
				event_id: typedEvent.id,
				event_date: typedEvent.date,
				artist_id: assignment.artist_id,
				artist_name: assignment.artist_name || 'Unknown Artist',
				venue_id: typedEvent.venue,
				program_id: typedEvent.program,
				hours,
				rate: effectiveRate,
				additional_pay: calculation.additionalPay,
				additional_pay_reason: calculation.additionalPayReason,
				total_pay: calculation.totalPay,
				number_of_musicians: musicianCount,
				gig_duration: gigDuration,
				employee_contractor_status: EmployeeContractorStatus.CONTRACTOR,
				rate_card_id: rateCard.id,
				rate_rule_id: rateRule.id,
				status: PaymentStatus.PLANNED,
				payment_type: PaymentType.PERFORMANCE,
				creation_method: CreationMethod.EVENT_AUTOMATION,
				source_event_id: typedEvent.id,
				notes: `Auto-generated on event completion: ${typedEvent.title}. ${calculation.calculationNotes}`
			}

			result.entries.push(entry)
			result.totalAmount += calculation.totalPay
		}

		// Process PM hours if set
		if (typedEvent.pm_hours && typedEvent.pm_hours > 0) {
			const pmRateRule = await getRateRule(rateCard.id, 'pm')
			const pmRate = typedEvent.pm_rate || pmRateRule?.hourly_rate || 39.79
			const pmTotalPay = typedEvent.pm_hours * pmRate

			const pmEntry: GeneratedPayrollEntry = {
				event_id: typedEvent.id,
				event_date: typedEvent.date,
				artist_id: null,
				artist_name: 'Production Manager',
				venue_id: typedEvent.venue,
				program_id: typedEvent.program,
				hours: typedEvent.pm_hours,
				rate: pmRate,
				additional_pay: 0,
				additional_pay_reason: null,
				total_pay: pmTotalPay,
				number_of_musicians: musicianCount,
				gig_duration: gigDuration,
				employee_contractor_status: EmployeeContractorStatus.CONTRACTOR,
				rate_card_id: rateCard.id,
				rate_rule_id: pmRateRule?.id || 0,
				status: PaymentStatus.PLANNED,
				payment_type: PaymentType.OTHER,
				creation_method: CreationMethod.EVENT_AUTOMATION,
				source_event_id: typedEvent.id,
				notes: `Production Manager - Auto-generated on event completion: ${typedEvent.title}`
			}

			result.entries.push(pmEntry)
			result.totalAmount += pmTotalPay
		}

		result.eventsProcessed = 1

		// 6. Save entries if not dry run
		if (!options.dryRun && result.entries.length > 0) {
			const entriesToInsert = result.entries.map(entry => ({
				event_date: entry.event_date,
				artist_id: entry.artist_id,
				venue_id: entry.venue_id,
				event_id: entry.event_id,
				hours: entry.hours,
				rate: entry.rate,
				additional_pay: entry.additional_pay,
				additional_pay_reason: entry.additional_pay_reason,
				status: entry.status,
				payment_type: entry.payment_type,
				employee_contractor_status: entry.employee_contractor_status,
				program_id: entry.program_id,
				number_of_musicians: entry.number_of_musicians,
				gig_duration: entry.gig_duration,
				rate_card_id: entry.rate_card_id,
				rate_rule_id: entry.rate_rule_id,
				creation_method: entry.creation_method,
				source_event_id: entry.source_event_id,
				notes: entry.notes,
				created_by: options.userId || 'system'
			}))

			const { error: insertError } = await supabase
				.from('phwb_payroll')
				.insert(entriesToInsert)

			if (insertError) {
				result.errors.push(`Failed to save payroll entries: ${insertError.message}`)
				return result
			}

			result.entriesCreated = result.entries.length

			// Log the generation
			await supabase.from('phwb_payroll_generation_log').insert({
				week_start: result.weekStart,
				week_end: result.weekEnd,
				events_processed: 1,
				entries_created: result.entriesCreated,
				total_amount: result.totalAmount,
				skipped_events: 0,
				errors: result.errors.length > 0 ? result.errors : null,
				generated_by: options.userId || null,
				generation_method: 'automated',
				notes: `Auto-generated on event completion: ${typedEvent.title}`
			})
		}

		result.success = true
		return result

	} catch (err) {
		result.errors.push(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`)
		return result
	}
}
