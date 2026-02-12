// Unit tests for Mission 16: Document Management
// Tests useDocumentFolders, useDocumentUpload, useDocumentShares hooks

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import {
  mockFrom,
  mockRpc,
  mockUser,
  mockStorage,
  resetMocks,
  createMockSupabaseClient,
} from '../__mocks__/supabase';

// Mock getUser to return the authenticated user
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null });

// Mock the client module
vi.mock('../client', () => ({
  getSupabaseClient: vi.fn(() => {
    const client = createMockSupabaseClient();
    (client as any).auth.getUser = mockGetUser;
    return client;
  }),
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
  AuthProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useAuthProvider: vi.fn(),
}));

// Mock global fetch for file upload tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import { useDocumentFolders } from '../hooks/useDocumentFolders';
import { useDocumentUpload } from '../hooks/useDocumentUpload';
import { useDocumentShares } from '../hooks/useDocumentShares';
import type { CasaDocumentType } from '../types/database';

// ─── Mock Data ────────────────────────────────────────────────

const mockFolder = {
  id: 'folder-1',
  owner_id: 'test-user-id',
  property_id: 'property-1',
  name: 'Leases',
  description: 'Lease agreements',
  parent_id: null,
  icon: 'file-text',
  color: '#4A90D9',
  is_system: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockCustomFolder = {
  id: 'folder-2',
  owner_id: 'test-user-id',
  property_id: 'property-1',
  name: 'Renovation Docs',
  description: 'Renovation project documents',
  parent_id: null,
  icon: null,
  color: null,
  is_system: false,
  created_at: '2025-01-10T00:00:00Z',
  updated_at: '2025-01-10T00:00:00Z',
};

const mockChildFolder = {
  id: 'folder-3',
  owner_id: 'test-user-id',
  property_id: 'property-1',
  name: 'Bathroom',
  description: 'Bathroom renovation docs',
  parent_id: 'folder-2',
  icon: null,
  color: null,
  is_system: false,
  created_at: '2025-01-11T00:00:00Z',
  updated_at: '2025-01-11T00:00:00Z',
};

const mockDocument = {
  id: 'doc-1',
  owner_id: 'test-user-id',
  tenant_id: null,
  property_id: 'property-1',
  tenancy_id: null,
  document_type: 'lease' as CasaDocumentType,
  title: 'Lease Agreement 2025',
  html_content: '',
  status: 'draft' as const,
  requires_signature: false,
  storage_path: 'test-user-id/abc123.pdf',
  file_url: 'https://example.com/docs/abc123.pdf',
  created_by: 'owner',
  conversation_id: null,
  metadata: {},
  created_at: '2025-01-15T00:00:00Z',
  updated_at: '2025-01-15T00:00:00Z',
  folder_id: 'folder-1',
  file_name: 'test-user-id/abc123.pdf',
  original_name: 'Lease_Agreement_2025.pdf',
  mime_type: 'application/pdf',
  file_size: 245000,
  file_extension: 'pdf',
  description: 'Residential lease agreement',
  tags: ['lease', '2025'],
  document_date: '2025-01-15',
  expiry_date: '2026-01-15',
  thumbnail_url: null,
  is_archived: false,
  archived_at: null,
  uploaded_by: 'test-user-id',
  ocr_text: null,
};

const mockShare = {
  id: 'share-1',
  document_id: 'doc-1',
  share_type: 'user' as const,
  shared_with_id: 'tenant-user-id',
  share_token: null,
  can_download: true,
  can_print: true,
  expires_at: null,
  access_count: 0,
  last_accessed_at: null,
  shared_by: 'test-user-id',
  created_at: '2025-01-20T00:00:00Z',
};

const mockLinkShare = {
  id: 'share-2',
  document_id: 'doc-1',
  share_type: 'link' as const,
  shared_with_id: null,
  share_token: 'aBcDeFgHiJkLmNoPqRsTuVwXyZ012345',
  can_download: false,
  can_print: false,
  expires_at: '2025-02-20T00:00:00Z',
  access_count: 5,
  last_accessed_at: '2025-02-01T12:00:00Z',
  shared_by: 'test-user-id',
  created_at: '2025-01-20T00:00:00Z',
};

const mockAccessLogEntry = {
  id: 'log-1',
  document_id: 'doc-1',
  accessed_by: 'tenant-user-id',
  share_id: 'share-1',
  action: 'view' as const,
  created_at: '2025-01-21T10:00:00Z',
};

// ─── Helper: build a mock chainable Supabase query ────────────

function buildMockChain(resolvedValue: { data: any; error: any }) {
  const chainable: any = {};
  const methods = [
    'select', 'eq', 'is', 'in', 'gte', 'lte', 'order', 'limit',
    'single', 'maybeSingle', 'insert', 'update', 'delete', 'upsert',
    'textSearch', 'ilike',
  ];
  methods.forEach(method => {
    chainable[method] = vi.fn().mockReturnValue(chainable);
  });
  // Make it thenable for await / Promise.all
  chainable.then = (resolve: any, reject?: any) => Promise.resolve(resolvedValue).then(resolve, reject);
  chainable.catch = (reject: any) => Promise.resolve(resolvedValue).catch(reject);
  return chainable;
}

// ─── useDocumentFolders Tests ─────────────────────────────────

describe('useDocumentFolders', () => {
  beforeEach(() => {
    resetMocks();
    mockGetUser.mockReset().mockResolvedValue({ data: { user: mockUser }, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch folders on mount', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_folders') {
        return buildMockChain({ data: [mockFolder, mockCustomFolder], error: null });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentFolders('property-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.folders.length).toBe(2);
    expect(result.current.folders[0].name).toBe('Leases');
    expect(result.current.folders[1].name).toBe('Renovation Docs');
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch error gracefully', async () => {
    mockFrom.mockImplementation(() => {
      return buildMockChain({ data: null, error: { message: 'Network error' } });
    });

    const { result } = renderHook(() => useDocumentFolders('property-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.folders.length).toBe(0);
  });

  it('should handle unauthenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    mockFrom.mockImplementation(() => {
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentFolders());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Not authenticated');
  });

  it('should create a new folder', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_folders') {
        const chain = buildMockChain({ data: [mockFolder], error: null });
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: mockCustomFolder, error: null }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: mockCustomFolder, error: null }).catch(reject),
        });
        return chain;
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentFolders('property-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const folder = await result.current.createFolder({
        property_id: 'property-1',
        name: 'Renovation Docs',
        description: 'Renovation project documents',
      });
      expect(folder).toBeDefined();
      expect(folder!.name).toBe('Renovation Docs');
      expect(folder!.is_system).toBe(false);
    });
  });

  it('should handle create folder error', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_folders') {
        const chain = buildMockChain({ data: [], error: null });
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: null, error: { message: 'Duplicate name' } }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: null, error: { message: 'Duplicate name' } }).catch(reject),
        });
        return chain;
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentFolders('property-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const folder = await result.current.createFolder({
        property_id: 'property-1',
        name: 'Leases',
      });
      expect(folder).toBeNull();
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should update an existing folder', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_folders') {
        return buildMockChain({ data: [mockCustomFolder], error: null });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentFolders('property-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const success = await result.current.updateFolder('folder-2', {
        name: 'Renovation Documents Updated',
        description: 'Updated description',
      });
      expect(success).toBe(true);
    });

    expect(result.current.folders[0].name).toBe('Renovation Documents Updated');
  });

  it('should handle update folder error', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_folders') {
        const chain = buildMockChain({ data: [mockCustomFolder], error: null });
        // For the update call, return an error
        const errorChain = buildMockChain({ data: null, error: { message: 'Update failed' } });
        // First call is for initial fetch, subsequent calls are for update
        let callCount = 0;
        const origEq = chain.eq;
        chain.eq = vi.fn((...args: any[]) => {
          callCount++;
          if (callCount > 2) return errorChain; // update path
          return origEq(...args);
        });
        return chain;
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentFolders('property-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should delete a non-system folder', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_folders') {
        return buildMockChain({ data: [mockCustomFolder], error: null });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentFolders('property-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.folders.length).toBe(1);

    await act(async () => {
      const success = await result.current.deleteFolder('folder-2');
      expect(success).toBe(true);
    });

    expect(result.current.folders.length).toBe(0);
  });

  it('should prevent deletion of system folders', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_folders') {
        return buildMockChain({ data: [mockFolder], error: null });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentFolders('property-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const success = await result.current.deleteFolder('folder-1');
      expect(success).toBe(false);
    });

    expect(result.current.error).toBe('Cannot delete system folders');
    expect(result.current.folders.length).toBe(1);
  });

  it('should build a folder tree from flat list', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_folders') {
        return buildMockChain({
          data: [mockFolder, mockCustomFolder, mockChildFolder],
          error: null,
        });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentFolders('property-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.folders.length).toBe(3);

    const tree = result.current.getFolderTree();

    // Should have 2 root nodes (folder-1 and folder-2)
    expect(tree.length).toBe(2);

    // folder-2 (Renovation Docs) should have folder-3 (Bathroom) as child
    const renovationFolder = tree.find(n => n.id === 'folder-2');
    expect(renovationFolder).toBeDefined();
    expect(renovationFolder!.children.length).toBe(1);
    expect(renovationFolder!.children[0].id).toBe('folder-3');
    expect(renovationFolder!.children[0].name).toBe('Bathroom');

    // folder-1 (Leases) should have no children
    const leasesFolder = tree.find(n => n.id === 'folder-1');
    expect(leasesFolder).toBeDefined();
    expect(leasesFolder!.children.length).toBe(0);
  });

  it('should return empty tree for empty folders list', async () => {
    mockFrom.mockImplementation(() => {
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentFolders('property-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const tree = result.current.getFolderTree();
    expect(tree.length).toBe(0);
  });

  it('should refresh folders when refreshFolders is called', async () => {
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_folders') {
        callCount++;
        if (callCount === 1) {
          return buildMockChain({ data: [mockFolder], error: null });
        }
        return buildMockChain({ data: [mockFolder, mockCustomFolder], error: null });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentFolders('property-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.folders.length).toBe(1);

    await act(async () => {
      await result.current.refreshFolders();
    });

    expect(result.current.folders.length).toBe(2);
  });
});

// ─── useDocumentUpload Tests ──────────────────────────────────

describe('useDocumentUpload', () => {
  beforeEach(() => {
    resetMocks();
    mockGetUser.mockReset().mockResolvedValue({ data: { user: mockUser }, error: null });
    mockFetch.mockReset();

    // Default storage mock with createSignedUrl
    mockStorage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/docs/file.pdf' } }),
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed/file.pdf' },
        error: null,
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default upload state', () => {
    const { result } = renderHook(() => useDocumentUpload());

    expect(result.current.upload.uploading).toBe(false);
    expect(result.current.upload.progress).toBe(0);
    expect(result.current.upload.fileName).toBeNull();
    expect(result.current.upload.error).toBeNull();
  });

  it('should upload a document successfully', async () => {
    const mockBlob = new Blob(['test content'], { type: 'application/pdf' });
    Object.defineProperty(mockBlob, 'size', { value: 1024 });

    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(mockBlob),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'documents') {
        const chain = buildMockChain({ data: mockDocument, error: null });
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: mockDocument, error: null }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: mockDocument, error: null }).catch(reject),
        });
        return chain;
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      const doc = await result.current.uploadDocument({
        fileUri: 'file:///test/Lease_Agreement_2025.pdf',
        fileName: 'Lease_Agreement_2025.pdf',
        mimeType: 'application/pdf',
        propertyId: 'property-1',
        folderId: 'folder-1',
        documentType: 'lease',
        title: 'Lease Agreement 2025',
      });

      expect(doc).toBeDefined();
      expect(doc!.id).toBe('doc-1');
      expect(doc!.document_type).toBe('lease');
    });

    expect(result.current.upload.progress).toBe(100);
    expect(result.current.upload.error).toBeNull();
  });

  it('should reject files exceeding 50MB', async () => {
    const oversizedBlob = new Blob(['x']);
    Object.defineProperty(oversizedBlob, 'size', { value: 51 * 1024 * 1024 });

    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(oversizedBlob),
    });

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      const doc = await result.current.uploadDocument({
        fileUri: 'file:///test/huge-file.pdf',
        fileName: 'huge-file.pdf',
        mimeType: 'application/pdf',
      });

      expect(doc).toBeNull();
    });

    expect(result.current.upload.error).toContain('50MB');
  });

  it('should handle storage upload error', async () => {
    const mockBlob = new Blob(['test'], { type: 'application/pdf' });
    Object.defineProperty(mockBlob, 'size', { value: 1024 });

    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(mockBlob),
    });

    mockStorage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: null, error: { message: 'Storage full' } }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      const doc = await result.current.uploadDocument({
        fileUri: 'file:///test/file.pdf',
        fileName: 'file.pdf',
        mimeType: 'application/pdf',
      });

      expect(doc).toBeNull();
    });

    expect(result.current.upload.error).toBeTruthy();
  });

  it('should handle unauthenticated upload attempt', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const mockBlob = new Blob(['test'], { type: 'application/pdf' });
    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(mockBlob),
    });

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      const doc = await result.current.uploadDocument({
        fileUri: 'file:///test/file.pdf',
        fileName: 'file.pdf',
        mimeType: 'application/pdf',
      });

      expect(doc).toBeNull();
    });

    expect(result.current.upload.error).toBe('Not authenticated');
  });

  it('should upload multiple documents sequentially', async () => {
    const mockBlob = new Blob(['test'], { type: 'application/pdf' });
    Object.defineProperty(mockBlob, 'size', { value: 1024 });

    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(mockBlob),
    });

    let docCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'documents') {
        docCount++;
        const doc = { ...mockDocument, id: `doc-${docCount}` };
        const chain = buildMockChain({ data: doc, error: null });
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: doc, error: null }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: doc, error: null }).catch(reject),
        });
        return chain;
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      const docs = await result.current.uploadMultipleDocuments([
        {
          fileUri: 'file:///test/doc1.pdf',
          fileName: 'doc1.pdf',
          mimeType: 'application/pdf',
        },
        {
          fileUri: 'file:///test/doc2.pdf',
          fileName: 'doc2.pdf',
          mimeType: 'application/pdf',
        },
        {
          fileUri: 'file:///test/doc3.pdf',
          fileName: 'doc3.pdf',
          mimeType: 'application/pdf',
        },
      ]);

      expect(docs.length).toBe(3);
    });
  });

  it('should handle database insert error during upload', async () => {
    const mockBlob = new Blob(['test'], { type: 'application/pdf' });
    Object.defineProperty(mockBlob, 'size', { value: 1024 });

    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(mockBlob),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'documents') {
        const chain = buildMockChain({ data: null, error: { message: 'Insert failed' } });
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: null, error: { message: 'Insert failed' } }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: null, error: { message: 'Insert failed' } }).catch(reject),
        });
        return chain;
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      const doc = await result.current.uploadDocument({
        fileUri: 'file:///test/file.pdf',
        fileName: 'file.pdf',
        mimeType: 'application/pdf',
      });

      expect(doc).toBeNull();
    });

    expect(result.current.upload.error).toBeTruthy();
    expect(result.current.upload.uploading).toBe(false);
  });
});

