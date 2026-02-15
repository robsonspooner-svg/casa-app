// Smart Document Upload Screen — OCR-powered document scanning
// Accepts a document type and property_id via query params
// Guides user through scanning, auto-extracts fields, and saves everything

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '@casa/config';
import {
  useProperties,
  useDocumentExtraction,
  getSupabaseClient,
  useAuth,
} from '@casa/api';
import type {
  ExtractionDocumentType,
  InsuranceExtraction,
  CouncilRatesExtraction,
  StrataLevyExtraction,
  LeaseExtraction,
  WaterRatesExtraction,
  LandTaxExtraction,
  ExtractionResult,
} from '@casa/api';
import Svg, { Path, Circle } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';

// ── Type Config ────────────────────────────────────────────────────

interface DocTypeConfig {
  title: string;
  subtitle: string;
  scanPrompt: string;
  extractionType: ExtractionDocumentType;
  documentType: string; // documents table document_type
  icon: 'shield' | 'dollar' | 'home' | 'key' | 'water';
}

const DOC_CONFIG: Record<string, DocTypeConfig> = {
  insurance_certificate: {
    title: 'Insurance Certificate',
    subtitle: 'Scan your landlord insurance policy or certificate of currency',
    scanPrompt: 'Take a clear photo of the full certificate. Casa will extract the policy details, coverage, and expiry date.',
    extractionType: 'insurance_certificate',
    documentType: 'insurance_certificate',
    icon: 'shield',
  },
  council_rates: {
    title: 'Council Rate Notice',
    subtitle: 'Scan your latest council rate or assessment notice',
    scanPrompt: 'Take a clear photo of the rate notice. Casa will extract amounts, due dates, and property details.',
    extractionType: 'council_rates',
    documentType: 'council_rates',
    icon: 'dollar',
  },
  strata_levy: {
    title: 'Strata Levy Notice',
    subtitle: 'Scan your body corporate or strata levy notice',
    scanPrompt: 'Take a clear photo of the levy notice. Casa will extract the amounts, fund breakdown, and due dates.',
    extractionType: 'strata_levy',
    documentType: 'strata_levy',
    icon: 'home',
  },
  lease_document: {
    title: 'Lease Agreement',
    subtitle: 'Scan pages of your current tenancy agreement',
    scanPrompt: 'Take a clear photo of the first page with key terms (rent, dates, parties). You can add more pages.',
    extractionType: 'lease_document',
    documentType: 'lease',
    icon: 'key',
  },
  water_rates: {
    title: 'Water Rates Notice',
    subtitle: 'Scan your latest water bill or rate notice',
    scanPrompt: 'Take a clear photo of the bill. Casa will extract usage, amounts, and due dates.',
    extractionType: 'water_rates',
    documentType: 'water_rates',
    icon: 'water',
  },
  land_tax: {
    title: 'Land Tax Assessment',
    subtitle: 'Scan your state land tax assessment notice',
    scanPrompt: 'Take a clear photo of the assessment. Casa will extract the land value, tax amount, and due date.',
    extractionType: 'land_tax',
    documentType: 'land_tax',
    icon: 'dollar',
  },
};

// ── Icons ──────────────────────────────────────────────────────────

function DocTypeIcon({ type, size = 28 }: { type: string; size?: number }) {
  const color = THEME.colors.brand;
  switch (type) {
    case 'shield':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'dollar':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'home':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'key':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'water':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    default:
      return null;
  }
}

// ── Extracted Data Display ─────────────────────────────────────────

function ExtractedField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.extractedField}>
      <Text style={styles.extractedLabel}>{label}</Text>
      <Text style={styles.extractedValue}>{value}</Text>
    </View>
  );
}

