// Casa API Client
// Mission 02: Authentication & User Profiles

// Re-export client functions from separate module (avoids circular dependencies)
export {
  initializeSupabase,
  getSupabaseClient,
  isSupabaseConfigured,
} from './client';

// Export hooks
export { useAuth, useAuthProvider, AuthProvider } from './hooks/useAuth';
export type { AuthState, AuthActions, AuthContextValue, OAuthOptions } from './hooks/useAuth';

export { useProfile } from './hooks/useProfile';
export type { ProfileState, ProfileActions, ProfileContextValue } from './hooks/useProfile';

export { useProperties, useProperty } from './hooks/useProperties';
export type { PropertiesState, PropertiesActions, PropertiesContextValue, PropertyState } from './hooks/useProperties';

export { usePropertyMutations } from './hooks/usePropertyMutations';
export type { PropertyMutations } from './hooks/usePropertyMutations';

export { useFeatureGate, checkFeatureAccess } from './hooks/useFeatureGate';
export type { FeatureKey, FeatureGateResult } from './hooks/useFeatureGate';

// Mission 04: Listings
export { useListings } from './hooks/useListings';
export type { ListingsState, ListingsActions, ListingsFilter } from './hooks/useListings';

export { useListing } from './hooks/useListing';
export type { ListingState } from './hooks/useListing';

export { useListingMutations } from './hooks/useListingMutations';
export type { ListingMutations } from './hooks/useListingMutations';

export { usePublicListings } from './hooks/usePublicListings';
export type { PublicListingsSearchParams, PublicListingsState } from './hooks/usePublicListings';

export { useFeatureOptions } from './hooks/useFeatureOptions';
export type { FeatureOptionsState } from './hooks/useFeatureOptions';

export { useSavedSearches } from './hooks/useSavedSearches';
export type { SavedSearch, SavedSearchesState, UseSavedSearchesReturn } from './hooks/useSavedSearches';

export { useFavourites } from './hooks/useFavourites';
export type { FavouriteListing, FavouritesState, UseFavouritesReturn } from './hooks/useFavourites';

// Direct Invitations
export { useDirectInvite } from './hooks/useDirectInvite';
export type { DirectInvitation, CreateInvitationInput, DirectInviteState, UseDirectInviteReturn } from './hooks/useDirectInvite';

// Mission 05: Applications
export { useApplications } from './hooks/useApplications';
export { useApplication } from './hooks/useApplication';
export { useMyApplications } from './hooks/useMyApplications';
export { useApplicationMutations } from './hooks/useApplicationMutations';

// Mission 06: Vacancy Detection (deferred from Mission 04)
export { useVacancyPrompt } from './hooks/useVacancyPrompt';
export type { VacancyPrompt } from './hooks/useVacancyPrompt';

// Mission 06: Tenancies
export { useTenancies } from './hooks/useTenancies';
export type { TenanciesState, TenanciesFilter } from './hooks/useTenancies';

export { useTenancy } from './hooks/useTenancy';
export type { TenancyState } from './hooks/useTenancy';

export { useMyTenancy } from './hooks/useMyTenancy';
export type { MyTenancyState } from './hooks/useMyTenancy';

export { useTenancyMutations } from './hooks/useTenancyMutations';
export type { TenancyMutations, RentIncreaseInput, DocumentUpload } from './hooks/useTenancyMutations';

