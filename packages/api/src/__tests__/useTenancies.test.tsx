// Unit tests for tenancy hooks
// Mission 06: Tenancies & Leases

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

vi.mock('../hooks/useProfile', () => ({
  useProfile: vi.fn(() => ({
    profile: { subscription_tier: 'pro' },
    loading: false,
    error: null,
    firstName: 'Test',
    lastName: 'User',
  })),
}));

import { useTenancyMutations } from '../hooks/useTenancyMutations';
import { useVacancyPrompt } from '../hooks/useVacancyPrompt';

const mockTenancy = {
  id: 'tenancy-1',
  property_id: 'prop-1',
  status: 'active',
  lease_type: '12_months',
  lease_start_date: '2024-01-01',
  lease_end_date: '2024-12-31',
  rent_amount: 500,
  rent_frequency: 'weekly',
  rent_due_day: 1,
  bond_amount: 2000,
  bond_status: 'held',
  is_periodic: false,
  notes: null,
  notice_given_date: null,
  actual_end_date: null,
  end_reason: null,
  bond_lodgement_number: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockProperty = {
  id: 'prop-1',
  owner_id: 'test-user-id',
  address_line_1: '42 Wallaby Way',
  suburb: 'Sydney',
  state: 'NSW',
  postcode: '2000',
  status: 'occupied',
};

// Helper to create chainable mock for Supabase queries
function createQueryChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {};
  const resolve = () => Promise.resolve(resolvedValue);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockImplementation(resolve);
  chain.then = (onFulfilled: any, onRejected?: any) => resolve().then(onFulfilled, onRejected);
  return chain;
}

