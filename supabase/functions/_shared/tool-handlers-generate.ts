// Generate, External, Workflow, Memory & Planning Tool Handlers

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

export async function handle_estimate_cost(input: ToolInput, _userId: string, _sb: SupabaseClient): Promise<ToolResult> {
  return { success: true, data: { category: input.category, description: input.description, postcode: input.postcode || '', instruction: `Estimate the cost of this maintenance work in Australian dollars. Category: ${input.category}. Description: ${input.description}. Location postcode: ${input.postcode || 'unknown'}. Provide low/mid/high estimates based on typical Australian trade rates. Return JSON: { "low": N, "mid": N, "high": N, "factors": [...], "notes": "..." }` } };
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
// EXTERNAL / INTEGRATION TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_web_search(input: ToolInput, _userId: string, _sb: SupabaseClient): Promise<ToolResult> {
  // This will be backed by a real search API (e.g. Brave, Google) when deployed
  // For now, return the query for Claude to reason about from its training data
  return { success: true, data: { query: input.query, region: input.region || 'Australia', instruction: `The user's agent is searching for: "${input.query}" in ${input.region || 'Australia'}. Based on your knowledge, provide the most relevant and current information. Note: in production this will use a live search API.` } };
}

export async function handle_find_local_trades(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // First check our own database
  let query = sb.from('trades').select('id, business_name, contact_name, phone, email, categories, service_areas, average_rating, total_reviews, total_jobs, status').eq('status', 'active');
  if (input.trade_type) query = query.contains('categories', [input.trade_type as string]);

  // If property_id given, get the suburb
  if (input.property_id) {
    const { data: prop } = await sb.from('properties').select('suburb, postcode').eq('id', input.property_id as string).single();
    if (prop) query = query.contains('service_areas', [(prop as any).postcode || (prop as any).suburb]);
  } else if (input.suburb) {
    query = query.contains('service_areas', [input.suburb as string]);
  }

  const { data: localTrades } = await query.order('average_rating', { ascending: false }).limit((input.max_results as number) || 10);

  return { success: true, data: { trades_in_network: localTrades || [], trade_type: input.trade_type, suburb: input.suburb, urgency: input.urgency, instruction: localTrades && localTrades.length > 0 ? 'Here are trades from the owner\'s network. Present these first, then offer to search externally for more options.' : `No ${input.trade_type} found in the owner's network for this area. In production, this would search external directories. Suggest the owner add tradespeople to their network.` } };
}

export async function handle_parse_business_details(input: ToolInput, _userId: string, _sb: SupabaseClient): Promise<ToolResult> {
  return { success: true, data: { url: input.url, business_name: input.business_name || '', instruction: `Extract structured business details from this URL: ${input.url}. Return JSON: { "business_name": "...", "abn": "...", "license_number": "...", "phone": "...", "email": "...", "address": "...", "rating": N, "insurance_status": "...", "services": [...] }. Note: in production this will use web scraping.` } };
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

  // Queue notification email to trade if we have their details
  if (input.provider_id) {
    const { data: trade } = await sb.from('trades').select('email, business_name').eq('id', input.provider_id as string).single();
    if (trade && (trade as any).email) {
      await sb.from('email_queue').insert({
        to_email: (trade as any).email, to_name: (trade as any).business_name,
        subject: 'Quote Request from Casa Property Management',
        template_name: 'quote_request',
        template_data: { description: input.description, urgency: input.urgency || 'routine', property_id: input.property_id },
        status: 'pending',
      });
    }
  }

  return { success: true, data: { work_order_id: (wo as any).id, status: 'quote_requested' } };
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

export async function handle_check_regulatory_requirements(input: ToolInput, _userId: string, _sb: SupabaseClient): Promise<ToolResult> {
  return { success: true, data: { state: input.state, action_type: input.action_type, instruction: `Based on your knowledge of Australian ${input.state} residential tenancy law, provide the regulatory requirements for "${input.action_type}". Include notice periods, required forms, and relevant legislation references.` } };
}

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

  return { success: true, data: { request: req, auto_approve_threshold: input.auto_approve_threshold || 500, instruction: 'Execute the maintenance lifecycle. Steps: 1) Triage the request (use triage_maintenance), 2) Find suitable trades (use find_local_trades), 3) Request quotes from top trades (use request_quote), 4) Compare quotes when received (use compare_quotes), 5) If within auto-approve threshold, approve best quote (use approve_quote), otherwise present options to owner, 6) Track work order through completion. Report at each step.' } };
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
    }, { onConflict: 'user_id,property_id,category,preference_key' })
    .select('id, category, preference_key, preference_value')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: { remembered: true, key: input.key, ...data } };
}

export async function handle_recall(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb
    .from('agent_preferences')
    .select('category, preference_key, preference_value, source, confidence, updated_at')
    .eq('user_id', userId)
    .order('confidence', { ascending: false });

  if (input.category) query = query.eq('category', input.category as string);
  if (input.property_id) query = query.eq('property_id', input.property_id as string);

  const { data, error } = await query.limit(20);
  if (error) return { success: false, error: error.message };
  return { success: true, data: { context: input.context, preferences: data || [] } };
}

export async function handle_search_precedent(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb
    .from('agent_decisions')
    .select('id, decision_type, tool_name, input_data, output_data, reasoning, confidence, owner_feedback, created_at')
    .eq('user_id', userId)
    .eq('was_auto_executed', true)
    .order('created_at', { ascending: false });

  if (input.tool_name) query = query.eq('tool_name', input.tool_name as string);

  const { data, error } = await query.limit((input.limit as number) || 10);
  if (error) return { success: false, error: error.message };
  return { success: true, data: { query: input.query, precedents: data || [] } };
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

function integrationStub(toolName: string, service: string): (input: ToolInput, userId: string, sb: SupabaseClient) => Promise<ToolResult> {
  return async (_input, _userId, _sb) => ({
    success: false,
    error: `The "${toolName}" tool requires ${service} integration to be configured. This integration is not yet active. Please configure the ${service} API credentials in your environment to enable this feature.`,
  });
}

export const handle_syndicate_listing_domain = integrationStub('syndicate_listing_domain', 'Domain.com.au API');
export const handle_syndicate_listing_rea = integrationStub('syndicate_listing_rea', 'REA Group API');
export const handle_run_credit_check = integrationStub('run_credit_check', 'Equifax credit check');
export const handle_run_tica_check = integrationStub('run_tica_check', 'TICA tenancy database');
export const handle_collect_rent_stripe = integrationStub('collect_rent_stripe', 'Stripe Connect');
export const handle_refund_payment_stripe = integrationStub('refund_payment_stripe', 'Stripe Connect');
export const handle_send_docusign_envelope = integrationStub('send_docusign_envelope', 'DocuSign');
export const handle_lodge_bond_state = integrationStub('lodge_bond_state', 'state bond authority');
export const handle_send_sms_twilio = integrationStub('send_sms_twilio', 'Twilio SMS');
export const handle_send_email_sendgrid = integrationStub('send_email_sendgrid', 'SendGrid email');
export const handle_send_push_expo = integrationStub('send_push_expo', 'Expo Push Notifications');
export const handle_search_trades_hipages = integrationStub('search_trades_hipages', 'hipages API');
