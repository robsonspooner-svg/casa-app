// Generate, External, Workflow, Memory & Planning Tool Handlers

import { generateEmbedding, buildPreferenceEmbeddingText, formatEmbeddingForStorage } from './embeddings.ts';

type SupabaseClient = any;
type ToolResult = { success: boolean; data?: unknown; error?: string };
type ToolInput = Record<string, unknown>;

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE TOOLS — return data + instruction for Claude to reason over
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_generate_listing(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: property, error } = await sb
    .from('properties')
    .select('id, address_line_1, suburb, state, postcode, property_type, bedrooms, bathrooms, parking_spaces, land_size_sqm, floor_size_sqm, year_built, rent_amount, rent_frequency')
    .eq('id', input.property_id as string).eq('owner_id', userId).single();
  if (error) return { success: false, error: error.message };

  return { success: true, data: { property, highlights: (input.highlights as string[]) || [], tone: input.tone || 'professional', instruction: 'Generate a compelling listing title and description for this property. Use Australian English. Be specific about features and location. Return a JSON object with "title" and "description" fields.' } };
}

export async function handle_draft_message(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: tenant } = await sb.from('profiles').select('id, full_name, email').eq('id', input.tenant_id || '').maybeSingle();

  const { data: tenancy } = await sb
    .from('tenancy_tenants')
    .select('tenancies!inner(id, rent_amount, rent_frequency, status, properties!inner(address_line_1, suburb, state, owner_id, profiles:owner_id(full_name)))')
    .eq('tenant_id', input.tenant_id || '')
    .eq('tenancies.properties.owner_id', userId)
    .limit(1).maybeSingle();

  return { success: true, data: { tenant, tenancy, purpose: input.purpose, context: input.context || {}, tone: input.tone || 'friendly', recipient_type: input.recipient_type || 'tenant', instruction: 'Draft a message for this recipient based on the purpose and context. Use Australian English. Return only the message text.' } };
}

export async function handle_score_application(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: app, error } = await sb
    .from('applications')
    .select('*, listings!inner(owner_id, rent_amount, rent_frequency, properties(address_line_1, suburb))')
    .eq('id', input.application_id as string).eq('listings.owner_id', userId).single();
  if (error) return { success: false, error: error.message };

  const [refs, checks] = await Promise.all([
    sb.from('application_references').select('*').eq('application_id', input.application_id as string),
    sb.from('background_checks').select('*').eq('application_id', input.application_id as string),
  ]);

  return { success: true, data: { application: app, references: refs.data || [], background_checks: checks.data || [], criteria_weights: input.criteria_weights || {}, instruction: 'Score this application 0-100. Consider: income-to-rent ratio (annual income vs weekly rent * 52), employment stability, rental history, references, background checks. Return JSON: { "score": N, "breakdown": {...}, "strengths": [...], "concerns": [...], "recommendation": "..." }' } };
}

export async function handle_rank_applications(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: apps, error } = await sb
    .from('applications')
    .select('id, full_name, annual_income, employment_type, employer_name, current_rent, has_pets, move_in_date, status')
    .in('id', input.application_ids as string[])
    .eq('listing_id', input.listing_id as string);
  if (error) return { success: false, error: error.message };

  return { success: true, data: { applications: apps, prioritize: input.prioritize || 'balanced', instruction: 'Rank these applications from best to worst. For each, provide a score and key reasons. Return JSON array: [{ "application_id": "...", "rank": 1, "score": N, "key_factors": [...] }]' } };
}

export async function handle_triage_maintenance(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: req } = await sb.from('maintenance_requests').select('*, properties!inner(address_line_1, suburb, state, owner_id, year_built)').eq('id', input.request_id as string).eq('properties.owner_id', userId).single();
  if (!req) return { success: false, error: 'Request not found' };

  return { success: true, data: { request: req, photos: input.photos || [], instruction: 'Triage this maintenance request. Determine: 1) Urgency (emergency/urgent/routine), 2) Estimated cost range (AUD), 3) Recommended trade category, 4) Suggested action plan. Return JSON: { "urgency": "...", "cost_estimate": { "low": N, "high": N }, "trade_category": "...", "action_plan": [...], "safety_concerns": [...] }' } };
}

export async function handle_estimate_cost(input: ToolInput, _userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const category = input.category as string;
  const postcode = (input.postcode as string) || undefined;
  const state = (input.state as string) || undefined;

  // Query platform-wide cost intelligence from completed work orders
  const { data: stats, error } = await sb.rpc('get_cost_intelligence', {
    p_category: category,
    p_postcode: postcode || null,
    p_state: state || null,
  });

  const hasPlatformData = !error && stats && stats.sample_size > 0;

  return { success: true, data: {
    category,
    description: input.description,
    postcode: postcode || '',
    platform_data: hasPlatformData ? stats : null,
    instruction: hasPlatformData
      ? `Estimate the cost of this maintenance work in Australian dollars. Category: ${category}. Description: ${input.description}. Location: ${postcode || 'unknown'}. We have real platform data from ${stats.sample_size} completed jobs at the ${stats.level} level: low (25th pctl) $${stats.low}, median $${stats.mid}, high (75th pctl) $${stats.high}, range $${stats.min}-$${stats.max}. Use this data as a strong baseline, then adjust for the specific description and scope. Return JSON: { "low": N, "mid": N, "high": N, "factors": [...], "confidence": "high|medium|low", "data_source": "platform", "sample_size": ${stats.sample_size}, "notes": "..." }`
      : `Estimate the cost of this maintenance work in Australian dollars. Category: ${category}. Description: ${input.description}. Location postcode: ${postcode || 'unknown'}. No platform data available yet for this category/location. Provide low/mid/high estimates based on typical Australian trade rates. Return JSON: { "low": N, "mid": N, "high": N, "factors": [...], "confidence": "low", "data_source": "market_knowledge", "sample_size": 0, "notes": "..." }`
  } };
}

export async function handle_analyze_rent(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: property } = await sb.from('properties').select('*, tenancies(rent_amount, rent_frequency, status)').eq('id', input.property_id as string).eq('owner_id', userId).single();
  if (!property) return { success: false, error: 'Property not found' };

  const { data: comps } = await sb.from('listings').select('rent_amount, properties!inner(suburb, bedrooms, property_type)').eq('status', 'active').eq('properties.suburb', (property as any).suburb).limit(10);

  return { success: true, data: { property, current_rent: input.current_rent || (property as any).rent_amount, comparables: comps || [], include_comparables: input.include_comparables || true, instruction: 'Analyse this rent vs comparable properties. Is it above/below/at market? Provide recommendation. Return JSON: { "current_rent": N, "market_median": N, "position": "above|below|at_market", "recommendation": "...", "comparables_summary": "..." }' } };
}

export async function handle_suggest_rent_price(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: property } = await sb.from('properties').select('*').eq('id', input.property_id as string).eq('owner_id', userId).single();
  if (!property) return { success: false, error: 'Property not found' };

  const { data: comps } = await sb.from('listings').select('rent_amount, rent_frequency, properties!inner(suburb, bedrooms, bathrooms, property_type)').eq('status', 'active').eq('properties.suburb', (property as any).suburb).limit(10);

  return { success: true, data: { property, comparables: comps || [], strategy: input.strategy || 'market_rate', instruction: 'Suggest an optimal weekly rent price based on property details and comparables. Strategy: ' + (input.strategy || 'market_rate') + '. Return JSON: { "suggested_rent": N, "range": { "low": N, "high": N }, "strategy_reasoning": "...", "comparables_used": N }' } };
}

export async function handle_generate_notice(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: tenancy } = await sb.from('tenancies').select('*, properties!inner(address_line_1, suburb, state, owner_id), tenancy_tenants(profiles:tenant_id(full_name))').eq('id', input.tenancy_id as string).eq('properties.owner_id', userId).single();
  if (!tenancy) return { success: false, error: 'Tenancy not found' };

  return { success: true, data: { tenancy, notice_type: input.notice_type, state: input.state, details: input.details || {}, instruction: `Generate a ${input.state} state-compliant ${input.notice_type} notice. Include: correct notice periods per ${input.state} residential tenancy legislation, required form references, all mandatory content. Return the full notice text formatted for print/PDF.` } };
}

export async function handle_generate_inspection_report(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: inspection } = await sb
    .from('inspections')
    .select('*, properties!inner(address_line_1, suburb, state, owner_id), inspection_rooms(*, inspection_items(*))')
    .eq('id', input.inspection_id as string).eq('properties.owner_id', userId).single();
  if (!inspection) return { success: false, error: 'Inspection not found' };

  const { data: images } = await sb.from('inspection_images').select('*').eq('inspection_id', input.inspection_id as string);

  return { success: true, data: { inspection, images: images || [], photos: input.photos || [], notes: input.notes || '', instruction: 'Generate a comprehensive inspection report. Include: overall condition summary, room-by-room breakdown, action items with priority, cost estimates for any remediation needed. Format as a professional property inspection report.' } };
}

export async function handle_compare_inspections(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const [entry, exit] = await Promise.all([
    sb.from('inspections').select('*, inspection_rooms(*, inspection_items(*)), properties!inner(owner_id)').eq('id', input.entry_inspection_id as string).eq('properties.owner_id', userId).single(),
    sb.from('inspections').select('*, inspection_rooms(*, inspection_items(*))').eq('id', input.exit_inspection_id as string).single(),
  ]);

  if (entry.error || exit.error) return { success: false, error: 'Inspection(s) not found' };

  return { success: true, data: { entry_inspection: entry.data, exit_inspection: exit.data, instruction: 'Compare entry and exit inspection conditions. For each room/item, identify changes, determine if tenant-caused or wear-and-tear, estimate remediation costs. Return JSON: { "total_issues": N, "tenant_responsible": N, "wear_and_tear": N, "estimated_cost": N, "bond_deduction_recommended": N, "issues": [...] }' } };
}

export async function handle_generate_financial_report(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let propFilter = '';
  if (input.property_id) propFilter = input.property_id as string;

  const { data: summary } = await sb.from('financial_summary').select('*').eq('owner_id', userId);
  const { data: expenses } = await sb.from('manual_expenses').select('amount, expense_date, description, is_tax_deductible, expense_categories(name)').eq('owner_id', userId).order('expense_date', { ascending: false }).limit(50);

  return { success: true, data: { financial_summary: summary || [], expenses: expenses || [], period: input.period, include_projections: input.include_projections || false, instruction: `Generate a ${input.period} financial report. Include: total income, expenses breakdown, net position, occupancy metrics, and ${input.include_projections ? 'projections for next period' : 'trend analysis'}. Format as a professional financial summary.` } };
}

