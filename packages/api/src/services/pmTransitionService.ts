// PM Transition Message Service
// Mission 12: In-App Communications
// Handles the 3-message welcome sequence when an owner takes over from a PM

import { getSupabaseClient } from '../client';
import type { MessageTemplateRow } from '../types/database';

export interface PMTransitionParams {
  ownerId: string;
  tenantId: string;
  propertyId: string;
  tenantName: string;
  propertyAddress: string;
  weeklyRent: number;
  conversationId?: string;
}

/**
 * Render a template string with variable substitution.
 * Variables are in {{variable_name}} format.
 */
function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);
}

/**
 * Initiate the PM transition welcome message sequence.
 *
 * Sequence:
 * 1. Immediate: Welcome message introducing the owner
 * 2. +24 hours: Rent setup instructions
 * 3. +48 hours: Maintenance guide
 */
export async function initiatePMTransitionSequence(params: PMTransitionParams): Promise<{
  conversationId: string;
  scheduledMessageIds: string[];
}> {
  const supabase = getSupabaseClient();
  const { ownerId, tenantId, propertyId, tenantName, propertyAddress, weeklyRent } = params;

  // Template variables
  const variables: Record<string, string> = {
    tenant_name: tenantName.split(' ')[0],
    property_address: propertyAddress,
    rent_amount: weeklyRent.toFixed(0),
  };

  // Fetch PM transition templates
  const { data: templates, error: templateError } = await (supabase
    .from('message_templates') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('category', 'pm_transition')
    .order('created_at', { ascending: true });

  if (templateError) throw templateError;

  const templateList = (templates || []) as MessageTemplateRow[];

  const welcomeTemplate = templateList.find(t => t.name.includes('Welcome'));
  const rentTemplate = templateList.find(t => t.name.includes('Rent'));
  const maintenanceTemplate = templateList.find(t => t.name.includes('Maintenance'));

  if (!welcomeTemplate || !rentTemplate || !maintenanceTemplate) {
    throw new Error('PM transition templates not found in database');
  }

  // Create or get existing conversation
  let conversationId: string | undefined = params.conversationId;

  if (!conversationId) {
    // Check for existing direct conversation
    const { data: myConvs } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', ownerId)
      .eq('is_active', true);

    if (myConvs && myConvs.length > 0) {
      const myConvIds = myConvs.map((c: any) => c.conversation_id);

      const { data: sharedConvs } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', tenantId)
        .eq('is_active', true)
        .in('conversation_id', myConvIds);

      if (sharedConvs && sharedConvs.length > 0) {
        const sharedIds = sharedConvs.map((c: any) => c.conversation_id);
        const { data: existingDirect } = await (supabase
          .from('conversations') as ReturnType<typeof supabase.from>)
          .select('id')
          .in('id', sharedIds)
          .eq('conversation_type', 'direct')
          .limit(1);

        if (existingDirect && existingDirect.length > 0) {
          conversationId = (existingDirect[0] as any).id;
        }
      }
    }

    // Create new conversation if none exists
    if (!conversationId) {
      const { data: convData, error: convError } = await (supabase
        .from('conversations') as ReturnType<typeof supabase.from>)
        .insert({
          conversation_type: 'direct',
          property_id: propertyId,
          title: null,
        })
        .select('id')
        .single();

      if (convError) throw convError;
      conversationId = (convData as any).id;

      // Add participants
      await (supabase
        .from('conversation_participants') as ReturnType<typeof supabase.from>)
        .insert([
          { conversation_id: conversationId, user_id: ownerId },
          { conversation_id: conversationId, user_id: tenantId },
        ]);
    }
  }

  if (!conversationId) {
    throw new Error('Failed to create or find conversation');
  }

  // 1. Send welcome message immediately
  const welcomeContent = renderTemplate(welcomeTemplate.content, variables);
  const { error: sendError } = await (supabase
    .from('messages') as ReturnType<typeof supabase.from>)
    .insert({
      conversation_id: conversationId,
      sender_id: ownerId,
      content: welcomeContent,
      content_type: 'text',
      status: 'sent',
      metadata: { pm_transition: true, template_id: welcomeTemplate.id, step: 1 },
    });

  if (sendError) throw sendError;

  // Increment template usage
  await (supabase
    .from('message_templates') as ReturnType<typeof supabase.from>)
    .update({ usage_count: (welcomeTemplate.usage_count || 0) + 1 })
    .eq('id', welcomeTemplate.id);

  // 2. Schedule rent setup message for +24 hours
  const now = new Date();
  const rentScheduled = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const maintenanceScheduled = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const rentContent = renderTemplate(rentTemplate.content, variables);
  const maintenanceContent = renderTemplate(maintenanceTemplate.content, variables);

  const scheduledMessageIds: string[] = [];

  const { data: rentScheduledMsg, error: rentScheduleError } = await (supabase
    .from('scheduled_messages') as ReturnType<typeof supabase.from>)
    .insert({
      conversation_id: conversationId,
      sender_id: ownerId,
      content: rentContent,
      scheduled_for: rentScheduled.toISOString(),
      template_id: rentTemplate.id,
      metadata: { pm_transition: true, step: 2 },
    })
    .select('id')
    .single();

  if (rentScheduleError) throw rentScheduleError;
  scheduledMessageIds.push((rentScheduledMsg as any).id);

  // 3. Schedule maintenance intro for +48 hours
  const { data: maintenanceScheduledMsg, error: maintenanceScheduleError } = await (supabase
    .from('scheduled_messages') as ReturnType<typeof supabase.from>)
    .insert({
      conversation_id: conversationId,
      sender_id: ownerId,
      content: maintenanceContent,
      scheduled_for: maintenanceScheduled.toISOString(),
      template_id: maintenanceTemplate.id,
      metadata: { pm_transition: true, step: 3 },
    })
    .select('id')
    .single();

  if (maintenanceScheduleError) throw maintenanceScheduleError;
  scheduledMessageIds.push((maintenanceScheduledMsg as any).id);

  return {
    conversationId,
    scheduledMessageIds,
  };
}

/**
 * Cancel pending scheduled messages for a PM transition.
 */
export async function cancelPMTransitionSequence(conversationId: string): Promise<void> {
  const supabase = getSupabaseClient();

  await (supabase
    .from('scheduled_messages') as ReturnType<typeof supabase.from>)
    .update({ cancelled_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .is('sent_at', null)
    .is('cancelled_at', null);
}
