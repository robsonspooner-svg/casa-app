// Generate Report - Supabase Edge Function
// Casa - Mission 13: Reports & Analytics
//
// Generates PDF/CSV/XLSX reports from financial data,
// stores them in Supabase Storage, and updates the generated_reports record.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

interface GenerateReportRequest {
  report_id: string;
}

// ---------------------------------------------------------------------------
// Report data fetchers
// ---------------------------------------------------------------------------

async function fetchFinancialSummaryData(sb: any, ownerId: string, dateFrom: string, dateTo: string, propertyIds: string[] | null) {
  // Fetch the materialized view data (includes work_order expenses and manual_expenses)
  let query = sb.from('financial_summary').select('*').eq('owner_id', ownerId);
  if (dateFrom) query = query.gte('month', dateFrom);
  if (dateTo) query = query.lte('month', dateTo);
  if (propertyIds?.length) query = query.in('property_id', propertyIds);
  const { data } = await query.order('month', { ascending: true });

  // Fetch maintenance_requests.actual_cost that are NOT already captured via work_orders.
  // Work orders linked to maintenance_requests already flow through the financial_summary view.
  // We need to capture maintenance requests that have actual_cost set directly but
  // have no corresponding work_order, so those costs are not double-counted.
  let mrQuery = sb.from('maintenance_requests')
    .select('property_id, actual_cost, actual_completion_date, updated_at, id')
    .eq('status', 'completed')
    .not('actual_cost', 'is', null)
    .gt('actual_cost', 0);
  if (propertyIds?.length) mrQuery = mrQuery.in('property_id', propertyIds);
  const { data: maintenanceData } = await mrQuery;

  // Find maintenance requests that DO have a linked work_order so we can exclude them
  const mrIds = (maintenanceData || []).map((mr: any) => mr.id);
  let linkedWoIds = new Set<string>();
  if (mrIds.length > 0) {
    const { data: linkedWos } = await sb.from('work_orders')
      .select('maintenance_request_id')
      .in('maintenance_request_id', mrIds)
      .eq('status', 'completed');
    linkedWoIds = new Set((linkedWos || []).map((wo: any) => wo.maintenance_request_id));
  }

  // Filter to only maintenance requests without a linked completed work order
  const unlinkedMaintenance = (maintenanceData || []).filter(
    (mr: any) => !linkedWoIds.has(mr.id)
  );

  // Merge unlinked maintenance costs into the financial summary rows
  // Group by property_id + month
  const maintenanceCostMap = new Map<string, number>();
  for (const mr of unlinkedMaintenance) {
    const costDate = mr.actual_completion_date || mr.updated_at?.slice(0, 10);
    if (!costDate) continue;
    const monthKey = costDate.slice(0, 7) + '-01'; // YYYY-MM-01
    const key = `${mr.property_id}|${monthKey}`;
    maintenanceCostMap.set(key, (maintenanceCostMap.get(key) || 0) + Number(mr.actual_cost));
  }

  // Augment the financial summary rows with the additional maintenance costs
  const financials = (data || []).map((row: any) => {
    const monthStr = row.month ? new Date(row.month).toISOString().slice(0, 7) + '-01' : null;
    const key = `${row.property_id}|${monthStr}`;
    const additionalMaintenance = maintenanceCostMap.get(key) || 0;
    if (additionalMaintenance > 0) {
      return {
        ...row,
        maintenance_expenses: Number(row.maintenance_expenses || 0) + additionalMaintenance,
        total_expenses: Number(row.total_expenses || 0) + additionalMaintenance,
        net_position: Number(row.net_position || 0) - additionalMaintenance,
      };
    }
    return row;
  });

  // Remove entries from the map that were already merged
  for (const row of data || []) {
    const monthStr = row.month ? new Date(row.month).toISOString().slice(0, 7) + '-01' : null;
    const key = `${row.property_id}|${monthStr}`;
    maintenanceCostMap.delete(key);
  }

  // Any remaining entries in the map are for property+month combos not in the materialized view
  // (i.e. months where there were maintenance costs but no payments or other data)
  // We need to add new rows for these
  for (const [key, amount] of maintenanceCostMap) {
    const [propertyId, monthStr] = key.split('|');
    financials.push({
      owner_id: ownerId,
      property_id: propertyId,
      address_line_1: null, // Will be filled from properties lookup below
      month: monthStr,
      rent_collected: 0,
      bond_collected: 0,
      other_income: 0,
      platform_fees: 0,
      payment_processing_fees: 0,
      net_income: 0,
      completed_payments: 0,
      failed_payments: 0,
      maintenance_expenses: amount,
      manual_expenses_total: 0,
      total_expenses: amount,
      net_position: -amount,
    });
  }

  const { data: properties } = await sb.from('properties')
    .select('id, address_line_1, suburb, state')
    .eq('owner_id', ownerId).eq('deleted_at', null);

  // Fill in missing address_line_1 for any newly added rows
  const propertyMap = new Map((properties || []).map((p: any) => [p.id, p.address_line_1]));
  for (const row of financials) {
    if (!row.address_line_1 && row.property_id) {
      row.address_line_1 = propertyMap.get(row.property_id) || 'Unknown';
    }
  }

  // Sort by month
  financials.sort((a: any, b: any) => (a.month || '').localeCompare(b.month || ''));

  return { financials, properties: properties || [] };
}

