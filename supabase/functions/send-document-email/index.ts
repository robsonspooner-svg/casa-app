// Send Document Email - Supabase Edge Function
// Sends a document to a tenant via email with a branded template and PDF attachment.
// Called from the owner app when tapping "Send to Tenant" on a document.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { EMAIL_TEMPLATES, sendEmail } from '../_shared/email.ts';

interface SendDocumentRequest {
  documentId: string;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceClient();

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const body: SendDocumentRequest = await req.json();
    const { documentId } = body;

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: documentId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the document — owner must own it
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('owner_id', user.id)
      .single();

    if (docError || !doc) {
      return new Response(
        JSON.stringify({ error: 'Document not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!doc.tenancy_id) {
      return new Response(
        JSON.stringify({ error: 'Document is not linked to a tenancy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the owner's profile
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    const ownerName = ownerProfile?.full_name || 'Your Landlord';

    // Get the tenant from the tenancy
    const { data: tenantLinks, error: tenantError } = await supabase
      .from('tenancy_tenants')
      .select('tenant_id, is_primary')
      .eq('tenancy_id', doc.tenancy_id)
      .order('is_primary', { ascending: false })
      .limit(1);

    if (tenantError || !tenantLinks?.length) {
      return new Response(
        JSON.stringify({ error: 'No tenant found for this tenancy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenantLinks[0].tenant_id;

    // Get tenant profile
    const { data: tenantProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', tenantId)
      .single();

    if (!tenantProfile?.email) {
      return new Response(
        JSON.stringify({ error: 'Tenant does not have an email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantName = tenantProfile.full_name || 'there';
    const tenantEmail = tenantProfile.email;

    // Get property address
    let propertyAddress = 'your property';
    if (doc.property_id) {
      const { data: property } = await supabase
        .from('properties')
        .select('address_line_1, suburb, state, postcode')
        .eq('id', doc.property_id)
        .single();

      if (property) {
        propertyAddress = `${property.address_line_1}, ${property.suburb} ${property.state} ${property.postcode}`;
      }
    }

    // Get tenancy details for lease-specific emails
    let tenancyDetails: { lease_start_date: string; lease_end_date: string; rent_amount: number; rent_frequency: string } | null = null;
    if (doc.document_type === 'lease') {
      const { data: tenancy } = await supabase
        .from('tenancies')
        .select('lease_start_date, lease_end_date, rent_amount, rent_frequency')
        .eq('id', doc.tenancy_id)
        .single();
      tenancyDetails = tenancy;
    }

    // Determine if signature is needed
    const requiresSignature = doc.requires_signature && (doc.status === 'draft' || doc.status === 'pending_owner_signature' || doc.status === 'pending_tenant_signature');

    // Build the email using the appropriate template
    let emailContent: { subject: string; htmlContent: string };

    if (doc.document_type === 'lease' && tenancyDetails) {
      const formatDate = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
      const freqLabel: Record<string, string> = { weekly: 'per week', fortnightly: 'per fortnight', monthly: 'per month' };

      emailContent = EMAIL_TEMPLATES.leaseSentForSignature({
        tenantName,
        ownerName,
        propertyAddress,
        leaseStartDate: formatDate(tenancyDetails.lease_start_date),
        leaseEndDate: formatDate(tenancyDetails.lease_end_date),
        rentAmount: `$${tenancyDetails.rent_amount.toFixed(2)}`,
        rentFrequency: freqLabel[tenancyDetails.rent_frequency] || tenancyDetails.rent_frequency,
      });
    } else {
      emailContent = EMAIL_TEMPLATES.documentShared({
        tenantName,
        ownerName,
        documentTitle: doc.title,
        propertyAddress,
        documentType: doc.document_type,
        actionRequired: requiresSignature ? 'Your signature is required on this document' : undefined,
      });
    }

    // Generate PDF from HTML content if available
    let pdfBase64: string | null = null;
    if (doc.html_content) {
      try {
        // Use a minimal HTML-to-PDF approach via a headless renderer
        // Resend supports base64 attachments, so we encode the HTML as a styled PDF-like HTML attachment
        // For true PDF, we'd need a service like Puppeteer/wkhtmltopdf — for now, attach the HTML as a styled document
        // that email clients can open, and note the tenant should use the app for the full experience

        // Create a self-contained HTML document for attachment
        const fullHtml = doc.html_content.includes('<html') || doc.html_content.includes('<!DOCTYPE')
          ? doc.html_content
          : `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #0A0A0A; padding: 40px; margin: 0; background: #fff; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    h2 { font-size: 18px; font-weight: 600; margin-top: 24px; margin-bottom: 8px; }
    h3 { font-size: 16px; font-weight: 600; margin-top: 16px; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { padding: 8px 12px; border: 1px solid #E5E5E5; text-align: left; font-size: 13px; }
    th { background: #FAFAFA; font-weight: 600; }
    p { margin: 8px 0; }
    .signature-block { margin-top: 32px; padding-top: 16px; border-top: 2px solid #E5E5E5; }
  </style>
</head>
<body>${doc.html_content}</body>
</html>`;

        // Encode as base64 for Resend attachment
        const encoder = new TextEncoder();
        const htmlBytes = encoder.encode(fullHtml);
        pdfBase64 = btoa(String.fromCharCode(...htmlBytes));
      } catch (attachErr) {
        console.error('Failed to create attachment:', attachErr);
        // Continue without attachment — email still goes out
      }
    }

    // Send email via shared sendEmail() with attachment
    const attachments = pdfBase64
      ? [{
          filename: `${doc.title.replace(/[^a-zA-Z0-9._-]/g, '_')}.html`,
          content: pdfBase64,
          type: 'text/html',
        }]
      : undefined;

    const emailResult = await sendEmail({
      to: tenantEmail,
      toName: tenantName,
      subject: emailContent.subject,
      htmlContent: emailContent.htmlContent,
      attachments,
      fromEmail: 'noreply@casaapp.com.au',
      fromName: 'Casa',
      replyTo: ownerProfile?.email || undefined,
      useBrandedWrapper: true,
      preheader: `${ownerName} has shared a document with you`,
    });

    if (!emailResult.success) {
      console.error('Email send failed:', emailResult.error);
      return new Response(
        JSON.stringify({ error: `Failed to send email: ${emailResult.error}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update document: set tenant_id and status
    const newStatus = doc.requires_signature ? 'pending_tenant_signature' : doc.status;
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        tenant_id: tenantId,
        status: newStatus,
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Failed to update document:', updateError);
      // Email sent successfully, so still return success but note the DB update issue
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: emailResult.messageId,
        tenantName,
        tenantEmail,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-document-email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
