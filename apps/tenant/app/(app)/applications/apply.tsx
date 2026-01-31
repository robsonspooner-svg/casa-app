// Application Wizard (Tenant) - Mission 05
import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Button, Input, Chip, ProgressSteps, FileUpload, THEME } from '@casa/ui';
import type { UploadedFile } from '@casa/ui';
import { useApplicationMutations, useAuth, useProfile, ApplicationInsert, EmploymentType } from '@casa/api';
import * as DocumentPicker from 'expo-document-picker';

const STEPS = ['Personal', 'Employment', 'Rental', 'References', 'Documents', 'Review'];

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'casual', label: 'Casual' },
  { value: 'self_employed', label: 'Self Employed' },
  { value: 'student', label: 'Student' },
  { value: 'retired', label: 'Retired' },
  { value: 'unemployed', label: 'Unemployed' },
];

interface ReferenceInput {
  name: string;
  phone: string;
  email: string;
  relationship: string;
  reference_type: 'personal' | 'professional' | 'landlord';
}

export default function ApplyScreen() {
  const router = useRouter();
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { createApplication, submitApplication, addReference, uploadDocument, saving } = useApplicationMutations();

  const [step, setStep] = useState(0);

  // Personal details
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [currentAddress, setCurrentAddress] = useState('');
  const [moveInDate, setMoveInDate] = useState('');

  // Employment
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time');
  const [employerName, setEmployerName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [annualIncome, setAnnualIncome] = useState('');

  // Rental history
  const [currentLandlordName, setCurrentLandlordName] = useState('');
  const [currentLandlordPhone, setCurrentLandlordPhone] = useState('');
  const [currentRent, setCurrentRent] = useState('');
  const [reasonForMoving, setReasonForMoving] = useState('');
  const [hasPets, setHasPets] = useState(false);
  const [petDescription, setPetDescription] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // References
  const [references, setReferences] = useState<ReferenceInput[]>([
    { name: '', phone: '', email: '', relationship: '', reference_type: 'personal' },
    { name: '', phone: '', email: '', relationship: '', reference_type: 'professional' },
  ]);

  // Documents
  const [documents, setDocuments] = useState<(UploadedFile & { uri: string; mimeType: string })[]>([]);

  const updateReference = (index: number, field: keyof ReferenceInput, value: string) => {
    const updated = [...references];
    (updated[index] as any)[field] = value;
    setReferences(updated);
  };

  const validateStep = (): boolean => {
    switch (step) {
      case 0:
        if (!fullName.trim() || !email.trim() || !phone.trim() || !currentAddress.trim() || !moveInDate.trim()) {
          Alert.alert('Required Fields', 'Please fill in all personal details including move-in date.');
          return false;
        }
        return true;
      case 1:
        return true;
      case 2:
        return true;
      case 3:
        const validRefs = references.filter(r => r.name.trim() && r.phone.trim());
        if (validRefs.length < 2) {
          Alert.alert('References Required', 'Please provide at least 2 references with name and phone.');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep(step + 1);
  };

  const handleBack = () => {
    if (step === 0) {
      router.back();
    } else {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!listingId) return;

    try {
      const data: Omit<ApplicationInsert, 'tenant_id'> = {
        listing_id: listingId,
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        current_address: currentAddress.trim(),
        move_in_date: moveInDate.trim(),
        employment_type: employmentType,
        employer_name: employerName.trim() || null,
        job_title: jobTitle.trim() || null,
        annual_income: annualIncome ? parseFloat(annualIncome) : null,
        current_landlord_name: currentLandlordName.trim() || null,
        current_landlord_phone: currentLandlordPhone.trim() || null,
        current_rent: currentRent ? parseFloat(currentRent) : null,
        reason_for_moving: reasonForMoving.trim() || null,
        has_pets: hasPets,
        pet_description: hasPets ? petDescription.trim() || null : null,
        additional_notes: additionalNotes.trim() || null,
        status: 'draft',
      };

      const app = await createApplication(data);

      // Add references
      const validRefs = references.filter(r => r.name.trim() && r.phone.trim());
      for (const ref of validRefs) {
        await addReference(app.id, {
          name: ref.name.trim(),
          phone: ref.phone.trim(),
          email: ref.email.trim() || null,
          relationship: ref.relationship.trim() || 'Contact',
          reference_type: ref.reference_type,
        });
      }

      // Upload documents
      for (const doc of documents) {
        await uploadDocument({
          applicationId: app.id,
          documentType: 'other',
          fileName: doc.name,
          fileUri: doc.uri,
          mimeType: doc.mimeType,
          fileSize: doc.size,
        });
      }

      // Submit the application
      await submitApplication(app.id);

      Alert.alert(
        'Application Submitted',
        'Your application has been submitted successfully. The owner will review it shortly.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit application');
    }
  };

  const handleSaveDraft = async () => {
    if (!listingId || !fullName.trim() || !email.trim() || !phone.trim() || !currentAddress.trim() || !moveInDate.trim()) {
      Alert.alert('Required Fields', 'Please fill in at least your personal details to save a draft.');
      return;
    }

    try {
      const data: Omit<ApplicationInsert, 'tenant_id'> = {
        listing_id: listingId,
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        current_address: currentAddress.trim(),
        move_in_date: moveInDate.trim(),
        employment_type: employmentType,
        employer_name: employerName.trim() || null,
        job_title: jobTitle.trim() || null,
        annual_income: annualIncome ? parseFloat(annualIncome) : null,
        current_landlord_name: currentLandlordName.trim() || null,
        current_landlord_phone: currentLandlordPhone.trim() || null,
        current_rent: currentRent ? parseFloat(currentRent) : null,
        reason_for_moving: reasonForMoving.trim() || null,
        has_pets: hasPets,
        pet_description: hasPets ? petDescription.trim() || null : null,
        additional_notes: additionalNotes.trim() || null,
        status: 'draft',
      };

      await createApplication(data);
      Alert.alert('Draft Saved', 'Your application has been saved as a draft.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save draft');
    }
  };

  const renderPersonalStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Personal Details</Text>
      <Input label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Your full name" />
      <Input label="Email" value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" />
      <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="0400 000 000" keyboardType="phone-pad" />
      <Input label="Current Address" value={currentAddress} onChangeText={setCurrentAddress} placeholder="123 Street, Suburb NSW 2000" />
      <Input label="Preferred Move-in Date" value={moveInDate} onChangeText={setMoveInDate} placeholder="DD/MM/YYYY" />
    </View>
  );

  const renderEmploymentStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Employment</Text>
      <Text style={styles.fieldLabel}>Employment Type</Text>
      <View style={styles.chipRow}>
        {EMPLOYMENT_TYPES.map(({ value, label }) => (
          <Chip
            key={value}
            label={label}
            selected={employmentType === value}
            onPress={() => setEmploymentType(value)}
          />
        ))}
      </View>
      <Input label="Employer Name" value={employerName} onChangeText={setEmployerName} placeholder="Company name" />
      <Input label="Job Title" value={jobTitle} onChangeText={setJobTitle} placeholder="Your role" />
      <Input label="Annual Income ($)" value={annualIncome} onChangeText={setAnnualIncome} placeholder="85000" keyboardType="numeric" />
    </View>
  );

  const renderRentalStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Rental History</Text>
      <Input label="Current Landlord Name" value={currentLandlordName} onChangeText={setCurrentLandlordName} placeholder="Name (optional)" />
      <Input label="Current Landlord Phone" value={currentLandlordPhone} onChangeText={setCurrentLandlordPhone} placeholder="Phone (optional)" keyboardType="phone-pad" />
      <Input label="Current Rent ($/wk)" value={currentRent} onChangeText={setCurrentRent} placeholder="450" keyboardType="numeric" />
      <Input label="Reason for Moving" value={reasonForMoving} onChangeText={setReasonForMoving} placeholder="Why are you moving?" multiline />

      <View style={styles.petSection}>
        <Text style={styles.fieldLabel}>Do you have pets?</Text>
        <View style={styles.chipRow}>
          <Chip label="Yes" selected={hasPets} onPress={() => setHasPets(true)} />
          <Chip label="No" selected={!hasPets} onPress={() => setHasPets(false)} />
        </View>
        {hasPets && (
          <Input label="Pet Details" value={petDescription} onChangeText={setPetDescription} placeholder="Type, breed, size" />
        )}
      </View>

      <Input label="Additional Notes" value={additionalNotes} onChangeText={setAdditionalNotes} placeholder="Anything else the owner should know" multiline />
    </View>
  );

  const renderReferencesStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>References</Text>
      <Text style={styles.stepSubtitle}>Please provide at least 2 references</Text>
      {references.map((ref, index) => (
        <View key={index} style={styles.referenceCard}>
          <Text style={styles.referenceNumber}>Reference {index + 1}</Text>
          <View style={styles.chipRow}>
            {(['personal', 'professional', 'landlord'] as const).map(type => (
              <Chip
                key={type}
                label={type.charAt(0).toUpperCase() + type.slice(1)}
                selected={ref.reference_type === type}
                onPress={() => updateReference(index, 'reference_type', type)}
              />
            ))}
          </View>
          <Input label="Name" value={ref.name} onChangeText={v => updateReference(index, 'name', v)} placeholder="Reference name" />
          <Input label="Relationship" value={ref.relationship} onChangeText={v => updateReference(index, 'relationship', v)} placeholder="e.g. Former landlord" />
          <Input label="Phone" value={ref.phone} onChangeText={v => updateReference(index, 'phone', v)} placeholder="Phone number" keyboardType="phone-pad" />
          <Input label="Email" value={ref.email} onChangeText={v => updateReference(index, 'email', v)} placeholder="Email (optional)" keyboardType="email-address" autoCapitalize="none" />
        </View>
      ))}
    </View>
  );

  const handleAddDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setDocuments(prev => [
          ...prev,
          {
            id: `doc-${Date.now()}`,
            name: asset.name,
            type: asset.mimeType || 'application/octet-stream',
            size: asset.size || 0,
            uri: asset.uri,
            mimeType: asset.mimeType || 'application/octet-stream',
          },
        ]);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const renderDocumentsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Documents</Text>
      <Text style={styles.stepSubtitle}>Upload supporting documents (ID, payslips, rental history)</Text>
      <FileUpload
        files={documents}
        onAdd={handleAddDocument}
        onRemove={handleRemoveDocument}
        hint="Accepted: PDF, Images. Max 5 files."
        maxFiles={5}
      />
    </View>
  );

  const renderReviewStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review Application</Text>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Personal</Text>
        <Text style={styles.reviewValue}>{fullName}</Text>
        <Text style={styles.reviewValue}>{email} | {phone}</Text>
        <Text style={styles.reviewValue}>Move-in: {moveInDate}</Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>Employment</Text>
        <Text style={styles.reviewValue}>{EMPLOYMENT_TYPES.find(e => e.value === employmentType)?.label}</Text>
        {employerName && <Text style={styles.reviewValue}>{employerName} - {jobTitle}</Text>}
        {annualIncome && <Text style={styles.reviewValue}>Income: ${parseInt(annualIncome).toLocaleString()}/year</Text>}
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>References</Text>
        {references.filter(r => r.name.trim()).map((ref, i) => (
          <Text key={i} style={styles.reviewValue}>{ref.name} ({ref.reference_type})</Text>
        ))}
      </View>

      {documents.length > 0 && (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Documents</Text>
          <Text style={styles.reviewValue}>{documents.length} document{documents.length !== 1 ? 's' : ''} attached</Text>
        </View>
      )}

      <View style={styles.submitActions}>
        <Button title="Submit Application" onPress={handleSubmit} disabled={saving} />
        <Button title="Save as Draft" variant="secondary" onPress={handleSaveDraft} disabled={saving} />
      </View>
    </View>
  );

  const stepContent = [renderPersonalStep, renderEmploymentStep, renderRentalStep, renderReferencesStep, renderDocumentsStep, renderReviewStep];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Apply</Text>
        <View style={styles.headerRight} />
      </View>

      <ProgressSteps steps={STEPS} currentStep={step} containerStyle={styles.progress} />

      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {stepContent[step]()}
      </ScrollView>

      {step < 5 && (
        <View style={styles.footer}>
          <Button title="Next" onPress={handleNext} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base, paddingVertical: THEME.spacing.md,
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: THEME.fontSize.h2, fontWeight: THEME.fontWeight.semibold, color: THEME.colors.textPrimary },
  headerRight: { width: 44 },
  progress: { paddingHorizontal: THEME.spacing.base },
  scrollContent: { paddingBottom: THEME.spacing.xl * 3 },
  stepContent: { padding: THEME.spacing.base, gap: THEME.spacing.md },
  stepTitle: { fontSize: THEME.fontSize.h2, fontWeight: THEME.fontWeight.bold, color: THEME.colors.textPrimary },
  stepSubtitle: { fontSize: THEME.fontSize.body, color: THEME.colors.textSecondary, marginTop: -THEME.spacing.sm },
  fieldLabel: { fontSize: THEME.fontSize.bodySmall, fontWeight: THEME.fontWeight.medium, color: THEME.colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: THEME.spacing.sm },
  petSection: { gap: THEME.spacing.sm },
  referenceCard: {
    backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base, borderWidth: 1, borderColor: THEME.colors.border, gap: THEME.spacing.sm,
  },
  referenceNumber: { fontSize: THEME.fontSize.body, fontWeight: THEME.fontWeight.semibold, color: THEME.colors.textPrimary },
  reviewSection: {
    backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg,
    padding: THEME.spacing.base, borderWidth: 1, borderColor: THEME.colors.border,
  },
  reviewLabel: { fontSize: THEME.fontSize.bodySmall, fontWeight: THEME.fontWeight.semibold, color: THEME.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: THEME.spacing.sm },
  reviewValue: { fontSize: THEME.fontSize.body, color: THEME.colors.textPrimary, marginBottom: 2 },
  submitActions: { gap: THEME.spacing.md, marginTop: THEME.spacing.lg },
  footer: { padding: THEME.spacing.base, borderTopWidth: 1, borderTopColor: THEME.colors.border },
});