// Export types
export type {
  Database,
  Profile,
  ProfileInsert,
  ProfileUpdate,
  UserRole,
  SubscriptionTier,
  SubscriptionStatus,
  // Mission 03: Properties
  Property,
  PropertyInsert,
  PropertyUpdate,
  PropertyImage,
  PropertyImageInsert,
  PropertyWithImages,
  PropertyType,
  PaymentFrequency,
  PropertyStatus,
  // Mission 04: Listings
  Listing,
  ListingInsert,
  ListingUpdate,
  ListingFeature,
  ListingWithDetails,
  ListingStatus,
  LeaseTerm,
  FeatureOption,
  // Mission 05: Applications
  Application,
  ApplicationInsert,
  ApplicationUpdate,
  ApplicationReference,
  ApplicationDocument,
  ApplicationWithDetails,
  ApplicationStatus,
  EmploymentType,
  ReferenceType,
  DocumentType,
  // Mission 06: Tenancies
  Tenancy,
  TenancyInsert,
  TenancyUpdate,
  TenancyTenant,
  TenancyDocument,
  TenancyWithDetails,
  TenancyStatus,
  BondStatus,
  TenancyDocumentType,
  RentIncrease,
  RentIncreaseStatus,
  // Mission 07: Payments
  PaymentStatus,
  PaymentType,
  PaymentMethodType,
  AddOnType,
  AddOnStatus,
  RentSchedule,
  RentScheduleInsert,
  Payment,
  PaymentInsert,
  PaymentUpdate,
  PaymentWithDetails,
  PaymentMethod,
  PaymentMethodInsert,
  OwnerStripeAccount,
  TenantStripeCustomer,
  AutoPaySettings,
  AutoPaySettingsInsert,
  AddOnPurchase,
  AddOnPurchaseInsert,
  // Tenant-Owner Connection
  ConnectionCode,
  ConnectionCodeInsert,
  ConnectionCodeUpdate,
  ConnectionCodeWithDetails,
  ConnectionAttempt,
  ConnectionType,
  ConnectionAttemptStatus,
  TenantAvailability,
  TenantAvailabilityInsert,
  TenantAvailabilityUpdate,
  TenantEmploymentStatus,
  MatchSuggestion,
  MatchSuggestionWithDetails,
  MatchSuggestionStatus,
  // Mission 08: Arrears
  ArrearsSeverity,
  ArrearsActionType,
  PaymentPlanStatus,
  ArrearsRecord,
  ArrearsRecordInsert,
  ArrearsRecordUpdate,
  ArrearsRecordWithDetails,
  PaymentPlan,
  PaymentPlanInsert,
  PaymentPlanUpdate,
  PaymentPlanInstallment,
  PaymentPlanWithDetails,
  ArrearsAction,
  ArrearsActionInsert,
  ReminderTemplate,
  ReminderTemplateInsert,
  ReminderTemplateUpdate,
  // Mission 14: Agent
  AgentTaskCategory,
  AgentTaskStatus,
  AgentTaskPriority,
  AgentTask,
  AgentTaskInsert,
  AgentTaskUpdate,
  AgentAutonomySettings,
  AgentAutonomySettingsInsert,
  AgentAutonomySettingsUpdate,
  AgentProactiveAction,
  AgentPendingAction,
  AgentMessageRole,
  TimelineEntry,
  AutonomyPreset,
  AutonomyLevel,
} from './types/database';

// Mission 06: Compliance System
export { getComplianceChecklist } from './constants/complianceChecklist';
export type { ComplianceState, ComplianceItem, ComplianceCategory } from './constants/complianceChecklist';

// Mission 11: Inspection rules & constants
export {
  INSPECTION_RULES,
  CONDITION_RATING_CONFIG,
  WEAR_AND_TEAR_GUIDELINES,
  PROFESSIONAL_INSPECTION_PRICING,
  getNoticeRequirement,
  isInspectionDue,
  getEarliestScheduleDate,
  getConditionSeverity,
  getWorstCondition,
} from './constants/inspectionRules';
export type { InspectionRule, ConditionConfig, NoticeRequirement } from './constants/inspectionRules';

export { generateLeaseHTML } from './services/leaseGenerator';
export type { LeaseData } from './services/leaseGenerator';

export { generateConditionReportHTML, getDefaultRooms } from './services/conditionReportGenerator';
export type { ConditionRating as ReportConditionRating, RoomItem, RoomReport, ConditionReportData } from './services/conditionReportGenerator';

// Condition Report PDF Template
export { generateConditionReportPDF } from './services/conditionReportTemplate';
export type {
  ConditionReportPhoto,
  ConditionReportItem,
  ConditionReportRoom,
  ConditionReportSignature,
  ConditionReportSubmission,
  ConditionReportData as ConditionReportPDFData,
} from './services/conditionReportTemplate';

