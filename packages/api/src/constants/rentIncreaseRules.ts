// Rent Increase Rules by Australian State
// Mission 06: Tenancies & Leases

export interface RentIncreaseRule {
  minimumNoticeDays: number;
  maxFrequency: '6_months' | '12_months';
  fixedTermRestriction: boolean;
  periodicOnly: boolean;
  excessiveIncrease: string;
  noticeForm: string;
  tribunal: string;
}

export const RENT_INCREASE_RULES: Record<string, RentIncreaseRule> = {
  NSW: {
    minimumNoticeDays: 60,
    maxFrequency: '12_months',
    fixedTermRestriction: true,
    periodicOnly: false,
    excessiveIncrease: 'ncat',
    noticeForm: 'no_prescribed_form',
    tribunal: 'NSW Civil and Administrative Tribunal (NCAT)',
  },
  VIC: {
    minimumNoticeDays: 60,
    maxFrequency: '12_months',
    fixedTermRestriction: true,
    periodicOnly: false,
    excessiveIncrease: 'vcat',
    noticeForm: 'prescribed_form',
    tribunal: 'Victorian Civil and Administrative Tribunal (VCAT)',
  },
  QLD: {
    minimumNoticeDays: 60,
    maxFrequency: '6_months',
    fixedTermRestriction: true,
    periodicOnly: false,
    excessiveIncrease: 'qcat',
    noticeForm: 'form_13',
    tribunal: 'Queensland Civil and Administrative Tribunal (QCAT)',
  },
  SA: {
    minimumNoticeDays: 60,
    maxFrequency: '12_months',
    fixedTermRestriction: true,
    periodicOnly: false,
    excessiveIncrease: 'sacat',
    noticeForm: 'form_4',
    tribunal: 'South Australian Civil and Administrative Tribunal (SACAT)',
  },
  WA: {
    minimumNoticeDays: 60,
    maxFrequency: '6_months',
    fixedTermRestriction: true,
    periodicOnly: false,
    excessiveIncrease: 'magistrates_court',
    noticeForm: 'form_10',
    tribunal: 'Magistrates Court of Western Australia',
  },
  TAS: {
    minimumNoticeDays: 60,
    maxFrequency: '12_months',
    fixedTermRestriction: true,
    periodicOnly: false,
    excessiveIncrease: 'rct',
    noticeForm: 'no_prescribed_form',
    tribunal: 'Residential Tenancy Commissioner',
  },
  NT: {
    minimumNoticeDays: 30,
    maxFrequency: '6_months',
    fixedTermRestriction: true,
    periodicOnly: false,
    excessiveIncrease: 'ntcat',
    noticeForm: 'no_prescribed_form',
    tribunal: 'Northern Territory Civil and Administrative Tribunal (NTCAT)',
  },
  ACT: {
    minimumNoticeDays: 56,
    maxFrequency: '12_months',
    fixedTermRestriction: true,
    periodicOnly: false,
    excessiveIncrease: 'acat',
    noticeForm: 'no_prescribed_form',
    tribunal: 'ACT Civil and Administrative Tribunal (ACAT)',
  },
} as const;

// Termination notice periods by state (in days)
export const TERMINATION_NOTICE_PERIODS: Record<string, { noGrounds: number; endOfLease: number; breach: number }> = {
  NSW: { noGrounds: 90, endOfLease: 30, breach: 14 },
  VIC: { noGrounds: 90, endOfLease: 60, breach: 14 },
  QLD: { noGrounds: 60, endOfLease: 30, breach: 7 },
  SA: { noGrounds: 90, endOfLease: 28, breach: 14 },
  WA: { noGrounds: 60, endOfLease: 30, breach: 14 },
  TAS: { noGrounds: 84, endOfLease: 28, breach: 14 },
  NT: { noGrounds: 42, endOfLease: 14, breach: 14 },
  ACT: { noGrounds: 104, endOfLease: 26, breach: 14 },
};

/**
 * Calculate the minimum effective date for a rent increase
 * based on the state's notice period requirements.
 */
export function calculateMinimumEffectiveDate(state: string, noticeDate: Date): Date {
  const rules = RENT_INCREASE_RULES[state];
  if (!rules) throw new Error(`Unknown state: ${state}`);

  const effectiveDate = new Date(noticeDate);
  effectiveDate.setDate(effectiveDate.getDate() + rules.minimumNoticeDays);
  return effectiveDate;
}

/**
 * Check if a rent increase is allowed based on the last increase date
 * and the state's frequency rules.
 */
export function canIncreaseRent(
  state: string,
  lastIncreaseDate: Date | null,
  isPeriodic: boolean,
  isFixedTerm: boolean
): { allowed: boolean; reason?: string; nextAllowedDate?: Date } {
  const rules = RENT_INCREASE_RULES[state];
  if (!rules) return { allowed: false, reason: `Unknown state: ${state}` };

  // Cannot increase during fixed term (unless lease allows it)
  if (isFixedTerm && rules.fixedTermRestriction) {
    return {
      allowed: false,
      reason: `Rent cannot be increased during a fixed-term lease in ${state} unless the lease specifically allows it.`,
    };
  }

  if (!lastIncreaseDate) {
    return { allowed: true };
  }

  const monthsRequired = rules.maxFrequency === '12_months' ? 12 : 6;
  const nextAllowedDate = new Date(lastIncreaseDate);
  nextAllowedDate.setMonth(nextAllowedDate.getMonth() + monthsRequired);

  if (new Date() < nextAllowedDate) {
    return {
      allowed: false,
      reason: `Rent can only be increased once every ${monthsRequired} months in ${state}.`,
      nextAllowedDate,
    };
  }

  return { allowed: true };
}
