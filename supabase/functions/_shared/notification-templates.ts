// Notification Email Templates
// Casa - Mission 17: Notification Dispatch Service

const CASA_NAVY = '#1B1464';
const SUCCESS_GREEN = '#16A34A';
const WARNING_AMBER = '#D97706';
const DANGER_RED = '#DC2626';
const TEXT_PRIMARY = '#1B2B4B';
const TEXT_SECONDARY = '#6B7280';
const BG_LIGHT = '#F9FAFB';
const BG_WHITE = '#FFFFFF';

const BASE_URL = 'https://app.casagroup.au';

function unsubscribeFooter(userId?: string, notificationType?: string): string {
  if (!userId) return '';
  const unsubscribeUrl = `${BASE_URL}/api/unsubscribe?token=${encodeURIComponent(userId)}&type=${encodeURIComponent(notificationType || 'all')}`;
  const preferencesUrl = `${BASE_URL}/api/unsubscribe?token=${encodeURIComponent(userId)}&type=preferences`;
  return `<p style="font-size:12px;color:#9CA3AF;margin-top:16px;text-align:center;line-height:1.6;">
<a href="${unsubscribeUrl}" style="color:#9CA3AF;text-decoration:underline;">Unsubscribe from these notifications</a> |
<a href="${preferencesUrl}" style="color:#9CA3AF;text-decoration:underline;">Notification preferences</a></p>`;
}

function wrapInLayout(title: string, headerColour: string, content: string, userId?: string, notificationType?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:#EAEDF1;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EAEDF1;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,${headerColour} 0%,${CASA_NAVY} 100%);padding:32px;border-radius:12px 12px 0 0;">
<p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0 0 8px 0;letter-spacing:1px;text-transform:uppercase;">Casa</p>
<h1 style="color:${BG_WHITE};margin:0;font-size:22px;font-weight:600;line-height:1.3;">${title}</h1>
</td></tr>
<tr><td style="background:${BG_LIGHT};padding:32px;border-radius:0 0 12px 12px;">
${content}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:40px;border-top:1px solid #E5E7EB;padding-top:20px;"><tr><td>
<p style="color:${TEXT_SECONDARY};font-size:12px;margin:0;line-height:1.6;">This email was sent by Casa, your AI property management assistant.</p>
${unsubscribeFooter(userId, notificationType)}
<p style="color:#D1D5DB;font-size:11px;margin:12px 0 0 0;">Casa Property Management Pty Ltd | Australia</p>
</td></tr></table>
</td></tr>
</table></td></tr></table></body></html>`;
}

function infoCard(rows: Array<{ label: string; value: string; colour?: string }>): string {
  const rowsHtml = rows.map(row => `
    <tr><td style="color:${TEXT_SECONDARY};padding:10px 0;font-size:14px;border-bottom:1px solid #F3F4F6;">${row.label}</td>
    <td style="color:${row.colour || TEXT_PRIMARY};font-weight:600;text-align:right;padding:10px 0;font-size:14px;border-bottom:1px solid #F3F4F6;">${row.value}</td></tr>`).join('');
  return `<div style="background:${BG_WHITE};padding:20px 24px;border-radius:8px;margin:20px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rowsHtml}</table></div>`;
}

function ctaButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr>
    <td style="background:${CASA_NAVY};border-radius:8px;"><a href="${url}" style="display:inline-block;padding:14px 28px;color:${BG_WHITE};text-decoration:none;font-weight:600;font-size:15px;">${label}</a></td>
    </tr></table>`;
}

function greeting(name: string): string {
  return `<p style="color:${TEXT_PRIMARY};font-size:16px;line-height:1.6;margin:0 0 16px 0;">Hi ${name},</p>`;
}

function paragraph(text: string): string {
  return `<p style="color:${TEXT_PRIMARY};font-size:16px;line-height:1.6;margin:0 0 16px 0;">${text}</p>`;
}

interface TemplateResult {
  subject: string;
  htmlContent: string;
}

interface TemplateInner {
  subject: string;
  title: string;
  headerColour: string;
  content: string;
}

const TEMPLATE_MAP: Record<string, (data: Record<string, unknown>) => TemplateInner> = {
  payment_received: (data) => {
    const name = (data.owner_name as string) || 'there';
    const addr = (data.property_address as string) || 'your property';
    const amount = (data.amount as string) || '$0.00';
    const tenant = (data.tenant_name as string) || 'Your tenant';
    const content = [greeting(name), paragraph('A rent payment has been received.'),
      infoCard([{ label: 'Property', value: addr }, { label: 'Tenant', value: tenant }, { label: 'Amount', value: amount, colour: SUCCESS_GREEN }]),
      ctaButton('View Payment', 'casa://payments')].join('');
    return { subject: `Payment received: ${amount} for ${addr}`, title: 'Payment Received', headerColour: SUCCESS_GREEN, content };
  },
  payment_overdue: (data) => {
    const name = (data.tenant_name as string) || 'there';
    const addr = (data.property_address as string) || 'your property';
    const amount = (data.amount as string) || '$0.00';
    const days = (data.days_overdue as number) || 0;
    const content = [greeting(name), paragraph(`Your rent payment of <strong>${amount}</strong> is <strong>${days} days overdue</strong>.`),
      infoCard([{ label: 'Property', value: addr }, { label: 'Amount Due', value: amount, colour: DANGER_RED }, { label: 'Days Overdue', value: `${days}`, colour: DANGER_RED }]),
      ctaButton('Pay Now', 'casa://payments/pay')].join('');
    return { subject: `Rent overdue: ${amount} for ${addr}`, title: 'Payment Overdue', headerColour: DANGER_RED, content };
  },
  maintenance_submitted: (data) => {
    const name = (data.owner_name as string) || 'there';
    const addr = (data.property_address as string) || 'your property';
    const issue = (data.issue_title as string) || 'Maintenance request';
    const urgency = (data.urgency as string) || 'normal';
    const content = [greeting(name), paragraph(`A new maintenance request has been submitted for your property.`),
      infoCard([{ label: 'Property', value: addr }, { label: 'Issue', value: issue }, { label: 'Urgency', value: urgency, colour: urgency === 'emergency' ? DANGER_RED : WARNING_AMBER }]),
      ctaButton('View Request', 'casa://maintenance')].join('');
    return { subject: `New maintenance request: ${issue}`, title: 'Maintenance Request', headerColour: WARNING_AMBER, content };
  },
  maintenance_completed: (data) => {
    const name = (data.tenant_name as string) || 'there';
    const issue = (data.issue_title as string) || 'Maintenance request';
    const content = [greeting(name), paragraph(`The maintenance request for <strong>${issue}</strong> has been completed.`),
      ctaButton('View Details', 'casa://maintenance')].join('');
    return { subject: `Maintenance completed: ${issue}`, title: 'Maintenance Completed', headerColour: SUCCESS_GREEN, content };
  },
  application_received: (data) => {
    const name = (data.owner_name as string) || 'there';
    const addr = (data.property_address as string) || 'your property';
    const applicant = (data.applicant_name as string) || 'A prospective tenant';
    const content = [greeting(name), paragraph(`New application received from <strong>${applicant}</strong>.`),
      infoCard([{ label: 'Property', value: addr }, { label: 'Applicant', value: applicant }]),
      ctaButton('Review Application', 'casa://applications')].join('');
    return { subject: `New application for ${addr}`, title: 'New Application', headerColour: CASA_NAVY, content };
  },
  inspection_scheduled: (data) => {
    const name = (data.recipient_name as string) || 'there';
    const addr = (data.property_address as string) || 'your property';
    const date = (data.inspection_date as string) || '';
    const content = [greeting(name), paragraph(`A property inspection has been scheduled.`),
      infoCard([{ label: 'Property', value: addr }, { label: 'Date', value: date }]),
      ctaButton('View Details', 'casa://inspections')].join('');
    return { subject: `Inspection scheduled: ${date}`, title: 'Inspection Scheduled', headerColour: CASA_NAVY, content };
  },
  compliance_due_soon: (data) => {
    const name = (data.owner_name as string) || 'there';
    const item = (data.compliance_item as string) || 'Compliance item';
    const days = (data.days_remaining as number) || 0;
    const colour = days <= 7 ? DANGER_RED : WARNING_AMBER;
    const content = [greeting(name), paragraph(`A compliance obligation is due in <strong>${days} days</strong>.`),
      infoCard([{ label: 'Item', value: item }, { label: 'Days Remaining', value: `${days}`, colour }]),
      ctaButton('View Compliance', 'casa://compliance')].join('');
    return { subject: `Compliance due in ${days} days: ${item}`, title: 'Compliance Due Soon', headerColour: colour, content };
  },
  lease_expiring_soon: (data) => {
    const name = (data.owner_name as string) || 'there';
    const addr = (data.property_address as string) || 'your property';
    const days = (data.days_remaining as number) || 0;
    const colour = days <= 14 ? DANGER_RED : WARNING_AMBER;
    const content = [greeting(name), paragraph(`The lease at <strong>${addr}</strong> expires in <strong>${days} days</strong>.`),
      ctaButton('Manage Lease', 'casa://leases')].join('');
    return { subject: `Lease expiring in ${days} days: ${addr}`, title: 'Lease Expiring Soon', headerColour: colour, content };
  },

  // --- Tenant Lifecycle ---

  tenant_welcome: (data) => {
    const name = (data.tenant_name as string) || 'there';
    const addr = (data.property_address as string) || 'your new home';
    const leaseStart = (data.lease_start_date as string) || '';
    const rent = (data.rent_amount as string) || '$0.00';
    const frequency = (data.rent_frequency as string) || 'per week';
    const owner = (data.owner_name as string) || 'your landlord';
    const content = [
      greeting(name),
      paragraph(`Welcome to your new home! We're delighted to have you as a tenant at <strong>${addr}</strong>.`),
      infoCard([
        { label: 'Property', value: addr },
        { label: 'Lease Start', value: leaseStart },
        { label: 'Rent', value: `${rent} ${frequency}` },
        { label: 'Owner', value: owner },
      ]),
      paragraph('Casa will be your point of contact for all property matters — maintenance requests, rent payments, inspections, and more. If you have any questions, just send a message in the app.'),
      ctaButton('Open Casa', 'casa://home'),
    ].join('');
    return { subject: `Welcome to ${addr}`, title: 'Welcome Home', headerColour: CASA_NAVY, content };
  },

  tenant_exit: (data) => {
    const name = (data.tenant_name as string) || 'there';
    const addr = (data.property_address as string) || 'your property';
    const leaseEnd = (data.lease_end_date as string) || '';
    const bond = (data.bond_amount as string) || '$0.00';
    const content = [
      greeting(name),
      paragraph(`This is to confirm the end of your tenancy at <strong>${addr}</strong>.`),
      infoCard([
        { label: 'Property', value: addr },
        { label: 'Lease End Date', value: leaseEnd },
        { label: 'Bond Held', value: bond },
      ]),
      paragraph('To ensure a smooth handover and timely bond return, please make sure you:'),
      paragraph('&bull; Complete a thorough clean of the property<br/>&bull; Return all keys and access devices<br/>&bull; Ensure all personal belongings are removed<br/>&bull; Take photos of the property\'s condition<br/>&bull; Attend the final inspection if required'),
      paragraph(`Your bond of <strong>${bond}</strong> will be processed after the final inspection and any agreed deductions.`),
      ctaButton('View Exit Details', 'casa://leases'),
    ].join('');
    return { subject: `End of tenancy: ${addr}`, title: 'End of Tenancy', headerColour: WARNING_AMBER, content };
  },

  // --- Rent & Payments ---

  rent_receipt: (data) => {
    const name = (data.tenant_name as string) || 'there';
    const addr = (data.property_address as string) || 'your property';
    const amount = (data.amount as string) || '$0.00';
    const paymentDate = (data.payment_date as string) || '';
    const period = (data.period as string) || '';
    const nextDue = (data.next_due_date as string) || '';
    const content = [
      greeting(name),
      paragraph('Thank you for your rent payment. Here is your receipt.'),
      infoCard([
        { label: 'Property', value: addr },
        { label: 'Amount Paid', value: amount, colour: SUCCESS_GREEN },
        { label: 'Period', value: period },
        { label: 'Payment Date', value: paymentDate },
        { label: 'Next Due Date', value: nextDue },
      ]),
      ctaButton('View Payment History', 'casa://payments'),
    ].join('');
    return { subject: `Rent receipt: ${amount} for ${addr}`, title: 'Rent Receipt', headerColour: SUCCESS_GREEN, content };
  },

  payment_plan_created: (data) => {
    const name = (data.tenant_name as string) || 'there';
    const addr = (data.property_address as string) || 'your property';
    const totalArrears = (data.total_arrears as string) || '$0.00';
    const installment = (data.installment_amount as string) || '$0.00';
    const frequency = (data.frequency as string) || '';
    const startDate = (data.start_date as string) || '';
    const content = [
      greeting(name),
      paragraph(`A payment plan has been established for your arrears at <strong>${addr}</strong>. Please ensure each instalment is paid on time.`),
      infoCard([
        { label: 'Property', value: addr },
        { label: 'Total Arrears', value: totalArrears, colour: DANGER_RED },
        { label: 'Instalment Amount', value: installment },
        { label: 'Frequency', value: frequency },
        { label: 'Start Date', value: startDate },
      ]),
      ctaButton('View Payment Plan', 'casa://payments'),
    ].join('');
    return { subject: `Payment plan confirmed for ${addr}`, title: 'Payment Plan Confirmed', headerColour: CASA_NAVY, content };
  },

  // --- Lease ---

  lease_renewal_offer: (data) => {
    const name = (data.tenant_name as string) || 'there';
    const addr = (data.property_address as string) || 'your property';
    const currentRent = (data.current_rent as string) || '$0.00';
    const proposedRent = (data.proposed_rent as string) || '$0.00';
    const leaseStart = (data.lease_start as string) || '';
    const leaseEnd = (data.lease_end as string) || '';
    const owner = (data.owner_name as string) || 'your landlord';
    const content = [
      greeting(name),
      paragraph(`Your landlord, <strong>${owner}</strong>, would like to offer you a lease renewal at <strong>${addr}</strong>.`),
      infoCard([
        { label: 'Property', value: addr },
        { label: 'Current Rent', value: currentRent },
        { label: 'Proposed Rent', value: proposedRent },
        { label: 'New Lease Start', value: leaseStart },
        { label: 'New Lease End', value: leaseEnd },
      ]),
      paragraph('Please review the offer and respond at your earliest convenience.'),
      ctaButton('Review Offer', 'casa://leases'),
    ].join('');
    return { subject: `Lease renewal offer: ${addr}`, title: 'Lease Renewal Offer', headerColour: CASA_NAVY, content };
  },

  rent_increase_notice: (data) => {
    const name = (data.tenant_name as string) || 'there';
    const addr = (data.property_address as string) || 'your property';
    const currentRent = (data.current_rent as string) || '$0.00';
    const newRent = (data.new_rent as string) || '$0.00';
    const effectiveDate = (data.effective_date as string) || '';
    const noticeDays = (data.notice_period_days as number) || 60;
    const content = [
      greeting(name),
      paragraph(`This is a formal notice of a rent increase for your tenancy at <strong>${addr}</strong>, effective <strong>${effectiveDate}</strong>.`),
      infoCard([
        { label: 'Property', value: addr },
        { label: 'Current Rent', value: currentRent },
        { label: 'New Rent', value: newRent, colour: WARNING_AMBER },
        { label: 'Effective Date', value: effectiveDate },
        { label: 'Notice Period', value: `${noticeDays} days` },
      ]),
      paragraph('This notice complies with the minimum notice period required under applicable tenancy legislation. If you have any questions, please get in touch through the app.'),
      ctaButton('View Lease Details', 'casa://leases'),
    ].join('');
    return { subject: `Rent increase notice: ${addr}`, title: 'Rent Increase Notice', headerColour: WARNING_AMBER, content };
  },

  // --- Maintenance ---

  maintenance_update: (data) => {
    const name = (data.tenant_name as string) || 'there';
    const issue = (data.issue_title as string) || 'Maintenance request';
    const status = (data.status as string) || 'Updated';
    const updateMessage = (data.update_message as string) || '';
    const addr = (data.property_address as string) || 'your property';
    const content = [
      greeting(name),
      paragraph(`There is an update on your maintenance request for <strong>${addr}</strong>.`),
      infoCard([
        { label: 'Issue', value: issue },
        { label: 'Status', value: status },
      ]),
      paragraph(updateMessage),
      ctaButton('View Request', 'casa://maintenance'),
    ].join('');
    return { subject: `Maintenance update: ${issue}`, title: 'Maintenance Update', headerColour: CASA_NAVY, content };
  },

  maintenance_trade_assigned: (data) => {
    const name = (data.owner_name as string) || 'there';
    const issue = (data.issue_title as string) || 'Maintenance request';
    const tradeName = (data.trade_name as string) || 'A tradesperson';
    const tradePhone = (data.trade_phone as string) || '';
    const scheduledDate = (data.scheduled_date as string) || '';
    const addr = (data.property_address as string) || 'your property';
    const content = [
      greeting(name),
      paragraph(`A tradesperson has been assigned to the maintenance request at <strong>${addr}</strong>.`),
      infoCard([
        { label: 'Issue', value: issue },
        { label: 'Tradesperson', value: tradeName },
        { label: 'Phone', value: tradePhone },
        { label: 'Scheduled Date', value: scheduledDate },
        { label: 'Property', value: addr },
      ]),
      ctaButton('View Maintenance', 'casa://maintenance'),
    ].join('');
    return { subject: `Trade assigned: ${issue}`, title: 'Tradesperson Assigned', headerColour: CASA_NAVY, content };
  },

  // --- Inspection ---

  inspection_reminder: (data) => {
    const name = (data.tenant_name as string) || 'there';
    const addr = (data.property_address as string) || 'your property';
    const inspectionDate = (data.inspection_date as string) || '';
    const inspectionType = (data.inspection_type as string) || 'routine';
    const noticeDays = (data.notice_days as number) || 7;
    const content = [
      greeting(name),
      paragraph(`This is a reminder that a <strong>${inspectionType}</strong> inspection is scheduled at <strong>${addr}</strong> in <strong>${noticeDays} days</strong>.`),
      infoCard([
        { label: 'Property', value: addr },
        { label: 'Inspection Date', value: inspectionDate },
        { label: 'Type', value: inspectionType },
      ]),
      paragraph('To prepare for the inspection, please ensure the property is reasonably clean and tidy, and that all rooms are accessible.'),
      ctaButton('View Inspection', 'casa://inspections'),
    ].join('');
    return { subject: `Inspection reminder: ${inspectionDate}`, title: 'Inspection Reminder', headerColour: CASA_NAVY, content };
  },

  inspection_report_ready: (data) => {
    const name = (data.owner_name as string) || 'there';
    const addr = (data.property_address as string) || 'your property';
    const inspectionType = (data.inspection_type as string) || 'routine';
    const condition = (data.overall_condition as string) || 'good';
    const issuesFound = (data.issues_found as number) || 0;
    const conditionLower = condition.toLowerCase();
    const headerColour = conditionLower === 'good' ? SUCCESS_GREEN : conditionLower === 'fair' ? WARNING_AMBER : DANGER_RED;
    const content = [
      greeting(name),
      paragraph(`The <strong>${inspectionType}</strong> inspection report for <strong>${addr}</strong> is now ready for your review.`),
      infoCard([
        { label: 'Property', value: addr },
        { label: 'Inspection Type', value: inspectionType },
        { label: 'Overall Condition', value: condition, colour: headerColour },
        { label: 'Issues Found', value: `${issuesFound}`, colour: issuesFound > 0 ? WARNING_AMBER : SUCCESS_GREEN },
      ]),
      ctaButton('View Report', 'casa://inspections'),
    ].join('');
    return { subject: `Inspection report ready: ${addr}`, title: 'Inspection Report Ready', headerColour, content };
  },

  // --- Portfolio & Reports ---

  weekly_summary: (data) => {
    const name = (data.owner_name as string) || 'there';
    const propertiesCount = (data.properties_count as number) || 0;
    const totalRentCollected = (data.total_rent_collected as string) || '$0.00';
    const arrearsCount = (data.arrears_count as number) || 0;
    const maintenanceOpen = (data.maintenance_open as number) || 0;
    const complianceDue = (data.compliance_due as number) || 0;
    const content = [
      greeting(name),
      paragraph('Here is your weekly property portfolio summary.'),
      infoCard([
        { label: 'Properties', value: `${propertiesCount}` },
        { label: 'Rent Collected', value: totalRentCollected, colour: SUCCESS_GREEN },
        { label: 'Tenants in Arrears', value: `${arrearsCount}`, colour: arrearsCount > 0 ? DANGER_RED : SUCCESS_GREEN },
        { label: 'Open Maintenance', value: `${maintenanceOpen}`, colour: maintenanceOpen > 0 ? WARNING_AMBER : SUCCESS_GREEN },
        { label: 'Compliance Items Due', value: `${complianceDue}`, colour: complianceDue > 0 ? WARNING_AMBER : SUCCESS_GREEN },
      ]),
      ctaButton('View Portfolio', 'casa://portfolio'),
    ].join('');
    return { subject: 'Your weekly property summary', title: 'Weekly Summary', headerColour: CASA_NAVY, content };
  },

  monthly_digest: (data) => {
    const name = (data.owner_name as string) || 'there';
    const month = (data.month as string) || '';
    const year = (data.year as string | number) || '';
    const totalIncome = (data.total_income as string) || '$0.00';
    const totalExpenses = (data.total_expenses as string) || '$0.00';
    const netIncome = (data.net_income as string) || '$0.00';
    const occupancyRate = (data.occupancy_rate as string) || '0%';
    const propertiesCount = (data.properties_count as number) || 0;
    const content = [
      greeting(name),
      paragraph(`Here is your monthly property report for <strong>${month} ${year}</strong>.`),
      infoCard([
        { label: 'Properties', value: `${propertiesCount}` },
        { label: 'Total Income', value: totalIncome, colour: SUCCESS_GREEN },
        { label: 'Total Expenses', value: totalExpenses },
        { label: 'Net Income', value: netIncome, colour: SUCCESS_GREEN },
        { label: 'Occupancy Rate', value: occupancyRate },
      ]),
      ctaButton('View Full Report', 'casa://reports'),
    ].join('');
    return { subject: `Monthly report: ${month} ${year}`, title: 'Monthly Digest', headerColour: CASA_NAVY, content };
  },

  // --- Arrears Escalation ---

  arrears_escalation: (data) => {
    const name = (data.owner_name as string) || 'there';
    const tenant = (data.tenant_name as string) || 'Your tenant';
    const addr = (data.property_address as string) || 'your property';
    const amount = (data.amount as string) || '$0.00';
    const daysOverdue = (data.days_overdue as number) || 0;
    const escalationLevel = (data.escalation_level as string) || 'Standard';
    const recommendedAction = (data.recommended_action as string) || '';
    const content = [
      greeting(name),
      paragraph(`An arrears matter at <strong>${addr}</strong> requires your attention. The tenant is now <strong>${daysOverdue} days overdue</strong>.`),
      infoCard([
        { label: 'Tenant', value: tenant },
        { label: 'Property', value: addr },
        { label: 'Amount Overdue', value: amount, colour: DANGER_RED },
        { label: 'Days Overdue', value: `${daysOverdue}`, colour: DANGER_RED },
        { label: 'Escalation Level', value: escalationLevel, colour: WARNING_AMBER },
      ]),
      paragraph(`<strong>Recommended action:</strong> ${recommendedAction}`),
      ctaButton('View Arrears', 'casa://payments/arrears'),
    ].join('');
    return { subject: `Arrears escalation: ${tenant} - ${daysOverdue} days overdue`, title: 'Arrears Escalation', headerColour: DANGER_RED, content };
  },

  // --- Agent Activity ---

  agent_action_summary: (data) => {
    const name = (data.owner_name as string) || 'there';
    const actionsCount = (data.actions_count as number) || 0;
    const actionsList = (data.actions_list as Array<{ description: string; property: string }>) || [];
    const date = (data.date as string) || '';

    let actionsHtml = '';
    if (actionsList.length > 0) {
      const groupedByProperty: Record<string, string[]> = {};
      for (const action of actionsList) {
        const prop = action.property || 'General';
        if (!groupedByProperty[prop]) {
          groupedByProperty[prop] = [];
        }
        groupedByProperty[prop].push(action.description);
      }
      const sections = Object.entries(groupedByProperty).map(([property, descriptions]) => {
        const items = descriptions.map(d => `<li style="color:${TEXT_PRIMARY};font-size:14px;line-height:1.8;">${d}</li>`).join('');
        return `<div style="background:${BG_WHITE};padding:16px 20px;border-radius:8px;margin:12px 0;">
          <p style="color:${CASA_NAVY};font-weight:600;font-size:15px;margin:0 0 8px 0;">${property}</p>
          <ul style="margin:0;padding-left:20px;">${items}</ul></div>`;
      }).join('');
      actionsHtml = sections;
    } else {
      actionsHtml = paragraph('No autonomous actions were taken today.');
    }

    const content = [
      greeting(name),
      paragraph(`Casa took <strong>${actionsCount} action${actionsCount !== 1 ? 's' : ''}</strong> on your behalf${date ? ` on <strong>${date}</strong>` : ''}.`),
      actionsHtml,
      ctaButton('View Activity Log', 'casa://activity'),
    ].join('');
    return { subject: 'Casa daily action summary', title: 'Daily Action Summary', headerColour: CASA_NAVY, content };
  },
};

export function getEmailHtml(type: string, data: Record<string, unknown>): TemplateResult {
  const userId = data.user_id as string | undefined;
  const templateFn = TEMPLATE_MAP[type];

  if (templateFn) {
    const inner = templateFn(data);
    return {
      subject: inner.subject,
      htmlContent: wrapInLayout(inner.title, inner.headerColour, inner.content, userId, type),
    };
  }

  const title = (data.title as string) || 'Notification';
  const body = (data.body as string) || '';
  const name = (data.recipient_name as string) || 'there';
  const content = [greeting(name), paragraph(body), ctaButton('Open Casa', 'casa://home')].join('');
  return { subject: title, htmlContent: wrapInLayout(title, CASA_NAVY, content, userId, type) };
}

export const SUPPORTED_NOTIFICATION_TYPES = Object.keys(TEMPLATE_MAP);