// State-specific legislation references
export { getDetailedStateLegislation } from './services/documentTemplates';
export type {
  StateLegislation,
  LegislationSection,
  BondInfo,
  NoticePeriods,
  PrescribedForm,
} from './services/documentTemplates';

// Mission 06: Rent increase rules
export {
  RENT_INCREASE_RULES,
  TERMINATION_NOTICE_PERIODS,
  calculateMinimumEffectiveDate,
  canIncreaseRent,
} from './constants/rentIncreaseRules';
export type { RentIncreaseRule } from './constants/rentIncreaseRules';

// Mission 08: Arrears rules and calculations
export {
  ARREARS_SEVERITY_THRESHOLDS,
  ARREARS_SEVERITY_CONFIG as ARREARS_SEVERITY_UI_CONFIG,
  BREACH_NOTICE_REQUIREMENTS,
  REMINDER_THRESHOLDS,
  calculateSeverity,
  calculateDaysOverdue,
  getReminderTypeForDays,
  shouldSendReminder,
  calculateRemedyDate,
  canIssueBreachNotice,
  calculateInstallments,
  formatAUDollars,
} from './constants/arrearsRules';

// Mission 07: Rent Collection & Payments
export { useRentSchedule } from './hooks/useRentSchedule';
export type { RentScheduleState } from './hooks/useRentSchedule';

export { usePayments } from './hooks/usePayments';
export type { PaymentsState, PaymentsFilter } from './hooks/usePayments';

export { usePaymentMethods } from './hooks/usePaymentMethods';
export type { PaymentMethodsState } from './hooks/usePaymentMethods';

export { usePaymentMutations } from './hooks/usePaymentMutations';
export type { PaymentMutations, AutoPayInput } from './hooks/usePaymentMutations';

export { useAutoPay } from './hooks/useAutoPay';
export type { AutoPayState } from './hooks/useAutoPay';

export { useOwnerPayouts } from './hooks/useOwnerPayouts';
export type { OwnerPayoutsState } from './hooks/useOwnerPayouts';

// Tenant-Owner Connection System
export { useConnectionCodes } from './hooks/useConnectionCodes';
export type { ConnectionCodesState, ConnectionCodesActions, CreateConnectionCodeInput } from './hooks/useConnectionCodes';

export { useConnection } from './hooks/useConnection';
export type { ConnectionState, ConnectionActions, ConnectionResult } from './hooks/useConnection';

export { useTenantAvailability } from './hooks/useTenantAvailability';
export type { TenantAvailabilityState, TenantAvailabilityActions, CreateAvailabilityInput, UpdateAvailabilityInput } from './hooks/useTenantAvailability';

export { useMatchSuggestions } from './hooks/useMatchSuggestions';
export type { MatchSuggestionsState, MatchSuggestionsActions } from './hooks/useMatchSuggestions';

// Mission 07: Subscription & payment constants
export {
  STRIPE_PRODUCTS,
  STRIPE_PRICES,
  SUBSCRIPTION_TIERS,
  ADD_ON_SERVICES,
  PLATFORM_FEE_PERCENT,
  STRIPE_FEE_PERCENT,
  BECS_FEE_PERCENT,
  PAYMENT_STATUS_CONFIG,
  TRIAL_PERIOD_DAYS,
  calculateStripeFee,
  calculatePlatformFee,
  calculateNetAmount,
  formatCurrency,
  formatDollars,
  calculateProRata,
} from './constants/subscriptions';
export type { TierInfo, AddOnInfo } from './constants/subscriptions';

// =============================================================================
// Mission 08: Arrears Management
// =============================================================================

export { useArrears } from './hooks/useArrears';
export type { ArrearsState, ArrearsFilter, ArrearsSummary } from './hooks/useArrears';

export { useArrearsDetail } from './hooks/useArrearsDetail';
export type { ArrearsDetailState } from './hooks/useArrearsDetail';

