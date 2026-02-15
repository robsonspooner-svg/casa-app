// Extract Document Data — AI-powered OCR via Claude Vision
// Accepts an image URL and document type, returns structured extracted fields
// Used by: expense receipts, insurance certificates, council rate notices,
//          strata levies, lease documents, tenant application docs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const VISION_MODEL = 'claude-3-5-haiku-20241022';

// ── Document Types & Their Extraction Schemas ──────────────────────

type DocumentType =
  | 'receipt'
  | 'insurance_certificate'
  | 'council_rates'
  | 'strata_levy'
  | 'lease_document'
  | 'tenant_id'
  | 'payslip'
  | 'water_rates'
  | 'land_tax';

interface ExtractionRequest {
  image_url: string;        // Public URL of the uploaded image
  document_type: DocumentType;
  property_id?: string;     // Optional context for better extraction
}

// ── Extraction Prompts per Document Type ────────────────────────────

const EXTRACTION_PROMPTS: Record<DocumentType, { system: string; fields: string }> = {
  receipt: {
    system: `You are a receipt data extraction assistant for Australian property management. Extract key financial details from receipt/invoice images with high accuracy. All amounts should be in AUD. If a field is not visible or unclear, set it to null.`,
    fields: `Extract and return a JSON object with these fields:
- "vendor": string | null — business/vendor name
- "amount": number | null — total amount in dollars (e.g. 450.00, not cents)
- "gst_amount": number | null — GST component if shown
- "date": string | null — date in YYYY-MM-DD format
- "invoice_number": string | null — invoice or receipt number
- "description": string | null — brief description of what was purchased/paid for
- "category_suggestion": string | null — one of: insurance, council_rates, strata, repairs, interest, depreciation, water_rates, land_tax, legal, accounting, advertising, other
- "is_tax_deductible": boolean — whether this appears tax deductible for a property investor`,
  },

  insurance_certificate: {
    system: `You are an insurance document extraction assistant for Australian property management. Extract key policy details from insurance certificates, schedules, and renewal notices. If a field is not visible or unclear, set it to null.`,
    fields: `Extract and return a JSON object with these fields:
- "insurer": string | null — insurance company name
- "policy_number": string | null — policy number
- "policy_type": string | null — one of: building, landlord, contents, public_liability, strata, other
- "property_address": string | null — insured property address
- "sum_insured": number | null — total sum insured in dollars
- "premium_amount": number | null — annual premium amount in dollars
- "start_date": string | null — policy start date in YYYY-MM-DD format
- "expiry_date": string | null — policy expiry date in YYYY-MM-DD format
- "excess_amount": number | null — excess/deductible amount
- "key_coverages": string[] — list of key coverage types mentioned (e.g. "fire", "storm", "theft", "loss of rent")
- "exclusions_noted": string[] — any notable exclusions mentioned`,
  },

  council_rates: {
    system: `You are a council rates document extraction assistant for Australian property management. Extract key details from council rate notices, assessment notices, and rate payment notices. All amounts in AUD. If a field is not visible or unclear, set it to null.`,
    fields: `Extract and return a JSON object with these fields:
- "council_name": string | null — name of the local council
- "assessment_number": string | null — property assessment or rate notice number
- "property_address": string | null — rated property address
- "rating_period": string | null — the period covered (e.g. "2024-2025", "Q3 2024")
- "total_amount": number | null — total rates amount for the period
- "quarterly_amount": number | null — quarterly instalment amount if shown
- "due_date": string | null — next payment due date in YYYY-MM-DD format
- "land_value": number | null — unimproved land value if shown
- "rate_category": string | null — rating category (e.g. "residential", "investment")
- "payment_reference": string | null — BPAY or reference number for payment`,
  },

  strata_levy: {
    system: `You are a strata/body corporate levy extraction assistant for Australian property management. Extract key details from strata levy notices, body corporate invoices, and owners corporation notices. All amounts in AUD. If a field is not visible or unclear, set it to null.`,
    fields: `Extract and return a JSON object with these fields:
- "strata_scheme": string | null — strata plan/scheme number or name
- "managing_agent": string | null — strata managing agent company
- "lot_number": string | null — unit/lot number
- "property_address": string | null — property address
- "quarterly_levy": number | null — quarterly levy amount
- "annual_levy": number | null — total annual levy if shown
- "admin_fund": number | null — administration fund component
- "sinking_fund": number | null — capital works/sinking fund component
- "special_levy": number | null — any special levy amount
- "due_date": string | null — payment due date in YYYY-MM-DD format
- "levy_period": string | null — period covered (e.g. "Q1 2025")
- "payment_reference": string | null — reference number for payment`,
  },

  lease_document: {
    system: `You are a lease document extraction assistant for Australian property management. Extract key terms from residential tenancy agreements, lease documents, and lease renewal letters. If a field is not visible or unclear, set it to null.`,
    fields: `Extract and return a JSON object with these fields:
- "tenant_names": string[] — names of all tenants listed
- "landlord_name": string | null — landlord/lessor name
- "property_address": string | null — leased property address
- "weekly_rent": number | null — weekly rent amount in dollars
- "bond_amount": number | null — bond/security deposit amount
- "lease_start_date": string | null — lease commencement date in YYYY-MM-DD format
- "lease_end_date": string | null — lease end date in YYYY-MM-DD format
- "lease_type": string | null — one of: fixed_term, periodic, month_to_month
- "payment_frequency": string | null — one of: weekly, fortnightly, monthly
- "payment_method": string | null — payment method if specified
- "special_conditions": string[] — any notable special conditions
- "pets_allowed": boolean | null — whether pets are permitted
- "break_lease_fee": number | null — break lease fee if specified`,
  },

  tenant_id: {
    system: `You are an identity document extraction assistant. Extract key identifying details from Australian driver's licences, passports, and photo ID documents. Be careful with personal information — only extract what's needed for tenant verification. If a field is not visible or unclear, set it to null.`,
    fields: `Extract and return a JSON object with these fields:
- "full_name": string | null — full name as shown on document
- "date_of_birth": string | null — date of birth in YYYY-MM-DD format
- "document_type": string | null — one of: drivers_licence, passport, photo_id, medicare, other
- "document_number": string | null — licence/passport/ID number
- "expiry_date": string | null — document expiry date in YYYY-MM-DD format
- "address": string | null — address on document if shown
- "state": string | null — issuing state (e.g. "QLD", "NSW", "VIC")`,
  },

  payslip: {
    system: `You are a payslip/income document extraction assistant for Australian tenant application processing. Extract key income details from payslips, payment summaries, and employment letters. All amounts in AUD. If a field is not visible or unclear, set it to null.`,
    fields: `Extract and return a JSON object with these fields:
- "employee_name": string | null — employee's full name
- "employer_name": string | null — employer/company name
- "pay_period": string | null — pay period covered
- "gross_pay": number | null — gross pay amount for the period
- "net_pay": number | null — net/take-home pay amount
- "pay_frequency": string | null — one of: weekly, fortnightly, monthly, annual
- "annual_salary": number | null — annual salary if shown or calculable
- "employment_type": string | null — one of: full_time, part_time, casual, contract
- "position_title": string | null — job title/position`,
  },

  water_rates: {
    system: `You are a water rates extraction assistant for Australian property management. Extract key details from water bills and rate notices. All amounts in AUD. If a field is not visible or unclear, set it to null.`,
    fields: `Extract and return a JSON object with these fields:
- "provider": string | null — water utility provider name
- "account_number": string | null — account or customer number
- "property_address": string | null — service address
- "billing_period": string | null — period covered
- "total_amount": number | null — total amount due
- "usage_amount": number | null — usage/consumption charges
- "fixed_charges": number | null — fixed/access charges
- "usage_kilolitres": number | null — water usage in kilolitres
- "due_date": string | null — payment due date in YYYY-MM-DD format
- "payment_reference": string | null — BPAY or reference number`,
  },

  land_tax: {
    system: `You are a land tax assessment extraction assistant for Australian property management. Extract key details from state land tax assessments and notices. All amounts in AUD. If a field is not visible or unclear, set it to null.`,
    fields: `Extract and return a JSON object with these fields:
- "issuing_authority": string | null — state revenue office name
- "assessment_number": string | null — assessment or reference number
- "property_address": string | null — assessed property address
- "land_value": number | null — assessed land value
- "tax_amount": number | null — land tax payable
- "tax_year": string | null — tax year (e.g. "2024-2025")
- "due_date": string | null — payment due date in YYYY-MM-DD format
- "owner_name": string | null — registered owner name
- "payment_reference": string | null — BPAY or reference number`,
  },
};

