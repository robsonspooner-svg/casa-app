/**
 * Condition Report Generator
 *
 * Generates professional HTML condition reports for rental properties.
 * Output is designed for rendering via expo-print or conversion to PDF.
 * Styled with inline CSS for A4 print layout compatibility.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConditionRating = 'new' | 'good' | 'fair' | 'poor' | 'damaged';

export interface RoomItem {
  name: string;
  condition: ConditionRating;
  notes: string;
}

export interface RoomReport {
  name: string;
  items: RoomItem[];
}

export interface ConditionReportData {
  // Property
  propertyAddress: string;

  // Tenancy
  ownerName: string;
  tenantName: string;
  reportDate: string;
  reportType: 'entry' | 'exit';

  // Rooms
  rooms: RoomReport[];

  // General
  generalNotes?: string;
  meterReadings?: {
    electricity?: string;
    gas?: string;
    water?: string;
  };

  // Keys
  keysProvided?: {
    frontDoor?: number;
    backDoor?: number;
    garage?: number;
    mailbox?: number;
    other?: string;
  };
}

// ---------------------------------------------------------------------------
// Condition rating display config
// ---------------------------------------------------------------------------

const CONDITION_CONFIG: Record<
  ConditionRating,
  { label: string; color: string; bgColor: string }
> = {
  new: { label: 'New', color: '#15803d', bgColor: '#f0fdf4' },
  good: { label: 'Good', color: '#1d4ed8', bgColor: '#eff6ff' },
  fair: { label: 'Fair', color: '#a16207', bgColor: '#fefce8' },
  poor: { label: 'Poor', color: '#c2410c', bgColor: '#fff7ed' },
  damaged: { label: 'Damaged', color: '#dc2626', bgColor: '#fef2f2' },
};

// ---------------------------------------------------------------------------
// Default rooms
// ---------------------------------------------------------------------------

function items(names: string[]): RoomItem[] {
  return names.map((name) => ({ name, condition: 'good' as ConditionRating, notes: '' }));
}

export function getDefaultRooms(): RoomReport[] {
  return [
    {
      name: 'Entrance/Hallway',
      items: items([
        'Walls',
        'Ceiling',
        'Floor',
        'Light fixtures',
        'Front door',
        'Door locks',
        'Smoke alarm',
      ]),
    },
    {
      name: 'Living Room',
      items: items([
        'Walls',
        'Ceiling',
        'Floor',
        'Windows',
        'Blinds/Curtains',
        'Light fixtures',
        'Power points',
      ]),
    },
    {
      name: 'Kitchen',
      items: items([
        'Walls',
        'Ceiling',
        'Floor',
        'Benchtops',
        'Sink',
        'Oven/Cooktop',
        'Rangehood',
        'Dishwasher',
        'Cupboards',
        'Pantry',
      ]),
    },
    {
      name: 'Bedroom 1',
      items: items([
        'Walls',
        'Ceiling',
        'Floor',
        'Windows',
        'Blinds/Curtains',
        'Wardrobe',
        'Light fixtures',
      ]),
    },
    {
      name: 'Bedroom 2',
      items: items([
        'Walls',
        'Ceiling',
        'Floor',
        'Windows',
        'Blinds/Curtains',
        'Wardrobe',
        'Light fixtures',
      ]),
    },
    {
      name: 'Bathroom 1',
      items: items([
        'Walls',
        'Ceiling',
        'Floor',
        'Toilet',
        'Shower/Bath',
        'Vanity',
        'Mirror',
        'Exhaust fan',
        'Tiles',
      ]),
    },
    {
      name: 'Laundry',
      items: items(['Walls', 'Floor', 'Trough/Sink', 'Taps', 'Cupboards']),
    },
    {
      name: 'Outdoor/Garage',
      items: items([
        'Driveway',
        'Garage door',
        'Gardens',
        'Fencing',
        'Clothesline',
      ]),
    },
  ];
}

// ---------------------------------------------------------------------------
// HTML generation helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function conditionBadge(condition: ConditionRating): string {
  const cfg = CONDITION_CONFIG[condition];
  return `<span style="
    display: inline-block;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: ${cfg.color};
    background: ${cfg.bgColor};
    border: 1px solid ${cfg.color}20;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  ">${cfg.label}</span>`;
}

function renderRoomTable(room: RoomReport): string {
  const rows = room.items
    .map(
      (item, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #1a1a1a;">
          ${escapeHtml(item.name)}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          ${conditionBadge(item.condition)}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #525252;">
          ${item.notes ? escapeHtml(item.notes) : '&mdash;'}
        </td>
      </tr>`
    )
    .join('');

  return `
    <div style="margin-bottom: 24px; page-break-inside: avoid;">
      <h3 style="
        margin: 0 0 8px 0;
        padding: 8px 12px;
        font-size: 15px;
        font-weight: 700;
        color: #1B1464;
        background: #f0eef9;
        border-left: 4px solid #1B1464;
        border-radius: 0 4px 4px 0;
      ">${escapeHtml(room.name)}</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 4px;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; width: 30%;">Item</th>
            <th style="padding: 8px 12px; text-align: center; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; width: 20%;">Condition</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; width: 50%;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
}

function renderMeterReadings(
  meters: NonNullable<ConditionReportData['meterReadings']>
): string {
  const entries: { label: string; value: string }[] = [];
  if (meters.electricity) entries.push({ label: 'Electricity', value: meters.electricity });
  if (meters.gas) entries.push({ label: 'Gas', value: meters.gas });
  if (meters.water) entries.push({ label: 'Water', value: meters.water });

  if (entries.length === 0) return '';

  const rows = entries
    .map(
      (entry, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; font-weight: 600; color: #1a1a1a;">${escapeHtml(entry.label)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #525252;">${escapeHtml(entry.value)}</td>
      </tr>`
    )
    .join('');

  return `
    <div style="margin-bottom: 24px; page-break-inside: avoid;">
      <h3 style="
        margin: 0 0 8px 0;
        padding: 8px 12px;
        font-size: 15px;
        font-weight: 700;
        color: #1B1464;
        background: #f0eef9;
        border-left: 4px solid #1B1464;
        border-radius: 0 4px 4px 0;
      ">Meter Readings</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; width: 30%;">Meter</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; width: 70%;">Reading</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
}

function renderKeysSection(
  keys: NonNullable<ConditionReportData['keysProvided']>
): string {
  const entries: { label: string; value: string }[] = [];
  if (keys.frontDoor !== undefined) entries.push({ label: 'Front Door', value: String(keys.frontDoor) });
  if (keys.backDoor !== undefined) entries.push({ label: 'Back Door', value: String(keys.backDoor) });
  if (keys.garage !== undefined) entries.push({ label: 'Garage', value: String(keys.garage) });
  if (keys.mailbox !== undefined) entries.push({ label: 'Mailbox', value: String(keys.mailbox) });
  if (keys.other) entries.push({ label: 'Other', value: keys.other });

  if (entries.length === 0) return '';

  const rows = entries
    .map(
      (entry, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; font-weight: 600; color: #1a1a1a;">${escapeHtml(entry.label)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #525252;">${escapeHtml(entry.value)}</td>
      </tr>`
    )
    .join('');

  return `
    <div style="margin-bottom: 24px; page-break-inside: avoid;">
      <h3 style="
        margin: 0 0 8px 0;
        padding: 8px 12px;
        font-size: 15px;
        font-weight: 700;
        color: #1B1464;
        background: #f0eef9;
        border-left: 4px solid #1B1464;
        border-radius: 0 4px 4px 0;
      ">Keys Provided</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; width: 30%;">Key Type</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; width: 70%;">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
}

function renderGeneralNotes(notes: string): string {
  return `
    <div style="margin-bottom: 24px; page-break-inside: avoid;">
      <h3 style="
        margin: 0 0 8px 0;
        padding: 8px 12px;
        font-size: 15px;
        font-weight: 700;
        color: #1B1464;
        background: #f0eef9;
        border-left: 4px solid #1B1464;
        border-radius: 0 4px 4px 0;
      ">General Notes</h3>
      <div style="
        padding: 12px 16px;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        font-size: 13px;
        color: #525252;
        line-height: 1.6;
        background: #ffffff;
        white-space: pre-wrap;
      ">${escapeHtml(notes)}</div>
    </div>`;
}

function renderSignatureBlock(): string {
  return `
    <div style="margin-top: 40px; page-break-inside: avoid;">
      <h3 style="
        margin: 0 0 16px 0;
        padding: 8px 12px;
        font-size: 15px;
        font-weight: 700;
        color: #1B1464;
        background: #f0eef9;
        border-left: 4px solid #1B1464;
        border-radius: 0 4px 4px 0;
      ">Signatures</h3>
      <p style="font-size: 12px; color: #6b7280; margin: 0 0 20px 0;">
        By signing below, the parties acknowledge that this condition report accurately reflects the state of the property at the time of inspection.
      </p>
      <div style="display: flex; gap: 40px;">
        <div style="flex: 1;">
          <p style="font-size: 13px; font-weight: 600; color: #1a1a1a; margin: 0 0 40px 0;">Owner / Agent</p>
          <div style="border-bottom: 1px solid #1a1a1a; margin-bottom: 8px;"></div>
          <p style="font-size: 11px; color: #6b7280; margin: 0 0 4px 0;">Signature</p>
          <div style="margin-top: 20px;">
            <div style="border-bottom: 1px solid #1a1a1a; margin-bottom: 8px;"></div>
            <p style="font-size: 11px; color: #6b7280; margin: 0 0 4px 0;">Print Name</p>
          </div>
          <div style="margin-top: 20px;">
            <div style="border-bottom: 1px solid #1a1a1a; margin-bottom: 8px;"></div>
            <p style="font-size: 11px; color: #6b7280; margin: 0;">Date</p>
          </div>
        </div>
        <div style="flex: 1;">
          <p style="font-size: 13px; font-weight: 600; color: #1a1a1a; margin: 0 0 40px 0;">Tenant</p>
          <div style="border-bottom: 1px solid #1a1a1a; margin-bottom: 8px;"></div>
          <p style="font-size: 11px; color: #6b7280; margin: 0 0 4px 0;">Signature</p>
          <div style="margin-top: 20px;">
            <div style="border-bottom: 1px solid #1a1a1a; margin-bottom: 8px;"></div>
            <p style="font-size: 11px; color: #6b7280; margin: 0 0 4px 0;">Print Name</p>
          </div>
          <div style="margin-top: 20px;">
            <div style="border-bottom: 1px solid #1a1a1a; margin-bottom: 8px;"></div>
            <p style="font-size: 11px; color: #6b7280; margin: 0;">Date</p>
          </div>
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Main HTML generator
// ---------------------------------------------------------------------------

export function generateConditionReportHTML(data: ConditionReportData): string {
  const reportTypeLabel = data.reportType === 'entry' ? 'Entry' : 'Exit';
  const generatedDate = new Date().toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const roomSections = data.rooms.map(renderRoomTable).join('');

  const meterSection =
    data.meterReadings ? renderMeterReadings(data.meterReadings) : '';

  const keysSection =
    data.keysProvided ? renderKeysSection(data.keysProvided) : '';

  const notesSection =
    data.generalNotes ? renderGeneralNotes(data.generalNotes) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Condition Report - ${escapeHtml(data.propertyAddress)}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1a1a1a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 24px;
    }
    @media print {
      .page-container {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="page-container">

    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #1B1464;">
      <h1 style="margin: 0 0 4px 0; font-size: 26px; font-weight: 800; color: #1B1464; letter-spacing: 1px;">
        CONDITION REPORT
      </h1>
      <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #4338CA; text-transform: uppercase; letter-spacing: 0.5px;">
        ${reportTypeLabel} Report
      </p>
      <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">
        ${escapeHtml(data.propertyAddress)}
      </p>
      <p style="margin: 0; font-size: 13px; color: #6b7280;">
        Report Date: ${escapeHtml(data.reportDate)}
      </p>
    </div>

    <!-- Parties -->
    <div style="
      display: flex;
      gap: 16px;
      margin-bottom: 28px;
      page-break-inside: avoid;
    ">
      <div style="
        flex: 1;
        padding: 14px 16px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
      ">
        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Owner / Agent</p>
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1a1a1a;">${escapeHtml(data.ownerName)}</p>
      </div>
      <div style="
        flex: 1;
        padding: 14px 16px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
      ">
        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Tenant</p>
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1a1a1a;">${escapeHtml(data.tenantName)}</p>
      </div>
    </div>

    <!-- Condition Legend -->
    <div style="
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 24px;
      padding: 10px 16px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      align-items: center;
    ">
      <span style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 4px;">Condition Key:</span>
      ${conditionBadge('new')}
      ${conditionBadge('good')}
      ${conditionBadge('fair')}
      ${conditionBadge('poor')}
      ${conditionBadge('damaged')}
    </div>

    <!-- Room Sections -->
    ${roomSections}

    <!-- Meter Readings -->
    ${meterSection}

    <!-- Keys -->
    ${keysSection}

    <!-- General Notes -->
    ${notesSection}

    <!-- Signatures -->
    ${renderSignatureBlock()}

    <!-- Footer -->
    <div style="
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
    ">
      <p style="margin: 0; font-size: 11px; color: #a3a3a3;">
        Generated by Casa &middot; ${escapeHtml(generatedDate)}
      </p>
    </div>

  </div>
</body>
</html>`;
}