export { useArrearsMutations } from './hooks/useArrearsMutations';
export type {
  CreatePaymentPlanInput,
  LogActionInput,
  SendReminderInput,
} from './hooks/useArrearsMutations';

export { useReminderTemplates, renderTemplate } from './hooks/useReminderTemplates';
export type { ReminderTemplatesState } from './hooks/useReminderTemplates';

export { usePaymentPlan, useMyPaymentPlan } from './hooks/usePaymentPlan';
export type { PaymentPlanState, PaymentPlanProgress } from './hooks/usePaymentPlan';

export { useMyArrears } from './hooks/useMyArrears';
export type { MyArrearsState } from './hooks/useMyArrears';

// Legacy gateway hook (now implemented)
export { useArrearsGateway, ARREARS_SEVERITY_CONFIG } from './hooks/gateways';
export type { ArrearsGatewayState, ArrearsGatewayActions } from './hooks/gateways';

// =============================================================================
// Gateway Hooks for Future Missions
// These hooks provide navigation entry points and placeholder state
// They allow the app to prepare UI flows for features implemented in later missions
// =============================================================================

// Mission 09: Maintenance Requests (Implemented)
export { useMaintenance } from './hooks/useMaintenance';
export type { MaintenanceState, MaintenanceFilter, MaintenanceSummary, MaintenanceListItem } from './hooks/useMaintenance';

export { useMaintenanceRequest } from './hooks/useMaintenanceRequest';
export type { MaintenanceRequestState } from './hooks/useMaintenanceRequest';

export { useMyMaintenance } from './hooks/useMyMaintenance';
export type { MyMaintenanceState, MyMaintenanceFilter, MyMaintenanceItem } from './hooks/useMyMaintenance';

export { useMaintenanceMutations } from './hooks/useMaintenanceMutations';
export type { CreateMaintenanceInput } from './hooks/useMaintenanceMutations';

export type {
  MaintenanceCategory,
  MaintenanceUrgency,
  MaintenanceStatus,
  MaintenanceRequest,
  MaintenanceRequestInsert,
  MaintenanceRequestUpdate,
  MaintenanceImage,
  MaintenanceImageInsert,
  MaintenanceComment,
  MaintenanceCommentInsert,
  MaintenanceStatusHistory,
  MaintenanceRequestWithDetails,
} from './types/database';

// Legacy gateway hook
export { useMaintenanceGateway } from './hooks/gateways';
export type { MaintenanceGatewayState, MaintenanceGatewayActions } from './hooks/gateways';

// Mission 10: Tradesperson Network
export { useTradesGateway } from './hooks/gateways';
export type { TradesGatewayState, TradesGatewayActions, CreateWorkOrderInput as GatewayCreateWorkOrderInput, ReviewInput } from './hooks/gateways';

export { useTrades } from './hooks/useTrades';
export type { TradesFilter, TradesState } from './hooks/useTrades';

export { useMyTrades } from './hooks/useMyTrades';
export type { MyTradesFilter, MyTradesState, MyTradesSummary } from './hooks/useMyTrades';

export { useTradeMutations } from './hooks/useTradeMutations';
export type { AddTradeInput, CreateWorkOrderInput, SubmitReviewInput } from './hooks/useTradeMutations';

export { useTradeReviews } from './hooks/useTradeReviews';
export type { TradeReviewsState, TradeReviewsSummary } from './hooks/useTradeReviews';

export { useWorkOrders } from './hooks/useWorkOrders';
export type { WorkOrdersFilter, WorkOrderListItem, WorkOrdersSummary } from './hooks/useWorkOrders';

export { useWorkOrder } from './hooks/useWorkOrder';
export type { WorkOrderState } from './hooks/useWorkOrder';

export { useReviewRequests } from './hooks/useReviewRequests';
export type { ReviewRequestsState } from './hooks/useReviewRequests';

// Mission 11: Property Inspections (Implemented)
export { useInspections } from './hooks/useInspections';
export type { InspectionsState, InspectionFilter, InspectionSummary, InspectionListItem } from './hooks/useInspections';

export { useInspection } from './hooks/useInspection';
export type { InspectionState } from './hooks/useInspection';