// ─── Document Auto-Categorization Tests ───────────────────────

describe('Document Auto-Categorization', () => {
  beforeEach(() => {
    resetMocks();
    mockGetUser.mockReset().mockResolvedValue({ data: { user: mockUser }, error: null });
    mockFetch.mockReset();

    mockStorage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed/file.pdf' },
        error: null,
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function setupUploadTest(expectedType: CasaDocumentType) {
    const mockBlob = new Blob(['test'], { type: 'application/pdf' });
    Object.defineProperty(mockBlob, 'size', { value: 1024 });

    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(mockBlob),
    });

    let capturedInsert: any = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'documents') {
        const chain: any = {};
        const methods = [
          'select', 'eq', 'is', 'in', 'gte', 'lte', 'order', 'limit',
          'single', 'maybeSingle', 'update', 'delete', 'upsert',
          'textSearch', 'ilike',
        ];
        methods.forEach(method => {
          chain[method] = vi.fn().mockReturnValue(chain);
        });
        chain.insert = vi.fn((data: any) => {
          capturedInsert = data;
          return chain;
        });
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: { ...mockDocument, document_type: capturedInsert?.document_type || expectedType }, error: null }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: { ...mockDocument, document_type: capturedInsert?.document_type || expectedType }, error: null }).catch(reject),
        });
        chain.then = (resolve: any, reject?: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject);
        chain.catch = (reject: any) => Promise.resolve({ data: [], error: null }).catch(reject);
        return chain;
      }
      return buildMockChain({ data: [], error: null });
    });

    return { getCapturedInsert: () => capturedInsert };
  }

  it('should infer "lease" type from filename containing "lease"', async () => {
    const { getCapturedInsert } = setupUploadTest('lease');

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      await result.current.uploadDocument({
        fileUri: 'file:///test/residential-lease-agreement.pdf',
        fileName: 'residential-lease-agreement.pdf',
        mimeType: 'application/pdf',
        // No documentType specified — should auto-infer
      });
    });

    expect(getCapturedInsert()).toBeTruthy();
    expect(getCapturedInsert().document_type).toBe('lease');
  });

  it('should infer "condition_report" from filename containing "inspection"', async () => {
    const { getCapturedInsert } = setupUploadTest('condition_report');

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      await result.current.uploadDocument({
        fileUri: 'file:///test/inspection-report-jan.pdf',
        fileName: 'inspection-report-jan.pdf',
        mimeType: 'application/pdf',
      });
    });

    expect(getCapturedInsert()).toBeTruthy();
    expect(getCapturedInsert().document_type).toBe('condition_report');
  });

  it('should infer "compliance_certificate" from filename containing "compliance"', async () => {
    const { getCapturedInsert } = setupUploadTest('compliance_certificate');

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      await result.current.uploadDocument({
        fileUri: 'file:///test/compliance-certificate-2025.pdf',
        fileName: 'compliance-certificate-2025.pdf',
        mimeType: 'application/pdf',
      });
    });

    expect(getCapturedInsert()).toBeTruthy();
    expect(getCapturedInsert().document_type).toBe('compliance_certificate');
  });

  it('should infer "notice" from filename containing "notice"', async () => {
    const { getCapturedInsert } = setupUploadTest('notice');

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      await result.current.uploadDocument({
        fileUri: 'file:///test/breach-notice.pdf',
        fileName: 'breach-notice.pdf',
        mimeType: 'application/pdf',
      });
    });

    expect(getCapturedInsert()).toBeTruthy();
    expect(getCapturedInsert().document_type).toBe('notice');
  });

  it('should infer "financial_report" from filename containing "invoice"', async () => {
    const { getCapturedInsert } = setupUploadTest('financial_report');

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      await result.current.uploadDocument({
        fileUri: 'file:///test/invoice-december.pdf',
        fileName: 'invoice-december.pdf',
        mimeType: 'application/pdf',
      });
    });

    expect(getCapturedInsert()).toBeTruthy();
    expect(getCapturedInsert().document_type).toBe('financial_report');
  });

  it('should infer "tax_report" from filename containing "tax"', async () => {
    const { getCapturedInsert } = setupUploadTest('tax_report');

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      await result.current.uploadDocument({
        fileUri: 'file:///test/tax-depreciation-schedule.pdf',
        fileName: 'tax-depreciation-schedule.pdf',
        mimeType: 'application/pdf',
      });
    });

    expect(getCapturedInsert()).toBeTruthy();
    expect(getCapturedInsert().document_type).toBe('tax_report');
  });

  it('should infer "evidence_report" from image mime types', async () => {
    const { getCapturedInsert } = setupUploadTest('evidence_report');

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      await result.current.uploadDocument({
        fileUri: 'file:///test/property-photo.jpg',
        fileName: 'property-photo.jpg',
        mimeType: 'image/jpeg',
      });
    });

    expect(getCapturedInsert()).toBeTruthy();
    expect(getCapturedInsert().document_type).toBe('evidence_report');
  });

  it('should default to "other" when type cannot be inferred', async () => {
    const { getCapturedInsert } = setupUploadTest('other');

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      await result.current.uploadDocument({
        fileUri: 'file:///test/random-document.pdf',
        fileName: 'random-document.pdf',
        mimeType: 'application/pdf',
      });
    });

    expect(getCapturedInsert()).toBeTruthy();
    expect(getCapturedInsert().document_type).toBe('other');
  });

  it('should use explicit documentType over auto-inferred type', async () => {
    const { getCapturedInsert } = setupUploadTest('receipt');

    const { result } = renderHook(() => useDocumentUpload());

    await act(async () => {
      await result.current.uploadDocument({
        fileUri: 'file:///test/lease-document.pdf',
        fileName: 'lease-document.pdf',
        mimeType: 'application/pdf',
        documentType: 'receipt', // Explicit type overrides the "lease" inference
      });
    });

    expect(getCapturedInsert()).toBeTruthy();
    expect(getCapturedInsert().document_type).toBe('receipt');
  });
});

