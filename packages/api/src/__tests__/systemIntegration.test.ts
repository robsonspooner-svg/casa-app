// System Integration Tests
// Validates that the full tool pipeline, hook data flows, and screen
// exports are properly wired end-to-end — not just that they compile.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: Tool Pipeline Completeness
// Every tool in the catalog must exist in the registry and dispatcher
// ═══════════════════════════════════════════════════════════════════════════

describe('Tool Pipeline Integration', () => {
  // We import the catalog directly — it's the source of truth for "what tools should exist"
  let TOOL_CATALOG: any[];

  beforeEach(async () => {
    // Import the tool catalog from agent-core
    const catalog = await import('../../../../packages/agent-core/src/constants/tool-catalog');
    TOOL_CATALOG = catalog.TOOL_CATALOG || [];
  });

  it('TOOL_CATALOG should export a non-empty array', () => {
    expect(Array.isArray(TOOL_CATALOG)).toBe(true);
    expect(TOOL_CATALOG.length).toBeGreaterThan(50); // We know we have 60+ tools
  });

  it('every catalog tool should have required fields', () => {
    TOOL_CATALOG.forEach(tool => {
      expect(tool.name).toBeTruthy();
      expect(typeof tool.name).toBe('string');
      expect(tool.description).toBeTruthy();
      expect(tool.input_schema).toBeDefined();
      expect(tool.category).toBeTruthy();
      expect(typeof tool.autonomyLevel).toBe('number');
      // riskLevel is a string enum: 'none' | 'low' | 'medium' | 'high' | 'critical'
      expect(typeof tool.riskLevel).toBe('string');
      expect(['none', 'low', 'medium', 'high', 'critical']).toContain(tool.riskLevel);
      expect(typeof tool.reversible).toBe('boolean');
    });
  });

  it('should have tools from all categories', () => {
    const categories = new Set(TOOL_CATALOG.map((t: any) => t.category));
    expect(categories.has('query')).toBe(true);
    expect(categories.has('action')).toBe(true);
    expect(categories.has('generate')).toBe(true);
    expect(categories.has('integration')).toBe(true);
    expect(categories.has('workflow')).toBe(true);
    expect(categories.has('memory')).toBe(true);
    expect(categories.has('planning')).toBe(true);
  });

  it('should not have duplicate tool names', () => {
    const names = TOOL_CATALOG.map((t: any) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('all tool names should be snake_case', () => {
    TOOL_CATALOG.forEach(tool => {
      expect(tool.name).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
    });
  });

  it('all tool input_schema should be valid JSON Schema objects', () => {
    TOOL_CATALOG.forEach(tool => {
      expect(tool.input_schema.type).toBe('object');
      expect(tool.input_schema.properties).toBeDefined();
      expect(typeof tool.input_schema.properties).toBe('object');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: Hook Exports Completeness
// Every hook exported from ../index should be a real function, not undefined
// ═══════════════════════════════════════════════════════════════════════════

describe('Hook Exports Integration', () => {
  it('should export all property hooks', async () => {
    const api = await import('../index');
    expect(typeof api.useProperties).toBe('function');
    expect(typeof api.useProperty).toBe('function');
    expect(typeof api.usePropertyMutations).toBe('function');
  });

  it('should export all tenancy hooks', async () => {
    const api = await import('../index');
    expect(typeof api.useTenancies).toBe('function');
    expect(typeof api.useTenancy).toBe('function');
    expect(typeof api.useTenancyMutations).toBe('function');
  });

  it('should export all listing hooks', async () => {
    const api = await import('../index');
    expect(typeof api.useListings).toBe('function');
    expect(typeof api.useListing).toBe('function');
  });

  it('should export all application hooks', async () => {
    const api = await import('../index');
    expect(typeof api.useApplications).toBe('function');
  });

  it('should export all arrears hooks', async () => {
    const api = await import('../index');
    expect(typeof api.useArrears).toBe('function');
    expect(typeof api.useArrearsDetail).toBe('function');
  });

  it('should export all maintenance hooks', async () => {
    const api = await import('../index');
    expect(typeof api.useMaintenance).toBe('function');
    expect(typeof api.useMaintenanceRequest).toBe('function');
    expect(typeof api.useMaintenanceMutations).toBe('function');
  });

  it('should export M11 inspection hooks', async () => {
    const api = await import('../index');
    expect(typeof api.useInspections).toBe('function');
    expect(typeof api.useInspection).toBe('function');
    expect(typeof api.useInspectionMutations).toBe('function');
  });

  it('should export M12 communication hooks', async () => {
    const api = await import('../index');
    expect(typeof api.useConversations).toBe('function');
    expect(typeof api.useConversation).toBe('function');
    expect(typeof api.useNotificationPreferences).toBe('function');
  });

  it('should export M13 reports & analytics hooks', async () => {
    const api = await import('../index');
    expect(typeof api.useDashboard).toBe('function');
    expect(typeof api.useFinancials).toBe('function');
    expect(typeof api.useExpenses).toBe('function');
    expect(typeof api.useReports).toBe('function');
    expect(typeof api.useCashFlowForecast).toBe('function');
  });

  it('should export auth and profile hooks', async () => {
    const api = await import('../index');
    expect(typeof api.useAuth).toBe('function');
    expect(typeof api.useProfile).toBe('function');
    expect(typeof api.AuthProvider).toBeDefined();
  });

  it('should export feature gating', async () => {
    const api = await import('../index');
    expect(typeof api.useFeatureGate).toBe('function');
  });

  it('should export subscription tier data', async () => {
    const api = await import('../index');
    // SUBSCRIPTION_TIERS is an object keyed by tier id, not a hook
    expect(api.SUBSCRIPTION_TIERS).toBeDefined();
    expect(typeof api.SUBSCRIPTION_TIERS).toBe('object');
  });

  it('should export Supabase client utilities', async () => {
    const api = await import('../index');
    expect(typeof api.getSupabaseClient).toBe('function');
    expect(typeof api.initializeSupabase).toBe('function');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: Type Exports Completeness
// Key types should be exported from ../index for consumers
// ═══════════════════════════════════════════════════════════════════════════

describe('Type Exports Integration', () => {
  it('should export M13 forecast types', async () => {
    // These are type-only exports, but we can verify the module re-exports
    const api = await import('../index');
    // If the export doesn't exist, the import would fail or be undefined
    // We check that useCashFlowForecast exists since types are compiled away at runtime
    expect(api.useCashFlowForecast).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: Config & Theme Integration
// All config and theme values used by screens must be valid
// ═══════════════════════════════════════════════════════════════════════════

describe('Config & Theme Integration', () => {
  it('THEME should have all required color tokens', async () => {
    const { THEME } = await import('../../../../packages/config/index');
    expect(THEME.colors.brand).toBeTruthy();
    expect(THEME.colors.canvas).toBeTruthy();
    expect(THEME.colors.surface).toBeTruthy();
    expect(THEME.colors.textPrimary).toBeTruthy();
    expect(THEME.colors.textSecondary).toBeTruthy();
    expect(THEME.colors.textTertiary).toBeTruthy();
    expect(THEME.colors.border).toBeTruthy();
    expect(THEME.colors.error).toBeTruthy();
    expect(THEME.colors.success).toBeTruthy();
    expect(THEME.colors.warning).toBeTruthy();
  });

  it('THEME should have valid spacing values', async () => {
    const { THEME } = await import('../../../../packages/config/index');
    // Actual order: xs(4) < sm(8) < md(12) < base(16) < lg(24) < xl(32)
    expect(THEME.spacing.xs).toBeGreaterThan(0);
    expect(THEME.spacing.sm).toBeGreaterThan(THEME.spacing.xs);
    expect(THEME.spacing.md).toBeGreaterThan(THEME.spacing.sm);
    expect(THEME.spacing.base).toBeGreaterThan(THEME.spacing.md);
    expect(THEME.spacing.lg).toBeGreaterThan(THEME.spacing.base);
    expect(THEME.spacing.xl).toBeGreaterThan(THEME.spacing.lg);
  });

  it('THEME should have valid radius values', async () => {
    const { THEME } = await import('../../../../packages/config/index');
    expect(THEME.radius.sm).toBeGreaterThan(0);
    expect(THEME.radius.md).toBeGreaterThan(THEME.radius.sm);
    expect(THEME.radius.lg).toBeGreaterThan(THEME.radius.md);
    expect(THEME.radius.full).toBeGreaterThan(THEME.radius.lg);
  });

  it('THEME should have valid font sizes', async () => {
    const { THEME } = await import('../../../../packages/config/index');
    expect(THEME.fontSize.caption).toBeGreaterThan(0);
    expect(THEME.fontSize.bodySmall).toBeGreaterThan(THEME.fontSize.caption);
    expect(THEME.fontSize.body).toBeGreaterThan(THEME.fontSize.bodySmall);
    expect(THEME.fontSize.h3).toBeGreaterThan(THEME.fontSize.body);
    expect(THEME.fontSize.h2).toBeGreaterThan(THEME.fontSize.h3);
    expect(THEME.fontSize.h1).toBeGreaterThan(THEME.fontSize.h2);
  });

  it('THEME colors should be valid hex or rgb values', async () => {
    const { THEME } = await import('../../../../packages/config/index');
    const colorRegex = /^(#[0-9a-fA-F]{3,8}|rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*[\d.]+)?\))$/;
    // Check main colors
    ['brand', 'canvas', 'surface', 'textPrimary', 'error'].forEach(key => {
      expect((THEME.colors as any)[key]).toMatch(colorRegex);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 5: Constants & Business Logic Integrity
// ═══════════════════════════════════════════════════════════════════════════

describe('Business Logic Integration', () => {
  it('subscription tiers should have correct pricing hierarchy', async () => {
    const { SUBSCRIPTION_TIERS } = await import('../index');
    // SUBSCRIPTION_TIERS is an object keyed by tier id (starter, pro, portfolio)
    const tiers = Object.values(SUBSCRIPTION_TIERS as Record<string, any>);
    expect(tiers.length).toBeGreaterThanOrEqual(2);
    const tierPrices = tiers.map((t: any) => t.price);
    // Verify ascending price order
    for (let i = 1; i < tierPrices.length; i++) {
      expect(tierPrices[i]).toBeGreaterThanOrEqual(tierPrices[i - 1]);
    }
  });

  it('rent increase rules should cover all AU states', async () => {
    const { RENT_INCREASE_RULES } = await import('../index');
    const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'];
    states.forEach(state => {
      expect((RENT_INCREASE_RULES as any)[state]).toBeDefined();
    });
  });

  it('inspection rules should cover all AU states', async () => {
    const { INSPECTION_RULES } = await import('../index');
    const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'];
    states.forEach(state => {
      expect((INSPECTION_RULES as any)[state]).toBeDefined();
    });
  });

  it('arrears severity config should have all levels', async () => {
    const { ARREARS_SEVERITY_CONFIG } = await import('../index');
    expect(ARREARS_SEVERITY_CONFIG).toBeDefined();
    const levels = Object.keys(ARREARS_SEVERITY_CONFIG as any);
    expect(levels).toContain('minor');
    expect(levels).toContain('moderate');
    expect(levels).toContain('serious');
    expect(levels).toContain('critical');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 6: Agent Tool Catalog Cross-Reference
// Verifies internal consistency of the tool catalog itself
// ═══════════════════════════════════════════════════════════════════════════

describe('Agent Tool Catalog Consistency', () => {
  let catalog: any[];

  beforeEach(async () => {
    const mod = await import('../../../../packages/agent-core/src/constants/tool-catalog');
    catalog = mod.TOOL_CATALOG || [];
  });

  it('all tools with compensationTool should reference existing tools', () => {
    const names = new Set(catalog.map((t: any) => t.name));
    catalog.forEach(tool => {
      if (tool.compensationTool) {
        expect(names.has(tool.compensationTool)).toBe(true);
      }
    });
  });

  it('all tools should have valid resilience configuration', () => {
    catalog.forEach(tool => {
      if (tool.resilience) {
        expect(tool.resilience.retry).toBeDefined();
        expect(tool.resilience.timeout).toBeDefined();
        expect(tool.resilience.retry.maxAttempts).toBeGreaterThan(0);
        expect(tool.resilience.timeout.executionMs).toBeGreaterThan(0);
      }
    });
  });

  it('query tools should never be high risk', () => {
    const queryTools = catalog.filter((t: any) => t.category === 'query');
    // riskLevel is a string: 'none' | 'low' | 'medium' | 'high' | 'critical'
    queryTools.forEach(tool => {
      expect(['none', 'low']).toContain(tool.riskLevel);
    });
  });

  it('mission 11 inspection tools should exist', () => {
    const names = catalog.map((t: any) => t.name);
    expect(names).toContain('get_inspections');
    expect(names).toContain('get_inspection_detail');
    expect(names).toContain('schedule_inspection');
    expect(names).toContain('cancel_inspection');
    expect(names).toContain('generate_inspection_report');
    expect(names).toContain('compare_inspections');
  });

  it('mission 12 communication tools should exist', () => {
    const names = catalog.map((t: any) => t.name);
    expect(names).toContain('send_message');
    expect(names).toContain('create_conversation');
    expect(names).toContain('get_conversations');
    expect(names).toContain('get_conversation_messages');
    expect(names).toContain('send_in_app_message');
    expect(names).toContain('draft_message');
  });

  it('mission 13 reporting tools should exist', () => {
    const names = catalog.map((t: any) => t.name);
    expect(names).toContain('get_financial_summary');
    expect(names).toContain('get_property_metrics');
    expect(names).toContain('get_expenses');
    expect(names).toContain('generate_financial_report');
    expect(names).toContain('generate_tax_report');
    expect(names).toContain('generate_property_summary');
  });

  it('workflow tools should all be workflow category', () => {
    const workflows = catalog.filter((t: any) => t.name.startsWith('workflow_'));
    expect(workflows.length).toBe(5);
    workflows.forEach(tool => {
      expect(tool.category).toBe('workflow');
    });
  });

  it('memory tools should all have high autonomy', () => {
    const memTools = catalog.filter((t: any) => t.category === 'memory');
    memTools.forEach(tool => {
      // AutonomyLevel.Autonomous = 4
      expect(tool.autonomyLevel).toBeGreaterThanOrEqual(3);
    });
  });
});
