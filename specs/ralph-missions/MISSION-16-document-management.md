# Mission 16: Document Management

## Overview
**Goal**: Centralized document storage and management for all property-related documents.
**Dependencies**: Mission 06 (Tenancies), Mission 11 (Inspections)
**Estimated Complexity**: Medium

## Success Criteria

### Phase A: Database Schema
- [ ] Create `documents` table
- [ ] Create `document_folders` table
- [ ] Create `document_shares` table
- [ ] Set up RLS policies
- [ ] Configure Supabase Storage

### Phase B: Document Upload
- [ ] Multi-file upload support
- [ ] Drag and drop interface
- [ ] Auto-categorization by type
- [ ] Document preview (PDF, images)
- [ ] Metadata extraction

### Phase C: Document Organization
- [ ] Folder structure per property
- [ ] Default folder templates
- [ ] Custom folders
- [ ] Tagging system
- [ ] Search by name, tag, content

### Phase D: Document Viewer
- [ ] In-app PDF viewer
- [ ] Image viewer with zoom
- [ ] Document annotations
- [ ] Download option
- [ ] Share via link

### Phase E: Document Categories
- [ ] Leases and agreements
- [ ] Inspection reports
- [ ] Insurance documents
- [ ] Compliance certificates
- [ ] Tenant documents
- [ ] Financial records
- [ ] Correspondence

### Phase F: Document Sharing
- [ ] Share with tenants
- [ ] Time-limited share links
- [ ] Access tracking
- [ ] Revoke access

### Phase G: Tenant Document Access
- [ ] View shared documents
- [ ] Download permitted documents
- [ ] Upload requested documents
- [ ] Sign documents (placeholder)

### Phase H: Testing
- [ ] Unit tests for document hooks
- [ ] Integration tests for upload/download
- [ ] E2E test: Upload → Organize → Share → View as tenant

## Database Schema