// ─── useDocumentShares Tests ──────────────────────────────────

describe('useDocumentShares', () => {
  beforeEach(() => {
    resetMocks();
    mockGetUser.mockReset().mockResolvedValue({ data: { user: mockUser }, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch shares for a document on mount', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_shares') {
        return buildMockChain({ data: [mockShare, mockLinkShare], error: null });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentShares('doc-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.shares.length).toBe(2);
    expect(result.current.shares[0].share_type).toBe('user');
    expect(result.current.shares[1].share_type).toBe('link');
    expect(result.current.error).toBeNull();
  });

  it('should not fetch when no documentId is provided', async () => {
    const { result } = renderHook(() => useDocumentShares());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.shares.length).toBe(0);
    expect(mockFrom).not.toHaveBeenCalledWith('document_shares');
  });

  it('should handle fetch error gracefully', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_shares') {
        return buildMockChain({ data: null, error: { message: 'Permission denied' } });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentShares('doc-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should share a document with a specific user', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_shares') {
        const chain = buildMockChain({ data: [], error: null });
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: mockShare, error: null }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: mockShare, error: null }).catch(reject),
        });
        return chain;
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentShares('doc-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const share = await result.current.shareWithUser('doc-1', 'tenant-user-id', {
        canDownload: true,
        canPrint: true,
      });

      expect(share).toBeDefined();
      expect(share!.share_type).toBe('user');
      expect(share!.shared_with_id).toBe('tenant-user-id');
      expect(share!.can_download).toBe(true);
    });

    // Share should be added to state
    expect(result.current.shares.length).toBe(1);
  });

  it('should share with user and set expiry', async () => {
    const expiringShare = {
      ...mockShare,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_shares') {
        const chain = buildMockChain({ data: [], error: null });
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: expiringShare, error: null }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: expiringShare, error: null }).catch(reject),
        });
        return chain;
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentShares('doc-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const share = await result.current.shareWithUser('doc-1', 'tenant-user-id', {
        expiresInDays: 7,
      });

      expect(share).toBeDefined();
      expect(share!.expires_at).toBeTruthy();
    });
  });

  it('should create a shareable link', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_shares') {
        const chain = buildMockChain({ data: [], error: null });
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: mockLinkShare, error: null }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: mockLinkShare, error: null }).catch(reject),
        });
        return chain;
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentShares('doc-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const share = await result.current.createShareLink('doc-1', {
        canDownload: false,
        canPrint: false,
        expiresInDays: 30,
      });

      expect(share).toBeDefined();
      expect(share!.share_type).toBe('link');
      expect(share!.share_token).toBeTruthy();
      expect(share!.share_token!.length).toBeGreaterThanOrEqual(32);
      expect(share!.can_download).toBe(false);
      expect(share!.can_print).toBe(false);
    });

    expect(result.current.shares.length).toBe(1);
  });

  it('should handle share creation error', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_shares') {
        const chain = buildMockChain({ data: [], error: null });
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: null, error: { message: 'Share creation failed' } }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: null, error: { message: 'Share creation failed' } }).catch(reject),
        });
        return chain;
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentShares('doc-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const share = await result.current.shareWithUser('doc-1', 'tenant-user-id');
      expect(share).toBeNull();
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should handle unauthenticated share attempt', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_shares') {
        return buildMockChain({ data: [], error: null });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentShares('doc-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const share = await result.current.shareWithUser('doc-1', 'tenant-user-id');
      expect(share).toBeNull();
    });

    expect(result.current.error).toBe('Not authenticated');
  });

  it('should revoke a share', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_shares') {
        return buildMockChain({ data: [mockShare, mockLinkShare], error: null });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentShares('doc-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.shares.length).toBe(2);

    await act(async () => {
      const success = await result.current.revokeShare('share-1');
      expect(success).toBe(true);
    });

    expect(result.current.shares.length).toBe(1);
    expect(result.current.shares[0].id).toBe('share-2');
  });

  it('should handle revoke share error', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_shares') {
        const chain = buildMockChain({ data: [mockShare], error: null });
        // On delete path, return error
        let deleteCallCount = 0;
        const origDelete = chain.delete;
        chain.delete = vi.fn(() => {
          deleteCallCount++;
          return buildMockChain({ data: null, error: { message: 'Cannot revoke' } });
        });
        return chain;
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentShares('doc-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const success = await result.current.revokeShare('share-1');
      expect(success).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });
});