async function fetchTaxSummaryData(sb: any, ownerId: string, dateFrom: string, dateTo: string) {
  const [incomeResult, expenseResult, maintenanceResult] = await Promise.all([
    sb.from('payments').select('amount, payment_type, paid_at')
      .eq('status', 'completed')
      .gte('paid_at', dateFrom).lte('paid_at', dateTo),
    sb.from('manual_expenses').select('amount, description, is_tax_deductible, tax_category, expense_date')
      .eq('owner_id', ownerId)
      .gte('expense_date', dateFrom).lte('expense_date', dateTo)
      .order('expense_date', { ascending: true }),
    // Fetch completed maintenance requests with actual_cost
    sb.from('maintenance_requests')
      .select('actual_cost, title, actual_completion_date, updated_at, category, property_id, properties!inner(owner_id)')
      .eq('properties.owner_id', ownerId)
      .eq('status', 'completed')
      .not('actual_cost', 'is', null)
      .gt('actual_cost', 0)
      .gte('updated_at', dateFrom).lte('updated_at', dateTo),
  ]);

  // Map maintenance requests into the same shape as manual_expenses
  const maintenanceExpenses = (maintenanceResult.data || []).map((mr: any) => ({
    amount: mr.actual_cost,
    description: `Maintenance: ${mr.title}`,
    is_tax_deductible: true,
    tax_category: 'repairs',
    expense_date: mr.actual_completion_date || mr.updated_at?.slice(0, 10),
    source: 'maintenance',
  }));

  const manualExpenses = (expenseResult.data || []).map((e: any) => ({
    ...e,
    source: 'manual',
  }));

  return {
    income: incomeResult.data || [],
    expenses: [...manualExpenses, ...maintenanceExpenses].sort(
      (a: any, b: any) => (a.expense_date || '').localeCompare(b.expense_date || '')
    ),
  };
}

async function fetchPropertyPerformanceData(sb: any, ownerId: string, propertyIds: string[] | null) {
  let query = sb.from('property_metrics').select('*').eq('owner_id', ownerId);
  if (propertyIds?.length) query = query.in('property_id', propertyIds);
  const { data } = await query.order('address_line_1', { ascending: true });
  return { metrics: data || [] };
}

async function fetchCashFlowData(sb: any, ownerId: string, dateFrom: string, dateTo: string, propertyIds: string[] | null) {
  const { data: monthlyData } = await (sb.rpc as any)('get_monthly_financials', {
    p_owner_id: ownerId,
    p_months: 12,
    p_property_id: propertyIds?.length === 1 ? propertyIds[0] : null,
  });
  return { monthly: monthlyData || [] };
}

async function fetchMaintenanceSummaryData(sb: any, ownerId: string, dateFrom: string, dateTo: string) {
  const { data: requests } = await sb.from('maintenance_requests')
    .select('id, title, status, urgency, actual_cost, created_at, resolved_at, properties!inner(owner_id, address_line_1)')
    .eq('properties.owner_id', ownerId)
    .gte('created_at', dateFrom).lte('created_at', dateTo)
    .order('created_at', { ascending: false });

  return { requests: requests || [] };
}

// ---------------------------------------------------------------------------
// CSV generation
// ---------------------------------------------------------------------------

