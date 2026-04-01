import { writable, get } from 'svelte/store'
import { supabase } from '$lib/supabase'
import { errorStore } from './error'
import {
	type RateCard,
	type RateRule,
	type AdditionalFee,
	type RateCalculationResult,
	ProgramType,
	RateType,
	FeeType
} from '$lib/schemas/rate-card'

// Dropdown option type for PayrollInlineTable
export interface RateRuleOption {
	ruleId: number
	label: string
	rateType: 'hourly' | 'flat' | 'tiered'
	primaryRate: number
	additionalRate: number | null
	description: string
}

function formatRuleLabel(rule: RateRule): string {
	const descriptor =
		rule.description?.trim() ||
		(rule.program_id ? `Program #${rule.program_id}` : rule.program_type || 'Rate rule')

	if (rule.rate_type === 'hourly') {
		return `${descriptor} - $${Number(rule.hourly_rate || 0).toFixed(0)}/hr`
	}
	if (rule.rate_type === 'flat') {
		return `${descriptor} - $${Number(rule.flat_rate || 0).toFixed(0)} flat`
	}
	if (rule.rate_type === 'tiered') {
		return `${descriptor} - $${Number(rule.first_hour_rate || 0).toFixed(0)} + $${Number(rule.subsequent_hour_rate || 0).toFixed(0)}/add'l hr`
	}
	return descriptor
}

function ruleToOption(rule: RateRule): RateRuleOption {
	let primaryRate = 0
	let additionalRate: number | null = null

	if (rule.rate_type === 'hourly') {
		primaryRate = Number(rule.hourly_rate) || 0
	} else if (rule.rate_type === 'flat') {
		primaryRate = Number(rule.flat_rate) || 0
	} else if (rule.rate_type === 'tiered') {
		primaryRate = Number(rule.first_hour_rate) || 0
		additionalRate = Number(rule.subsequent_hour_rate) || 0
	}

	return {
		ruleId: rule.id,
		label: formatRuleLabel(rule),
		rateType: rule.rate_type as 'hourly' | 'flat' | 'tiered',
		primaryRate,
		additionalRate,
		description: rule.description || ''
	}
}

// State types
interface RateCardState {
	rateCards: RateCard[]
	activeRateCard: RateCard | null
	rules: RateRule[]
	fees: AdditionalFee[]
	ruleOptions: RateRuleOption[]
	loading: boolean
	error: string | null
}

const initialState: RateCardState = {
	rateCards: [],
	activeRateCard: null,
	rules: [],
	fees: [],
	ruleOptions: [],
	loading: false,
	error: null
}

export const rateCardState = writable<RateCardState>(initialState)

