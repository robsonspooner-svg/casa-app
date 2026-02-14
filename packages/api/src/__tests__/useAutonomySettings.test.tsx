// Unit tests for useAutonomySettings hook
// Tests category validation (HIGH fix) and preset management

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import {
  mockFrom,
  mockUser,
  resetMocks,
  createMockSupabaseClient,
} from '../__mocks__/supabase';

vi.mock('../client', () => ({
  getSupabaseClient: vi.fn(() => createMockSupabaseClient()),
  initializeSupabase: vi.fn(),
  isSupabaseConfigured: vi.fn(() => true),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    isAuthenticated: true,
    loading: false,
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuthProvider: vi.fn(),
}));

import { useAutonomySettings } from '../hooks/useAutonomySettings';

// Helper: build chainable mock
function buildChain(resolvedValue: { data: any; error: any }) {
  const chainable: any = {};
  ['select', 'eq', 'in', 'order', 'single', 'insert', 'update', 'delete'].forEach(method => {
    chainable[method] = vi.fn().mockReturnValue(chainable);
  });
  chainable.then = (resolve: any, reject?: any) => Promise.resolve(resolvedValue).then(resolve, reject);
  chainable.catch = (reject: any) => Promise.resolve(resolvedValue).catch(reject);
  return chainable;
}

const mockSettings = {
  id: 'settings-1',
  user_id: 'test-user-id',
  preset: 'balanced',
  category_overrides: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('useAutonomySettings', () => {
  beforeEach(() => {
    resetMocks();
    // Default: settings exist in DB
    mockFrom.mockImplementation(() => buildChain({ data: mockSettings, error: null }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should load settings on mount', async () => {
    const { result } = renderHook(() => useAutonomySettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.preset).toBe('balanced');
    expect(result.current.error).toBeNull();
  });

  it('should reject invalid category in updateCategoryLevel', async () => {
    const { result } = renderHook(() => useAutonomySettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.updateCategoryLevel('invalid_category', 'L2');
    });

    expect(success).toBe(false);
    expect(result.current.error).toContain('Invalid category');
  });

  it('should accept valid category in updateCategoryLevel', async () => {
    // Set up mock for the update call chain
    mockFrom.mockImplementation(() => buildChain({ data: mockSettings, error: null }));

    const { result } = renderHook(() => useAutonomySettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.updateCategoryLevel('maintenance', 'L3');
    });

    expect(success).toBe(true);
  });

  it('should accept all valid category names', async () => {
    const validCategories = [
      'tenant_finding', 'lease_management', 'rent_collection', 'maintenance',
      'compliance', 'general', 'inspections', 'listings', 'financial',
      'insurance', 'communication',
    ];

    const { result } = renderHook(() => useAutonomySettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    for (const category of validCategories) {
      mockFrom.mockImplementation(() => buildChain({ data: mockSettings, error: null }));
      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.updateCategoryLevel(category, 'L1');
      });
      expect(success).toBe(true);
    }
  });

  it('should set preset to custom when updating category level', async () => {
    // Phase 1: mount loads settings (uses the default mockFrom from beforeEach)
    const { result } = renderHook(() => useAutonomySettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Phase 2: capture the chain used during update call
    const updateChain = buildChain({ data: null, error: null });
    mockFrom.mockImplementation(() => updateChain);

    await act(async () => {
      await result.current.updateCategoryLevel('maintenance', 'L4');
    });

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        preset: 'custom',
        category_overrides: expect.objectContaining({
          maintenance: 'L4',
        }),
      })
    );
  });
});
