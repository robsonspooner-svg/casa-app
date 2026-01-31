// Unit tests for application hooks
// Mission 05: Tenant Applications

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import {
  mockFrom,
  mockUser,
  mockStorage,
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

import { useApplications } from '../hooks/useApplications';
import { useMyApplications } from '../hooks/useMyApplications';
import { useApplication } from '../hooks/useApplication';
import { useApplicationMutations } from '../hooks/useApplicationMutations';

const mockApplication = {
  id: 'app-1',
  listing_id: 'listing-1',
  tenant_id: 'test-user-id',
  status: 'submitted',
  full_name: 'Jane Tenant',
  email: 'jane@example.com',
  phone: '0412345678',
  date_of_birth: '1990-05-15',
  current_address: '123 Current St, Sydney NSW 2000',
  employment_type: 'full_time',
  employer_name: 'Acme Corp',
  job_title: 'Software Engineer',
  annual_income: 120000,
  employment_start_date: '2020-01-01',
  current_landlord_name: 'Bob Landlord',
  current_landlord_phone: '0498765432',
  current_landlord_email: 'bob@landlord.com',
  current_rent: 500,
  tenancy_start_date: '2022-06-01',
  reason_for_moving: 'Closer to work',
  move_in_date: '2024-04-01',
  lease_term_preference: '12_months',
  additional_occupants: 1,
  occupant_details: 'Partner',
  has_pets: true,
  pet_description: '1 small dog',
  additional_notes: 'Very tidy tenant',
  submitted_at: '2024-02-01T10:00:00Z',
  reviewed_at: null,
  rejection_reason: null,
  created_at: '2024-02-01T09:00:00Z',
  updated_at: '2024-02-01T10:00:00Z',
};

const mockReference = {
  id: 'ref-1',
  application_id: 'app-1',
  reference_type: 'professional',
  name: 'Manager McManager',
  relationship: 'Direct Manager',
  phone: '0411111111',
  email: 'manager@acme.com',
  created_at: '2024-02-01T09:30:00Z',
};

const mockDocument = {
  id: 'doc-1',
  application_id: 'app-1',
  document_type: 'payslip',
  file_name: 'payslip-jan.pdf',
  file_path: 'app-1/payslip-jan.pdf',
  url: 'https://storage.example.com/payslip-jan.pdf',
  file_size: 102400,
  mime_type: 'application/pdf',
  uploaded_at: '2024-02-01T09:45:00Z',
};

describe('useApplications (owner view)', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch applications for a listing', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({ data: [mockApplication], error: null });

    // Main query
    mockFrom.mockReturnValueOnce({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
    });
    // References query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [mockReference], error: null }),
    });
    // Documents query
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [mockDocument], error: null }),
    });

    const { result } = renderHook(() => useApplications('listing-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.applications).toHaveLength(1);
    expect(result.current.applications[0].full_name).toBe('Jane Tenant');
    expect(result.current.applications[0].references).toHaveLength(1);
    expect(result.current.applications[0].documents).toHaveLength(1);
    expect(result.current.error).toBe(null);
  });

  it('should not fetch when listingId is null', async () => {
    const { result } = renderHook(() => useApplications(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.applications).toHaveLength(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should handle fetch error', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Access denied' },
    });

    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
    });

    const { result } = renderHook(() => useApplications('listing-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.applications).toHaveLength(0);
  });
});

describe('useMyApplications (tenant view)', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch tenant applications', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({ data: [mockApplication], error: null });

    // Main query
    mockFrom.mockReturnValueOnce({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
    });
    // References
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    // Documents
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    // Listing
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'listing-1', title: 'Nice Apartment', property_id: 'prop-1' },
        error: null,
      }),
    });
    // Property (for address)
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'prop-1', address_line_1: '456 Elm St', suburb: 'Melbourne' },
        error: null,
      }),
    });

    const { result } = renderHook(() => useMyApplications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.applications).toHaveLength(1);
    expect(result.current.applications[0].full_name).toBe('Jane Tenant');
    expect(result.current.error).toBe(null);
  });

  it('should not fetch when user is null', async () => {
    const { useAuth } = await import('../hooks/useAuth');
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
    });

    const { result } = renderHook(() => useMyApplications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.applications).toHaveLength(0);
    expect(mockFrom).not.toHaveBeenCalled();

    // Restore
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      loading: false,
    });
  });
});