export { useInspectionTemplates } from './hooks/useInspectionTemplates';
export type { InspectionTemplatesState, TemplateWithRooms } from './hooks/useInspectionTemplates';

export { useInspectionMutations } from './hooks/useInspectionMutations';
export type { ScheduleInspectionInput, AddRoomInput, RateItemInput } from './hooks/useInspectionMutations';

export { useMyInspections } from './hooks/useMyInspections';
export type { MyInspectionsState, MyInspectionsFilter, MyInspectionItem } from './hooks/useMyInspections';

export type {
  InspectionType,
  InspectionStatus,
  ConditionRating,
  InspectionRow,
  InspectionInsert,
  InspectionUpdate,
  InspectionRoomRow,
  InspectionRoomInsert,
  InspectionRoomUpdate,
  InspectionItemRow,
  InspectionItemInsert,
  InspectionItemUpdate,
  InspectionImageRow,
  InspectionImageInsert,
  InspectionVoiceNoteRow,
  InspectionTemplateRow,
  InspectionTemplateRoomRow,
  InspectionAIComparisonRow,
  InspectionAIIssueRow,
  InspectionWithDetails,
  OutsourceMode,
  InspectionAssignmentRow,
  InspectionAssignmentInsert,
  InspectionAssignmentUpdate,
  InspectorAccessTokenRow,
  InspectorAccessTokenInsert,
  TenantSubmissionType,
  SubmissionStatus,
  DisputeStatus,
  InspectionTenantSubmissionRow,
  InspectionTenantSubmissionInsert,
  InspectionRoomAcknowledgmentRow,
  InspectionRoomAcknowledgmentInsert,
  InspectionItemDisputeRow,
  InspectionItemDisputeInsert,
} from './types/database';

// Inspection Review (Tenant review workflow)
export { useInspectionReview } from './hooks/useInspectionReview';
export type { InspectionReviewState } from './hooks/useInspectionReview';

// Authority Submissions (compliance/regulatory)
export { useAuthoritySubmissions } from './hooks/useAuthoritySubmissions';
export type { AuthoritySubmissionsState, UseAuthoritySubmissionsReturn } from './hooks/useAuthoritySubmissions';

export type {
  AuthoritySubmissionType,
  AuthoritySubmissionMethod,
  AuthoritySubmissionStatus,
  ProofOfServiceType,
  AuthoritySubmissionRow,
  AuthoritySubmissionInsert,
  AuthoritySubmissionUpdate,
} from './types/database';

// Mission 11 Phase K: Inspection Outsourcing
export { useInspectionOutsourcing, useInspectionOutsourcingMutations } from './hooks/useInspectionOutsourcing';
export type { InspectionOutsourcingState } from './hooks/useInspectionOutsourcing';

// Mission 11: AI Comparison
export { useAIComparison, useAIComparisonMutations } from './hooks/useAIComparison';
export type { AIComparisonState, AIComparisonResult } from './hooks/useAIComparison';

// Legacy gateway hook
export { useInspectionsGateway } from './hooks/gateways';
export type { InspectionsGatewayState, InspectionsGatewayActions } from './hooks/gateways';

// Mission 12: In-App Communications (Implemented)
export { useConversations } from './hooks/useConversations';
export type { ConversationsState, ConversationsFilter, ConversationListItem } from './hooks/useConversations';

export { useConversation } from './hooks/useConversation';
export type { ConversationState, MessageListItem, ConversationParticipant } from './hooks/useConversation';

export { useMessageMutations } from './hooks/useMessageMutations';
export type { CreateConversationInput, SendMessageInput } from './hooks/useMessageMutations';

export { useMessageTemplates, renderMessageTemplate } from './hooks/useMessageTemplates';
export type { MessageTemplatesState } from './hooks/useMessageTemplates';

export { useMessageSearch } from './hooks/useMessageSearch';
export type { MessageSearchState, MessageSearchResult } from './hooks/useMessageSearch';

export { useNotificationPreferences } from './hooks/useNotificationPreferences';
export type { NotificationPreferencesState, NotificationPreferences } from './hooks/useNotificationPreferences';