describe('useTenancyMutations', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should create a tenancy with tenants', async () => {
    const insertChain = createQueryChain({ data: { id: 'new-tenancy-1' }, error: null });
    const tenantsChain = createQueryChain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(tenantsChain);

    const { result } = renderHook(() => useTenancyMutations());

    let tenancyId: string | undefined;
    await act(async () => {
      tenancyId = await result.current.createTenancy(
        {
          property_id: 'prop-1',
          status: 'pending',
          lease_type: '12_months',
          lease_start_date: '2024-07-01',
          lease_end_date: '2025-06-30',
          rent_amount: 600,
          rent_frequency: 'weekly',
          rent_due_day: 1,
          bond_amount: 2400,
          bond_status: 'pending',
          is_periodic: false,
        },
        ['tenant-user-1']
      );
    });

    expect(tenancyId).toBe('new-tenancy-1');
    expect(mockFrom).toHaveBeenCalledWith('tenancies');
    expect(mockFrom).toHaveBeenCalledWith('tenancy_tenants');
  });

  it('should update tenancy fields', async () => {
    const updateChain = createQueryChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(updateChain);

    const { result } = renderHook(() => useTenancyMutations());

    await act(async () => {
      await result.current.updateTenancy('tenancy-1', { rent_amount: 550 });
    });

    expect(mockFrom).toHaveBeenCalledWith('tenancies');
    expect(updateChain.update).toHaveBeenCalledWith({ rent_amount: 550 });
  });

  it('should set notice_given_date when updating to ending status', async () => {
    const updateChain = createQueryChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(updateChain);

    const { result } = renderHook(() => useTenancyMutations());

    await act(async () => {
      await result.current.updateTenancyStatus('tenancy-1', 'ending');
    });

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ending',
        notice_given_date: expect.any(String),
      })
    );
  });

  it('should set actual_end_date and reason when terminating', async () => {
    const updateChain = createQueryChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(updateChain);

    const { result } = renderHook(() => useTenancyMutations());

    await act(async () => {
      await result.current.updateTenancyStatus('tenancy-1', 'terminated', 'Non-payment');
    });

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'terminated',
        actual_end_date: expect.any(String),
        end_reason: 'Non-payment',
      })
    );
  });

  it('should set actual_end_date when ending tenancy', async () => {
    const updateChain = createQueryChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(updateChain);

    const { result } = renderHook(() => useTenancyMutations());

    await act(async () => {
      await result.current.updateTenancyStatus('tenancy-1', 'ended');
    });

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ended',
        actual_end_date: expect.any(String),
      })
    );
  });

  it('should create a rent increase with calculated percentage', async () => {
    const insertChain = createQueryChain({ data: { id: 'ri-1' }, error: null });
    mockFrom.mockReturnValueOnce(insertChain);

    const { result } = renderHook(() => useTenancyMutations());

    let increaseId: string | undefined;
    await act(async () => {
      increaseId = await result.current.createRentIncrease({
        tenancy_id: 'tenancy-1',
        current_amount: 500,
        new_amount: 525,
        notice_date: '2024-06-01',
        effective_date: '2024-08-01',
        minimum_notice_days: 60,
      });
    });

    expect(increaseId).toBe('ri-1');
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        increase_percentage: 5,
        status: 'draft',
        current_amount: 500,
        new_amount: 525,
      })
    );
  });

  it('should calculate percentage correctly for non-round numbers', async () => {
    const insertChain = createQueryChain({ data: { id: 'ri-2' }, error: null });
    mockFrom.mockReturnValueOnce(insertChain);

    const { result } = renderHook(() => useTenancyMutations());

    await act(async () => {
      await result.current.createRentIncrease({
        tenancy_id: 'tenancy-1',
        current_amount: 450,
        new_amount: 475,
        notice_date: '2024-06-01',
        effective_date: '2024-08-01',
        minimum_notice_days: 60,
      });
    });

    // (475 - 450) / 450 * 100 = 5.555... → rounded to 5.56
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        increase_percentage: 5.56,
      })
    );
  });

  it('should cancel a rent increase', async () => {
    const updateChain = createQueryChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(updateChain);

    const { result } = renderHook(() => useTenancyMutations());

    await act(async () => {
      await result.current.cancelRentIncrease('ri-1');
    });

    expect(mockFrom).toHaveBeenCalledWith('rent_increases');
    expect(updateChain.update).toHaveBeenCalledWith({ status: 'cancelled' });
  });

  it('should add a tenant to a tenancy', async () => {
    const insertChain = createQueryChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(insertChain);

    const { result } = renderHook(() => useTenancyMutations());

    await act(async () => {
      await result.current.addTenant('tenancy-1', 'new-tenant-id', true);
    });

    expect(mockFrom).toHaveBeenCalledWith('tenancy_tenants');
    expect(insertChain.insert).toHaveBeenCalledWith({
      tenancy_id: 'tenancy-1',
      tenant_id: 'new-tenant-id',
      is_primary: true,
      is_leaseholder: true,
    });
  });

  it('should remove a tenant from a tenancy', async () => {
    const deleteChain = createQueryChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(deleteChain);

    const { result } = renderHook(() => useTenancyMutations());

    await act(async () => {
      await result.current.removeTenant('tenancy-1', 'tenant-to-remove');
    });

    expect(mockFrom).toHaveBeenCalledWith('tenancy_tenants');
    expect(deleteChain.delete).toHaveBeenCalled();
  });

  it('should upload a document record', async () => {
    const insertChain = createQueryChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(insertChain);

    const { result } = renderHook(() => useTenancyMutations());

    await act(async () => {
      await result.current.uploadDocument('tenancy-1', {
        document_type: 'lease_agreement',
        title: 'Lease 2024',
        file_name: 'lease.pdf',
        storage_path: '/tenancy-documents/lease.pdf',
        url: 'https://storage.example.com/lease.pdf',
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('tenancy_documents');
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenancy_id: 'tenancy-1',
        document_type: 'lease_agreement',
        title: 'Lease 2024',
        uploaded_by: 'test-user-id',
      })
    );
  });

  it('should delete a document', async () => {
    const deleteChain = createQueryChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(deleteChain);

    const { result } = renderHook(() => useTenancyMutations());

    await act(async () => {
      await result.current.deleteDocument('doc-1');
    });

    expect(mockFrom).toHaveBeenCalledWith('tenancy_documents');
    expect(deleteChain.delete).toHaveBeenCalled();
  });

  it('should throw if not authenticated', async () => {
    const { useAuth } = await import('../hooks/useAuth');
    (useAuth as any).mockReturnValueOnce({
      user: null,
      isAuthenticated: false,
      loading: false,
    });

    const { result } = renderHook(() => useTenancyMutations());

    await expect(
      result.current.createTenancy(
        {
          property_id: 'prop-1',
          status: 'pending',
          lease_type: '12_months',
          lease_start_date: '2024-07-01',
          lease_end_date: '2025-06-30',
          rent_amount: 600,
          rent_frequency: 'weekly',
          rent_due_day: 1,
          bond_amount: 2400,
          bond_status: 'pending',
          is_periodic: false,
        },
        ['tenant-1']
      )
    ).rejects.toThrow('Not authenticated');
  });

  it('should handle supabase error on create', async () => {
    const errorChain = createQueryChain({ data: null, error: { message: 'DB error' } });
    mockFrom.mockReturnValueOnce(errorChain);

    const { result } = renderHook(() => useTenancyMutations());

    await expect(
      result.current.createTenancy(
        {
          property_id: 'prop-1',
          status: 'pending',
          lease_type: '12_months',
          lease_start_date: '2024-07-01',
          lease_end_date: '2025-06-30',
          rent_amount: 600,
          rent_frequency: 'weekly',
          rent_due_day: 1,
          bond_amount: 2400,
          bond_status: 'pending',
          is_periodic: false,
        },
        ['tenant-1']
      )
    ).rejects.toBeDefined();
  });
});

