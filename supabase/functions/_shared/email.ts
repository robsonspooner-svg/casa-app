// Shared Resend email client for Edge Functions
// Casa - Email Notifications via Resend API (https://resend.com)
//
// Supports: CC, BCC, reply-to, file attachments, custom from address.
// Used by: send-email, send-document-email, dispatch-notification, process-email-queue,
//          agent tool handlers, and any Edge Function that sends email.

export interface EmailAttachment {
  filename: string;
  content: string;  // Base64-encoded content
  type?: string;    // MIME type (e.g. 'application/pdf', 'text/html')
}

export interface EmailParams {
  to: string | string[];
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
  fromName?: string;   // Override default sender name
  fromEmail?: string;  // Override default sender email
  /** Wrap htmlContent in the branded Casa email template with logo + footer.
   *  Default: false (caller is responsible for their own wrapper). */
  useBrandedWrapper?: boolean;
  /** Preheader text shown in email client previews */
  preheader?: string;
}

export async function sendEmail(params: EmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('RESEND_API_KEY is not set');
    return { success: false, error: 'Email service not configured' };
  }

  const fromEmail = params.fromEmail || Deno.env.get('EMAIL_FROM') || 'noreply@casaapp.com.au';
  const fromName = params.fromName || Deno.env.get('EMAIL_FROM_NAME') || 'Casa';

  // Normalise recipients to arrays
  const toRecipients = Array.isArray(params.to) ? params.to : [params.to];
  const ccRecipients = params.cc ? (Array.isArray(params.cc) ? params.cc : [params.cc]) : undefined;
  const bccRecipients = params.bcc ? (Array.isArray(params.bcc) ? params.bcc : [params.bcc]) : undefined;

  try {
    // Optionally wrap in branded template
    const finalHtml = params.useBrandedWrapper
      ? wrapInBrandedTemplate(params.htmlContent, { preheader: params.preheader })
      : params.htmlContent;

    const payload: Record<string, unknown> = {
      from: `${fromName} <${fromEmail}>`,
      to: toRecipients,
      subject: params.subject,
      html: finalHtml,
    };

    if (params.textContent) payload.text = params.textContent;
    if (ccRecipients?.length) payload.cc = ccRecipients;
    if (bccRecipients?.length) payload.bcc = bccRecipients;
    if (params.replyTo) payload.reply_to = params.replyTo;
    if (params.attachments?.length) payload.attachments = params.attachments;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, messageId: data.id || undefined };
    } else {
      const errorMessage = data.message || data.error || `Resend API error: ${response.status}`;
      console.error('Resend error:', response.status, errorMessage);
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BRANDED EMAIL WRAPPER — Premium email layout with Casa logo and footer
// ═══════════════════════════════════════════════════════════════════════════
//
// All system emails (notifications, document sharing, trade correspondence)
// should be wrapped in this layout for consistent branding.

// Casa logo as inline SVG data URI (navy wordmark)
const CASA_LOGO_URL = 'https://woxlvhzgannzhajtjnke.supabase.co/storage/v1/object/public/documents/casa-logo-email.png';

/**
 * Wrap any email body HTML in the branded Casa email template.
 * Includes header with logo, content area, and premium footer with
 * social proof, unsubscribe link, and company details.
 */
export function wrapInBrandedTemplate(bodyHtml: string, options?: {
  preheader?: string;      // Hidden preview text for email clients
  showAppLinks?: boolean;  // Show "Download the App" links (default: true)
  personaSignature?: string; // If provided, inserted before footer
}): string {
  const showAppLinks = options?.showAppLinks !== false;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Casa</title>
  ${options?.preheader ? `<span style="display:none !important;visibility:hidden;mso-hide:all;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${options.preheader}</span>` : ''}
</head>
<body style="margin: 0; padding: 0; background-color: #F5F2EB; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <!-- Outer container -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F2EB;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <!-- Inner container -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding: 0 0 24px 0;">
              <!--[if !mso]><!-->
              <img src="${CASA_LOGO_URL}" alt="Casa" width="100" height="32" style="display: block; width: 100px; height: auto;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
              <span style="display: none; font-family: 'Georgia', serif; font-size: 28px; font-weight: 700; color: #1B2B4B; letter-spacing: 2px;">CASA</span>
              <!--<![endif]-->
              <!--[if mso]>
              <span style="font-family: Georgia, serif; font-size: 28px; font-weight: 700; color: #1B2B4B; letter-spacing: 2px;">CASA</span>
              <![endif]-->
            </td>
          </tr>

          <!-- Main Content Card -->
          <tr>
            <td style="background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 32px 32px 24px 32px;">
                    ${bodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${options?.personaSignature ? `
          <!-- Persona Signature -->
          <tr>
            <td style="padding: 16px 0 0 0;">
              ${options.personaSignature}
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 0 0 0; text-align: center;">
              ${showAppLinks ? `
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 20px auto;">
                <tr>
                  <td style="padding: 0 8px;">
                    <a href="https://casaapp.com.au" style="display: inline-block; background: #1B2B4B; color: #FFFFFF; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600;">Open Casa App</a>
                  </td>
                </tr>
              </table>
              ` : ''}

              <p style="margin: 0 0 4px 0; color: #9CA3AF; font-size: 12px; line-height: 1.5;">
                Casa &mdash; Smart Property Management
              </p>
              <p style="margin: 0 0 4px 0; color: #9CA3AF; font-size: 11px; line-height: 1.5;">
                Replacing traditional property managers with intelligent technology.
              </p>
              <p style="margin: 16px 0 0 0; color: #D1D5DB; font-size: 11px; line-height: 1.5;">
                <a href="https://casaapp.com.au" style="color: #9CA3AF; text-decoration: underline;">casaapp.com.au</a>
                &nbsp;&bull;&nbsp;
                <a href="mailto:support@casaapp.com.au" style="color: #9CA3AF; text-decoration: underline;">support@casaapp.com.au</a>
              </p>
              <p style="margin: 8px 0 0 0; color: #D1D5DB; font-size: 10px;">
                &copy; ${new Date().getFullYear()} Casa Property Technology Pty Ltd. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL PERSONAS — Used when Casa AI needs to correspond as a real person
// ═══════════════════════════════════════════════════════════════════════════
//
// For trade negotiations and external correspondence, Casa AI uses personas
// so that tradespeople feel they're dealing with a real property coordinator.
// Persona emails use [name]@casaapp.com.au for reply-to and trade engagement.
// System notifications (arrears, connection codes, rent reminders) always use noreply@.
//
// IMPORTANT: Personas are NOT selectable by users. The system picks the
// appropriate persona based on the email context type. Users and tenants
// cannot request or influence which persona is used.

export interface EmailPersona {
  name: string;         // e.g. "Sarah Mitchell"
  role: string;         // e.g. "Property Coordinator"
  email: string;        // e.g. "sarah@casaapp.com.au"
  signatureHtml: string;
}

// Rotating persona pool — system picks deterministically based on owner_id hash
const PERSONAS: EmailPersona[] = [
  {
    name: 'Sarah Mitchell',
    role: 'Property Coordinator',
    email: 'sarah@casaapp.com.au',
    signatureHtml: `<div style="border-top: 1px solid #E5E5E5; padding-top: 16px; margin-top: 24px; font-family: -apple-system, sans-serif;">
      <p style="margin: 0; font-weight: 600; color: #1B2B4B;">Sarah Mitchell</p>
      <p style="margin: 2px 0; color: #6B7280; font-size: 13px;">Property Coordinator — Casa</p>
      <p style="margin: 2px 0; color: #6B7280; font-size: 13px;">sarah@casaapp.com.au</p>
    </div>`,
  },
  {
    name: 'James Cooper',
    role: 'Maintenance Coordinator',
    email: 'james@casaapp.com.au',
    signatureHtml: `<div style="border-top: 1px solid #E5E5E5; padding-top: 16px; margin-top: 24px; font-family: -apple-system, sans-serif;">
      <p style="margin: 0; font-weight: 600; color: #1B2B4B;">James Cooper</p>
      <p style="margin: 2px 0; color: #6B7280; font-size: 13px;">Maintenance Coordinator — Casa</p>
      <p style="margin: 2px 0; color: #6B7280; font-size: 13px;">james@casaapp.com.au</p>
    </div>`,
  },
  {
    name: 'Emma Taylor',
    role: 'Property Coordinator',
    email: 'emma@casaapp.com.au',
    signatureHtml: `<div style="border-top: 1px solid #E5E5E5; padding-top: 16px; margin-top: 24px; font-family: -apple-system, sans-serif;">
      <p style="margin: 0; font-weight: 600; color: #1B2B4B;">Emma Taylor</p>
      <p style="margin: 2px 0; color: #6B7280; font-size: 13px;">Property Coordinator — Casa</p>
      <p style="margin: 2px 0; color: #6B7280; font-size: 13px;">emma@casaapp.com.au</p>
    </div>`,
  },
  {
    name: 'Tom Gallagher',
    role: 'Maintenance Coordinator',
    email: 'tom@casaapp.com.au',
    signatureHtml: `<div style="border-top: 1px solid #E5E5E5; padding-top: 16px; margin-top: 24px; font-family: -apple-system, sans-serif;">
      <p style="margin: 0; font-weight: 600; color: #1B2B4B;">Tom Gallagher</p>
      <p style="margin: 2px 0; color: #6B7280; font-size: 13px;">Maintenance Coordinator — Casa</p>
      <p style="margin: 2px 0; color: #6B7280; font-size: 13px;">tom@casaapp.com.au</p>
    </div>`,
  },
];

/**
 * Get a deterministic persona for an owner. The same owner always gets the
 * same persona so trades see consistent names across correspondence.
 */
export function getPersonaForOwner(ownerId: string): EmailPersona {
  let hash = 0;
  for (let i = 0; i < ownerId.length; i++) {
    hash = ((hash << 5) - hash + ownerId.charCodeAt(i)) | 0;
  }
  return PERSONAS[Math.abs(hash) % PERSONAS.length];
}

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL CONTEXT TYPES — Security allowlist
// ═══════════════════════════════════════════════════════════════════════════
//
// Every email the agent sends MUST declare a context type. The context type
// determines: (a) which "from" address is used, (b) whether personas apply,
// (c) whether the email is allowed at all.
//
// Users CANNOT ask the agent to send arbitrary emails. The agent can only
// send emails that match one of these context types. If a user tries to get
// the agent to send an email that doesn't match a context type, the agent
// must refuse.

export type EmailContextType =
  // System notifications (noreply@casaapp.com.au)
  | 'rent_reminder'              // Automated rent due reminder
  | 'arrears_notice'             // Formal arrears escalation
  | 'payment_received'           // Payment confirmation
  | 'payment_receipt'            // Detailed receipt
  | 'connection_code'            // Tenant invitation code
  | 'tenant_welcome'             // Welcome email after connection
  | 'document_shared'            // Document sent to tenant
  | 'lease_for_signature'        // Lease sent for signing
  | 'inspection_notice'          // Inspection scheduled
  | 'maintenance_update'         // Maintenance status change
  | 'compliance_reminder'        // Compliance item due soon
  | 'lease_expiry_notice'        // Lease expiring warning
  | 'rent_increase_notice'       // Formal rent increase notification
  | 'application_update'         // Application status change
  | 'breach_notice'              // Formal breach notification
  // Trade correspondence (persona@casaapp.com.au — replies go to persona)
  | 'trade_quote_request'        // Requesting a quote from a trade
  | 'trade_negotiation'          // Negotiating price/scope with a trade
  | 'trade_work_order'           // Sending work order to a trade
  | 'trade_scheduling'           // Coordinating scheduling with a trade
  | 'trade_followup'             // Following up on outstanding work/quote
  // Owner-initiated (owner's email as reply-to, Casa as sender)
  | 'owner_to_tenant'            // Owner sends message via agent to tenant
  | 'owner_to_trade'             // Owner sends message via agent to trade
  ;

interface EmailContextConfig {
  fromEmail: string;
  fromName: string | 'persona';  // 'persona' means use getPersonaForOwner()
  requiresOwnerId: boolean;      // Must have an owner context to send
  requiresRecipientValidation: boolean; // Must validate recipient is in network
  allowedRecipientTypes: ('tenant' | 'owner' | 'trade' | 'self')[];
}

const EMAIL_CONTEXT_CONFIG: Record<EmailContextType, EmailContextConfig> = {
  // System notifications — noreply, no persona
  rent_reminder:        { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['tenant'] },
  arrears_notice:       { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['tenant'] },
  payment_received:     { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['owner', 'tenant'] },
  payment_receipt:      { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['tenant'] },
  connection_code:      { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa', requiresOwnerId: true, requiresRecipientValidation: false, allowedRecipientTypes: ['tenant'] },
  tenant_welcome:       { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['tenant'] },
  document_shared:      { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['tenant'] },
  lease_for_signature:  { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['tenant'] },
  inspection_notice:    { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['tenant'] },
  maintenance_update:   { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['tenant'] },
  compliance_reminder:  { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['owner'] },
  lease_expiry_notice:  { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['owner'] },
  rent_increase_notice: { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['tenant'] },
  application_update:   { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['tenant'] },
  breach_notice:        { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['tenant'] },
  // Trade correspondence — persona email, replies go to persona
  trade_quote_request:  { fromEmail: 'persona', fromName: 'persona', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['trade'] },
  trade_negotiation:    { fromEmail: 'persona', fromName: 'persona', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['trade'] },
  trade_work_order:     { fromEmail: 'persona', fromName: 'persona', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['trade'] },
  trade_scheduling:     { fromEmail: 'persona', fromName: 'persona', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['trade'] },
  trade_followup:       { fromEmail: 'persona', fromName: 'persona', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['trade'] },
  // Owner-initiated
  owner_to_tenant:      { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['tenant'] },
  owner_to_trade:       { fromEmail: 'persona', fromName: 'persona', requiresOwnerId: true, requiresRecipientValidation: true, allowedRecipientTypes: ['trade'] },
};

/**
 * Resolve the "from" address for an email context. For persona contexts,
 * returns the persona's email and name. For system contexts, returns noreply.
 */
export function resolveEmailSender(
  contextType: EmailContextType,
  ownerId?: string,
): { fromEmail: string; fromName: string; persona?: EmailPersona } {
  const config = EMAIL_CONTEXT_CONFIG[contextType];
  if (!config) {
    return { fromEmail: 'noreply@casaapp.com.au', fromName: 'Casa' };
  }

  if (config.fromEmail === 'persona' && ownerId) {
    const persona = getPersonaForOwner(ownerId);
    return { fromEmail: persona.email, fromName: persona.name, persona };
  }

  return {
    fromEmail: config.fromEmail,
    fromName: config.fromName === 'persona' ? 'Casa' : config.fromName,
  };
}

/**
 * Validate whether a given email context type is legitimate.
 * Returns the config if valid, null if not.
 */
export function getEmailContextConfig(contextType: string): EmailContextConfig | null {
  return EMAIL_CONTEXT_CONFIG[contextType as EmailContextType] || null;
}

/**
 * Check if an email context type exists in the allowlist.
 * Used by agent tool handlers to reject arbitrary email requests.
 */
export function isValidEmailContext(contextType: string): contextType is EmailContextType {
  return contextType in EMAIL_CONTEXT_CONFIG;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRADE NEGOTIATION SYSTEM PROMPTS
// ═══════════════════════════════════════════════════════════════════════════
//
// When Casa AI sends emails as a persona to trades, it follows these
// negotiation principles. These are NOT configurable by users.

export const TRADE_NEGOTIATION_PRINCIPLES = {
  systemPrompt: `You are a property maintenance coordinator working for a property management company called Casa. You manage a large portfolio of rental properties and regularly engage tradespeople for maintenance work.

NEGOTIATION PRINCIPLES:
- Always be professional, firm, and fair
- Get at least 2-3 quotes before committing to any job over $300
- Push back on quotes that seem inflated — ask for itemised breakdowns
- Mention that Casa manages many properties and can offer ongoing work for competitive pricing
- Be willing to walk away if prices are unreasonable — there are always other tradespeople
- For repeat tradespeople, negotiate volume discounts: "We have several properties and regular work"
- Never accept the first quote without questioning — even if it seems fair, ask if there's room for a small discount given ongoing relationship potential
- Time is money — if a trade can start sooner, that has value, but don't overpay for urgency on non-urgent jobs
- Keep records of market rates — if a plumber charged $180 for a similar job last month, use that as leverage
- Be skeptical of scope creep — if a trade says "while I'm there I should also..." get a separate quote
- For emergency work, accept reasonable rates but flag for post-job review

TONE:
- Professional and direct, not aggressive
- Friendly but business-like
- Show appreciation for good work and fair pricing
- Build long-term relationships with reliable, fairly-priced trades

EMAIL FORMAT:
- Keep emails concise and action-oriented
- Always include the property address and job description
- State expectations clearly (timeline, budget range if applicable)
- End with a clear call to action`,

  /** Get a negotiation-ready subject line */
  getSubject: (type: 'quote_request' | 'negotiation' | 'followup' | 'work_order', jobTitle: string, propertyAddress: string): string => {
    switch (type) {
      case 'quote_request': return `Quote Request: ${jobTitle} — ${propertyAddress}`;
      case 'negotiation': return `Re: Quote for ${jobTitle} — ${propertyAddress}`;
      case 'followup': return `Following Up: ${jobTitle} — ${propertyAddress}`;
      case 'work_order': return `Work Order: ${jobTitle} — ${propertyAddress}`;
    }
  },
};

// Email templates
export const EMAIL_TEMPLATES = {
  // Application notifications
  applicationReceived: (data: { ownerName: string; propertyAddress: string; applicantName: string; applicationUrl: string }) => ({
    subject: `New application received for ${data.propertyAddress}`,
    htmlContent: `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1B2B4B 0%, #0A1628 100%); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Application Received</h1>
        </div>
        <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            Hi ${data.ownerName},
          </p>
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            Great news! You've received a new rental application from <strong>${data.applicantName}</strong> for your property at:
          </p>
          <div style="background: white; padding: 16px; border-radius: 8px; margin: 24px 0;">
            <p style="color: #1B2B4B; font-size: 18px; font-weight: 600; margin: 0;">
              ${data.propertyAddress}
            </p>
          </div>
          <a href="${data.applicationUrl}" style="display: inline-block; background: #1B2B4B; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Review Application
          </a>
          <p style="color: #6B7280; font-size: 14px; margin-top: 32px;">
            Log in to Casa to review the full application, contact references, and make a decision.
          </p>
        </div>
      </div>
    `,
  }),

  applicationStatusUpdate: (data: { tenantName: string; propertyAddress: string; status: string; message?: string }) => ({
    subject: `Application update: ${data.status} - ${data.propertyAddress}`,
    htmlContent: `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1B2B4B 0%, #0A1628 100%); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Application Update</h1>
        </div>
        <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            Hi ${data.tenantName},
          </p>
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            Your rental application for <strong>${data.propertyAddress}</strong> has been updated.
          </p>
          <div style="background: white; padding: 16px; border-radius: 8px; margin: 24px 0; text-align: center;">
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 8px 0;">Status</p>
            <p style="color: #1B2B4B; font-size: 20px; font-weight: 600; margin: 0; text-transform: capitalize;">
              ${data.status.replace(/_/g, ' ')}
            </p>
          </div>
          ${data.message ? `
            <div style="background: white; padding: 16px; border-radius: 8px; margin: 24px 0;">
              <p style="color: #6B7280; font-size: 14px; margin: 0 0 8px 0;">Message from the owner:</p>
              <p style="color: #1B2B4B; font-size: 16px; margin: 0;">${data.message}</p>
            </div>
          ` : ''}
          <p style="color: #6B7280; font-size: 14px; margin-top: 32px;">
            Log in to Casa to view more details about your application.
          </p>
        </div>
      </div>
    `,
  }),

  // Payment notifications
  paymentReceived: (data: { ownerName: string; propertyAddress: string; amount: string; tenantName: string; paymentDate: string }) => ({
    subject: `Payment received: ${data.amount} for ${data.propertyAddress}`,
    htmlContent: `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1B2B4B 0%, #0A1628 100%); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Payment Received</h1>
        </div>
        <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            Hi ${data.ownerName},
          </p>
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            A rent payment has been received for your property.
          </p>
          <div style="background: white; padding: 24px; border-radius: 8px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #6B7280; padding: 8px 0;">Property</td>
                <td style="color: #1B2B4B; font-weight: 600; text-align: right; padding: 8px 0;">${data.propertyAddress}</td>
              </tr>
              <tr>
                <td style="color: #6B7280; padding: 8px 0;">Tenant</td>
                <td style="color: #1B2B4B; font-weight: 600; text-align: right; padding: 8px 0;">${data.tenantName}</td>
              </tr>
              <tr>
                <td style="color: #6B7280; padding: 8px 0;">Amount</td>
                <td style="color: #22C55E; font-weight: 600; text-align: right; padding: 8px 0; font-size: 20px;">${data.amount}</td>
              </tr>
              <tr>
                <td style="color: #6B7280; padding: 8px 0;">Date</td>
                <td style="color: #1B2B4B; font-weight: 600; text-align: right; padding: 8px 0;">${data.paymentDate}</td>
              </tr>
            </table>
          </div>
          <p style="color: #6B7280; font-size: 14px; margin-top: 32px;">
            The funds will be transferred to your bank account according to your payout schedule.
          </p>
        </div>
      </div>
    `,
  }),

  paymentReminder: (data: { tenantName: string; propertyAddress: string; amount: string; dueDate: string; paymentUrl: string }) => ({
    subject: `Rent reminder: ${data.amount} due ${data.dueDate}`,
    htmlContent: `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1B2B4B 0%, #0A1628 100%); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Rent Payment Reminder</h1>
        </div>
        <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            Hi ${data.tenantName},
          </p>
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            This is a friendly reminder that your rent payment is coming up.
          </p>
          <div style="background: white; padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center;">
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 8px 0;">${data.propertyAddress}</p>
            <p style="color: #1B2B4B; font-size: 32px; font-weight: 700; margin: 0;">${data.amount}</p>
            <p style="color: #6B7280; font-size: 14px; margin: 8px 0 0 0;">Due ${data.dueDate}</p>
          </div>
          <a href="${data.paymentUrl}" style="display: inline-block; background: #1B2B4B; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; width: 100%; text-align: center; box-sizing: border-box;">
            Pay Now
          </a>
          <p style="color: #6B7280; font-size: 14px; margin-top: 32px;">
            If you've set up auto-pay, this payment will be processed automatically.
          </p>
        </div>
      </div>
    `,
  }),

  // Document sharing
  documentShared: (data: { tenantName: string; ownerName: string; documentTitle: string; propertyAddress: string; documentType: string; actionRequired?: string }) => ({
    subject: `${data.ownerName} shared a document with you — ${data.documentTitle}`,
    htmlContent: `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1B2B4B 0%, #0A1628 100%); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Document Shared With You</h1>
        </div>
        <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            Hi ${data.tenantName},
          </p>
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            Your landlord <strong>${data.ownerName}</strong> has shared a document with you for your property at <strong>${data.propertyAddress}</strong>.
          </p>
          <div style="background: white; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #1B2B4B;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #6B7280; padding: 8px 0;">Document</td>
                <td style="color: #1B2B4B; font-weight: 600; text-align: right; padding: 8px 0;">${data.documentTitle}</td>
              </tr>
              <tr>
                <td style="color: #6B7280; padding: 8px 0;">Type</td>
                <td style="color: #1B2B4B; font-weight: 600; text-align: right; padding: 8px 0; text-transform: capitalize;">${data.documentType.replace(/_/g, ' ')}</td>
              </tr>
              ${data.actionRequired ? `
              <tr>
                <td style="color: #6B7280; padding: 8px 0;">Action Required</td>
                <td style="color: #F59E0B; font-weight: 600; text-align: right; padding: 8px 0;">${data.actionRequired}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          ${data.actionRequired ? `
          <div style="background: #FFF7ED; border: 1px solid #FDBA74; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="color: #9A3412; font-size: 14px; margin: 0; font-weight: 600;">
              ⚠️ ${data.actionRequired}
            </p>
          </div>
          ` : ''}
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            Open the Casa app to view and ${data.actionRequired ? 'sign' : 'review'} this document. A PDF copy is attached to this email for your records.
          </p>
          <p style="color: #6B7280; font-size: 14px; margin-top: 32px;">
            If you have any questions about this document, contact your landlord through the Casa app.
          </p>
        </div>
      </div>
    `,
  }),

  // Lease sent for signature
  leaseSentForSignature: (data: { tenantName: string; ownerName: string; propertyAddress: string; leaseStartDate: string; leaseEndDate: string; rentAmount: string; rentFrequency: string }) => ({
    subject: `Lease Agreement for ${data.propertyAddress} — Please Review & Sign`,
    htmlContent: `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1B2B4B 0%, #0A1628 100%); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Lease Agreement Ready for Signing</h1>
        </div>
        <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            Hi ${data.tenantName},
          </p>
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            Your landlord <strong>${data.ownerName}</strong> has prepared a lease agreement for your tenancy. Please review and sign the document in the Casa app.
          </p>
          <div style="background: white; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #1B2B4B;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #6B7280; padding: 8px 0;">Property</td>
                <td style="color: #1B2B4B; font-weight: 600; text-align: right; padding: 8px 0;">${data.propertyAddress}</td>
              </tr>
              <tr>
                <td style="color: #6B7280; padding: 8px 0;">Lease Period</td>
                <td style="color: #1B2B4B; font-weight: 600; text-align: right; padding: 8px 0;">${data.leaseStartDate} — ${data.leaseEndDate}</td>
              </tr>
              <tr>
                <td style="color: #6B7280; padding: 8px 0;">Rent</td>
                <td style="color: #1B2B4B; font-weight: 600; text-align: right; padding: 8px 0;">${data.rentAmount} ${data.rentFrequency}</td>
              </tr>
            </table>
          </div>
          <div style="background: #FFF7ED; border: 1px solid #FDBA74; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="color: #9A3412; font-size: 14px; margin: 0; font-weight: 600;">
              ⚠️ Your signature is required on this document
            </p>
          </div>
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            Open the Casa app to review and sign this lease. A PDF copy of the lease is attached to this email for your records.
          </p>
          <p style="color: #6B7280; font-size: 14px; margin-top: 32px;">
            If you have any questions about the lease terms, contact your landlord through the Casa app. Seek independent legal advice if required.
          </p>
        </div>
      </div>
    `,
  }),

  // Lease notifications
  leaseExpiringSoon: (data: { ownerName: string; propertyAddress: string; tenantName: string; expiryDate: string; daysRemaining: number }) => ({
    subject: `Lease expiring in ${data.daysRemaining} days - ${data.propertyAddress}`,
    htmlContent: `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Lease Expiring Soon</h1>
        </div>
        <div style="background: #f8f9fa; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            Hi ${data.ownerName},
          </p>
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            The lease for your property is expiring soon.
          </p>
          <div style="background: white; padding: 24px; border-radius: 8px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #6B7280; padding: 8px 0;">Property</td>
                <td style="color: #1B2B4B; font-weight: 600; text-align: right; padding: 8px 0;">${data.propertyAddress}</td>
              </tr>
              <tr>
                <td style="color: #6B7280; padding: 8px 0;">Tenant</td>
                <td style="color: #1B2B4B; font-weight: 600; text-align: right; padding: 8px 0;">${data.tenantName}</td>
              </tr>
              <tr>
                <td style="color: #6B7280; padding: 8px 0;">Expiry Date</td>
                <td style="color: #F59E0B; font-weight: 600; text-align: right; padding: 8px 0;">${data.expiryDate}</td>
              </tr>
              <tr>
                <td style="color: #6B7280; padding: 8px 0;">Days Remaining</td>
                <td style="color: #1B2B4B; font-weight: 600; text-align: right; padding: 8px 0;">${data.daysRemaining} days</td>
              </tr>
            </table>
          </div>
          <p style="color: #1B2B4B; font-size: 16px; line-height: 1.6;">
            Consider your options:
          </p>
          <ul style="color: #1B2B4B; font-size: 16px; line-height: 1.8;">
            <li>Renew the lease with a rent increase</li>
            <li>Convert to a periodic (month-to-month) tenancy</li>
            <li>End the tenancy and find new tenants</li>
          </ul>
          <p style="color: #6B7280; font-size: 14px; margin-top: 32px;">
            Log in to Casa to manage your tenancy and take action.
          </p>
        </div>
      </div>
    `,
  }),
};