export { initiatePMTransitionSequence, cancelPMTransitionSequence } from './services/pmTransitionService';
export type { PMTransitionParams } from './services/pmTransitionService';

export type {
  ConversationType,
  MessageStatus,
  MessageContentType,
  ConversationRow,
  ConversationInsert,
  ConversationUpdate,
  ConversationParticipantRow,
  ConversationParticipantInsert,
  MessageRow,
  MessageInsert,
  MessageUpdate,
  MessageAttachmentRow,
  MessageAttachmentInsert,
  MessageReadReceiptRow,
  MessageReactionRow,
  MessageTemplateRow,
  MessageTemplateInsert,
  MessageTemplateUpdate,
  ConversationWithDetails,
  MessageWithDetails,
} from './types/database';

// =============================================================================
// Mission 13: Reports & Analytics
// =============================================================================

export { useDashboard } from './hooks/useDashboard';
export type { DashboardState, DashboardFilter } from './hooks/useDashboard';

export { useFinancials } from './hooks/useFinancials';
export type { FinancialsState, FinancialsFilter } from './hooks/useFinancials';

export { useExpenses } from './hooks/useExpenses';
export type { ExpensesState, ExpensesFilter } from './hooks/useExpenses';

export { useReports } from './hooks/useReports';
export type { ReportsState } from './hooks/useReports';

export { useCashFlowForecast } from './hooks/useCashFlowForecast';
export type { CashFlowForecastState, CashFlowForecastFilter, ForecastMonth, ForecastAssumptions, ForecastRisk } from './hooks/useCashFlowForecast';

export type {
  ReportType,
  ReportFormat,
  ReportStatus,
  ReportFrequency,
  ExpenseCategoryRow,
  ExpenseCategoryInsert,
  ExpenseCategoryUpdate,
  ManualExpenseRow,
  ManualExpenseInsert,
  ManualExpenseUpdate,
  GeneratedReportRow,
  GeneratedReportInsert,
  GeneratedReportUpdate,
  ScheduledReportRow,
  ScheduledReportInsert,
  ScheduledReportUpdate,
  PortfolioSummary,
  MonthlyFinancial,
  TaxSummary,
  PropertyMetricsRow,
} from './types/database';

// Mission 14: AI Agent Hooks (implemented)
export { useAgentChat } from './hooks/useAgentChat';
export type { AgentChatState, UseAgentChatReturn } from './hooks/useAgentChat';
export type { AgentMessage, AgentConversation, InlineAction, AgentDecision, AgentCorrection, AgentTrajectory, ToolGenome, ConfidenceFactors, ErrorType, AgentOutcome, OutcomeType } from './types/database';

// Document Hub & E-Signing
export { useDocuments } from './hooks/useDocuments';
export type { DocumentsState, DocumentsFilter, UseDocumentsReturn } from './hooks/useDocuments';

export { useDocument } from './hooks/useDocument';
export type { DocumentState, UseDocumentReturn } from './hooks/useDocument';

export { useDocumentFolders } from './hooks/useDocumentFolders';
export type { DocumentFoldersState, UseDocumentFoldersReturn } from './hooks/useDocumentFolders';

export { useDocumentUpload } from './hooks/useDocumentUpload';
export type { UploadProgress, UseDocumentUploadReturn } from './hooks/useDocumentUpload';

export { useDocumentShares } from './hooks/useDocumentShares';
export type { DocumentSharesState, UseDocumentSharesReturn } from './hooks/useDocumentShares';

export type {
  CasaDocumentType,
  CasaDocumentStatus,
  DocumentRow,
  DocumentInsert,
  DocumentUpdate,
  DocumentSignatureRow,
  DocumentSignatureInsert,
  SavedSignatureRow,
  SavedSignatureInsert,
  DocumentWithSignatures,
  DocumentFolderRow,
  DocumentFolderInsert,
  DocumentFolderUpdate,
  ShareType,
  DocumentShareRow,
  DocumentShareInsert,
  DocumentAccessAction,
  DocumentAccessLogRow,
  LeaseTemplateRow,
  DocumentWithFolder,
  DocumentShareWithDocument,
  AnnotationType,
  DocumentAnnotationRow,
  DocumentAnnotationInsert,
} from './types/database';