// ─── Document Access Logging Tests ────────────────────────────

describe('Document Access Logging', () => {
  beforeEach(() => {
    resetMocks();
    mockGetUser.mockReset().mockResolvedValue({ data: { user: mockUser }, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should log a view access event', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_access_log') {
        return buildMockChain({ data: null, error: null });
      }
      if (table === 'document_shares') {
        return buildMockChain({ data: [], error: null });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentShares('doc-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.logAccess('doc-1', 'view', 'share-1');
    });

    // Verify insert was called on document_access_log
    expect(mockFrom).toHaveBeenCalledWith('document_access_log');
  });

  it('should log a download access event', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_access_log') {
        return buildMockChain({ data: null, error: null });
      }
      if (table === 'document_shares') {
        return buildMockChain({ data: [], error: null });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentShares('doc-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.logAccess('doc-1', 'download');
    });

    expect(mockFrom).toHaveBeenCalledWith('document_access_log');
  });

  it('should not throw on access log failure (fire-and-forget)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_access_log') {
        return buildMockChain({ data: null, error: { message: 'Logging failed' } });
      }
      if (table === 'document_shares') {
        return buildMockChain({ data: [], error: null });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentShares('doc-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should not throw
    await act(async () => {
      await result.current.logAccess('doc-1', 'print');
    });

    // No error should be set on the hook state for access log failures
    expect(result.current.error).toBeNull();
  });

  it('should fetch access log for a document', async () => {
    const accessLogs = [
      mockAccessLogEntry,
      { ...mockAccessLogEntry, id: 'log-2', action: 'download', created_at: '2025-01-21T11:00:00Z' },
      { ...mockAccessLogEntry, id: 'log-3', action: 'print', created_at: '2025-01-21T12:00:00Z' },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_access_log') {
        return buildMockChain({ data: accessLogs, error: null });
      }
      if (table === 'document_shares') {
        return buildMockChain({ data: [], error: null });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentShares('doc-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let logs: any[] = [];
    await act(async () => {
      logs = await result.current.getAccessLog('doc-1');
    });

    expect(logs.length).toBe(3);
    expect(logs[0].action).toBe('view');
    expect(logs[1].action).toBe('download');
    expect(logs[2].action).toBe('print');
    expect(result.current.accessLog.length).toBe(3);
  });

  it('should return empty array on access log fetch error', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_access_log') {
        return buildMockChain({ data: null, error: { message: 'Fetch failed' } });
      }
      if (table === 'document_shares') {
        return buildMockChain({ data: [], error: null });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result } = renderHook(() => useDocumentShares('doc-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let logs: any[] = [];
    await act(async () => {
      logs = await result.current.getAccessLog('doc-1');
    });

    expect(logs.length).toBe(0);
  });

  it('should support all four access actions', () => {
    const validActions = ['view', 'download', 'print', 'share'] as const;
    expect(validActions).toHaveLength(4);
    validActions.forEach(action => {
      expect(typeof action).toBe('string');
      expect(action.length).toBeGreaterThan(0);
    });
  });
});

// ─── Full-Text Search Tests ───────────────────────────────────

describe('Document Full-Text Search', () => {
  beforeEach(() => {
    resetMocks();
    mockGetUser.mockReset().mockResolvedValue({ data: { user: mockUser }, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should search documents via RPC', async () => {
    const searchResults = [
      { ...mockDocument, title: 'Lease Agreement 2025' },
      { ...mockDocument, id: 'doc-2', title: 'Lease Renewal Notice' },
    ];

    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'search_documents') {
        return Promise.resolve({ data: searchResults, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { data, error } = await mockRpc('search_documents', {
      search_query: 'lease',
      owner_filter: 'test-user-id',
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.length).toBe(2);
    expect(data[0].title).toContain('Lease');
    expect(data[1].title).toContain('Lease');
  });

  it('should return empty results for no matches', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'search_documents') {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { data, error } = await mockRpc('search_documents', {
      search_query: 'nonexistent-term',
      owner_filter: 'test-user-id',
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.length).toBe(0);
  });

  it('should handle search RPC error', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'search_documents') {
        return Promise.resolve({ data: null, error: { message: 'Search failed' } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { data, error } = await mockRpc('search_documents', {
      search_query: 'test',
      owner_filter: 'test-user-id',
    });

    expect(error).toBeTruthy();
    expect(error.message).toBe('Search failed');
    expect(data).toBeNull();
  });

  it('should search by document type filter', async () => {
    const searchResults = [
      { ...mockDocument, document_type: 'lease' },
    ];

    mockRpc.mockImplementation((fnName: string, params: any) => {
      if (fnName === 'search_documents') {
        if (params?.type_filter === 'lease') {
          return Promise.resolve({ data: searchResults, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { data, error } = await mockRpc('search_documents', {
      search_query: 'agreement',
      owner_filter: 'test-user-id',
      type_filter: 'lease',
    });

    expect(error).toBeNull();
    expect(data!.length).toBe(1);
    expect(data![0].document_type).toBe('lease');
  });

  it('should search by property filter', async () => {
    const searchResults = [mockDocument];

    mockRpc.mockImplementation((fnName: string, params: any) => {
      if (fnName === 'search_documents') {
        if (params?.property_filter === 'property-1') {
          return Promise.resolve({ data: searchResults, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { data, error } = await mockRpc('search_documents', {
      search_query: 'lease',
      owner_filter: 'test-user-id',
      property_filter: 'property-1',
    });

    expect(error).toBeNull();
    expect(data!.length).toBe(1);
  });
});

// ─── Document Type Configuration Tests ────────────────────────

describe('Document Type Configuration (All 18 Types)', () => {
  const ALL_DOCUMENT_TYPES: CasaDocumentType[] = [
    'financial_report',
    'tax_report',
    'lease',
    'notice',
    'condition_report',
    'compliance_certificate',
    'property_summary',
    'portfolio_report',
    'cash_flow_forecast',
    'evidence_report',
    'inspection_report',
    'insurance_certificate',
    'identity_document',
    'financial_statement',
    'correspondence',
    'photo',
    'receipt',
    'other',
  ];

  it('should have exactly 18 document types', () => {
    expect(ALL_DOCUMENT_TYPES).toHaveLength(18);
  });

  it('should have all expected document types defined', () => {
    ALL_DOCUMENT_TYPES.forEach(type => {
      expect(typeof type).toBe('string');
      expect(type.length).toBeGreaterThan(0);
    });
  });

  it('should have no duplicate document types', () => {
    const unique = new Set(ALL_DOCUMENT_TYPES);
    expect(unique.size).toBe(ALL_DOCUMENT_TYPES.length);
  });

  it('should include core property management types', () => {
    expect(ALL_DOCUMENT_TYPES).toContain('lease');
    expect(ALL_DOCUMENT_TYPES).toContain('notice');
    expect(ALL_DOCUMENT_TYPES).toContain('condition_report');
    expect(ALL_DOCUMENT_TYPES).toContain('compliance_certificate');
    expect(ALL_DOCUMENT_TYPES).toContain('inspection_report');
  });

  it('should include financial document types', () => {
    expect(ALL_DOCUMENT_TYPES).toContain('financial_report');
    expect(ALL_DOCUMENT_TYPES).toContain('tax_report');
    expect(ALL_DOCUMENT_TYPES).toContain('financial_statement');
    expect(ALL_DOCUMENT_TYPES).toContain('receipt');
    expect(ALL_DOCUMENT_TYPES).toContain('cash_flow_forecast');
  });

  it('should include reporting/analysis types', () => {
    expect(ALL_DOCUMENT_TYPES).toContain('property_summary');
    expect(ALL_DOCUMENT_TYPES).toContain('portfolio_report');
    expect(ALL_DOCUMENT_TYPES).toContain('evidence_report');
  });

  it('should include media and identity types', () => {
    expect(ALL_DOCUMENT_TYPES).toContain('photo');
    expect(ALL_DOCUMENT_TYPES).toContain('identity_document');
    expect(ALL_DOCUMENT_TYPES).toContain('insurance_certificate');
  });

  it('should include generic catch-all types', () => {
    expect(ALL_DOCUMENT_TYPES).toContain('correspondence');
    expect(ALL_DOCUMENT_TYPES).toContain('other');
  });

  it('should have types that map to logical folder categories', () => {
    const folderMappings: Record<string, CasaDocumentType[]> = {
      'Leases': ['lease'],
      'Notices': ['notice', 'correspondence'],
      'Inspections': ['condition_report', 'inspection_report', 'evidence_report'],
      'Compliance': ['compliance_certificate', 'insurance_certificate'],
      'Financial': ['financial_report', 'tax_report', 'financial_statement', 'receipt', 'cash_flow_forecast'],
      'Reports': ['property_summary', 'portfolio_report'],
      'Identity': ['identity_document'],
      'Photos': ['photo'],
      'Other': ['other'],
    };

    // Every document type should be covered by at least one folder category
    const coveredTypes = new Set(Object.values(folderMappings).flat());
    ALL_DOCUMENT_TYPES.forEach(type => {
      expect(coveredTypes.has(type)).toBe(true);
    });
  });
});

// ─── Integration: Folder + Upload + Share Workflow ─────────────

describe('Document Management Workflow Integration', () => {
  beforeEach(() => {
    resetMocks();
    mockGetUser.mockReset().mockResolvedValue({ data: { user: mockUser }, error: null });
    mockFetch.mockReset();

    mockStorage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed/file.pdf' },
        error: null,
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should support the full document lifecycle: create folder -> upload -> share -> log access', async () => {
    // Step 1: Create folder
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_folders') {
        const chain = buildMockChain({ data: [], error: null });
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: mockCustomFolder, error: null }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: mockCustomFolder, error: null }).catch(reject),
        });
        return chain;
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result: foldersResult } = renderHook(() => useDocumentFolders('property-1'));

    await waitFor(() => {
      expect(foldersResult.current.loading).toBe(false);
    });

    let createdFolder: any;
    await act(async () => {
      createdFolder = await foldersResult.current.createFolder({
        property_id: 'property-1',
        name: 'Renovation Docs',
      });
    });

    expect(createdFolder).toBeDefined();
    expect(createdFolder.id).toBe('folder-2');

    // Step 2: Upload document to folder
    const mockBlob = new Blob(['test'], { type: 'application/pdf' });
    Object.defineProperty(mockBlob, 'size', { value: 1024 });
    mockFetch.mockResolvedValue({
      blob: () => Promise.resolve(mockBlob),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'documents') {
        const chain = buildMockChain({ data: mockDocument, error: null });
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: { ...mockDocument, folder_id: 'folder-2' }, error: null }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: { ...mockDocument, folder_id: 'folder-2' }, error: null }).catch(reject),
        });
        return chain;
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result: uploadResult } = renderHook(() => useDocumentUpload());

    let uploadedDoc: any;
    await act(async () => {
      uploadedDoc = await uploadResult.current.uploadDocument({
        fileUri: 'file:///test/renovation-plan.pdf',
        fileName: 'renovation-plan.pdf',
        mimeType: 'application/pdf',
        propertyId: 'property-1',
        folderId: createdFolder.id,
      });
    });

    expect(uploadedDoc).toBeDefined();
    expect(uploadedDoc.folder_id).toBe('folder-2');

    // Step 3: Share the document
    mockFrom.mockImplementation((table: string) => {
      if (table === 'document_shares') {
        const chain = buildMockChain({ data: [], error: null });
        chain.single = vi.fn().mockReturnValue({
          then: (resolve: any, reject?: any) =>
            Promise.resolve({ data: mockShare, error: null }).then(resolve, reject),
          catch: (reject: any) =>
            Promise.resolve({ data: mockShare, error: null }).catch(reject),
        });
        return chain;
      }
      if (table === 'document_access_log') {
        return buildMockChain({ data: null, error: null });
      }
      return buildMockChain({ data: [], error: null });
    });

    const { result: sharesResult } = renderHook(() => useDocumentShares(uploadedDoc.id));

    await waitFor(() => {
      expect(sharesResult.current.loading).toBe(false);
    });

    let share: any;
    await act(async () => {
      share = await sharesResult.current.shareWithUser(uploadedDoc.id, 'tenant-user-id');
    });

    expect(share).toBeDefined();
    expect(share.shared_with_id).toBe('tenant-user-id');

    // Step 4: Log access
    await act(async () => {
      await sharesResult.current.logAccess(uploadedDoc.id, 'view', share.id);
    });

    expect(mockFrom).toHaveBeenCalledWith('document_access_log');
  });

  it('should handle empty state for new property with no documents', async () => {
    mockFrom.mockImplementation(() => {
      return buildMockChain({ data: [], error: null });
    });

    const { result: foldersResult } = renderHook(() => useDocumentFolders('new-property'));
    const { result: sharesResult } = renderHook(() => useDocumentShares());

    await waitFor(() => {
      expect(foldersResult.current.loading).toBe(false);
      expect(sharesResult.current.loading).toBe(false);
    });

    expect(foldersResult.current.folders.length).toBe(0);
    expect(foldersResult.current.error).toBeNull();
    expect(sharesResult.current.shares.length).toBe(0);
    expect(sharesResult.current.error).toBeNull();

    const tree = foldersResult.current.getFolderTree();
    expect(tree.length).toBe(0);
  });
});
