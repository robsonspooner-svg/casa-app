// Shared SendGrid client for Edge Functions
// Casa - Mission 05: Tenant Applications (Email Notifications)

export interface EmailParams {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
}

export async function sendEmail(params: EmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
  if (!sendgridApiKey) {
    console.error('SENDGRID_API_KEY is not set');
    return { success: false, error: 'Email service not configured' };
  }

  const fromEmail = Deno.env.get('SENDGRID_FROM_EMAIL') || 'noreply@casagroup.au';
  const fromName = Deno.env.get('SENDGRID_FROM_NAME') || 'Casa';

  const payload: any = {
    personalizations: [
      {
        to: [{ email: params.to, name: params.toName }],
      },
    ],
    from: { email: fromEmail, name: fromName },
    subject: params.subject,
  };

  // Use template or direct content
  if (params.templateId) {
    payload.template_id = params.templateId;
    payload.personalizations[0].dynamic_template_data = params.dynamicTemplateData;
  } else {
    payload.content = [
      { type: 'text/plain', value: params.textContent || params.htmlContent.replace(/<[^>]*>/g, '') },
      { type: 'text/html', value: params.htmlContent },
    ];
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok || response.status === 202) {
      const messageId = response.headers.get('X-Message-Id');
      return { success: true, messageId: messageId || undefined };
    } else {
      const errorBody = await response.text();
      console.error('SendGrid error:', response.status, errorBody);
      return { success: false, error: `SendGrid error: ${response.status}` };
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

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
