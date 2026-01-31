// Lease HTML Generator
// Generates a complete residential tenancy agreement as an HTML document
// suitable for rendering via expo-print / PDF conversion.

export interface LeaseData {
  // Owner
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  ownerAddress?: string;

  // Tenant
  tenantName: string;
  tenantEmail: string;
  tenantPhone?: string;

  // Property
  propertyAddress: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;

  // Lease Terms
  leaseStartDate: string;
  leaseEndDate: string;
  rentAmount: number;
  rentFrequency: 'weekly' | 'fortnightly' | 'monthly';
  bondAmount: number;
  bondWeeks: number;

  // State for legal compliance
  state: string;

  // Optional
  petsAllowed?: boolean;
  smokingAllowed?: boolean;
  furnished?: boolean;
  specialConditions?: string;
}

function formatDateAU(dateStr: string): string {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function calculateLeaseDuration(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 30) {
    return `${diffDays} days`;
  }

  const months = Math.round(diffDays / 30.44);
  if (months === 12) {
    return '12 months (1 year)';
  }
  if (months > 12 && months % 12 === 0) {
    const years = months / 12;
    return `${months} months (${years} years)`;
  }
  return `${months} months`;
}

function getRentFrequencyLabel(frequency: LeaseData['rentFrequency']): string {
  switch (frequency) {
    case 'weekly':
      return 'per week';
    case 'fortnightly':
      return 'per fortnight';
    case 'monthly':
      return 'per month';
  }
}

function getBondAuthority(state: string): string {
  const stateUpper = state.toUpperCase();
  switch (stateUpper) {
    case 'NSW':
      return 'NSW Fair Trading';
    case 'VIC':
      return 'Residential Tenancies Bond Authority (RTBA)';
    case 'QLD':
      return 'Residential Tenancies Authority (RTA)';
    case 'SA':
      return 'Consumer and Business Services (CBS)';
    case 'WA':
      return 'Bond Administrator, Department of Mines, Industry Regulation and Safety';
    case 'TAS':
      return 'Rental Deposit Authority';
    case 'NT':
      return 'NT Consumer Affairs';
    case 'ACT':
      return 'Office of Rental Bonds';
    default:
      return 'the relevant state bond authority';
  }
}

