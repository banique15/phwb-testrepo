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
	is_bandleader?: boolean
	status?: string
	num_hours?: number
	hourly_rate?: number
	confirmation_status?: string
	paid_through_artist_id?: string | null
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
	location_id: number | null
	number_of_musicians: number | null
	pm_hours: number | null
	pm_rate: number | null
	production_manager_id: string | null
	production_manager_artist_id: string | null
	artists: {
		assignments?: ArtistAssignment[]
	} | null
	programs?: {
		id: number
		title: string
		program_type: string | null
	} | null
}

interface ProductionManagerPayrollInfo {
	artistId: string | null
	name: string
}

interface GenerationOptions {
	dryRun: boolean
	userId?: string
	rateCardId?: number
	overriddenEntries?: GeneratedPayrollEntry[]
	eventOverride?: Record<string, any>
}

interface ArtistCompProfile {
	employment_status: string | null
	paid_through_artist_id: string | null
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

function getDisplayNameFromParts(
	fullName: string | null | undefined,
	firstName: string | null | undefined,
	lastName: string | null | undefined,
	fallback = 'Production Manager'
): string {
	if (fullName) return fullName
	const fromParts = [firstName || '', lastName || ''].filter(Boolean).join(' ').trim()
	return fromParts || fallback
}

function getDisplayRateForRule(rule: RateRule): number {
	if (rule.rate_type === 'flat') return rule.flat_rate || 0
	if (rule.rate_type === 'tiered') return rule.first_hour_rate || 0
	return rule.hourly_rate || 0
}

function getRateDetailsForRule(rule: RateRule): Pick<GeneratedPayrollEntry, 'rate_type' | 'base_rate' | 'additional_rate' | 'rate_description'> {
	if (rule.rate_type === 'tiered') {
		return {
			rate_type: 'tiered',
			base_rate: rule.first_hour_rate ?? null,
			additional_rate: rule.subsequent_hour_rate ?? null,
			rate_description: rule.description ?? null
		}
	}

	if (rule.rate_type === 'flat') {
		return {
			rate_type: 'flat',
			base_rate: rule.flat_rate ?? null,
			additional_rate: null,
			rate_description: rule.description ?? null
		}
	}

	return {
		rate_type: 'hourly',
		base_rate: rule.hourly_rate ?? null,
		additional_rate: null,
		rate_description: rule.description ?? null
	}
}

function mapEmploymentStatusToWorkerType(employmentStatus: string | null | undefined): string {
	return employmentStatus === 'W-2' ? EmployeeContractorStatus.W2 : EmployeeContractorStatus.T1099
}

function ensureProductionManagersInsertedLast(entries: GeneratedPayrollEntry[]): GeneratedPayrollEntry[] {
	const performerRows = entries.filter((entry) => !entry.is_production_manager)
	const pmRows = entries.filter((entry) => !!entry.is_production_manager)
	return [...performerRows, ...pmRows]
}

function shouldRetryWithoutTotalPay(error: any): boolean {
	const message = String(error?.message || '').toLowerCase()
	return message.includes('total_pay') && message.includes('non-default')
}

async function insertPayrollRowsWithCompat(rows: Record<string, any>[]): Promise<{ error: any }> {
	const firstAttempt = await supabase.from('phwb_payroll').insert(rows)
	if (!firstAttempt.error || !shouldRetryWithoutTotalPay(firstAttempt.error)) {
		return { error: firstAttempt.error }
	}

	// Some DB variants compute total_pay server-side (generated/default-only column).
	// Retry without total_pay in that case.
	const rowsWithoutTotal = rows.map((row) => {
		const sanitized = { ...row }
		delete (sanitized as any).total_pay
		return sanitized
	})
	const secondAttempt = await supabase.from('phwb_payroll').insert(rowsWithoutTotal)
	return { error: secondAttempt.error }
}

function applyProductionManagerCreatedAtOffset(rows: Record<string, any>[]): Record<string, any>[] {
	// Keep PM rows 1 second later so created_at-driven views place PM first.
	// This avoids relying on same-timestamp DB ordering during bulk inserts.
	const baseCreatedAt = new Date()
	const pmCreatedAt = new Date(baseCreatedAt.getTime() + 1000)
	return rows.map((row) => ({
		...row,
		created_at: row.is_production_manager ? pmCreatedAt.toISOString() : baseCreatedAt.toISOString()
	}))
}

async function getArtistCompProfiles(artistIds: string[]): Promise<Map<string, ArtistCompProfile>> {
	const profileMap = new Map<string, ArtistCompProfile>()
	if (artistIds.length === 0) return profileMap

	const uniqueIds = Array.from(new Set(artistIds))
	const { data, error } = await supabase
		.from('phwb_artists')
		.select('id, employment_status, paid_through_artist_id')
		.in('id', uniqueIds)

	if (error || !data) {
		console.error('Failed to load artist compensation profiles:', error)
		return profileMap
	}

	for (const row of data) {
		profileMap.set(row.id, {
			employment_status: row.employment_status ?? null,
			paid_through_artist_id: row.paid_through_artist_id ?? null
		})
	}

	return profileMap
}

function applyLlcOwnerRollup(
	entries: GeneratedPayrollEntry[],
	assignments: ArtistAssignment[],
	artistProfiles: Map<string, ArtistCompProfile>
): GeneratedPayrollEntry[] {
	const assignmentArtistIds = new Set(assignments.map((a) => a.artist_id))
	const rollups = new Map<string, string>()

	for (const assignment of assignments) {
		const profile = artistProfiles.get(assignment.artist_id)
		const ownerId = assignment.paid_through_artist_id ?? profile?.paid_through_artist_id ?? null
		if (!ownerId || ownerId === assignment.artist_id) continue
		if (!assignmentArtistIds.has(ownerId)) continue
		rollups.set(assignment.artist_id, ownerId)
	}

	if (rollups.size === 0) return entries

	const entryByArtistId = new Map<string, GeneratedPayrollEntry>()
	for (const entry of entries) {
		if (entry.artist_id && entry.payment_type === PaymentType.PERFORMANCE && !entry.is_production_manager) {
			entryByArtistId.set(entry.artist_id, entry)
		}
	}

	const subordinateIdsToRemove = new Set<string>()

	for (const [subordinateId, ownerId] of rollups.entries()) {
		const subordinateEntry = entryByArtistId.get(subordinateId)
		const ownerEntry = entryByArtistId.get(ownerId)
		if (!subordinateEntry || !ownerEntry) continue

		ownerEntry.total_pay += subordinateEntry.total_pay
		ownerEntry.additional_pay += subordinateEntry.additional_pay
		ownerEntry.notes = `${ownerEntry.notes} | Includes ${subordinateEntry.artist_name} paid through LLC owner`
		subordinateIdsToRemove.add(subordinateId)
	}

	return entries.filter((entry) => {
		if (!entry.artist_id) return true
		return !subordinateIdsToRemove.has(entry.artist_id)
	})
}

async function resolveProductionManagerPayrollInfo(event: EventWithAssignments): Promise<ProductionManagerPayrollInfo | null> {
	let artistId = event.production_manager_artist_id || null
	let displayName: string | null = null

	if (event.production_manager_id) {
		const { data: pmRow } = await supabase
			.from('phwb_production_managers')
			.select('full_name, legal_first_name, legal_last_name, artist_id')
			.eq('id', event.production_manager_id)
			.maybeSingle()

		if (pmRow) {
			artistId = artistId || pmRow.artist_id || null
			displayName = getDisplayNameFromParts(pmRow.full_name, pmRow.legal_first_name, pmRow.legal_last_name)
		}
	}

	if (artistId) {
		const { data: artistRow } = await supabase
			.from('phwb_artists')
			.select('full_name, legal_first_name, legal_last_name, artist_name')
			.eq('id', artistId)
			.maybeSingle()

		if (artistRow) {
			displayName =
				artistRow.full_name ||
				getDisplayNameFromParts(null, artistRow.legal_first_name, artistRow.legal_last_name, artistRow.artist_name || 'Production Manager')
		}
	}

	if (!event.production_manager_id && !artistId) return null

	return {
		artistId,
		name: displayName || 'Production Manager'
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
 * Get rate rule for a specific program/program type
 */
async function getRateRule(rateCardId: number, programType: string, programId?: number | null): Promise<RateRule | null> {
	// Primary path: use the generic rule for the selected program type.
	// This aligns with the new program_type-driven assignment workflow.
	const { data: genericByType, error: genericError } = await supabase
		.from('phwb_rate_rules')
		.select('*')
		.eq('rate_card_id', rateCardId)
		.eq('program_type', programType)
		.is('program_id', null)
		.order('updated_at', { ascending: false })
		.limit(1)

	if (!genericError && genericByType && genericByType.length > 0) {
		return genericByType[0]
	}

	// Backward-compatible path: if no generic rule exists, allow a
	// program-specific rule with the same type.
	if (typeof programId === 'number') {
		const { data: specific, error: specificError } = await supabase
			.from('phwb_rate_rules')
			.select('*')
			.eq('rate_card_id', rateCardId)
			.eq('program_id', programId)
			.eq('program_type', programType)
			.order('updated_at', { ascending: false })
			.limit(1)

		if (!specificError && specific && specific.length > 0) {
			return specific[0]
		}
	}

	// Additional backward-compatible fallback: if there is no generic rule and
	// no exact program-specific match, use any rule for this program_type.
	// This preserves legacy cards where a single type rule was created as
	// program-specific instead of generic.
	const { data: anyByType, error: anyByTypeError } = await supabase
		.from('phwb_rate_rules')
		.select('*')
		.eq('rate_card_id', rateCardId)
		.eq('program_type', programType)
		.order('program_id', { ascending: true, nullsFirst: true })
		.order('updated_at', { ascending: false })
		.limit(1)

	if (!anyByTypeError && anyByType && anyByType.length > 0) {
		return anyByType[0]
	}

	const { data, error } = await supabase
		.from('phwb_rate_rules')
		.select('*')
		.eq('rate_card_id', rateCardId)
		.eq('program_type', programType)
		.is('program_id', null)
		.order('updated_at', { ascending: false })
		.limit(1)
	
	if (error) {
		// Try fallback to 'other' type
		const { data: fallback, error: fallbackError } = await supabase
			.from('phwb_rate_rules')
			.select('*')
			.eq('rate_card_id', rateCardId)
			.eq('program_type', 'other')
			.limit(1)
		if (fallbackError) return null
		return fallback?.[0] || null
	}

	if (data && data.length > 0) return data[0]

	// No exact program-type match; try "other" without treating as an API error.
	const { data: fallback, error: fallbackError } = await supabase
		.from('phwb_rate_rules')
		.select('*')
		.eq('rate_card_id', rateCardId)
		.eq('program_type', 'other')
		.limit(1)
	if (fallbackError) return null
	return fallback?.[0] || null
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

async function buildLocationFacilityMap(locationIds: number[]): Promise<Map<number, number | null>> {
	const map = new Map<number, number | null>()
	if (locationIds.length === 0) return map

	const uniqueLocationIds = Array.from(new Set(locationIds.filter((id) => Number.isFinite(id))))
	if (uniqueLocationIds.length === 0) return map

	const { data, error } = await supabase
		.from('phwb_locations')
		.select('id, facility_id')
		.in('id', uniqueLocationIds)

	if (error || !data) {
		console.error('Failed to resolve location facility mapping:', error)
		return map
	}

	for (const row of data) {
		map.set(row.id, row.facility_id ?? null)
	}

	return map
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
	if (assignment.is_bandleader) {
		return true
	}
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
				location_id,
				number_of_musicians,
				pm_hours,
				pm_rate,
				production_manager_id,
				production_manager_artist_id,
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
		const locationFacilityMap = await buildLocationFacilityMap(
			eventsToProcess
				.map((event) => event.location_id)
				.filter((id): id is number => typeof id === 'number')
		)
		
		// 6. Process each event
		for (const event of eventsToProcess) {
			try {
				const assignments = event.artists?.assignments || []
				const artistProfiles = await getArtistCompProfiles(assignments.map((a) => a.artist_id))
				const musicianCount = assignments.length || event.number_of_musicians || 1
				const programType = event.programs?.program_type || 'other'
				const facilityId = typeof event.location_id === 'number'
					? (locationFacilityMap.get(event.location_id) ?? null)
					: null
				
				// Get rate rule for this program type
				const rateRule = await getRateRule(rateCard.id, programType, event.program)
				if (!rateRule) {
					result.errors.push(`No rate rule found for program type "${programType}" in event "${event.title}"`)
					continue
				}
				
				// Calculate gig duration from event times
				const gigDuration = calculateHoursFromEventTimes(event.start_time, event.end_time)
				
				const eventEntries: GeneratedPayrollEntry[] = []

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
					
					// For hourly rules, preserve explicit assignment hourly_rate overrides.
					// For tiered/flat rules, always reflect the rate card rule.
					const effectiveRate = rateRule.rate_type === 'hourly'
						? ((assignment.hourly_rate && assignment.hourly_rate > 0)
							? assignment.hourly_rate
							: (rateRule.hourly_rate || 0))
						: (rateRule.rate_type === 'tiered'
							? (rateRule.first_hour_rate || 0)
							: (rateRule.flat_rate || 0))
					const rateDetails = getRateDetailsForRule(rateRule)
					
					const artistProfile = artistProfiles.get(assignment.artist_id)
					const entry: GeneratedPayrollEntry = {
						event_id: event.id,
						event_date: event.date,
						artist_id: assignment.artist_id,
						artist_name: assignment.artist_name || 'Unknown Artist',
						payee_name: assignment.artist_name || 'Unknown Artist',
						venue_id: event.venue,
						facility_id: facilityId,
						program_id: event.program,
						hours,
						rate: effectiveRate,
						rate_type: rateDetails.rate_type,
						base_rate: rateDetails.base_rate,
						additional_rate: rateDetails.additional_rate,
						rate_description: rateDetails.rate_description,
						additional_pay: calculation.additionalPay,
						additional_pay_reason: calculation.additionalPayReason,
						total_pay: calculation.totalPay,
						number_of_musicians: musicianCount,
						gig_duration: gigDuration,
						employee_contractor_status: mapEmploymentStatusToWorkerType(artistProfile?.employment_status),
						rate_card_id: rateCard.id,
						rate_rule_id: rateRule.id,
						status: PaymentStatus.PLANNED,
						payment_type: PaymentType.PERFORMANCE,
						creation_method: CreationMethod.EVENT_AUTOMATION,
						source_event_id: event.id,
						notes: `Auto-generated from event: ${event.title}. ${calculation.calculationNotes}`
					}
					
					eventEntries.push(entry)
				}

				// Process production manager payroll:
				// Event duration + 2 hours (1 hour before and 1 hour after), using PM rate card rule.
				const pmInfo = await resolveProductionManagerPayrollInfo(event)
				if (pmInfo) {
					const pmRateRule = await getRateRule(rateCard.id, 'pm')
					if (!pmRateRule) {
						result.errors.push(`No PM rate rule found for event "${event.title}"`)
					} else {
						const baseDuration = gigDuration || rateRule.min_hours || 1
						const pmHours = baseDuration + 2
						const pmCalculation = calculateArtistPay(pmHours, pmRateRule, false, musicianCount, null)
						const pmRate = getDisplayRateForRule(pmRateRule)
						const pmRateDetails = getRateDetailsForRule(pmRateRule)

						const pmEmploymentStatus = pmInfo.artistId
							? artistProfiles.get(pmInfo.artistId)?.employment_status ?? null
							: null
						const pmEntry: GeneratedPayrollEntry = {
							event_id: event.id,
							event_date: event.date,
							artist_id: pmInfo.artistId,
							artist_name: pmInfo.name,
							payee_name: pmInfo.name,
							venue_id: event.venue,
							facility_id: facilityId,
							program_id: event.program,
							hours: pmHours,
							rate: pmRate,
							rate_type: pmRateDetails.rate_type,
							base_rate: pmRateDetails.base_rate,
							additional_rate: pmRateDetails.additional_rate,
							rate_description: pmRateDetails.rate_description,
							additional_pay: 0,
							additional_pay_reason: null,
							total_pay: pmCalculation.totalPay,
							number_of_musicians: musicianCount,
							gig_duration: gigDuration,
							employee_contractor_status: mapEmploymentStatusToWorkerType(pmEmploymentStatus),
							rate_card_id: rateCard.id,
							rate_rule_id: pmRateRule.id,
							status: PaymentStatus.PLANNED,
							payment_type: PaymentType.OTHER,
							is_production_manager: true,
							creation_method: CreationMethod.EVENT_AUTOMATION,
							source_event_id: event.id,
							notes: `Production Manager (${pmHours.toFixed(2)}h = event duration + 2h) - Auto-generated from event: ${event.title}`
						}
						
						eventEntries.push(pmEntry)
					}
				}

				const rolledUpEventEntries = applyLlcOwnerRollup(eventEntries, assignments, artistProfiles)
				result.entries.push(...rolledUpEventEntries)
				result.totalAmount += rolledUpEventEntries.reduce((sum, entry) => sum + entry.total_pay, 0)
				
				result.eventsProcessed++
			} catch (err) {
				result.errors.push(`Error processing event "${event.title}": ${err instanceof Error ? err.message : 'Unknown error'}`)
			}
		}
		
		// 7. Save entries if not dry run
		if (!options.dryRun && result.entries.length > 0) {
			// Use overridden entries if provided, otherwise use calculated entries
			const finalEntries = ensureProductionManagersInsertedLast(options.overriddenEntries || result.entries)
			
			// Prepare entries for insert (remove artist_name which isn't in the table)
			const entriesToInsert = finalEntries.map(entry => ({
				event_date: entry.event_date,
				artist_id: entry.artist_id,
				venue_id: entry.venue_id,
				facility_id: entry.facility_id ?? null,
				event_id: entry.event_id,
				hours: entry.hours,
				rate: entry.rate,
				rate_type: entry.rate_type,
				base_rate: entry.base_rate,
				additional_rate: entry.additional_rate,
				rate_description: entry.rate_description,
				additional_pay: entry.additional_pay,
				additional_pay_reason: entry.additional_pay_reason,
				total_pay: entry.total_pay,
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
				payee_name: entry.payee_name ?? null,
				is_production_manager: entry.is_production_manager ?? false,
				linked_payroll_id: entry.linked_payroll_id ?? null,
				adjustment_type: entry.adjustment_type ?? null,
				notes: entry.notes,
				created_by: options.userId || 'system'
			}))
			
			const insertRowsWithPmOffset = applyProductionManagerCreatedAtOffset(entriesToInsert)
			const { error: insertError } = await insertPayrollRowsWithCompat(insertRowsWithPmOffset)
			
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
	options: { dryRun?: boolean; userId?: string; overriddenEntries?: GeneratedPayrollEntry[]; forceRegenerate?: boolean; eventOverride?: Record<string, any> } = {}
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

		if (!options.dryRun && !options.forceRegenerate && existingPayroll && existingPayroll.length > 0) {
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
				location_id,
				number_of_musicians,
				pm_hours,
				pm_rate,
				production_manager_id,
				production_manager_artist_id,
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
		const typedEvent = {
			...(event as unknown as EventWithAssignments),
			...(options.eventOverride || {})
		} as EventWithAssignments
		const assignments = typedEvent.artists?.assignments || []
		const artistProfiles = await getArtistCompProfiles(assignments.map((a) => a.artist_id))
		const musicianCount = assignments.length || typedEvent.number_of_musicians || 1
		const programType = typedEvent.programs?.program_type || 'other'
		const locationFacilityMap = await buildLocationFacilityMap(
			typeof typedEvent.location_id === 'number' ? [typedEvent.location_id] : []
		)
		const facilityId = typeof typedEvent.location_id === 'number'
			? (locationFacilityMap.get(typedEvent.location_id) ?? null)
			: null

		// Get rate rule for this program type
		const rateRule = await getRateRule(rateCard.id, programType, typedEvent.program)
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

			// For hourly rules, preserve explicit assignment hourly_rate overrides.
			// For tiered/flat rules, always reflect the rate card rule.
			const effectiveRate = rateRule.rate_type === 'hourly'
				? ((assignment.hourly_rate && assignment.hourly_rate > 0)
					? assignment.hourly_rate
					: (rateRule.hourly_rate || 0))
				: (rateRule.rate_type === 'tiered'
					? (rateRule.first_hour_rate || 0)
					: (rateRule.flat_rate || 0))
			const rateDetails = getRateDetailsForRule(rateRule)

			const artistProfile = artistProfiles.get(assignment.artist_id)
			const entry: GeneratedPayrollEntry = {
				event_id: typedEvent.id,
				event_date: typedEvent.date,
				artist_id: assignment.artist_id,
				artist_name: assignment.artist_name || 'Unknown Artist',
				payee_name: assignment.artist_name || 'Unknown Artist',
				venue_id: typedEvent.venue,
				facility_id: facilityId,
				program_id: typedEvent.program,
				hours,
				rate: effectiveRate,
				rate_type: rateDetails.rate_type,
				base_rate: rateDetails.base_rate,
				additional_rate: rateDetails.additional_rate,
				rate_description: rateDetails.rate_description,
				additional_pay: calculation.additionalPay,
				additional_pay_reason: calculation.additionalPayReason,
				total_pay: calculation.totalPay,
				number_of_musicians: musicianCount,
				gig_duration: gigDuration,
				employee_contractor_status: mapEmploymentStatusToWorkerType(artistProfile?.employment_status),
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

		result.entries = applyLlcOwnerRollup(result.entries, assignments, artistProfiles)
		result.totalAmount = result.entries.reduce((sum, entry) => sum + entry.total_pay, 0)

		// Process production manager payroll:
		// Event duration + 2 hours (1 hour before and 1 hour after), using PM rate card rule.
		const pmInfo = await resolveProductionManagerPayrollInfo(typedEvent)
		if (pmInfo) {
			const pmRateRule = await getRateRule(rateCard.id, 'pm')
			if (!pmRateRule) {
				result.errors.push('No PM rate rule found')
			} else {
				const baseDuration = gigDuration || rateRule.min_hours || 1
				const pmHours = baseDuration + 2
				const pmCalculation = calculateArtistPay(pmHours, pmRateRule, false, musicianCount, null)
				const pmRate = getDisplayRateForRule(pmRateRule)
				const pmRateDetails = getRateDetailsForRule(pmRateRule)

				const pmEmploymentStatus = pmInfo.artistId
					? artistProfiles.get(pmInfo.artistId)?.employment_status ?? null
					: null
				const pmEntry: GeneratedPayrollEntry = {
					event_id: typedEvent.id,
					event_date: typedEvent.date,
					artist_id: pmInfo.artistId,
					artist_name: pmInfo.name,
					payee_name: pmInfo.name,
					venue_id: typedEvent.venue,
					facility_id: facilityId,
					program_id: typedEvent.program,
					hours: pmHours,
					rate: pmRate,
					rate_type: pmRateDetails.rate_type,
					base_rate: pmRateDetails.base_rate,
					additional_rate: pmRateDetails.additional_rate,
					rate_description: pmRateDetails.rate_description,
					additional_pay: 0,
					additional_pay_reason: null,
					total_pay: pmCalculation.totalPay,
					number_of_musicians: musicianCount,
					gig_duration: gigDuration,
					employee_contractor_status: mapEmploymentStatusToWorkerType(pmEmploymentStatus),
					rate_card_id: rateCard.id,
					rate_rule_id: pmRateRule.id,
					status: PaymentStatus.PLANNED,
					payment_type: PaymentType.OTHER,
					is_production_manager: true,
					creation_method: CreationMethod.EVENT_AUTOMATION,
					source_event_id: typedEvent.id,
					notes: `Production Manager (${pmHours.toFixed(2)}h = event duration + 2h) - Auto-generated on event completion: ${typedEvent.title}`
				}

				result.entries.push(pmEntry)
				result.totalAmount += pmCalculation.totalPay
			}
		}

		result.eventsProcessed = 1

		if (options.overriddenEntries && options.overriddenEntries.length > 0) {
			result.entries = ensureProductionManagersInsertedLast(options.overriddenEntries)
			result.totalAmount = result.entries.reduce((sum, entry) => sum + (entry.total_pay || 0), 0)
		}

		// 6. Save entries if not dry run
		if (!options.dryRun && result.entries.length > 0) {
			const entriesToInsert = result.entries.map(entry => ({
				event_date: entry.event_date,
				artist_id: entry.artist_id,
				venue_id: entry.venue_id,
				facility_id: entry.facility_id ?? null,
				event_id: entry.event_id,
				hours: entry.hours,
				rate: entry.rate,
				rate_type: entry.rate_type,
				base_rate: entry.base_rate,
				additional_rate: entry.additional_rate,
				rate_description: entry.rate_description,
				additional_pay: entry.additional_pay,
				additional_pay_reason: entry.additional_pay_reason,
				total_pay: entry.total_pay,
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
				payee_name: entry.payee_name ?? null,
				is_production_manager: entry.is_production_manager ?? false,
				linked_payroll_id: entry.linked_payroll_id ?? null,
				adjustment_type: entry.adjustment_type ?? null,
				notes: entry.notes,
				created_by: options.userId || 'system'
			}))

			const insertRowsWithPmOffset = applyProductionManagerCreatedAtOffset(entriesToInsert)
			const { error: insertError } = await insertPayrollRowsWithCompat(insertRowsWithPmOffset)

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

interface PayrollReconcileResult {
	success: boolean
	created: number
	updated: number
	cancelled: number
	adjustments: number
	errors: string[]
}

export interface PayrollReconcilePreviewRow {
	key: string
	payee_name: string
	is_production_manager: boolean
	action: 'create' | 'update' | 'cancel' | 'adjustment'
	current_total: number
	new_total: number
	delta: number
	note?: string
}

export interface PayrollReconcilePreviewResult {
	success: boolean
	rows: PayrollReconcilePreviewRow[]
	errors: string[]
}

export async function previewCompletedEventPayrollChanges(
	eventId: number,
	options: { userId?: string; eventOverride?: Record<string, any> } = {}
): Promise<PayrollReconcilePreviewResult> {
	const result: PayrollReconcilePreviewResult = {
		success: false,
		rows: [],
		errors: []
	}

	try {
		const preview = await generatePayrollForEvent(eventId, {
			dryRun: true,
			userId: options.userId,
			eventOverride: options.eventOverride
		})
		if (!preview.success) {
			result.errors.push(...preview.errors)
			return result
		}

		const { data: existingRows, error: existingError } = await supabase
			.from('phwb_payroll')
			.select('*')
			.eq('source_event_id', eventId)

		if (existingError) {
			result.errors.push(existingError.message)
			return result
		}

		const existing = (existingRows || []) as Array<any>
		const baseRows = existing.filter((row) => !row.adjustment_type)
		const expectedByKey = new Map<string, GeneratedPayrollEntry>()
		for (const entry of preview.entries) {
			expectedByKey.set(getReconcileKey(entry), entry)
		}
		const generationWarning = preview.errors.length > 0 ? preview.errors.join('; ') : undefined

		for (const existingRow of baseRows) {
			const key = getReconcileKey(existingRow)
			const expected = expectedByKey.get(key)

			if (!expected) {
				result.rows.push({
					key,
					payee_name: existingRow.payee_name || existingRow.artist_name || 'Unknown',
					is_production_manager: !!existingRow.is_production_manager,
					action: existingRow.status === PaymentStatus.PAID ? 'adjustment' : 'cancel',
					current_total: Number(existingRow.total_pay || 0),
					new_total: 0,
					delta: -1 * Number(existingRow.total_pay || 0),
					note: generationWarning
						? `No replacement generated: ${generationWarning}`
						: 'No replacement entry generated by current rules.'
				})
				continue
			}

			const existingTotal = Number(existingRow.total_pay || 0)
			const expectedTotal = Number(expected.total_pay || 0)
			const delta = Number((expectedTotal - existingTotal).toFixed(2))
			expectedByKey.delete(key)

			if (Math.abs(delta) < 0.01) continue

			result.rows.push({
				key,
				payee_name: expected.payee_name || expected.artist_name || 'Unknown',
				is_production_manager: !!expected.is_production_manager,
				action: existingRow.status === PaymentStatus.PAID ? 'adjustment' : 'update',
				current_total: existingTotal,
				new_total: expectedTotal,
				delta
			})
		}

		for (const expected of expectedByKey.values()) {
			result.rows.push({
				key: getReconcileKey(expected),
				payee_name: expected.payee_name || expected.artist_name || 'Unknown',
				is_production_manager: !!expected.is_production_manager,
				action: 'create',
				current_total: 0,
				new_total: Number(expected.total_pay || 0),
				delta: Number(expected.total_pay || 0)
			})
		}

		// Highlight PM entries first for quick review.
		result.rows.sort((a, b) => Number(b.is_production_manager) - Number(a.is_production_manager))
		result.success = true
		return result
	} catch (error) {
		result.errors.push(error instanceof Error ? error.message : 'Unknown preview error')
		return result
	}
}

function getReconcileKey(entry: { artist_id: string | null; payee_name?: string | null; is_production_manager?: boolean }): string {
	if (entry.artist_id) return `artist:${entry.artist_id}`
	if (entry.is_production_manager) return `pm:${entry.payee_name || 'unknown'}`
	return `payee:${entry.payee_name || 'unknown'}`
}

function toInsertPayload(entry: GeneratedPayrollEntry, userId?: string) {
	return {
		event_date: entry.event_date,
		artist_id: entry.artist_id,
		venue_id: entry.venue_id,
		facility_id: entry.facility_id ?? null,
		event_id: entry.event_id,
		hours: entry.hours,
		rate: entry.rate,
		rate_type: entry.rate_type,
		base_rate: entry.base_rate,
		additional_rate: entry.additional_rate,
		rate_description: entry.rate_description,
		additional_pay: entry.additional_pay,
		additional_pay_reason: entry.additional_pay_reason,
		total_pay: entry.total_pay,
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
		payee_name: entry.payee_name ?? null,
		is_production_manager: entry.is_production_manager ?? false,
		linked_payroll_id: entry.linked_payroll_id ?? null,
		adjustment_type: entry.adjustment_type ?? null,
		notes: entry.notes,
		created_by: userId || 'system'
	}
}

export async function reconcilePayrollForCompletedEvent(
	eventId: number,
	options: { dryRun?: boolean; userId?: string } = {}
): Promise<PayrollReconcileResult> {
	const result: PayrollReconcileResult = {
		success: false,
		created: 0,
		updated: 0,
		cancelled: 0,
		adjustments: 0,
		errors: []
	}

	try {
		const preview = await generatePayrollForEvent(eventId, { dryRun: true, userId: options.userId })
		if (!preview.success) {
			result.errors.push(...preview.errors)
			return result
		}

		const { data: existingRows, error: existingError } = await supabase
			.from('phwb_payroll')
			.select('*')
			.eq('source_event_id', eventId)

		if (existingError) {
			result.errors.push(existingError.message)
			return result
		}

		const existing = (existingRows || []) as Array<any>
		const baseRows = existing.filter((row) => !row.adjustment_type)
		const expectedByKey = new Map<string, GeneratedPayrollEntry>()
		for (const entry of preview.entries) {
			expectedByKey.set(getReconcileKey(entry), entry)
		}

		const creates: GeneratedPayrollEntry[] = []
		const updates: Array<{ id: number; payload: Record<string, any> }> = []
		const cancellations: number[] = []
		const adjustmentEntries: GeneratedPayrollEntry[] = []

		for (const existingRow of baseRows) {
			const key = getReconcileKey(existingRow)
			const expected = expectedByKey.get(key)
			if (!expected) {
				if (existingRow.status === PaymentStatus.PAID) {
					adjustmentEntries.push({
						event_id: existingRow.event_id,
						event_date: existingRow.event_date,
						artist_id: existingRow.artist_id,
						artist_name: existingRow.payee_name || 'Adjustment',
						payee_name: existingRow.payee_name,
						venue_id: existingRow.venue_id,
						facility_id: existingRow.facility_id,
						program_id: existingRow.program_id,
						hours: 0,
						rate: 0,
						rate_type: existingRow.rate_type,
						base_rate: existingRow.base_rate,
						additional_rate: existingRow.additional_rate,
						rate_description: 'Post-completion removal adjustment',
						additional_pay: 0,
						additional_pay_reason: 'Removed from completed event',
						total_pay: -1 * Number(existingRow.total_pay || 0),
						number_of_musicians: existingRow.number_of_musicians || 1,
						gig_duration: existingRow.gig_duration,
						employee_contractor_status: existingRow.employee_contractor_status || EmployeeContractorStatus.T1099,
						rate_card_id: existingRow.rate_card_id,
						rate_rule_id: existingRow.rate_rule_id,
						status: PaymentStatus.PLANNED,
						payment_type: existingRow.payment_type || PaymentType.PERFORMANCE,
						creation_method: CreationMethod.EVENT_AUTOMATION,
						source_event_id: eventId,
						linked_payroll_id: existingRow.id,
						adjustment_type: 'decrease',
						is_production_manager: existingRow.is_production_manager || false,
						notes: `Adjustment for removed participant from completed event (original #${existingRow.id}).`
					})
				} else {
					cancellations.push(existingRow.id)
				}
				continue
			}

			const existingTotal = Number(existingRow.total_pay || 0)
			const expectedTotal = Number(expected.total_pay || 0)
			const delta = Number((expectedTotal - existingTotal).toFixed(2))
			expectedByKey.delete(key)

			if (Math.abs(delta) < 0.01) {
				continue
			}

			if (existingRow.status === PaymentStatus.PAID) {
				adjustmentEntries.push({
					...expected,
					hours: 0,
					rate: 0,
					additional_pay: 0,
					additional_pay_reason: 'Post-payment adjustment',
					total_pay: delta,
					linked_payroll_id: existingRow.id,
					adjustment_type: delta >= 0 ? 'increase' : 'decrease',
					notes: `Adjustment for completed event update (original #${existingRow.id}). Delta: ${delta}`
				})
			} else {
				updates.push({
					id: existingRow.id,
					payload: {
						artist_id: expected.artist_id,
						payee_name: expected.payee_name ?? null,
						hours: expected.hours,
						rate: expected.rate,
						rate_type: expected.rate_type,
						base_rate: expected.base_rate,
						additional_rate: expected.additional_rate,
						rate_description: expected.rate_description,
						additional_pay: expected.additional_pay,
						additional_pay_reason: expected.additional_pay_reason,
						employee_contractor_status: expected.employee_contractor_status,
						number_of_musicians: expected.number_of_musicians,
						gig_duration: expected.gig_duration,
						rate_card_id: expected.rate_card_id,
						rate_rule_id: expected.rate_rule_id,
						payment_type: expected.payment_type,
						is_production_manager: expected.is_production_manager ?? false,
						notes: expected.notes
					}
				})
			}
		}

		for (const expected of expectedByKey.values()) {
			creates.push(expected)
		}

		if (options.dryRun) {
			result.created = creates.length
			result.updated = updates.length
			result.cancelled = cancellations.length
			result.adjustments = adjustmentEntries.length
			result.success = true
			return result
		}

		for (const updateItem of updates) {
			const { error } = await supabase.from('phwb_payroll').update(updateItem.payload).eq('id', updateItem.id)
			if (error) {
				result.errors.push(`Failed updating payroll #${updateItem.id}: ${error.message}`)
			} else {
				result.updated += 1
			}
		}

		if (cancellations.length > 0) {
			const { error } = await supabase
				.from('phwb_payroll')
				.update({ status: PaymentStatus.CANCELLED, notes: 'Cancelled after completed-event reconciliation.' })
				.in('id', cancellations)
			if (error) {
				result.errors.push(`Failed cancelling rows: ${error.message}`)
			} else {
				result.cancelled += cancellations.length
			}
		}

		const newInserts = creates.map((entry) => toInsertPayload(entry, options.userId))
		const adjustmentInserts = adjustmentEntries.map((entry) => toInsertPayload(entry, options.userId))
		if (newInserts.length > 0 || adjustmentInserts.length > 0) {
			const insertsWithPmOffset = applyProductionManagerCreatedAtOffset([...newInserts, ...adjustmentInserts])
			const { error } = await insertPayrollRowsWithCompat(insertsWithPmOffset)
			if (error) {
				result.errors.push(`Failed inserting reconciled rows: ${error.message}`)
			} else {
				result.created += newInserts.length
				result.adjustments += adjustmentInserts.length
			}
		}

		result.success = result.errors.length === 0
		return result
	} catch (error) {
		result.errors.push(error instanceof Error ? error.message : 'Unknown reconciliation error')
		return result
	}
}
