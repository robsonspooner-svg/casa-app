// Generate Inspection Report - Supabase Edge Function
// Casa - Mission 11: Property Inspections & Condition Reports
//
// Generates a comprehensive HTML condition report from inspection data,
// stores it in Supabase Storage, and updates the inspection record.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerateReportRequest {
  inspection_id: string;
}

type ConditionRating =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'damaged'
  | 'missing'
  | 'not_applicable';

interface InspectionImage {
  id: string;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  room_id: string | null;
  item_id: string | null;
}

interface InspectionItem {
  id: string;
  name: string;
  display_order: number;
  condition: ConditionRating | null;
  notes: string | null;
  action_required: boolean;
  action_description: string | null;
  estimated_cost: number | null;
  entry_condition: ConditionRating | null;
  condition_changed: boolean;
}

interface InspectionRoom {
  id: string;
  name: string;
  display_order: number;
  overall_condition: ConditionRating | null;
  notes: string | null;
  items: InspectionItem[];
  images: InspectionImage[];
}

interface InspectionData {
  id: string;
  inspection_type: string;
  scheduled_date: string;
  actual_date: string | null;
  status: string;
  overall_condition: ConditionRating | null;
  summary_notes: string | null;
  action_items: string[] | null;
  tenant_acknowledged: boolean;
  tenant_acknowledged_at: string | null;
  completed_at: string | null;
  property: {
    id: string;
    owner_id: string;
    address_line_1: string;
    address_line_2: string | null;
    suburb: string;
    state: string;
    postcode: string;
  };
  inspector: {
    id: string;
    full_name: string | null;
    email: string;
  };
  tenancy: {
    id: string;
    tenancy_tenants: Array<{
      tenant_id: string;
      profiles: {
        full_name: string | null;
        email: string;
      };
    }>;
  } | null;
  rooms: InspectionRoom[];
}

// ---------------------------------------------------------------------------
// Condition rating display config
// ---------------------------------------------------------------------------

const CONDITION_CONFIG: Record<
  ConditionRating,
  { label: string; color: string; bgColor: string }