describe('useVacancyPrompt', () => {
  it('should return not vacant for occupied property', () => {
    const property = { ...mockProperty, status: 'occupied' } as any;
    const { result } = renderHook(() => useVacancyPrompt(property));

    expect(result.current.isVacant).toBe(false);
    expect(result.current.daysSinceVacant).toBe(0);
    expect(result.current.canCreateListing).toBe(false);
  });

  it('should return vacant for vacant property', () => {
    const property = { ...mockProperty, status: 'vacant' } as any;
    const { result } = renderHook(() => useVacancyPrompt(property));

    expect(result.current.isVacant).toBe(true);
  });

  it('should calculate days since vacant', () => {
    // Use a fixed date far enough back to avoid timezone edge cases
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const property = {
      ...mockProperty,
      status: 'vacant',
      vacant_since: tenDaysAgo.toISOString().split('T')[0],
    } as any;

    const { result } = renderHook(() => useVacancyPrompt(property));

    expect(result.current.isVacant).toBe(true);
    // Math.ceil + timezone can cause +/- 1 day variance
    expect(result.current.daysSinceVacant).toBeGreaterThanOrEqual(10);
    expect(result.current.daysSinceVacant).toBeLessThanOrEqual(12);
  });

  it('should return canCreateListing true for pro tier user', () => {
    const property = { ...mockProperty, status: 'vacant' } as any;
    const { result } = renderHook(() => useVacancyPrompt(property));

    expect(result.current.canCreateListing).toBe(true);
    expect(result.current.addOnAvailable).toBe(false);
  });

  it('should return canCreateListing false for starter tier', async () => {
    const { useProfile } = await import('../hooks/useProfile');
    (useProfile as any).mockReturnValueOnce({
      profile: { subscription_tier: 'starter' },
      loading: false,
      error: null,
      firstName: 'Test',
      lastName: 'User',
    });

    const property = { ...mockProperty, status: 'vacant' } as any;
    const { result } = renderHook(() => useVacancyPrompt(property));

    expect(result.current.canCreateListing).toBe(false);
    expect(result.current.addOnAvailable).toBe(true);
  });

  it('should return default values for null property', () => {
    const { result } = renderHook(() => useVacancyPrompt(null));

    expect(result.current.isVacant).toBe(false);
    expect(result.current.daysSinceVacant).toBe(0);
    expect(result.current.canCreateListing).toBe(false);
    expect(result.current.addOnAvailable).toBe(false);
  });

  it('should handle vacant property without vacant_since date', () => {
    const property = { ...mockProperty, status: 'vacant' } as any;
    const { result } = renderHook(() => useVacancyPrompt(property));

    expect(result.current.isVacant).toBe(true);
    expect(result.current.daysSinceVacant).toBe(0);
  });
});
