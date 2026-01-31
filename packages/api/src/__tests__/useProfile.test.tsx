// Unit tests for useProfile hook
// Mission 02: Authentication & User Profiles

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import {
  mockFrom,
  mockGetSession,
  mockOnAuthStateChange,
  mockProfile,
  mockSession,
  mockStorage,
  resetMocks,
  createMockSupabaseClient,
} from '../__mocks__/supabase';

// Mock the auth hook
const mockUseAuth = vi.fn();

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuthProvider: vi.fn(),
}));

// Mock the client module
vi.mock('../client', () => ({
  getSupabaseClient: vi.fn(() => createMockSupabaseClient()),
  initializeSupabase: vi.fn(),
  isSupabaseConfigured: vi.fn(() => true),
}));

// Import after mocking
import { useProfile } from '../hooks/useProfile';

describe('useProfile', () => {
  beforeEach(() => {
    resetMocks();
    // Default: authenticated user
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
      isAuthenticated: true,
      loading: false,
      error: null,
    });

    // Default: profile query succeeds
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useProfile());

    expect(result.current.loading).toBe(true);
    expect(result.current.profile).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should fetch profile on mount when authenticated', async () => {
    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toEqual(mockProfile);
    expect(result.current.error).toBe(null);
  });

  it('should not fetch profile when not authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toBe(null);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should handle profile fetch error', async () => {
    const errorMessage = 'Failed to fetch profile';
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: new Error(errorMessage),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toBe(null);
    expect(result.current.error).toBe(errorMessage);
  });

  it('should parse firstName and lastName correctly', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { ...mockProfile, full_name: 'John Michael Doe' },
            error: null,
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.firstName).toBe('John');
    expect(result.current.lastName).toBe('Michael Doe');
  });

  it('should handle single name correctly', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { ...mockProfile, full_name: 'John' },
            error: null,
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.firstName).toBe('John');
    expect(result.current.lastName).toBe(null);
  });

  it('should handle null full_name correctly', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { ...mockProfile, full_name: null },
            error: null,
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.firstName).toBe(null);
    expect(result.current.lastName).toBe(null);
  });
});

describe('useProfile updateProfile', () => {
  beforeEach(() => {
    resetMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
      isAuthenticated: true,
      loading: false,
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockProfile, full_name: 'Updated Name' },
              error: null,
            }),
          }),
        }),
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should update profile successfully', async () => {
    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateProfile({ full_name: 'Updated Name' });
    });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
  });

  it('should throw error when updating without authentication', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(
      act(async () => {
        await result.current.updateProfile({ full_name: 'Updated Name' });
      })
    ).rejects.toThrow('Not authenticated');
  });

  it('should handle update error', async () => {
    const errorMessage = 'Update failed';
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new Error(errorMessage),
            }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let thrownError: unknown = null;
    await act(async () => {
      try {
        await result.current.updateProfile({ full_name: 'Will Fail' });
      } catch (err) {
        thrownError = err;
      }
    });

    expect(thrownError).not.toBe(null);
    expect((thrownError as Error).message).toBe(errorMessage);
    expect(result.current.error).toBe(errorMessage);
  });
});

describe('useProfile uploadAvatar', () => {
  beforeEach(() => {
    resetMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
      isAuthenticated: true,
      loading: false,
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockProfile, avatar_url: 'https://example.com/avatar.jpg' },
              error: null,
            }),
          }),
        }),
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should upload avatar and update profile', async () => {
    const mockFile = new Blob(['test'], { type: 'image/png' });

    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let avatarUrl: string = '';
    await act(async () => {
      avatarUrl = await result.current.uploadAvatar(mockFile, 'avatar.png');
    });

    expect(avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(mockStorage.from).toHaveBeenCalledWith('avatars');
  });

  it('should throw error when uploading without authentication', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });

    const mockFile = new Blob(['test'], { type: 'image/png' });
    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(
      act(async () => {
        await result.current.uploadAvatar(mockFile, 'avatar.png');
      })
    ).rejects.toThrow('Not authenticated');
  });
});

describe('useProfile refreshProfile', () => {
  beforeEach(() => {
    resetMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
      isAuthenticated: true,
      loading: false,
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should refresh profile data', async () => {
    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Initial fetch
    expect(mockFrom).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refreshProfile();
    });

    // Should have fetched again
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });
});