export { useAgentTasks } from './hooks/useAgentTasks';
export type { AgentTasksState, UseAgentTasksReturn } from './hooks/useAgentTasks';

export { useAutonomySettings } from './hooks/useAutonomySettings';
export type { AutonomySettingsState, UseAutonomySettingsReturn } from './hooks/useAutonomySettings';

export { useGenerateListing } from './hooks/useGenerateListing';
export type { GenerateListingResult, UseGenerateListingReturn } from './hooks/useGenerateListing';

export { useAgentInsights } from './hooks/useAgentInsights';
export type { AgentInsight, AgentInsightsState, UseAgentInsightsReturn } from './hooks/useAgentInsights';

export { AgentProvider, useAgentContext } from './providers/AgentProvider';
export type { AgentContextValue } from './providers/AgentProvider';

// Activity Feed (UX Redesign)
export { useActivityFeed } from './hooks/useActivityFeed';
export type { ActivityFeedItem, PendingApprovalItem, ApprovalActionType, ActivityFeedState, ActivityItemType } from './hooks/useActivityFeed';

// Casa Property Actions (AI-first UX layer)
export { useCasaPropertyActions } from './hooks/useCasaPropertyActions';
export type { CasaPropertyAction, UseCasaPropertyActionsReturn } from './hooks/useCasaPropertyActions';

// Mission 15: Learning & Compliance
export { useAgentRules } from './hooks/useAgentRules';
export type { UseAgentRulesReturn } from './hooks/useAgentRules';

export type {
  AgentRule,
  AgentRuleInsert,
  AgentRuleUpdate,
  RuleCategory,
  RuleSource,
  AutonomyGraduationTracking,
} from './types/database';

export { useCompliance } from './hooks/useCompliance';
export type { UseComplianceReturn, ComplianceSummary } from './hooks/useCompliance';

export { useAutonomyGraduation } from './hooks/useAutonomyGraduation';
export type { UseAutonomyGraduationReturn } from './hooks/useAutonomyGraduation';

// =============================================================================
// Mission 17: Push Notifications & Alerts
// =============================================================================

export { useNotifications } from './hooks/useNotifications';
export type { NotificationsState, UseNotificationsReturn } from './hooks/useNotifications';

export { useUnreadCount } from './hooks/useUnreadCount';
export type { UseUnreadCountReturn } from './hooks/useUnreadCount';

export { usePushToken } from './hooks/usePushToken';
export type { UsePushTokenReturn } from './hooks/usePushToken';

export { useNotificationSettings } from './hooks/useNotificationSettings';
export type { NotificationSettingsState, UseNotificationSettingsReturn } from './hooks/useNotificationSettings';

export type {
  NotificationType,
  PushTokenPlatform,
  PushTokenRow,
  PushTokenInsert,
  PushTokenUpdate,
  NotificationRow,
  NotificationInsert,
  NotificationUpdate,
  EmailDigestFrequency,
  NotificationSettingsRow,
  NotificationSettingsInsert,
  NotificationSettingsUpdate,
  ScheduledNotificationStatus,
  ScheduledNotificationRow,
  ScheduledNotificationInsert,
  ScheduledNotificationUpdate,
} from './types/database';

export { useLearningContent } from './hooks/useLearningContent';
export type { LearningArticle, UserLearningProgress, UseLearningContentReturn } from './hooks/useLearningContent';

export { useRegulatoryUpdates } from './hooks/useRegulatoryUpdates';
export type { RegulatoryUpdate, RegulatoryUpdateNotification, UseRegulatoryUpdatesReturn } from './hooks/useRegulatoryUpdates';

// Mission 17: Notifications
export { useNotificationsGateway, getNotificationRoute } from './hooks/gateways';
export type { NotificationsGatewayState, NotificationsGatewayActions } from './hooks/gateways';

