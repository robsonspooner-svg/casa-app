// Casa Integrations Package
// Third-party API clients for property portals and services

// Domain.com.au
export { DomainClient, createDomainClient } from './domain';

// REA (realestate.com.au)
export { ReaClient, createReaClient } from './rea';

// Shared types
export type {
  PortalListing,
  PortalImage,
  PortalSyncResult,
  PortalApiConfig,
  PortalSyncStatus,
} from './shared/types';