export async function handle_generate_tax_report(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const fy = input.financial_year as string; // e.g. "2024-2025"
  const [startYear] = fy.split('-');
  const fyStart = `${startYear}-07-01`;
  const fyEnd = `${parseInt(startYear) + 1}-06-30`;

  const [income, expenses] = await Promise.all([
    sb.from('payments').select('amount, payment_type, paid_at, tenancies!inner(property_id, properties!inner(owner_id, address_line_1, suburb))').eq('tenancies.properties.owner_id', userId).eq('status', 'completed').gte('paid_at', fyStart).lte('paid_at', fyEnd),
    sb.from('manual_expenses').select('amount, expense_date, description, is_tax_deductible, tax_category, expense_categories(name)').eq('owner_id', userId).gte('expense_date', fyStart).lte('expense_date', fyEnd),
  ]);

  return { success: true, data: { income: income.data || [], expenses: expenses.data || [], financial_year: fy, include_depreciation: input.include_depreciation || false, instruction: `Generate a tax-ready summary for FY ${fy}. Categories: rental income, deductible expenses (by ATO category), non-deductible expenses. ${input.include_depreciation ? 'Include depreciation schedule estimates.' : ''} Format for Australian tax return preparation.` } };
}

export async function handle_generate_property_summary(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: metrics } = await sb.from('property_metrics').select('*').eq('property_id', input.property_id as string).eq('owner_id', userId).single();

  let history: any = null;
  if (input.include_history) {
    const [tenancies, maintenance, inspections] = await Promise.all([
      sb.from('tenancies').select('id, status, lease_start_date, lease_end_date, rent_amount').eq('property_id', input.property_id as string).order('lease_start_date', { ascending: false }).limit(5),
      sb.from('maintenance_requests').select('id, title, status, urgency, actual_cost, created_at').eq('property_id', input.property_id as string).order('created_at', { ascending: false }).limit(10),
      sb.from('inspections').select('id, inspection_type, status, actual_date, overall_condition').eq('property_id', input.property_id as string).order('scheduled_date', { ascending: false }).limit(5),
    ]);
    history = { tenancies: tenancies.data || [], maintenance: maintenance.data || [], inspections: inspections.data || [] };
  }

  return { success: true, data: { metrics, history, instruction: 'Generate a comprehensive property performance summary including: current status, financial performance, maintenance history, occupancy rate, and recommendations for improvement.' } };
}

export async function handle_generate_portfolio_report(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: metrics } = await sb.from('property_metrics').select('*').eq('owner_id', userId);
  const { data: summary } = await (sb.rpc as any)('get_portfolio_summary', { p_owner_id: userId });
  const { data: financials } = await (sb.rpc as any)('get_monthly_financials', { p_owner_id: userId, p_months: 12, p_property_id: null });

  return { success: true, data: { metrics: metrics || [], portfolio_summary: summary, monthly_financials: financials || [], period: input.period, include_forecasting: input.include_forecasting || false, instruction: `Generate a comprehensive portfolio analysis report for ${input.period}. Include: per-property yield calculations, vacancy analysis across portfolio, maintenance cost ratios, rent collection rates, ${input.include_forecasting ? 'forward projections and growth forecasting,' : ''} and portfolio-level recommendations. Format as a professional investment report.` } };
}

export async function handle_generate_cash_flow_forecast(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const months = (input.months as number) || 6;
  const { data: financials } = await (sb.rpc as any)('get_monthly_financials', { p_owner_id: userId, p_months: 12, p_property_id: input.property_id || null });
  const { data: summary } = await (sb.rpc as any)('get_portfolio_summary', { p_owner_id: userId });
  const { data: expenses } = await sb.from('manual_expenses').select('amount, expense_date, is_recurring, recurring_frequency').eq('owner_id', userId).eq('is_recurring', true);

  return { success: true, data: { historical_financials: financials || [], portfolio_summary: summary, recurring_expenses: expenses || [], projection_months: months, instruction: `Generate a ${months}-month cash flow forecast. Based on the historical financial data provided, project forward income and expenses. Include: monthly projected income/expenses/net, cumulative cash flow, assumptions used (occupancy rate, expense growth, pending rent increases), and risk factors with dollar impact and likelihood. Account for recurring expenses. Format as a structured financial projection.` } };
}

export async function handle_generate_lease(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: tenancy } = await sb.from('tenancies').select('*, properties!inner(address_line_1, suburb, state, postcode, bedrooms, bathrooms, property_type, owner_id, profiles:owner_id(full_name, email, phone)), tenancy_tenants(profiles:tenant_id(full_name, email, phone))').eq('id', input.tenancy_id as string).eq('properties.owner_id', userId).single();
  if (!tenancy) return { success: false, error: 'Tenancy not found' };

  return { success: true, data: { tenancy, state: input.state, lease_type: input.lease_type, term_months: input.term_months || 12, special_conditions: input.special_conditions || [], instruction: `Generate a ${input.state} state-compliant ${input.lease_type} residential tenancy agreement. Include all mandatory clauses per ${input.state} legislation. Term: ${input.term_months || 12} months. Include special conditions if provided. Format as a legal document ready for signing.` } };
}

export async function handle_assess_tenant_damage(input: ToolInput, _userId: string, _sb: SupabaseClient): Promise<ToolResult> {
  return { success: true, data: { description: input.description, photo_urls: input.photo_urls || [], property_age_years: input.property_age_years, tenancy_duration_months: input.tenancy_duration_months, last_inspection_notes: input.last_inspection_notes || '', instruction: 'Assess whether this damage is tenant-caused or fair wear and tear. Consider: property age, tenancy duration, nature of damage, and Australian tenancy law standards. Return JSON: { "assessment": "tenant_caused|wear_and_tear|unclear", "confidence": 0-1, "reasoning": "...", "estimated_cost": N, "recommendation": "..." }' } };
}

export async function handle_compare_quotes(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: quotes } = await sb
    .from('work_orders')
    .select('id, trade_id, quoted_amount, quoted_at, quote_notes, scheduled_date, trades(business_name, average_rating, total_reviews, total_jobs)')
    .in('id', input.quote_ids as string[])
    .eq('owner_id', userId);

  return { success: true, data: { quotes: quotes || [], priority_factors: input.priority_factors || { price_weight: 0.4, quality_weight: 0.4, speed_weight: 0.2 }, instruction: 'Compare these quotes and rank them. Consider: price, tradesperson rating/experience, availability/speed. Return JSON: [{ "quote_id": "...", "rank": 1, "score": N, "pros": [...], "cons": [...] }]' } };
}

// ═══════════════════════════════════════════════════════════════════════════
// BEYOND-PM INTELLIGENCE — Generate Tools
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_generate_wealth_report(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const period = input.period as string;
  const includeProjections = (input.include_projections as boolean) || false;

  const [snapshotsResult, healthResult, propertiesResult, satisfactionResult] = await Promise.all([
    sb.from('portfolio_snapshots').select('*').eq('owner_id', userId).order('snapshot_date', { ascending: false }).limit(12),
    sb.from('property_health_scores').select('*, properties!inner(address_line_1, suburb, state, rent_amount)').eq('owner_id', userId),
    sb.from('properties').select('id, address_line_1, suburb, state, rent_amount, status, year_built').eq('owner_id', userId).is('deleted_at', null),
    sb.from('tenant_satisfaction').select('*, tenancies!inner(rent_amount, property_id)').eq('owner_id', userId),
  ]);

  return {
    success: true,
    data: {
      snapshots: snapshotsResult.data || [],
      health_scores: healthResult.data || [],
      properties: propertiesResult.data || [],
      tenant_satisfaction: satisfactionResult.data || [],
      period,
      include_projections: includeProjections,
      instruction: `Generate a comprehensive portfolio wealth report for the ${period} period. Include:\n1. Executive summary with total portfolio value, yield, and growth\n2. Per-property performance breakdown with health scores\n3. Tenant stability analysis with retention risks\n4. Market positioning for each suburb\n5. Risk assessment and mitigation recommendations\n${includeProjections ? '6. 12-month forward projections for income, expenses, and growth\n' : ''}Format as a professional investment report. Use Australian English and AUD amounts.`,
    },
  };
}

export async function handle_generate_property_action_plan(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const propertyId = input.property_id as string;

  const [healthResult, maintenanceResult, complianceResult, tenancyResult] = await Promise.all([
    sb.from('property_health_scores').select('*').eq('property_id', propertyId).eq('owner_id', userId).single(),
    sb.from('maintenance_requests').select('title, category, urgency, status, actual_cost, created_at').eq('property_id', propertyId).order('created_at', { ascending: false }).limit(20),
    sb.from('property_compliance').select('*').eq('property_id', propertyId),
    sb.from('tenancies').select('*, tenant_satisfaction(*)').eq('property_id', propertyId).eq('status', 'active').limit(1),
  ]);

  const { data: property } = await sb.from('properties').select('*').eq('id', propertyId).eq('owner_id', userId).single();
  if (!property) return { success: false, error: 'Property not found' };

  return {
    success: true,
    data: {
      property,
      health_score: healthResult.data,
      maintenance_history: maintenanceResult.data || [],
      compliance: complianceResult.data || [],
      tenancy: tenancyResult.data?.[0] || null,
      instruction: `Generate a specific, actionable improvement plan for this property. Current health score: ${healthResult.data?.overall_score || 'unknown'}/100. For each risk factor identified, provide:\n1. The specific action to take\n2. Estimated cost and time\n3. Expected impact on the health score\n4. Priority (do now / next month / next quarter)\nOrder by impact-to-effort ratio. Format as an actionable checklist.`,
    },
  };
}

