// Unit tests for useListings and useListingMutations hooks
// Mission 04: Property Listings

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import {
  mockFrom,
  mockUser,
  resetMocks,
  createMockSupabaseClient,
} from '../__mocks__/supabase';

// Mock the client module
vi.mock('../client', () => ({
  getSupabaseClient: vi.fn(() => createMockSupabaseClient()),
  initializeSupabase: vi.fn(),
  isSupabaseConfigured: vi.fn(() => true),
}));

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    isAuthenticated: true,
    loading: false,
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuthProvider: vi.fn(),
}));

// Import after mocking
import { useListings } from '../hooks/useListings';
import { useListingMutations } from '../hooks/useListingMutations';
import { useFeatureOptions } from '../hooks/useFeatureOptions';

// Mock listing data
const mockListing = {
  id: 'listing-1',
  property_id: 'property-1',
  owner_id: 'test-user-id',
  title: 'Modern apartment in Surry Hills',
  description: 'A beautiful apartment',
  available_date: '2024-03-01',
  lease_term: '12_months',
  rent_amount: 550,
  rent_frequency: 'weekly',
  bond_weeks: 4,
  pets_allowed: true,
  pets_description: 'Small dogs welcome',
  smoking_allowed: false,
  furnished: false,
  status: 'draft',
  published_at: null,
  closed_at: null,
  close_reason: null,
  view_count: 0,
  application_count: 0,
  domain_listing_id: null,
  domain_sync_status: 'not_synced',
  domain_last_synced_at: null,
  rea_listing_id: null,
  rea_sync_status: 'not_synced',
  rea_last_synced_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockFeature = {
  listing_id: 'listing-1',
  feature: 'Air Conditioning',
};

const mockFeatureOption = {
  id: 'feature-1',
  name: 'Air Conditioning',
  category: 'climate',
  icon: 'snowflake',
};

describe('useListings', () => {
  beforeEach(() => {
    resetMocks();
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockIn = vi.fn().mockReturnThis();
    const mockOrder = vi.fn();

    // Listings query
    mockOrder.mockResolvedValueOnce({ data: [mockListing], error: null });
    // Features query
    mockIn.mockResolvedValueOnce({ data: [mockFeature], error: null });

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      in: mockIn,
      order: mockOrder,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch listings on mount', async () => {
    const { result } = renderHook(() => useListings());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.listings).toHaveLength(1);
    expect(result.current.listings[0].id).toBe('listing-1');
    expect(result.current.listings[0].features).toContain('Air Conditioning');
    expect(result.current.error).toBe(null);
  });

  it('should handle fetch error', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
    });

    const { result } = renderHook(() => useListings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.listings).toHaveLength(0);
  });

  it('should filter by status', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockIn = vi.fn().mockReturnThis();
    const mockOrder = vi.fn();

    mockOrder.mockResolvedValueOnce({ data: [mockListing], error: null });
    mockIn.mockResolvedValueOnce({ data: [], error: null });

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      in: mockIn,
      order: mockOrder,
    });

    const { result } = renderHook(() => useListings({ status: 'draft' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify eq was called (status filter applied)
    expect(mockEq).toHaveBeenCalled();
  });

  it('should support refreshing', async () => {
    const { result } = renderHook(() => useListings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Set up mocks for refresh
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockIn = vi.fn().mockReturnThis();
    const mockOrder = vi.fn();

    mockOrder.mockResolvedValueOnce({ data: [mockListing], error: null });
    mockIn.mockResolvedValueOnce({ data: [mockFeature], error: null });

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      in: mockIn,
      order: mockOrder,
    });

    await act(async () => {
      await result.current.refreshListings();
    });

    expect(result.current.refreshing).toBe(false);
  });
});

