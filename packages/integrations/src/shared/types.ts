// Shared Types for Portal Integrations
// Casa - Mission 04: Property Listings

export interface PortalListing {
  // Core property details
  propertyType: 'house' | 'apartment' | 'townhouse' | 'unit' | 'studio' | 'villa';
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  landSizeSqm?: number;
  floorSizeSqm?: number;

  // Address
  streetAddress: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;

  // Listing details
  title: string;
  description: string;
  availableDate: string; // ISO date string
  rentAmountWeekly: number;
  bondWeeks: number;
  leaseTerm: '6 months' | '12 months' | '24 months' | 'flexible';

  // Policies
  petsAllowed: boolean;
  petsDescription?: string;
  smokingAllowed: boolean;
  furnished: boolean;

  // Features
  features: string[];

  // Images
  images: PortalImage[];

  // Contact
  agentName: string;
  agentEmail: string;
  agentPhone: string;
}

export interface PortalImage {
  url: string;
  isPrimary: boolean;
  caption?: string;
}

export interface PortalSyncResult {
  success: boolean;
  portalListingId?: string;
  portalUrl?: string;
  error?: string;
  errorCode?: string;
}

export interface PortalApiConfig {
  apiKey: string;
  apiSecret?: string;
  environment: 'sandbox' | 'production';
  agentId?: string;
}

export type PortalSyncStatus = 'pending' | 'synced' | 'failed' | 'not_synced';