function escapeCSV(value: any): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateFinancialCSV(data: any): string {
  const rows = [['Month', 'Property', 'Rent Collected', 'Bond Collected', 'Other Income', 'Platform Fees', 'Processing Fees', 'Maintenance Expenses', 'Manual Expenses', 'Total Expenses', 'Net Income', 'Net Position']];
  for (const row of data.financials) {
    rows.push([
      row.month ? new Date(row.month).toISOString().slice(0, 7) : '',
      row.address_line_1 || 'All Properties',
      row.rent_collected || '0',
      row.bond_collected || '0',
      row.other_income || '0',
      row.platform_fees || '0',
      row.payment_processing_fees || '0',
      row.maintenance_expenses || '0',
      row.manual_expenses_total || '0',
      row.total_expenses || '0',
      row.net_income || '0',
      row.net_position || '0',
    ]);
  }
  return rows.map(r => r.map(escapeCSV).join(',')).join('\n');
}

function generateTaxCSV(data: any): string {
  const incomeRows = [['Type', 'Date', 'Amount']];
  for (const item of data.income) {
    incomeRows.push([item.payment_type, item.paid_at?.slice(0, 10) || '', item.amount]);
  }

  const expenseRows = [['', '', ''], ['EXPENSES', '', ''], ['Description', 'Date', 'Amount', 'Category', 'Tax Deductible']];
  for (const item of data.expenses) {
    expenseRows.push([item.description, item.expense_date, item.amount, item.tax_category || '', item.is_tax_deductible ? 'Yes' : 'No']);
  }

  const allRows = [['INCOME'], ...incomeRows, ...expenseRows];
  return allRows.map(r => r.map(escapeCSV).join(',')).join('\n');
}

function generatePropertyPerformanceCSV(data: any): string {
  const rows = [['Property', 'Suburb', 'State', 'Vacant', 'Current Rent', 'Income 12m', 'Maintenance Cost 12m', 'Open Maintenance', 'Current Arrears', 'Lease Expiry']];
  for (const m of data.metrics) {
    rows.push([
      m.address_line_1, m.suburb, m.state,
      m.is_vacant ? 'Yes' : 'No',
      m.current_rent || '0',
      m.total_income_12m || '0',
      m.maintenance_cost_12m || '0',
      m.open_maintenance_requests || '0',
      m.current_arrears || '0',
      m.lease_end_date || 'N/A',
    ]);
  }
  return rows.map(r => r.map(escapeCSV).join(',')).join('\n');
}

function generateCashFlowCSV(data: any): string {
  const rows = [['Month', 'Income', 'Expenses', 'Fees', 'Net Cash Flow']];
  for (const m of data.monthly) {
    const net = Number(m.income) - Number(m.expenses) - Number(m.fees);
    rows.push([m.month_label, m.income, m.expenses, m.fees, String(net)]);
  }
  return rows.map(r => r.map(escapeCSV).join(',')).join('\n');
}

function generateMaintenanceCSV(data: any): string {
  const rows = [['Title', 'Property', 'Status', 'Urgency', 'Cost', 'Created', 'Resolved']];
  for (const r of data.requests) {
    rows.push([
      r.title, r.properties?.address_line_1 || '', r.status, r.urgency,
      r.actual_cost || '0', r.created_at?.slice(0, 10) || '', r.resolved_at?.slice(0, 10) || '',
    ]);
  }
  return rows.map(r => r.map(escapeCSV).join(',')).join('\n');
}

// ---------------------------------------------------------------------------
// HTML report generation (for PDF)
// ---------------------------------------------------------------------------

