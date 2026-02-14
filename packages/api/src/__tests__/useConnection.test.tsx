// Unit tests for useConnection hook
// Tests rate limiting (CRITICAL fix) and connection code usage

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  mockFrom,
  mockRpc,
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

import { useConnection } from '../hooks/useConnection';

describe('useConnection', () => {
  beforeEach(() => {
    resetMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should enforce cooldown between code attempts', async () => {
    // RPC returns an array (table-returning function) — hook reads results[0]
    mockRpc.mockResolvedValue({
      data: [{
        success: true,
        connection_type: 'tenancy',
        property_id: 'prop-1',
        tenancy_id: 'ten-1',
        owner_id: 'owner-1',
        message: 'Connected',
      }],
      error: null,
    });

    const { result } = renderHook(() => useConnection());

    // First attempt should work
    let firstResult: any;
    await act(async () => {
      firstResult = await result.current.useCode('ABC123');
    });
    expect(firstResult.success).toBe(true);

    // Immediate second attempt should be rate-limited
    let secondResult: any;
    await act(async () => {
      secondResult = await result.current.useCode('ABC123');
    });
    expect(secondResult.success).toBe(false);
    expect(secondResult.message).toContain('wait');

    // After cooldown (3s), should work again
    vi.advanceTimersByTime(3100);
    let thirdResult: any;
    await act(async () => {
      thirdResult = await result.current.useCode('ABC123');
    });
    expect(thirdResult.success).toBe(true);
  });

  it('should enforce max attempts per window', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        success: true,
        connection_type: 'tenancy',
        property_id: 'prop-1',
        tenancy_id: 'ten-1',
        owner_id: 'owner-1',
        message: 'Connected',
      }],
      error: null,
    });

    const { result } = renderHook(() => useConnection());

    // Make 5 attempts with cooldown between each
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(3100);
      await act(async () => {
        await result.current.useCode(`CODE${i}`);
      });
    }

    // 6th attempt within the window should be blocked
    vi.advanceTimersByTime(3100);
    let blockedResult: any;
    await act(async () => {
      blockedResult = await result.current.useCode('CODE5');
    });
    expect(blockedResult.success).toBe(false);
    expect(blockedResult.message).toContain('Too many attempts');
  });

  it('should return error when user is not authenticated', async () => {
    const { useAuth } = await import('../hooks/useAuth');
    (useAuth as any).mockReturnValueOnce({
      user: null,
      isAuthenticated: false,
      loading: false,
    });

    const { result } = renderHook(() => useConnection());

    let connectionResult: any;
    await act(async () => {
      connectionResult = await result.current.useCode('ABC123');
    });
    expect(connectionResult.success).toBe(false);
    expect(connectionResult.message).toContain('signed in');
  });
});