export async function handle_predict_vacancy_risk(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const propertyId = input.property_id as string;

  const [healthResult, satisfactionResult, marketResult, tenancyResult] = await Promise.all([
    sb.from('property_health_scores').select('predicted_vacancy_risk, overall_score').eq('property_id', propertyId).single(),
    sb.from('tenant_satisfaction').select('renewal_probability, satisfaction_score, risk_flags').eq('property_id', propertyId).limit(1),
    sb.from('properties').select('suburb, state, rent_amount, status').eq('id', propertyId).single(),
    sb.from('tenancies').select('lease_end_date, status, rent_amount').eq('property_id', propertyId).eq('status', 'active').limit(1),
  ]);

  let marketData = null;
  if (marketResult.data) {
    const { data } = await sb.from('market_intelligence').select('vacancy_rate, median_rent_weekly, demand_score').eq('suburb', marketResult.data.suburb).eq('state', marketResult.data.state).limit(1).maybeSingle();
    marketData = data;
  }

  return {
    success: true,
    data: {
      health: healthResult.data,
      satisfaction: satisfactionResult.data?.[0] || null,
      property: marketResult.data,
      tenancy: tenancyResult.data?.[0] || null,
      market: marketData,
      instruction: 'Analyse vacancy risk for this property. Consider: tenant satisfaction, lease timeline, market conditions, property health. Provide: 1) Risk level (low/medium/high/critical), 2) Probability of vacancy in next 6 months, 3) Estimated cost of vacancy (lost rent + re-letting costs), 4) Specific actions to reduce risk. Return as a structured assessment.',
    },
  };
}

export async function handle_calculate_roi_metrics(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const propertyId = input.property_id as string;
  const purchasePrice = (input.purchase_price as number) || null;

  const [propertyResult, tenancyResult, expensesResult, maintenanceResult] = await Promise.all([
    sb.from('properties').select('*, property_metrics(*)').eq('id', propertyId).eq('owner_id', userId).single(),
    sb.from('tenancies').select('rent_amount, rent_frequency, lease_start_date').eq('property_id', propertyId).eq('status', 'active').limit(1),
    sb.from('manual_expenses').select('amount, is_tax_deductible').eq('property_id', propertyId).gte('expense_date', new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]),
    sb.from('maintenance_requests').select('actual_cost').eq('property_id', propertyId).in('status', ['completed']).gte('created_at', new Date(Date.now() - 365 * 86400000).toISOString()),
  ]);

  if (!propertyResult.data) return { success: false, error: 'Property not found' };

  return {
    success: true,
    data: {
      property: propertyResult.data,
      tenancy: tenancyResult.data?.[0] || null,
      annual_expenses: expensesResult.data || [],
      maintenance_costs: maintenanceResult.data || [],
      purchase_price: purchasePrice,
      instruction: `Calculate detailed ROI metrics for this property. Include:\n1. Gross rental yield (annual rent / property value)\n2. Net rental yield (after expenses)\n3. Cash-on-cash return (if purchase price provided)\n4. Break-even occupancy rate\n5. Cost per square metre analysis\n6. Comparison to typical Australian property investment returns (4-6% gross yield)\n${purchasePrice ? '7. Capital growth estimate since purchase\n8. Total return (income + growth)\n' : ''}Return as a structured financial analysis with numbers and percentages.`,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTERNAL / INTEGRATION TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_web_search(input: ToolInput, _userId: string, _sb: SupabaseClient): Promise<ToolResult> {
  const query = input.query as string;
  const region = (input.region as string) || 'au-en';
  if (!query) return { success: false, error: 'Missing required field: query' };

  try {
    // DuckDuckGo Instant Answer API (free, no key needed)
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1&kl=${region}`;
    const ddgResponse = await fetch(ddgUrl, { headers: { 'User-Agent': 'CasaPropertyAgent/1.0' } });

    let instantAnswer: { abstract: string | null; answer: string | null; source: string; url: string | null; related: { text: string; url: string }[] } | null = null;
    if (ddgResponse.ok) {
      const ddgData = await ddgResponse.json();
      if (ddgData.AbstractText || ddgData.Answer) {
        instantAnswer = {
          abstract: ddgData.AbstractText || null,
          answer: ddgData.Answer || null,
          source: ddgData.AbstractSource || 'DuckDuckGo',
          url: ddgData.AbstractURL || null,
          related: (ddgData.RelatedTopics || []).slice(0, 5).map((t: any) => ({ text: t.Text || '', url: t.FirstURL || '' })),
        };
      }
    }

    // DuckDuckGo HTML scrape for organic results (free, no key needed)
    const htmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=${region}`;
    const htmlResponse = await fetch(htmlUrl, { headers: { 'User-Agent': 'CasaPropertyAgent/1.0' } });

    const searchResults: { title: string; snippet: string; url: string }[] = [];
    if (htmlResponse.ok) {
      const html = await htmlResponse.text();
      const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      let match;
      while ((match = resultPattern.exec(html)) !== null && searchResults.length < 8) {
        const rawUrl = match[1].replace(/.*uddg=/, '').split('&')[0];
        const title = match[2].replace(/<[^>]*>/g, '').trim();
        const snippet = match[3].replace(/<[^>]*>/g, '').trim();
        if (title && snippet) searchResults.push({ title, snippet, url: decodeURIComponent(rawUrl) });
      }
    }

    if (!instantAnswer && searchResults.length === 0) {
      return { success: true, data: { query, region, results: [], instruction: `Web search returned no results for "${query}". Use your training knowledge to provide the best available information.` } };
    }

    return { success: true, data: { query, region, instant_answer: instantAnswer, results: searchResults, result_count: searchResults.length, instruction: 'Analyze these search results and provide a comprehensive answer. Cite specific sources where relevant.' } };
  } catch (err: any) {
    return { success: true, data: { query, region, results: [], instruction: `Web search error (${err.message}). Use your training knowledge to answer "${query}".` } };
  }
}

export async function handle_find_local_trades(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const tradeType = (input.trade_type as string) || '';
  const suburb = (input.suburb as string) || '';
  const state = (input.state as string) || '';

  // 1. Check internal database first
  let dbQuery = sb.from('trades').select('id, business_name, contact_name, phone, email, categories, service_areas, average_rating, total_reviews, total_jobs, status').eq('status', 'active');
  if (tradeType) dbQuery = dbQuery.contains('categories', [tradeType]);
  if (input.property_id) {
    const { data: prop } = await sb.from('properties').select('suburb, postcode').eq('id', input.property_id as string).single();
    if (prop) dbQuery = dbQuery.contains('service_areas', [(prop as any).postcode || (prop as any).suburb]);
  } else if (suburb) {
    dbQuery = dbQuery.contains('service_areas', [suburb]);
  }
  const { data: localTrades } = await dbQuery.order('average_rating', { ascending: false }).limit((input.max_results as number) || 10);

  // 2. Search externally via DuckDuckGo for more options
  const externalResults: { title: string; snippet: string; url: string }[] = [];
  try {
    const searchQuery = `${tradeType} ${suburb} ${state} Australia reviews`;
    const htmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}&kl=au-en`;
    const htmlResponse = await fetch(htmlUrl, { headers: { 'User-Agent': 'CasaPropertyAgent/1.0' } });
    if (htmlResponse.ok) {
      const html = await htmlResponse.text();
      const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      let match;
      while ((match = resultPattern.exec(html)) !== null && externalResults.length < 5) {
        const rawUrl = match[1].replace(/.*uddg=/, '').split('&')[0];
        const title = match[2].replace(/<[^>]*>/g, '').trim();
        const snippet = match[3].replace(/<[^>]*>/g, '').trim();
        if (title && snippet) externalResults.push({ title, snippet, url: decodeURIComponent(rawUrl) });
      }
    }
  } catch { /* external search is best-effort */ }

  const hasInternal = localTrades && localTrades.length > 0;
  const hasExternal = externalResults.length > 0;

  return {
    success: true,
    data: {
      trades_in_network: localTrades || [],
      external_search_results: externalResults,
      trade_type: tradeType,
      suburb,
      urgency: input.urgency,
      instruction: hasInternal
        ? `Found ${localTrades!.length} trades in the owner's network. Present these first.${hasExternal ? ` External search also found ${externalResults.length} new options. For each external result, call create_service_provider with the business_name, trade_type="${tradeType}", and phone (extract from snippet if available) to add them to the network. If a result has a URL, call parse_business_details first to get full contact details before creating the service provider.` : ''}`
        : hasExternal
          ? `No trades in the owner's network yet. Found ${externalResults.length} external results. For each result, call create_service_provider to add them to the owner's network as service provider cards. Use business_name from the title, trade_type="${tradeType}", suburb="${suburb}", and extract phone numbers from snippets. If a result has a URL, call parse_business_details first for full details (ABN, email, license). Then present the added trades to the owner.`
          : `No ${tradeType} found locally or online for ${suburb}. Suggest broader search terms or ask the owner if they know anyone.`,
    },
  };
}

export async function handle_parse_business_details(input: ToolInput, _userId: string, _sb: SupabaseClient): Promise<ToolResult> {
  const url = input.url as string;
  if (!url) return { success: false, error: 'Missing required field: url' };

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'CasaPropertyAgent/1.0', 'Accept': 'text/html' },
      redirect: 'follow',
    });

    if (!response.ok) {
      return { success: true, data: { url, error: `HTTP ${response.status}`, instruction: `Could not fetch ${url} (${response.status}). Ask the user for the business details manually or try a web_search for the business name.` } };
    }

    const html = await response.text();
    // Extract useful text content (strip tags, limit size for Claude)
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8000); // Limit to ~8K chars for Claude to parse

    // Extract phone numbers (Australian format)
    const phones = html.match(/(?:(?:\+61|0)[2-578]\s?\d{4}\s?\d{4}|(?:13|1[38]00)\s?\d{3}\s?\d{3})/g) || [];
    // Extract emails
    const emails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    // Extract ABN (11 digits)
    const abns = html.match(/ABN[:\s]*(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})/gi) || [];
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';

    return {
      success: true,
      data: {
        url,
        page_title: pageTitle,
        extracted: {
          phones: [...new Set(phones)].slice(0, 3),
          emails: [...new Set(emails)].slice(0, 3),
          abns: [...new Set(abns)].slice(0, 1),
        },
        page_text: textContent,
        instruction: 'Extract business details from this scraped page content. Return the business_name, phone, email, ABN, services offered, address, and any ratings/reviews you can find. The extracted fields above are auto-detected — verify them against the full text.',
      },
    };
  } catch (err: any) {
    return { success: true, data: { url, instruction: `Could not scrape ${url} (${err.message}). Ask the user for the business details or try a web_search instead.` } };
  }
}

