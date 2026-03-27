/**
 * Unit tests for computeEntryTotalPay.
 * Run with: bun run src/lib/utils/payrollTotals.test.ts
 *
 * Ensures additional_pay is added once per entry and never multiplied by number_of_musicians.
 */

import { computeEntryTotalPay } from './payrollTotals'

function assertEq(actual: number, expected: number, label: string): void {
	if (Math.abs(actual - expected) > 0.005) {
		throw new Error(`${label}: expected ${expected}, got ${actual}`)
	}
}

// Hourly: (hours * rate) + additional_pay. number_of_musicians must not affect total.
assertEq(
	computeEntryTotalPay({ hours: 2, rate: 100, number_of_musicians: 3, additional_pay: 50 } as any),
	250,
	'Hourly with 3 musicians: total = 2*100 + 50 = 250 (not 2*100*3 + 50)'
)

// Flat: rate + additional_pay
assertEq(
	computeEntryTotalPay({ rate: 500, rate_type: 'flat', number_of_musicians: 4, additional_pay: 75 } as any),
	575,
	'Flat with 4 musicians: total = 500 + 75 = 575'
)

// Tiered (healing-arts style): first hour at rate, subsequent at additional_rate; + additional_pay once
assertEq(
	computeEntryTotalPay({
		hours: 1.5,
		rate: 213,
		additional_rate: 107,
		rate_type: 'tiered',
		additional_pay: 20,
		number_of_musicians: 3
	} as any),
	286.5,
	'Tiered 1.5hr: 213 + 0.5*107 + 20 = 286.50'
)

// Tiered 1 hour or less
assertEq(
	computeEntryTotalPay({ hours: 1, rate: 213, additional_rate: 107, rate_type: 'tiered', additional_pay: 0 } as any),
	213,
	'Tiered 1hr: 1*213 = 213'
)

// Default hourly when rate_type missing
assertEq(computeEntryTotalPay({ hours: 3, rate: 50, additional_pay: 25 }), 175, 'Default hourly: 3*50 + 25 = 175')

// Zero / empty
assertEq(computeEntryTotalPay({}), 0, 'Empty entry => 0')
assertEq(computeEntryTotalPay({ hours: 0, rate: 100, additional_pay: 10 }), 10, 'Zero hours: 0 + 10 = 10')

console.log('payrollTotals.test.ts: all assertions passed')