export const rateCardStore = {
	subscribe: rateCardState.subscribe,

	// ============================================================================
	// Rate Card CRUD
	// ============================================================================

	async fetchAllRateCards() {
		rateCardState.update((state) => ({ ...state, loading: true, error: null }))

		try {
			const { data, error } = await supabase
				.from('phwb_rate_cards')
				.select('*')
				.order('effective_date', { ascending: false })

			if (error) throw error

			const activeCard = data?.find((card) => card.is_active) || null

			rateCardState.update((state) => ({
				...state,
				rateCards: data || [],
				activeRateCard: activeCard,
				loading: false
			}))

			return data || []
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to fetch rate cards')
			rateCardState.update((state) => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},

	async getActiveRateCard(): Promise<RateCard | null> {
		try {
			const { data, error } = await supabase
				.from('phwb_rate_cards')
				.select('*')
				.eq('is_active', true)
				.single()

			if (error && error.code !== 'PGRST116') throw error

			rateCardState.update((state) => ({
				...state,
				activeRateCard: data || null
			}))

			return data || null
		} catch (error) {
			errorStore.handleError(error, 'Failed to fetch active rate card')
			return null
		}
	},

	async createRateCard(
		rateCard: Omit<RateCard, 'id' | 'created_at' | 'updated_at'>
	): Promise<RateCard> {
		rateCardState.update((state) => ({ ...state, loading: true, error: null }))

		try {
			if (rateCard.is_active) {
				await supabase.from('phwb_rate_cards').update({ is_active: false }).eq('is_active', true)
			}

			const { data, error } = await supabase
				.from('phwb_rate_cards')
				.insert([rateCard])
				.select()
				.single()

			if (error) throw error

			rateCardState.update((state) => ({
				...state,
				rateCards: [data, ...state.rateCards],
				activeRateCard: data.is_active ? data : state.activeRateCard,
				loading: false
			}))

			return data
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to create rate card')
			rateCardState.update((state) => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},

	async updateRateCard(
		id: number,
		updates: Partial<Omit<RateCard, 'id' | 'created_at' | 'updated_at'>>
	): Promise<RateCard> {
		rateCardState.update((state) => ({ ...state, loading: true, error: null }))

		try {
			if (updates.is_active) {
				await supabase
					.from('phwb_rate_cards')
					.update({ is_active: false })
					.eq('is_active', true)
					.neq('id', id)
			}

			const { data, error } = await supabase
				.from('phwb_rate_cards')
				.update(updates)
				.eq('id', id)
				.select()
				.single()

			if (error) throw error

			rateCardState.update((state) => ({
				...state,
				rateCards: state.rateCards.map((card) => (card.id === id ? data : card)),
				activeRateCard: data.is_active ? data : state.activeRateCard?.id === id ? null : state.activeRateCard,
				loading: false
			}))

			return data
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to update rate card')
			rateCardState.update((state) => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},

	async deleteRateCard(id: number): Promise<void> {
		rateCardState.update((state) => ({ ...state, loading: true, error: null }))

		try {
			const { error } = await supabase.from('phwb_rate_cards').delete().eq('id', id)

			if (error) throw error

			rateCardState.update((state) => ({
				...state,
				rateCards: state.rateCards.filter((card) => card.id !== id),
				activeRateCard: state.activeRateCard?.id === id ? null : state.activeRateCard,
				loading: false
			}))
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to delete rate card')
			rateCardState.update((state) => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},

	async duplicateRateCard(id: number, newName: string, effectiveDate: string): Promise<RateCard> {
		rateCardState.update((state) => ({ ...state, loading: true, error: null }))

		try {
			const { data: originalCard, error: cardError } = await supabase
				.from('phwb_rate_cards')
				.select('*')
				.eq('id', id)
				.single()

			if (cardError) throw cardError

			const { data: originalRules, error: rulesError } = await supabase
				.from('phwb_rate_rules')
				.select('*')
				.eq('rate_card_id', id)

			if (rulesError) throw rulesError

			const { data: originalFees, error: feesError } = await supabase
				.from('phwb_additional_fees')
				.select('*')
				.eq('rate_card_id', id)

			if (feesError) throw feesError

			const { data: newCard, error: newCardError } = await supabase
				.from('phwb_rate_cards')
				.insert([
					{
						name: newName,
						effective_date: effectiveDate,
						expires_date: null,
						is_active: false,
						notes: `Duplicated from ${originalCard.name}`
					}
				])
				.select()
				.single()

			if (newCardError) throw newCardError

			if (originalRules && originalRules.length > 0) {
				const newRules = originalRules.map((rule) => ({
					rate_card_id: newCard.id,
					program_type: rule.program_type,
					program_id: rule.program_id ?? null,
					rate_type: rule.rate_type,
					hourly_rate: rule.hourly_rate,
					first_hour_rate: rule.first_hour_rate,
					subsequent_hour_rate: rule.subsequent_hour_rate,
					flat_rate: rule.flat_rate,
					min_hours: rule.min_hours,
					max_hours: rule.max_hours,
					includes_travel: rule.includes_travel,
					description: rule.description,
					notes: rule.notes
				}))

				const { error: insertRulesError } = await supabase
					.from('phwb_rate_rules')
					.insert(newRules)

				if (insertRulesError) throw insertRulesError
			}

			if (originalFees && originalFees.length > 0) {
				const newFees = originalFees.map((fee) => ({
					rate_card_id: newCard.id,
					fee_type: fee.fee_type,
					amount: fee.amount,
					min_musicians: fee.min_musicians,
					applies_to: fee.applies_to,
					description: fee.description,
					notes: fee.notes
				}))

				const { error: insertFeesError } = await supabase
					.from('phwb_additional_fees')
					.insert(newFees)

				if (insertFeesError) throw insertFeesError
			}

			rateCardState.update((state) => ({
				...state,
				rateCards: [newCard, ...state.rateCards],
				loading: false
			}))

			return newCard
		} catch (error) {
			const errorId = errorStore.handleError(error, 'Failed to duplicate rate card')
			rateCardState.update((state) => ({ ...state, loading: false, error: errorId }))
			throw error
		}
	},

	// ============================================================================
	// Rate Rules CRUD
	// ============================================================================

	async fetchRulesForCard(rateCardId: number): Promise<RateRule[]> {
		try {
			const { data, error } = await supabase
				.from('phwb_rate_rules')
				.select('*')
				.eq('rate_card_id', rateCardId)
				.order('program_type')

			if (error) throw error

			const typedRules = (data || []) as RateRule[]

			rateCardState.update((state) => ({
				...state,
				rules: typedRules,
				ruleOptions: typedRules.map(ruleToOption)
			}))

			return typedRules
		} catch (error) {
			errorStore.handleError(error, 'Failed to fetch rate rules')
			throw error
		}
	},

	async fetchActiveRuleOptions() {
		rateCardState.update((s) => ({ ...s, loading: true, error: null }))

		try {
			const { data: card, error: cardErr } = await supabase
				.from('phwb_rate_cards')
				.select('*')
				.eq('is_active', true)
				.limit(1)
				.single()

			if (cardErr) throw cardErr

			const { data: rules, error: rulesErr } = await supabase
				.from('phwb_rate_rules')
				.select('*')
				.eq('rate_card_id', card.id)
				.order('description')

			if (rulesErr) throw rulesErr

			const typedRules = (rules || []) as RateRule[]

			rateCardState.update((s) => ({
				...s,
				rules: typedRules,
				ruleOptions: typedRules.map(ruleToOption),
				activeRateCard: card as RateCard,
				loading: false
			}))
		} catch (err: any) {
			rateCardState.update((s) => ({
				...s,
				loading: false,
				error: err.message || 'Failed to load rate rules'
			}))
		}
	},

	async getRuleForProgramType(
		rateCardId: number,
		programType: string,
		programId?: number | null
	): Promise<RateRule | null> {
		try {
			// Primary path: pick the latest generic rule for this program type.
			// Use limit(1) instead of single() to avoid failure when legacy duplicate rows exist.
			const { data: genericRows, error: genericError } = await supabase
				.from('phwb_rate_rules')
				.select('*')
				.eq('rate_card_id', rateCardId)
				.eq('program_type', programType)
				.is('program_id', null)
				.order('updated_at', { ascending: false })
				.limit(1)

			if (genericError) throw genericError
			if (genericRows && genericRows.length > 0) return genericRows[0]

			// Backward-compatible fallback: program-specific rule with matching type.
			if (typeof programId === 'number') {
				const { data: specific, error: specificError } = await supabase
					.from('phwb_rate_rules')
					.select('*')
					.eq('rate_card_id', rateCardId)
					.eq('program_id', programId)
					.eq('program_type', programType)
					.order('updated_at', { ascending: false })
					.limit(1)

				if (specificError) throw specificError
				if (specific && specific.length > 0) return specific[0]
			}

			// Backward-compatible fallback: if no generic rule exists, use any rule of this type.
			const { data: byType, error: byTypeError } = await supabase
				.from('phwb_rate_rules')
				.select('*')
				.eq('rate_card_id', rateCardId)
				.eq('program_type', programType)
				.order('program_id', { ascending: true, nullsFirst: true })
				.order('updated_at', { ascending: false })
				.limit(1)

			if (byTypeError) throw byTypeError
			return byType?.[0] || null
		} catch (error) {
			errorStore.handleError(error, 'Failed to fetch rate rule')
			return null
		}
	},

	async createRateRule(
		rule: Omit<RateRule, 'id' | 'created_at' | 'updated_at'>
	): Promise<RateRule> {
		try {
			const { data, error } = await supabase
				.from('phwb_rate_rules')
				.insert([rule])
				.select()
				.single()

			if (error) throw error

			rateCardState.update((state) => ({
				...state,
				rules: [...state.rules, data],
				ruleOptions: [...state.rules, data].map(ruleToOption)
			}))

			return data
		} catch (error) {
			errorStore.handleError(error, 'Failed to create rate rule')
			throw error
		}
	},

	async updateRateRule(
		id: number,
		updates: Partial<Omit<RateRule, 'id' | 'created_at' | 'updated_at'>>
	): Promise<RateRule> {
		try {
			const { data, error } = await supabase
				.from('phwb_rate_rules')
				.update(updates)
				.eq('id', id)
				.select()
				.single()

			if (error) throw error

			const updatedRules = get(rateCardState).rules.map((rule) => (rule.id === id ? data : rule))

			rateCardState.update((state) => ({
				...state,
				rules: updatedRules,
				ruleOptions: updatedRules.map(ruleToOption)
			}))

			return data
		} catch (error) {
			errorStore.handleError(error, 'Failed to update rate rule')
			throw error
		}
	},

	async deleteRateRule(id: number): Promise<void> {
		try {
			const { error } = await supabase.from('phwb_rate_rules').delete().eq('id', id)

			if (error) throw error

			const filteredRules = get(rateCardState).rules.filter((rule) => rule.id !== id)

			rateCardState.update((state) => ({
				...state,
				rules: filteredRules,
				ruleOptions: filteredRules.map(ruleToOption)
			}))
		} catch (error) {
			errorStore.handleError(error, 'Failed to delete rate rule')
			throw error
		}
	},

	// ============================================================================
	// Additional Fees CRUD
	// ============================================================================

	async fetchFeesForCard(rateCardId: number): Promise<AdditionalFee[]> {
		try {
			const { data, error } = await supabase
				.from('phwb_additional_fees')
				.select('*')
				.eq('rate_card_id', rateCardId)
				.order('fee_type')

			if (error) throw error

			rateCardState.update((state) => ({
				...state,
				fees: data || []
			}))

			return data || []
		} catch (error) {
			errorStore.handleError(error, 'Failed to fetch additional fees')
			throw error
		}
	},

	async getFeeByType(rateCardId: number, feeType: string): Promise<AdditionalFee | null> {
		try {
			const { data, error } = await supabase
				.from('phwb_additional_fees')
				.select('*')
				.eq('rate_card_id', rateCardId)
				.eq('fee_type', feeType)
				.single()

			if (error && error.code !== 'PGRST116') throw error

			return data || null
		} catch (error) {
			errorStore.handleError(error, 'Failed to fetch fee')
			return null
		}
	},

	async createAdditionalFee(
		fee: Omit<AdditionalFee, 'id' | 'created_at' | 'updated_at'>
	): Promise<AdditionalFee> {
		try {
			const { data, error } = await supabase
				.from('phwb_additional_fees')
				.insert([fee])
				.select()
				.single()

			if (error) throw error

			rateCardState.update((state) => ({
				...state,
				fees: [...state.fees, data]
			}))

			return data
		} catch (error) {
			errorStore.handleError(error, 'Failed to create additional fee')
			throw error
		}
	},

	async updateAdditionalFee(
		id: number,
		updates: Partial<Omit<AdditionalFee, 'id' | 'created_at' | 'updated_at'>>
	): Promise<AdditionalFee> {
		try {
			const { data, error } = await supabase
				.from('phwb_additional_fees')
				.update(updates)
				.eq('id', id)
				.select()
				.single()

			if (error) throw error

			rateCardState.update((state) => ({
				...state,
				fees: state.fees.map((fee) => (fee.id === id ? data : fee))
			}))

			return data
		} catch (error) {
			errorStore.handleError(error, 'Failed to update additional fee')
			throw error
		}
	},

	async deleteAdditionalFee(id: number): Promise<void> {
		try {
			const { error } = await supabase.from('phwb_additional_fees').delete().eq('id', id)

			if (error) throw error

			rateCardState.update((state) => ({
				...state,
				fees: state.fees.filter((fee) => fee.id !== id)
			}))
		} catch (error) {
			errorStore.handleError(error, 'Failed to delete additional fee')
			throw error
		}
	},

	// ============================================================================
	// Rate Calculation Helpers
	// ============================================================================

	calculatePay(
		rule: RateRule,
		hours: number,
		additionalFees: AdditionalFee[] = [],
		options: {
			isLeader?: boolean
			numberOfMusicians?: number
		} = {}
	): RateCalculationResult {
		let basePay = 0
		let calculationNotes = ''

		switch (rule.rate_type) {
			case RateType.HOURLY:
				basePay = (rule.hourly_rate || 0) * hours
				calculationNotes = `Hourly rate: $${rule.hourly_rate}/hr x ${hours} hrs = $${basePay}`
				break

			case RateType.TIERED:
				if (hours <= 1) {
					basePay = rule.first_hour_rate || 0
					calculationNotes = `First hour rate: $${rule.first_hour_rate}`
				} else {
					const firstHour = rule.first_hour_rate || 0
					const subsequentHours = (hours - 1) * (rule.subsequent_hour_rate || 0)
					basePay = firstHour + subsequentHours
					calculationNotes = `First hour: $${firstHour} + ${hours - 1} subsequent hrs x $${rule.subsequent_hour_rate} = $${basePay}`
				}
				break

			case RateType.FLAT:
				basePay = rule.flat_rate || 0
				calculationNotes = `Flat rate: $${rule.flat_rate}`
				break
		}

		let additionalPay = 0
		let additionalPayReason: string | null = null
		const additionalReasons: string[] = []

		for (const fee of additionalFees) {
			if (fee.fee_type === FeeType.BANDLEADER) {
				if (options.isLeader && options.numberOfMusicians && fee.min_musicians) {
					if (options.numberOfMusicians >= fee.min_musicians) {
						additionalPay += fee.amount
						additionalReasons.push(`Bandleader fee: $${fee.amount}`)
					}
				}
			}
		}

		if (additionalReasons.length > 0) {
			additionalPayReason = additionalReasons.join('; ')
		}

		return {
			basePay,
			additionalPay,
			additionalPayReason,
			totalPay: basePay + additionalPay,
			calculationNotes:
				calculationNotes + (additionalPayReason ? ` + ${additionalPayReason}` : ''),
			rateRuleId: rule.id,
			rateCardId: rule.rate_card_id
		}
	},

	async calculatePayForEvent(
		programType: string,
		hours: number,
		options: {
			isLeader?: boolean
			numberOfMusicians?: number
			rateCardId?: number
		} = {}
	): Promise<RateCalculationResult | null> {
		try {
			let rateCardId = options.rateCardId
			if (!rateCardId) {
				const activeCard = await this.getActiveRateCard()
				if (!activeCard) {
					console.warn('No active rate card found')
					return null
				}
				rateCardId = activeCard.id
			}

			const rule = await this.getRuleForProgramType(rateCardId, programType)
			if (!rule) {
				console.warn(`No rate rule found for program type: ${programType}`)
				return null
			}

			const fees = await this.fetchFeesForCard(rateCardId)

			return this.calculatePay(rule, hours, fees, options)
		} catch (error) {
			errorStore.handleError(error, 'Failed to calculate pay')
			return null
		}
	},

	// ============================================================================
	// Utility Functions
	// ============================================================================

	getProgramTypeLabel(programType: string): string {
		const labels: Record<string, string> = {
			[ProgramType.HEALING_ARTS]: 'In-person Healing Arts',
			[ProgramType.TRANSIT_HUB]: 'In-person Transit Hub',
			[ProgramType.VIRTUAL_ARTIST]: 'Virtual Program (Artist)',
			[ProgramType.VIRTUAL_TEACHING]: 'Virtual Program (Teaching Artist)',
			[ProgramType.TEACHING_IN_PERSON]: 'In-person Teaching Artist',
			[ProgramType.NEWARK_AIRPORT]: 'Newark Airport',
			[ProgramType.DONOR_EVENT]: 'Donor/Board/High-Profile Event',
			[ProgramType.HOLIDAY_SOLOIST]: 'Holiday Series - Soloist',
			[ProgramType.HOLIDAY_GROUP]: 'Holiday Series - Group/Chorus',
			[ProgramType.HOLIDAY_SPECIAL]: 'Holiday Special',
			[ProgramType.PM]: 'Production Manager',
			[ProgramType.TRAINING]: 'Training',
			[ProgramType.OTHER]: 'Other'
		}
		return labels[programType] || programType
	},

	getRateTypeLabel(rateType: string): string {
		const labels: Record<string, string> = {
			[RateType.HOURLY]: 'Hourly',
			[RateType.TIERED]: 'Tiered (First Hour + Subsequent)',
			[RateType.FLAT]: 'Flat Rate'
		}
		return labels[rateType] || rateType
	},

	getFeeTypeLabel(feeType: string): string {
		const labels: Record<string, string> = {
			[FeeType.BANDLEADER]: 'Bandleader Fee',
			[FeeType.BANK_DEPOSIT]: 'Bank Deposit',
			[FeeType.TRAVEL]: 'Travel',
			[FeeType.HARASSMENT_TRAINING]: 'Harassment Prevention Training',
			[FeeType.SETUP_TIME]: 'Setup Time',
			[FeeType.OVERTIME]: 'Overtime'
		}
		return labels[feeType] || feeType
	},

	getAllProgramTypes(): Array<{ value: string; label: string }> {
		return Object.values(ProgramType).map((value) => ({
			value,
			label: this.getProgramTypeLabel(value)
		}))
	},

	getAllRateTypes(): Array<{ value: string; label: string }> {
		return Object.values(RateType).map((value) => ({
			value,
			label: this.getRateTypeLabel(value)
		}))
	},

	getAllFeeTypes(): Array<{ value: string; label: string }> {
		return Object.values(FeeType).map((value) => ({
			value,
			label: this.getFeeTypeLabel(value)
		}))
	}
}
