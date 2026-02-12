// Condition Report HTML Template — Room-by-room inspection report
// Generates a styled HTML document for condition reports that can be rendered
// as a WebView or exported as PDF via expo-print.
// Includes room photos, item checklists, signatures, and state-specific legislation.

import { getDetailedStateLegislation } from './documentTemplates';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateAU(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ============================================================
// Data Interfaces
// ============================================================

export interface ConditionReportPhoto {
  url: string;
  caption?: string;
  compassBearing?: number | null;
  isWideShot?: boolean;
  isCloseup?: boolean;
}

export interface ConditionReportItem {
  name: string;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged' | 'not_applicable';
  notes?: string;
  actionRequired?: boolean;
  actionDescription?: string;
  estimatedCost?: number;
}

export interface ConditionReportRoom {
  name: string;
  overallCondition?: string;
  layoutSketchUrl?: string;
  photos: ConditionReportPhoto[];
  items: ConditionReportItem[];
  tenantNotes?: string;
}

export interface ConditionReportSignature {
  role: 'owner' | 'tenant';
  name: string;
  signatureUrl?: string;
  signedAt?: string;
}

export interface ConditionReportSubmission {
  roomName: string;
  type: 'new_photo' | 'description_alteration' | 'new_item' | 'query';
  description?: string;
  originalDescription?: string;
  imageUrl?: string;
  status: 'pending' | 'approved' | 'rejected' | 'resolved';
  reviewerNotes?: string;
}

export interface ConditionReportData {
  inspectionType: 'entry' | 'exit' | 'routine';
  propertyAddress: string;
  state: string;
  inspectionDate: string;
  inspectorName: string;
  tenantName?: string;
  rooms: ConditionReportRoom[];
  overallCondition?: string;
  summaryNotes?: string;
  signatures: ConditionReportSignature[];
  tenantSubmissions?: ConditionReportSubmission[];
  disputes?: Array<{
    itemName: string;
    roomName: string;
    reason: string;
    proposedCondition?: string;
    status: string;
    ownerResponse?: string;
    resolvedCondition?: string;
  }>;
}

// ============================================================
// Styles
// ============================================================

const REPORT_STYLES = `
  @page { size: A4; margin: 15mm 14mm 18mm 14mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 10pt; line-height: 1.4; color: #0A0A0A; background: #fff;
  }
  .doc { max-width: 210mm; margin: 0 auto; padding: 16px; }
  .header {
    text-align: center; padding-bottom: 12px; margin-bottom: 16px;
    border-bottom: 3px solid #1B1464;
  }
  .header h1 { font-size: 16pt; font-weight: 700; color: #1B1464; margin-bottom: 2px; }
  .header .sub { font-size: 9pt; color: #525252; }
  .header .badge {
    display: inline-block; padding: 2px 10px; border-radius: 4px;
    font-size: 8pt; font-weight: 700; text-transform: uppercase; margin-top: 6px;
  }
  .badge-entry { background: #DBEAFE; color: #1D4ED8; }
  .badge-exit { background: #FEE2E2; color: #DC2626; }
  .badge-routine { background: #F3E8FF; color: #7C3AED; }

  .info-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
    margin-bottom: 16px; font-size: 9pt;
  }
  .info-item { display: flex; gap: 6px; }
  .info-label { font-weight: 600; color: #525252; min-width: 80px; }
  .info-value { color: #0A0A0A; }

  .room { page-break-inside: avoid; margin-bottom: 20px; border: 1px solid #E5E5E5; border-radius: 6px; overflow: hidden; }
  .room-header {
    background: #F5F2EB; padding: 8px 12px;
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid #E5E5E5;
  }
  .room-header h2 { font-size: 12pt; font-weight: 700; color: #1B1464; margin: 0; }
  .room-condition {
    display: inline-block; padding: 2px 8px; border-radius: 3px;
    font-size: 8pt; font-weight: 600;
  }

  .room-body { padding: 10px 12px; }

  .photo-grid {
    display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;
  }
  .photo-item {
    width: 120px; position: relative;
  }
  .photo-item img {
    width: 120px; height: 90px; object-fit: cover; border-radius: 4px;
    border: 1px solid #E5E5E5;
  }
  .photo-caption {
    font-size: 7pt; color: #525252; margin-top: 2px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .photo-bearing {
    position: absolute; top: 2px; right: 2px;
    background: rgba(0,0,0,0.6); color: #fff; font-size: 7pt;
    padding: 1px 4px; border-radius: 2px;
  }

  .layout-sketch {
    max-width: 200px; max-height: 150px; border: 1px solid #E5E5E5;
    border-radius: 4px; margin-bottom: 8px;
  }

  .item-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .item-table th {
    padding: 4px 8px; border: 1px solid #E5E5E5; background: #F5F5F4;
    font-weight: 600; text-align: left; font-size: 8pt;
  }
  .item-table td { padding: 4px 8px; border: 1px solid #E5E5E5; vertical-align: top; }
  .item-table .condition-cell { font-weight: 600; white-space: nowrap; }

  .condition-excellent { color: #16A34A; }
  .condition-good { color: #22C55E; }
  .condition-fair { color: #CA8A04; }
  .condition-poor { color: #EA580C; }
  .condition-damaged { color: #DC2626; }
  .condition-na { color: #6B7280; }

  .action-flag {
    display: inline-block; background: #FEF2F2; color: #DC2626;
    font-size: 7pt; font-weight: 600; padding: 1px 4px; border-radius: 2px;
  }

  .submissions-section { margin-top: 16px; }
  .submission-card {
    border: 1px solid #E5E5E5; border-radius: 4px; padding: 8px;
    margin-bottom: 8px; font-size: 9pt;
  }
  .submission-badge {
    display: inline-block; font-size: 7pt; font-weight: 600;
    padding: 1px 6px; border-radius: 3px; margin-right: 6px;
  }
  .badge-approved { background: #DCFCE7; color: #16A34A; }
  .badge-rejected { background: #FEE2E2; color: #DC2626; }
  .badge-pending { background: #FEF9C3; color: #CA8A04; }

  .dispute-card {
    border: 1px solid #FCA5A5; border-radius: 4px; padding: 8px;
    margin-bottom: 8px; font-size: 9pt; background: #FEF2F2;
  }

  .summary-section {
    margin-top: 16px; padding: 12px; background: #F5F2EB;
    border-radius: 6px; page-break-inside: avoid;
  }
  .summary-section h2 { font-size: 12pt; color: #1B1464; margin-bottom: 8px; }

  .sig-block { margin-top: 24px; page-break-inside: avoid; }
  .sig-grid { display: flex; gap: 24px; }
  .sig-party { flex: 1; }
  .sig-party h3 { font-size: 9pt; font-weight: 700; color: #1B1464; margin-bottom: 8px; }
  .sig-image { max-width: 180px; max-height: 60px; margin-bottom: 4px; }
  .sig-line { border-bottom: 1px solid #0A0A0A; height: 32px; margin-bottom: 3px; }
  .sig-label { font-size: 7.5pt; color: #525252; margin-bottom: 10px; }

  .legislation-note {
    margin-top: 16px; padding: 8px 12px; border-left: 3px solid #1B1464;
    background: #F5F5F4; font-size: 8pt; color: #525252;
  }

  .footer {
    margin-top: 20px; padding-top: 8px; border-top: 1px solid #E5E5E5;
    text-align: center; font-size: 7pt; color: #A3A3A3;
  }
  .footer .brand { color: #1B1464; font-weight: 600; }
`;

// ============================================================
// Helpers
// ============================================================

function conditionClass(condition: string): string {
  switch (condition) {
    case 'excellent': return 'condition-excellent';
    case 'good': return 'condition-good';
    case 'fair': return 'condition-fair';
    case 'poor': return 'condition-poor';
    case 'damaged': return 'condition-damaged';
    default: return 'condition-na';
  }
}

function conditionLabel(condition: string): string {
  if (condition === 'not_applicable') return 'N/A';
  return condition.charAt(0).toUpperCase() + condition.slice(1);
}

function typeBadgeClass(type: string): string {
  switch (type) {
    case 'entry': return 'badge-entry';
    case 'exit': return 'badge-exit';
    default: return 'badge-routine';
  }
}

function compassLabel(bearing: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return `${bearing}° ${directions[index]}`;
}

// ============================================================
// Main Template
// ============================================================

export function generateConditionReportPDF(data: ConditionReportData): string {
  const legislation = getDetailedStateLegislation(data.state);
  const legislationName = legislation?.name || `${data.state} Residential Tenancies Act`;
  const legislationSection = legislation?.conditionReport?.section || '';
  const legislationDesc = legislation?.conditionReport?.description || '';

  const typeLabel = data.inspectionType === 'entry' ? 'Entry' :
    data.inspectionType === 'exit' ? 'Exit' : 'Routine';

  // Property info section
  const infoSection = `
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Property:</span><span class="info-value">${escapeHtml(data.propertyAddress)}</span></div>
      <div class="info-item"><span class="info-label">State:</span><span class="info-value">${escapeHtml(data.state.toUpperCase())}</span></div>
      <div class="info-item"><span class="info-label">Inspector:</span><span class="info-value">${escapeHtml(data.inspectorName)}</span></div>
      <div class="info-item"><span class="info-label">Date:</span><span class="info-value">${formatDateAU(data.inspectionDate)}</span></div>
      ${data.tenantName ? `<div class="info-item"><span class="info-label">Tenant:</span><span class="info-value">${escapeHtml(data.tenantName)}</span></div>` : ''}
      <div class="info-item"><span class="info-label">Type:</span><span class="info-value">${typeLabel} Inspection</span></div>
    </div>
  `;

  // Room sections
  const roomSections = data.rooms.map((room, idx) => {
    // Photos grid
    const photosHtml = room.photos.length > 0 ? `
      <div class="photo-grid">
        ${room.photos.map(photo => `
          <div class="photo-item">
            <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.caption || room.name)}" />
            ${photo.compassBearing != null ? `<span class="photo-bearing">${compassLabel(photo.compassBearing)}</span>` : ''}
            ${photo.caption ? `<div class="photo-caption">${escapeHtml(photo.caption)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    ` : '';

    // Layout sketch
    const layoutHtml = room.layoutSketchUrl ? `
      <img class="layout-sketch" src="${escapeHtml(room.layoutSketchUrl)}" alt="Room layout" />
    ` : '';

    // Items table
    const itemsHtml = room.items.length > 0 ? `
      <table class="item-table">
        <thead>
          <tr>
            <th style="width:28%">Item</th>
            <th style="width:14%">Condition</th>
            <th>Notes</th>
            <th style="width:12%">Action</th>
          </tr>
        </thead>
        <tbody>
          ${room.items.map(item => `
            <tr>
              <td>${escapeHtml(item.name)}</td>
              <td class="condition-cell ${conditionClass(item.condition)}">${conditionLabel(item.condition)}</td>
              <td>${item.notes ? escapeHtml(item.notes) : '—'}</td>
              <td>
                ${item.actionRequired ? `<span class="action-flag">ACTION</span>` : '—'}
                ${item.actionDescription ? `<br/><span style="font-size:7pt">${escapeHtml(item.actionDescription)}</span>` : ''}
                ${item.estimatedCost ? `<br/><span style="font-size:7pt;color:#525252">Est: $${item.estimatedCost.toFixed(2)}</span>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p style="color:#6B7280;font-size:9pt">No items recorded for this room.</p>';

    const overallBadge = room.overallCondition
      ? `<span class="room-condition ${conditionClass(room.overallCondition)}">${conditionLabel(room.overallCondition)}</span>`
      : '';

    return `
      <div class="room">
        <div class="room-header">
          <h2>${idx + 1}. ${escapeHtml(room.name)}</h2>
          ${overallBadge}
        </div>
        <div class="room-body">
          ${layoutHtml}
          ${photosHtml}
          ${itemsHtml}
          ${room.tenantNotes ? `<p style="margin-top:6px;font-size:8pt;color:#525252"><strong>Tenant notes:</strong> ${escapeHtml(room.tenantNotes)}</p>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Tenant submissions section
  let submissionsHtml = '';
  if (data.tenantSubmissions && data.tenantSubmissions.length > 0) {
    const submissionCards = data.tenantSubmissions.map(sub => {
      const statusBadge = sub.status === 'approved' ? 'badge-approved' :
        sub.status === 'rejected' ? 'badge-rejected' : 'badge-pending';

      return `
        <div class="submission-card">
          <span class="submission-badge ${statusBadge}">${sub.status.toUpperCase()}</span>
          <strong>${escapeHtml(sub.roomName)}</strong> — ${escapeHtml(sub.type.replace('_', ' '))}
          ${sub.description ? `<p style="margin-top:4px">${escapeHtml(sub.description)}</p>` : ''}
          ${sub.originalDescription ? `<p style="font-size:8pt;color:#6B7280"><em>Original: ${escapeHtml(sub.originalDescription)}</em></p>` : ''}
          ${sub.imageUrl ? `<img src="${escapeHtml(sub.imageUrl)}" style="max-width:100px;max-height:75px;border-radius:3px;margin-top:4px" />` : ''}
          ${sub.reviewerNotes ? `<p style="font-size:8pt;margin-top:4px"><strong>Reviewer:</strong> ${escapeHtml(sub.reviewerNotes)}</p>` : ''}
        </div>
      `;
    }).join('');

    submissionsHtml = `
      <div class="submissions-section">
        <h2 style="font-size:12pt;color:#1B1464;margin-bottom:8px">Tenant Submissions</h2>
        ${submissionCards}
      </div>
    `;
  }

  // Disputes section
  let disputesHtml = '';
  if (data.disputes && data.disputes.length > 0) {
    const disputeCards = data.disputes.map(d => `
      <div class="dispute-card">
        <strong>${escapeHtml(d.roomName)} — ${escapeHtml(d.itemName)}</strong>
        <span style="float:right;font-size:7pt;font-weight:600">${escapeHtml(d.status.toUpperCase())}</span>
        <p style="margin-top:4px">${escapeHtml(d.reason)}</p>
        ${d.proposedCondition ? `<p style="font-size:8pt">Proposed condition: <strong>${escapeHtml(d.proposedCondition)}</strong></p>` : ''}
        ${d.ownerResponse ? `<p style="font-size:8pt;margin-top:4px"><strong>Owner response:</strong> ${escapeHtml(d.ownerResponse)}</p>` : ''}
        ${d.resolvedCondition ? `<p style="font-size:8pt"><strong>Resolved as:</strong> ${escapeHtml(d.resolvedCondition)}</p>` : ''}
      </div>
    `).join('');

    disputesHtml = `
      <div class="submissions-section">
        <h2 style="font-size:12pt;color:#DC2626;margin-bottom:8px">Disputes</h2>
        ${disputeCards}
      </div>
    `;
  }

  // Summary section
  const totalItems = data.rooms.reduce((sum, r) => sum + r.items.length, 0);
  const actionItems = data.rooms.reduce((sum, r) => sum + r.items.filter(i => i.actionRequired).length, 0);
  const totalPhotos = data.rooms.reduce((sum, r) => sum + r.photos.length, 0);

  const summarySection = `
    <div class="summary-section">
      <h2>Summary</h2>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Rooms:</span><span class="info-value">${data.rooms.length}</span></div>
        <div class="info-item"><span class="info-label">Items:</span><span class="info-value">${totalItems}</span></div>
        <div class="info-item"><span class="info-label">Photos:</span><span class="info-value">${totalPhotos}</span></div>
        <div class="info-item"><span class="info-label">Action Items:</span><span class="info-value" style="color:${actionItems > 0 ? '#DC2626' : '#16A34A'}">${actionItems}</span></div>
        ${data.overallCondition ? `<div class="info-item"><span class="info-label">Overall:</span><span class="info-value ${conditionClass(data.overallCondition)}" style="font-weight:600">${conditionLabel(data.overallCondition)}</span></div>` : ''}
      </div>
      ${data.summaryNotes ? `<p style="margin-top:8px;font-size:9pt">${escapeHtml(data.summaryNotes)}</p>` : ''}
    </div>
  `;

  // Signatures section
  const signaturesHtml = data.signatures.length > 0 ? `
    <div class="sig-block">
      <h2 style="font-size:12pt;color:#1B1464;margin-bottom:12px">Signatures</h2>
      <div class="sig-grid">
        ${data.signatures.map(sig => `
          <div class="sig-party">
            <h3>${sig.role === 'owner' ? 'Landlord / Agent' : 'Tenant'}</h3>
            ${sig.signatureUrl ? `<img class="sig-image" src="${escapeHtml(sig.signatureUrl)}" alt="Signature" />` : '<div class="sig-line"></div>'}
            <div class="sig-label">Signature</div>
            <div class="sig-line" style="height:auto;padding:4px 0;border:none">${escapeHtml(sig.name)}</div>
            <div class="sig-label">Name</div>
            <div class="sig-line" style="height:auto;padding:4px 0;border:none">${sig.signedAt ? formatDateAU(sig.signedAt) : ''}</div>
            <div class="sig-label">Date</div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  // Legislation note
  const legislationNote = legislationSection ? `
    <div class="legislation-note">
      <strong>Legislative reference:</strong> ${escapeHtml(legislationName)}, ${escapeHtml(legislationSection)}.<br/>
      ${legislationDesc ? escapeHtml(legislationDesc) : ''}
      ${legislation?.prescribedForms.find(f => f.type === 'condition_report')
        ? `<br/>Prescribed form: ${escapeHtml(legislation.prescribedForms.find(f => f.type === 'condition_report')!.formNumber)}`
        : ''}
    </div>
  ` : '';

  // Full document
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Condition Report — ${escapeHtml(data.propertyAddress)}</title>
<style>${REPORT_STYLES}</style>
</head>
<body>
<div class="doc">
  <div class="header">
    <h1>Condition Report</h1>
    <div class="sub">${escapeHtml(data.propertyAddress)}</div>
    <span class="badge ${typeBadgeClass(data.inspectionType)}">${typeLabel} Inspection</span>
  </div>

  ${infoSection}
  ${roomSections}
  ${submissionsHtml}
  ${disputesHtml}
  ${summarySection}
  ${signaturesHtml}
  ${legislationNote}

  <div class="footer">
    <p>Generated by <span class="brand">Casa</span> &mdash; AI-powered property management</p>
    <p>Generated ${formatDateAU(new Date().toISOString())}</p>
  </div>
</div>
</body>
</html>`;
}