```sql
-- Document type enum
CREATE TYPE document_type AS ENUM (
  'lease',
  'condition_report',
  'inspection_report',
  'insurance_certificate',
  'compliance_certificate',
  'identity_document',
  'financial_statement',
  'correspondence',
  'photo',
  'receipt',
  'other'
);

-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Location
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  tenancy_id UUID REFERENCES tenancies(id) ON DELETE SET NULL,
  folder_id UUID REFERENCES document_folders(id) ON DELETE SET NULL,

  -- File details
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_extension TEXT,

  -- Document info
  document_type document_type NOT NULL DEFAULT 'other',
  title TEXT,
  description TEXT,
  tags TEXT[],

  -- Dates
  document_date DATE, -- Date of the document (not upload)
  expiry_date DATE,

  -- Thumbnails
  thumbnail_url TEXT,
  preview_url TEXT, -- For PDFs: first page as image

  -- Processing
  is_processed BOOLEAN NOT NULL DEFAULT FALSE,
  ocr_text TEXT, -- Extracted text for search
  metadata JSONB, -- Extracted metadata

  -- Status
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,

  -- Metadata
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document folders
CREATE TABLE document_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

  -- Folder details
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES document_folders(id) ON DELETE CASCADE,
  icon TEXT,
  color TEXT,

  -- System folder (cannot be deleted)
  is_system BOOLEAN NOT NULL DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document shares
CREATE TABLE document_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Share type
  share_type TEXT NOT NULL CHECK (share_type IN ('user', 'link')),

  -- User share
  shared_with_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Link share
  share_token TEXT UNIQUE,
  link_password TEXT, -- Hashed password

  -- Permissions
  can_download BOOLEAN NOT NULL DEFAULT TRUE,
  can_print BOOLEAN NOT NULL DEFAULT TRUE,

  -- Expiry
  expires_at TIMESTAMPTZ,

  -- Access tracking
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,

  -- Metadata
  shared_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (
    (share_type = 'user' AND shared_with_id IS NOT NULL) OR
    (share_type = 'link' AND share_token IS NOT NULL)
  )
);

-- Document access log
CREATE TABLE document_access_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  accessed_by UUID REFERENCES profiles(id),
  share_id UUID REFERENCES document_shares(id),

  -- Access details
  action TEXT NOT NULL CHECK (action IN ('view', 'download', 'print', 'share')),
  ip_address TEXT,
  user_agent TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document annotations
CREATE TABLE document_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),

  -- Annotation details
  page_number INTEGER NOT NULL DEFAULT 1,
  annotation_type TEXT NOT NULL CHECK (annotation_type IN ('highlight', 'note', 'drawing', 'stamp')),
  content TEXT,
  position JSONB NOT NULL, -- {x, y, width, height}
  style JSONB, -- Color, etc.

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default folder templates
CREATE TABLE folder_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  folders JSONB NOT NULL, -- Array of folder names/structure
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Insert default folder template
INSERT INTO folder_templates (name, description, folders) VALUES
('Standard Property', 'Default folder structure for residential properties', '[
  {"name": "Leases", "icon": "file-text", "children": []},
  {"name": "Inspection Reports", "icon": "clipboard", "children": [
    {"name": "Entry Reports"},
    {"name": "Routine Inspections"},
    {"name": "Exit Reports"}
  ]},
  {"name": "Insurance", "icon": "shield", "children": []},
  {"name": "Compliance", "icon": "check-circle", "children": [
    {"name": "Smoke Alarms"},
    {"name": "Electrical"},
    {"name": "Pool Safety"}
  ]},
  {"name": "Maintenance Records", "icon": "tool", "children": []},
  {"name": "Financial", "icon": "dollar-sign", "children": [
    {"name": "Receipts"},
    {"name": "Invoices"},
    {"name": "Tax Documents"}
  ]},
  {"name": "Tenant Documents", "icon": "users", "children": []},
  {"name": "Correspondence", "icon": "mail", "children": []}
]');

-- Indexes
CREATE INDEX idx_documents_owner ON documents(owner_id) WHERE NOT is_archived;
CREATE INDEX idx_documents_property ON documents(property_id) WHERE NOT is_archived;
CREATE INDEX idx_documents_tenancy ON documents(tenancy_id);
CREATE INDEX idx_documents_folder ON documents(folder_id);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_search ON documents USING GIN (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(ocr_text, '')));
CREATE INDEX idx_document_folders_property ON document_folders(property_id);
CREATE INDEX idx_document_shares_document ON document_shares(document_id);
CREATE INDEX idx_document_shares_token ON document_shares(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX idx_document_access_log ON document_access_log(document_id, created_at);

-- RLS Policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_annotations ENABLE ROW LEVEL SECURITY;

-- Documents: owners and shared users
CREATE POLICY "Owners manage own documents"
  ON documents FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Shared users can view documents"
  ON documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM document_shares
      WHERE document_shares.document_id = documents.id
      AND document_shares.shared_with_id = auth.uid()
      AND (document_shares.expires_at IS NULL OR document_shares.expires_at > NOW())
    )
  );

-- Folders
CREATE POLICY "Owners manage own folders"
  ON document_folders FOR ALL
  USING (auth.uid() = owner_id);

-- Shares: owners manage
CREATE POLICY "Owners manage document shares"
  ON document_shares FOR ALL
  USING (auth.uid() = shared_by);

CREATE POLICY "Shared users can view their shares"
  ON document_shares FOR SELECT
  USING (auth.uid() = shared_with_id);

-- Access log: owners view
CREATE POLICY "Owners view access logs"
  ON document_access_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_access_log.document_id
      AND documents.owner_id = auth.uid()
    )
  );

-- Annotations
CREATE POLICY "Owners manage annotations"
  ON document_annotations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_annotations.document_id
      AND documents.owner_id = auth.uid()
    )
  );

-- Function to create default folders for new property
CREATE OR REPLACE FUNCTION create_property_folders()
RETURNS TRIGGER AS $$
DECLARE
  template JSONB;
  folder JSONB;
BEGIN
  SELECT folders INTO template FROM folder_templates WHERE name = 'Standard Property' AND is_active;

  IF template IS NOT NULL THEN
    FOR folder IN SELECT * FROM jsonb_array_elements(template)
    LOOP
      INSERT INTO document_folders (owner_id, property_id, name, icon, is_system)
      VALUES (NEW.owner_id, NEW.id, folder->>'name', folder->>'icon', TRUE);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER property_folders_init
  AFTER INSERT ON properties
  FOR EACH ROW EXECUTE FUNCTION create_property_folders();

-- Updated_at triggers
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER document_folders_updated_at
  BEFORE UPDATE ON document_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Files to Create/Modify

### Packages
```
packages/api/src/
├── queries/
│   ├── documents.ts            # Document CRUD
│   ├── documentFolders.ts      # Folder management
│   └── documentShares.ts       # Sharing
├── hooks/
│   ├── useDocuments.ts         # List documents
│   ├── useDocument.ts          # Single document
│   ├── useDocumentFolders.ts   # Folders
│   └── useDocumentUpload.ts    # Upload handling
└── services/
    ├── documentProcessor.ts    # Thumbnails, OCR
    └── shareLinks.ts           # Generate share links
```

### Backend (Edge Functions)
```
supabase/functions/
├── process-document/
│   └── index.ts                # Generate thumbnails, OCR
└── document-share-access/
    └── index.ts                # Validate share links