function ExtractedDataView({ data, type }: { data: ExtractionResult; type: ExtractionDocumentType }) {
  switch (type) {
    case 'insurance_certificate': {
      const d = data as InsuranceExtraction;
      return (
        <View style={styles.extractedCard}>
          <View style={styles.extractedHeader}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.extractedHeaderText}>Details extracted</Text>
          </View>
          <ExtractedField label="Insurer" value={d.insurer} />
          <ExtractedField label="Policy Number" value={d.policy_number} />
          <ExtractedField label="Policy Type" value={d.policy_type} />
          <ExtractedField label="Sum Insured" value={d.sum_insured != null ? `$${d.sum_insured.toLocaleString()}` : null} />
          <ExtractedField label="Premium" value={d.premium_amount != null ? `$${d.premium_amount.toLocaleString()}` : null} />
          <ExtractedField label="Expiry Date" value={d.expiry_date} />
          <ExtractedField label="Excess" value={d.excess_amount != null ? `$${d.excess_amount}` : null} />
          {d.key_coverages?.length > 0 && (
            <ExtractedField label="Coverages" value={d.key_coverages.join(', ')} />
          )}
        </View>
      );
    }
    case 'council_rates': {
      const d = data as CouncilRatesExtraction;
      return (
        <View style={styles.extractedCard}>
          <View style={styles.extractedHeader}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.extractedHeaderText}>Details extracted</Text>
          </View>
          <ExtractedField label="Council" value={d.council_name} />
          <ExtractedField label="Assessment No." value={d.assessment_number} />
          <ExtractedField label="Rating Period" value={d.rating_period} />
          <ExtractedField label="Total Amount" value={d.total_amount != null ? `$${d.total_amount.toLocaleString()}` : null} />
          <ExtractedField label="Quarterly Amount" value={d.quarterly_amount != null ? `$${d.quarterly_amount.toLocaleString()}` : null} />
          <ExtractedField label="Due Date" value={d.due_date} />
          <ExtractedField label="Land Value" value={d.land_value != null ? `$${d.land_value.toLocaleString()}` : null} />
        </View>
      );
    }
    case 'strata_levy': {
      const d = data as StrataLevyExtraction;
      return (
        <View style={styles.extractedCard}>
          <View style={styles.extractedHeader}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.extractedHeaderText}>Details extracted</Text>
          </View>
          <ExtractedField label="Strata Scheme" value={d.strata_scheme} />
          <ExtractedField label="Managing Agent" value={d.managing_agent} />
          <ExtractedField label="Lot Number" value={d.lot_number} />
          <ExtractedField label="Quarterly Levy" value={d.quarterly_levy != null ? `$${d.quarterly_levy.toLocaleString()}` : null} />
          <ExtractedField label="Admin Fund" value={d.admin_fund != null ? `$${d.admin_fund}` : null} />
          <ExtractedField label="Sinking Fund" value={d.sinking_fund != null ? `$${d.sinking_fund}` : null} />
          <ExtractedField label="Due Date" value={d.due_date} />
        </View>
      );
    }
    case 'lease_document': {
      const d = data as LeaseExtraction;
      return (
        <View style={styles.extractedCard}>
          <View style={styles.extractedHeader}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.extractedHeaderText}>Lease terms extracted</Text>
          </View>
          {d.tenant_names?.length > 0 && (
            <ExtractedField label="Tenants" value={d.tenant_names.join(', ')} />
          )}
          <ExtractedField label="Weekly Rent" value={d.weekly_rent != null ? `$${d.weekly_rent}/week` : null} />
          <ExtractedField label="Bond" value={d.bond_amount != null ? `$${d.bond_amount}` : null} />
          <ExtractedField label="Start Date" value={d.lease_start_date} />
          <ExtractedField label="End Date" value={d.lease_end_date} />
          <ExtractedField label="Lease Type" value={d.lease_type} />
          <ExtractedField label="Payment" value={d.payment_frequency} />
        </View>
      );
    }
    case 'water_rates': {
      const d = data as WaterRatesExtraction;
      return (
        <View style={styles.extractedCard}>
          <View style={styles.extractedHeader}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.extractedHeaderText}>Details extracted</Text>
          </View>
          <ExtractedField label="Provider" value={d.provider} />
          <ExtractedField label="Account" value={d.account_number} />
          <ExtractedField label="Billing Period" value={d.billing_period} />
          <ExtractedField label="Total Amount" value={d.total_amount != null ? `$${d.total_amount.toLocaleString()}` : null} />
          <ExtractedField label="Usage" value={d.usage_kilolitres != null ? `${d.usage_kilolitres} kL` : null} />
          <ExtractedField label="Due Date" value={d.due_date} />
        </View>
      );
    }
    case 'land_tax': {
      const d = data as LandTaxExtraction;
      return (
        <View style={styles.extractedCard}>
          <View style={styles.extractedHeader}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.extractedHeaderText}>Details extracted</Text>
          </View>
          <ExtractedField label="Authority" value={d.issuing_authority} />
          <ExtractedField label="Assessment No." value={d.assessment_number} />
          <ExtractedField label="Land Value" value={d.land_value != null ? `$${d.land_value.toLocaleString()}` : null} />
          <ExtractedField label="Tax Amount" value={d.tax_amount != null ? `$${d.tax_amount.toLocaleString()}` : null} />
          <ExtractedField label="Tax Year" value={d.tax_year} />
          <ExtractedField label="Due Date" value={d.due_date} />
        </View>
      );
    }
    default:
      return null;
  }
}

// ── Main Screen ────────────────────────────────────────────────────

