/**
 * Rate Parser Utility for PHWB Admin Payroll CSV Import
 * 
 * Handles parsing complex rate strings from CSV files and converts them
 * to structured data for payroll calculations.
 */

export interface RateData {
  base_rate: number;
  additional_rate?: number;
  rate_description: string;
  rate_type: 'hourly' | 'flat' | 'tiered' | 'na';
  is_valid: boolean;
  error_message?: string;
}

export interface PayrollCalculation {
  hours: number;
  base_pay: number;
  additional_pay: number;
  total_pay: number;
  calculation_notes: string;
}

/**
 * Parses a rate string from CSV and returns structured rate data
 * 
 * @param rateText - The rate string from CSV (e.g., "$129 per hour", "$206 + $103 per additional hour")
 * @returns RateData object with parsed information
 */
export function parseRateString(rateText: string): RateData {
  if (!rateText || typeof rateText !== 'string') {
    return {
      base_rate: 0,
      rate_description: '',
      rate_type: 'na',
      is_valid: false,
      error_message: 'Invalid or empty rate text'
    };
  }

  // Clean and normalize the input
  const cleanText = rateText.trim().toLowerCase();
  
  // Handle N/A cases (training, special payments, etc.)
  if (cleanText === 'n/a' || cleanText === 'na' || cleanText === '' || cleanText === '-') {
    return {
      base_rate: 0,
      rate_description: rateText.trim(),
      rate_type: 'na',
      is_valid: true
    };
  }

  try {
    // Pattern for tiered rates: "$206 + $103 per additional hour"
    const tieredPattern = /\$(\d+(?:\.\d{2})?)\s*\+\s*\$(\d+(?:\.\d{2})?)\s*per\s+additional\s+hour/i;
    const tieredMatch = rateText.match(tieredPattern);
    
    if (tieredMatch) {
      const baseRate = parseFloat(tieredMatch[1]);
      const additionalRate = parseFloat(tieredMatch[2]);
      
      return {
        base_rate: baseRate,
        additional_rate: additionalRate,
        rate_description: rateText.trim(),
        rate_type: 'tiered',
        is_valid: true
      };
    }

    // Pattern for simple hourly rates: "$129 per hour", "$52 per hour"
    const hourlyPattern = /\$(\d+(?:\.\d{2})?)\s*per\s+hour/i;
    const hourlyMatch = rateText.match(hourlyPattern);
    
    if (hourlyMatch) {
      const baseRate = parseFloat(hourlyMatch[1]);
      
      return {
        base_rate: baseRate,
        rate_description: rateText.trim(),
        rate_type: 'hourly',
        is_valid: true
      };
    }

    // Pattern for flat rates: "$500", "$1,200"
    const flatPattern = /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/;
    const flatMatch = rateText.match(flatPattern);
    
    if (flatMatch) {
      const baseRate = parseFloat(flatMatch[1].replace(/,/g, ''));
      
      return {
        base_rate: baseRate,
        rate_description: rateText.trim(),
        rate_type: 'flat',
        is_valid: true
      };
    }

    // Pattern for rates with just numbers: "129", "52.50"
    const numberPattern = /^(\d+(?:\.\d{2})?)$/;
    const numberMatch = cleanText.match(numberPattern);
    
    if (numberMatch) {
      const baseRate = parseFloat(numberMatch[1]);
      
      return {
        base_rate: baseRate,
        rate_description: `$${baseRate} (assumed hourly)`,
        rate_type: 'hourly',
        is_valid: true
      };
    }

    // If no patterns match, mark as invalid but preserve original text
    return {
      base_rate: 0,
      rate_description: rateText.trim(),
      rate_type: 'na',
      is_valid: false,
      error_message: `Unable to parse rate format: "${rateText}"`
    };

  } catch (error) {
    return {
      base_rate: 0,
      rate_description: rateText.trim(),
      rate_type: 'na',
      is_valid: false,
      error_message: `Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Calculates total pay based on hours worked and rate structure
 * 
 * @param hours - Number of hours worked
 * @param rateData - Parsed rate data from parseRateString
 * @returns PayrollCalculation object with detailed breakdown
 */
export function calculateTotalPay(hours: number, rateData: RateData): PayrollCalculation {
  if (!rateData.is_valid || hours < 0) {
    return {
      hours: hours,
      base_pay: 0,
      additional_pay: 0,
      total_pay: 0,
      calculation_notes: 'Invalid rate data or negative hours'
    };
  }

  if (rateData.rate_type === 'na') {
    return {
      hours: hours,
      base_pay: 0,
      additional_pay: 0,
      total_pay: 0,
      calculation_notes: 'N/A rate - no calculation performed'
    };
  }

  if (rateData.rate_type === 'flat') {
    return {
      hours: hours,
      base_pay: rateData.base_rate,
      additional_pay: 0,
      total_pay: rateData.base_rate,
      calculation_notes: 'Flat rate payment'
    };
  }

  if (rateData.rate_type === 'hourly') {
    const totalPay = hours * rateData.base_rate;
    return {
      hours: hours,
      base_pay: totalPay,
      additional_pay: 0,
      total_pay: totalPay,
      calculation_notes: `${hours} hours × $${rateData.base_rate}`
    };
  }

  if (rateData.rate_type === 'tiered' && rateData.additional_rate !== undefined) {
    if (hours <= 1) {
      // First hour or less at base rate
      const totalPay = hours * rateData.base_rate;
      return {
        hours: hours,
        base_pay: totalPay,
        additional_pay: 0,
        total_pay: totalPay,
        calculation_notes: `${hours} hours × $${rateData.base_rate} (base rate)`
      };
    } else {
      // First hour at base rate, additional hours at additional rate
      const basePay = rateData.base_rate;
      const additionalHours = hours - 1;
      const additionalPay = additionalHours * rateData.additional_rate;
      const totalPay = basePay + additionalPay;
      
      return {
        hours: hours,
        base_pay: basePay,
        additional_pay: additionalPay,
        total_pay: totalPay,
        calculation_notes: `1 hour × $${rateData.base_rate} + ${additionalHours} hours × $${rateData.additional_rate}`
      };
    }
  }

  return {
    hours: hours,
    base_pay: 0,
    additional_pay: 0,
    total_pay: 0,
    calculation_notes: 'Unknown rate type - no calculation performed'
  };
}

/**
 * Validates rate structure and ensures data integrity
 * 
 * @param rateData - Rate data to validate
 * @returns boolean indicating if rate structure is valid
 */
export function validateRateStructure(rateData: RateData): boolean {
  if (!rateData) {
    return false;
  }

  // N/A rates are considered valid
  if (rateData.rate_type === 'na') {
    return true;
  }

  // Base rate must be non-negative
  if (typeof rateData.base_rate !== 'number' || rateData.base_rate < 0) {
    return false;
  }

  // For tiered rates, additional rate must be present and non-negative
  if (rateData.rate_type === 'tiered') {
    if (typeof rateData.additional_rate !== 'number' || rateData.additional_rate < 0) {
      return false;
    }
  }

  // Rate description should be present
  if (!rateData.rate_description || rateData.rate_description.trim() === '') {
    return false;
  }

  return rateData.is_valid;
}

/**
 * Formats a rate for display purposes
 * 
 * @param rateData - Rate data to format
 * @returns Formatted rate string for UI display
 */
export function formatRateForDisplay(rateData: RateData): string {
  if (!rateData.is_valid) {
    return `Invalid: ${rateData.rate_description}`;
  }

  if (rateData.rate_type === 'na') {
    return rateData.rate_description || 'N/A';
  }

  if (rateData.rate_type === 'flat') {
    return `$${rateData.base_rate.toFixed(2)} (flat rate)`;
  }

  if (rateData.rate_type === 'hourly') {
    return `$${rateData.base_rate.toFixed(2)} per hour`;
  }

  if (rateData.rate_type === 'tiered' && rateData.additional_rate !== undefined) {
    return `$${rateData.base_rate.toFixed(2)} + $${rateData.additional_rate.toFixed(2)} per additional hour`;
  }

  return rateData.rate_description;
}

/**
 * Formats currency for display
 * 
 * @param amount - Amount to format
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Batch processes multiple rate strings for CSV import
 * 
 * @param rateStrings - Array of rate strings from CSV
 * @returns Array of parsed rate data with validation results
 */
export function batchParseRates(rateStrings: string[]): RateData[] {
  return rateStrings.map(rateString => parseRateString(rateString));
}

/**
 * Gets summary statistics for a batch of parsed rates
 * 
 * @param rateDataArray - Array of parsed rate data
 * @returns Summary statistics object
 */
export function getRateParsingStats(rateDataArray: RateData[]) {
  const total = rateDataArray.length;
  const valid = rateDataArray.filter(r => r.is_valid).length;
  const invalid = total - valid;
  const typeBreakdown = rateDataArray.reduce((acc, rate) => {
    acc[rate.rate_type] = (acc[rate.rate_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    total,
    valid,
    invalid,
    validPercentage: total > 0 ? ((valid / total) * 100).toFixed(1) : '0.0',
    typeBreakdown,
    errors: rateDataArray
      .filter(r => !r.is_valid && r.error_message)
      .map(r => ({ rate: r.rate_description, error: r.error_message }))
  };
}