> = {
  excellent: { label: 'Excellent', color: '#047857', bgColor: '#ecfdf5' },
  good: { label: 'Good', color: '#1d4ed8', bgColor: '#eff6ff' },
  fair: { label: 'Fair', color: '#a16207', bgColor: '#fefce8' },
  poor: { label: 'Poor', color: '#c2410c', bgColor: '#fff7ed' },
  damaged: { label: 'Damaged', color: '#dc2626', bgColor: '#fef2f2' },
  missing: { label: 'Missing', color: '#7c3aed', bgColor: '#f5f3ff' },
  not_applicable: { label: 'N/A', color: '#6b7280', bgColor: '#f9fafb' },
};

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function conditionBadge(condition: ConditionRating | null): string {
  if (!condition) {
    return '<span style="color: #9ca3af; font-size: 11px;">Not assessed</span>';
  }
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

function formatAddress(property: InspectionData['property']): string {
  const parts = [property.address_line_1];
  if (property.address_line_2) parts.push(property.address_line_2);
  parts.push(`${property.suburb} ${property.state} ${property.postcode}`);
  return parts.join(', ');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatInspectionType(type: string): string {
  const labels: Record<string, string> = {
    routine: 'Routine Inspection',
    entry: 'Entry Condition Report',
    exit: 'Exit Condition Report',
    pre_listing: 'Pre-Listing Inspection',
    maintenance: 'Maintenance Inspection',
    complaint: 'Complaint Inspection',
  };
  return labels[type] || type;
}

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

function renderRoomSection(room: InspectionRoom): string {
  const itemRows = room.items
    .sort((a, b) => a.display_order - b.display_order)
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

  const roomImages = room.images.filter((img) => img.room_id === room.id);
  const photoSection =
    roomImages.length > 0
      ? `
      <div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px;">
        ${roomImages
          .map(
            (img) => `
          <div style="width: 120px; text-align: center;">
            <img src="${escapeHtml(img.thumbnail_url || img.url)}" alt="${escapeHtml(img.caption || 'Inspection photo')}"
              style="width: 120px; height: 90px; object-fit: cover; border-radius: 4px; border: 1px solid #e5e7eb;" />
            ${img.caption ? `<p style="margin: 4px 0 0 0; font-size: 10px; color: #6b7280;">${escapeHtml(img.caption)}</p>` : ''}
          </div>`
          )
          .join('')}
      </div>`
      : '';

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
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <span>${escapeHtml(room.name)}</span>
        ${room.overall_condition ? `<span style="font-size: 12px; font-weight: 400;">${conditionBadge(room.overall_condition)}</span>` : ''}
      </h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 4px;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; width: 30%;">Item</th>
            <th style="padding: 8px 12px; text-align: center; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; width: 20%;">Condition</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; width: 50%;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
      ${room.notes ? `<p style="margin: 8px 0 0 12px; font-size: 12px; color: #525252;"><strong>Room notes:</strong> ${escapeHtml(room.notes)}</p>` : ''}
      ${photoSection}
    </div>`;
}

function renderActionItems(items: string[]): string {
  if (items.length === 0) return '';

  const listItems = items
    .map(
      (item) => `
      <li style="margin-bottom: 6px; font-size: 13px; color: #525252;">
        ${escapeHtml(item)}
      </li>`
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
      ">Action Items</h3>
      <ol style="margin: 0; padding: 0 0 0 24px;">
        ${listItems}
      </ol>
    </div>`;
}

function renderSummaryNotes(notes: string): string {
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
      ">Summary Notes</h3>
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

function renderSignatureBlock(
  ownerName: string,
  tenantNames: string[]
): string {
  const tenantSection = tenantNames.length > 0
    ? tenantNames
        .map(
          (name) => `
        <div style="flex: 1; min-width: 200px;">
          <p style="font-size: 13px; font-weight: 600; color: #1a1a1a; margin: 0 0 40px 0;">Tenant: ${escapeHtml(name)}</p>
          <div style="border-bottom: 1px solid #1a1a1a; margin-bottom: 8px;"></div>
          <p style="font-size: 11px; color: #6b7280; margin: 0 0 4px 0;">Signature</p>
          <div style="margin-top: 20px;">
            <div style="border-bottom: 1px solid #1a1a1a; margin-bottom: 8px;"></div>
            <p style="font-size: 11px; color: #6b7280; margin: 0;">Date</p>
          </div>
        </div>`
        )
        .join('')
    : `
        <div style="flex: 1; min-width: 200px;">
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
        </div>`;

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
      ">Acknowledgment &amp; Signatures</h3>
      <p style="font-size: 12px; color: #6b7280; margin: 0 0 20px 0;">
        By signing below, the parties acknowledge that this condition report accurately reflects
        the state of the property at the time of inspection.
      </p>
      <div style="display: flex; gap: 40px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 200px;">
          <p style="font-size: 13px; font-weight: 600; color: #1a1a1a; margin: 0 0 40px 0;">Owner / Agent: ${escapeHtml(ownerName)}</p>
          <div style="border-bottom: 1px solid #1a1a1a; margin-bottom: 8px;"></div>
          <p style="font-size: 11px; color: #6b7280; margin: 0 0 4px 0;">Signature</p>
          <div style="margin-top: 20px;">
            <div style="border-bottom: 1px solid #1a1a1a; margin-bottom: 8px;"></div>
            <p style="font-size: 11px; color: #6b7280; margin: 0;">Date</p>
          </div>
        </div>
        ${tenantSection}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Main HTML generator
// ---------------------------------------------------------------------------

function generateInspectionReportHTML(data: InspectionData): string {
  const address = formatAddress(data.property);
  const inspectionTypeLabel = formatInspectionType(data.inspection_type);
  const reportDate = formatDate(data.actual_date || data.scheduled_date);
  const generatedDate = new Date().toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const ownerName = data.inspector.full_name || data.inspector.email;
  const tenantNames: string[] = [];
  if (data.tenancy?.tenancy_tenants) {
    for (const tt of data.tenancy.tenancy_tenants) {
      tenantNames.push(tt.profiles.full_name || tt.profiles.email);
    }
  }

  const roomSections = data.rooms
    .sort((a, b) => a.display_order - b.display_order)
    .map(renderRoomSection)
    .join('');

  const summarySection = data.summary_notes
    ? renderSummaryNotes(data.summary_notes)
    : '';

  const actionSection =
    data.action_items && data.action_items.length > 0
      ? renderActionItems(data.action_items)
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(inspectionTypeLabel)} - ${escapeHtml(address)}</title>
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
        ${escapeHtml(inspectionTypeLabel).toUpperCase()}
      </h1>
      <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">
        ${escapeHtml(address)}
      </p>
      <p style="margin: 0; font-size: 13px; color: #6b7280;">
        Inspection Date: ${escapeHtml(reportDate)}
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
        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Inspector / Owner</p>
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1a1a1a;">${escapeHtml(ownerName)}</p>
      </div>
      <div style="
        flex: 1;
        padding: 14px 16px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
      ">
        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Tenant(s)</p>
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1a1a1a;">${tenantNames.length > 0 ? escapeHtml(tenantNames.join(', ')) : 'N/A'}</p>
      </div>
    </div>

    <!-- Overall Condition -->
    ${data.overall_condition ? `
    <div style="
      margin-bottom: 24px;
      padding: 14px 16px;
      background: #f0eef9;
      border: 1px solid #d4d0ec;
      border-radius: 6px;
      text-align: center;
      page-break-inside: avoid;
    ">
      <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Overall Property Condition</p>
      <p style="margin: 0;">${conditionBadge(data.overall_condition)}</p>
    </div>` : ''}

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
      ${conditionBadge('excellent')}
      ${conditionBadge('good')}
      ${conditionBadge('fair')}
      ${conditionBadge('poor')}
      ${conditionBadge('damaged')}
      ${conditionBadge('missing')}
    </div>

    <!-- Room Sections -->
    ${roomSections}

    <!-- Summary Notes -->
    ${summarySection}

    <!-- Action Items -->
    ${actionSection}

    <!-- Signatures -->
    ${renderSignatureBlock(ownerName, tenantNames)}

    <!-- Footer -->
    <div style="
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
    ">
      <p style="margin: 0 0 4px 0; font-size: 11px; color: #a3a3a3;">
        Generated by Casa &middot; ${escapeHtml(generatedDate)}
      </p>
      <p style="margin: 0; font-size: 10px; color: #d1d5db;">
        Inspection ID: ${escapeHtml(data.id)} &middot; Status: ${escapeHtml(data.status)}
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Edge Function handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceClient();

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate the user via JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: GenerateReportRequest = await req.json();
    const { inspection_id } = body;

    if (!inspection_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: inspection_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch inspection with property data
    const { data: inspection, error: inspectionError } = await supabase
      .from('inspections')
      .select(`
        id,
        inspection_type,
        scheduled_date,
        actual_date,
        status,
        overall_condition,
        summary_notes,
        action_items,
        tenant_acknowledged,
        tenant_acknowledged_at,
        completed_at,
        property:properties!inner (
          id,
          owner_id,
          address_line_1,
          address_line_2,
          suburb,
          state,
          postcode
        ),
        inspector:profiles!inspector_id (
          id,
          full_name,
          email
        ),
        tenancy:tenancies (
          id,
          tenancy_tenants (
            tenant_id,
            profiles (
              full_name,
              email
            )
          )
        )
      `)
      .eq('id', inspection_id)
      .single();

    if (inspectionError || !inspection) {
      return new Response(
        JSON.stringify({ error: 'Inspection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the requesting user is the property owner or the inspector
    const property = inspection.property as any;
    if (property.owner_id !== user.id && (inspection.inspector as any).id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Access denied: you are not the owner or inspector for this inspection' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch rooms with items
    const { data: rooms, error: roomsError } = await supabase
      .from('inspection_rooms')
      .select(`
        id,
        name,
        display_order,
        overall_condition,
        notes
      `)
      .eq('inspection_id', inspection_id)
      .order('display_order', { ascending: true });

    if (roomsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch inspection rooms' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all items for all rooms in one query
    const roomIds = (rooms || []).map((r: any) => r.id);
    let allItems: any[] = [];
    if (roomIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from('inspection_items')
        .select(`
          id,
          room_id,
          name,
          display_order,
          condition,
          notes,
          action_required,
          action_description,
          estimated_cost,
          entry_condition,
          condition_changed
        `)
        .in('room_id', roomIds)
        .order('display_order', { ascending: true });

      if (itemsError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch inspection items' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      allItems = items || [];
    }

    // Fetch all images for this inspection
    const { data: allImages, error: imagesError } = await supabase
      .from('inspection_images')
      .select(`
        id,
        room_id,
        item_id,
        url,
        thumbnail_url,
        caption
      `)
      .eq('inspection_id', inspection_id)
      .order('created_at', { ascending: true });

    if (imagesError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch inspection images' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Assemble rooms with their items and images
    const assembledRooms: InspectionRoom[] = (rooms || []).map((room: any) => ({
      ...room,
      items: allItems.filter((item: any) => item.room_id === room.id),
      images: (allImages || []).filter((img: any) => img.room_id === room.id),
    }));

    // Build the full inspection data object
    const inspectionData: InspectionData = {
      id: inspection.id,
      inspection_type: inspection.inspection_type,
      scheduled_date: inspection.scheduled_date,
      actual_date: inspection.actual_date,
      status: inspection.status,
      overall_condition: inspection.overall_condition as ConditionRating | null,
      summary_notes: inspection.summary_notes,
      action_items: inspection.action_items,
      tenant_acknowledged: inspection.tenant_acknowledged,
      tenant_acknowledged_at: inspection.tenant_acknowledged_at,
      completed_at: inspection.completed_at,
      property: property,
      inspector: inspection.inspector as any,
      tenancy: inspection.tenancy as any,
      rooms: assembledRooms,
    };

    // Generate the HTML report
    const html = generateInspectionReportHTML(inspectionData);

    // Store in Supabase Storage
    const storagePath = `${property.owner_id}/${inspection_id}/report.html`;
    const { error: uploadError } = await supabase.storage
      .from('inspection-reports')
      .upload(storagePath, new Blob([html], { type: 'text/html' }), {
        contentType: 'text/html',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to store report: ' + uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the public URL for the stored report
    const { data: urlData } = supabase.storage
      .from('inspection-reports')
      .getPublicUrl(storagePath);

    const reportUrl = urlData.publicUrl;

    // Update the inspection record with the report URL and generation timestamp
    const { error: updateError } = await supabase
      .from('inspections')
      .update({
        report_url: reportUrl,
        report_generated_at: new Date().toISOString(),
      })
      .eq('id', inspection_id);

    if (updateError) {
      console.error('Failed to update inspection record:', updateError);
      // Report was generated and stored, so return success with a warning
    }

    return new Response(
      JSON.stringify({
        success: true,
        report_url: reportUrl,
        inspection_id: inspection_id,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating inspection report:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
