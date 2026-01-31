// Gateway Types for Future Missions
// These types define the contract for features to be implemented in later missions
// They serve as stubs that the current app can use for navigation and placeholder UI

// =============================================================================
// Mission 08: Arrears Management
// =============================================================================

export type ArrearsSeverity = 'minor' | 'moderate' | 'serious' | 'critical';

export interface ArrearsRecord {
  id: string;
  tenancy_id: string;
  tenant_id: string;
  first_overdue_date: string;
  total_overdue: number;
  days_overdue: number;
  severity: ArrearsSeverity;
  last_contact_date: string | null;
  last_contact_method: string | null;
  payment_plan_id: string | null;
  breach_notice_sent: boolean;
  breach_notice_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentPlan {
  id: string;
  arrears_record_id: string;
  tenancy_id: string;
  total_arrears: number;
  installment_amount: number;
  installment_frequency: 'weekly' | 'fortnightly' | 'monthly';
  start_date: string;
  expected_end_date: string;
  installments_total: number;
  installments_paid: number;
  status: 'active' | 'completed' | 'defaulted' | 'cancelled';
  created_at: string;
}

export interface ArrearsAction {
  id: string;
  arrears_record_id: string;
  action_type: 'reminder_email' | 'phone_call' | 'sms' | 'breach_notice' | 'payment_received' | 'payment_plan_created';
  template_used: string | null;
  sent_to: string | null;
  sent_at: string;
  days_overdue: number;
  is_automated: boolean;
  notes: string | null;
}

// =============================================================================
// Mission 09: Maintenance Requests
// =============================================================================

export type MaintenanceCategory =
  | 'plumbing'
  | 'electrical'
  | 'appliance'
  | 'hvac'
  | 'structural'
  | 'pest'
  | 'locks'
  | 'garden'
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
  location: string | null;
  access_instructions: string | null;
  preferred_contact: 'app' | 'phone' | 'email';
  preferred_times: string | null;
  status: MaintenanceStatus;
  status_changed_at: string;
  status_changed_by: string | null;
  assigned_to: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  cost_responsibility: 'owner' | 'tenant' | 'split' | 'insurance' | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  actual_completion_date: string | null;
  satisfaction_rating: number | null;
  tenant_satisfied: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceImage {
  id: string;
  maintenance_request_id: string;
  storage_path: string;
  url: string;
  thumbnail_url: string | null;
  is_before: boolean;
  caption: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface MaintenanceComment {
  id: string;
  maintenance_request_id: string;
  author_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
}

// =============================================================================
// Mission 10: Tradesperson Network
// =============================================================================

export type TradeStatus = 'pending_verification' | 'active' | 'suspended' | 'inactive';

export type WorkOrderStatus =
  | 'draft'
  | 'sent'
  | 'quoted'
  | 'approved'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Trade {
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
  service_areas: string[];
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

export interface WorkOrder {
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
  completion_photos: string[];
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

export interface TradeReview {
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

// =============================================================================
// Mission 11: Property Inspections
// =============================================================================

export type InspectionType =
  | 'routine'
  | 'entry'
  | 'exit'
  | 'pre_listing'
  | 'maintenance'
  | 'complaint';

export type InspectionStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'tenant_review'
  | 'disputed'
  | 'finalized';

export type ConditionRating =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'damaged'
  | 'missing'
  | 'not_applicable';

export interface Inspection {
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
  action_items: string[];
  tenant_acknowledged: boolean;
  tenant_acknowledged_at: string | null;
  tenant_signature_url: string | null;
  tenant_disputes: string | null;
  owner_signature_url: string | null;
  owner_signed_at: string | null;
  report_url: string | null;
  report_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionRoom {
  id: string;
  inspection_id: string;
  name: string;
  display_order: number;
  overall_condition: ConditionRating | null;
  notes: string | null;
  completed_at: string | null;
}

export interface InspectionItem {
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

export interface InspectionImage {
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

// =============================================================================
// Mission 12: In-App Communications (Already partially implemented in M07)
// =============================================================================

export type ConversationType = 'direct' | 'maintenance' | 'application' | 'inspection';

export interface Conversation {
  id: string;
  conversation_type: ConversationType;
  property_id: string | null;
  tenancy_id: string | null;
  linked_record_id: string | null;
  linked_record_type: string | null;
  title: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  read_at: string | null;
  created_at: string;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_type: string;
  storage_path: string;
  url: string;
  thumbnail_url: string | null;
  created_at: string;
}

// =============================================================================
// Mission 14: AI Agent (Types for agent interaction)
// =============================================================================

export type AgentAutonomyLevel = 'L0_inform' | 'L1_suggest' | 'L2_draft' | 'L3_execute' | 'L4_autonomous';

export interface AgentPendingAction {
  id: string;
  owner_id: string;
  conversation_id: string | null;
  tool_name: string;
  tool_params: Record<string, unknown>;
  preview_text: string;
  preview_data: Record<string, unknown> | null;
  autonomy_required: AgentAutonomyLevel;
  autonomy_current: AgentAutonomyLevel;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  resolved_at: string | null;
  resolved_by: string | null;
  expires_at: string;
  created_at: string;
}

export interface AgentConversation {
  id: string;
  owner_id: string;
  title: string | null;
  context_summary: string | null;
  message_count: number;
  tool_calls_count: number;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface AgentMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_calls: Record<string, unknown>[] | null;
  tool_results: Record<string, unknown>[] | null;
  tokens_used: number | null;
  latency_ms: number | null;
  created_at: string;
}

// =============================================================================
// Mission 17: Notifications
// =============================================================================

export type NotificationType =
  | 'payment_received'
  | 'payment_due'
  | 'payment_overdue'
  | 'autopay_scheduled'
  | 'autopay_failed'
  | 'maintenance_submitted'
  | 'maintenance_acknowledged'
  | 'maintenance_scheduled'
  | 'maintenance_completed'
  | 'application_received'
  | 'application_status_changed'
  | 'message_received'
  | 'inspection_scheduled'
  | 'inspection_reminder'
  | 'inspection_completed'
  | 'compliance_due_soon'
  | 'compliance_overdue'
  | 'lease_expiring_soon'
  | 'lease_renewed'
  | 'tenant_moved_out'
  | 'system_announcement'
  | 'feature_update';

export interface Notification {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  related_type: string | null;
  related_id: string | null;
  push_sent: boolean;
  push_sent_at: string | null;
  email_sent: boolean;
  email_sent_at: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  updated_at: string;
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
  email_digest: 'immediate' | 'daily' | 'weekly' | 'none';
  email_digest_time: string;
  do_not_disturb_until: string | null;
  updated_at: string;
}

// =============================================================================
// Gateway Hook Return Types (for placeholder hooks)
// =============================================================================

export interface GatewayState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isGateway: true; // Indicates this is a placeholder for future implementation
}

export interface GatewayListState<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  isGateway: true;
}
