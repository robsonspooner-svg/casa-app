// Unit tests for useAuth hook
// Mission 02: Authentication & User Profiles

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import {
  mockSignInWithPassword,
  mockSignInWithOAuth,
  mockSignUp,
  mockSignOut,
  mockGetSession,
  mockOnAuthStateChange,
  mockResetPasswordForEmail,
  mockUpdateUser,
  mockUser,
  mockSession,
  resetMocks,
  createMockSupabaseClient,
} from '../__mocks__/supabase';

// Mock the client module to control getSupabaseClient
vi.mock('../client', () => ({
  getSupabaseClient: vi.fn(() => createMockSupabaseClient()),
  initializeSupabase: vi.fn(),
  isSupabaseConfigured: vi.fn(() => true),
}));

// Import after mocking
import { useAuthProvider, AuthProvider, useAuth } from '../hooks/useAuth';

describe('useAuthProvider', () => {
  beforeEach(() => {
    resetMocks();
    // Default: no session on init
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with loading state', async () => {
    const { result } = renderHook(() => useAuthProvider());

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBe(null);
    expect(result.current.session).toBe(null);
    expect(result.current.isAuthenticated).toBe(false);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should restore session on mount if exists', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const { result } = renderHook(() => useAuthProvider());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.session).toEqual(mockSession);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should handle signIn successfully', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuthProvider());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signIn('test@example.com', 'password123');
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('should handle signIn error', async () => {
    const errorMessage = 'Invalid credentials';
    mockSignInWithPassword.mockResolvedValue({
      error: new Error(errorMessage),
    });

    const { result } = renderHook(() => useAuthProvider());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let thrownError: unknown = null;
    await act(async () => {
      try {
        await result.current.signIn('test@example.com', 'wrongpassword');
      } catch (err) {
        thrownError = err;
      }
    });

    expect(thrownError).not.toBe(null);
    expect((thrownError as Error).message).toBe(errorMessage);
    expect(result.current.error).toBe(errorMessage);
  });

  it('should handle signUp successfully', async () => {
    mockSignUp.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuthProvider());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signUp('new@example.com', 'password123', 'New User', 'owner');
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
      options: {
        data: {
          full_name: 'New User',
          role: 'owner',
        },
      },
    });
  });

  it('should handle signUp with default role', async () => {
    mockSignUp.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuthProvider());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signUp('new@example.com', 'password123', 'New User');
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
      options: {
        data: {
          full_name: 'New User',
          role: 'owner', // Default role
        },
      },
    });
  });

  it('should handle signOut successfully', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockSignOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuthProvider());

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should handle resetPassword successfully', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuthProvider());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.resetPassword('test@example.com');
    });

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('test@example.com');
  });

  it('should handle updatePassword successfully', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockUpdateUser.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuthProvider());

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await result.current.updatePassword('newPassword123');
    });

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newPassword123' });
  });

  it('should pass role via queryParams when calling signInWithOAuth', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?redirect=...' },
      error: null,
    });

    const { result } = renderHook(() => useAuthProvider());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let url: string | null = null;
    await act(async () => {
      url = await result.current.signInWithOAuth('google', {
        redirectTo: 'casa-tenant://auth/callback',
        role: 'tenant',
      });
    });

    expect(url).toBe('https://accounts.google.com/o/oauth2/v2/auth?redirect=...');
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: 'casa-tenant://auth/callback?role=tenant',
        queryParams: { role: 'tenant' },
        skipBrowserRedirect: true,
      }),
    });
  });

  it('should not pass queryParams when OAuth has no role', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/o/oauth2/v2/auth' },
      error: null,
    });

    const { result } = renderHook(() => useAuthProvider());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signInWithOAuth('google', {
        redirectTo: 'casa-owner://auth/callback',
      });
    });

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: 'casa-owner://auth/callback',
        queryParams: undefined,
        skipBrowserRedirect: true,
      }),
    });
  });
});

describe('useAuth with AuthProvider', () => {
  beforeEach(() => {
    resetMocks();
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error when used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });

  it('should work when wrapped in AuthProvider', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBe(null);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should share auth state across multiple consumers', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result: result1 } = renderHook(() => useAuth(), { wrapper });
    const { result: result2 } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result1.current.loading).toBe(false);
    });

    // Both hooks should have same state
    expect(result1.current.user).toEqual(result2.current.user);
    expect(result1.current.isAuthenticated).toEqual(result2.current.isAuthenticated);
  });
});

describe('Auth state transitions', () => {
  beforeEach(() => {
    resetMocks();
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call signIn with correct parameters', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuthProvider());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signIn('test@example.com', 'password');
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
    });
  });

  it('should clear error when starting new signIn attempt', async () => {
    // First call fails
    mockSignInWithPassword.mockResolvedValueOnce({
      error: new Error('First attempt failed'),
    });
    // Second call succeeds
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useAuthProvider());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // First attempt - should fail
    await act(async () => {
      try {
        await result.current.signIn('test@example.com', 'wrong');
      } catch {
        // Expected to throw
      }
    });

    expect(result.current.error).toBe('First attempt failed');

    // Second attempt - should start fresh (error cleared during the attempt)
    await act(async () => {
      await result.current.signIn('test@example.com', 'correct');
    });

    // Both attempts were made
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(2);
  });
});
