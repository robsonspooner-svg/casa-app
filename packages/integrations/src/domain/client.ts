// Domain.com.au API Client
// Casa - Mission 04: Property Listings
//
// Integration with Domain's Listings API for property syndication.
// API Documentation: https://developer.domain.com.au/docs/apis/pkg_listing_management

import type { PortalListing, PortalSyncResult, PortalApiConfig } from '../shared/types';

const DOMAIN_API_BASE = {
  sandbox: 'https://api.domain.com.au/sandbox',
  production: 'https://api.domain.com.au/v1',
};

export class DomainClient {
  private apiKey: string;
  private baseUrl: string;
  private agentId: string;

  constructor(config: PortalApiConfig) {
    if (!config.apiKey) {
      throw new Error('Domain API key is required');
    }
    if (!config.agentId) {
      throw new Error('Domain agent ID is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = DOMAIN_API_BASE[config.environment];
    this.agentId = config.agentId;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data?: T; error?: string }> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Domain API error: ${response.status}`, errorBody);
        return {
          error: `Domain API error: ${response.status} - ${errorBody}`,
        };
      }

      const data = await response.json();
      return { data };
    } catch (error: any) {
      console.error('Domain API request failed:', error);
      return { error: error.message || 'Domain API request failed' };
    }
  }

  private mapPropertyType(type: PortalListing['propertyType']): string {
    const typeMap: Record<string, string> = {
      house: 'house',
      apartment: 'apartmentUnitFlat',
      townhouse: 'townhouse',
      unit: 'apartmentUnitFlat',
      studio: 'studio',
      villa: 'villa',
    };
    return typeMap[type] || 'house';
  }

  private mapState(state: string): string {
    const stateMap: Record<string, string> = {
      'NSW': 'nsw',
      'VIC': 'vic',
      'QLD': 'qld',
      'SA': 'sa',
      'WA': 'wa',
      'TAS': 'tas',
      'NT': 'nt',
      'ACT': 'act',
    };
    return stateMap[state.toUpperCase()] || state.toLowerCase();
  }

  async createListing(listing: PortalListing): Promise<PortalSyncResult> {
    // Map Casa listing to Domain API format
    const domainListing = {
      listingType: 'rent',
      propertyDetails: {
        propertyType: [this.mapPropertyType(listing.propertyType)],
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        carspaces: listing.parkingSpaces,
        landArea: listing.landSizeSqm ? {
          value: listing.landSizeSqm,
          unit: 'squareMetres',
        } : undefined,
        buildingArea: listing.floorSizeSqm ? {
          value: listing.floorSizeSqm,
          unit: 'squareMetres',
        } : undefined,
        features: listing.features,
      },
      address: {
        streetNumber: listing.streetAddress.split(' ')[0],
        street: listing.streetAddress.split(' ').slice(1).join(' '),
        suburb: listing.suburb,
        state: this.mapState(listing.state),
        postcode: listing.postcode,
        country: 'AU',
        displayOption: 'fullAddress',
      },
      headline: listing.title,
      description: listing.description,
      priceDetails: {
        displayPrice: `$${listing.rentAmountWeekly} per week`,
        priceFrom: listing.rentAmountWeekly,
        priceType: 'rent',
      },
      availableDate: listing.availableDate,
      bond: listing.rentAmountWeekly * listing.bondWeeks,
      inspectionDetails: {
        inspectionByAppointmentOnly: true,
      },
      allowedPets: listing.petsAllowed,
      petDescription: listing.petsDescription,
      smoking: listing.smokingAllowed,
      furnished: listing.furnished,
      media: listing.images.map((img, index) => ({
        url: img.url,
        type: 'photo',
        order: index,
      })),
      contactDetails: {
        agentIds: [this.agentId],
        email: listing.agentEmail,
        phone: listing.agentPhone,
      },
    };

    const { data, error } = await this.request<{ id: string; status: string }>(
      '/listings',
      {
        method: 'POST',
        body: JSON.stringify(domainListing),
      }
    );

    if (error) {
      return { success: false, error };
    }

    return {
      success: true,
      portalListingId: data?.id,
      portalUrl: `https://www.domain.com.au/listing/${data?.id}`,
    };
  }

  async updateListing(portalListingId: string, listing: PortalListing): Promise<PortalSyncResult> {
    // Similar mapping as createListing
    const domainListing = {
      headline: listing.title,
      description: listing.description,
      priceDetails: {
        displayPrice: `$${listing.rentAmountWeekly} per week`,
        priceFrom: listing.rentAmountWeekly,
        priceType: 'rent',
      },
      availableDate: listing.availableDate,
      bond: listing.rentAmountWeekly * listing.bondWeeks,
      allowedPets: listing.petsAllowed,
      petDescription: listing.petsDescription,
      smoking: listing.smokingAllowed,
      furnished: listing.furnished,
      media: listing.images.map((img, index) => ({
        url: img.url,
        type: 'photo',
        order: index,
      })),
    };

    const { data, error } = await this.request<{ id: string; status: string }>(
      `/listings/${portalListingId}`,
      {
        method: 'PUT',
        body: JSON.stringify(domainListing),
      }
    );

    if (error) {
      return { success: false, error };
    }

    return {
      success: true,
      portalListingId: data?.id || portalListingId,
      portalUrl: `https://www.domain.com.au/listing/${portalListingId}`,
    };
  }

  async deleteListing(portalListingId: string): Promise<PortalSyncResult> {
    const { error } = await this.request(
      `/listings/${portalListingId}`,
      { method: 'DELETE' }
    );

    if (error) {
      return { success: false, error };
    }

    return { success: true };
  }

  async getListing(portalListingId: string): Promise<{ data?: any; error?: string }> {
    return this.request(`/listings/${portalListingId}`);
  }

  async getAgentProfile(): Promise<{ data?: any; error?: string }> {
    return this.request(`/agents/${this.agentId}`);
  }
}

// Factory function using environment variables
export function createDomainClient(env?: {
  DOMAIN_API_KEY?: string;
  DOMAIN_AGENT_ID?: string;
  DOMAIN_ENVIRONMENT?: string;
}): DomainClient | null {
  // Use provided env object or fall back to process.env
  const apiKey = env?.DOMAIN_API_KEY ?? process.env.DOMAIN_API_KEY;
  const agentId = env?.DOMAIN_AGENT_ID ?? process.env.DOMAIN_AGENT_ID;
  const environment = (env?.DOMAIN_ENVIRONMENT ?? process.env.DOMAIN_ENVIRONMENT ?? 'sandbox') as 'sandbox' | 'production';

  if (!apiKey || !agentId) {
    console.warn('Domain API credentials not configured');
    return null;
  }

  return new DomainClient({
    apiKey,
    agentId,
    environment,
  });
}