export async function handle_create_service_provider(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // Check if trade already exists by phone or ABN
  let existing: any = null;
  if (input.abn) {
    const { data } = await sb.from('trades').select('id').eq('abn', input.abn as string).single();
    existing = data;
  }
  if (!existing && input.phone) {
    const { data } = await sb.from('trades').select('id').eq('phone', input.phone as string).single();
    existing = data;
  }

  if (existing) {
    // Add to owner's network
    await sb.from('owner_trades').upsert({ owner_id: userId, trade_id: existing.id, notes: (input.notes as string) || null }, { onConflict: 'owner_id,trade_id' });
    return { success: true, data: { trade_id: existing.id, action: 'linked_existing', message: 'Tradesperson already exists, linked to your network' } };
  }

  const { data: trade, error } = await sb
    .from('trades')
    .insert({
      business_name: input.business_name as string,
      contact_name: (input.contact_name as string) || null,
      phone: input.phone as string,
      email: (input.email as string) || null,
      abn: (input.abn as string) || null,
      license_number: (input.license_number as string) || null,
      categories: input.trade_type ? [input.trade_type as string] : [],
      service_areas: input.suburb ? [input.suburb as string] : [],
      average_rating: (input.rating as number) || null,
      status: 'active',
    })
    .select('id, business_name, phone, status')
    .single();

  if (error) return { success: false, error: error.message };

  // Add to owner's network
  await sb.from('owner_trades').insert({ owner_id: userId, trade_id: (trade as any).id, notes: (input.notes as string) || null });

  return { success: true, data: { trade_id: (trade as any).id, action: 'created', ...trade } };
}

export async function handle_request_quote(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // Create a work order in 'sent' status which serves as the quote request
  const { data: wo, error } = await sb
    .from('work_orders')
    .insert({
      maintenance_request_id: (input.maintenance_request_id as string) || null,
      property_id: input.property_id as string,
      owner_id: userId,
      trade_id: (input.provider_id as string) || null,
      description: input.description as string,
      urgency: (input.urgency as string) || 'routine',
      access_instructions: (input.access_instructions as string) || null,
      quote_required: true,
      status: 'sent',
    })
    .select('id, description, status')
    .single();

  if (error) return { success: false, error: error.message };

  // Send quote request email to trade with CC to owner
  let emailSent = false;
  if (input.provider_id) {
    const { data: trade } = await sb.from('trades').select('email, business_name').eq('id', input.provider_id as string).single();
    if (trade && (trade as any).email) {
      // Get owner details and property address for the email
      const { data: ownerProfile } = await sb.from('profiles').select('email, full_name').eq('id', userId).single();
      const { data: property } = await sb.from('properties').select('address_line_1, suburb, state, postcode').eq('id', input.property_id as string).single();
      const propertyAddress = property ? `${(property as any).address_line_1}, ${(property as any).suburb} ${(property as any).state} ${(property as any).postcode || ''}`.trim() : '';

      // Render the quote_request email template
      const { getEmailHtml } = await import('./notification-templates.ts');
      const { subject: emailSubject, htmlContent } = getEmailHtml('quote_request', {
        trade_name: (trade as any).business_name,
        owner_name: ownerProfile?.full_name || 'the property owner',
        property_address: propertyAddress,
        issue_title: input.description as string,
        description: input.description as string,
        urgency: (input.urgency as string) || 'routine',
        access_instructions: (input.access_instructions as string) || '',
        scope: (input.scope as string) || '',
      });

      // Build CC list — always CC the owner so they see the correspondence
      const ccList: string[] = [];
      if (ownerProfile?.email) ccList.push(ownerProfile.email);

      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        const fromEmail = Deno.env.get('EMAIL_FROM') || 'noreply@casaintelligence.com.au';
        const fromName = Deno.env.get('EMAIL_FROM_NAME') || 'Casa';
        const emailPayload: Record<string, unknown> = {
          from: `${fromName} <${fromEmail}>`,
          to: [(trade as any).email],
          subject: emailSubject,
          html: htmlContent,
          text: htmlContent.replace(/<[^>]*>/g, ''),
        };
        if (ccList.length > 0) emailPayload.cc = ccList;
        if (ownerProfile?.email) emailPayload.reply_to = ownerProfile.email;

        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(emailPayload),
          });
          emailSent = true;
        } catch { /* email is best-effort */ }
      }

      // Log the email as a maintenance comment for audit trail
      if (input.maintenance_request_id) {
        await sb.from('maintenance_comments').insert({
          request_id: input.maintenance_request_id as string,
          author_id: userId,
          content: `📧 Quote request sent to ${(trade as any).business_name} (${(trade as any).email})${ccList.length > 0 ? ` — CC: ${ccList.join(', ')}` : ''}`,
          is_internal: true,
          metadata: {
            type: 'email_sent',
            email_type: 'quote_request',
            to: (trade as any).email,
            cc: ccList,
            subject: emailSubject,
            html_content: htmlContent,
          },
        });
      }
    }
  }

  return { success: true, data: { work_order_id: (wo as any).id, status: 'quote_requested', email_sent: emailSent } };
}

export async function handle_get_market_data(input: ToolInput, _userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // Pull comparable listings from our own database
  let query = sb.from('listings').select('rent_amount, rent_frequency, status, created_at, properties!inner(suburb, state, bedrooms, bathrooms, property_type)').eq('properties.suburb', input.suburb as string).eq('properties.state', input.state as string);
  if (input.property_type) query = query.eq('properties.property_type', input.property_type as string);
  if (input.bedrooms) query = query.eq('properties.bedrooms', input.bedrooms as number);

  const { data: listings } = await query.order('created_at', { ascending: false }).limit(20);

  const rents = (listings || []).filter((l: any) => l.rent_amount).map((l: any) => l.rent_amount);
  const median = rents.length > 0 ? rents.sort((a: number, b: number) => a - b)[Math.floor(rents.length / 2)] : null;

  return { success: true, data: { suburb: input.suburb, state: input.state, property_type: input.property_type || 'all', bedrooms: input.bedrooms, listings_found: rents.length, median_rent: median, rent_range: rents.length > 0 ? { low: Math.min(...rents), high: Math.max(...rents) } : null, instruction: `Market data for ${input.suburb}, ${input.state}. ${rents.length} comparable listings found. In production, this will also pull data from Domain/REA APIs for comprehensive market analysis.` } };
}

export async function handle_check_maintenance_threshold(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: settings } = await sb.from('agent_autonomy_settings').select('category_overrides').eq('user_id', userId).single();
  const threshold = (settings?.category_overrides as any)?.maintenance_auto_approve_threshold || 500;
  const cost = input.estimated_cost as number;
  return { success: true, data: { estimated_cost: cost, threshold, within_threshold: cost <= threshold, requires_approval: cost > threshold } };
}

// check_regulatory_requirements handler is now in tool-handlers.ts (queries tenancy_law_rules table)

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW TOOLS — orchestrate multi-step processes
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_workflow_find_tenant(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: property } = await sb.from('properties').select('id, address_line_1, suburb, state, bedrooms, bathrooms, rent_amount').eq('id', input.property_id as string).eq('owner_id', userId).single();
  if (!property) return { success: false, error: 'Property not found' };

  // Check for existing listing
  const { data: existingListing } = await sb.from('listings').select('id, status').eq('property_id', input.property_id as string).in('status', ['draft', 'active']).limit(1).maybeSingle();

  return { success: true, data: { property, existing_listing: existingListing, preferences: input.preferences || {}, instruction: 'Execute the find-tenant workflow. Steps: 1) Create/update listing if needed (use create_listing), 2) Generate compelling listing copy (use generate_listing), 3) Publish the listing (use publish_listing), 4) As applications come in, score and rank them. Report back at each step and ask for approval before proceeding to the next.' } };
}

export async function handle_workflow_onboard_tenant(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: app } = await sb.from('applications').select('*, listings!inner(owner_id, property_id, properties(address_line_1, suburb, state))').eq('id', input.application_id as string).eq('listings.owner_id', userId).single();
  if (!app) return { success: false, error: 'Application not found' };

  return { success: true, data: { application: app, move_in_date: input.move_in_date, instruction: 'Execute the tenant onboarding workflow. Steps: 1) Create tenancy (use create_tenancy), 2) Generate lease (use generate_lease), 3) Lodge bond (use lodge_bond), 4) Schedule entry inspection (use schedule_inspection), 5) Invite tenant to app (use invite_tenant). Report progress at each step.' } };
}

export async function handle_workflow_end_tenancy(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: tenancy } = await sb.from('tenancies').select('*, properties!inner(address_line_1, suburb, state, owner_id)').eq('id', input.tenancy_id as string).eq('properties.owner_id', userId).single();
  if (!tenancy) return { success: false, error: 'Tenancy not found' };

  return { success: true, data: { tenancy, relist: input.relist || false, instruction: 'Execute the end-tenancy workflow. Steps: 1) Schedule exit inspection (use schedule_inspection with type=exit), 2) After inspection, compare with entry inspection (use compare_inspections), 3) Process bond claim/return based on inspection results, 4) Terminate the lease (use terminate_lease), 5) If relist=true, start find-tenant workflow for the property. Report at each step.' } };
}

export async function handle_workflow_maintenance_lifecycle(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: req } = await sb.from('maintenance_requests').select('*, properties!inner(address_line_1, suburb, state, postcode, owner_id)').eq('id', input.request_id as string).eq('properties.owner_id', userId).single();
  if (!req) return { success: false, error: 'Request not found' };

  return { success: true, data: { request: req, auto_approve_threshold: input.auto_approve_threshold || 500, instruction: 'Execute the maintenance lifecycle. Steps: 1) Triage the request (use triage_maintenance), 2) Find suitable trades (use find_local_trades), 3) Create service providers if new (use create_service_provider), 4) Request quotes from top trades — email goes to trade with owner CC\'d (use request_quote), 5) Record quote responses as they come in (use record_quote_response), 6) Compare quotes when received (use compare_quotes), 7) If within auto-approve threshold, approve best quote (use approve_quote), otherwise present options to owner, 8) Generate work order document and email to trade with owner CC\'d (use generate_work_order), 9) CC tenant on scheduling emails so they can coordinate access (use send_email_sendgrid with cc/bcc), 10) Track work order through completion (use update_work_order_status). All emails are logged in the maintenance audit trail. Report at each step.' } };
}