function formatAUD(amount: number): string {
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function generateFinancialHTML(data: any, report: any): string {
  const totalIncome = data.financials.reduce((s: number, r: any) => s + Number(r.rent_collected || 0) + Number(r.bond_collected || 0) + Number(r.other_income || 0), 0);
  const totalFees = data.financials.reduce((s: number, r: any) => s + Number(r.platform_fees || 0) + Number(r.payment_processing_fees || 0), 0);
  const totalMaintenanceExpenses = data.financials.reduce((s: number, r: any) => s + Number(r.maintenance_expenses || 0), 0);
  const totalManualExpenses = data.financials.reduce((s: number, r: any) => s + Number(r.manual_expenses_total || 0), 0);
  const totalExpenses = totalFees + totalMaintenanceExpenses + totalManualExpenses;
  const netPosition = totalIncome - totalExpenses;

  let propertyRows = '';
  const byProperty = new Map<string, { income: number; fees: number; maintenance: number; manual: number; net: number }>();
  for (const row of data.financials) {
    const key = row.address_line_1 || 'Unknown';
    const existing = byProperty.get(key) || { income: 0, fees: 0, maintenance: 0, manual: 0, net: 0 };
    existing.income += Number(row.rent_collected || 0) + Number(row.bond_collected || 0) + Number(row.other_income || 0);
    existing.fees += Number(row.platform_fees || 0) + Number(row.payment_processing_fees || 0);
    existing.maintenance += Number(row.maintenance_expenses || 0);
    existing.manual += Number(row.manual_expenses_total || 0);
    existing.net = existing.income - existing.fees - existing.maintenance - existing.manual;
    byProperty.set(key, existing);
  }
  for (const [address, totals] of byProperty) {
    const totalPropertyExpenses = totals.fees + totals.maintenance + totals.manual;
    propertyRows += `<tr><td>${address}</td><td style="text-align:right;color:#22C55E">${formatAUD(totals.income)}</td><td style="text-align:right;color:#EF4444">${formatAUD(totalPropertyExpenses)}</td><td style="text-align:right;color:#EF4444">${formatAUD(totals.maintenance)}</td><td style="text-align:right;font-weight:600">${formatAUD(totals.net)}</td></tr>`;
  }

  return generateHTMLWrapper('Financial Summary', report, `
    <div class="summary-row">
      <div class="summary-card green"><div class="label">Total Income</div><div class="value">${formatAUD(totalIncome)}</div></div>
      <div class="summary-card red"><div class="label">Total Expenses</div><div class="value">${formatAUD(totalExpenses)}</div></div>
      <div class="summary-card ${netPosition >= 0 ? 'green' : 'red'}"><div class="label">Net Position</div><div class="value">${formatAUD(netPosition)}</div></div>
    </div>
    <div class="summary-row">
      <div class="summary-card red"><div class="label">Fees</div><div class="value">${formatAUD(totalFees)}</div></div>
      <div class="summary-card red"><div class="label">Maintenance</div><div class="value">${formatAUD(totalMaintenanceExpenses)}</div></div>
      <div class="summary-card red"><div class="label">Other Expenses</div><div class="value">${formatAUD(totalManualExpenses)}</div></div>
    </div>
    <h3>Per-Property Breakdown</h3>
    <table><thead><tr><th>Property</th><th>Income</th><th>Expenses</th><th>Maintenance</th><th>Net</th></tr></thead><tbody>${propertyRows}</tbody></table>
  `);
}

function generateTaxHTML(data: any, report: any): string {
  const totalRentalIncome = data.income.filter((i: any) => i.payment_type === 'rent').reduce((s: number, i: any) => s + Number(i.amount), 0);
  const totalDeductible = data.expenses.filter((e: any) => e.is_tax_deductible).reduce((s: number, e: any) => s + Number(e.amount), 0);
  const taxableIncome = totalRentalIncome - totalDeductible;

  const categoryTotals = new Map<string, number>();
  for (const e of data.expenses) {
    if (e.is_tax_deductible) {
      const cat = e.tax_category || 'other';
      categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + Number(e.amount));
    }
  }
  let categoryRows = '';
  for (const [cat, total] of categoryTotals) {
    categoryRows += `<tr><td style="text-transform:capitalize">${cat.replace(/_/g, ' ')}</td><td style="text-align:right">${formatAUD(total)}</td></tr>`;
  }

  return generateHTMLWrapper('Tax Summary (ATO)', report, `
    <div class="summary-row">
      <div class="summary-card green"><div class="label">Rental Income</div><div class="value">${formatAUD(totalRentalIncome)}</div></div>
      <div class="summary-card red"><div class="label">Deductible Expenses</div><div class="value">${formatAUD(totalDeductible)}</div></div>
      <div class="summary-card ${taxableIncome >= 0 ? 'green' : 'red'}"><div class="label">Net Taxable Income</div><div class="value">${formatAUD(taxableIncome)}</div></div>
    </div>
    <h3>Deductible Expenses by Category</h3>
    <table><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>${categoryRows}</tbody></table>
    <p class="disclaimer">This summary is provided for informational purposes only and does not constitute tax advice. Consult a registered tax agent for your Australian tax return.</p>
  `);
}

