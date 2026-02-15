// useDocumentExtraction — Client hook for OCR/AI document data extraction
// Calls the extract-document-data Edge Function with an uploaded image URL

import { useState, useCallback } from 'react';
import { getSupabaseClient } from '../client';

export type ExtractionDocumentType =
  | 'receipt'
  | 'insurance_certificate'
  | 'council_rates'
  | 'strata_levy'
  | 'lease_document'
  | 'tenant_id'
  | 'payslip'
  | 'water_rates'
  | 'land_tax';

// ── Extraction Result Types ────────────────────────────────────────

export interface ReceiptExtraction {
  vendor: string | null;
  amount: number | null;
  gst_amount: number | null;
  date: string | null;
  invoice_number: string | null;
  description: string | null;
  category_suggestion: string | null;
  is_tax_deductible: boolean;
}

export interface InsuranceExtraction {
  insurer: string | null;
  policy_number: string | null;
  policy_type: string | null;
  property_address: string | null;
  sum_insured: number | null;
  premium_amount: number | null;
  start_date: string | null;
  expiry_date: string | null;
  excess_amount: number | null;
  key_coverages: string[];
  exclusions_noted: string[];
}

export interface CouncilRatesExtraction {
  council_name: string | null;
  assessment_number: string | null;
  property_address: string | null;
  rating_period: string | null;
  total_amount: number | null;
  quarterly_amount: number | null;
  due_date: string | null;
  land_value: number | null;
  rate_category: string | null;
  payment_reference: string | null;
}

export interface StrataLevyExtraction {
  strata_scheme: string | null;
  managing_agent: string | null;
  lot_number: string | null;
  property_address: string | null;
  quarterly_levy: number | null;
  annual_levy: number | null;
  admin_fund: number | null;
  sinking_fund: number | null;
  special_levy: number | null;
  due_date: string | null;
  levy_period: string | null;
  payment_reference: string | null;
}

export interface LeaseExtraction {
  tenant_names: string[];
  landlord_name: string | null;
  property_address: string | null;
  weekly_rent: number | null;
  bond_amount: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  lease_type: string | null;
  payment_frequency: string | null;
  payment_method: string | null;
  special_conditions: string[];
  pets_allowed: boolean | null;
  break_lease_fee: number | null;
}

export interface TenantIdExtraction {
  full_name: string | null;
  date_of_birth: string | null;
  document_type: string | null;
  document_number: string | null;
  expiry_date: string | null;
  address: string | null;
  state: string | null;
}

export interface PayslipExtraction {
  employee_name: string | null;
  employer_name: string | null;
  pay_period: string | null;
  gross_pay: number | null;
  net_pay: number | null;
  pay_frequency: string | null;
  annual_salary: number | null;
  employment_type: string | null;
  position_title: string | null;
}

export interface WaterRatesExtraction {
  provider: string | null;
  account_number: string | null;
  property_address: string | null;
  billing_period: string | null;
  total_amount: number | null;
  usage_amount: number | null;
  fixed_charges: number | null;
  usage_kilolitres: number | null;
  due_date: string | null;
  payment_reference: string | null;
}

export interface LandTaxExtraction {
  issuing_authority: string | null;
  assessment_number: string | null;
  property_address: string | null;
  land_value: number | null;
  tax_amount: number | null;
  tax_year: string | null;
  due_date: string | null;
  owner_name: string | null;
  payment_reference: string | null;
}

export type ExtractionResult =
  | ReceiptExtraction
  | InsuranceExtraction
  | CouncilRatesExtraction
  | StrataLevyExtraction
  | LeaseExtraction
  | TenantIdExtraction
  | PayslipExtraction
  | WaterRatesExtraction
  | LandTaxExtraction;

export interface ExtractionResponse {
  success: boolean;
  document_type: ExtractionDocumentType;
  extracted: ExtractionResult;
}

export interface UseDocumentExtractionReturn {
  extracting: boolean;
  extractionError: string | null;
  extractData: (imageUrl: string, documentType: ExtractionDocumentType, propertyId?: string) => Promise<ExtractionResult | null>;
  uploadAndExtract: (localUri: string, documentType: ExtractionDocumentType, storagePath: string, propertyId?: string) => Promise<{ url: string; extracted: ExtractionResult } | null>;
}

export function useDocumentExtraction(): UseDocumentExtractionReturn {
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Extract data from an already-uploaded image URL
  const extractData = useCallback(async (
    imageUrl: string,
    documentType: ExtractionDocumentType,
    propertyId?: string,
  ): Promise<ExtractionResult | null> => {
    setExtracting(true);
    setExtractionError(null);

    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const response = await fetch(`${supabaseUrl}/functions/v1/extract-document-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          image_url: imageUrl,
          document_type: documentType,
          property_id: propertyId,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Extraction failed' }));
        throw new Error(err.error || `Extraction failed: ${response.status}`);
      }

      const result: ExtractionResponse = await response.json();
      return result.extracted;
    } catch (err: any) {
      console.error('Document extraction error:', err);
      setExtractionError(err.message || 'Extraction failed');
      return null;
    } finally {
      setExtracting(false);
    }
  }, []);

  // Upload an image to storage, then extract data from it
  const uploadAndExtract = useCallback(async (
    localUri: string,
    documentType: ExtractionDocumentType,
    storagePath: string,
    propertyId?: string,
  ): Promise<{ url: string; extracted: ExtractionResult } | null> => {
    setExtracting(true);
    setExtractionError(null);

    try {
      const supabase = getSupabaseClient();

      // Upload to Supabase Storage
      const response = await fetch(localUri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('reports')
        .upload(storagePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from('reports').getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl;

      if (!publicUrl) throw new Error('Failed to get public URL');

      // Extract data from the uploaded image
      const extracted = await extractData(publicUrl, documentType, propertyId);
      if (!extracted) throw new Error('Extraction returned no data');

      return { url: publicUrl, extracted };
    } catch (err: any) {
      console.error('Upload and extract error:', err);
      setExtractionError(err.message || 'Upload or extraction failed');
      return null;
    } finally {
      setExtracting(false);
    }
  }, [extractData]);

  return {
    extracting,
    extractionError,
    extractData,
    uploadAndExtract,
  };
}