export async function handle_workflow_arrears_escalation(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: tenancy } = await sb.from('tenancies').select('*, properties!inner(address_line_1, suburb, state, owner_id), tenancy_tenants(profiles:tenant_id(full_name, email))').eq('id', input.tenancy_id as string).eq('properties.owner_id', userId).single();
  if (!tenancy) return { success: false, error: 'Tenancy not found' };

  const { data: arrears } = await sb.from('arrears_records').select('*, arrears_actions(*)').eq('tenancy_id', input.tenancy_id as string).eq('is_resolved', false).maybeSingle();

  return { success: true, data: { tenancy, arrears, current_days_overdue: input.current_days_overdue, instruction: 'Execute the arrears escalation workflow based on days overdue. Ladder: 1-3 days: friendly reminder (use send_rent_reminder), 7 days: formal notice, 14 days: breach notice (use send_breach_notice), 21+ days: offer payment plan (use create_payment_plan), 28+ days: tribunal preparation. Check what actions have already been taken and proceed to the next appropriate step. Always log actions (use log_arrears_action).' } };
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_remember(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const [category, ...keyParts] = (input.key as string).split('.');
  const prefKey = keyParts.join('.') || input.key as string;

  // Generate semantic embedding for this preference
  let embedding: number[] | null = null;
  try {
    const embeddingText = buildPreferenceEmbeddingText(category, prefKey, input.value);
    embedding = await generateEmbedding(embeddingText);
  } catch {
    // Don't block on embedding failure
  }

  const { data, error } = await sb
    .from('agent_preferences')
    .upsert({
      user_id: userId,
      property_id: (input.property_id as string) || null,
      category: category,
      preference_key: prefKey,
      preference_value: { value: input.value },
      source: 'inferred',
      confidence: (input.confidence as number) || 0.8,
      updated_at: new Date().toISOString(),
      ...(embedding ? { embedding: formatEmbeddingForStorage(embedding) } : {}),
    }, { onConflict: 'user_id,property_id,category,preference_key' })
    .select('id, category, preference_key, preference_value')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: { remembered: true, key: input.key, ...data } };
}

export async function handle_recall(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // If context is provided, use semantic search for relevance-ranked results
  if (input.context && typeof input.context === 'string') {
    try {
      const contextEmbedding = await generateEmbedding(input.context as string);
      const { data: semanticResults, error: rpcError } = await sb.rpc('search_similar_preferences', {
        query_embedding: formatEmbeddingForStorage(contextEmbedding),
        match_user_id: userId,
        match_threshold: 0.4,
        match_count: 20,
      });

      if (!rpcError && semanticResults && semanticResults.length > 0) {
        // If category filter also provided, apply it
        let filtered = semanticResults;
        if (input.category) {
          filtered = semanticResults.filter((p: any) => p.category === input.category);
        }
        return { success: true, data: { context: input.context, preferences: filtered, search_type: 'semantic' } };
      }
    } catch {
      // Fall through to category-based search on semantic failure
    }
  }

  // Fallback: category-based filtering (original behavior)
  let query = sb
    .from('agent_preferences')
    .select('category, preference_key, preference_value, source, confidence, updated_at')
    .eq('user_id', userId)
    .order('confidence', { ascending: false });

  if (input.category) query = query.eq('category', input.category as string);
  if (input.property_id) query = query.eq('property_id', input.property_id as string);

  const { data, error } = await query.limit(20);
  if (error) return { success: false, error: error.message };
  return { success: true, data: { context: input.context, preferences: data || [], search_type: 'category' } };
}

export async function handle_search_precedent(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const limit = (input.limit as number) || 10;

  // If a query string is provided, use semantic vector search
  if (input.query && typeof input.query === 'string') {
    try {
      const queryEmbedding = await generateEmbedding(input.query as string);
      const { data: semanticResults, error: rpcError } = await sb.rpc('search_similar_decisions', {
        query_embedding: formatEmbeddingForStorage(queryEmbedding),
        match_user_id: userId,
        match_threshold: 0.4,
        match_count: limit,
      });

      if (!rpcError && semanticResults && semanticResults.length > 0) {
        // If tool_name filter also provided, apply it
        let filtered = semanticResults;
        if (input.tool_name) {
          filtered = semanticResults.filter((p: any) => p.tool_name === input.tool_name);
        }
        return { success: true, data: { query: input.query, precedents: filtered, search_type: 'semantic' } };
      }
    } catch {
      // Fall through to recency-based search on semantic failure
    }
  }

  // Fallback: recency-based search (original behavior)
  let query = sb
    .from('agent_decisions')
    .select('id, decision_type, tool_name, input_data, output_data, reasoning, confidence, owner_feedback, created_at')
    .eq('user_id', userId)
    .eq('was_auto_executed', true)
    .order('created_at', { ascending: false });

  if (input.tool_name) query = query.eq('tool_name', input.tool_name as string);

  const { data, error } = await query.limit(limit);
  if (error) return { success: false, error: error.message };
  return { success: true, data: { query: input.query, precedents: data || [], search_type: 'recency' } };
}

// ═══════════════════════════════════════════════════════════════════════════
// PLANNING TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_plan_task(input: ToolInput, _userId: string, _sb: SupabaseClient): Promise<ToolResult> {
  return { success: true, data: { request: input.request, context: input.context || {}, instruction: 'Break this request into ordered steps. For each step, specify: the tool to use, the inputs needed, and any dependencies on previous steps. Return JSON: { "steps": [{ "step": 1, "tool": "...", "description": "...", "inputs": {...}, "depends_on": [] }] }' } };
}

