/**
 * Phone number formatting utilities
 */

/**
 * Normalize a phone number to digits only
 * @param phone - Raw phone number string
 * @returns String with only digits, or null if invalid
 */
export function normalizePhone(phone: string | null | undefined): string | null {
	if (!phone) return null

	// Remove all non-digit characters
	const digits = phone.replace(/\D/g, '')

	// Validate length (US phone numbers should be 10 or 11 digits)
	if (digits.length === 10) {
		return digits
	} else if (digits.length === 11 && digits[0] === '1') {
		// Remove leading 1 from US country code
		return digits.substring(1)
	}

	// If it's not a valid length, return the digits we have
	// This handles edge cases like international numbers
	return digits.length > 0 ? digits : null
}

/**
 * Format a phone number in standard US format: (XXX) XXX-XXXX
 * @param phone - Raw phone number string
 * @returns Formatted phone number or original string if invalid
 */
export function formatPhone(phone: string | null | undefined): string {
	if (!phone) return ''

	const normalized = normalizePhone(phone)
	if (!normalized || normalized.length !== 10) {
		// If we can't normalize it to 10 digits, return original
		return phone
	}

	// Format as (XXX) XXX-XXXX
	return `(${normalized.substring(0, 3)}) ${normalized.substring(3, 6)}-${normalized.substring(6, 10)}`
}

/**
 * Validate if a phone number is valid (not a placeholder)
 * @param phone - Phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPhone(phone: string | null | undefined): boolean {
	if (!phone) return false

	const normalized = normalizePhone(phone)
	if (!normalized) return false

	// Check for placeholder patterns
	const placeholders = [
		'0000000000',
		'1111111111',
		'9999999999',
		'5551234',
		'5555555555'
	]

	return !placeholders.includes(normalized)
}

/**
 * Normalize phone number for database storage
 * Returns null for invalid/placeholder numbers
 * @param phone - Raw phone number string
 * @returns Normalized phone or null
 */
export function normalizePhoneForDB(phone: string | null | undefined): string | null {
	const normalized = normalizePhone(phone)
	if (!normalized || !isValidPhone(normalized)) {
		return null
	}
	return formatPhone(normalized)
}