describe('useListingMutations', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a listing', async () => {
    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: mockListing, error: null });

    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useListingMutations());

    let createdListing;
    await act(async () => {
      createdListing = await result.current.createListing({
        property_id: 'property-1',
        title: 'Modern apartment in Surry Hills',
        available_date: '2024-03-01',
        rent_amount: 550,
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('listings');
    expect(mockInsert).toHaveBeenCalled();
    expect(createdListing).toEqual(mockListing);
  });

  it('should create a listing with features', async () => {
    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: mockListing, error: null });

    // First call returns listing insert, second returns features insert
    mockFrom.mockReturnValueOnce({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    });
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const { result } = renderHook(() => useListingMutations());

    await act(async () => {
      await result.current.createListing(
        {
          property_id: 'property-1',
          title: 'Modern apartment',
          available_date: '2024-03-01',
          rent_amount: 550,
        },
        ['Air Conditioning', 'Pool']
      );
    });

    expect(mockFrom).toHaveBeenCalledWith('listings');
    expect(mockFrom).toHaveBeenCalledWith('listing_features');
  });

  it('should publish a listing', async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { ...mockListing, status: 'active', published_at: '2024-01-15T00:00:00Z' },
      error: null,
    });

    mockFrom.mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useListingMutations());

    let publishedListing;
    await act(async () => {
      publishedListing = await result.current.publishListing('listing-1');
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' })
    );
    expect((publishedListing as any).status).toBe('active');
  });

  it('should pause a listing', async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { ...mockListing, status: 'paused' },
      error: null,
    });

    mockFrom.mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useListingMutations());

    await act(async () => {
      await result.current.pauseListing('listing-1');
    });

    expect(mockUpdate).toHaveBeenCalledWith({ status: 'paused' });
  });

  it('should close a listing', async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { ...mockListing, status: 'closed', closed_at: '2024-01-15T00:00:00Z' },
      error: null,
    });

    mockFrom.mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useListingMutations());

    await act(async () => {
      await result.current.closeListing('listing-1', 'Tenant found');
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'closed', close_reason: 'Tenant found' })
    );
  });

  it('should delete a listing', async () => {
    const mockDelete = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockImplementation(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    mockFrom.mockReturnValue({
      delete: mockDelete,
      eq: mockEq,
    });

    const { result } = renderHook(() => useListingMutations());

    await act(async () => {
      await result.current.deleteListing('listing-1');
    });

    expect(mockFrom).toHaveBeenCalledWith('listings');
    expect(mockDelete).toHaveBeenCalled();
  });

  it('should throw error when not authenticated', async () => {
    const { useAuth } = await import('../hooks/useAuth');
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
    });

    const { result } = renderHook(() => useListingMutations());

    let thrownError: unknown = null;
    await act(async () => {
      try {
        await result.current.createListing({
          property_id: 'property-1',
          title: 'Test',
          available_date: '2024-03-01',
          rent_amount: 550,
        });
      } catch (err) {
        thrownError = err;
      }
    });

    expect(thrownError).not.toBe(null);
    expect((thrownError as Error).message).toBe('Not authenticated');

    // Restore mock
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      loading: false,
    });
  });
});

describe('useFeatureOptions', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch feature options on mount', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    // First order returns chainable object, second order resolves with data
    const mockOrder = vi.fn()
      .mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({ data: [mockFeatureOption], error: null }),
      });

    mockFrom.mockReturnValue({
      select: mockSelect,
      order: mockOrder,
    });

    const { result } = renderHook(() => useFeatureOptions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.features).toHaveLength(1);
    expect(result.current.features[0].name).toBe('Air Conditioning');
    expect(result.current.featuresByCategory).toHaveProperty('climate');
    expect(result.current.error).toBe(null);
  });

  it('should handle fetch error', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockOrder = vi.fn()
      .mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Failed to load' },
        }),
      });

    mockFrom.mockReturnValue({
      select: mockSelect,
      order: mockOrder,
    });

    const { result } = renderHook(() => useFeatureOptions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.features).toHaveLength(0);
  });
});