// Mission 10: Trade database types
export type {
  TradeRow,
  TradeInsert,
  TradeUpdate,
  TradeWithNetwork,
  OwnerTradeRow,
  OwnerTradeInsert,
  OwnerTradeUpdate,
  WorkOrderRow,
  WorkOrderInsert,
  WorkOrderUpdate,
  WorkOrderWithDetails,
  TradeReviewRow,
  TradeReviewInsert,
  TradeReviewUpdate,
  TradeReviewWithDetails,
  TradePortfolioRow,
  TradePortfolioInsert,
} from './types/database';

// Gateway Types (for future mission implementations)
export type {
  // Mission 10: Trades
  Trade,
  WorkOrder,
  TradeReview,
  TradeStatus,
  WorkOrderStatus,
  // Mission 11: Inspections (gateway types - core types now exported from database.ts above)
  Inspection,
  InspectionRoom,
  InspectionItem,
  InspectionImage,
  // Mission 12: Messages (gateway types - core types now exported from database.ts above)
  Conversation as GatewayConversation,
  Message as GatewayMessage,
  MessageAttachment as GatewayMessageAttachment,
  ConversationType as GatewayConversationType,
  // Mission 14: Agent (gateway types)
  AgentConversation as GatewayAgentConversation,
  AgentMessage as GatewayAgentMessage,
  AgentPendingAction as GatewayAgentPendingAction,
  AgentAutonomyLevel,
  // Mission 17: Notifications (gateway versions)
  Notification as GatewayNotification,
  NotificationPreference as GatewayNotificationPreference,
  NotificationSettings as GatewayNotificationSettings,
  NotificationType as GatewayNotificationType,
  // Gateway state helpers
  GatewayState,
  GatewayListState,
} from './types/gateways';

// =============================================================================
// Mission 18: Security Audit — Sessions, Alerts, Audit Log, Consent, Data Export
// =============================================================================

export { useUserSessions } from './hooks/useUserSessions';
export type { UserSession, UserSessionsState, UseUserSessionsReturn } from './hooks/useUserSessions';

export { useSecurityAlerts } from './hooks/useSecurityAlerts';
export type { SecurityAlert, SecurityAlertsState, UseSecurityAlertsReturn } from './hooks/useSecurityAlerts';

export { useAuditLog } from './hooks/useAuditLog';
export type { AuditLogEntry, AuditLogState, UseAuditLogReturn } from './hooks/useAuditLog';

export { useConsent } from './hooks/useConsent';
export type { UserConsent, ConsentState, UseConsentReturn } from './hooks/useConsent';

export { useDataExport } from './hooks/useDataExport';
export type { DataRequest, DataExportState, UseDataExportReturn } from './hooks/useDataExport';

// Mission 20: Support Tickets
export { useSupportTickets } from './hooks/useSupportTickets';
export type {
  SupportTicket,
  SupportMessage,
  SupportTicketsState,
  UseSupportTicketsReturn,
  TicketCategory,
  TicketStatus,
  TicketPriority,
} from './hooks/useSupportTickets';

export { useMFA } from './hooks/useMFA';
export type { MFAState, UseMFAReturn } from './hooks/useMFA';

// =============================================================================
// Beyond-PM Intelligence Types
// =============================================================================

export type {
  PropertyHealthScore,
  PortfolioSnapshot,
  TenantSatisfaction,
  MarketIntelligence,
} from './types/database';

// =============================================================================
// Cache Configuration
// =============================================================================

export { CACHE_CONFIG } from './cache';
export type { CacheKey } from './cache';

// In-memory cache utilities (Mission 19: Performance Optimization)
export { getCached, setCache, invalidateCache, MEMORY_CACHE_CONFIG } from './cache';

// =============================================================================
// Pagination Utilities (Mission 19: Performance Optimization)
// =============================================================================

export { encodeCursor, decodeCursor, paginatedQuery } from './pagination';
export type { PaginationParams, PaginatedResult } from './pagination';

// Re-export Supabase types
export type { SupabaseClient, User, Session } from '@supabase/supabase-js';