function getStateLegislation(state: string): string {
  const stateUpper = state.toUpperCase();
  switch (stateUpper) {
    case 'NSW':
      return 'Residential Tenancies Act 2010 (NSW)';
    case 'VIC':
      return 'Residential Tenancies Act 1997 (Vic)';
    case 'QLD':
      return 'Residential Tenancies and Rooming Accommodation Act 2008 (Qld)';
    case 'SA':
      return 'Residential Tenancies Act 1995 (SA)';
    case 'WA':
      return 'Residential Tenancies Act 1987 (WA)';
    case 'TAS':
      return 'Residential Tenancy Act 1997 (Tas)';
    case 'NT':
      return 'Residential Tenancies Act 1999 (NT)';
    case 'ACT':
      return 'Residential Tenancies Act 1997 (ACT)';
    default:
      return 'the applicable Residential Tenancies Act';
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateLeaseHTML(data: LeaseData): string {
  const formattedStart = formatDateAU(data.leaseStartDate);
  const formattedEnd = formatDateAU(data.leaseEndDate);
  const duration = calculateLeaseDuration(data.leaseStartDate, data.leaseEndDate);
  const rentLabel = getRentFrequencyLabel(data.rentFrequency);
  const bondAuthority = getBondAuthority(data.state);
  const legislation = getStateLegislation(data.state);
  const stateUpper = data.state.toUpperCase();

  const ownerPhone = data.ownerPhone ? escapeHtml(data.ownerPhone) : 'Not provided';
  const ownerAddress = data.ownerAddress ? escapeHtml(data.ownerAddress) : 'Not provided';
  const tenantPhone = data.tenantPhone ? escapeHtml(data.tenantPhone) : 'Not provided';

  const petsStatus =
    data.petsAllowed === true ? 'Permitted (subject to prior written consent and any conditions)' :
    data.petsAllowed === false ? 'Not permitted' :
    'Not specified';

  const smokingStatus =
    data.smokingAllowed === true ? 'Permitted in designated outdoor areas only' :
    data.smokingAllowed === false ? 'Not permitted on the premises' :
    'Not specified';

  const furnishedStatus =
    data.furnished === true ? 'Yes \u2014 the premises are provided furnished (see attached inventory)' :
    data.furnished === false ? 'No \u2014 the premises are provided unfurnished' :
    'Not specified';

  const specialConditionsSection = data.specialConditions
    ? `
    <div class="section">
      <h2>8. Special Conditions</h2>
      <p>${escapeHtml(data.specialConditions)}</p>
    </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Residential Tenancy Agreement</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 18mm 25mm 18mm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #0A0A0A;
      background: #FFFFFF;
    }

    .document {
      max-width: 210mm;
      margin: 0 auto;
      padding: 0;
    }

    .header {
      text-align: center;
      padding-bottom: 20px;
      margin-bottom: 24px;
      border-bottom: 2px solid #1B1464;
    }

    .header h1 {
      font-size: 20pt;
      font-weight: 700;
      color: #1B1464;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .header .state-ref {
      font-size: 10pt;
      color: #525252;
    }

    .section {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }

    .section h2 {
      font-size: 13pt;
      font-weight: 700;
      color: #1B1464;
      margin-bottom: 12px;
      padding-bottom: 4px;
      border-bottom: 1px solid #E5E5E5;
    }

    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }

    .details-table td {
      padding: 6px 10px;
      vertical-align: top;
      border: 1px solid #E5E5E5;
      font-size: 10.5pt;
    }

    .details-table td.label {
      width: 35%;
      font-weight: 600;
      color: #525252;
      background-color: #F5F5F4;
    }

    .details-table td.value {
      width: 65%;
      color: #0A0A0A;
    }

    .clause-list {
      list-style: none;
      padding: 0;
      counter-reset: clause-counter;
    }

    .clause-list li {
      padding: 8px 0 8px 28px;
      position: relative;
      font-size: 10.5pt;
      line-height: 1.6;
      border-bottom: 1px solid #F5F5F4;
    }

    .clause-list li:last-child {
      border-bottom: none;
    }

    .clause-list li::before {
      counter-increment: clause-counter;
      content: counter(clause-counter) ".";
      position: absolute;
      left: 0;
      font-weight: 600;
      color: #1B1464;
    }

    .signature-block {
      margin-top: 40px;
      page-break-inside: avoid;
    }

    .signature-row {
      display: flex;
      justify-content: space-between;
      gap: 40px;
      margin-bottom: 40px;
    }

    .signature-party {
      flex: 1;
    }

    .signature-party h3 {
      font-size: 11pt;
      font-weight: 700;
      color: #1B1464;
      margin-bottom: 16px;
    }

    .signature-line {
      border-bottom: 1px solid #0A0A0A;
      height: 40px;
      margin-bottom: 6px;
    }

    .signature-label {
      font-size: 9pt;
      color: #525252;
      margin-bottom: 20px;
    }

    .footer {
      margin-top: 40px;
      padding-top: 12px;
      border-top: 1px solid #E5E5E5;
      text-align: center;
      font-size: 8.5pt;
      color: #A3A3A3;
    }

    .footer .brand {
      color: #1B1464;
      font-weight: 600;
    }

    p {
      margin-bottom: 8px;
      font-size: 10.5pt;
      line-height: 1.6;
    }

    .important-note {
      background-color: #F5F5F4;
      border-left: 3px solid #1B1464;
      padding: 10px 14px;
      margin: 12px 0;
      font-size: 10pt;
      color: #525252;
    }
  </style>
</head>
<body>
  <div class="document">

    <div class="header">
      <h1>RESIDENTIAL TENANCY AGREEMENT</h1>
      <div class="state-ref">Under the ${escapeHtml(legislation)}</div>
      <div class="state-ref">State: ${escapeHtml(stateUpper)}</div>
    </div>

    <div class="section">
      <h2>1. Parties</h2>
      <table class="details-table">
        <tr>
          <td class="label" colspan="2" style="text-align:center; font-weight:700; color:#1B1464; background-color:#EEEDF8;">Landlord (Owner)</td>
        </tr>
        <tr>
          <td class="label">Full Name</td>
          <td class="value">${escapeHtml(data.ownerName)}</td>
        </tr>
        <tr>
          <td class="label">Email</td>
          <td class="value">${escapeHtml(data.ownerEmail)}</td>
        </tr>
        <tr>
          <td class="label">Phone</td>
          <td class="value">${ownerPhone}</td>
        </tr>
        <tr>
          <td class="label">Address</td>
          <td class="value">${ownerAddress}</td>
        </tr>
      </table>

      <table class="details-table" style="margin-top: 12px;">
        <tr>
          <td class="label" colspan="2" style="text-align:center; font-weight:700; color:#1B1464; background-color:#EEEDF8;">Tenant</td>
        </tr>
        <tr>
          <td class="label">Full Name</td>
          <td class="value">${escapeHtml(data.tenantName)}</td>
        </tr>
        <tr>
          <td class="label">Email</td>
          <td class="value">${escapeHtml(data.tenantEmail)}</td>
        </tr>
        <tr>
          <td class="label">Phone</td>
          <td class="value">${tenantPhone}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <h2>2. Premises</h2>
      <table class="details-table">
        <tr>
          <td class="label">Address</td>
          <td class="value">${escapeHtml(data.propertyAddress)}</td>
        </tr>
        <tr>
          <td class="label">Property Type</td>
          <td class="value">${escapeHtml(data.propertyType)}</td>
        </tr>
        <tr>
          <td class="label">Bedrooms</td>
          <td class="value">${data.bedrooms}</td>
        </tr>
        <tr>
          <td class="label">Bathrooms</td>
          <td class="value">${data.bathrooms}</td>
        </tr>
        <tr>
          <td class="label">Parking Spaces</td>
          <td class="value">${data.parkingSpaces}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <h2>3. Term of Agreement</h2>
      <table class="details-table">
        <tr>
          <td class="label">Commencement Date</td>
          <td class="value">${formattedStart}</td>
        </tr>
        <tr>
          <td class="label">End Date</td>
          <td class="value">${formattedEnd}</td>
        </tr>
        <tr>
          <td class="label">Duration</td>
          <td class="value">${duration}</td>
        </tr>
      </table>
      <div class="important-note">
        This is a fixed-term agreement. At the end of the fixed term, the tenancy will continue as a periodic
        (${data.rentFrequency === 'monthly' ? 'month-to-month' : 'week-to-week'}) agreement unless either party
        gives the required notice under the ${escapeHtml(legislation)}.
      </div>
    </div>

    <div class="section">
      <h2>4. Rent</h2>
      <table class="details-table">
        <tr>
          <td class="label">Rent Amount</td>
          <td class="value">${formatCurrency(data.rentAmount)} ${rentLabel}</td>
        </tr>
        <tr>
          <td class="label">Payment Frequency</td>
          <td class="value">${data.rentFrequency.charAt(0).toUpperCase() + data.rentFrequency.slice(1)}</td>
        </tr>
        <tr>
          <td class="label">First Payment Due</td>
          <td class="value">${formattedStart} (commencement date)</td>
        </tr>
        <tr>
          <td class="label">Payment Method</td>
          <td class="value">Electronic transfer or as agreed between the parties</td>
        </tr>
      </table>
      <div class="important-note">
        Rent must not be increased during a fixed-term agreement unless the agreement provides for an increase.
        Any rent increase must comply with the ${escapeHtml(legislation)}.
      </div>
    </div>

    <div class="section">
      <h2>5. Bond (Security Deposit)</h2>
      <table class="details-table">
        <tr>
          <td class="label">Bond Amount</td>
          <td class="value">${formatCurrency(data.bondAmount)} (equivalent to ${data.bondWeeks} weeks rent)</td>
        </tr>
        <tr>
          <td class="label">Lodgement Authority</td>
          <td class="value">${escapeHtml(bondAuthority)}</td>
        </tr>
      </table>
      <p>
        The bond must be lodged with ${escapeHtml(bondAuthority)} within the timeframe required by the
        ${escapeHtml(legislation)}. The bond will be held for the duration of the tenancy and refunded in
        accordance with the Act upon termination, less any amounts lawfully claimed for unpaid rent, damage
        beyond fair wear and tear, or other costs permitted under the Act.
      </p>
    </div>

    <div class="section">
      <h2>6. Property Condition</h2>
      <p>
        A condition report must be completed at the start of the tenancy. The tenant must be provided with two
        copies of the condition report. The tenant has the right to note any disagreements and return a signed
        copy within the timeframe specified under the ${escapeHtml(legislation)}.
      </p>
    </div>

    <div class="section">
      <h2>7. Conditions</h2>
      <table class="details-table">
        <tr>
          <td class="label">Pets</td>
          <td class="value">${petsStatus}</td>
        </tr>
        <tr>
          <td class="label">Smoking</td>
          <td class="value">${smokingStatus}</td>
        </tr>
        <tr>
          <td class="label">Furnished</td>
          <td class="value">${furnishedStatus}</td>
        </tr>
      </table>
    </div>

    ${specialConditionsSection}

    <div class="section">
      <h2>${data.specialConditions ? '9' : '8'}. Standard Terms and Obligations</h2>
      <ol class="clause-list">
        <li>
          The tenant must keep the premises reasonably clean and in good condition throughout the tenancy,
          and must not intentionally or negligently cause or permit damage to the premises.
        </li>
        <li>
          The tenant must not make any alterations, additions, or renovations to the premises without the
          prior written consent of the landlord. Any approved alterations must be carried out in a proper
          and workmanlike manner.
        </li>
        <li>
          The landlord must provide the premises in a reasonable state of cleanliness, fit for habitation,
          and in a reasonable state of repair at the commencement of the tenancy.
        </li>
        <li>
          The landlord is responsible for maintaining the premises in a reasonable state of repair during
          the tenancy, including structural repairs, and must ensure the premises remain fit for habitation.
        </li>
        <li>
          The tenant must notify the landlord as soon as practicable of any damage to the premises or any
          need for repairs that are the responsibility of the landlord.
        </li>
        <li>
          The tenant must not use the premises, or permit the premises to be used, for any illegal purpose
          or in a manner that causes a nuisance or interferes with the reasonable peace, comfort, or privacy
          of neighbours.
        </li>
        <li>
          The landlord or their agent may enter the premises only in accordance with the provisions of
          the ${escapeHtml(legislation)}, which specifies the grounds for entry and required notice periods.
        </li>
        <li>
          Either party may terminate this agreement by giving the appropriate notice as required under
          the ${escapeHtml(legislation)}. During a fixed term, early termination is only permitted in
          the circumstances provided for under the Act.
        </li>
        <li>
          At the end of the tenancy, the tenant must leave the premises in substantially the same
          condition as at the commencement of the tenancy, fair wear and tear excepted, and must
          return all keys and security devices to the landlord.
        </li>
        <li>
          Any disputes arising under this agreement shall be resolved in accordance with the dispute
          resolution procedures set out in the ${escapeHtml(legislation)}, including application to
          the relevant tribunal if necessary.
        </li>
      </ol>
    </div>

    <div class="section">
      <h2>${data.specialConditions ? '10' : '9'}. Acknowledgement</h2>
      <p>
        By signing below, both parties acknowledge that they have read and understood this agreement and
        agree to be bound by its terms and conditions, subject to the provisions of the ${escapeHtml(legislation)}.
      </p>
      <p>
        This agreement does not override any rights or obligations conferred by the ${escapeHtml(legislation)}.
        Where there is any inconsistency between this agreement and the Act, the Act prevails.
      </p>
    </div>

    <div class="signature-block">
      <div class="signature-row">
        <div class="signature-party">
          <h3>Landlord (Owner)</h3>
          <div class="signature-line"></div>
          <div class="signature-label">Signature</div>
          <div class="signature-line"></div>
          <div class="signature-label">Full Name: ${escapeHtml(data.ownerName)}</div>
          <div class="signature-line"></div>
          <div class="signature-label">Date</div>
        </div>
        <div class="signature-party">
          <h3>Tenant</h3>
          <div class="signature-line"></div>
          <div class="signature-label">Signature</div>
          <div class="signature-line"></div>
          <div class="signature-label">Full Name: ${escapeHtml(data.tenantName)}</div>
          <div class="signature-line"></div>
          <div class="signature-label">Date</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Generated by <span class="brand">Casa</span> &mdash; AI-powered property management for Australian property owners.</p>
      <p>This document is intended as a record of the agreed terms. Both parties should seek independent legal advice if required.</p>
    </div>

  </div>
</body>
</html>`;
}
