// Action Tool Execution Handlers for Casa Agent
// Property CRUD, tenancy management, listings, messaging, maintenance, inspections,
// arrears, compliance, trades, payments

type SupabaseClient = any;
type ToolResult = { success: boolean; data?: unknown; error?: string };
type ToolInput = Record<string, unknown>;

async function verifyPropertyOwnership(pid: string, uid: string, sb: SupabaseClient) {
  const { data, error } = await sb.from('properties').select('id').eq('id', pid).eq('owner_id', uid).is('deleted_at', null).single();
  return !error && !!data;
}

async function verifyTenancyOwnership(tid: string, uid: string, sb: SupabaseClient) {
  const { data, error } = await sb.from('tenancies').select('id').eq('id', tid).eq('properties.owner_id', uid).single();
  // Fallback: join through properties
  if (error) {
    const { data: t2, error: e2 } = await sb.from('tenancies').select('id, properties!inner(owner_id)').eq('id', tid).eq('properties.owner_id', uid).single();
    return !e2 && !!t2;
  }
  return !error && !!data;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY CRUD
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_create_property(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await sb
    .from('properties')
    .insert({
      owner_id: userId,
      address_line_1: input.address_line_1 as string,
      address_line_2: (input.address_line_2 as string) || null,
      suburb: input.suburb as string,
      state: input.state as string,
      postcode: input.postcode as string,
      property_type: (input.property_type as string) || 'house',
      bedrooms: (input.bedrooms as number) || null,
      bathrooms: (input.bathrooms as number) || null,
      parking_spaces: (input.parking_spaces as number) || null,
      floor_size_sqm: (input.floor_size_sqm as number) || null,
      land_size_sqm: (input.land_size_sqm as number) || null,
      year_built: (input.year_built as number) || null,
      rent_amount: (input.rent_amount as number) || null,
      rent_frequency: (input.rent_frequency as string) || 'weekly',
      bond_amount: (input.bond_amount as number) || null,
      notes: (input.notes as string) || null,
      status: 'vacant',
    })
    .select('id, address_line_1, suburb, state, postcode, property_type, bedrooms, bathrooms, rent_amount, status')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: { ...data, message: `Property created at ${(data as any).address_line_1}, ${(data as any).suburb} ${(data as any).state}` } };
}

export async function handle_update_property(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyPropertyOwnership(input.property_id as string, userId, sb))
    return { success: false, error: 'Property not found or access denied' };

  const { data, error } = await sb
    .from('properties')
    .update({ ...(input.updates as object), updated_at: new Date().toISOString() })
    .eq('id', input.property_id as string)
    .select('id, address_line_1, suburb, state, status')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_delete_property(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyPropertyOwnership(input.property_id as string, userId, sb))
    return { success: false, error: 'Property not found or access denied' };

  const { error } = await sb
    .from('properties')
    .update({ deleted_at: new Date().toISOString(), notes: input.reason ? `Deleted: ${input.reason}` : null })
    .eq('id', input.property_id as string);

  if (error) return { success: false, error: error.message };
  return { success: true, data: { property_id: input.property_id, deleted: true } };
}

// ═══════════════════════════════════════════════════════════════════════════
// TENANCY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_create_tenancy(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyPropertyOwnership(input.property_id as string, userId, sb))
    return { success: false, error: 'Property not found or access denied' };

  const { data: tenancy, error } = await sb
    .from('tenancies')
    .insert({
      property_id: input.property_id as string,
      lease_start_date: input.lease_start_date as string,
      lease_end_date: (input.lease_end_date as string) || null,
      lease_type: (input.lease_type as string) || 'fixed',
      is_periodic: (input.lease_type as string) === 'periodic',
      rent_amount: input.rent_amount as number,
      rent_frequency: input.rent_frequency as string,
      rent_due_day: (input.rent_due_day as number) || 1,
      bond_amount: (input.bond_amount as number) || null,
      status: 'pending',
      notes: (input.notes as string) || null,
    })
    .select('id, property_id, lease_start_date, lease_end_date, rent_amount, rent_frequency, status')
    .single();

  if (error) return { success: false, error: error.message };

  // Link tenants if provided
  if (input.tenant_ids && Array.isArray(input.tenant_ids)) {
    for (let i = 0; i < (input.tenant_ids as string[]).length; i++) {
      await sb.from('tenancy_tenants').insert({
        tenancy_id: (tenancy as any).id,
        tenant_id: (input.tenant_ids as string[])[i],
        is_primary: i === 0,
      });
    }
  }

  // Update property status
  await sb.from('properties').update({ status: 'occupied' }).eq('id', input.property_id as string);

  return { success: true, data: tenancy };
}

