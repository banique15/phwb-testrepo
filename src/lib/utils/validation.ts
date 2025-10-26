import { z, type ZodError } from 'zod'

/**
 * Validation utilities for form data
 */

export interface ValidationResult {
	valid: boolean
	errors: Record<string, string[]>
	fieldErrors: Map<string, string[]>
}

export interface FieldValidation {
	field: string
	value: any
	errors: string[]
	valid: boolean
}

/**
 * Enhanced email validation with more detailed error messages
 */
export const emailSchema = z
	.string()
	.min(1, 'Email is required')
	.email('Please enter a valid email address')
	.max(254, 'Email address is too long (max 254 characters)')

/**
 * Enhanced phone validation with international support
 */
export const phoneSchema = z
	.string()
	.regex(
		/^[\+]?[(]?[\d\s\-\(\)]{10,}$/,
		'Please enter a valid phone number (minimum 10 digits, supports international format)'
	)
	.optional()

/**
 * URL validation for websites and social links
 */
export const urlSchema = z
	.string()
	.url('Please enter a valid URL (e.g., https://example.com)')
	.optional()

/**
 * Date validation for birth dates
 */
export const dateOfBirthSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
	.refine((date) => {
		const parsedDate = new Date(date)
		const now = new Date()
		const minAge = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate())
		const maxAge = new Date(now.getFullYear() - 13, now.getMonth(), now.getDate())
		
		return parsedDate >= minAge && parsedDate <= maxAge
	}, 'Please enter a valid birth date (must be between 13 and 100 years old)')
	.optional()

/**
 * Social Security Number validation
 */
export const ssnSchema = z
	.string()
	.regex(/^\d{3}-\d{2}-\d{4}$/, 'SSN must be in format XXX-XX-XXXX')
	.optional()

/**
 * Instagram handle validation (without @)
 */
export const instagramSchema = z
	.string()
	.regex(/^[a-zA-Z0-9._]{1,30}$/, 'Instagram handle can only contain letters, numbers, dots, and underscores (max 30 characters)')
	.optional()

/**
 * Array validation for genres, instruments, languages
 */
export const arraySchema = z
	.array(z.string().min(1, 'Item cannot be empty'))
	.min(1, 'At least one item is required')
	.optional()

/**
 * Text length validation utilities
 */
export const shortTextSchema = (maxLength: number) => z
	.string()
	.max(maxLength, `Text must be less than ${maxLength} characters`)
	.optional()

export const requiredTextSchema = (minLength: number = 1, maxLength: number = 255) => z
	.string()
	.min(minLength, `This field is required (minimum ${minLength} characters)`)
	.max(maxLength, `Text must be less than ${maxLength} characters`)

/**
 * Validate a single field using Zod schema
 */
export function validateField<T>(schema: z.ZodSchema<T>, value: any, fieldName: string): FieldValidation {
	try {
		schema.parse(value)
		return {
			field: fieldName,
			value,
			errors: [],
			valid: true
		}
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				field: fieldName,
				value,
				errors: error.errors.map(e => e.message),
				valid: false
			}
		}
		return {
			field: fieldName,
			value,
			errors: ['Validation error'],
			valid: false
		}
	}
}

/**
 * Validate an entire object using Zod schema
 */
export function validateObject<T>(schema: z.ZodSchema<T>, data: any): ValidationResult {
	try {
		schema.parse(data)
		return {
			valid: true,
			errors: {},
			fieldErrors: new Map()
		}
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errors: Record<string, string[]> = {}
			const fieldErrors = new Map<string, string[]>()
			
			error.errors.forEach(err => {
				const field = err.path.join('.')
				if (!errors[field]) {
					errors[field] = []
				}
				errors[field].push(err.message)
				fieldErrors.set(field, errors[field])
			})
			
			return {
				valid: false,
				errors,
				fieldErrors
			}
		}
		
		return {
			valid: false,
			errors: { general: ['Validation failed'] },
			fieldErrors: new Map([['general', ['Validation failed']]])
		}
	}
}

/**
 * Real-time validation state manager
 */
export class FormValidator<T> {
	private schema: z.ZodSchema<T>
	private fieldValidations = new Map<string, FieldValidation>()
	private _isValid = $state(false)
	private _errors = $state<Record<string, string[]>>({})
	private _hasInteracted = $state(false)

	constructor(schema: z.ZodSchema<T>) {
		this.schema = schema
	}

	get isValid(): boolean {
		return this._isValid
	}

	get errors(): Record<string, string[]> {
		return this._errors
	}

	get hasInteracted(): boolean {
		return this._hasInteracted
	}

	/**
	 * Validate a single field
	 */
	validateField(fieldName: string, value: any, fieldSchema?: z.ZodSchema<any>): string[] {
		this._hasInteracted = true
		
		// Use provided schema or extract from main schema
		const targetSchema = fieldSchema || this.extractFieldSchema(fieldName)
		
		if (targetSchema) {
			const validation = validateField(targetSchema, value, fieldName)
			this.fieldValidations.set(fieldName, validation)
			
			// Update errors state
			if (validation.errors.length > 0) {
				this._errors = { ...this._errors, [fieldName]: validation.errors }
			} else {
				const newErrors = { ...this._errors }
				delete newErrors[fieldName]
				this._errors = newErrors
			}
			
			this.updateOverallValidity()
			return validation.errors
		}
		
		return []
	}

