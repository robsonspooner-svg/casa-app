// Inspection Rules by Australian State
// Mission 11: Property Inspections

import type { ConditionRating, InspectionType } from '../types/database';

// ============================================================
// STATE-SPECIFIC INSPECTION RULES
// ============================================================

export interface InspectionRule {
  /** Maximum frequency for routine inspections (in months) */
  routineIntervalMonths: number;
  /** Required notice days for routine inspections */
  routineNoticeDays: number;
  /** Required notice days for entry inspection */
  entryNoticeDays: number;
  /** Maximum routine inspections allowed per year */
  maxInspectionsPerYear: number;
  /** Time of day restrictions (e.g., must be between 8am and 6pm) */
  allowedHoursStart: number;
  allowedHoursEnd: number;
  /** Governing legislation */
  legislation: string;
  /** Tribunal for disputes */
  tribunal: string;
}

export const INSPECTION_RULES: Record<string, InspectionRule> = {
  NSW: {
    routineIntervalMonths: 6,
    routineNoticeDays: 7,
    entryNoticeDays: 7,
    maxInspectionsPerYear: 4,
    allowedHoursStart: 8,
    allowedHoursEnd: 18,
    legislation: 'Residential Tenancies Act 2010 (NSW)',
    tribunal: 'NSW Civil and Administrative Tribunal (NCAT)',
  },
  VIC: {
    routineIntervalMonths: 6,
    routineNoticeDays: 7,
    entryNoticeDays: 7,
    maxInspectionsPerYear: 4,
    allowedHoursStart: 8,
    allowedHoursEnd: 18,
    legislation: 'Residential Tenancies Act 1997 (VIC)',
    tribunal: 'Victorian Civil and Administrative Tribunal (VCAT)',
  },
  QLD: {
    routineIntervalMonths: 3,
    routineNoticeDays: 7,
    entryNoticeDays: 7,
    maxInspectionsPerYear: 4,
    allowedHoursStart: 8,
    allowedHoursEnd: 18,
    legislation: 'Residential Tenancies and Rooming Accommodation Act 2008 (QLD)',
    tribunal: 'Queensland Civil and Administrative Tribunal (QCAT)',
  },
  SA: {
    routineIntervalMonths: 4,
    routineNoticeDays: 7,
    entryNoticeDays: 7,
    maxInspectionsPerYear: 4,
    allowedHoursStart: 8,
    allowedHoursEnd: 20,
    legislation: 'Residential Tenancies Act 1995 (SA)',
    tribunal: 'South Australian Civil and Administrative Tribunal (SACAT)',
  },
  WA: {
    routineIntervalMonths: 3,
    routineNoticeDays: 7,
    entryNoticeDays: 7,
    maxInspectionsPerYear: 4,
    allowedHoursStart: 8,
    allowedHoursEnd: 18,
    legislation: 'Residential Tenancies Act 1987 (WA)',
    tribunal: 'Magistrates Court of Western Australia',
  },
  TAS: {
    routineIntervalMonths: 6,
    routineNoticeDays: 7,
    entryNoticeDays: 7,
    maxInspectionsPerYear: 4,
    allowedHoursStart: 8,
    allowedHoursEnd: 18,
    legislation: 'Residential Tenancy Act 1997 (TAS)',
    tribunal: 'Magistrates Court of Tasmania',
  },
  ACT: {
    routineIntervalMonths: 6,
    routineNoticeDays: 7,
    entryNoticeDays: 7,
    maxInspectionsPerYear: 4,
    allowedHoursStart: 8,
    allowedHoursEnd: 18,
    legislation: 'Residential Tenancies Act 1997 (ACT)',
    tribunal: 'ACT Civil and Administrative Tribunal (ACAT)',
  },
  NT: {
    routineIntervalMonths: 6,
    routineNoticeDays: 7,
    entryNoticeDays: 7,
    maxInspectionsPerYear: 4,
    allowedHoursStart: 8,
    allowedHoursEnd: 18,
    legislation: 'Residential Tenancies Act 1999 (NT)',
    tribunal: 'Northern Territory Civil and Administrative Tribunal (NTCAT)',
  },
};

// ============================================================
// CONDITION RATING CONFIG
// ============================================================

export interface ConditionConfig {
  label: string;
  color: string;
  bgColor: string;
  sortOrder: number;
}

export const CONDITION_RATING_CONFIG: Record<ConditionRating, ConditionConfig> = {
  excellent: { label: 'Excellent', color: '#059669', bgColor: '#D1FAE5', sortOrder: 0 },
  good: { label: 'Good', color: '#16A34A', bgColor: '#DCFCE7', sortOrder: 1 },
  fair: { label: 'Fair', color: '#D97706', bgColor: '#FEF3C7', sortOrder: 2 },
  poor: { label: 'Poor', color: '#EA580C', bgColor: '#FFEDD5', sortOrder: 3 },
  damaged: { label: 'Damaged', color: '#DC2626', bgColor: '#FEE2E2', sortOrder: 4 },
  missing: { label: 'Missing', color: '#DC2626', bgColor: '#FEE2E2', sortOrder: 5 },
  not_applicable: { label: 'N/A', color: '#9CA3AF', bgColor: '#F3F4F6', sortOrder: 6 },
};

