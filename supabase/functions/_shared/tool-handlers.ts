// Tool Execution Handlers for Casa Agent
// Each handler receives (toolInput, userId, supabase) and returns { success, data?, error? }

type SupabaseClient = any;
type ToolResult = { success: boolean; data?: unknown; error?: string };
type ToolInput = Record<string, unknown>;

// Helper: verify property belongs to owner
async function verifyPropertyOwnership(propertyId: string, userId: string, supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('properties')
    .select('id, owner_id')
    .eq('id', propertyId)
    .eq('owner_id', userId)
    .single();
  return { owned: !error && !!data, property: data };
}

// Helper: verify tenancy belongs to owner (via property)
async function verifyTenancyOwnership(tenancyId: string, userId: string, supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('tenancies')
    .select('id, property_id, properties!inner(owner_id)')
    .eq('id', tenancyId)
    .eq('properties.owner_id', userId)
    .single();
  return { owned: !error && !!data, tenancy: data };
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY TOOL HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_get_property(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const includes = (input.include as string[]) || [];
  let select = `id, address_line_1, address_line_2, suburb, state, postcode,
    property_type, bedrooms, bathrooms, parking_spaces,
    land_size_sqm, floor_size_sqm, year_built,
    rent_amount, rent_frequency, bond_amount,
    status, notes, created_at, updated_at`;

  if (includes.includes('tenancy')) select += `, tenancies(id, status, rent_amount, rent_frequency, lease_start_date, lease_end_date, tenancy_tenants(tenant_id, is_primary, profiles:tenant_id(full_name, email, phone)))`;
  if (includes.includes('compliance')) select += `, compliance_records:inspections(id, inspection_type, status, scheduled_date, completed_at)`;
  if (includes.includes('maintenance')) select += `, maintenance_requests(id, title, urgency, status, created_at)`;

  const { data, error } = await sb
    .from('properties')
    .select(select)
    .eq('id', input.property_id as string)
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_properties(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb
    .from('properties')
    .select(`id, address_line_1, address_line_2, suburb, state, postcode,
      property_type, bedrooms, bathrooms, parking_spaces,
      land_size_sqm, floor_size_sqm, year_built,
      rent_amount, rent_frequency, bond_amount,
      status, notes, created_at`)
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (input.status && input.status !== 'all') query = query.eq('status', input.status as string);
  if (input.limit) query = query.limit(input.limit as number);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_search_tenants(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // Get owner's property IDs first
  const { data: props } = await sb.from('properties').select('id').eq('owner_id', userId).is('deleted_at', null);
  const propIds = (props || []).map((p: any) => p.id);
  if (propIds.length === 0) return { success: true, data: [] };

  let query = sb
    .from('tenancy_tenants')
    .select(`tenant_id, is_primary, profiles:tenant_id(id, full_name, email, phone),
      tenancies!inner(id, property_id, status, rent_amount, properties!inner(address_line_1, suburb, state))`)
    .in('tenancies.property_id', propIds);

  if (input.property_id) query = query.eq('tenancies.property_id', input.property_id as string);
  if (input.status && input.status !== 'all') query = query.eq('tenancies.status', input.status as string);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  // Filter by search query if provided
  let results = data || [];
  if (input.query) {
    const q = (input.query as string).toLowerCase();
    results = results.filter((r: any) => {
      const p = r.profiles;
      return p?.full_name?.toLowerCase().includes(q) || p?.email?.toLowerCase().includes(q) || p?.phone?.includes(q);
    });
  }
  return { success: true, data: results };
}

export async function handle_get_tenancy(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb
    .from('tenancies')
    .select(`id, property_id, lease_start_date, lease_end_date, lease_type, is_periodic,
      rent_amount, rent_frequency, rent_due_day, bond_amount, bond_status, status, created_at,
      properties!inner(id, address_line_1, suburb, state, owner_id),
      tenancy_tenants(tenant_id, is_primary, profiles:tenant_id(full_name, email, phone))`)
    .eq('properties.owner_id', userId);

  if (input.tenancy_id) query = query.eq('id', input.tenancy_id as string);
  if (input.property_id) query = query.eq('property_id', input.property_id as string);

  const { data, error } = await query.single();
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_tenancy_detail(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { owned } = await verifyTenancyOwnership(input.tenancy_id as string, userId, sb);
  if (!owned) return { success: false, error: 'Tenancy not found or access denied' };

  const tid = input.tenancy_id as string;
  const [tenancy, docs, increases, schedules] = await Promise.all([
    sb.from('tenancies').select(`*, properties!inner(address_line_1, suburb, state),
      tenancy_tenants(tenant_id, is_primary, is_leaseholder, profiles:tenant_id(full_name, email, phone))`).eq('id', tid).single(),
    sb.from('tenancy_documents').select('*').eq('tenancy_id', tid).order('created_at', { ascending: false }),
    sb.from('rent_increases').select('*').eq('tenancy_id', tid).order('effective_date', { ascending: false }),
    sb.from('rent_schedules').select('*').eq('tenancy_id', tid).order('due_date', { ascending: false }).limit(20),
  ]);

  if (tenancy.error) return { success: false, error: tenancy.error.message };
  return { success: true, data: { ...tenancy.data, documents: docs.data || [], rent_increases: increases.data || [], recent_payments: schedules.data || [] } };
}

export async function handle_get_payments(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb
    .from('payments')
    .select(`id, tenancy_id, tenant_id, payment_type, amount, currency, description,
      status, due_date, paid_at, receipt_url, created_at,
      tenancies!inner(property_id, properties!inner(address_line_1, suburb, owner_id))`)
    .eq('tenancies.properties.owner_id', userId)
    .order('created_at', { ascending: false });

  if (input.tenant_id) query = query.eq('tenant_id', input.tenant_id as string);
  if (input.property_id) query = query.eq('tenancies.property_id', input.property_id as string);
  if (input.status && input.status !== 'all') query = query.eq('status', input.status as string);
  if (input.period && input.period !== 'all') {
    const now = new Date();
    const periods: Record<string, number> = { week: 7, month: 30, quarter: 90, year: 365 };
    const days = periods[input.period as string] || 30;
    const since = new Date(now.getTime() - days * 86400000).toISOString();
    query = query.gte('created_at', since);
  }

  const { data, error } = await query.limit(50);
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_rent_schedule(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { owned } = await verifyTenancyOwnership(input.tenancy_id as string, userId, sb);
  if (!owned) return { success: false, error: 'Tenancy not found or access denied' };

  const today = new Date().toISOString().split('T')[0];
  let query = sb
    .from('rent_schedules')
    .select('id, tenancy_id, due_date, amount, is_paid, paid_at, payment_id')
    .eq('tenancy_id', input.tenancy_id as string)
    .order('due_date', { ascending: false })
    .limit((input.limit as number) || 20);

  if (input.include_paid === false) query = query.eq('is_paid', false);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_arrears(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: props } = await sb.from('properties').select('id').eq('owner_id', userId).is('deleted_at', null);
  const propIds = (props || []).map((p: any) => p.id);
  if (propIds.length === 0) return { success: true, data: [] };

  let query = sb
    .from('arrears_records')
    .select(`id, tenancy_id, tenant_id, days_overdue, total_overdue, first_overdue_date, severity, has_payment_plan, is_resolved,
      tenancies!inner(id, rent_amount, rent_frequency, properties!inner(id, address_line_1, suburb, state)),
      profiles:tenant_id(full_name, email, phone)`)
    .eq('is_resolved', false)
    .in('tenancies.property_id', propIds)
    .order('days_overdue', { ascending: false });

  if (input.property_id) query = query.eq('tenancies.property_id', input.property_id as string);
  if (input.min_days) query = query.gte('days_overdue', input.min_days as number);
  if (input.severity) query = query.eq('severity', input.severity as string);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_arrears_detail(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let filter: any = {};
  if (input.arrears_id) filter.id = input.arrears_id;

  const arrears = await sb
    .from('arrears_records')
    .select(`*, tenancies!inner(id, rent_amount, properties!inner(owner_id, address_line_1, suburb, state)),
      profiles:tenant_id(full_name, email, phone)`)
    .eq(input.arrears_id ? 'id' : 'tenancy_id', (input.arrears_id || input.tenancy_id) as string)
    .eq('tenancies.properties.owner_id', userId)
    .single();

  if (arrears.error) return { success: false, error: arrears.error.message };

  const arrearsId = (arrears.data as any).id;
  const [actions, plan] = await Promise.all([
    sb.from('arrears_actions').select('*').eq('arrears_record_id', arrearsId).order('created_at', { ascending: false }),
    sb.from('payment_plans').select('*').eq('arrears_record_id', arrearsId).limit(1).maybeSingle(),
  ]);

  return { success: true, data: { ...arrears.data, actions: actions.data || [], payment_plan: plan.data || null } };
}

export async function handle_get_maintenance(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb
    .from('maintenance_requests')
    .select(`id, property_id, tenancy_id, tenant_id, category, urgency, title, description,
      status, estimated_cost, actual_cost, scheduled_date, created_at,
      properties!inner(address_line_1, suburb, state, owner_id)`)
    .eq('properties.owner_id', userId)
    .order('created_at', { ascending: false });

  if (input.property_id) query = query.eq('property_id', input.property_id as string);
  if (input.status && input.status !== 'all') query = query.eq('status', input.status as string);
  if (input.urgency) query = query.eq('urgency', input.urgency as string);

  const { data, error } = await query.limit(50);
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_maintenance_detail(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const req = await sb
    .from('maintenance_requests')
    .select(`*, properties!inner(address_line_1, suburb, state, owner_id), profiles:tenant_id(full_name, email, phone)`)
    .eq('id', input.request_id as string)
    .eq('properties.owner_id', userId)
    .single();
  if (req.error) return { success: false, error: req.error.message };

  const rid = input.request_id as string;
  const [images, comments, workOrders, statusHistory] = await Promise.all([
    sb.from('maintenance_images').select('*').eq('request_id', rid),
    sb.from('maintenance_comments').select('*, profiles:author_id(full_name)').eq('request_id', rid).order('created_at', { ascending: true }),
    sb.from('work_orders').select('*, trades(business_name, contact_name, phone, average_rating)').eq('maintenance_request_id', rid),
    sb.from('maintenance_status_history').select('*').eq('request_id', rid).order('created_at', { ascending: true }),
  ]);

  return { success: true, data: { ...req.data, images: images.data || [], comments: comments.data || [], work_orders: workOrders.data || [], status_history: statusHistory.data || [] } };
}

export async function handle_get_quotes(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // Work orders with quotes for a maintenance request
  const { data, error } = await sb
    .from('work_orders')
    .select(`id, maintenance_request_id, trade_id, quoted_amount, quoted_at, quote_notes, quote_valid_until,
      status, scheduled_date, final_amount,
      trades(business_name, contact_name, phone, email, average_rating, total_reviews),
      maintenance_requests!inner(properties!inner(owner_id))`)
    .eq('maintenance_request_id', input.request_id as string)
    .eq('maintenance_requests.properties.owner_id', userId)
    .not('quoted_amount', 'is', null);

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_inspections(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb
    .from('inspections')
    .select(`id, property_id, tenancy_id, inspection_type, scheduled_date, scheduled_time,
      actual_date, status, overall_condition, summary_notes, created_at,
      properties!inner(address_line_1, suburb, state, owner_id)`)
    .eq('properties.owner_id', userId)
    .order('scheduled_date', { ascending: false });

  if (input.property_id) query = query.eq('property_id', input.property_id as string);
  if (input.type && input.type !== 'all') query = query.eq('inspection_type', input.type as string);
  if (input.status && input.status !== 'all') query = query.eq('status', input.status as string);

  const { data, error } = await query.limit(30);
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_inspection_detail(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const insp = await sb
    .from('inspections')
    .select(`*, properties!inner(address_line_1, suburb, state, owner_id)`)
    .eq('id', input.inspection_id as string)
    .eq('properties.owner_id', userId)
    .single();
  if (insp.error) return { success: false, error: insp.error.message };

  const iid = input.inspection_id as string;
  const [rooms, images] = await Promise.all([
    sb.from('inspection_rooms').select(`*, inspection_items(*)`).eq('inspection_id', iid).order('display_order'),
    sb.from('inspection_images').select('*').eq('inspection_id', iid),
  ]);

  return { success: true, data: { ...insp.data, rooms: rooms.data || [], images: images.data || [] } };
}

export async function handle_get_listings(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb
    .from('listings')
    .select(`id, property_id, title, description, available_date, lease_term, rent_amount, rent_frequency,
      bond_weeks, pets_allowed, status, published_at, view_count, application_count, created_at,
      properties!inner(id, address_line_1, suburb, state, owner_id)`)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (input.property_id) query = query.eq('property_id', input.property_id as string);
  if (input.status && input.status !== 'all') query = query.eq('status', input.status as string);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_listing_detail(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const listing = await sb
    .from('listings')
    .select(`*, properties!inner(address_line_1, suburb, state, bedrooms, bathrooms, parking_spaces, owner_id),
      listing_features(feature)`)
    .eq('id', input.listing_id as string)
    .eq('owner_id', userId)
    .single();
  if (listing.error) return { success: false, error: listing.error.message };

  const { data: apps } = await sb.from('applications').select('id, full_name, status, submitted_at').eq('listing_id', input.listing_id as string).order('submitted_at', { ascending: false });
  return { success: true, data: { ...listing.data, applications: apps || [] } };
}

export async function handle_get_applications(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: listing } = await sb.from('listings').select('id').eq('id', input.listing_id as string).eq('owner_id', userId).single();
  if (!listing) return { success: false, error: 'Listing not found or access denied' };

  let query = sb
    .from('applications')
    .select(`id, listing_id, tenant_id, full_name, email, phone, employment_type, employer_name,
      job_title, annual_income, current_rent, reason_for_moving, has_pets, pet_description,
      move_in_date, lease_term_preference, additional_occupants, status, submitted_at, created_at`)
    .eq('listing_id', input.listing_id as string)
    .order('submitted_at', { ascending: false });

  if (input.status && input.status !== 'all') query = query.eq('status', input.status as string);
  if (input.top_n) query = query.limit(input.top_n as number);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_application_detail(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const app = await sb
    .from('applications')
    .select(`*, listings!inner(owner_id, rent_amount, property_id, properties(address_line_1, suburb, state))`)
    .eq('id', input.application_id as string)
    .eq('listings.owner_id', userId)
    .single();
  if (app.error) return { success: false, error: app.error.message };

  const aid = input.application_id as string;
  const [refs, docs, checks] = await Promise.all([
    sb.from('application_references').select('*').eq('application_id', aid),
    sb.from('application_documents').select('*').eq('application_id', aid),
    sb.from('background_checks').select('*').eq('application_id', aid),
  ]);

  return { success: true, data: { ...app.data, references: refs.data || [], documents: docs.data || [], background_checks: checks.data || [] } };
}

export async function handle_get_conversations(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb
    .from('conversation_participants')
    .select(`conversation_id, unread_count, last_read_at,
      conversations!inner(id, property_id, conversation_type, title, last_message_at, last_message_preview,
        properties(address_line_1, suburb, state))`)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('conversations.last_message_at', { ascending: false });

  if (input.property_id) query = query.eq('conversations.property_id', input.property_id as string);
  if (input.unread_only) query = query.gt('unread_count', 0);

  const { data, error } = await query.limit(30);
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_conversation_messages(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // Verify participant
  const { data: participant } = await sb
    .from('conversation_participants')
    .select('id')
    .eq('conversation_id', input.conversation_id as string)
    .eq('user_id', userId)
    .single();
  if (!participant) return { success: false, error: 'Conversation not found or access denied' };

  const { data, error } = await sb
    .from('messages')
    .select(`id, conversation_id, sender_id, content, content_type, status, created_at,
      profiles:sender_id(full_name), message_attachments(id, file_name, url, file_type)`)
    .eq('conversation_id', input.conversation_id as string)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit((input.limit as number) || 30);

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_compliance_status(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // Use inspections as compliance proxy (smoke alarm checks, etc.)
  let query = sb
    .from('inspections')
    .select(`id, property_id, inspection_type, scheduled_date, status, completed_at, overall_condition,
      properties!inner(address_line_1, suburb, state, owner_id)`)
    .eq('properties.owner_id', userId)
    .in('inspection_type', ['routine', 'maintenance', 'complaint']);

  if (input.property_id) query = query.eq('property_id', input.property_id as string);
  if (input.overdue_only) {
    const today = new Date().toISOString().split('T')[0];
    query = query.lt('scheduled_date', today).neq('status', 'completed').neq('status', 'cancelled');
  }

  const { data, error } = await query.order('scheduled_date', { ascending: true }).limit(50);
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_financial_summary(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // Use the financial_summary materialized view
  let query = sb.from('financial_summary').select('*').eq('owner_id', userId);
  if (input.property_id) query = query.eq('property_id', input.property_id as string);

  // Period filtering
  const now = new Date();
  if (input.period === 'month') {
    query = query.gte('month', new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
  } else if (input.period === 'quarter') {
    query = query.gte('month', new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString());
  } else if (input.period === 'year') {
    query = query.gte('month', new Date(now.getFullYear(), 0, 1).toISOString());
  }

  const { data, error } = await query.order('month', { ascending: false });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_transactions(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb
    .from('payments')
    .select(`id, tenancy_id, tenant_id, payment_type, amount, currency, description, status, due_date, paid_at, created_at,
      tenancies!inner(property_id, properties!inner(address_line_1, suburb, owner_id))`)
    .eq('tenancies.properties.owner_id', userId)
    .order('created_at', { ascending: false });

  if (input.property_id) query = query.eq('tenancies.property_id', input.property_id as string);
  if (input.type && input.type !== 'all') query = query.eq('payment_type', input.type as string);
  if (input.period && input.period !== 'all') {
    const days: Record<string, number> = { month: 30, quarter: 90, year: 365 };
    const since = new Date(Date.now() - (days[input.period as string] || 30) * 86400000).toISOString();
    query = query.gte('created_at', since);
  }

  const { data, error } = await query.limit(100);
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_trades(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb
    .from('trades')
    .select('id, business_name, contact_name, email, phone, categories, service_areas, average_rating, total_reviews, total_jobs, status')
    .eq('status', 'active');

  if (input.category) query = query.contains('categories', [input.category as string]);
  if (input.postcode) query = query.contains('service_areas', [input.postcode as string]);
  if (input.min_rating) query = query.gte('average_rating', input.min_rating as number);

  const { data, error } = await query.order('average_rating', { ascending: false }).limit(20);
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_work_orders(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb
    .from('work_orders')
    .select(`id, maintenance_request_id, property_id, trade_id, title, description, category, urgency,
      budget_min, budget_max, quoted_amount, final_amount, status, scheduled_date, created_at,
      trades(business_name, phone, average_rating),
      properties!inner(address_line_1, suburb, state, owner_id)`)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (input.property_id) query = query.eq('property_id', input.property_id as string);
  if (input.trade_id) query = query.eq('trade_id', input.trade_id as string);
  if (input.status && input.status !== 'all') query = query.eq('status', input.status as string);

  const { data, error } = await query.limit(30);
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_property_metrics(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb.from('property_metrics').select('*').eq('owner_id', userId);
  if (input.property_id) query = query.eq('property_id', input.property_id as string);
  const { data, error } = await query.order('address_line_1', { ascending: true });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_expenses(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb
    .from('manual_expenses')
    .select(`id, property_id, description, amount, expense_date, is_recurring, recurring_frequency,
      is_tax_deductible, tax_category, notes, created_at,
      expense_categories(name, is_tax_deductible),
      properties(address_line_1, suburb, state)`)
    .eq('owner_id', userId)
    .order('expense_date', { ascending: false });

  if (input.property_id) query = query.eq('property_id', input.property_id as string);
  if (input.category) query = query.eq('expense_categories.name', input.category as string);
  if (input.period && input.period !== 'all') {
    const now = new Date();
    let since: string;
    if (input.period === 'financial_year') {
      const fy = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
      since = `${fy}-07-01`;
    } else {
      const days: Record<string, number> = { month: 30, quarter: 90, year: 365 };
      since = new Date(Date.now() - (days[input.period as string] || 30) * 86400000).toISOString().split('T')[0];
    }
    query = query.gte('expense_date', since);
  }

  const { data, error } = await query.limit(100);
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_payment_plan(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb.from('payment_plans').select(`*, payment_plan_installments(*),
    arrears_records(tenancy_id, tenancies!inner(properties!inner(owner_id)))`);

  if (input.payment_plan_id) query = query.eq('id', input.payment_plan_id as string);
  if (input.tenancy_id) query = query.eq('tenancy_id', input.tenancy_id as string);

  const { data, error } = await query.single();
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_documents(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (input.tenancy_id) {
    const { owned } = await verifyTenancyOwnership(input.tenancy_id as string, userId, sb);
    if (!owned) return { success: false, error: 'Tenancy not found or access denied' };

    let query = sb.from('tenancy_documents').select('*').eq('tenancy_id', input.tenancy_id as string).order('created_at', { ascending: false });
    if (input.type && input.type !== 'all') query = query.eq('document_type', input.type as string);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  // Application documents as fallback
  return { success: true, data: [] };
}

export async function handle_get_background_tasks(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb
    .from('agent_background_tasks')
    .select('id, task_type, trigger_type, schedule, status, last_run_at, next_run_at, result_data, error, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (input.status && input.status !== 'all') query = query.eq('status', input.status as string);
  const { data, error } = await query.limit(20);
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_get_pending_actions(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  let query = sb
    .from('agent_pending_actions')
    .select('id, action_type, title, description, tool_name, tool_params, autonomy_level, status, recommendation, created_at, expires_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!input.status || input.status === 'pending') query = query.eq('status', 'pending');
  else if (input.status !== 'all') query = query.eq('status', input.status as string);

  const { data, error } = await query.limit(20);
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_check_maintenance_threshold(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: settings } = await sb
    .from('agent_autonomy_settings')
    .select('category_overrides')
    .eq('user_id', userId)
    .single();

  const threshold = (settings?.category_overrides as any)?.maintenance_auto_approve_threshold || 500;
  const cost = input.estimated_cost as number;
  return {
    success: true,
    data: {
      estimated_cost: cost,
      threshold,
      within_threshold: cost <= threshold,
      requires_approval: cost > threshold,
      is_tenant_caused: input.is_tenant_caused || false,
    },
  };
}

export async function handle_check_regulatory_requirements(input: ToolInput, _userId: string, _sb: SupabaseClient): Promise<ToolResult> {
  // Return state + action for Claude to reason about (it has regulatory knowledge)
  return {
    success: true,
    data: {
      state: input.state,
      action_type: input.action_type,
      instruction: `Based on your knowledge of Australian ${input.state} residential tenancy law, provide the regulatory requirements for "${input.action_type}". Include notice periods, form requirements, and any relevant legislation references.`,
    },
  };
}
