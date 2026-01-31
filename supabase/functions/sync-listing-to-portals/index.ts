// Sync Listing to Portals - Supabase Edge Function
// Casa - Mission 04: Property Listings
//
// Syncs a Casa listing to external property portals (Domain, REA).
// Called when a listing is published or updated.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

// Portal API configuration types
interface PortalListing {
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  landSizeSqm?: number;
  floorSizeSqm?: number;
  streetAddress: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
  title: string;
  description: string;
  availableDate: string;
  rentAmountWeekly: number;
  bondWeeks: number;
  leaseTerm: string;
  petsAllowed: boolean;
  petsDescription?: string;
  smokingAllowed: boolean;
  furnished: boolean;
  features: string[];
  images: { url: string; isPrimary: boolean; caption?: string }[];
  agentName: string;
  agentEmail: string;
  agentPhone: string;
}

interface SyncRequest {
  listingId: string;
  portals?: ('domain' | 'rea')[];
  action?: 'create' | 'update' | 'delete';
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceClient();

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: SyncRequest = await req.json();
    const { listingId, portals = ['domain', 'rea'], action = 'create' } = body;

    if (!listingId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: listingId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get listing with property details
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select(`
        *,
        properties!inner(
          address_line_1,
          address_line_2,
          suburb,
          state,
          postcode,
          country,
          property_type,
          bedrooms,
          bathrooms,
          parking_spaces,
          land_size_sqm,
          floor_size_sqm,
          owner_id
        ),
        listing_features(feature)
      `)
      .eq('id', listingId)
      .eq('owner_id', user.id)
      .single();

    if (listingError || !listing) {
      return new Response(
        JSON.stringify({ error: 'Listing not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get property images
    const { data: images } = await supabase
      .from('property_images')
      .select('url, is_primary, display_order')
      .eq('property_id', listing.property_id)
      .order('display_order', { ascending: true });

    // Get owner profile for contact details
    const { data: owner } = await supabase
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', user.id)
      .single();

    // Map listing to portal format
    const portalListing: PortalListing = {
      propertyType: listing.properties.property_type,
      bedrooms: listing.properties.bedrooms,
      bathrooms: listing.properties.bathrooms,
      parkingSpaces: listing.properties.parking_spaces,
      landSizeSqm: listing.properties.land_size_sqm,
      floorSizeSqm: listing.properties.floor_size_sqm,
      streetAddress: [listing.properties.address_line_1, listing.properties.address_line_2]
        .filter(Boolean).join(', '),
      suburb: listing.properties.suburb,
      state: listing.properties.state,
      postcode: listing.properties.postcode,
      country: listing.properties.country || 'Australia',
      title: listing.title,
      description: listing.description || '',
      availableDate: listing.available_date,
      rentAmountWeekly: listing.rent_amount,
      bondWeeks: listing.bond_weeks,
      leaseTerm: listing.lease_term.replace('_', ' '),
      petsAllowed: listing.pets_allowed,
      petsDescription: listing.pets_description,
      smokingAllowed: listing.smoking_allowed,
      furnished: listing.furnished,
      features: listing.listing_features?.map((f: any) => f.feature) || [],
      images: (images || []).map((img: any) => ({
        url: img.url,
        isPrimary: img.is_primary,
      })),
      agentName: owner?.full_name || 'Property Owner',
      agentEmail: owner?.email || user.email!,
      agentPhone: owner?.phone || '',
    };

    const results: Record<string, { success: boolean; portalListingId?: string; error?: string }> = {};

    // Sync to Domain
    if (portals.includes('domain')) {
      results.domain = await syncToDomain(listing, portalListing, action, supabase);
    }

    // Sync to REA
    if (portals.includes('rea')) {
      results.rea = await syncToRea(listing, portalListing, action, supabase);
    }

    // Update listing sync status in database
    const domainSuccess = results.domain?.success ?? listing.domain_sync_status === 'synced';
    const reaSuccess = results.rea?.success ?? listing.rea_sync_status === 'synced';

    await supabase
      .from('listings')
      .update({
        domain_listing_id: results.domain?.portalListingId || listing.domain_listing_id,
        domain_sync_status: domainSuccess ? 'synced' : 'failed',
        domain_last_synced_at: domainSuccess ? new Date().toISOString() : listing.domain_last_synced_at,
        rea_listing_id: results.rea?.portalListingId || listing.rea_listing_id,
        rea_sync_status: reaSuccess ? 'synced' : 'failed',
        rea_last_synced_at: reaSuccess ? new Date().toISOString() : listing.rea_last_synced_at,
      })
      .eq('id', listingId);

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing listing:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Domain API sync
async function syncToDomain(
  listing: any,
  portalListing: PortalListing,
  action: string,
  supabase: any
): Promise<{ success: boolean; portalListingId?: string; error?: string }> {
  const apiKey = Deno.env.get('DOMAIN_API_KEY');
  const agentId = Deno.env.get('DOMAIN_AGENT_ID');
  const environment = Deno.env.get('DOMAIN_ENVIRONMENT') || 'sandbox';

  if (!apiKey || !agentId) {
    return { success: false, error: 'Domain API not configured' };
  }

  const baseUrl = environment === 'production'
    ? 'https://api.domain.com.au/v1'
    : 'https://api.domain.com.au/sandbox';

  try {
    // Map property type to Domain format
    const propertyTypeMap: Record<string, string> = {
      house: 'house',
      apartment: 'apartmentUnitFlat',
      townhouse: 'townhouse',
      unit: 'apartmentUnitFlat',
      studio: 'studio',
      villa: 'villa',
    };

    const domainListing = {
      listingType: 'rent',
      propertyDetails: {
        propertyType: [propertyTypeMap[portalListing.propertyType] || 'house'],
        bedrooms: portalListing.bedrooms,
        bathrooms: portalListing.bathrooms,
        carspaces: portalListing.parkingSpaces,
        features: portalListing.features,
      },
      address: {
        street: portalListing.streetAddress,
        suburb: portalListing.suburb,
        state: portalListing.state.toLowerCase(),
        postcode: portalListing.postcode,
        displayOption: 'fullAddress',
      },
      headline: portalListing.title,
      description: portalListing.description,
      priceDetails: {
        displayPrice: `$${portalListing.rentAmountWeekly} per week`,
        priceFrom: portalListing.rentAmountWeekly,
      },
      availableDate: portalListing.availableDate,
      bond: portalListing.rentAmountWeekly * portalListing.bondWeeks,
      allowedPets: portalListing.petsAllowed,
      furnished: portalListing.furnished,
      media: portalListing.images.map((img, i) => ({
        url: img.url,
        type: 'photo',
        order: i,
      })),
      contactDetails: {
        agentIds: [agentId],
      },
    };

    let endpoint = '/listings';
    let method = 'POST';

    if (action === 'update' && listing.domain_listing_id) {
      endpoint = `/listings/${listing.domain_listing_id}`;
      method = 'PUT';
    } else if (action === 'delete' && listing.domain_listing_id) {
      endpoint = `/listings/${listing.domain_listing_id}`;
      method = 'DELETE';
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: method !== 'DELETE' ? JSON.stringify(domainListing) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Domain API error: ${response.status} - ${errorText}` };
    }

    if (method === 'DELETE') {
      return { success: true };
    }

    const data = await response.json();
    return { success: true, portalListingId: data.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// REA API sync
async function syncToRea(
  listing: any,
  portalListing: PortalListing,
  action: string,
  supabase: any
): Promise<{ success: boolean; portalListingId?: string; error?: string }> {
  const apiKey = Deno.env.get('REA_API_KEY');
  const apiSecret = Deno.env.get('REA_API_SECRET');
  const agentId = Deno.env.get('REA_AGENT_ID');
  const environment = Deno.env.get('REA_ENVIRONMENT') || 'sandbox';

  if (!apiKey || !apiSecret || !agentId) {
    return { success: false, error: 'REA API not configured' };
  }

  const baseUrl = environment === 'production'
    ? 'https://api.realestate.com.au'
    : 'https://api.test.realestate.com.au';

  try {
    // Get OAuth token
    const credentials = btoa(`${apiKey}:${apiSecret}`);
    const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      return { success: false, error: 'Failed to authenticate with REA API' };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Map to REA format
    const reaListing = {
      listingType: 'rental',
      status: action === 'delete' ? 'withdrawn' : 'current',
      property: {
        propertyType: portalListing.propertyType.charAt(0).toUpperCase() + portalListing.propertyType.slice(1),
        bedrooms: portalListing.bedrooms,
        bathrooms: portalListing.bathrooms,
        carSpaces: portalListing.parkingSpaces,
        features: portalListing.features,
      },
      address: {
        streetAddress: portalListing.streetAddress,
        suburb: portalListing.suburb,
        state: portalListing.state,
        postcode: portalListing.postcode,
      },
      headline: portalListing.title,
      description: portalListing.description,
      rent: {
        weeklyRent: portalListing.rentAmountWeekly,
        bond: portalListing.rentAmountWeekly * portalListing.bondWeeks,
      },
      availableFrom: portalListing.availableDate,
      images: portalListing.images.map((img, i) => ({
        url: img.url,
        rank: i + 1,
      })),
      contact: {
        agentId: agentId,
      },
    };

    let endpoint = '/listings/v1/listings';
    let method = 'POST';

    if ((action === 'update' || action === 'delete') && listing.rea_listing_id) {
      endpoint = `/listings/v1/listings/${listing.rea_listing_id}`;
      method = 'PUT';
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(reaListing),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `REA API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    return { success: true, portalListingId: data.listingId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