	/**
	 * Validate the entire form
	 */
	validateForm(data: any): ValidationResult {
		this._hasInteracted = true
		const result = validateObject(this.schema, data)
		
		this._isValid = result.valid
		this._errors = result.errors
		
		// Update field validations
		this.fieldValidations.clear()
		result.fieldErrors.forEach((errors, field) => {
			this.fieldValidations.set(field, {
				field,
				value: data[field],
				errors,
				valid: errors.length === 0
			})
		})
		
		return result
	}

	/**
	 * Clear validation for a specific field
	 */
	clearFieldValidation(fieldName: string): void {
		this.fieldValidations.delete(fieldName)
		const newErrors = { ...this._errors }
		delete newErrors[fieldName]
		this._errors = newErrors
		this.updateOverallValidity()
	}

	/**
	 * Clear all validation
	 */
	clearAll(): void {
		this.fieldValidations.clear()
		this._errors = {}
		this._isValid = false
		this._hasInteracted = false
	}

	/**
	 * Get errors for a specific field
	 */
	getFieldErrors(fieldName: string): string[] {
		return this._errors[fieldName] || []
	}

	/**
	 * Check if a specific field has errors
	 */
	hasFieldErrors(fieldName: string): boolean {
		return this.getFieldErrors(fieldName).length > 0
	}

	/**
	 * Get field validation state
	 */
	getFieldValidation(fieldName: string): FieldValidation | undefined {
		return this.fieldValidations.get(fieldName)
	}

	private updateOverallValidity(): void {
		this._isValid = Array.from(this.fieldValidations.values()).every(v => v.valid) && 
			Object.keys(this._errors).length === 0
	}

	private extractFieldSchema(fieldName: string): z.ZodSchema<any> | null {
		// This is a simplified extraction - in practice, you might need more sophisticated logic
		// to extract nested field schemas from complex Zod schemas
		try {
			// For most cases, we'll rely on the main schema validation
			return null
		} catch {
			return null
		}
	}
}

/**
 * Utility functions for common validation patterns
 */
export const validationUtils = {
	/**
	 * Check if email format is valid without full validation
	 */
	isValidEmailFormat(email: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		return emailRegex.test(email)
	},

	/**
	 * Check if phone format is valid
	 */
	isValidPhoneFormat(phone: string): boolean {
		const phoneRegex = /^[\+]?[(]?[\d\s\-\(\)]{10,}$/
		return phoneRegex.test(phone)
	},

	/**
	 * Check if URL format is valid
	 */
	isValidUrlFormat(url: string): boolean {
		try {
			new URL(url)
			return true
		} catch {
			return false
		}
	},

	/**
	 * Format phone number for display
	 */
	formatPhoneNumber(phone: string): string {
		// Remove all non-digit characters except +
		const cleaned = phone.replace(/[^\d+]/g, '')
		
		// Basic US phone number formatting
		if (cleaned.length === 10) {
			return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
		} else if (cleaned.length === 11 && cleaned.startsWith('1')) {
			return cleaned.replace(/1(\d{3})(\d{3})(\d{4})/, '+1 ($1) $2-$3')
		}
		
		return phone // Return original if can't format
	},

	/**
	 * Validate date is not in the future (for birth dates)
	 */
	isValidBirthDate(dateString: string): boolean {
		const date = new Date(dateString)
		const now = new Date()
		return date <= now && date >= new Date(now.getFullYear() - 100, 0, 1)
	},

	/**
	 * Clean and validate array input
	 */
	cleanArray(input: string | string[]): string[] {
		if (Array.isArray(input)) {
			return input.filter(item => item && item.trim().length > 0)
		}
		if (typeof input === 'string') {
			return input.split(',').map(item => item.trim()).filter(item => item.length > 0)
		}
		return []
	}
}

/**
 * Pre-defined validation schemas for common artist fields
 */
export const artistFieldSchemas = {
	legal_first_name: requiredTextSchema(1, 100),
	legal_last_name: requiredTextSchema(1, 100),
	full_name: shortTextSchema(200),
	artist_name: shortTextSchema(200),
	email: emailSchema,
	phone: phoneSchema,
	dob: dateOfBirthSchema,
	bio: shortTextSchema(2000),
	one_sentence_bio: shortTextSchema(200),
	website: urlSchema,
	instagram: instagramSchema,
	facebook: urlSchema,
	social_security_number: ssnSchema,
	genres: arraySchema,
	instruments: arraySchema,
	languages: arraySchema,
	location: shortTextSchema(255),
	address: shortTextSchema(500),
	metropolitan_hub: shortTextSchema(100),
	employment_status: shortTextSchema(100)
}