describe('useApplication (single detail)', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a single application with details', async () => {
    // Application: from().select().eq().single()
    const appSingle = vi.fn().mockResolvedValue({ data: mockApplication, error: null });
    const appEq = vi.fn().mockReturnValue({ single: appSingle });
    const appSelect = vi.fn().mockReturnValue({ eq: appEq });

    // References: from().select().eq()
    const refsEq = vi.fn().mockResolvedValue({ data: [mockReference], error: null });
    const refsSelect = vi.fn().mockReturnValue({ eq: refsEq });

    // Documents: from().select().eq()
    const docsEq = vi.fn().mockResolvedValue({ data: [mockDocument], error: null });
    const docsSelect = vi.fn().mockReturnValue({ eq: docsEq });

    // Listing: from().select().eq().single()
    const listingSingle = vi.fn().mockResolvedValue({
      data: { id: 'listing-1', title: 'Nice Apartment', property_id: 'prop-1' },
      error: null,
    });
    const listingEq = vi.fn().mockReturnValue({ single: listingSingle });
    const listingSelect = vi.fn().mockReturnValue({ eq: listingEq });

    // Property: from().select().eq().single()
    const propSingle = vi.fn().mockResolvedValue({
      data: { id: 'prop-1', address_line_1: '456 Elm St', suburb: 'Melbourne' },
      error: null,
    });
    const propEq = vi.fn().mockReturnValue({ single: propSingle });
    const propSelect = vi.fn().mockReturnValue({ eq: propEq });

    mockFrom
      .mockReturnValueOnce({ select: appSelect })
      .mockReturnValueOnce({ select: refsSelect })
      .mockReturnValueOnce({ select: docsSelect })
      .mockReturnValueOnce({ select: listingSelect })
      .mockReturnValueOnce({ select: propSelect });

    const { result } = renderHook(() => useApplication('app-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.application).not.toBeNull();
    expect(result.current.application?.full_name).toBe('Jane Tenant');
    expect(result.current.application?.references).toHaveLength(1);
    expect(result.current.application?.documents).toHaveLength(1);
  });

  it('should not fetch when applicationId is null', async () => {
    const { result } = renderHook(() => useApplication(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.application).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('useApplicationMutations', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create an application', async () => {
    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: mockApplication, error: null });

    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useApplicationMutations());

    let created: any;
    await act(async () => {
      created = await result.current.createApplication({
        listing_id: 'listing-1',
        full_name: 'Jane Tenant',
        email: 'jane@example.com',
        phone: '0412345678',
        current_address: '123 Current St',
        employment_type: 'full_time',
        move_in_date: '2024-04-01',
        additional_occupants: 0,
        has_pets: false,
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('applications');
    expect(mockInsert).toHaveBeenCalled();
    expect(created.full_name).toBe('Jane Tenant');
  });

  it('should submit an application', async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { ...mockApplication, status: 'submitted' },
      error: null,
    });

    mockFrom.mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useApplicationMutations());

    await act(async () => {
      await result.current.submitApplication('app-1');
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'submitted' })
    );
  });

  it('should withdraw an application', async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { ...mockApplication, status: 'withdrawn' },
      error: null,
    });

    mockFrom.mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useApplicationMutations());

    await act(async () => {
      await result.current.withdrawApplication('app-1');
    });

    expect(mockUpdate).toHaveBeenCalledWith({ status: 'withdrawn' });
  });

  it('should approve an application (owner)', async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { ...mockApplication, status: 'approved' },
      error: null,
    });

    mockFrom.mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useApplicationMutations());

    await act(async () => {
      await result.current.approveApplication('app-1');
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved' })
    );
  });

  it('should reject an application with reason (owner)', async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { ...mockApplication, status: 'rejected', rejection_reason: 'Income too low' },
      error: null,
    });

    mockFrom.mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useApplicationMutations());

    await act(async () => {
      await result.current.rejectApplication('app-1', 'Income too low');
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rejected', rejection_reason: 'Income too low' })
    );
  });

  it('should review an application (owner)', async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { ...mockApplication, status: 'under_review' },
      error: null,
    });

    mockFrom.mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useApplicationMutations());

    await act(async () => {
      await result.current.reviewApplication('app-1');
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'under_review' })
    );
  });

  it('should shortlist an application (owner)', async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { ...mockApplication, status: 'shortlisted' },
      error: null,
    });

    mockFrom.mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useApplicationMutations());

    await act(async () => {
      await result.current.shortlistApplication('app-1');
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'shortlisted' })
    );
  });

  it('should add a reference', async () => {
    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: mockReference, error: null });

    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useApplicationMutations());

    await act(async () => {
      await result.current.addReference('app-1', {
        reference_type: 'professional',
        name: 'Manager McManager',
        relationship: 'Direct Manager',
        phone: '0411111111',
        email: 'manager@acme.com',
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('application_references');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('should remove a reference', async () => {
    const mockDelete = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockReturnValue({
      delete: mockDelete,
      eq: mockEq,
    });

    const { result } = renderHook(() => useApplicationMutations());

    await act(async () => {
      await result.current.removeReference('ref-1');
    });

    expect(mockFrom).toHaveBeenCalledWith('application_references');
    expect(mockDelete).toHaveBeenCalled();
  });

  it('should throw when not authenticated', async () => {
    const { useAuth } = await import('../hooks/useAuth');
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
    });

    const { result } = renderHook(() => useApplicationMutations());

    let thrownError: unknown = null;
    await act(async () => {
      try {
        await result.current.createApplication({
          listing_id: 'listing-1',
          full_name: 'Test',
          email: 'test@test.com',
          phone: '0400000000',
          current_address: '1 Test St',
          employment_type: 'full_time',
          move_in_date: '2024-04-01',
          additional_occupants: 0,
          has_pets: false,
        });
      } catch (err) {
        thrownError = err;
      }
    });

    expect(thrownError).not.toBe(null);
    expect((thrownError as Error).message).toBe('Not authenticated');

    // Restore
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      loading: false,
    });
  });
});
