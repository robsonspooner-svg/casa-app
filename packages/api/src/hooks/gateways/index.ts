// Gateway Hooks Index
// These hooks provide navigation entry points and placeholder state for future missions
// They allow the current app to prepare UI elements and navigation flows
// that will be fully functional once the corresponding missions are implemented

// Mission 08: Arrears Management
export { useArrearsGateway, ARREARS_SEVERITY_CONFIG } from './useArrearsGateway';
export type {
  ArrearsGatewayState,
  ArrearsGatewayActions,
  CreatePaymentPlanInput,
} from './useArrearsGateway';

// Mission 09: Maintenance Requests
export { useMaintenanceGateway } from './useMaintenanceGateway';
export type {
  MaintenanceGatewayState,
  MaintenanceGatewayActions,
  CreateMaintenanceInput,
} from './useMaintenanceGateway';

// Mission 10: Tradesperson Network
export { useTradesGateway } from './useTradesGateway';
export type {
  TradesGatewayState,
  TradesGatewayActions,
  CreateWorkOrderInput,
  ReviewInput,
} from './useTradesGateway';

// Mission 11: Property Inspections
export { useInspectionsGateway } from './useInspectionsGateway';
export type {
  InspectionsGatewayState,
  InspectionsGatewayActions,
  ScheduleInspectionInput,
} from './useInspectionsGateway';

// Mission 17: Notifications
export { useNotificationsGateway, getNotificationRoute } from './useNotificationsGateway';
export type {
  NotificationsGatewayState,
  NotificationsGatewayActions,
} from './useNotificationsGateway';