export async function handle_get_owner_rules(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await sb
    .from('agent_preferences')
    .select('category, preference_key, preference_value, source, confidence')
    .eq('user_id', userId)
    .eq('category', 'rule')
    .order('confidence', { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: { rules: data || [] } };
}

export async function handle_check_plan(input: ToolInput, _userId: string, _sb: SupabaseClient): Promise<ToolResult> {
  const steps = (input.steps as any[]) || [];
  const completed = steps.filter((s: any) => s.status === 'completed');
  const pending = steps.filter((s: any) => s.status !== 'completed');
  return {
    success: true,
    data: {
      total_steps: steps.length,
      completed: completed.length,
      pending: pending.length,
      next_step: pending[0] || null,
      progress_pct: steps.length > 0 ? Math.round((completed.length / steps.length) * 100) : 0,
    },
  };
}

export async function handle_replan(input: ToolInput, _userId: string, _sb: SupabaseClient): Promise<ToolResult> {
  return {
    success: true,
    data: {
      original_plan: input.original_plan,
      reason: input.reason,
      context: input.context || {},
      instruction: 'The original plan needs revision. Review what has been completed, what failed, and why. Create a new plan that accounts for the failure and finds an alternative path to the goal.',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TOOL STUBS
// These require external API keys/accounts. They return structured errors
// directing the user to configure the integration.
// ═══════════════════════════════════════════════════════════════════════════

// User-friendly fallback messages for each stub (in case a stub is called despite
// being filtered from Claude's tool list via isStub in TOOL_META).
const STUB_MESSAGES: Record<string, string> = {
  syndicate_listing_domain: 'Listing syndication to Domain.com.au is coming soon. For now, you can create your listing in Casa and manually post it to Domain.',
  syndicate_listing_rea: 'Listing syndication to realestate.com.au is coming soon. For now, you can create your listing in Casa and manually post it to REA.',
  run_credit_check: 'Automated credit checks via Equifax are coming soon. For now, you can request credit reports directly from equifax.com.au.',
  run_tica_check: 'Automated TICA tenancy checks are coming soon. For now, you can check tenant history directly at tica.com.au.',
  collect_rent_stripe: 'Automated rent collection is coming soon. Tenants can currently make payments through the tenant app.',
  refund_payment_stripe: 'Automated refunds are coming soon. For now, refunds need to be processed manually through your bank.',
  send_docusign_envelope: 'DocuSign integration is coming soon. You can still collect signatures using the in-app signature feature on any document.',
  lodge_bond_state: 'Automated bond lodgement with your state authority is coming soon. You can lodge bonds manually through your state fair trading website.',
  send_sms_twilio: 'SMS notifications are coming soon. You can still reach tenants via in-app messages, email, and push notifications.',
  search_trades_hipages: 'hipages integration is coming soon. I can still search the web to find local tradespeople for you.',
};

function integrationStub(toolName: string): (input: ToolInput, userId: string, sb: SupabaseClient) => Promise<ToolResult> {
  return async (_input, _userId, _sb) => ({
    success: false,
    error: STUB_MESSAGES[toolName] || 'This feature is coming soon.',
  });
}

export const handle_syndicate_listing_domain = integrationStub('syndicate_listing_domain');
export const handle_syndicate_listing_rea = integrationStub('syndicate_listing_rea');
export const handle_run_credit_check = integrationStub('run_credit_check');
export const handle_run_tica_check = integrationStub('run_tica_check');
export const handle_collect_rent_stripe = integrationStub('collect_rent_stripe');
export const handle_refund_payment_stripe = integrationStub('refund_payment_stripe');
export const handle_send_docusign_envelope = integrationStub('send_docusign_envelope');
export const handle_lodge_bond_state = integrationStub('lodge_bond_state');
export const handle_send_sms_twilio = integrationStub('send_sms_twilio');
export const handle_search_trades_hipages = integrationStub('search_trades_hipages');

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENT LIFECYCLE TOOLS — create, submit, and manage documents
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_create_document(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const title = input.title as string;
  const documentType = input.document_type as string;
  const htmlContent = input.html_content as string;
  const propertyId = (input.property_id as string) || null;
  const tenancyId = (input.tenancy_id as string) || null;
  const tenantId = (input.tenant_id as string) || null;
  const requiresSignature = (input.requires_signature as boolean) || false;

  if (!title || !documentType || !htmlContent) {
    return { success: false, error: 'Missing required fields: title, document_type, html_content' };
  }

  const validTypes = ['lease', 'notice', 'financial_report', 'tax_report', 'compliance_certificate', 'inspection_report', 'property_summary', 'portfolio_report', 'cash_flow_forecast', 'other'];
  if (!validTypes.includes(documentType)) {
    return { success: false, error: `Invalid document_type. Must be one of: ${validTypes.join(', ')}` };
  }

  const status = requiresSignature ? 'pending_owner_signature' : 'draft';

  const folderId = (input.folder_id as string) || null;
  const tags = (input.tags as string[]) || null;
  const expiryDate = (input.expiry_date as string) || null;

  const { data: doc, error } = await sb
    .from('documents')
    .insert({
      owner_id: userId,
      property_id: propertyId,
      tenancy_id: tenancyId,
      tenant_id: tenantId,
      document_type: documentType,
      title,
      html_content: htmlContent,
      status,
      requires_signature: requiresSignature,
      folder_id: folderId,
      tags,
      expiry_date: expiryDate,
    })
    .select('id, title, document_type, status, requires_signature, created_at')
    .single();

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: {
      document_id: doc.id,
      title: doc.title,
      document_type: doc.document_type,
      status: doc.status,
      requires_signature: doc.requires_signature,
      created_at: doc.created_at,
      view_route: `/(app)/documents/${doc.id}`,
    },
  };
}

export async function handle_submit_document_email(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const documentId = input.document_id as string;
  const toEmail = input.to_email as string;
  const toName = (input.to_name as string) || '';
  const subject = (input.subject as string) || '';
  const bodyMessage = (input.body_message as string) || '';

  if (!documentId || !toEmail) {
    return { success: false, error: 'Missing required fields: document_id, to_email' };
  }

  // Fetch document and verify ownership
  const { data: doc, error: docError } = await sb
    .from('documents')
    .select('id, title, html_content, document_type, owner_id')
    .eq('id', documentId)
    .eq('owner_id', userId)
    .single();

  if (docError || !doc) return { success: false, error: 'Document not found or access denied' };

  // Get owner profile for sender name
  const { data: profile } = await sb
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();

  const ownerName = profile?.full_name || 'Casa Property Management';
  const emailSubject = subject || `Document: ${doc.title}`;

  // Wrap the document HTML in an email template
  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0A0A0A; max-width: 680px; margin: 0 auto; padding: 20px;">
  <div style="background: #F5F2EB; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #0A0A0A;">${doc.title}</h2>
    <p style="margin: 0; color: #525252; font-size: 14px;">Sent by ${ownerName} via Casa</p>
  </div>
  ${bodyMessage ? `<div style="padding: 16px 0; color: #525252; font-size: 15px; line-height: 1.6; border-bottom: 1px solid #E5E5E5; margin-bottom: 20px;">${bodyMessage}</div>` : ''}
  <div style="border: 1px solid #E5E5E5; border-radius: 8px; padding: 24px; background: #fff;">
    ${doc.html_content}
  </div>
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E5E5E5; text-align: center;">
    <p style="margin: 0; color: #A3A3A3; font-size: 12px;">Sent via Casa — Smart Property Management</p>
  </div>
</body>
</html>`;

  // Send via Resend
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return { success: false, error: 'RESEND_API_KEY not configured. Cannot send email.' };
  }

  const fromEmail = Deno.env.get('EMAIL_FROM') || 'noreply@casaintelligence.com.au';
  const fromName = Deno.env.get('EMAIL_FROM_NAME') || 'Casa';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [toEmail],
        reply_to: `${ownerName} <${fromEmail}>`,
        subject: emailSubject,
        html: emailHtml,
        text: `${doc.title}\n\n${bodyMessage}\n\nSent via Casa Property Management`,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return { success: false, error: `Resend error ${response.status}: ${errBody}` };
    }

    // Update document status to indicate it's been submitted
    await sb
      .from('documents')
      .update({ status: doc.document_type === 'notice' ? 'submitted' : 'draft' })
      .eq('id', documentId);

    return {
      success: true,
      data: {
        sent: true,
        document_id: documentId,
        to_email: toEmail,
        subject: emailSubject,
      },
    };
  } catch (err: any) {
    return { success: false, error: `Email send failed: ${err.message}` };
  }
}

export async function handle_request_document_signature(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const documentId = input.document_id as string;
  const signerType = (input.signer_type as string) || 'owner';
  const message = (input.message as string) || '';

  if (!documentId) return { success: false, error: 'Missing required field: document_id' };

  // Fetch and verify document
  const { data: doc, error: docError } = await sb
    .from('documents')
    .select('id, title, owner_id, tenant_id, property_id, status, requires_signature')
    .eq('id', documentId)
    .eq('owner_id', userId)
    .single();

  if (docError || !doc) return { success: false, error: 'Document not found or access denied' };

  // Update document status and ensure requires_signature is true
  const newStatus = signerType === 'tenant' ? 'pending_tenant_signature' : 'pending_owner_signature';
  await sb
    .from('documents')
    .update({ status: newStatus, requires_signature: true })
    .eq('id', documentId);

  // Create a pending action so it appears in the activity/tasks page
  const targetUserId = signerType === 'tenant' && doc.tenant_id ? doc.tenant_id : userId;
  const { data: pendingAction, error: paError } = await sb
    .from('agent_pending_actions')
    .insert({
      user_id: targetUserId,
      action_type: 'document_signature',
      title: `Sign: ${doc.title}`,
      description: message || `Please review and sign "${doc.title}".`,
      tool_name: 'request_document_signature',
      tool_params: { document_id: documentId, signer_type: signerType },
      status: 'pending',
      recommendation: `View and sign this document`,
    })
    .select('id')
    .single();

  if (paError) return { success: false, error: paError.message };

  // Notify the signer via push notification if available
  try {
    const { data: tokenRow } = await sb
      .from('push_tokens')
      .select('token')
      .eq('user_id', targetUserId)
      .eq('is_active', true)
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (tokenRow?.token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: tokenRow.token,
          title: 'Document Signature Required',
          body: `Please sign: ${doc.title}`,
          data: { route: `/(app)/documents/${documentId}` },
          sound: 'default',
        }),
      });
    }
  } catch { /* push is best-effort */ }

  return {
    success: true,
    data: {
      document_id: documentId,
      pending_action_id: pendingAction?.id,
      signer_type: signerType,
      status: newStatus,
      view_route: `/(app)/documents/${documentId}`,
    },
  };
}

export async function handle_update_document_status(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const documentId = input.document_id as string;
  const status = input.status as string;

  if (!documentId || !status) return { success: false, error: 'Missing required fields: document_id, status' };

  const validStatuses = ['draft', 'pending_owner_signature', 'pending_tenant_signature', 'signed', 'submitted', 'archived'];
  if (!validStatuses.includes(status)) {
    return { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };
  }

  const { data: doc, error } = await sb
    .from('documents')
    .update({ status })
    .eq('id', documentId)
    .eq('owner_id', userId)
    .select('id, title, status')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: doc };
}

// ── WORK ORDER DOCUMENT GENERATION ────────────────────────────────────────
export async function handle_generate_work_order(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const workOrderId = input.work_order_id as string;
  const sendToTrade = input.send_to_trade !== false; // default true

  if (!workOrderId) return { success: false, error: 'Missing required field: work_order_id' };

  // Fetch work order with related data
  const { data: wo, error: woErr } = await sb
    .from('work_orders')
    .select('*, trades(business_name, email, phone, contact_name), properties(address_line_1, suburb, state, postcode), maintenance_requests(title, description, category, urgency)')
    .eq('id', workOrderId)
    .eq('owner_id', userId)
    .single();

  if (woErr || !wo) return { success: false, error: 'Work order not found or access denied' };

  const trade = (wo as any).trades || {};
  const property = (wo as any).properties || {};
  const mainReq = (wo as any).maintenance_requests || {};
  const propertyAddress = `${property.address_line_1 || ''}, ${property.suburb || ''} ${property.state || ''} ${property.postcode || ''}`.trim().replace(/^,\s*/, '');
  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const woNumber = `WO-${workOrderId.substring(0, 8).toUpperCase()}`;

  // Get owner details
  const { data: ownerProfile } = await sb.from('profiles').select('full_name, email, phone').eq('id', userId).single();
  const ownerName = ownerProfile?.full_name || 'Property Owner';
  const ownerEmail = ownerProfile?.email || '';

  // Generate professional HTML work order
  const htmlContent = `
<div style="font-family:'Inter',-apple-system,sans-serif;max-width:800px;margin:0 auto;color:#1B2B4B;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;">
    <div>
      <h1 style="margin:0 0 4px 0;font-size:28px;color:#1B1464;">Work Order</h1>
      <p style="margin:0;color:#6B7280;font-size:14px;">${woNumber} — ${today}</p>
    </div>
    <div style="text-align:right;">
      <p style="margin:0;font-size:16px;font-weight:600;color:#1B1464;">Casa</p>
      <p style="margin:0;color:#6B7280;font-size:13px;">Property Management</p>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="width:50%;vertical-align:top;padding-right:16px;">
        <div style="background:#F9FAFB;border-radius:8px;padding:16px;">
          <p style="margin:0 0 4px 0;font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Property</p>
          <p style="margin:0;font-size:15px;font-weight:600;">${propertyAddress}</p>
        </div>
      </td>
      <td style="width:50%;vertical-align:top;padding-left:16px;">
        <div style="background:#F9FAFB;border-radius:8px;padding:16px;">
          <p style="margin:0 0 4px 0;font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Tradesperson</p>
          <p style="margin:0;font-size:15px;font-weight:600;">${trade.business_name || 'TBC'}</p>
          ${trade.contact_name ? `<p style="margin:4px 0 0 0;font-size:13px;color:#6B7280;">Contact: ${trade.contact_name}</p>` : ''}
          ${trade.phone ? `<p style="margin:2px 0 0 0;font-size:13px;color:#6B7280;">Phone: ${trade.phone}</p>` : ''}
          ${trade.email ? `<p style="margin:2px 0 0 0;font-size:13px;color:#6B7280;">Email: ${trade.email}</p>` : ''}
        </div>
      </td>
    </tr>
  </table>

  <div style="background:#F9FAFB;border-radius:8px;padding:20px;margin-bottom:24px;">
    <p style="margin:0 0 12px 0;font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Scope of Work</p>
    <p style="margin:0;font-size:15px;line-height:1.6;font-weight:600;">${mainReq.title || (wo as any).title || 'Maintenance Work'}</p>
    <p style="margin:8px 0 0 0;font-size:14px;line-height:1.6;">${(wo as any).description || mainReq.description || ''}</p>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="width:33%;padding:8px 8px 8px 0;">
        <div style="background:#F9FAFB;border-radius:8px;padding:16px;text-align:center;">
          <p style="margin:0 0 4px 0;font-size:12px;color:#6B7280;text-transform:uppercase;">Category</p>
          <p style="margin:0;font-size:15px;font-weight:600;">${mainReq.category || (wo as any).category || 'General'}</p>
        </div>
      </td>
      <td style="width:33%;padding:8px;">
        <div style="background:#F9FAFB;border-radius:8px;padding:16px;text-align:center;">
          <p style="margin:0 0 4px 0;font-size:12px;color:#6B7280;text-transform:uppercase;">Urgency</p>
          <p style="margin:0;font-size:15px;font-weight:600;">${((wo as any).urgency || mainReq.urgency || 'routine').charAt(0).toUpperCase() + ((wo as any).urgency || mainReq.urgency || 'routine').slice(1)}</p>
        </div>
      </td>
      <td style="width:33%;padding:8px 0 8px 8px;">
        <div style="background:#F9FAFB;border-radius:8px;padding:16px;text-align:center;">
          <p style="margin:0 0 4px 0;font-size:12px;color:#6B7280;text-transform:uppercase;">Budget</p>
          <p style="margin:0;font-size:15px;font-weight:600;color:#16A34A;">${(wo as any).budget_max ? `$${Number((wo as any).budget_max).toFixed(2)}` : 'TBC'}</p>
        </div>
      </td>
    </tr>
  </table>

  ${(wo as any).scheduled_date ? `
  <div style="background:#F9FAFB;border-radius:8px;padding:16px;margin-bottom:24px;">
    <p style="margin:0 0 4px 0;font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Scheduled Date</p>
    <p style="margin:0;font-size:15px;font-weight:600;">${new Date((wo as any).scheduled_date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
  </div>
  ` : ''}

  ${(wo as any).access_instructions ? `
  <div style="background:#FEF3C7;border-radius:8px;padding:16px;margin-bottom:24px;">
    <p style="margin:0 0 4px 0;font-size:12px;color:#92400E;text-transform:uppercase;letter-spacing:1px;">Access Instructions</p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#92400E;">${(wo as any).access_instructions}</p>
  </div>
  ` : ''}

  <div style="border-top:1px solid #E5E7EB;padding-top:16px;margin-top:24px;">
    <p style="margin:0 0 4px 0;font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Authorised By</p>
    <p style="margin:0;font-size:14px;font-weight:600;">${ownerName}</p>
    <p style="margin:2px 0 0 0;font-size:13px;color:#6B7280;">${ownerEmail}</p>
    <p style="margin:8px 0 0 0;font-size:12px;color:#6B7280;">Generated by Casa Property Management</p>
  </div>
</div>`;

  // Save as a document in the documents table
  const { data: doc, error: docErr } = await sb
    .from('documents')
    .insert({
      owner_id: userId,
      property_id: (wo as any).property_id,
      document_type: 'other',
      title: `Work Order ${woNumber} — ${mainReq.title || (wo as any).title || 'Maintenance'}`,
      html_content: htmlContent,
      status: 'draft',
      requires_signature: false,
      tags: ['work_order', 'maintenance'],
    })
    .select('id, title, status, created_at')
    .single();

  if (docErr) return { success: false, error: `Failed to save work order document: ${docErr.message}` };

  // Email to trade if requested and trade has email
  let emailSent = false;
  if (sendToTrade && trade.email) {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      const fromEmail = Deno.env.get('EMAIL_FROM') || 'noreply@casaintelligence.com.au';
      const fromName = Deno.env.get('EMAIL_FROM_NAME') || 'Casa';

      const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body style="margin:0;padding:32px;background:#EAEDF1;">
<div style="max-width:800px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
  ${htmlContent}
</div>
<div style="max-width:800px;margin:16px auto 0;text-align:center;">
  <p style="color:#9CA3AF;font-size:12px;">Sent via Casa — Smart Property Management</p>
</div>
</body></html>`;

      const emailPayload: Record<string, unknown> = {
        from: `${fromName} <${fromEmail}>`,
        to: [trade.email],
        subject: `Work Order ${woNumber}: ${mainReq.title || (wo as any).title || 'Maintenance Work'}`,
        html: emailHtml,
        text: `Work Order ${woNumber}\n\nProperty: ${propertyAddress}\nScope: ${(wo as any).description || mainReq.description || ''}\nBudget: ${(wo as any).budget_max ? `$${(wo as any).budget_max}` : 'TBC'}\n\nAuthorised by ${ownerName}`,
      };
      // CC the owner
      if (ownerEmail) {
        emailPayload.cc = [ownerEmail];
        emailPayload.reply_to = ownerEmail;
      }

      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(emailPayload),
        });
        emailSent = resp.ok;
      } catch { /* email is best-effort */ }
    }
  }

  // Update work order status to 'sent' if email was dispatched
  if (emailSent) {
    await sb.from('work_orders').update({ status: 'sent' }).eq('id', workOrderId);
  }

  // Log to maintenance comments for audit trail
  const maintenanceRequestId = (wo as any).maintenance_request_id;
  if (maintenanceRequestId) {
    await sb.from('maintenance_comments').insert({
      request_id: maintenanceRequestId,
      author_id: userId,
      content: `📋 Work order ${woNumber} generated${emailSent ? ` and sent to ${trade.business_name || trade.email}` : ''}${ownerEmail ? ` (CC: ${ownerEmail})` : ''}`,
      is_internal: true,
      metadata: {
        type: 'email_sent',
        email_type: 'work_order',
        work_order_id: workOrderId,
        document_id: doc.id,
        to: trade.email || null,
        cc: ownerEmail ? [ownerEmail] : [],
        subject: `Work Order ${woNumber}`,
        html_content: htmlContent,
      },
    });
  }

  return {
    success: true,
    data: {
      work_order_id: workOrderId,
      document_id: doc.id,
      wo_number: woNumber,
      email_sent: emailSent,
      to: trade.email || null,
      cc: ownerEmail ? [ownerEmail] : [],
      view_route: `/(app)/documents/${doc.id}`,
    },
  };
}

