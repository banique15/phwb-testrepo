/**
 * Payroll total-pay calculation utilities.
 *
 * Total pay is computed from rate-card-derived fields (rate_type, rate, additional_rate, hours)
 * plus additional_pay. additional_pay is always added once per entry and is never
 * multiplied by number_of_musicians.
 */

export type RateType = 'hourly' | 'flat' | 'tiered'

/** Minimal entry shape needed to compute total pay (rate column + hours + additional_pay). */
export interface EntryForTotalPay {
	hours?: number | null
	rate?: number | null
	rate_type?: RateType | null
	additional_rate?: number | null
	additional_pay?: number | null
}

/**
 * Compute total pay for a single payroll entry using rate-card logic.
 * Uses rate_type, rate, additional_rate (for tiered), and hours for the base amount,
 * then adds additional_pay once. number_of_musicians is not used in the calculation.
 *
 * @param entry - Entry or form data with hours, rate, rate_type?, additional_rate?, additional_pay?
 * @returns Total pay (base from rate card + additional_pay, two decimal places)
 */
export function computeEntryTotalPay(entry: EntryForTotalPay): number {
	const rateType = entry.rate_type || 'hourly'
	const hours = entry.hours ?? 0
	const rate = entry.rate ?? 0
	const additionalRate = entry.additional_rate ?? 0
	const additionalPay = entry.additional_pay ?? 0

	let base = 0

	if (rateType === 'flat') {
		base = rate
	} else if (rateType === 'tiered') {
		base = hours <= 1 ? hours * rate : rate + (hours - 1) * additionalRate
	} else {
		// hourly (default)
		base = hours * rate
	}

	const total = base + additionalPay
	return Math.round(total * 100) / 100
}
