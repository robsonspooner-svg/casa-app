// Unit tests for useProperties and usePropertyMutations hooks
// Mission 03: Properties CRUD

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import {
  mockFrom,
  mockStorage,
  mockUser,
  mockSession,
  resetMocks,
  createMockSupabaseClient,
  mockGetSession,
  mockOnAuthStateChange,
} from '../__mocks__/supabase';

// Mock the client module to control getSupabaseClient
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
import { useProperties, useProperty } from '../hooks/useProperties';
import { usePropertyMutations } from '../hooks/usePropertyMutations';

// Mock property data
const mockProperty = {
  id: 'property-1',
  owner_id: 'test-user-id',
  address_line_1: '123 Test Street',
  address_line_2: null,
  suburb: 'Sydney',
  state: 'NSW',
  postcode: '2000',
  country: 'Australia',
  property_type: 'house',
  bedrooms: 3,
  bathrooms: 2,
  parking_spaces: 1,
  land_size_sqm: null,
  floor_size_sqm: null,
  year_built: null,
  rent_amount: 550,
  rent_frequency: 'weekly',
  bond_amount: 2200,
  status: 'vacant',
  notes: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
};

const mockPropertyImage = {
  id: 'image-1',
  property_id: 'property-1',
  storage_path: 'test-user-id/property-1/image.jpg',
  url: 'https://example.com/image.jpg',
  is_primary: true,
  display_order: 0,
  created_at: '2024-01-01T00:00:00Z',
};

describe('useProperties', () => {
  beforeEach(() => {
    resetMocks();
    // Set up default mock chain for from()
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockIs = vi.fn().mockReturnThis();
    const mockIn = vi.fn().mockReturnThis();
    const mockOrder = vi.fn();

    // Properties query
    mockOrder.mockResolvedValueOnce({ data: [mockProperty], error: null });
    // Images query
    mockOrder.mockResolvedValueOnce({ data: [mockPropertyImage], error: null });

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      is: mockIs,
      in: mockIn,
      order: mockOrder,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch properties on mount', async () => {
    const { result } = renderHook(() => useProperties());

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.properties).toHaveLength(1);
    expect(result.current.properties[0].id).toBe('property-1');
    expect(result.current.properties[0].images).toHaveLength(1);
    expect(result.current.error).toBe(null);
  });

  it('should handle fetch error', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockIs = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      is: mockIs,
      order: mockOrder,
    });

    const { result } = renderHook(() => useProperties());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // The hook catches errors and returns a generic message
    expect(result.current.error).toBeTruthy();
    expect(result.current.properties).toHaveLength(0);
  });

  it('should support refreshing', async () => {
    const { result } = renderHook(() => useProperties());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Set up new mocks for refresh
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockIs = vi.fn().mockReturnThis();
    const mockIn = vi.fn().mockReturnThis();
    const mockOrder = vi.fn();

    mockOrder.mockResolvedValueOnce({ data: [mockProperty], error: null });
    mockOrder.mockResolvedValueOnce({ data: [mockPropertyImage], error: null });

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      is: mockIs,
      in: mockIn,
      order: mockOrder,
    });

    await act(async () => {
      await result.current.refreshProperties();
    });

    expect(result.current.refreshing).toBe(false);
  });
});

describe('useProperty', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a single property by ID', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockIs = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: mockProperty, error: null });
    const mockOrder = vi.fn().mockResolvedValue({ data: [mockPropertyImage], error: null });

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      is: mockIs,
      single: mockSingle,
      order: mockOrder,
    });

    const { result } = renderHook(() => useProperty('property-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.property).not.toBe(null);
    expect(result.current.property?.id).toBe('property-1');
    expect(result.current.property?.images).toHaveLength(1);
  });

  it('should return null for missing property ID', async () => {
    const { result } = renderHook(() => useProperty(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.property).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should handle fetch error', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockIs = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Property not found' },
    });

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      is: mockIs,
      single: mockSingle,
    });

    const { result } = renderHook(() => useProperty('nonexistent'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.property).toBe(null);
    // The hook catches errors and returns a generic message
    expect(result.current.error).toBeTruthy();
  });
});

describe('usePropertyMutations', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a property', async () => {
    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: mockProperty, error: null });

    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => usePropertyMutations());

    let createdProperty;
    await act(async () => {
      createdProperty = await result.current.createProperty({
        address_line_1: '123 Test Street',
        suburb: 'Sydney',
        state: 'NSW',
        postcode: '2000',
        property_type: 'house',
        rent_amount: 550,
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('properties');
    expect(mockInsert).toHaveBeenCalled();
    expect(createdProperty).toEqual(mockProperty);
  });

  it('should update a property', async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { ...mockProperty, rent_amount: 600 },
      error: null,
    });

    mockFrom.mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => usePropertyMutations());

    let updatedProperty: Awaited<ReturnType<typeof result.current.updateProperty>> | undefined;
    await act(async () => {
      updatedProperty = await result.current.updateProperty('property-1', {
        rent_amount: 600,
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('properties');
    expect(mockUpdate).toHaveBeenCalledWith({ rent_amount: 600 });
    expect(updatedProperty?.rent_amount).toBe(600);
  });

  it('should soft delete a property', async () => {
    // Mock the chainable Supabase query for both property update and listing cascade
    const mockIn = vi.fn().mockResolvedValue({ error: null });
    const mockEqInner = vi.fn().mockImplementation(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
      in: mockIn,
    }));
    const mockUpdate = vi.fn().mockImplementation(() => ({
      eq: mockEqInner,
    }));

    mockFrom.mockReturnValue({
      update: mockUpdate,
    });

    const { result } = renderHook(() => usePropertyMutations());

    await act(async () => {
      await result.current.deleteProperty('property-1');
    });

    expect(mockFrom).toHaveBeenCalledWith('properties');
    expect(mockUpdate).toHaveBeenCalled();
    // Check that deleted_at was set (any date string)
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.deleted_at).toBeDefined();
    // Check that listings cascade was called
    expect(mockFrom).toHaveBeenCalledWith('listings');
  });

  it('should throw error when not authenticated', async () => {
    // Override the mock to simulate unauthenticated state
    const { useAuth } = await import('../hooks/useAuth');
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
    });

    const { result } = renderHook(() => usePropertyMutations());

    let thrownError: unknown = null;
    await act(async () => {
      try {
        await result.current.createProperty({
          address_line_1: '123 Test Street',
          suburb: 'Sydney',
          state: 'NSW',
          postcode: '2000',
          property_type: 'house',
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