// ============================================================
// NOTICE PERIOD RULES BY TYPE
// ============================================================

export interface NoticeRequirement {
  noticeDays: number;
  noticeMethod: 'written' | 'written_or_electronic';
  description: string;
}

export function getNoticeRequirement(state: string, type: InspectionType): NoticeRequirement {
  const rules = INSPECTION_RULES[state] || INSPECTION_RULES.NSW;

  switch (type) {
    case 'routine':
      return {
        noticeDays: rules.routineNoticeDays,
        noticeMethod: 'written_or_electronic',
        description: `${rules.routineNoticeDays} days written notice required for routine inspections in ${state}`,
      };
    case 'entry':
      return {
        noticeDays: rules.entryNoticeDays,
        noticeMethod: 'written_or_electronic',
        description: `${rules.entryNoticeDays} days notice required for entry condition report in ${state}`,
      };
    case 'exit':
      return {
        noticeDays: 0,
        noticeMethod: 'written_or_electronic',
        description: 'Exit inspections are typically conducted at or near the end of tenancy',
      };
    default:
      return {
        noticeDays: rules.routineNoticeDays,
        noticeMethod: 'written_or_electronic',
        description: `${rules.routineNoticeDays} days notice required in ${state}`,
      };
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if a routine inspection is due for a property
 */
export function isInspectionDue(
  lastInspectionDate: string | null,
  state: string,
): { isDue: boolean; daysUntilDue: number; overdueDays: number } {
  const rules = INSPECTION_RULES[state] || INSPECTION_RULES.NSW;
  const intervalMs = rules.routineIntervalMonths * 30.44 * 24 * 60 * 60 * 1000;

  if (!lastInspectionDate) {
    return { isDue: true, daysUntilDue: 0, overdueDays: 0 };
  }

  const lastDate = new Date(lastInspectionDate);
  const nextDue = new Date(lastDate.getTime() + intervalMs);
  const now = new Date();
  const diffMs = nextDue.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  return {
    isDue: diffDays <= 0,
    daysUntilDue: Math.max(0, diffDays),
    overdueDays: Math.max(0, -diffDays),
  };
}

/**
 * Calculate the earliest valid scheduled date for an inspection
 * (must respect notice period)
 */
export function getEarliestScheduleDate(state: string, type: InspectionType): Date {
  const notice = getNoticeRequirement(state, type);
  const earliest = new Date();
  earliest.setDate(earliest.getDate() + notice.noticeDays);
  return earliest;
}

/**
 * Get the condition severity order (lower index = better)
 */
export function getConditionSeverity(condition: ConditionRating): number {
  return CONDITION_RATING_CONFIG[condition]?.sortOrder ?? 6;
}

/**
 * Determine the worst condition from an array of conditions
 */
export function getWorstCondition(conditions: ConditionRating[]): ConditionRating {
  const valid = conditions.filter(c => c !== 'not_applicable');
  if (valid.length === 0) return 'not_applicable';

  return valid.reduce((worst, current) =>
    getConditionSeverity(current) > getConditionSeverity(worst) ? current : worst
  );
}

// ============================================================
// WEAR AND TEAR GUIDELINES (AUSTRALIAN TENANCY LAW)
// ============================================================

export const WEAR_AND_TEAR_GUIDELINES = {
  acceptable: [
    'Faded paint from sunlight',
    'Minor scuff marks on walls from furniture',
    'Worn carpet in high-traffic areas',
    'Small nail holes from picture hanging',
    'Faded curtains/blinds from sun exposure',
    'Slightly worn kitchen benchtops',
    'Minor grout discolouration from normal use',
    'Loose door handles from regular use',
    'Minor carpet indentations from furniture',
  ],
  tenantDamage: [
    'Large holes in walls',
    'Burns or stains on carpet',
    'Broken fixtures or fittings',
    'Mould from inadequate ventilation (tenant responsibility)',
    'Pet damage (scratches, odours)',
    'Broken windows or doors',
    'Significant grease/grime buildup beyond normal',
    'Unauthorised alterations',
    'Missing fixtures or fittings',
    'Deliberate damage or vandalism',
  ],
} as const;

// ============================================================
// PROFESSIONAL INSPECTION PRICING
// ============================================================

export const PROFESSIONAL_INSPECTION_PRICING = {
  /** One-off fee for Starter tier */
  starterAddOnPrice: 99,
  /** Included in Pro/Hands-Off subscription */
  proIncluded: true,
  handsOffIncluded: true,
} as const;
