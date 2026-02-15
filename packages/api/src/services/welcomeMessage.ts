// Welcome Message Service - WP9.1 & WP9.2
// Inserts a proactive AI welcome message into agent_conversations / agent_messages
// after owner onboarding or tenant connection.

import { getSupabaseClient } from '../client';

const OWNER_WELCOME_TITLE = 'Welcome to Casa';
const TENANT_WELCOME_TITLE = 'Welcome to Casa';

/**
 * Check whether a welcome conversation already exists for a user.
 * We identify welcome conversations by their title prefix so we never
 * send a duplicate.
 */
async function hasExistingWelcome(userId: string, title: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data } = await (supabase
    .from('agent_conversations') as ReturnType<typeof supabase.from>)
    .select('id')
    .eq('user_id', userId)
    .eq('title', title)
    .limit(1);

  return (data ?? []).length > 0;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Delay helper for retry backoff.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Insert a welcome conversation + assistant message for a user.
 * Retries up to 3 times with exponential backoff.
 * Returns the conversation ID on success, or null if skipped / failed.
 */
async function insertWelcome(
  userId: string,
  title: string,
  messageContent: string,
  propertyId?: string,
): Promise<string | null> {
  // Deduplication: skip if the user already has a welcome conversation
  try {
    if (await hasExistingWelcome(userId, title)) {
      return null;
    }
  } catch {
    // If dedup check fails, proceed anyway — insertWelcome is best-effort
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const supabase = getSupabaseClient();

      // Create conversation
      const { data: conversation, error: convError } = await (supabase
        .from('agent_conversations') as ReturnType<typeof supabase.from>)
        .insert({
          user_id: userId,
          property_id: propertyId ?? null,
          title,
          status: 'active',
          is_active: true,
        })
        .select('id')
        .single();

      if (convError || !conversation) {
        throw new Error(convError?.message || 'Failed to create conversation');
      }

      const conversationId = (conversation as { id: string }).id;

      // Insert the assistant welcome message
      const { error: msgError } = await (supabase
        .from('agent_messages') as ReturnType<typeof supabase.from>)
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: messageContent,
        });

      if (msgError) {
        throw new Error(msgError.message);
      }

      return conversationId;
    } catch (err) {
      console.warn(`[welcomeMessage] Attempt ${attempt}/${MAX_RETRIES} failed:`, err instanceof Error ? err.message : err);
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * attempt);
      }
    }
  }

  // All retries exhausted — insert static fallback
  console.warn('[welcomeMessage] All retries failed, inserting static fallback');
  try {
    const supabase = getSupabaseClient();
    const fallbackContent =
      'Welcome to Casa! I\'m your AI property manager. I can help with rent collection, maintenance, compliance, inspections, documents, and financials. Just send me a message anytime.';

    const { data: conv, error: convErr } = await (supabase
      .from('agent_conversations') as ReturnType<typeof supabase.from>)
      .insert({
        user_id: userId,
        property_id: propertyId ?? null,
        title,
        status: 'active',
        is_active: true,
      })
      .select('id')
      .single();

    if (convErr || !conv) return null;

    const convId = (conv as { id: string }).id;
    await (supabase
      .from('agent_messages') as ReturnType<typeof supabase.from>)
      .insert({
        conversation_id: convId,
        role: 'assistant',
        content: fallbackContent,
      });

    return convId;
  } catch {
    console.warn('[welcomeMessage] Static fallback also failed');
    return null;
  }
}

/**
 * Send an owner welcome message after onboarding / first property creation.
 *
 * @param userId - The owner's user ID
 * @param propertyAddress - Optional address string for the property (e.g. "123 Main St, Sydney")
 * @param propertyId - Optional property UUID to link the conversation
 */
export async function sendOwnerWelcomeMessage(
  userId: string,
  propertyAddress?: string,
  propertyId?: string,
): Promise<string | null> {
  const addressPart = propertyAddress
    ? ` I'll help you manage ${propertyAddress}`
    : " I'll help you manage your properties";

  const content =
    `Welcome to Casa! I'm your AI property manager.${addressPart} \u2014 from rent collection and maintenance to compliance and inspections.\n\n` +
    `Here's what I can help with right away:\n\n` +
    `\u2022 **Rent collection** \u2014 Track payments, send reminders, and manage arrears\n` +
    `\u2022 **Maintenance** \u2014 Log requests, find tradespeople, and track repairs\n` +
    `\u2022 **Compliance** \u2014 Stay on top of smoke alarms, gas checks, and state regulations\n` +
    `\u2022 **Inspections** \u2014 Schedule routine inspections and generate reports\n` +
    `\u2022 **Documents** \u2014 Store leases, generate notices, and manage paperwork\n` +
    `\u2022 **Financials** \u2014 View income, expenses, and generate tax reports\n\n` +
    `Just send me a message anytime \u2014 I'm here 24/7.`;

  return insertWelcome(userId, OWNER_WELCOME_TITLE, content, propertyId);
}

/**
 * Send a tenant welcome message after connecting to a property via code.
 *
 * @param userId - The tenant's user ID
 * @param tenantName - The tenant's display name (or null)
 * @param propertyAddress - Optional address string for the property
 * @param propertyId - Optional property UUID to link the conversation
 */
export async function sendTenantWelcomeMessage(
  userId: string,
  tenantName?: string | null,
  propertyAddress?: string,
  propertyId?: string,
): Promise<string | null> {
  const greeting = tenantName ? `Hi ${tenantName}!` : 'Hi there!';
  const addressPart = propertyAddress
    ? ` for ${propertyAddress}`
    : '';

  const content =
    `${greeting} I'm Casa, your AI assistant${addressPart}. ` +
    `I can help you with:\n\n` +
    `\u2022 **Maintenance requests** \u2014 Report issues and track repairs\n` +
    `\u2022 **Payments** \u2014 View rent history and upcoming due dates\n` +
    `\u2022 **Documents** \u2014 Access your lease and important notices\n` +
    `\u2022 **Communication** \u2014 Get in touch with your landlord easily\n\n` +
    `Just send me a message anytime you need help.`;

  return insertWelcome(userId, TENANT_WELCOME_TITLE, content, propertyId);
}
