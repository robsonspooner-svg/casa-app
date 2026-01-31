// Casa Database Types
// Generated from Supabase schema - Mission 02 & 03

export type UserRole = 'owner' | 'tenant' | 'admin';
export type SubscriptionTier = 'starter' | 'pro' | 'hands_off';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  // Subscription (owner only, null for tenants)
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  stripe_customer_id: string | null;
  trial_ends_at: string | null;
  onboarding_completed: boolean;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  id: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  role?: UserRole;
  subscription_tier?: SubscriptionTier;
  subscription_status?: SubscriptionStatus;
  stripe_customer_id?: string | null;
  trial_ends_at?: string | null;
  onboarding_completed?: boolean;
  preferences?: Record<string, unknown>;
}

export interface ProfileUpdate {
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  onboarding_completed?: boolean;
  preferences?: Record<string, unknown>;
}

// Mission 03: Properties
export type PropertyType = 'house' | 'apartment' | 'townhouse' | 'unit' | 'studio' | 'other';
export type PaymentFrequency = 'weekly' | 'fortnightly' | 'monthly';
export type PropertyStatus = 'vacant' | 'occupied' | 'maintenance';

export interface Property {
  id: string;
  owner_id: string;
  // Address
  address_line_1: string;
  address_line_2: string | null;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
  // Property details
  property_type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  parking_spaces: number;
  land_size_sqm: number | null;
  floor_size_sqm: number | null;
  year_built: number | null;
  // Financials
  rent_amount: number;
  rent_frequency: PaymentFrequency;
  bond_amount: number | null;
  // Status
  status: PropertyStatus;
  // Metadata
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PropertyInsert {
  owner_id: string;
  address_line_1: string;
  address_line_2?: string | null;
  suburb: string;
  state: string;
  postcode: string;
  country?: string;
  property_type: PropertyType;
  bedrooms?: number;
  bathrooms?: number;
  parking_spaces?: number;
  land_size_sqm?: number | null;
  floor_size_sqm?: number | null;
  year_built?: number | null;
  rent_amount: number;
  rent_frequency?: PaymentFrequency;
  bond_amount?: number | null;
  status?: PropertyStatus;
  notes?: string | null;
}

export interface PropertyUpdate {
  address_line_1?: string;
  address_line_2?: string | null;
  suburb?: string;
  state?: string;
  postcode?: string;
  country?: string;
  property_type?: PropertyType;
  bedrooms?: number;
  bathrooms?: number;
  parking_spaces?: number;
  land_size_sqm?: number | null;
  floor_size_sqm?: number | null;
  year_built?: number | null;
  rent_amount?: number;
  rent_frequency?: PaymentFrequency;
  bond_amount?: number | null;
  status?: PropertyStatus;
  notes?: string | null;
  deleted_at?: string | null;
}

export interface PropertyImage {
  id: string;
  property_id: string;
  storage_path: string;
  url: string;
  is_primary: boolean;
  display_order: number;
  created_at: string;
}

export interface PropertyImageInsert {
  property_id: string;
  storage_path: string;
  url: string;
  is_primary?: boolean;
  display_order?: number;
}

// Property with images for display
export interface PropertyWithImages extends Property {
  images: PropertyImage[];
}

// Mission 04: Listings
export type ListingStatus = 'draft' | 'active' | 'paused' | 'closed';
export type LeaseTerm = '6_months' | '12_months' | '24_months' | 'flexible';

export interface Listing {
  id: string;
  property_id: string;
  owner_id: string;
  // Listing details
  title: string;
  description: string | null;
  available_date: string;
  lease_term: LeaseTerm;
  // Rent
  rent_amount: number;
  rent_frequency: PaymentFrequency;
  bond_weeks: number;
  // Policies
  pets_allowed: boolean;
  pets_description: string | null;
  smoking_allowed: boolean;
  furnished: boolean;
  // Status
  status: ListingStatus;
  published_at: string | null;
  closed_at: string | null;
  close_reason: string | null;
  // Stats
  view_count: number;
  application_count: number;
  // Portal sync
  domain_listing_id: string | null;
  domain_sync_status: string;
  domain_last_synced_at: string | null;
  rea_listing_id: string | null;
  rea_sync_status: string;
  rea_last_synced_at: string | null;
  // Metadata
  created_at: string;
  updated_at: string;
}

export interface ListingInsert {
  property_id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  available_date: string;
  lease_term?: LeaseTerm;
  rent_amount: number;
  rent_frequency?: PaymentFrequency;
  bond_weeks?: number;
  pets_allowed?: boolean;
  pets_description?: string | null;
  smoking_allowed?: boolean;
  furnished?: boolean;
  status?: ListingStatus;
}

export interface ListingUpdate {
  title?: string;
  description?: string | null;
  available_date?: string;
  lease_term?: LeaseTerm;
  rent_amount?: number;
  rent_frequency?: PaymentFrequency;
  bond_weeks?: number;
  pets_allowed?: boolean;
  pets_description?: string | null;
  smoking_allowed?: boolean;
  furnished?: boolean;
  status?: ListingStatus;
  published_at?: string | null;
  closed_at?: string | null;
  close_reason?: string | null;
}

export interface ListingFeature {
  id: string;
  listing_id: string;
  feature: string;
}

export interface FeatureOption {
  id: string;
  name: string;
  category: string;
  icon: string | null;
}

// Listing with features and property info for display
export interface ListingWithDetails extends Listing {
  features: string[];
  property?: PropertyWithImages;
}

// Mission 05: Applications
export type ApplicationStatus = 'draft' | 'submitted' | 'under_review' | 'shortlisted' | 'approved' | 'rejected' | 'withdrawn';
export type EmploymentType = 'full_time' | 'part_time' | 'casual' | 'self_employed' | 'unemployed' | 'retired' | 'student';
export type ReferenceType = 'personal' | 'professional' | 'landlord';
export type DocumentType = 'id_primary' | 'id_secondary' | 'proof_of_income' | 'rental_ledger' | 'bank_statement' | 'employment_letter' | 'other';

export interface Application {
  id: string;
  listing_id: string;
  tenant_id: string;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string | null;
  current_address: string;
  employment_type: EmploymentType;
  employer_name: string | null;
  job_title: string | null;
  annual_income: number | null;
  employment_start_date: string | null;
  current_landlord_name: string | null;
  current_landlord_phone: string | null;
  current_landlord_email: string | null;
  current_rent: number | null;
  tenancy_start_date: string | null;
  reason_for_moving: string | null;
  has_pets: boolean;
  pet_description: string | null;
  move_in_date: string;
  lease_term_preference: LeaseTerm | null;
  additional_occupants: number;
  occupant_details: string | null;
  additional_notes: string | null;
  status: ApplicationStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationInsert {
  listing_id: string;
  tenant_id: string;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth?: string | null;
  current_address: string;
  employment_type: EmploymentType;
  employer_name?: string | null;
  job_title?: string | null;
  annual_income?: number | null;
  employment_start_date?: string | null;
  current_landlord_name?: string | null;
  current_landlord_phone?: string | null;
  current_landlord_email?: string | null;
  current_rent?: number | null;
  tenancy_start_date?: string | null;
  reason_for_moving?: string | null;
  has_pets?: boolean;
  pet_description?: string | null;
  move_in_date: string;
  lease_term_preference?: LeaseTerm | null;
  additional_occupants?: number;
  occupant_details?: string | null;
  additional_notes?: string | null;
  status?: ApplicationStatus;
}

export interface ApplicationUpdate {
  full_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string | null;
  current_address?: string;
  employment_type?: EmploymentType;
  employer_name?: string | null;
  job_title?: string | null;
  annual_income?: number | null;
  employment_start_date?: string | null;
  current_landlord_name?: string | null;
  current_landlord_phone?: string | null;
  current_landlord_email?: string | null;
  current_rent?: number | null;
  tenancy_start_date?: string | null;
  reason_for_moving?: string | null;
  has_pets?: boolean;
  pet_description?: string | null;
  move_in_date?: string;
  lease_term_preference?: LeaseTerm | null;
  additional_occupants?: number;
  occupant_details?: string | null;
  additional_notes?: string | null;
  status?: ApplicationStatus;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  rejection_reason?: string | null;
}

export interface ApplicationReference {
  id: string;
  application_id: string;
  reference_type: ReferenceType;
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  contacted_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface ApplicationDocument {
  id: string;
  application_id: string;
  document_type: DocumentType;
  file_name: string;
  storage_path: string;
  url: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

export interface ApplicationWithDetails extends Application {
  references: ApplicationReference[];
  documents: ApplicationDocument[];
  listing?: ListingWithDetails;
}

// Tenancy types
export type TenancyStatus = 'pending' | 'active' | 'ending' | 'ended' | 'terminated';
export type BondStatus = 'pending' | 'lodged' | 'claimed' | 'returned' | 'partial';
export type TenancyDocumentType = 'lease' | 'condition_report_entry' | 'condition_report_exit' | 'notice_to_vacate' | 'notice_to_leave' | 'bond_lodgement' | 'bond_claim' | 'rent_increase_notice' | 'other';
export type RentIncreaseStatus = 'draft' | 'notice_sent' | 'acknowledged' | 'disputed' | 'applied' | 'cancelled';

export interface Tenancy {
  id: string;
  property_id: string;
  listing_id: string | null;
  application_id: string | null;
  lease_start_date: string;
  lease_end_date: string;
  lease_type: LeaseTerm;
  is_periodic: boolean;
  rent_amount: number;
  rent_frequency: PaymentFrequency;
  rent_due_day: number;
  bond_amount: number;
  bond_lodgement_number: string | null;
  bond_status: BondStatus;
  bond_lodged_date: string | null;
  status: TenancyStatus;
  notice_given_date: string | null;
  notice_period_days: number | null;
  actual_end_date: string | null;
  end_reason: string | null;
  lease_document_url: string | null;
  lease_signed_at: string | null;
  docusign_envelope_id: string | null;
  docusign_status: string | null;
  lease_sent_at: string | null;
  all_signed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenancyInsert {
  property_id: string;
  listing_id?: string | null;
  application_id?: string | null;
  lease_start_date: string;
  lease_end_date: string;
  lease_type: LeaseTerm;
  is_periodic?: boolean;
  rent_amount: number;
  rent_frequency: PaymentFrequency;
  rent_due_day?: number;
  bond_amount: number;
  bond_lodgement_number?: string | null;
  bond_status?: BondStatus;
  bond_lodged_date?: string | null;
  status?: TenancyStatus;
  notes?: string | null;
}

export interface TenancyUpdate {
  lease_start_date?: string;
  lease_end_date?: string;
  lease_type?: LeaseTerm;
  is_periodic?: boolean;
  rent_amount?: number;
  rent_frequency?: PaymentFrequency;
  rent_due_day?: number;
  bond_amount?: number;
  bond_lodgement_number?: string | null;
  bond_status?: BondStatus;
  bond_lodged_date?: string | null;
  status?: TenancyStatus;
  notice_given_date?: string | null;
  notice_period_days?: number | null;
  actual_end_date?: string | null;
  end_reason?: string | null;
  lease_document_url?: string | null;
  lease_signed_at?: string | null;
  notes?: string | null;
}

export interface TenancyTenant {
  id: string;
  tenancy_id: string;
  tenant_id: string;
  is_primary: boolean;
  is_leaseholder: boolean;
  moved_in_date: string | null;
  moved_out_date: string | null;
  created_at: string;
}

export interface TenancyDocument {
  id: string;
  tenancy_id: string;
  document_type: TenancyDocumentType;
  title: string;
  file_name: string;
  storage_path: string;
  url: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface RentIncrease {
  id: string;
  tenancy_id: string;
  current_amount: number;
  new_amount: number;
  increase_percentage: number | null;
  notice_date: string;
  effective_date: string;
  minimum_notice_days: number;
  notice_document_url: string | null;
  notice_sent_at: string | null;
  notice_method: string | null;
  tenant_acknowledged_at: string | null;
  tenant_disputed: boolean;
  tenant_dispute_reason: string | null;
  status: RentIncreaseStatus;
  justification: string | null;
  cpi_rate: number | null;
  comparable_rents: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface TenancyWithDetails extends Tenancy {
  tenants: (TenancyTenant & { profile?: Profile })[];
  documents: TenancyDocument[];
  property?: Property;
  rent_increases?: RentIncrease[];
}

// ============================================================
// Payment & Billing Types (Mission 07)
// ============================================================

export type PaymentStatus = 'scheduled' | 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';
export type PaymentType = 'rent' | 'bond' | 'utility' | 'maintenance' | 'fee' | 'other';
export type AddOnType = 'tenant_finding' | 'professional_inspection' | 'open_home_hosting' | 'photography' | 'emergency_callout' | 'routine_inspection';
export type AddOnStatus = 'pending' | 'paid' | 'scheduled' | 'in_progress' | 'completed' | 'refunded' | 'cancelled';
export type PaymentMethodType = 'card' | 'au_becs_debit';

export interface RentSchedule {
  id: string;
  tenancy_id: string;
  due_date: string;
  amount: number;
  description: string | null;
  is_prorata: boolean;
  is_paid: boolean;
  paid_at: string | null;
  payment_id: string | null;
  created_at: string;
}

export type RentScheduleInsert = Omit<RentSchedule, 'id' | 'created_at' | 'is_paid' | 'paid_at' | 'payment_id'> & {
  is_paid?: boolean;
  paid_at?: string | null;
  payment_id?: string | null;
};

export type RentScheduleUpdate = Partial<Omit<RentSchedule, 'id' | 'created_at'>>;

export interface Payment {
  id: string;
  tenancy_id: string;
  tenant_id: string;
  payment_method_id: string | null;
  payment_type: PaymentType;
  amount: number;
  currency: string;
  description: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  stripe_fee: number | null;
  platform_fee: number | null;
  net_amount: number | null;
  status: PaymentStatus;
  status_reason: string | null;
  due_date: string | null;
  paid_at: string | null;
  failed_at: string | null;
  refunded_at: string | null;
  receipt_url: string | null;
  receipt_number: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type PaymentInsert = Pick<Payment, 'tenancy_id' | 'tenant_id' | 'amount'> & Partial<Omit<Payment, 'id' | 'created_at' | 'updated_at' | 'tenancy_id' | 'tenant_id' | 'amount'>>;
export type PaymentUpdate = Partial<Omit<Payment, 'id' | 'created_at' | 'updated_at'>>;

export interface PaymentMethod {
  id: string;
  user_id: string;
  stripe_payment_method_id: string;
  stripe_customer_id: string;
  type: string;
  last_four: string;
  brand: string | null;
  bank_name: string | null;
  is_default: boolean;
  is_autopay: boolean;
  is_active: boolean;
  becs_mandate_status: string | null;
  becs_mandate_id: string | null;
  autopay_days_before: number;
  created_at: string;
  updated_at: string;
}

export type PaymentMethodInsert = Omit<PaymentMethod, 'id' | 'created_at' | 'updated_at'>;
export type PaymentMethodUpdate = Partial<Omit<PaymentMethod, 'id' | 'created_at' | 'updated_at'>>;

export interface OwnerStripeAccount {
  id: string;
  owner_id: string;
  stripe_account_id: string;
  account_type: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  payout_schedule: string;
  created_at: string;
  updated_at: string;
}

export interface TenantStripeCustomer {
  id: string;
  tenant_id: string;
  stripe_customer_id: string;
  created_at: string;
}

export interface AutoPaySettings {
  id: string;
  tenancy_id: string;
  tenant_id: string;
  payment_method_id: string;
  is_enabled: boolean;
  days_before_due: number;
  max_amount: number | null;
  created_at: string;
  updated_at: string;
}

export type AutoPaySettingsInsert = Omit<AutoPaySettings, 'id' | 'created_at' | 'updated_at'>;
export type AutoPaySettingsUpdate = Partial<Omit<AutoPaySettings, 'id' | 'created_at' | 'updated_at'>>;

export interface AddOnPurchase {
  id: string;
  owner_id: string;
  property_id: string | null;
  tenancy_id: string | null;
  add_on_type: AddOnType;
  amount: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  status: AddOnStatus;
  scheduled_date: string | null;
  scheduled_time: string | null;
  completed_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type AddOnPurchaseInsert = Omit<AddOnPurchase, 'id' | 'created_at' | 'updated_at'>;
export type AddOnPurchaseUpdate = Partial<Omit<AddOnPurchase, 'id' | 'created_at' | 'updated_at'>>;

export interface PaymentWithDetails extends Payment {
  payment_method?: {
    type: string;
    last_four: string;
    brand?: string;
    bank_name?: string;
  };
  tenancy?: {
    property_id: string;
    property_address?: string;
  };
  rent_schedule?: RentSchedule;
}

// ============================================================
// Tenant-Owner Connection Types
// ============================================================

export type ConnectionType = 'tenancy' | 'application' | 'property';
export type ConnectionAttemptStatus = 'pending' | 'success' | 'failed' | 'rejected';
export type MatchSuggestionStatus = 'pending' | 'viewed' | 'invited' | 'applied' | 'rejected' | 'expired';
export type TenantEmploymentStatus = 'employed_full_time' | 'employed_part_time' | 'self_employed' | 'student' | 'retired' | 'other';

export interface ConnectionCode {
  id: string;
  owner_id: string;
  property_id: string | null;
  tenancy_id: string | null;
  code: string;
  connection_type: ConnectionType;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  is_active: boolean;
  label: string | null;
  created_at: string;
}

export interface ConnectionCodeInsert {
  owner_id: string;
  property_id?: string | null;
  tenancy_id?: string | null;
  code?: string; // If not provided, auto-generated
  connection_type?: ConnectionType;
  max_uses?: number | null;
  expires_at?: string | null;
  is_active?: boolean;
  label?: string | null;
}

export interface ConnectionCodeUpdate {
  is_active?: boolean;
  expires_at?: string | null;
  max_uses?: number | null;
  label?: string | null;
}

export interface ConnectionAttempt {
  id: string;
  code_id: string | null;
  code_text: string;
  user_id: string;
  status: ConnectionAttemptStatus;
  failure_reason: string | null;
  created_tenancy_tenant_id: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface TenantAvailability {
  id: string;
  tenant_id: string;
  preferred_suburbs: string[];
  min_bedrooms: number;
  max_rent_weekly: number | null;
  move_in_date: string | null;
  has_pets: boolean;
  pet_details: string | null;
  employment_status: TenantEmploymentStatus | null;
  rental_history_years: number;
  has_references: boolean;
  is_active: boolean;
  matched_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantAvailabilityInsert {
  tenant_id: string;
  preferred_suburbs?: string[];
  min_bedrooms?: number;
  max_rent_weekly?: number | null;
  move_in_date?: string | null;
  has_pets?: boolean;
  pet_details?: string | null;
  employment_status?: TenantEmploymentStatus | null;
  rental_history_years?: number;
  has_references?: boolean;
  is_active?: boolean;
  notes?: string | null;
}

export interface TenantAvailabilityUpdate {
  preferred_suburbs?: string[];
  min_bedrooms?: number;
  max_rent_weekly?: number | null;
  move_in_date?: string | null;
  has_pets?: boolean;
  pet_details?: string | null;
  employment_status?: TenantEmploymentStatus | null;
  rental_history_years?: number;
  has_references?: boolean;
  is_active?: boolean;
  notes?: string | null;
}

export interface MatchSuggestion {
  id: string;
  property_id: string;
  listing_id: string | null;
  tenant_id: string;
  tenant_availability_id: string | null;
  match_score: number;
  match_reasons: Record<string, number> | null;
  status: MatchSuggestionStatus;
  created_at: string;
  viewed_at: string | null;
  actioned_at: string | null;
  expires_at: string;
}

export interface MatchSuggestionWithDetails extends MatchSuggestion {
  tenant?: Profile;
  tenant_availability?: TenantAvailability;
  property?: Property;
  listing?: Listing;
}

export interface ConnectionCodeWithDetails extends ConnectionCode {
  property?: Property;
  tenancy?: Tenancy;
  attempts?: ConnectionAttempt[];
}

// ============================================================
// Arrears Management Types (Mission 08)
// ============================================================

export type ArrearsSeverity = 'minor' | 'moderate' | 'serious' | 'critical';
export type ArrearsActionType =
  | 'reminder_email'
  | 'reminder_sms'
  | 'phone_call'
  | 'letter_sent'
  | 'breach_notice'
  | 'payment_plan_created'
  | 'payment_plan_updated'
  | 'payment_received'
  | 'tribunal_application'
  | 'note';
export type PaymentPlanStatus = 'active' | 'completed' | 'defaulted' | 'cancelled';

export interface ArrearsRecord {
  id: string;
  tenancy_id: string;
  tenant_id: string;
  first_overdue_date: string;
  total_overdue: number;
  days_overdue: number;
  severity: ArrearsSeverity;
  has_payment_plan: boolean;
  payment_plan_id: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArrearsRecordInsert {
  tenancy_id: string;
  tenant_id: string;
  first_overdue_date: string;
  total_overdue: number;
  days_overdue: number;
  severity?: ArrearsSeverity;
  has_payment_plan?: boolean;
  payment_plan_id?: string | null;
  is_resolved?: boolean;
  resolved_at?: string | null;
  resolved_reason?: string | null;
}

export interface ArrearsRecordUpdate {
  total_overdue?: number;
  days_overdue?: number;
  severity?: ArrearsSeverity;
  has_payment_plan?: boolean;
  payment_plan_id?: string | null;
  is_resolved?: boolean;
  resolved_at?: string | null;
  resolved_reason?: string | null;
}

export interface PaymentPlan {
  id: string;
  arrears_record_id: string;
  tenancy_id: string;
  total_arrears: number;
  installment_amount: number;
  installment_frequency: PaymentFrequency;
  start_date: string;
  expected_end_date: string;
  amount_paid: number;
  installments_paid: number;
  total_installments: number;
  next_due_date: string | null;
  status: PaymentPlanStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentPlanInsert {
  arrears_record_id: string;
  tenancy_id: string;
  total_arrears: number;
  installment_amount: number;
  installment_frequency: PaymentFrequency;
  start_date: string;
  expected_end_date?: string;
  total_installments?: number;
  notes?: string | null;
}

export interface PaymentPlanUpdate {
  installment_amount?: number;
  installment_frequency?: PaymentFrequency;
  next_due_date?: string | null;
  amount_paid?: number;
  installments_paid?: number;
  status?: PaymentPlanStatus;
  notes?: string | null;
}

export interface PaymentPlanInstallment {
  id: string;
  payment_plan_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
  payment_id: string | null;
  created_at: string;
}

export interface ArrearsAction {
  id: string;
  arrears_record_id: string;
  action_type: ArrearsActionType;
  description: string;
  template_used: string | null;
  sent_to: string | null;
  sent_at: string | null;
  delivered: boolean | null;
  opened: boolean | null;
  performed_by: string | null;
  is_automated: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ArrearsActionInsert {
  arrears_record_id: string;
  action_type: ArrearsActionType;
  description: string;
  template_used?: string | null;
  sent_to?: string | null;
  sent_at?: string | null;
  delivered?: boolean | null;
  opened?: boolean | null;
  performed_by?: string | null;
  is_automated?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface ReminderTemplate {
  id: string;
  owner_id: string | null;
  name: string;
  days_overdue: number;
  channel: 'email' | 'sms' | 'both';
  subject: string;
  body: string;
  is_active: boolean;
  is_breach_notice: boolean;
  applicable_states: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderTemplateInsert {
  owner_id?: string | null;
  name: string;
  days_overdue: number;
  channel: 'email' | 'sms' | 'both';
  subject: string;
  body: string;
  is_active?: boolean;
  is_breach_notice?: boolean;
  applicable_states?: string[] | null;
}

export interface ReminderTemplateUpdate {
  name?: string;
  days_overdue?: number;
  channel?: 'email' | 'sms' | 'both';
  subject?: string;
  body?: string;
  is_active?: boolean;
  is_breach_notice?: boolean;
  applicable_states?: string[] | null;
}

// Arrears with related data
export interface ArrearsRecordWithDetails extends ArrearsRecord {
  tenant?: Profile;
  tenancy?: Tenancy & { property?: Property };
  payment_plan?: PaymentPlan;
  actions?: ArrearsAction[];
  last_action?: ArrearsAction | null;
}

export interface PaymentPlanWithDetails extends PaymentPlan {
  installments?: PaymentPlanInstallment[];
  arrears_record?: ArrearsRecord;
}

// ============================================================
// Maintenance Request Types (Mission 09)
// ============================================================

export type MaintenanceCategory =
  | 'plumbing'
  | 'electrical'
  | 'appliance'
  | 'hvac'
  | 'structural'
  | 'pest'
  | 'locks_security'
  | 'garden_outdoor'
  | 'cleaning'
  | 'other';

export type MaintenanceUrgency = 'emergency' | 'urgent' | 'routine';

export type MaintenanceStatus =
  | 'submitted'
  | 'acknowledged'
  | 'awaiting_quote'
  | 'approved'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'on_hold';

export interface MaintenanceRequest {
  id: string;
  tenancy_id: string;
  property_id: string;
  tenant_id: string;
  category: MaintenanceCategory;
  urgency: MaintenanceUrgency;
  title: string;
  description: string;
  location_in_property: string | null;
  preferred_contact_method: 'app' | 'phone' | 'email';
  preferred_times: string | null;
  access_instructions: string | null;
  status: MaintenanceStatus;
  status_changed_at: string;
  status_changed_by: string | null;
  assigned_to: string | null;
  trade_id: string | null;
  scheduled_date: string | null;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  actual_completion_date: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  cost_responsibility: 'owner' | 'tenant' | 'split' | 'insurance' | null;
  resolution_notes: string | null;
  tenant_satisfied: boolean | null;
  satisfaction_rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRequestInsert {
  tenancy_id: string;
  property_id: string;
  tenant_id: string;
  category: MaintenanceCategory;
  urgency?: MaintenanceUrgency;
  title: string;
  description: string;
  location_in_property?: string | null;
  preferred_contact_method?: 'app' | 'phone' | 'email';
  preferred_times?: string | null;
  access_instructions?: string | null;
}

export interface MaintenanceRequestUpdate {
  category?: MaintenanceCategory;
  urgency?: MaintenanceUrgency;
  title?: string;
  description?: string;
  location_in_property?: string | null;
  preferred_contact_method?: 'app' | 'phone' | 'email';
  preferred_times?: string | null;
  access_instructions?: string | null;
  status?: MaintenanceStatus;
  status_changed_by?: string | null;
  assigned_to?: string | null;
  trade_id?: string | null;
  scheduled_date?: string | null;
  scheduled_time_start?: string | null;
  scheduled_time_end?: string | null;
  actual_completion_date?: string | null;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  cost_responsibility?: 'owner' | 'tenant' | 'split' | 'insurance' | null;
  resolution_notes?: string | null;
  tenant_satisfied?: boolean | null;
  satisfaction_rating?: number | null;
}

export interface MaintenanceImage {
  id: string;
  request_id: string;
  uploaded_by: string;
  storage_path: string;
  url: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  caption: string | null;
  is_before: boolean;
  created_at: string;
}

export interface MaintenanceImageInsert {
  request_id: string;
  uploaded_by: string;
  storage_path: string;
  url: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  caption?: string | null;
  is_before?: boolean;
}

export interface MaintenanceComment {
  id: string;
  request_id: string;
  author_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  edited_at: string | null;
}

export interface MaintenanceCommentInsert {
  request_id: string;
  author_id: string;
  content: string;
  is_internal?: boolean;
}

export interface MaintenanceStatusHistory {
  id: string;
  request_id: string;
  old_status: MaintenanceStatus | null;
  new_status: MaintenanceStatus;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface MaintenanceRequestWithDetails extends MaintenanceRequest {
  images: MaintenanceImage[];
  comments: MaintenanceComment[];
  status_history: MaintenanceStatusHistory[];
  property?: Property;
  tenant?: Profile;
}

// Mission 10: Tradesperson Network
export type TradeStatus = 'pending_verification' | 'active' | 'suspended' | 'inactive';
export type WorkOrderStatus = 'draft' | 'sent' | 'quoted' | 'approved' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface TradeRow {
  id: string;
  user_id: string | null;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  abn: string | null;
  license_number: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  insurance_expiry: string | null;
  categories: MaintenanceCategory[];
  service_areas: string[] | null;
  available_weekdays: boolean;
  available_weekends: boolean;
  available_after_hours: boolean;
  bio: string | null;
  years_experience: number | null;
  avatar_url: string | null;
  average_rating: number | null;
  total_reviews: number;
  total_jobs: number;
  status: TradeStatus;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradeInsert {
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  categories: MaintenanceCategory[];
  user_id?: string | null;
  abn?: string | null;
  license_number?: string | null;
  insurance_provider?: string | null;
  insurance_policy_number?: string | null;
  insurance_expiry?: string | null;
  service_areas?: string[] | null;
  available_weekdays?: boolean;
  available_weekends?: boolean;
  available_after_hours?: boolean;
  bio?: string | null;
  years_experience?: number | null;
  avatar_url?: string | null;
  status?: TradeStatus;
}

export interface TradeUpdate {
  business_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  abn?: string | null;
  license_number?: string | null;
  insurance_provider?: string | null;
  insurance_policy_number?: string | null;
  insurance_expiry?: string | null;
  categories?: MaintenanceCategory[];
  service_areas?: string[] | null;
  available_weekdays?: boolean;
  available_weekends?: boolean;
  available_after_hours?: boolean;
  bio?: string | null;
  years_experience?: number | null;
  avatar_url?: string | null;
  status?: TradeStatus;
}

export interface TradeWithNetwork extends TradeRow {
  is_in_network: boolean;
  is_favorite: boolean;
  owner_notes: string | null;
}

export interface OwnerTradeRow {
  id: string;
  owner_id: string;
  trade_id: string;
  is_favorite: boolean;
  notes: string | null;
  created_at: string;
}

export interface OwnerTradeInsert {
  owner_id: string;
  trade_id: string;
  is_favorite?: boolean;
  notes?: string | null;
}

export interface OwnerTradeUpdate {
  is_favorite?: boolean;
  notes?: string | null;
}

export interface WorkOrderRow {
  id: string;
  maintenance_request_id: string | null;
  property_id: string;
  owner_id: string;
  trade_id: string;
  title: string;
  description: string;
  category: MaintenanceCategory;
  urgency: MaintenanceUrgency;
  access_instructions: string | null;
  tenant_contact_allowed: boolean;
  budget_min: number | null;
  budget_max: number | null;
  quote_required: boolean;
  quoted_amount: number | null;
  quoted_at: string | null;
  quote_notes: string | null;
  quote_valid_until: string | null;
  scheduled_date: string | null;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  completion_notes: string | null;
  completion_photos: string[] | null;
  final_amount: number | null;
  invoice_number: string | null;
  invoice_url: string | null;
  paid_at: string | null;
  payment_method: string | null;
  status: WorkOrderStatus;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderInsert {
  property_id: string;
  owner_id: string;
  trade_id: string;
  title: string;
  description: string;
  category: MaintenanceCategory;
  maintenance_request_id?: string | null;
  urgency?: MaintenanceUrgency;
  access_instructions?: string | null;
  tenant_contact_allowed?: boolean;
  budget_min?: number | null;
  budget_max?: number | null;
  quote_required?: boolean;
  status?: WorkOrderStatus;
}

export interface WorkOrderUpdate {
  title?: string;
  description?: string;
  category?: MaintenanceCategory;
  urgency?: MaintenanceUrgency;
  access_instructions?: string | null;
  tenant_contact_allowed?: boolean;
  budget_min?: number | null;
  budget_max?: number | null;
  quote_required?: boolean;
  quoted_amount?: number | null;
  quoted_at?: string | null;
  quote_notes?: string | null;
  quote_valid_until?: string | null;
  scheduled_date?: string | null;
  scheduled_time_start?: string | null;
  scheduled_time_end?: string | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  completion_notes?: string | null;
  completion_photos?: string[] | null;
  final_amount?: number | null;
  invoice_number?: string | null;
  invoice_url?: string | null;
  paid_at?: string | null;
  payment_method?: string | null;
  status?: WorkOrderStatus;
}

export interface WorkOrderWithDetails extends WorkOrderRow {
  trade?: TradeRow;
  property?: Property;
  maintenance_request?: MaintenanceRequest;
  review?: TradeReviewRow;
}

export interface TradeReviewRow {
  id: string;
  trade_id: string;
  work_order_id: string;
  reviewer_id: string;
  rating: number;
  title: string | null;
  content: string | null;
  would_recommend: boolean | null;
  trade_response: string | null;
  trade_responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradeReviewInsert {
  trade_id: string;
  work_order_id: string;
  reviewer_id: string;
  rating: number;
  title?: string | null;
  content?: string | null;
  would_recommend?: boolean | null;
}

export interface TradeReviewUpdate {
  rating?: number;
  title?: string | null;
  content?: string | null;
  would_recommend?: boolean | null;
  trade_response?: string | null;
  trade_responded_at?: string | null;
}

export interface TradeReviewWithDetails extends TradeReviewRow {
  reviewer?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>;
  work_order?: Pick<WorkOrderRow, 'id' | 'title' | 'category'>;
}

export interface TradePortfolioRow {
  id: string;
  trade_id: string;
  storage_path: string;
  url: string;
  caption: string | null;
  category: MaintenanceCategory | null;
  created_at: string;
}

export interface TradePortfolioInsert {
  trade_id: string;
  storage_path: string;
  url: string;
  caption?: string | null;
  category?: MaintenanceCategory | null;
}

// Tenant Review Requests (notification-based review prompts)
export type ReviewRequestStatus = 'pending' | 'completed' | 'dismissed';

export interface TradeReviewRequestRow {
  id: string;
  tenant_id: string;
  trade_id: string;
  work_order_id: string;
  property_id: string;
  trade_business_name: string;
  work_summary: string;
  category: MaintenanceCategory;
  completed_at: string;
  status: ReviewRequestStatus;
  review_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradeReviewRequestUpdate {
  status?: ReviewRequestStatus;
  review_id?: string | null;
}

// ============================================================
// Mission 11: Property Inspections
// ============================================================

export type InspectionType = 'routine' | 'entry' | 'exit' | 'pre_listing' | 'maintenance' | 'complaint';
export type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'tenant_review' | 'disputed' | 'finalized';
export type ConditionRating = 'excellent' | 'good' | 'fair' | 'poor' | 'damaged' | 'missing' | 'not_applicable';
export type OutsourceMode = 'self' | 'professional' | 'auto_managed';

export interface InspectionRow {
  id: string;
  property_id: string;
  tenancy_id: string | null;
  inspector_id: string;
  inspection_type: InspectionType;
  scheduled_date: string;
  scheduled_time: string | null;
  actual_date: string | null;
  actual_time: string | null;
  duration_minutes: number | null;
  status: InspectionStatus;
  completed_at: string | null;
  compare_to_inspection_id: string | null;
  overall_condition: ConditionRating | null;
  summary_notes: string | null;
  action_items: string[] | null;
  tenant_acknowledged: boolean;
  tenant_acknowledged_at: string | null;
  tenant_signature_url: string | null;
  tenant_disputes: string | null;
  owner_signature_url: string | null;
  owner_signed_at: string | null;
  report_url: string | null;
  report_generated_at: string | null;
  is_outsourced: boolean;
  outsource_mode: OutsourceMode | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionInsert {
  property_id: string;
  inspector_id: string;
  inspection_type: InspectionType;
  scheduled_date: string;
  tenancy_id?: string | null;
  scheduled_time?: string | null;
  status?: InspectionStatus;
  compare_to_inspection_id?: string | null;
  summary_notes?: string | null;
  is_outsourced?: boolean;
  outsource_mode?: OutsourceMode | null;
}

export interface InspectionUpdate {
  scheduled_date?: string;
  scheduled_time?: string | null;
  actual_date?: string | null;
  actual_time?: string | null;
  duration_minutes?: number | null;
  status?: InspectionStatus;
  completed_at?: string | null;
  compare_to_inspection_id?: string | null;
  overall_condition?: ConditionRating | null;
  summary_notes?: string | null;
  action_items?: string[] | null;
  tenant_acknowledged?: boolean;
  tenant_acknowledged_at?: string | null;
  tenant_signature_url?: string | null;
  tenant_disputes?: string | null;
  owner_signature_url?: string | null;
  owner_signed_at?: string | null;
  report_url?: string | null;
  report_generated_at?: string | null;
}

export interface InspectionRoomRow {
  id: string;
  inspection_id: string;
  name: string;
  display_order: number;
  overall_condition: ConditionRating | null;
  notes: string | null;
  completed_at: string | null;
}

export interface InspectionRoomInsert {
  inspection_id: string;
  name: string;
  display_order?: number;
  overall_condition?: ConditionRating | null;
  notes?: string | null;
}

export interface InspectionRoomUpdate {
  name?: string;
  display_order?: number;
  overall_condition?: ConditionRating | null;
  notes?: string | null;
  completed_at?: string | null;
}

export interface InspectionItemRow {
  id: string;
  room_id: string;
  name: string;
  display_order: number;
  condition: ConditionRating | null;
  notes: string | null;
  action_required: boolean;
  action_description: string | null;
  estimated_cost: number | null;
  entry_condition: ConditionRating | null;
  condition_changed: boolean;
  checked_at: string | null;
}

export interface InspectionItemInsert {
  room_id: string;
  name: string;
  display_order?: number;
  condition?: ConditionRating | null;
  notes?: string | null;
  action_required?: boolean;
  action_description?: string | null;
  estimated_cost?: number | null;
  entry_condition?: ConditionRating | null;
  condition_changed?: boolean;
}

export interface InspectionItemUpdate {
  name?: string;
  display_order?: number;
  condition?: ConditionRating | null;
  notes?: string | null;
  action_required?: boolean;
  action_description?: string | null;
  estimated_cost?: number | null;
  entry_condition?: ConditionRating | null;
  condition_changed?: boolean;
  checked_at?: string | null;
}

export interface InspectionImageRow {
  id: string;
  inspection_id: string;
  room_id: string | null;
  item_id: string | null;
  storage_path: string;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  annotations: Record<string, unknown> | null;
  taken_at: string;
  created_at: string;
}

export interface InspectionImageInsert {
  inspection_id: string;
  storage_path: string;
  url: string;
  room_id?: string | null;
  item_id?: string | null;
  thumbnail_url?: string | null;
  caption?: string | null;
  annotations?: Record<string, unknown> | null;
  taken_at?: string;
}

export interface InspectionVoiceNoteRow {
  id: string;
  inspection_id: string;
  room_id: string | null;
  storage_path: string;
  url: string;
  duration_seconds: number;
  transcript: string | null;
  transcribed_at: string | null;
  recorded_at: string;
}

export interface InspectionTemplateRow {
  id: string;
  owner_id: string | null;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
}

export interface InspectionTemplateRoomRow {
  id: string;
  template_id: string;
  name: string;
  display_order: number;
  items: string[];
}

export interface InspectionAIComparisonRow {
  id: string;
  exit_inspection_id: string;
  entry_inspection_id: string;
  property_id: string | null;
  comparison_date: string | null;
  total_issues: number;
  tenant_responsible_issues: number;
  tenant_responsible_count: number;
  wear_and_tear_issues: number;
  wear_and_tear_count: number;
  total_estimated_cost: number;
  bond_deduction_amount: number;
  bond_deduction_recommended: number;
  bond_deduction_reasoning: string | null;
  summary: string | null;
  ai_model: string | null;
  raw_response: string | null;
  status: string;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface InspectionAIIssueRow {
  id: string;
  comparison_id: string;
  room_id: string | null;
  item_id: string | null;
  room_name: string;
  item_name: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major';
  change_type: 'wear_and_tear' | 'minor_damage' | 'major_damage' | 'missing';
  is_tenant_responsible: boolean;
  confidence: number;
  estimated_cost: number | null;
  evidence_notes: string | null;
  entry_image_id: string | null;
  exit_image_id: string | null;
  owner_agreed: boolean | null;
  owner_notes: string | null;
  created_at: string;
}

export interface InspectionWithDetails extends InspectionRow {
  rooms: (InspectionRoomRow & {
    items: InspectionItemRow[];
    images: InspectionImageRow[];
  })[];
  images: InspectionImageRow[];
  property?: Property;
  tenancy?: Tenancy;
}

// Mission 11 Phase K: Inspection Outsourcing

export interface InspectionAssignmentRow {
  id: string;
  inspection_id: string;
  inspector_id: string;
  assigned_at: string;
  assigned_by: 'agent' | 'owner';
  accepted: boolean | null;
  accepted_at: string | null;
  declined_reason: string | null;
  proposed_date: string | null;
  proposed_time_start: string | null;
  proposed_time_end: string | null;
  confirmed_date: string | null;
  confirmed_time: string | null;
  completed_at: string | null;
  fee_amount: number;
  fee_paid: boolean;
  payment_id: string | null;
  rating: number | null;
  review_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionAssignmentInsert {
  inspection_id: string;
  inspector_id: string;
  assigned_by?: 'agent' | 'owner';
  proposed_date?: string | null;
  proposed_time_start?: string | null;
  proposed_time_end?: string | null;
  fee_amount: number;
}

export interface InspectionAssignmentUpdate {
  accepted?: boolean | null;
  accepted_at?: string | null;
  declined_reason?: string | null;
  confirmed_date?: string | null;
  confirmed_time?: string | null;
  completed_at?: string | null;
  fee_paid?: boolean;
  payment_id?: string | null;
  rating?: number | null;
  review_text?: string | null;
}

export interface InspectorAccessTokenRow {
  id: string;
  inspection_id: string;
  assignment_id: string;
  token: string;
  email: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  completed_at: string | null;
  revoked: boolean;
  revoked_at: string | null;
}

export interface InspectorAccessTokenInsert {
  inspection_id: string;
  assignment_id: string;
  token: string;
  email: string;
  expires_at: string;
}

// Mission 14: Agent Enhancements — Tasks, Autonomy, Proactive Actions
export type AgentTaskCategory = 'tenant_finding' | 'lease_management' | 'rent_collection' | 'maintenance' | 'compliance' | 'general';
export type AgentTaskStatus = 'pending_input' | 'in_progress' | 'scheduled' | 'paused' | 'completed' | 'cancelled';
export type AgentTaskPriority = 'urgent' | 'high' | 'normal' | 'low';
export type AutonomyPreset = 'cautious' | 'balanced' | 'hands_off' | 'custom';
export type AutonomyLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
export type AgentMessageRole = 'user' | 'assistant' | 'system' | 'proactive';

export interface TimelineEntry {
  timestamp: string;
  action: string;
  status: 'completed' | 'current' | 'pending';
  tool_name?: string;
  reasoning?: string;
  data?: Record<string, unknown>;
}

export interface AgentTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: AgentTaskCategory;
  status: AgentTaskStatus;
  priority: AgentTaskPriority;
  timeline: TimelineEntry[];
  recommendation: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  deep_link: string | null;
  manual_override: boolean;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentTaskInsert {
  user_id: string;
  title: string;
  description?: string | null;
  category: AgentTaskCategory;
  status?: AgentTaskStatus;
  priority?: AgentTaskPriority;
  timeline?: TimelineEntry[];
  recommendation?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  deep_link?: string | null;
  scheduled_at?: string | null;
}

export interface AgentTaskUpdate {
  title?: string;
  description?: string | null;
  status?: AgentTaskStatus;
  priority?: AgentTaskPriority;
  timeline?: TimelineEntry[];
  recommendation?: string | null;
  manual_override?: boolean;
  completed_at?: string | null;
}

export interface AgentAutonomySettings {
  id: string;
  user_id: string;
  preset: AutonomyPreset;
  category_overrides: Record<string, AutonomyLevel>;
  created_at: string;
  updated_at: string;
}

export interface AgentAutonomySettingsInsert {
  user_id: string;
  preset?: AutonomyPreset;
  category_overrides?: Record<string, AutonomyLevel>;
}

export interface AgentAutonomySettingsUpdate {
  preset?: AutonomyPreset;
  category_overrides?: Record<string, AutonomyLevel>;
}

export interface AgentProactiveAction {
  id: string;
  user_id: string;
  trigger_type: string;
  trigger_source: string | null;
  action_taken: string;
  tool_name: string | null;
  tool_params: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  was_auto_executed: boolean;
  task_id: string | null;
  created_at: string;
}

export interface AgentConversation {
  id: string;
  user_id: string;
  property_id: string | null;
  title: string | null;
  context_summary: string | null;
  status: string;
  model: string | null;
  total_tokens_used: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface AgentMessage {
  id: string;
  conversation_id: string;
  role: AgentMessageRole;
  content: string;
  tool_calls: Record<string, unknown>[] | null;
  tool_results: Record<string, unknown>[] | null;
  feedback: string | null;
  tokens_used: number | null;
  created_at: string;
}

export interface AgentPendingAction {
  id: string;
  user_id: string;
  conversation_id: string | null;
  property_id: string | null;
  task_id: string | null;
  action_type: string;
  title: string;
  description: string | null;
  preview_data: Record<string, unknown> | null;
  tool_name: string;
  tool_params: Record<string, unknown>;
  autonomy_level: number;
  recommendation: string | null;
  confidence: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expires_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

// ============================================================
// Mission 12: In-App Communications
// ============================================================

export type ConversationType = 'direct' | 'maintenance' | 'payment' | 'lease' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MessageContentType = 'text' | 'image' | 'document' | 'system';

export interface ConversationRow {
  id: string;
  property_id: string | null;
  tenancy_id: string | null;
  conversation_type: ConversationType;
  linked_record_id: string | null;
  linked_record_type: string | null;
  title: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationInsert {
  property_id?: string | null;
  tenancy_id?: string | null;
  conversation_type?: ConversationType;
  linked_record_id?: string | null;
  linked_record_type?: string | null;
  title?: string | null;
}

export interface ConversationUpdate {
  title?: string | null;
  conversation_type?: ConversationType;
  linked_record_id?: string | null;
  linked_record_type?: string | null;
}

export interface ConversationParticipantRow {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
  unread_count: number;
  notifications_enabled: boolean;
  muted_until: string | null;
  is_active: boolean;
  left_at: string | null;
  joined_at: string;
}

export interface ConversationParticipantInsert {
  conversation_id: string;
  user_id: string;
  notifications_enabled?: boolean;
  is_active?: boolean;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  content_type: MessageContentType;
  reply_to_id: string | null;
  status: MessageStatus;
  edited_at: string | null;
  deleted_at: string | null;
  original_content: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface MessageInsert {
  conversation_id: string;
  sender_id: string;
  content: string;
  content_type?: MessageContentType;
  reply_to_id?: string | null;
  status?: MessageStatus;
  metadata?: Record<string, unknown> | null;
}

export interface MessageUpdate {
  content?: string;
  status?: MessageStatus;
  edited_at?: string | null;
  deleted_at?: string | null;
  original_content?: string | null;
}

export interface MessageAttachmentRow {
  id: string;
  message_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  url: string;
  thumbnail_url: string | null;
  created_at: string;
}

export interface MessageAttachmentInsert {
  message_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  url: string;
  thumbnail_url?: string | null;
}

export interface MessageReadReceiptRow {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

export interface MessageReactionRow {
  id: string;
  message_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
}

export interface MessageTemplateRow {
  id: string;
  owner_id: string | null;
  name: string;
  content: string;
  category: string | null;
  usage_count: number;
  created_at: string;
}

export interface MessageTemplateInsert {
  owner_id?: string | null;
  name: string;
  content: string;
  category?: string | null;
}

export interface MessageTemplateUpdate {
  name?: string;
  content?: string;
  category?: string | null;
  usage_count?: number;
}

// Composite type with participants and sender info
export interface ConversationWithDetails extends ConversationRow {
  participants: (ConversationParticipantRow & {
    profile?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'>;
  })[];
  property?: Pick<Property, 'id' | 'address_line_1' | 'suburb' | 'state'>;
}

export interface MessageWithDetails extends MessageRow {
  sender?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'>;
  attachments: MessageAttachmentRow[];
  reply_to?: Pick<MessageRow, 'id' | 'content' | 'sender_id'> | null;
  reactions: MessageReactionRow[];
}

// =============================================================================
// Mission 13: Reports & Analytics
// =============================================================================

export type ReportType = 'financial_summary' | 'cash_flow' | 'tax_summary' | 'property_performance' | 'maintenance_summary' | 'tenant_history';
export type ReportFormat = 'pdf' | 'csv' | 'xlsx';
export type ReportStatus = 'generating' | 'completed' | 'failed';
export type ReportFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

// Expense Categories
export interface ExpenseCategoryRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  is_tax_deductible: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ExpenseCategoryInsert {
  owner_id: string;
  name: string;
  description?: string | null;
  is_tax_deductible?: boolean;
  is_active?: boolean;
}

export type ExpenseCategoryUpdate = Partial<Omit<ExpenseCategoryRow, 'id' | 'owner_id' | 'created_at'>>;

// Manual Expenses
export interface ManualExpenseRow {
  id: string;
  owner_id: string;
  property_id: string;
  category_id: string | null;
  description: string;
  amount: number;
  expense_date: string;
  is_recurring: boolean;
  recurring_frequency: string | null;
  receipt_url: string | null;
  is_tax_deductible: boolean;
  tax_category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManualExpenseInsert {
  owner_id: string;
  property_id: string;
  category_id?: string | null;
  description: string;
  amount: number;
  expense_date: string;
  is_recurring?: boolean;
  recurring_frequency?: string | null;
  receipt_url?: string | null;
  is_tax_deductible?: boolean;
  tax_category?: string | null;
  notes?: string | null;
}

export type ManualExpenseUpdate = Partial<Omit<ManualExpenseRow, 'id' | 'owner_id' | 'created_at' | 'updated_at'>>;

// Generated Reports
export interface GeneratedReportRow {
  id: string;
  owner_id: string;
  report_type: ReportType;
  title: string;
  property_ids: string[] | null;
  date_from: string;
  date_to: string;
  format: ReportFormat;
  storage_path: string | null;
  file_url: string | null;
  file_size_bytes: number | null;
  status: ReportStatus;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  expires_at: string | null;
}

export interface GeneratedReportInsert {
  owner_id: string;
  report_type: ReportType;
  title: string;
  property_ids?: string[] | null;
  date_from: string;
  date_to: string;
  format?: ReportFormat;
  status?: ReportStatus;
}

export type GeneratedReportUpdate = Partial<Pick<GeneratedReportRow, 'status' | 'storage_path' | 'file_url' | 'file_size_bytes' | 'error_message' | 'completed_at'>>;

// Scheduled Reports
export interface ScheduledReportRow {
  id: string;
  owner_id: string;
  report_type: ReportType;
  title: string;
  property_ids: string[] | null;
  frequency: ReportFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  email_to: string[];
  format: ReportFormat;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledReportInsert {
  owner_id: string;
  report_type: ReportType;
  title: string;
  property_ids?: string[] | null;
  frequency: ReportFrequency;
  day_of_week?: number | null;
  day_of_month?: number | null;
  email_to: string[];
  format?: ReportFormat;
  is_active?: boolean;
  next_run_at?: string | null;
}

export type ScheduledReportUpdate = Partial<Omit<ScheduledReportRow, 'id' | 'owner_id' | 'created_at' | 'updated_at'>>;

// Portfolio Summary (returned by get_portfolio_summary RPC)
export interface PortfolioSummary {
  total_properties: number;
  occupied_properties: number;
  vacant_properties: number;
  total_monthly_rent: number;
  total_arrears: number;
  open_maintenance: number;
  leases_expiring_30d: number;
  rent_collected_this_month: number;
  expenses_this_month: number;
  collection_rate: number;
}

// Monthly Financial Data (returned by get_monthly_financials RPC)
export interface MonthlyFinancial {
  month_label: string;
  month_short: string;
  year: number;
  month_num: number;
  income: number;
  expenses: number;
  fees: number;
}

// Tax Summary (returned by get_tax_summary RPC)
export interface TaxSummary {
  financial_year: number;
  period_start: string;
  period_end: string;
  rental_income: number;
  bond_income: number;
  other_income: number;
  maintenance_expenses: number;
  manual_expenses_total: number;
  tax_deductible_expenses: number;
  platform_fees: number;
  processing_fees: number;
  expense_breakdown_by_category: Array<{ category: string; total: number }>;
  per_property: Array<{
    property_id: string;
    address: string;
    rental_income: number;
    expenses: number;
    net_income: number;
  }>;
}

// Property Metrics (from materialized view)
export interface PropertyMetricsRow {
  property_id: string;
  owner_id: string;
  address_line_1: string;
  suburb: string;
  state: string;
  property_type: string;
  bedrooms: number;
  listed_rent: number;
  rent_frequency: string;
  is_vacant: boolean;
  current_tenancy_id: string | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  current_rent: number | null;
  days_until_lease_expiry: number | null;
  maintenance_requests_12m: number;
  open_maintenance_requests: number;
  maintenance_cost_12m: number;
  payments_received_12m: number;
  total_income_12m: number;
  current_arrears: number;
  next_inspection_date: string | null;
}

// Database schema type for Supabase client
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      properties: {
        Row: Property;
        Insert: PropertyInsert;
        Update: PropertyUpdate;
      };
      property_images: {
        Row: PropertyImage;
        Insert: PropertyImageInsert;
        Update: Partial<PropertyImageInsert>;
      };
      listings: {
        Row: Listing;
        Insert: ListingInsert;
        Update: ListingUpdate;
      };
      listing_features: {
        Row: ListingFeature;
        Insert: Omit<ListingFeature, 'id'>;
        Update: Partial<Omit<ListingFeature, 'id'>>;
      };
      feature_options: {
        Row: FeatureOption;
        Insert: Omit<FeatureOption, 'id'>;
        Update: Partial<Omit<FeatureOption, 'id'>>;
      };
      applications: {
        Row: Application;
        Insert: ApplicationInsert;
        Update: ApplicationUpdate;
      };
      application_references: {
        Row: ApplicationReference;
        Insert: Omit<ApplicationReference, 'id' | 'created_at'>;
        Update: Partial<Omit<ApplicationReference, 'id' | 'created_at'>>;
      };
      application_documents: {
        Row: ApplicationDocument;
        Insert: Omit<ApplicationDocument, 'id' | 'created_at'>;
        Update: Partial<Omit<ApplicationDocument, 'id' | 'created_at'>>;
      };
      tenancies: {
        Row: Tenancy;
        Insert: TenancyInsert;
        Update: TenancyUpdate;
      };
      tenancy_tenants: {
        Row: TenancyTenant;
        Insert: Omit<TenancyTenant, 'id' | 'created_at'>;
        Update: Partial<Omit<TenancyTenant, 'id' | 'created_at'>>;
      };
      tenancy_documents: {
        Row: TenancyDocument;
        Insert: Omit<TenancyDocument, 'id' | 'created_at'>;
        Update: Partial<Omit<TenancyDocument, 'id' | 'created_at'>>;
      };
      rent_increases: {
        Row: RentIncrease;
        Insert: Omit<RentIncrease, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<RentIncrease, 'id' | 'created_at' | 'updated_at'>>;
      };
      rent_schedules: {
        Row: RentSchedule;
        Insert: RentScheduleInsert;
        Update: RentScheduleUpdate;
      };
      payments: {
        Row: Payment;
        Insert: PaymentInsert;
        Update: PaymentUpdate;
      };
      payment_methods: {
        Row: PaymentMethod;
        Insert: PaymentMethodInsert;
        Update: PaymentMethodUpdate;
      };
      owner_stripe_accounts: {
        Row: OwnerStripeAccount;
        Insert: Omit<OwnerStripeAccount, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<OwnerStripeAccount, 'id' | 'created_at' | 'updated_at'>>;
      };
      tenant_stripe_customers: {
        Row: TenantStripeCustomer;
        Insert: Omit<TenantStripeCustomer, 'id' | 'created_at'>;
        Update: Partial<Omit<TenantStripeCustomer, 'id' | 'created_at'>>;
      };
      autopay_settings: {
        Row: AutoPaySettings;
        Insert: AutoPaySettingsInsert;
        Update: AutoPaySettingsUpdate;
      };
      add_on_purchases: {
        Row: AddOnPurchase;
        Insert: AddOnPurchaseInsert;
        Update: AddOnPurchaseUpdate;
      };
      connection_codes: {
        Row: ConnectionCode;
        Insert: ConnectionCodeInsert;
        Update: ConnectionCodeUpdate;
      };
      connection_attempts: {
        Row: ConnectionAttempt;
        Insert: Omit<ConnectionAttempt, 'id' | 'created_at' | 'processed_at'>;
        Update: Partial<Omit<ConnectionAttempt, 'id' | 'created_at'>>;
      };
      tenant_availability: {
        Row: TenantAvailability;
        Insert: TenantAvailabilityInsert;
        Update: TenantAvailabilityUpdate;
      };
      match_suggestions: {
        Row: MatchSuggestion;
        Insert: Omit<MatchSuggestion, 'id' | 'created_at'>;
        Update: Partial<Omit<MatchSuggestion, 'id' | 'created_at'>>;
      };
      arrears_records: {
        Row: ArrearsRecord;
        Insert: ArrearsRecordInsert;
        Update: ArrearsRecordUpdate;
      };
      payment_plans: {
        Row: PaymentPlan;
        Insert: PaymentPlanInsert;
        Update: PaymentPlanUpdate;
      };
      payment_plan_installments: {
        Row: PaymentPlanInstallment;
        Insert: Omit<PaymentPlanInstallment, 'id' | 'created_at'>;
        Update: Partial<Omit<PaymentPlanInstallment, 'id' | 'created_at'>>;
      };
      arrears_actions: {
        Row: ArrearsAction;
        Insert: ArrearsActionInsert;
        Update: never;
      };
      reminder_templates: {
        Row: ReminderTemplate;
        Insert: ReminderTemplateInsert;
        Update: ReminderTemplateUpdate;
      };
      agent_tasks: {
        Row: AgentTask;
        Insert: AgentTaskInsert;
        Update: AgentTaskUpdate;
      };
      agent_autonomy_settings: {
        Row: AgentAutonomySettings;
        Insert: AgentAutonomySettingsInsert;
        Update: AgentAutonomySettingsUpdate;
      };
      inspections: {
        Row: InspectionRow;
        Insert: InspectionInsert;
        Update: InspectionUpdate;
      };
      inspection_rooms: {
        Row: InspectionRoomRow;
        Insert: InspectionRoomInsert;
        Update: InspectionRoomUpdate;
      };
      inspection_items: {
        Row: InspectionItemRow;
        Insert: InspectionItemInsert;
        Update: InspectionItemUpdate;
      };
      inspection_images: {
        Row: InspectionImageRow;
        Insert: InspectionImageInsert;
        Update: Partial<InspectionImageInsert>;
      };
      inspection_templates: {
        Row: InspectionTemplateRow;
        Insert: Omit<InspectionTemplateRow, 'id' | 'created_at'>;
        Update: Partial<Omit<InspectionTemplateRow, 'id' | 'created_at'>>;
      };
      inspection_template_rooms: {
        Row: InspectionTemplateRoomRow;
        Insert: Omit<InspectionTemplateRoomRow, 'id'>;
        Update: Partial<Omit<InspectionTemplateRoomRow, 'id'>>;
      };
      conversations: {
        Row: ConversationRow;
        Insert: ConversationInsert;
        Update: ConversationUpdate;
      };
      conversation_participants: {
        Row: ConversationParticipantRow;
        Insert: ConversationParticipantInsert;
        Update: Partial<Omit<ConversationParticipantRow, 'id' | 'joined_at'>>;
      };
      messages: {
        Row: MessageRow;
        Insert: MessageInsert;
        Update: MessageUpdate;
      };
      message_attachments: {
        Row: MessageAttachmentRow;
        Insert: MessageAttachmentInsert;
        Update: never;
      };
      message_read_receipts: {
        Row: MessageReadReceiptRow;
        Insert: Omit<MessageReadReceiptRow, 'id' | 'read_at'>;
        Update: never;
      };
      message_reactions: {
        Row: MessageReactionRow;
        Insert: Omit<MessageReactionRow, 'id' | 'created_at'>;
        Update: never;
      };
      message_templates: {
        Row: MessageTemplateRow;
        Insert: MessageTemplateInsert;
        Update: MessageTemplateUpdate;
      };
      expense_categories: {
        Row: ExpenseCategoryRow;
        Insert: ExpenseCategoryInsert;
        Update: ExpenseCategoryUpdate;
      };
      manual_expenses: {
        Row: ManualExpenseRow;
        Insert: ManualExpenseInsert;
        Update: ManualExpenseUpdate;
      };
      generated_reports: {
        Row: GeneratedReportRow;
        Insert: GeneratedReportInsert;
        Update: GeneratedReportUpdate;
      };
      scheduled_reports: {
        Row: ScheduledReportRow;
        Insert: ScheduledReportInsert;
        Update: ScheduledReportUpdate;
      };
    };
    Enums: {
      user_role: UserRole;
      subscription_tier: SubscriptionTier;
      subscription_status: SubscriptionStatus;
      property_type: PropertyType;
      payment_frequency: PaymentFrequency;
      listing_status: ListingStatus;
      lease_term: LeaseTerm;
      application_status: ApplicationStatus;
      employment_type: EmploymentType;
      tenancy_status: TenancyStatus;
      bond_status: BondStatus;
      payment_status: PaymentStatus;
      payment_type: PaymentType;
      add_on_type: AddOnType;
      arrears_severity: ArrearsSeverity;
      arrears_action_type: ArrearsActionType;
      payment_plan_status: PaymentPlanStatus;
      trade_status: TradeStatus;
      work_order_status: WorkOrderStatus;
      inspection_type: InspectionType;
      inspection_status: InspectionStatus;
      condition_rating: ConditionRating;
      conversation_type: ConversationType;
      message_status: MessageStatus;
      report_type: ReportType;
      report_format: ReportFormat;
      report_status: ReportStatus;
      report_frequency: ReportFrequency;
    };
  };
}