```

### Owner App
```
apps/owner/app/(app)/
├── documents/
│   ├── index.tsx               # Document browser
│   ├── upload.tsx              # Upload documents
│   ├── [id]/
│   │   ├── index.tsx           # Document viewer
│   │   ├── share.tsx           # Share settings
│   │   └── edit.tsx            # Edit metadata
│   └── folder/
│       └── [folderId].tsx      # Folder view

apps/owner/components/
├── DocumentBrowser.tsx         # File browser UI
├── DocumentCard.tsx            # Document thumbnail
├── FolderTree.tsx              # Folder navigation
├── DocumentUploader.tsx        # Upload dropzone
├── DocumentViewer.tsx          # PDF/image viewer
├── ShareDialog.tsx             # Share configuration
└── DocumentSearch.tsx          # Search interface
```

### Tenant App
```
apps/tenant/app/(app)/
├── documents/
│   ├── index.tsx               # Shared documents
│   └── [id].tsx                # View document

apps/tenant/components/
├── SharedDocumentList.tsx      # List shared docs
└── DocumentViewer.tsx          # View document
```

### Shared UI
```
packages/ui/src/components/
├── FileIcon.tsx                # File type icons
├── Dropzone.tsx                # Drag and drop area
├── PDFViewer.tsx               # PDF display
├── ImageViewer.tsx             # Image display
└── FolderBreadcrumb.tsx        # Navigation breadcrumb
```

## Storage Configuration

```typescript
// Supabase Storage buckets
// - documents: Private, owner access only
// - document-thumbnails: Private, generated thumbnails
// - shared-documents: Public with token auth
```

## Document Processing Pipeline

```
Upload → Storage → Edge Function Trigger
                           ↓
         ┌─────────────────┼─────────────────┐
         ↓                 ↓                 ↓
    Generate           Extract          OCR Text
    Thumbnail          Metadata         (if PDF)
         ↓                 ↓                 ↓
         └─────────────────┼─────────────────┘
                           ↓
                  Update Document Record
```

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Commit Message Pattern
```
feat(documents): <description>

Mission-16: Document Management
```

### Phase I: Agent Integration

The Casa agent interacts with the document management system for proactive document handling:

**Agent Tools:**
| Name | Category | Autonomy | Description |
|------|----------|----------|-------------|
| `get_documents` | query | L4 | List documents for a property/tenancy |
| `get_document` | query | L4 | Get specific document details |
| `upload_document` | action | L3 | Upload document to a property's folder |
| `share_document` | action | L2 | Share document with tenant |
| `generate_lease` | generate | L2 | Generate state-compliant lease PDF |
| `generate_condition_report` | generate | L2 | Generate inspection condition report |
| `generate_breach_notice` | generate | L2 | Generate formal arrears breach notice |
| `generate_rent_increase_notice` | generate | L2 | Generate compliant rent increase notice |

**Proactive Document Management:**
- When inspection completes → agent auto-generates PDF report and stores in property's Inspection Reports folder
- When lease is signed → agent stores in Leases folder
- When work order completes → agent stores invoice in Maintenance Records folder
- When compliance certificate uploaded → agent stores in Compliance folder and updates compliance calendar
- Agent alerts owner when documents are expiring (insurance certificates, compliance certificates)
- Agent auto-categorises uploaded documents based on filename and content

**Document Generation Service:**
The agent generates these document types:
1. **Lease Agreement** — State-specific template (NSW/VIC/QLD) populated with tenancy details
2. **Condition Report** — Standard entry/exit condition report from inspection data
3. **Breach Notice** — State-specific arrears notice with correct cure period and legislation references
4. **Rent Increase Notice** — State-compliant notice with required notice period and CPI justification
5. **Bond Claim Form** — Pre-filled with inspection comparison data and deduction amounts
6. **Inspection Report** — PDF of completed inspection with photos and ratings
7. **Financial Statement** — Monthly/annual financial summary per property

```typescript
// supabase/functions/generate-document/index.ts
// Edge function that uses a PDF library (e.g., @react-pdf/renderer server-side or pdfkit)
// to generate state-compliant documents from templates + data