export async function handle_update_tenancy(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyTenancyOwnership(input.tenancy_id as string, userId, sb))
    return { success: false, error: 'Tenancy not found or access denied' };

  const { data, error } = await sb
    .from('tenancies')
    .update({ ...(input.updates as object), updated_at: new Date().toISOString() })
    .eq('id', input.tenancy_id as string)
    .select('id, status, rent_amount, lease_start_date, lease_end_date')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_terminate_lease(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyTenancyOwnership(input.tenancy_id as string, userId, sb))
    return { success: false, error: 'Tenancy not found or access denied' };

  const { data, error } = await sb
    .from('tenancies')
    .update({
      status: 'ending',
      notice_given_date: new Date().toISOString().split('T')[0],
      actual_end_date: input.effective_date as string,
      end_reason: `${input.termination_type}: ${input.reason || ''}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.tenancy_id as string)
    .select('id, status, notice_given_date, actual_end_date, end_reason')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_renew_lease(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyTenancyOwnership(input.tenancy_id as string, userId, sb))
    return { success: false, error: 'Tenancy not found or access denied' };

  const updates: any = { lease_end_date: input.new_end_date, updated_at: new Date().toISOString() };
  if (input.new_rent_amount) updates.rent_amount = input.new_rent_amount;
  if (input.lease_type) { updates.lease_type = input.lease_type; updates.is_periodic = input.lease_type === 'periodic'; }

  const { data, error } = await sb
    .from('tenancies')
    .update(updates)
    .eq('id', input.tenancy_id as string)
    .select('id, lease_end_date, rent_amount, lease_type, status')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// ═══════════════════════════════════════════════════════════════════════════
// LISTINGS
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_create_listing(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyPropertyOwnership(input.property_id as string, userId, sb))
    return { success: false, error: 'Property not found or access denied' };

  const { data, error } = await sb
    .from('listings')
    .insert({
      property_id: input.property_id as string,
      owner_id: userId,
      title: input.title as string,
      description: (input.description as string) || '',
      rent_amount: input.rent_weekly as number || input.rent_amount as number,
      rent_frequency: 'weekly',
      available_date: input.available_date as string,
      lease_term: (input.lease_term as string) || '12_months',
      pets_allowed: (input.pets_allowed as boolean) || false,
      bond_weeks: (input.bond_weeks as number) || 4,
      status: 'draft',
    })
    .select('id, title, status, rent_amount, available_date')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_update_listing(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await sb
    .from('listings')
    .update({ ...(input.updates as object), updated_at: new Date().toISOString() })
    .eq('id', input.listing_id as string)
    .eq('owner_id', userId)
    .select('id, title, status, rent_amount')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_publish_listing(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: listing } = await sb.from('listings').select('id, status').eq('id', input.listing_id as string).eq('owner_id', userId).single();
  if (!listing) return { success: false, error: 'Listing not found or access denied' };
  if ((listing as any).status !== 'draft' && (listing as any).status !== 'paused')
    return { success: false, error: `Cannot publish listing in status: ${(listing as any).status}` };

  const { error } = await sb.from('listings').update({ status: 'active', published_at: new Date().toISOString() }).eq('id', input.listing_id as string);
  if (error) return { success: false, error: error.message };
  return { success: true, data: { listing_id: input.listing_id, new_status: 'active' } };
}

export async function handle_pause_listing(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { error } = await sb.from('listings').update({ status: 'paused' }).eq('id', input.listing_id as string).eq('owner_id', userId);
  if (error) return { success: false, error: error.message };
  return { success: true, data: { listing_id: input.listing_id, new_status: 'paused', reason: input.reason || '' } };
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGING
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_send_message(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const channel = (input.channel as string) || 'preferred';

  if (channel === 'email' || channel === 'preferred') {
    const { data: tenant } = await sb.from('profiles').select('full_name, email').eq('id', input.tenant_id as string).single();
    if (!tenant) return { success: false, error: 'Tenant not found' };

    const { error } = await sb.from('email_queue').insert({
      to_email: (tenant as any).email,
      to_name: (tenant as any).full_name,
      subject: input.priority === 'urgent' ? `[Urgent] Message from your property manager` : `Message from your property manager`,
      template_name: 'general_message',
      template_data: { tenant_name: (tenant as any).full_name, content: input.content, priority: input.priority || 'normal' },
      status: 'pending',
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data: { sent_to: (tenant as any).email, channel: 'email' } };
  }

  // In-app: find or create conversation
  const { data: existing } = await sb
    .from('conversation_participants')
    .select('conversation_id, conversations!inner(id)')
    .eq('user_id', input.tenant_id as string)
    .limit(1)
    .maybeSingle();

  let convId: string;
  if (existing) {
    convId = (existing as any).conversation_id;
  } else {
    const { data: conv } = await sb.from('conversations').insert({ conversation_type: 'direct', title: 'Direct Message' }).select('id').single();
    convId = (conv as any).id;
    await sb.from('conversation_participants').insert([
      { conversation_id: convId, user_id: userId },
      { conversation_id: convId, user_id: input.tenant_id as string },
    ]);
  }

  const { error: msgErr } = await sb.from('messages').insert({ conversation_id: convId, sender_id: userId, content: input.content as string, content_type: 'text', status: 'sent' });
  if (msgErr) return { success: false, error: msgErr.message };
  return { success: true, data: { conversation_id: convId, channel: 'in_app' } };
}

export async function handle_create_conversation(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: conv, error } = await sb
    .from('conversations')
    .insert({
      property_id: (input.property_id as string) || null,
      conversation_type: 'direct',
      title: (input.subject as string) || null,
    })
    .select('id')
    .single();
  if (error) return { success: false, error: error.message };

  const participants = [userId, ...(input.participant_ids as string[])];
  await sb.from('conversation_participants').insert(
    participants.map(uid => ({ conversation_id: (conv as any).id, user_id: uid }))
  );

  if (input.initial_message) {
    await sb.from('messages').insert({ conversation_id: (conv as any).id, sender_id: userId, content: input.initial_message as string, content_type: 'text', status: 'sent' });
  }

  return { success: true, data: { conversation_id: (conv as any).id, participants: participants.length } };
}

export async function handle_send_in_app_message(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // Verify participant
  const { data: p } = await sb.from('conversation_participants').select('id').eq('conversation_id', input.conversation_id as string).eq('user_id', userId).single();
  if (!p) return { success: false, error: 'Not a participant in this conversation' };

  const { data, error } = await sb
    .from('messages')
    .insert({ conversation_id: input.conversation_id as string, sender_id: userId, content: input.content as string, content_type: 'text', status: 'sent' })
    .select('id, content, created_at')
    .single();

  if (error) return { success: false, error: error.message };

  // Update conversation last_message
  await sb.from('conversations').update({ last_message_at: new Date().toISOString(), last_message_preview: (input.content as string).substring(0, 100) }).eq('id', input.conversation_id as string);

  return { success: true, data };
}

export async function handle_send_rent_reminder(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: tenancy, error: tErr } = await sb
    .from('tenancies')
    .select(`id, rent_amount, rent_frequency,
      properties!inner(address_line_1, suburb, state, owner_id, profiles:owner_id(full_name)),
      tenancy_tenants(tenant_id, profiles:tenant_id(full_name, email))`)
    .eq('id', input.tenancy_id as string)
    .eq('properties.owner_id', userId)
    .single();

  if (tErr || !tenancy) return { success: false, error: 'Tenancy not found or access denied' };

  const tenantInfo = (tenancy as any).tenancy_tenants?.[0]?.profiles;
  if (!tenantInfo?.email) return { success: false, error: 'Tenant email not found' };

  const { data: overdue } = await sb.from('rent_schedules').select('amount, due_date').eq('tenancy_id', input.tenancy_id as string).eq('is_paid', false).lt('due_date', new Date().toISOString().split('T')[0]);
  const totalOverdue = (overdue || []).reduce((sum: number, s: any) => sum + (s.amount || 0), 0);

  const property = (tenancy as any).properties;
  const address = [property.address_line_1, property.suburb, property.state].filter(Boolean).join(', ');

  const { error: emailErr } = await sb.from('email_queue').insert({
    to_email: tenantInfo.email, to_name: tenantInfo.full_name,
    subject: `Rent Payment Reminder - ${address}`, template_name: 'rent_reminder',
    template_data: { tenant_name: tenantInfo.full_name, property_address: address, amount: `$${(totalOverdue / 100).toFixed(2)}`, custom_message: input.message || '' },
    status: 'pending',
  });
  if (emailErr) return { success: false, error: emailErr.message };
  return { success: true, data: { sent_to: tenantInfo.email, tenant_name: tenantInfo.full_name, total_overdue: totalOverdue / 100, property_address: address } };
}

export async function handle_send_breach_notice(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyTenancyOwnership(input.tenancy_id as string, userId, sb))
    return { success: false, error: 'Tenancy not found or access denied' };

  // Record the breach notice document
  const { data: doc, error } = await sb
    .from('tenancy_documents')
    .insert({
      tenancy_id: input.tenancy_id as string,
      document_type: 'notice_to_leave',
      title: `Breach Notice - ${input.breach_type}`,
      uploaded_by: userId,
    })
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: {
      document_id: (doc as any).id,
      breach_type: input.breach_type,
      state: input.state,
      details: input.details,
      instruction: `Generate a ${input.state} state-compliant breach notice for "${input.breach_type}". Details: ${input.details}. Include the relevant legislation references and notice periods for ${input.state}.`,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAINTENANCE
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_create_maintenance(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyPropertyOwnership(input.property_id as string, userId, sb))
    return { success: false, error: 'Property not found or access denied' };

  const { data, error } = await sb
    .from('maintenance_requests')
    .insert({
      property_id: input.property_id as string,
      category: input.category as string,
      urgency: input.urgency as string,
      title: input.title as string,
      description: (input.description as string) || '',
      status: 'submitted',
    })
    .select('id, title, category, urgency, status, created_at')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_update_maintenance_status(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: req } = await sb.from('maintenance_requests').select('id, status, properties!inner(owner_id)').eq('id', input.request_id as string).eq('properties.owner_id', userId).single();
  if (!req) return { success: false, error: 'Request not found or access denied' };

  const oldStatus = (req as any).status;
  const { error } = await sb.from('maintenance_requests').update({
    status: input.status as string,
    status_changed_at: new Date().toISOString(),
    status_changed_by: userId,
    ...(input.notes ? { resolution_notes: input.notes } : {}),
  }).eq('id', input.request_id as string);

  if (error) return { success: false, error: error.message };

  // Log status change
  await sb.from('maintenance_status_history').insert({ request_id: input.request_id, old_status: oldStatus, new_status: input.status, changed_by: userId, notes: input.notes || null });

  return { success: true, data: { request_id: input.request_id, old_status: oldStatus, new_status: input.status } };
}

export async function handle_add_maintenance_comment(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await sb
    .from('maintenance_comments')
    .insert({ request_id: input.request_id as string, author_id: userId, content: input.content as string, is_internal: (input.is_internal as boolean) || false })
    .select('id, content, is_internal, created_at')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_record_maintenance_cost(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const updates: any = {};
  if (input.estimated_cost !== undefined) updates.estimated_cost = input.estimated_cost;
  if (input.actual_cost !== undefined) updates.actual_cost = input.actual_cost;
  if (input.cost_responsibility) updates.cost_responsibility = input.cost_responsibility;

  const { data, error } = await sb
    .from('maintenance_requests')
    .update(updates)
    .eq('id', input.request_id as string)
    .select('id, estimated_cost, actual_cost, cost_responsibility')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// ═══════════════════════════════════════════════════════════════════════════
// INSPECTIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_schedule_inspection(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyPropertyOwnership(input.property_id as string, userId, sb))
    return { success: false, error: 'Property not found or access denied' };

  const { data, error } = await sb
    .from('inspections')
    .insert({
      property_id: input.property_id as string,
      inspector_id: userId,
      inspection_type: input.type as string,
      scheduled_date: input.preferred_date as string,
      status: 'scheduled',
    })
    .select('id, property_id, inspection_type, scheduled_date, status')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_cancel_inspection(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await sb
    .from('inspections')
    .update({ status: 'cancelled', summary_notes: input.reason || 'Cancelled' })
    .eq('id', input.inspection_id as string)
    .eq('properties.owner_id', userId)
    .select('id, status')
    .single();

  // Fallback if join filter doesn't work
  if (error) {
    const { error: e2 } = await sb.from('inspections').update({ status: 'cancelled', summary_notes: input.reason || 'Cancelled' }).eq('id', input.inspection_id as string);
    if (e2) return { success: false, error: e2.message };
  }
  return { success: true, data: { inspection_id: input.inspection_id, status: 'cancelled' } };
}

export async function handle_record_inspection_finding(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // Verify the inspection belongs to the user via property ownership
  const { data: inspection } = await sb
    .from('inspections')
    .select('id, property_id, status, properties!inner(owner_id)')
    .eq('id', input.inspection_id as string)
    .single();

  if (!inspection || (inspection as any).properties?.owner_id !== userId)
    return { success: false, error: 'Inspection not found or access denied' };

  if ((inspection as any).status !== 'in_progress')
    return { success: false, error: 'Inspection must be in progress to record findings' };

  const updates: Record<string, unknown> = {
    condition: input.condition as string,
    notes: (input.notes as string) || null,
    action_required: (input.action_required as boolean) || false,
    checked_at: new Date().toISOString(),
  };

  if (input.action_required) {
    updates.action_description = (input.notes as string) || null;
  }
  if (input.estimated_cost !== undefined) {
    updates.estimated_cost = input.estimated_cost as number;
  }

  const { data, error } = await sb
    .from('inspection_items')
    .update(updates)
    .eq('id', input.item_id as string)
    .select('id, name, condition, notes, action_required, estimated_cost, checked_at')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_submit_inspection_to_tenant(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // Verify ownership
  const { data: inspection } = await sb
    .from('inspections')
    .select('id, property_id, status, tenancy_id, properties!inner(owner_id)')
    .eq('id', input.inspection_id as string)
    .single();

  if (!inspection || (inspection as any).properties?.owner_id !== userId)
    return { success: false, error: 'Inspection not found or access denied' };

  if ((inspection as any).status !== 'completed' && (inspection as any).status !== 'in_progress')
    return { success: false, error: 'Inspection must be completed before sending for review' };

  // First mark as completed if still in_progress, then move to tenant_review
  const { data, error } = await sb
    .from('inspections')
    .update({
      status: 'tenant_review',
      completed_at: (inspection as any).status === 'in_progress' ? new Date().toISOString() : undefined,
    })
    .eq('id', input.inspection_id as string)
    .select('id, status, tenancy_id')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: { ...data, message: input.message || 'Inspection submitted for tenant review' } };
}

export async function handle_finalize_inspection(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // Verify ownership
  const { data: inspection } = await sb
    .from('inspections')
    .select('id, property_id, status, properties!inner(owner_id)')
    .eq('id', input.inspection_id as string)
    .single();

  if (!inspection || (inspection as any).properties?.owner_id !== userId)
    return { success: false, error: 'Inspection not found or access denied' };

  const status = (inspection as any).status;
  if (status !== 'tenant_review' && status !== 'completed' && status !== 'disputed')
    return { success: false, error: 'Inspection must be in review, completed, or disputed to finalize' };

  const { data, error } = await sb
    .from('inspections')
    .update({ status: 'finalized' })
    .eq('id', input.inspection_id as string)
    .select('id, status')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// ═══════════════════════════════════════════════════════════════════════════
// WORK ORDERS & QUOTES
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_create_work_order(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // Get property from maintenance request
  const { data: req } = await sb.from('maintenance_requests').select('property_id, title, category, urgency, description').eq('id', input.request_id as string).single();
  if (!req) return { success: false, error: 'Maintenance request not found' };

  const { data, error } = await sb
    .from('work_orders')
    .insert({
      maintenance_request_id: input.request_id as string,
      property_id: (req as any).property_id,
      owner_id: userId,
      trade_id: input.trade_id as string,
      title: (req as any).title,
      description: input.scope as string,
      category: (req as any).category,
      urgency: (req as any).urgency,
      budget_max: input.budget as number,
      scheduled_date: (input.scheduled_date as string) || null,
      status: 'draft',
    })
    .select('id, title, trade_id, budget_max, status')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_update_work_order_status(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const updates: any = { status: input.status, status_changed_at: new Date().toISOString() };
  if (input.notes) updates.completion_notes = input.notes;
  if (input.actual_cost) updates.final_amount = input.actual_cost;

  const { data, error } = await sb
    .from('work_orders')
    .update(updates)
    .eq('id', input.work_order_id as string)
    .eq('owner_id', userId)
    .select('id, status, final_amount')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_approve_quote(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { error } = await sb
    .from('work_orders')
    .update({ status: 'approved', scheduled_date: input.preferred_schedule || null })
    .eq('id', input.quote_id as string)
    .eq('owner_id', userId);

  if (error) return { success: false, error: error.message };

  // Update maintenance request status
  if (input.request_id) {
    await sb.from('maintenance_requests').update({ status: 'approved' }).eq('id', input.request_id as string);
  }

  return { success: true, data: { quote_id: input.quote_id, status: 'approved' } };
}

export async function handle_reject_quote(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { error } = await sb
    .from('work_orders')
    .update({ status: 'cancelled', completion_notes: `Rejected: ${input.reason}` })
    .eq('id', input.quote_id as string)
    .eq('owner_id', userId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: { quote_id: input.quote_id, rejected: true, reason: input.reason } };
}

// ═══════════════════════════════════════════════════════════════════════════
// APPLICATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_accept_application(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: app } = await sb.from('applications').select('id, status, full_name, listings!inner(owner_id, property_id)').eq('id', input.application_id as string).eq('listings.owner_id', userId).single();
  if (!app) return { success: false, error: 'Application not found or access denied' };

  const s = (app as any).status;
  if (s !== 'shortlisted' && s !== 'under_review' && s !== 'submitted')
    return { success: false, error: `Cannot approve application in status: ${s}` };

  const { error } = await sb.from('applications').update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: userId }).eq('id', input.application_id as string);
  if (error) return { success: false, error: error.message };
  return { success: true, data: { application_id: input.application_id, applicant_name: (app as any).full_name, new_status: 'approved' } };
}

export async function handle_reject_application(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { error } = await sb
    .from('applications')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: userId, rejection_reason: input.reason as string })
    .eq('id', input.application_id as string);

  if (error) return { success: false, error: error.message };
  return { success: true, data: { application_id: input.application_id, new_status: 'rejected' } };
}

export async function handle_shortlist_application(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: app } = await sb.from('applications').select('id, status, listings!inner(owner_id)').eq('id', input.application_id as string).eq('listings.owner_id', userId).single();
  if (!app) return { success: false, error: 'Application not found or access denied' };

  const { error } = await sb.from('applications').update({ status: 'shortlisted', reviewed_at: new Date().toISOString(), reviewed_by: userId }).eq('id', input.application_id as string);
  if (error) return { success: false, error: error.message };
  return { success: true, data: { application_id: input.application_id, new_status: 'shortlisted' } };
}

// ═══════════════════════════════════════════════════════════════════════════
// ARREARS
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_create_payment_plan(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyTenancyOwnership(input.tenancy_id as string, userId, sb))
    return { success: false, error: 'Tenancy not found or access denied' };

  const totalInstallments = Math.ceil((input.total_arrears as number) / (input.installment_amount as number));
  const { data, error } = await sb
    .from('payment_plans')
    .insert({
      tenancy_id: input.tenancy_id as string,
      total_arrears: input.total_arrears as number,
      installment_amount: input.installment_amount as number,
      installment_frequency: 'weekly',
      start_date: (input.start_date as string) || new Date().toISOString().split('T')[0],
      total_installments: totalInstallments,
      amount_paid: 0,
      installments_paid: 0,
      status: 'active',
    })
    .select('id, total_arrears, installment_amount, total_installments, start_date, status')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_escalate_arrears(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyTenancyOwnership(input.tenancy_id as string, userId, sb))
    return { success: false, error: 'Tenancy not found or access denied' };

  // Find the active arrears record
  const { data: arrears } = await sb.from('arrears_records').select('id, severity').eq('tenancy_id', input.tenancy_id as string).eq('is_resolved', false).single();
  if (!arrears) return { success: false, error: 'No active arrears record found' };

  const { error } = await sb.from('arrears_records').update({ severity: input.next_level, updated_at: new Date().toISOString() }).eq('id', (arrears as any).id);
  if (error) return { success: false, error: error.message };

  // Log the escalation action
  await sb.from('arrears_actions').insert({
    arrears_record_id: (arrears as any).id,
    action_type: 'note',
    description: `Escalated from ${input.current_level} to ${input.next_level}`,
    performed_by: userId,
    is_automated: false,
  });

  return { success: true, data: { arrears_id: (arrears as any).id, previous_level: input.current_level, new_level: input.next_level } };
}

export async function handle_resolve_arrears(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { error } = await sb
    .from('arrears_records')
    .update({ is_resolved: true, resolved_at: new Date().toISOString(), resolved_reason: input.resolution_reason as string })
    .eq('id', input.arrears_id as string);

  if (error) return { success: false, error: error.message };
  return { success: true, data: { arrears_id: input.arrears_id, resolved: true } };
}

export async function handle_log_arrears_action(input: ToolInput, _userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await sb
    .from('arrears_actions')
    .insert({
      arrears_record_id: input.arrears_id as string,
      action_type: input.action_type as string,
      description: input.description as string,
      is_automated: false,
    })
    .select('id, action_type, description, created_at')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// ═══════════════════════════════════════════════════════════════════════════
// RENT INCREASES
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_create_rent_increase(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyTenancyOwnership(input.tenancy_id as string, userId, sb))
    return { success: false, error: 'Tenancy not found or access denied' };

  const { data: tenancy } = await sb.from('tenancies').select('rent_amount').eq('id', input.tenancy_id as string).single();
  const current = (tenancy as any)?.rent_amount || 0;
  const pct = current > 0 ? (((input.new_amount as number) - current) / current * 100) : 0;

  const { data, error } = await sb
    .from('rent_increases')
    .insert({
      tenancy_id: input.tenancy_id as string,
      current_amount: current,
      new_amount: input.new_amount as number,
      increase_percentage: Math.round(pct * 100) / 100,
      effective_date: input.effective_date as string,
      notice_date: new Date().toISOString().split('T')[0],
      justification: (input.reason as string) || null,
      status: 'draft',
    })
    .select('id, current_amount, new_amount, increase_percentage, effective_date, status')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_change_rent_amount(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  // This is the direct rent change (after notice period) — updates the tenancy
  if (!await verifyTenancyOwnership(input.tenancy_id as string, userId, sb))
    return { success: false, error: 'Tenancy not found or access denied' };

  const { data, error } = await sb
    .from('tenancies')
    .update({ rent_amount: input.new_amount as number, updated_at: new Date().toISOString() })
    .eq('id', input.tenancy_id as string)
    .select('id, rent_amount')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPLIANCE
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_record_compliance(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyPropertyOwnership(input.property_id as string, userId, sb))
    return { success: false, error: 'Property not found or access denied' };

  // Record as an inspection with compliance type
  const { data, error } = await sb
    .from('inspections')
    .insert({
      property_id: input.property_id as string,
      inspector_id: userId,
      inspection_type: 'maintenance',
      scheduled_date: input.completed_date as string,
      actual_date: input.completed_date as string,
      status: 'completed',
      completed_at: new Date().toISOString(),
      summary_notes: `Compliance: ${input.compliance_type} completed. Next due: ${input.next_due_date || 'N/A'}`,
    })
    .select('id, inspection_type, actual_date, status, summary_notes')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// ═══════════════════════════════════════════════════════════════════════════
// TRADES
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_add_trade_to_network(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await sb
    .from('owner_trades')
    .upsert({ owner_id: userId, trade_id: input.trade_id as string, is_favorite: (input.is_favorite as boolean) || false, notes: (input.notes as string) || null }, { onConflict: 'owner_id,trade_id' })
    .select('id, trade_id, is_favorite')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_submit_trade_review(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await sb
    .from('trade_reviews')
    .insert({
      trade_id: input.trade_id as string,
      work_order_id: (input.work_order_id as string) || null,
      reviewer_id: userId,
      rating: input.rating as number,
      content: (input.review_text as string) || null,
      would_recommend: (input.would_recommend as boolean) ?? true,
    })
    .select('id, rating, content, would_recommend')
    .single();

  if (error) return { success: false, error: error.message };

  // Update trade average rating
  const { data: reviews } = await sb.from('trade_reviews').select('rating').eq('trade_id', input.trade_id as string);
  if (reviews && reviews.length > 0) {
    const avg = reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length;
    await sb.from('trades').update({ average_rating: Math.round(avg * 10) / 10, total_reviews: reviews.length }).eq('id', input.trade_id as string);
  }

  return { success: true, data };
}

export async function handle_invite_tenant(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyPropertyOwnership(input.property_id as string, userId, sb))
    return { success: false, error: 'Property not found or access denied' };

  // Create a connection code for the tenant
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data, error } = await sb
    .from('connection_codes')
    .insert({
      owner_id: userId,
      property_id: input.property_id as string,
      code,
      connection_type: 'tenancy',
      max_uses: 1,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      is_active: true,
      label: `Invitation for ${input.name || input.email}`,
    })
    .select('id, code, expires_at')
    .single();

  if (error) return { success: false, error: error.message };

  // Send invitation email
  await sb.from('email_queue').insert({
    to_email: input.email as string,
    to_name: (input.name as string) || '',
    subject: 'You have been invited to connect on Casa',
    template_name: 'tenant_invitation',
    template_data: { tenant_name: input.name || '', code, property_id: input.property_id },
    status: 'pending',
  });

  return { success: true, data: { connection_code: code, email: input.email, expires_at: (data as any).expires_at } };
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_process_payment(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyTenancyOwnership(input.tenancy_id as string, userId, sb))
    return { success: false, error: 'Tenancy not found or access denied' };

  const { data, error } = await sb
    .from('payments')
    .insert({
      tenancy_id: input.tenancy_id as string,
      payment_type: 'rent',
      amount: input.amount as number,
      currency: 'AUD',
      description: (input.description as string) || 'Rent payment',
      status: 'pending',
    })
    .select('id, amount, status, created_at')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_lodge_bond(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyTenancyOwnership(input.tenancy_id as string, userId, sb))
    return { success: false, error: 'Tenancy not found or access denied' };

  const { data, error } = await sb
    .from('bond_lodgements')
    .insert({
      tenancy_id: input.tenancy_id as string,
      state: input.state as string,
      amount: input.amount as number,
      status: 'pending',
    })
    .select('id, amount, state, status')
    .single();

  if (error) return { success: false, error: error.message };

  // Update tenancy bond status
  await sb.from('tenancies').update({ bond_status: 'pending', bond_amount: input.amount }).eq('id', input.tenancy_id as string);

  return { success: true, data };
}

// ═══════════════════════════════════════════════════════════════════════════
// RECEIPTS & PAYMENT TOOLS
// ═══════════════════════════════════════════════════════════════════════════

export async function handle_send_receipt(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: payment, error: payErr } = await sb
    .from('payments')
    .select('id, amount, payment_date, tenancy_id')
    .eq('id', input.payment_id as string)
    .single();

  if (payErr || !payment) return { success: false, error: 'Payment not found or access denied' };

  const { data, error } = await sb
    .from('notifications')
    .insert({
      user_id: input.tenant_id as string,
      type: 'payment_receipt',
      title: 'Payment Receipt',
      body: `Receipt for payment of $${payment.amount} on ${payment.payment_date}`,
      data: { payment_id: input.payment_id, amount: payment.amount },
      channel: 'push',
    })
    .select('id, type, title')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: { receipt_sent: true, ...data } };
}

export async function handle_retry_payment(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: payment, error: payErr } = await sb
    .from('payments')
    .select('id, status, amount, tenancy_id')
    .eq('id', input.payment_id as string)
    .in('status', ['failed', 'declined'])
    .single();

  if (payErr || !payment) return { success: false, error: 'Payment not found, not retryable, or access denied' };

  const { data, error } = await sb
    .from('payments')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', input.payment_id as string)
    .select('id, status, amount')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_claim_bond(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyTenancyOwnership(input.tenancy_id as string, userId, sb))
    return { success: false, error: 'Tenancy not found or access denied' };

  const { data, error } = await sb
    .from('bond_lodgements')
    .update({
      status: 'claim_submitted',
      claim_amount: input.claim_amount as number,
      claim_reason: input.reason as string,
      claim_submitted_at: new Date().toISOString(),
    })
    .eq('tenancy_id', input.tenancy_id as string)
    .eq('status', 'lodged')
    .select('id, amount, claim_amount, status')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_update_autopay(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  if (!await verifyTenancyOwnership(input.tenancy_id as string, userId, sb))
    return { success: false, error: 'Tenancy not found or access denied' };

  const { data, error } = await sb
    .from('tenancies')
    .update({
      autopay_enabled: input.enabled as boolean,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.tenancy_id as string)
    .select('id, autopay_enabled')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function handle_cancel_rent_increase(input: ToolInput, userId: string, sb: SupabaseClient): Promise<ToolResult> {
  const { data: increase, error: fetchErr } = await sb
    .from('rent_increases')
    .select('id, tenancy_id, status')
    .eq('id', input.rent_increase_id as string)
    .in('status', ['pending', 'notified'])
    .single();

  if (fetchErr || !increase) return { success: false, error: 'Rent increase not found or cannot be cancelled' };

  if (!await verifyTenancyOwnership(increase.tenancy_id, userId, sb))
    return { success: false, error: 'Tenancy not found or access denied' };

  const { data, error } = await sb
    .from('rent_increases')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: (input.reason as string) || 'Cancelled by owner',
    })
    .eq('id', input.rent_increase_id as string)
    .select('id, status, cancellation_reason')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}