export default function DocumentUploadScreen() {
  const params = useLocalSearchParams<{ type: string; property_id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { properties } = useProperties();
  const { extracting, extractionError, uploadAndExtract } = useDocumentExtraction();

  const [selectedPropertyId, setSelectedPropertyId] = useState(params.property_id || '');
  const [capturedImage, setCapturedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState('');

  const docType = params.type || 'insurance_certificate';
  const config = DOC_CONFIG[docType] || DOC_CONFIG.insurance_certificate;

  // Auto-select first property if only one
  useEffect(() => {
    if (!selectedPropertyId && properties.length === 1) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties, selectedPropertyId]);

  const handleCapture = useCallback(async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to scan documents.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled && result.assets[0]) {
        setCapturedImage(result.assets[0]);
        processImage(result.assets[0]);
      }
    } else {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setCapturedImage(result.assets[0]);
        processImage(result.assets[0]);
      }
    }
  }, [selectedPropertyId]);

  const processImage = useCallback(async (asset: ImagePicker.ImagePickerAsset) => {
    setExtractedData(null);
    const storagePath = `documents/${docType}/${selectedPropertyId || 'unassigned'}_${Date.now()}.jpg`;
    const result = await uploadAndExtract(asset.uri, config.extractionType, storagePath, selectedPropertyId || undefined);
    if (result?.extracted) {
      setExtractedData(result.extracted);
    }
  }, [docType, config.extractionType, selectedPropertyId, uploadAndExtract]);

  const handleSave = useCallback(async () => {
    if (!selectedPropertyId) {
      Alert.alert('Select Property', 'Please select which property this document belongs to.');
      return;
    }
    if (!capturedImage) {
      Alert.alert('No Document', 'Please scan a document first.');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();

      // Upload image to permanent storage
      const storagePath = `documents/${docType}/${selectedPropertyId}_${Date.now()}.jpg`;
      const response = await fetch(capturedImage.uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('reports')
        .upload(storagePath, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('reports').getPublicUrl(storagePath);
      const fileUrl = urlData?.publicUrl || '';

      // Save document record — use cast to bypass strict typing on JSONB metadata
      const { error: docError } = await (supabase.from('documents') as ReturnType<typeof supabase.from>).insert({
        owner_id: user?.id,
        property_id: selectedPropertyId,
        document_type: config.documentType,
        title: config.title,
        status: 'signed',
        file_url: fileUrl,
        storage_path: storagePath,
        metadata: {
          extracted_data: extractedData,
          extraction_type: config.extractionType,
          notes,
          uploaded_at: new Date().toISOString(),
        },
      });

      if (docError) throw docError;

      // Auto-create expense record for financial documents
      if (extractedData && ['council_rates', 'strata_levy', 'water_rates', 'land_tax'].includes(docType)) {
        const amount = (extractedData as any).total_amount
          || (extractedData as any).quarterly_levy
          || (extractedData as any).tax_amount;
        const dueDate = (extractedData as any).due_date;

        if (amount) {
          const categoryMap: Record<string, string> = {
            council_rates: 'council_rates',
            strata_levy: 'strata',
            water_rates: 'water_rates',
            land_tax: 'land_tax',
          };
          await (supabase.from('manual_expenses') as ReturnType<typeof supabase.from>).insert({
            owner_id: user?.id,
            property_id: selectedPropertyId,
            description: config.title,
            amount,
            expense_date: dueDate || new Date().toISOString().split('T')[0],
            tax_category: categoryMap[docType] || 'other',
            is_tax_deductible: true,
            receipt_url: fileUrl,
          });
        }
      }

      // Auto-update compliance for insurance
      if (docType === 'insurance_certificate' && extractedData) {
        const ins = extractedData as InsuranceExtraction;
        if (ins.expiry_date) {
          // Update any insurance compliance items for this property
          const { data: compItems } = await supabase
            .from('property_compliance')
            .select('id, requirement:compliance_requirements(category)')
            .eq('property_id', selectedPropertyId);

          const insuranceItems = (compItems || []).filter((c: any) =>
            c.requirement?.category === 'insurance'
          );

          for (const item of insuranceItems) {
            await (supabase.from('property_compliance') as ReturnType<typeof supabase.from>)
              .update({
                status: 'compliant',
                last_completed_at: new Date().toISOString(),
                next_due_date: ins.expiry_date,
                certificate_url: ins.policy_number || undefined,
                evidence_urls: [fileUrl],
              })
              .eq('id', (item as any).id);
          }
        }
      }

      setSaved(true);
    } catch (err: any) {
      console.error('Save document error:', err);
      Alert.alert('Save Failed', err.message || 'Failed to save document');
    } finally {
      setSaving(false);
    }
  }, [selectedPropertyId, capturedImage, extractedData, docType, config, user?.id, notes]);

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  if (saved) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path d="M20 6L9 17l-5-5" stroke={THEME.colors.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text style={styles.successTitle}>Document saved</Text>
          <Text style={styles.successSubtitle}>
            Casa will track this document and handle renewals, reminders, and tax reporting automatically.
          </Text>
          <TouchableOpacity style={styles.successButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.successButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{config.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Intro Card */}
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <DocTypeIcon type={config.icon} size={32} />
          </View>
          <Text style={styles.introTitle}>{config.subtitle}</Text>
          <Text style={styles.introText}>{config.scanPrompt}</Text>
        </View>

        {/* Property Selector */}
        {properties.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Property</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {properties.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.chip, selectedPropertyId === p.id && styles.chipActive]}
                    onPress={() => setSelectedPropertyId(p.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, selectedPropertyId === p.id && styles.chipTextActive]} numberOfLines={1}>
                      {p.address_line_1}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Capture Area */}
        {!capturedImage ? (
          <View style={styles.captureSection}>
            <TouchableOpacity style={styles.captureButton} onPress={() => handleCapture('camera')} activeOpacity={0.7}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={12} cy={13} r={4} stroke={THEME.colors.brand} strokeWidth={1.5} />
              </Svg>
              <Text style={styles.captureButtonTitle}>Scan Document</Text>
              <Text style={styles.captureButtonSubtitle}>Take a photo with your camera</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.libraryButton} onPress={() => handleCapture('library')} activeOpacity={0.7}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.libraryButtonText}>Choose from library</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.previewSection}>
            <View style={styles.imagePreview}>
              <Image source={{ uri: capturedImage.uri }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={() => { setCapturedImage(null); setExtractedData(null); }}
                activeOpacity={0.7}
              >
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>
            </View>

            {/* Extraction Status */}
            {extracting && (
              <View style={styles.extractingCard}>
                <ActivityIndicator size="small" color={THEME.colors.brandIndigo} />
                <Text style={styles.extractingText}>Casa is reading your document...</Text>
              </View>
            )}

            {extractionError && (
              <View style={styles.errorCard}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 9v4m0 4h.01" stroke={THEME.colors.warning} strokeWidth={2} strokeLinecap="round" />
                </Svg>
                <Text style={styles.errorText}>Could not read all fields. You can still save the document.</Text>
              </View>
            )}

            {/* Extracted Data */}
            {extractedData && (
              <ExtractedDataView data={extractedData} type={config.extractionType} />
            )}

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any additional notes..."
                placeholderTextColor={THEME.colors.textTertiary}
                multiline
              />
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving || extracting}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator size="small" color={THEME.colors.textInverse} />
              ) : (
                <Text style={styles.saveButtonText}>
                  Save{extractedData ? ' & Auto-Track' : ' Document'}
                </Text>
              )}
            </TouchableOpacity>

            {extractedData && (
              <Text style={styles.autoTrackHint}>
                Casa will automatically track due dates, create expense records, and send you reminders.
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  headerBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: THEME.colors.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Intro
  introCard: {
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 24,
    marginBottom: 20,
    ...THEME.shadow.sm,
  },
  introIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.brand + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Property selector
  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  chipActive: {
    backgroundColor: THEME.colors.brandIndigo,
    borderColor: THEME.colors.brandIndigo,
  },
  chipText: { fontSize: 13, color: THEME.colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: THEME.colors.textInverse },

  // Capture
  captureSection: { gap: 12, marginBottom: 20 },
  captureButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 2,
    borderColor: THEME.colors.brand + '30',
    borderStyle: 'dashed',
    paddingVertical: 40,
    gap: 8,
  },
  captureButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.brand,
  },
  captureButtonSubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  libraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  libraryButtonText: {
    fontSize: 14,
    color: THEME.colors.brand,
    fontWeight: '600',
  },

  // Preview
  previewSection: { gap: 16 },
  imagePreview: {
    borderRadius: THEME.radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: THEME.radius.lg,
  },
  retakeButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: THEME.radius.md,
  },
  retakeText: {
    color: THEME.colors.textInverse,
    fontSize: 13,
    fontWeight: '600',
  },

  // Extraction status
  extractingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.infoBg,
    borderRadius: THEME.radius.md,
    padding: 14,
  },
  extractingText: {
    fontSize: 14,
    color: THEME.colors.brandIndigo,
    fontWeight: '500',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.warningBg,
    borderRadius: THEME.radius.md,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    color: THEME.colors.warning,
    flex: 1,
  },

  // Extracted data card
  extractedCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.success + '30',
  },
  extractedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  extractedHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.success,
  },
  extractedField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  extractedLabel: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  extractedValue: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },

  // Notes
  notesInput: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 12,
    fontSize: 14,
    color: THEME.colors.textPrimary,
    minHeight: 60,
    textAlignVertical: 'top',
  },

  // Save
  saveButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textInverse,
  },
  autoTrackHint: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },

  // Success state
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 15,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  successButton: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 40,
    paddingVertical: 14,
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textInverse,
  },
});
