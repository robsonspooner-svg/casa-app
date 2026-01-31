export type ComplianceState = 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'NT' | 'ACT';

export interface ComplianceItem {
  id: string;
  title: string;
  description: string;
  category: 'documentation' | 'safety' | 'financial' | 'condition';
  required: boolean;
  states: ComplianceState[] | 'all';
  automatable: boolean;
}

export interface ComplianceCategory {
  id: string;
  title: string;
  items: ComplianceItem[];
}

const ALL_COMPLIANCE_ITEMS: ComplianceItem[] = [
  // Documentation
  {
    id: 'lease_agreement',
    title: 'Lease Agreement',
    description: 'Signed residential tenancy agreement',
    category: 'documentation',
    required: true,
    states: 'all',
    automatable: true,
  },
  {
    id: 'tenant_information',
    title: 'Tenant Information Statement',
    description: 'State-specific tenant rights and responsibilities handbook',
    category: 'documentation',
    required: true,
    states: ['NSW', 'VIC', 'QLD'],
    automatable: false,
  },
  {
    id: 'strata_bylaws',
    title: 'Strata By-laws',
    description: 'Copy of strata scheme by-laws (if applicable)',
    category: 'documentation',
    required: true,
    states: ['NSW'],
    automatable: false,
  },
  {
    id: 'disclosure_statement',
    title: 'Disclosure Statement',
    description: 'Material facts about the property',
    category: 'documentation',
    required: true,
    states: ['VIC', 'QLD'],
    automatable: false,
  },

  // Safety
  {
    id: 'smoke_alarms',
    title: 'Smoke Alarms',
    description: 'Working smoke alarms installed and compliant',
    category: 'safety',
    required: true,
    states: 'all',
    automatable: false,
  },
  {
    id: 'gas_safety',
    title: 'Gas Safety Check',
    description: 'Gas appliances checked by licensed gasfitter (within 2 years)',
    category: 'safety',
    required: true,
    states: ['VIC'],
    automatable: false,
  },
  {
    id: 'electrical_safety',
    title: 'Electrical Safety',
    description: 'Electrical safety check certificate',
    category: 'safety',
    required: true,
    states: ['VIC', 'QLD'],
    automatable: false,
  },
  {
    id: 'pool_safety',
    title: 'Pool Safety Certificate',
    description: 'Valid pool safety certificate (if applicable)',
    category: 'safety',
    required: true,
    states: ['QLD'],
    automatable: false,
  },
  {
    id: 'window_safety',
    title: 'Window Safety Devices',
    description: 'Window safety devices on windows above ground floor',
    category: 'safety',
    required: true,
    states: ['NSW', 'QLD'],
    automatable: false,
  },

  // Financial
  {
    id: 'bond_lodgement',
    title: 'Bond Lodgement',
    description: 'Bond lodged with state authority within required timeframe',
    category: 'financial',
    required: true,
    states: 'all',
    automatable: true,
  },
  {
    id: 'rent_receipt_system',
    title: 'Rent Receipt System',
    description: 'System for providing rent receipts',
    category: 'financial',
    required: true,
    states: 'all',
    automatable: true,
  },
  {
    id: 'bond_condition_report',
    title: 'Bond Condition Report',
    description: 'Condition report completed and signed by both parties',
    category: 'financial',
    required: true,
    states: 'all',
    automatable: true,
  },

  // Condition
  {
    id: 'entry_condition_report',
    title: 'Entry Condition Report',
    description: 'Detailed condition report with photos at start of tenancy',
    category: 'condition',
    required: true,
    states: 'all',
    automatable: true,
  },
  {
    id: 'property_clean',
    title: 'Property Clean',
    description: 'Property professionally cleaned before tenant moves in',
    category: 'condition',
    required: true,
    states: 'all',
    automatable: false,
  },
  {
    id: 'keys_provided',
    title: 'Keys & Access',
    description: 'All keys, remotes, and access devices provided to tenant',
    category: 'condition',
    required: true,
    states: 'all',
    automatable: false,
  },
];

const CATEGORY_METADATA: Record<ComplianceItem['category'], { id: string; title: string }> = {
  documentation: { id: 'documentation', title: 'Documentation' },
  safety: { id: 'safety', title: 'Safety' },
  financial: { id: 'financial', title: 'Financial' },
  condition: { id: 'condition', title: 'Condition' },
};

function isItemApplicable(item: ComplianceItem, state: ComplianceState): boolean {
  if (item.states === 'all') return true;
  return item.states.includes(state);
}

export function getComplianceChecklist(state: ComplianceState): ComplianceCategory[] {
  const filteredItems = ALL_COMPLIANCE_ITEMS.filter((item) => isItemApplicable(item, state));

  const groupedByCategory = filteredItems.reduce<Record<string, ComplianceItem[]>>((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  const categoryOrder: ComplianceItem['category'][] = ['documentation', 'safety', 'financial', 'condition'];

  return categoryOrder
    .filter((category) => groupedByCategory[category]?.length > 0)
    .map((category) => ({
      ...CATEGORY_METADATA[category],
      items: groupedByCategory[category],
    }));
}