// ── REAL INTEGRATION: Resend Email ────────────────────────────────────────
export async function handle_send_email_sendgrid(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return { success: false, error: 'RESEND_API_KEY not configured. Set it in Supabase secrets to enable email sending.' };
  }

  const to = input.to as string;
  const subject = input.subject as string;
  const htmlContent = input.html_content as string;
  const cc = (input.cc as string[]) || [];
  const bcc = (input.bcc as string[]) || [];
  const replyTo = (input.reply_to as string) || undefined;

  if (!to || !subject || !htmlContent) {
    return { success: false, error: 'Missing required fields: to, subject, html_content' };
  }

  // Validate primary recipient. Owners can email: themselves, their tenants,
  // or trades in their network. Tenants can only email their own owner (via
  // the agent with owner approval). Tenants must NOT email trades directly —
  // trade correspondence flows through the owner or agent-on-owner's-behalf.
  const { data: ownProfile } = await sb.from('profiles').select('email, role').eq('id', userId).single();
  const isOwnerEmail = ownProfile?.email?.toLowerCase() === to.toLowerCase();
  const callerIsOwner = ownProfile?.role === 'owner';

  if (!isOwnerEmail) {
    // Check if recipient is a tenant associated with the owner's properties
    const { data: tenantProfile, error: tpErr } = await sb
      .from('profiles')
      .select('id, email, tenancies!inner(property_id, properties!inner(owner_id))')
      .eq('email', to)
      .eq('tenancies.properties.owner_id', userId)
      .limit(1)
      .maybeSingle();

    if (tpErr || !tenantProfile) {
      if (callerIsOwner) {
        // Owners can email any trade in their network
        const { data: tradeProfile } = await sb
          .from('trades')
          .select('id, email, owner_trades!inner(owner_id)')
          .eq('email', to)
          .eq('owner_trades.owner_id', userId)
          .limit(1)
          .maybeSingle();

        if (!tradeProfile) {
          return { success: false, error: 'Recipient email is not associated with any of your properties or trade network. You can only email your own tenants and tradespeople.' };
        }
      } else {
        // Tenants can only email trades already assigned to a work order on
        // their property — they cannot cold-email trades from the owner's
        // network. The owner or agent must initiate trade contact first.
        const { data: assignedTrade } = await sb
          .from('trades')
          .select('id, email, work_orders!inner(id, property_id, status, properties!inner(id, tenancies!inner(tenant_id)))')
          .eq('email', to)
          .eq('work_orders.properties.tenancies.tenant_id', userId)
          .in('work_orders.status', ['sent', 'quoted', 'approved', 'in_progress'])
          .limit(1)
          .maybeSingle();

        if (!assignedTrade) {
          return { success: false, error: 'You can only email tradespeople who have been assigned to a job at your property. Please raise a maintenance request and your landlord or Casa will coordinate with trades on your behalf.' };
        }
      }
    }
  }

  const fromEmail = Deno.env.get('EMAIL_FROM') || 'noreply@casaintelligence.com.au';
  const fromName = Deno.env.get('EMAIL_FROM_NAME') || 'Casa';

  try {
    const emailPayload: Record<string, unknown> = {
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html: htmlContent,
      text: htmlContent.replace(/<[^>]*>/g, ''),
    };
    if (cc.length > 0) emailPayload.cc = cc;
    if (bcc.length > 0) emailPayload.bcc = bcc;
    if (replyTo) emailPayload.reply_to = replyTo;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (response.ok) {
      const data = await response.json();

      // Log to maintenance workflow if linked to a maintenance request
      const maintenanceRequestId = input.maintenance_request_id as string;
      if (maintenanceRequestId) {
        await sb.from('maintenance_comments').insert({
          request_id: maintenanceRequestId,
          author_id: userId,
          content: `📧 Email sent to ${to}${cc.length > 0 ? ` (CC: ${cc.join(', ')})` : ''}${bcc.length > 0 ? ` (BCC: ${bcc.join(', ')})` : ''} — Subject: ${subject}`,
          is_internal: true,
          metadata: {
            type: 'email_sent',
            email_type: 'general',
            to,
            cc,
            bcc,
            subject,
            html_content: htmlContent,
            message_id: data.id || null,
          },
        }).then(() => {}).catch(() => {}); // best-effort logging
      }

      return { success: true, data: { sent: true, to, cc, bcc, subject, messageId: data.id || undefined } };
    }
    const errorBody = await response.text();
    return { success: false, error: `Resend error ${response.status}: ${errorBody}` };
  } catch (err: any) {
    return { success: false, error: `Email send failed: ${err.message}` };
  }
}