interface DocumentGenerationRequest {
  type: 'lease' | 'condition_report' | 'breach_notice' | 'rent_increase' | 'bond_claim' | 'inspection_report' | 'financial_statement';
  propertyId: string;
  tenancyId?: string;
  inspectionId?: string; // For inspection reports
  params: Record<string, unknown>; // Type-specific parameters
}
```

**State-Specific Templates:**
- NSW: Residential Tenancy Agreement (standard form)
- VIC: Residential Tenancy Agreement (RTBA form)
- QLD: General Tenancy Agreement (Form 18a)
- Each template has required clauses that cannot be removed
- Optional additional terms can be added by owner

### Phase J: Lease Template System

For the lease generation to work, we need a template system:

```sql
CREATE TABLE lease_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state TEXT NOT NULL, -- 'NSW', 'VIC', 'QLD', etc.
  version TEXT NOT NULL, -- Template version
  name TEXT NOT NULL,

  -- Template content
  html_template TEXT NOT NULL, -- HTML template with {{placeholders}}
  required_fields TEXT[] NOT NULL, -- Fields that must be populated
  optional_clauses JSONB, -- Additional clauses that can be toggled

  -- Validity
  effective_from DATE NOT NULL,
  superseded_at DATE,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Populate with standard templates for each state
INSERT INTO lease_templates (state, version, name, html_template, required_fields, is_current) VALUES
('NSW', '2024.1', 'NSW Standard Residential Tenancy Agreement', '...', ARRAY['landlord_name', 'tenant_name', 'address', 'rent_amount', 'rent_frequency', 'bond_amount', 'lease_start', 'lease_end'], TRUE),
('VIC', '2024.1', 'VIC Standard Residential Tenancy Agreement', '...', ARRAY['landlord_name', 'tenant_name', 'address', 'rent_amount', 'rent_frequency', 'bond_amount', 'lease_start', 'lease_end'], TRUE),
('QLD', '2024.1', 'QLD General Tenancy Agreement (Form 18a)', '...', ARRAY['landlord_name', 'tenant_name', 'address', 'rent_amount', 'rent_frequency', 'bond_amount', 'lease_start', 'lease_end'], TRUE);
```

## Notes
- Support common formats: PDF, images, Word, Excel
- Thumbnails improve browsing experience
- OCR enables full-text search
- Consider virus scanning for uploads
- Implement file size limits (e.g., 50MB)
- Share links can be password-protected
- Access logging important for sensitive documents
- Consider integration with cloud storage (Google Drive, Dropbox)
- Auto-categorize based on file name patterns
- Document generation is critical for the agent to be truly autonomous — it must be able to create legal documents
- State-specific lease templates must be reviewed by a tenancy lawyer before launch
- PDF generation should happen server-side (Edge Function) to avoid client-side bundle bloat
- All generated documents are stored in Supabase Storage with signed URLs
- Documents should be versioned — if a lease is regenerated, the old version is archived, not deleted

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All migrations applied to remote Supabase (`documents`, `document_folders`, `document_shares`)
- [ ] RLS policies verified: owners can only access documents for their own properties
- [ ] RLS policies verified: shared documents accessible only to specified recipients
- [ ] RLS policies verified: tenants can only access documents shared with them
- [ ] Supabase Storage buckets configured with correct access policies
- [ ] Indexes created for folder, property, and category queries
- [ ] Foreign keys correct with CASCADE on folder/document relationships
- [ ] Document share expiry enforced (time-limited links)

### Feature Verification (Mission-Specific)
- [ ] Owner can upload single and multiple documents
- [ ] Documents auto-categorize by type (lease, inspection, insurance, compliance, etc.)
- [ ] Folder structure creates per-property with default folders
- [ ] Owner can create custom folders and move documents
- [ ] Tagging system works (add, remove, search by tag)
- [ ] Document search finds results by name, tag, and content
- [ ] In-app PDF viewer renders documents correctly
- [ ] Image viewer supports zoom and pan
- [ ] Owner can download documents to device
- [ ] Owner can share documents with tenants (with or without expiry)
- [ ] Time-limited share links expire correctly
- [ ] Lease templates can be stored and reused
- [ ] Document metadata displays correctly (upload date, size, type)
- [ ] Access logging tracks who viewed/downloaded documents

### Visual & UX
- [ ] Tested on physical iOS device via Expo Go
- [ ] UI matches BRAND-AND-UI.md design system
- [ ] Safe areas respected on notched devices
- [ ] Touch targets minimum 44x44px
- [ ] No layout overflow on standard screen sizes

### Regression (All Prior Missions)
- [ ] All prior mission critical paths still work (see TESTING-METHODOLOGY.md Section 4)
- [ ] Navigation between all existing screens works
- [ ] Previously created data still loads correctly
- [ ] No new TypeScript errors in existing code

### Auth & Security
- [ ] Authenticated routes redirect unauthenticated users
- [ ] User can only access their own data (RLS verified)
- [ ] Session persists across app restarts
- [ ] No sensitive data in logs or error messages
- [ ] Document storage uses signed URLs (not publicly accessible)
- [ ] Sensitive documents (ID, financials) encrypted at rest
- [ ] Share links validate recipient identity before granting access
