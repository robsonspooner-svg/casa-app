// Mock Supabase client for testing
import { vi } from 'vitest';

export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {
    full_name: 'Test User',
    role: 'owner',
  },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};

export const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: mockUser,
};

export const mockProfile = {
  id: 'test-user-id',
  email: 'test@example.com',
  full_name: 'Test User',
  avatar_url: null,
  phone: null,
  role: 'owner' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Create mock functions
export const mockSignInWithPassword = vi.fn();
export const mockSignInWithOAuth = vi.fn();
export const mockSignUp = vi.fn();
export const mockSignOut = vi.fn();
export const mockGetSession = vi.fn();
export const mockOnAuthStateChange = vi.fn();
export const mockResetPasswordForEmail = vi.fn();
export const mockUpdateUser = vi.fn();
export const mockFrom = vi.fn();
export const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
export const mockStorage = {
  from: vi.fn(() => ({
    upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/avatar.jpg' } }),
  })),
};

// Mock Supabase client structure
export const createMockSupabaseClient = () => ({
  auth: {
    signInWithPassword: mockSignInWithPassword,
    signInWithOAuth: mockSignInWithOAuth,
    signUp: mockSignUp,
    signOut: mockSignOut,
    getSession: mockGetSession,
    onAuthStateChange: mockOnAuthStateChange,
    resetPasswordForEmail: mockResetPasswordForEmail,
    updateUser: mockUpdateUser,
  },
  from: mockFrom,
  rpc: mockRpc,
  storage: mockStorage,
});

// Reset all mocks
export const resetMocks = () => {
  mockSignInWithPassword.mockReset();
  mockSignInWithOAuth.mockReset();
  mockSignUp.mockReset();
  mockSignOut.mockReset();
  mockGetSession.mockReset();
  mockOnAuthStateChange.mockReset();
  mockResetPasswordForEmail.mockReset();
  mockUpdateUser.mockReset();
  mockFrom.mockReset();
  mockRpc.mockReset().mockResolvedValue({ data: null, error: null });
};