// ── Main Handler ───────────────────────────────────────────────────

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: ExtractionRequest = await req.json();

    if (!body.image_url || !body.document_type) {
      return new Response(
        JSON.stringify({ error: 'image_url and document_type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const config = EXTRACTION_PROMPTS[body.document_type];
    if (!config) {
      return new Response(
        JSON.stringify({ error: `Unknown document_type: ${body.document_type}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Call Claude Vision API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 1500,
        system: config.system,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'url',
                  url: body.image_url,
                },
              },
              {
                type: 'text',
                text: config.fields + '\n\nRespond with ONLY the JSON object, no markdown fences or explanation.',
              },
            ],
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude Vision API error:', claudeResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI extraction failed', details: claudeResponse.status }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const claudeData = await claudeResponse.json();
    const textContent = claudeData.content?.find((c: any) => c.type === 'text')?.text;

    if (!textContent) {
      return new Response(
        JSON.stringify({ error: 'No extraction result from AI' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse JSON from response — handle potential markdown fences
    let jsonStr = textContent.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let extracted: Record<string, any>;
    try {
      extracted = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('Failed to parse AI extraction:', jsonStr);
      return new Response(
        JSON.stringify({ error: 'Failed to parse extraction result', raw: jsonStr }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        document_type: body.document_type,
        extracted,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('extract-document-data error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