// ── REAL INTEGRATION: Expo Push Notifications ─────────────────────────────
export async function handle_send_push_expo(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const targetUserId = input.user_id as string;
  const title = input.title as string;
  const body = input.body as string;
  const data = (input.data as Record<string, unknown>) || {};

  if (!targetUserId || !title || !body) {
    return { success: false, error: 'Missing required fields: user_id, title, body' };
  }

  // Validate recipient: must be the owner themselves or a tenant linked to their properties
  if (targetUserId !== userId) {
    const { data: tenantLink, error: tlErr } = await sb
      .from('tenancies')
      .select('id, properties!inner(owner_id)')
      .eq('tenant_id', targetUserId)
      .eq('properties.owner_id', userId)
      .limit(1)
      .maybeSingle();

    if (tlErr || !tenantLink) {
      return { success: false, error: 'Target user is not associated with any of your properties. You can only send push notifications to your own tenants.' };
    }
  }

  // Look up the user's push token from push_tokens table (not profiles)
  const { data: tokenRow, error: tokenError } = await sb
    .from('push_tokens')
    .select('token')
    .eq('user_id', targetUserId)
    .eq('is_active', true)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (tokenError || !tokenRow?.token) {
    return { success: false, error: 'User does not have a push token registered. They may not have enabled push notifications.' };
  }

  const pushToken = tokenRow.token as string;

  // Validate Expo push token format
  if (!pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken[')) {
    return { success: false, error: 'Invalid push token format' };
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high',
      }),
    });

    const result = await response.json();

    if (result.data?.status === 'ok') {
      return { success: true, data: { sent: true, to: targetUserId, title, ticketId: result.data.id } };
    }
    return { success: false, error: `Push notification failed: ${JSON.stringify(result.data)}` };
  } catch (err: any) {
    return { success: false, error: `Push send failed: ${err.message}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPLIANCE / AUTHORITY TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_check_compliance_requirements(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const state = input.state as string;
  const category = (input.category as string) || 'all';

  // Get state requirements from compliance_requirements table
  let query = sb
    .from('compliance_requirements')
    .select('id, state, name, description, category, frequency_months, is_mandatory, conditions, legislation_section, prescribed_form_number, authority_name, submission_url')
    .eq('state', state.toUpperCase());

  if (category !== 'all') {
    query = query.eq('category', category);
  }

  const { data: requirements, error } = await query;
  if (error) return { success: false, error: error.message };

  // If property_id provided, also get property compliance status
  let propertyCompliance = null;
  if (input.property_id) {
    const { data: compliance } = await sb
      .from('property_compliance')
      .select('id, requirement_id, status, last_completed_at, next_due_date, certificate_url, notes')
      .eq('property_id', input.property_id as string);
    propertyCompliance = compliance;
  }

  // State legislation details (hardcoded for comprehensive coverage)
  const legislationMap: Record<string, { name: string; tribunalName: string; authorityName: string }> = {
    NSW: { name: 'Residential Tenancies Act 2010 (NSW)', tribunalName: 'NCAT', authorityName: 'NSW Fair Trading' },
    VIC: { name: 'Residential Tenancies Act 1997 (Vic)', tribunalName: 'VCAT', authorityName: 'Consumer Affairs Victoria' },
    QLD: { name: 'Residential Tenancies and Rooming Accommodation Act 2008 (Qld)', tribunalName: 'QCAT', authorityName: 'RTA Queensland' },
    SA: { name: 'Residential Tenancies Act 1995 (SA)', tribunalName: 'SACAT', authorityName: 'Consumer and Business Services' },
    WA: { name: 'Residential Tenancies Act 1987 (WA)', tribunalName: 'Magistrates Court', authorityName: 'Department of Commerce' },
    TAS: { name: 'Residential Tenancy Act 1997 (Tas)', tribunalName: 'Residential Tenancy Commissioner', authorityName: 'CBOS Tasmania' },
    NT: { name: 'Residential Tenancies Act 1999 (NT)', tribunalName: 'NTCAT', authorityName: 'NT Consumer Affairs' },
    ACT: { name: 'Residential Tenancies Act 1997 (ACT)', tribunalName: 'ACAT', authorityName: 'Access Canberra' },
  };

  return {
    success: true,
    data: {
      state: state.toUpperCase(),
      legislation: legislationMap[state.toUpperCase()] || null,
      requirements: requirements || [],
      propertyCompliance: propertyCompliance || [],
      instruction: 'Use this compliance data to inform the owner about their obligations. Reference specific legislation sections when advising on requirements.',
    },
  };
}

export async function handle_track_authority_submission(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // Update existing submission
  if (input.submission_id) {
    const updates: Record<string, unknown> = {};
    if (input.status) updates.status = input.status;
    if (input.reference_number) updates.reference_number = input.reference_number;
    if (input.notes) updates.notes = input.notes;
    if (input.status === 'submitted') updates.submitted_at = new Date().toISOString();
    if (input.status === 'acknowledged') updates.acknowledged_at = new Date().toISOString();

    const { data, error } = await sb
      .from('authority_submissions')
      .update(updates)
      .eq('id', input.submission_id as string)
      .eq('owner_id', userId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: { submission: data, action: 'updated' } };
  }

  // Create new submission
  const insertData: Record<string, unknown> = {
    owner_id: userId,
    property_id: input.property_id,
    submission_type: input.submission_type,
    authority_name: input.authority_name || 'Unknown Authority',
    authority_state: (input.authority_state as string).toUpperCase(),
    submission_method: input.submission_method,
    status: (input.status as string) || 'pending',
    reference_number: input.reference_number || null,
    document_id: input.document_id || null,
    tenancy_id: input.tenancy_id || null,
    notes: input.notes || null,
  };

  if (insertData.status === 'submitted') {
    insertData.submitted_at = new Date().toISOString();
  }

  const { data, error } = await sb
    .from('authority_submissions')
    .insert(insertData)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: { submission: data, action: 'created' } };
}

export async function handle_generate_proof_of_service(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const serviceMethod = input.service_method as string;
  const serviceDate = input.service_date as string;
  const servedTo = input.served_to as string;
  const state = (input.state as string).toUpperCase();
  const propertyAddress = (input.property_address as string) || '';

  // Get the document details
  const { data: document } = await sb
    .from('documents')
    .select('id, title, document_type')
    .eq('id', input.document_id as string)
    .single();

  // Get owner profile
  const { data: owner } = await sb
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single();

  const ownerName = owner?.full_name || 'Owner';
  const documentTitle = document?.title || 'Document';

  // Build proof of service HTML
  const formattedDate = new Date(serviceDate).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  let methodDescription = '';
  let proofType = '';
  switch (serviceMethod) {
    case 'email':
      methodDescription = `sent by email to the recipient's email address`;
      proofType = 'email_receipt';
      break;
    case 'registered_post':
      methodDescription = `sent by registered post${input.tracking_number ? ` (tracking number: ${input.tracking_number})` : ''}`;
      proofType = 'registered_post_tracking';
      break;
    case 'hand_delivery':
      methodDescription = `delivered by hand${input.witness_name ? ` in the presence of ${input.witness_name}` : ''}`;
      proofType = 'hand_delivery_witness';
      break;
    case 'online_portal':
      methodDescription = 'submitted through the relevant state authority online portal';
      proofType = 'portal_confirmation';
      break;
    default:
      methodDescription = `delivered via ${serviceMethod}`;
      proofType = 'statutory_declaration';
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Proof of Service</title>
<style>
  body { font-family: -apple-system, sans-serif; font-size: 11pt; line-height: 1.6; color: #0A0A0A; padding: 40px; }
  h1 { font-size: 16pt; color: #1B1464; text-align: center; border-bottom: 2px solid #1B1464; padding-bottom: 8px; }
  .section { margin-top: 20px; }
  .section h2 { font-size: 12pt; color: #1B1464; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 10px; border: 1px solid #E5E5E5; }
  td.label { width: 35%; font-weight: 600; background: #F5F5F4; color: #525252; }
  .declaration { margin-top: 24px; padding: 16px; border: 1px solid #E5E5E5; background: #FAFAFA; }
  .sig-block { margin-top: 32px; }
  .sig-line { border-bottom: 1px solid #000; height: 40px; width: 300px; margin-bottom: 4px; }
  .sig-label { font-size: 9pt; color: #525252; }
  .footer { margin-top: 32px; text-align: center; font-size: 8pt; color: #A3A3A3; }
</style></head>
<body>
<h1>PROOF OF SERVICE</h1>
<p style="text-align:center;color:#525252;font-size:10pt">Statutory Declaration</p>

<div class="section">
  <h2>Service Details</h2>
  <table>
    <tr><td class="label">Document Served</td><td>${documentTitle}</td></tr>
    <tr><td class="label">Served To</td><td>${servedTo}</td></tr>
    <tr><td class="label">Property Address</td><td>${propertyAddress}</td></tr>
    <tr><td class="label">State</td><td>${state}</td></tr>
    <tr><td class="label">Date of Service</td><td>${formattedDate}</td></tr>
    <tr><td class="label">Method of Service</td><td>${serviceMethod.replace('_', ' ').toUpperCase()}</td></tr>
    ${input.tracking_number ? `<tr><td class="label">Tracking Number</td><td>${input.tracking_number}</td></tr>` : ''}
    ${input.witness_name ? `<tr><td class="label">Witness</td><td>${input.witness_name}</td></tr>` : ''}
  </table>
</div>

<div class="declaration">
  <p>I, <strong>${ownerName}</strong>, solemnly declare that on <strong>${formattedDate}</strong>,
  I served the document titled "<strong>${documentTitle}</strong>" upon
  <strong>${servedTo}</strong> by ${methodDescription}.</p>
  <p>This declaration is made in accordance with the requirements of the applicable
  residential tenancies legislation of ${state}.</p>
</div>

<div class="sig-block">
  <div class="sig-line"></div>
  <div class="sig-label">Signature of ${ownerName}</div>
  <br/>
  <div class="sig-line"></div>
  <div class="sig-label">Date</div>
</div>

<div class="footer">
  <p>Generated by Casa — AI-powered property management</p>
</div>
</body></html>`;

  // Create the proof of service document
  const { data: proofDoc, error: docError } = await sb
    .from('documents')
    .insert({
      owner_id: userId,
      title: `Proof of Service — ${documentTitle}`,
      document_type: 'other',
      html_content: htmlContent,
      status: 'draft',
      property_id: input.property_id || null,
    })
    .select('id')
    .single();

  if (docError) return { success: false, error: docError.message };

  // Update the authority submission with proof details
  if (input.submission_id) {
    await sb
      .from('authority_submissions')
      .update({
        proof_type: proofType,
        proof_url: null, // Will be set when document is signed
        tracking_number: input.tracking_number || null,
      })
      .eq('id', input.submission_id as string)
      .eq('owner_id', userId);
  }

  return {
    success: true,
    data: {
      proofDocumentId: proofDoc?.id,
      proofType,
      serviceDetails: {
        method: serviceMethod,
        date: serviceDate,
        servedTo,
        trackingNumber: input.tracking_number || null,
        witnessName: input.witness_name || null,
      },
    },
  };
}
