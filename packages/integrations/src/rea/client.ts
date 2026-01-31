// REA (realestate.com.au) API Client
// Casa - Mission 04: Property Listings
//
// Integration with REA's Property API for property syndication.
// Note: REA API access requires being a licensed real estate agent or property manager.
// API Documentation: https://developer.realestate.com.au/

import type { PortalListing, PortalSyncResult, PortalApiConfig } from '../shared/types';

const REA_API_BASE = {
  sandbox: 'https://api.test.realestate.com.au',
  production: 'https://api.realestate.com.au',
};

export class ReaClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private agentId: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: PortalApiConfig) {
    if (!config.apiKey || !config.apiSecret) {
      throw new Error('REA API key and secret are required');
    }
    if (!config.agentId) {
      throw new Error('REA agent ID is required');
    }

    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = REA_API_BASE[config.environment];
    this.agentId = config.agentId;
  }

  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Request new token using OAuth2 client credentials flow
    const tokenUrl = `${this.baseUrl}/oauth/token`;
    const credentials = btoa(`${this.apiKey}:${this.apiSecret}`);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Failed to get REA access token: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    // Set expiry 5 minutes before actual expiry to be safe
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

    return this.accessToken!;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data?: T; error?: string }> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const token = await this.getAccessToken();

      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Api-Key': this.apiKey,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`REA API error: ${response.status}`, errorBody);
        return {
          error: `REA API error: ${response.status} - ${errorBody}`,
        };
      }

      const data = await response.json();
      return { data };
    } catch (error: any) {
      console.error('REA API request failed:', error);
      return { error: error.message || 'REA API request failed' };
    }
  }

  private mapPropertyType(type: PortalListing['propertyType']): string {
    const typeMap: Record<string, string> = {
      house: 'House',
      apartment: 'Apartment',
      townhouse: 'Townhouse',
      unit: 'Unit',
      studio: 'Studio',
      villa: 'Villa',
    };
    return typeMap[type] || 'House';
  }

  async createListing(listing: PortalListing): Promise<PortalSyncResult> {
    // Map Casa listing to REA API format
    const reaListing = {
      listingType: 'rental',
      status: 'current',
      property: {
        propertyType: this.mapPropertyType(listing.propertyType),
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        carSpaces: listing.parkingSpaces,
        landSize: listing.landSizeSqm ? {
          value: listing.landSizeSqm,
          unit: 'sqm',
        } : undefined,
        buildingSize: listing.floorSizeSqm ? {
          value: listing.floorSizeSqm,
          unit: 'sqm',
        } : undefined,
        features: listing.features,
      },
      address: {
        streetAddress: listing.streetAddress,
        suburb: listing.suburb,
        state: listing.state,
        postcode: listing.postcode,
        displayAddress: `${listing.streetAddress}, ${listing.suburb} ${listing.state} ${listing.postcode}`,
      },
      headline: listing.title,
      description: listing.description,
      rent: {
        displayPrice: `$${listing.rentAmountWeekly} per week`,
        weeklyRent: listing.rentAmountWeekly,
        bond: listing.rentAmountWeekly * listing.bondWeeks,
      },
      availableFrom: listing.availableDate,
      leaseLength: this.mapLeaseLength(listing.leaseTerm),
      features: {
        petsAllowed: listing.petsAllowed,
        petConditions: listing.petsDescription,
        smokersAllowed: listing.smokingAllowed,
        furnished: listing.furnished,
      },
      images: listing.images.map((img, index) => ({
        url: img.url,
        rank: index + 1,
        caption: img.caption,
      })),
      contact: {
        agentId: this.agentId,
        name: listing.agentName,
        email: listing.agentEmail,
        phone: listing.agentPhone,
      },
    };

    const { data, error } = await this.request<{ listingId: string; status: string }>(
      '/listings/v1/listings',
      {
        method: 'POST',
        body: JSON.stringify(reaListing),
      }
    );

    if (error) {
      return { success: false, error };
    }

    return {
      success: true,
      portalListingId: data?.listingId,
      portalUrl: `https://www.realestate.com.au/property-${listing.propertyType}-${listing.suburb.toLowerCase().replace(/\s+/g, '-')}-${listing.state.toLowerCase()}-${data?.listingId}`,
    };
  }

  private mapLeaseLength(term: PortalListing['leaseTerm']): string {
    const termMap: Record<string, string> = {
      '6 months': '6 months',
      '12 months': '12 months',
      '24 months': '24 months',
      'flexible': 'Negotiable',
    };
    return termMap[term] || '12 months';
  }

  async updateListing(portalListingId: string, listing: PortalListing): Promise<PortalSyncResult> {
    const reaListing = {
      headline: listing.title,
      description: listing.description,
      rent: {
        displayPrice: `$${listing.rentAmountWeekly} per week`,
        weeklyRent: listing.rentAmountWeekly,
        bond: listing.rentAmountWeekly * listing.bondWeeks,
      },
      availableFrom: listing.availableDate,
      leaseLength: this.mapLeaseLength(listing.leaseTerm),
      features: {
        petsAllowed: listing.petsAllowed,
        petConditions: listing.petsDescription,
        smokersAllowed: listing.smokingAllowed,
        furnished: listing.furnished,
      },
      images: listing.images.map((img, index) => ({
        url: img.url,
        rank: index + 1,
        caption: img.caption,
      })),
    };

    const { data, error } = await this.request<{ listingId: string; status: string }>(
      `/listings/v1/listings/${portalListingId}`,
      {
        method: 'PUT',
        body: JSON.stringify(reaListing),
      }
    );

    if (error) {
      return { success: false, error };
    }

    return {
      success: true,
      portalListingId: data?.listingId || portalListingId,
    };
  }

  async deleteListing(portalListingId: string): Promise<PortalSyncResult> {
    // REA uses status update to withdraw/remove listings
    const { error } = await this.request(
      `/listings/v1/listings/${portalListingId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ status: 'withdrawn' }),
      }
    );

    if (error) {
      return { success: false, error };
    }

    return { success: true };
  }

  async getListing(portalListingId: string): Promise<{ data?: any; error?: string }> {
    return this.request(`/listings/v1/listings/${portalListingId}`);
  }

  async getAgencyProfile(): Promise<{ data?: any; error?: string }> {
    return this.request(`/agencies/v1/agencies/${this.agentId}`);
  }
}

// Factory function using environment variables
export function createReaClient(env?: {
  REA_API_KEY?: string;
  REA_API_SECRET?: string;
  REA_AGENT_ID?: string;
  REA_ENVIRONMENT?: string;
}): ReaClient | null {
  // Use provided env object or fall back to process.env
  const apiKey = env?.REA_API_KEY ?? process.env.REA_API_KEY;
  const apiSecret = env?.REA_API_SECRET ?? process.env.REA_API_SECRET;
  const agentId = env?.REA_AGENT_ID ?? process.env.REA_AGENT_ID;
  const environment = (env?.REA_ENVIRONMENT ?? process.env.REA_ENVIRONMENT ?? 'sandbox') as 'sandbox' | 'production';

  if (!apiKey || !apiSecret || !agentId) {
    console.warn('REA API credentials not configured');
    return null;
  }

  return new ReaClient({
    apiKey,
    apiSecret,
    agentId,
    environment,
  });
}