function generateHTMLWrapper(title: string, report: any, content: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title} - Casa</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 32px; color: #1B2B4B; background: #fff; }
  .header { background: linear-gradient(135deg, #1B2B4B 0%, #0A1628 100%); color: white; padding: 24px 32px; border-radius: 8px; margin-bottom: 24px; }
  .header h1 { margin: 0; font-size: 24px; } .header p { margin: 4px 0 0; opacity: 0.8; font-size: 14px; }
  .summary-row { display: flex; gap: 16px; margin-bottom: 24px; }
  .summary-card { flex: 1; padding: 16px; border-radius: 8px; text-align: center; }
  .summary-card.green { background: #ECFDF5; } .summary-card.red { background: #FEF2F2; }
  .summary-card .label { font-size: 12px; color: #6B7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-card .value { font-size: 24px; font-weight: 700; margin-top: 4px; }
  .summary-card.green .value { color: #22C55E; } .summary-card.red .value { color: #EF4444; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { padding: 10px 12px; border-bottom: 1px solid #E5E7EB; text-align: left; font-size: 14px; }
  th { background: #F9FAFB; font-weight: 600; color: #6B7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; }
  h3 { font-size: 16px; color: #1B2B4B; margin: 24px 0 12px; }
  .disclaimer { font-size: 12px; color: #9CA3AF; margin-top: 24px; font-style: italic; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E5E7EB; text-align: center; color: #9CA3AF; font-size: 12px; }
</style></head><body>
  <div class="header"><h1>${title}</h1><p>Period: ${report.date_from} to ${report.date_to} | Generated: ${new Date().toLocaleDateString('en-AU')}</p></div>
  ${content}
  <div class="footer">Generated by Casa - AI Property Management | casaapp.com.au</div>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { report_id } = await req.json() as GenerateReportRequest;
    if (!report_id) {
      return new Response(JSON.stringify({ error: 'report_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sb = getServiceClient();

    // Fetch the report record
    const { data: report, error: reportError } = await sb
      .from('generated_reports').select('*').eq('id', report_id).single();

    if (reportError || !report) {
      return new Response(JSON.stringify({ error: 'Report not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ownerId = report.owner_id;
    const reportType = report.report_type;
    const format = report.format;
    const dateFrom = report.date_from;
    const dateTo = report.date_to;
    const propertyIds = report.property_ids;

    // Fetch data based on report type
    let reportData: any;
    switch (reportType) {
      case 'financial_summary':
        reportData = await fetchFinancialSummaryData(sb, ownerId, dateFrom, dateTo, propertyIds);
        break;
      case 'tax_summary':
        reportData = await fetchTaxSummaryData(sb, ownerId, dateFrom, dateTo);
        break;
      case 'property_performance':
        reportData = await fetchPropertyPerformanceData(sb, ownerId, propertyIds);
        break;
      case 'cash_flow':
        reportData = await fetchCashFlowData(sb, ownerId, dateFrom, dateTo, propertyIds);
        break;
      case 'maintenance_summary':
        reportData = await fetchMaintenanceSummaryData(sb, ownerId, dateFrom, dateTo);
        break;
      default:
        reportData = await fetchFinancialSummaryData(sb, ownerId, dateFrom, dateTo, propertyIds);
    }

    // Generate content based on format
    let fileContent: string | Uint8Array;
    let contentType: string;
    let fileExtension: string;

    // CSV and XLSX shared helper
    const getCSVContent = (): string => {
      switch (reportType) {
        case 'financial_summary': return generateFinancialCSV(reportData);
        case 'tax_summary': return generateTaxCSV(reportData);
        case 'property_performance': return generatePropertyPerformanceCSV(reportData);
        case 'cash_flow': return generateCashFlowCSV(reportData);
        case 'maintenance_summary': return generateMaintenanceCSV(reportData);
        default: return generateFinancialCSV(reportData);
      }
    };

    const getHTMLContent = (): string => {
      switch (reportType) {
        case 'financial_summary': return generateFinancialHTML(reportData, report);
        case 'tax_summary': return generateTaxHTML(reportData, report);
        case 'property_performance': return generateFinancialHTML(reportData, report);
        case 'cash_flow': return generateFinancialHTML(reportData, report);
        case 'maintenance_summary': return generateFinancialHTML(reportData, report);
        default: return generateFinancialHTML(reportData, report);
      }
    };

    if (format === 'csv') {
      contentType = 'text/csv';
      fileExtension = 'csv';
      fileContent = getCSVContent();
    } else if (format === 'xlsx') {
      // Generate real XLSX using SheetJS-compatible format
      // Since Deno Edge Functions can't run heavy XLSX libs reliably,
      // generate a valid XML Spreadsheet (Excel 2003 XML) which Excel/Numbers/Sheets all open
      const csvData = getCSVContent();
      const rows = csvData.split('\n').map(line => {
        // Parse CSV line respecting quotes
        const cells: string[] = [];
        let current = '';
        let inQuotes = false;
        for (const char of line) {
          if (char === '"') { inQuotes = !inQuotes; }
          else if (char === ',' && !inQuotes) { cells.push(current); current = ''; }
          else { current += char; }
        }
        cells.push(current);
        return cells;
      });

      // Build Excel XML Spreadsheet format
      let xmlRows = '';
      for (let i = 0; i < rows.length; i++) {
        let xmlCells = '';
        for (const cell of rows[i]) {
          const trimmed = cell.trim();
          const isNumber = trimmed !== '' && !isNaN(Number(trimmed)) && trimmed !== '';
          if (isNumber) {
            xmlCells += `<Cell><Data ss:Type="Number">${trimmed}</Data></Cell>`;
          } else {
            xmlCells += `<Cell><Data ss:Type="String">${trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`;
          }
        }
        xmlRows += `<Row${i === 0 ? ' ss:StyleID="header"' : ''}>${xmlCells}</Row>\n`;
      }

      fileContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default"><Font ss:Size="11"/></Style>
  <Style ss:ID="header"><Font ss:Bold="1" ss:Size="11"/><Interior ss:Color="#F5F5F4" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="${reportType.replace(/_/g, ' ')}">
  <Table>${xmlRows}</Table>
 </Worksheet>
</Workbook>`;
      contentType = 'application/vnd.ms-excel';
      fileExtension = 'xlsx';
    } else {
      // PDF format — generate styled HTML that can be rendered to PDF client-side
      // Store as HTML so the mobile app can render it via expo-print
      contentType = 'text/html';
      fileExtension = 'html';
      fileContent = getHTMLContent();
    }

    // Upload to Supabase Storage
    const storagePath = `${ownerId}/${report_id}.${fileExtension}`;
    const { error: uploadError } = await sb.storage
      .from('reports')
      .upload(storagePath, fileContent, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      await sb.from('generated_reports').update({
        status: 'failed',
        error_message: `Upload failed: ${uploadError.message}`,
      }).eq('id', report_id);

      return new Response(JSON.stringify({ error: 'Failed to upload report' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the public URL for the file
    const { data: urlData } = sb.storage.from('reports').getPublicUrl(storagePath);
    const fileUrl = urlData?.publicUrl || null;

    // Update the report record
    const fileSizeBytes = new TextEncoder().encode(fileContent).length;
    await sb.from('generated_reports').update({
      status: 'completed',
      storage_path: storagePath,
      file_url: fileUrl,
      file_size_bytes: fileSizeBytes,
      completed_at: new Date().toISOString(),
    }).eq('id', report_id);

    // Also create a documents table record for HTML/PDF reports
    // This makes them viewable in the document viewer and property Documents tab
    let documentId: string | null = null;
    if (contentType === 'text/html' && fileContent) {
      const docTypeMap: Record<string, string> = {
        financial_summary: 'financial_report',
        tax_summary: 'tax_report',
        cash_flow: 'cash_flow_forecast',
        property_performance: 'property_summary',
        maintenance_summary: 'other',
      };
      const docType = docTypeMap[reportType] || 'other';
      const propertyId = propertyIds?.length === 1 ? propertyIds[0] : null;

      const { data: docRecord } = await sb
        .from('documents')
        .insert({
          owner_id: ownerId,
          property_id: propertyId,
          document_type: docType,
          title: report.title,
          html_content: fileContent,
          status: 'draft',
          requires_signature: false,
        })
        .select('id')
        .single();

      documentId = docRecord?.id || null;
    }

    return new Response(JSON.stringify({
      success: true,
      report_id,
      document_id: documentId,
      storage_path: storagePath,
      file_url: fileUrl,
      file_size_bytes: fileSizeBytes,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Generate report error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
