/**
 * Phone number formatting utilities
 * US phone numbers only: (XXX) XXX-XXXX format
 */

/**
 * Normalize a phone number to digits only (US format only)
 * @param phone - Raw phone number string
 * @returns String with only digits (10 digits), or null if invalid
 */
export function normalizePhone(phone: string | null | undefined): string | null {
	if (!phone) return null

	// Remove all non-digit characters
	const digits = phone.replace(/\D/g, '')

	// US phone numbers must be exactly 10 digits, or 11 digits starting with 1
	if (digits.length === 10) {
		return digits
	} else if (digits.length === 11 && digits[0] === '1') {
		// Remove leading 1 from US country code
		return digits.substring(1)
	}

	// Return null for invalid lengths (strict US-only)
	return null
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
 * Validate if a phone number is valid US format (not a placeholder)
 * @param phone - Phone number to validate
 * @returns true if valid US phone number, false otherwise
 */
export function isValidPhone(phone: string | null | undefined): boolean {
	if (!phone) return false

	const normalized = normalizePhone(phone)
	if (!normalized || normalized.length !== 10) {
		return false
	}

	// Check for placeholder patterns
	const placeholders = [
		'0000000000',
		'1111111111',
		'9999999999',
		'5555555555',
		'1234567890'
	]

	if (placeholders.includes(normalized)) {
		return false
	}

	// Validate area code (first digit cannot be 0 or 1)
	if (normalized[0] === '0' || normalized[0] === '1') {
		return false
	}

	// Validate exchange code (4th digit cannot be 0 or 1)
	if (normalized[3] === '0' || normalized[3] === '1') {
		return false
	}

	return true
}

/**
 * Normalize phone number for database storage
 * Returns null for invalid/placeholder numbers
 * @param phone - Raw phone number string
 * @returns Formatted phone in (XXX) XXX-XXXX format or null
 */
export function normalizePhoneForDB(phone: string | null | undefined): string | null {
	const normalized = normalizePhone(phone)
	if (!normalized || !isValidPhone(normalized)) {
		return null
	}
	return formatPhone(normalized)
}

/**
 * Format phone number as user types (real-time formatting)
 * Formats to (XXX) XXX-XXXX as digits are entered
 * @param value - Current input value
 * @returns Formatted phone number string
 */
export function formatPhoneInput(value: string): string {
	// Remove all non-digit characters
	const digits = value.replace(/\D/g, '')

	// Limit to 10 digits (US format)
	const limitedDigits = digits.slice(0, 10)

	// Format based on length
	if (limitedDigits.length === 0) {
		return ''
	} else if (limitedDigits.length <= 3) {
		return `(${limitedDigits}`
	} else if (limitedDigits.length <= 6) {
		return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`
	} else {
		return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`
	}
}

/**
 * Validate phone number format (for real-time validation)
 * @param phone - Phone number string to validate
 * @returns Object with isValid boolean and error message
 */
export function validatePhoneInput(phone: string | null | undefined): { isValid: boolean; error?: string } {
	if (!phone || phone.trim() === '') {
		return { isValid: true } // Empty is valid (not required)
	}

	const digits = phone.replace(/\D/g, '')

	// Check if we have enough digits
	if (digits.length < 10) {
		return { isValid: false, error: 'Phone number must have 10 digits' }
	}

	if (digits.length > 10) {
		return { isValid: false, error: 'Phone number must be exactly 10 digits' }
	}

	// Validate area code
	if (digits[0] === '0' || digits[0] === '1') {
		return { isValid: false, error: 'Area code cannot start with 0 or 1' }
	}

	// Validate exchange code
	if (digits[3] === '0' || digits[3] === '1') {
		return { isValid: false, error: 'Exchange code cannot start with 0 or 1' }
	}

	// Check for placeholder patterns
	const placeholders = [
		'0000000000',
		'1111111111',
		'9999999999',
		'5555555555',
		'1234567890'
	]

	if (placeholders.includes(digits)) {
		return { isValid: false, error: 'Please enter a valid phone number' }
	}

	return { isValid: true }
}
