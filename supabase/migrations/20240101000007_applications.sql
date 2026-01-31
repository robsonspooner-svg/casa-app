-- Mission 05: Tenant Applications
-- Database migration for applications, references, documents, background checks

-- Application status enum
CREATE TYPE application_status AS ENUM (
  'draft',
  'submitted',
  'under_review',
  'shortlisted',
  'approved',
  'rejected',
  'withdrawn'
);

-- Employment type enum
CREATE TYPE employment_type AS ENUM (
  'full_time',
  'part_time',
  'casual',
  'self_employed',
  'unemployed',
  'retired',
  'student'
);

-- Applications table
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Personal details
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  date_of_birth DATE,
  current_address TEXT NOT NULL,

  -- Employment
  employment_type employment_type NOT NULL,
  employer_name TEXT,
  job_title TEXT,
  annual_income DECIMAL(10,2),
  employment_start_date DATE,

  -- Rental history
  current_landlord_name TEXT,
  current_landlord_phone TEXT,
  current_landlord_email TEXT,
  current_rent DECIMAL(10,2),
  tenancy_start_date DATE,
  reason_for_moving TEXT,
  has_pets BOOLEAN NOT NULL DEFAULT FALSE,
  pet_description TEXT,

  -- Application
  move_in_date DATE NOT NULL,
  lease_term_preference lease_term,
  additional_occupants INTEGER NOT NULL DEFAULT 0,
  occupant_details TEXT,
  additional_notes TEXT,

  -- Status
  status application_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One application per tenant per listing
  UNIQUE(listing_id, tenant_id)
);

-- Application references
CREATE TABLE application_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('personal', 'professional', 'landlord')),
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  contacted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Application documents
CREATE TABLE application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'id_primary',
    'id_secondary',
    'proof_of_income',
    'rental_ledger',
    'bank_statement',
    'employment_letter',
    'other'
  )),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Background check results
CREATE TABLE background_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL CHECK (check_type IN ('credit', 'identity', 'tenancy')),
  provider TEXT NOT NULL,

  -- Consent
  consent_given_at TIMESTAMPTZ NOT NULL,
  consent_token TEXT NOT NULL,

  -- Result
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  result_encrypted BYTEA,
  summary_score INTEGER,
  summary_risk_level TEXT CHECK (summary_risk_level IN ('low', 'medium', 'high')),
  report_url TEXT,

  -- Metadata
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  error_message TEXT
);

-- Background check consents
CREATE TABLE background_check_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),

  -- Consent details
  equifax_consent BOOLEAN NOT NULL DEFAULT FALSE,
  tica_consent BOOLEAN NOT NULL DEFAULT FALSE,
  consent_text_version TEXT NOT NULL,

  -- Digital signature
  signature_data TEXT,
  ip_address INET NOT NULL,
  user_agent TEXT NOT NULL,

  -- Timestamps
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_applications_listing ON applications(listing_id);
CREATE INDEX idx_applications_tenant ON applications(tenant_id);
CREATE INDEX idx_applications_status ON applications(listing_id, status);
CREATE INDEX idx_application_refs ON application_references(application_id);
CREATE INDEX idx_application_docs ON application_documents(application_id);
CREATE INDEX idx_background_checks_application ON background_checks(application_id);

-- RLS Policies
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_check_consents ENABLE ROW LEVEL SECURITY;

-- Tenants can manage own applications
CREATE POLICY "Tenants can CRUD own applications"
  ON applications FOR ALL
  USING (auth.uid() = tenant_id);

-- Owners can view applications for their listings
CREATE POLICY "Owners can view applications for their listings"
  ON applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = applications.listing_id
      AND listings.owner_id = auth.uid()
    )
  );

-- Owners can update status
CREATE POLICY "Owners can update application status"
  ON applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = applications.listing_id
      AND listings.owner_id = auth.uid()
    )
  );

-- References follow application permissions
CREATE POLICY "Tenants can CRUD own application references"
  ON application_references FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = application_references.application_id
      AND applications.tenant_id = auth.uid()
    )
  );

CREATE POLICY "Owners can view application references"
  ON application_references FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM applications
      JOIN listings ON listings.id = applications.listing_id
      WHERE applications.id = application_references.application_id
      AND listings.owner_id = auth.uid()
    )
  );

-- Documents follow same pattern
CREATE POLICY "Tenants can CRUD own application documents"
  ON application_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = application_documents.application_id
      AND applications.tenant_id = auth.uid()
    )
  );

CREATE POLICY "Owners can view application documents"
  ON application_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM applications
      JOIN listings ON listings.id = applications.listing_id
      WHERE applications.id = application_documents.application_id
      AND listings.owner_id = auth.uid()
    )
  );

-- Background checks: owners can view for their listings' applications
CREATE POLICY "Owners can view background checks"
  ON background_checks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM applications
      JOIN listings ON listings.id = applications.listing_id
      WHERE applications.id = background_checks.application_id
      AND listings.owner_id = auth.uid()
    )
  );

-- Tenants can view own background checks
CREATE POLICY "Tenants can view own background checks"
  ON background_checks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = background_checks.application_id
      AND applications.tenant_id = auth.uid()
    )
  );

-- Consents: tenants can manage own
CREATE POLICY "Tenants can manage own consents"
  ON background_check_consents FOR ALL
  USING (auth.uid() = tenant_id);

-- Owners can view consents for their listings
CREATE POLICY "Owners can view consents"
  ON background_check_consents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM applications
      JOIN listings ON listings.id = applications.listing_id
      WHERE applications.id = background_check_consents.application_id
      AND listings.owner_id = auth.uid()
    )
  );

-- Trigger to update listing application count
CREATE OR REPLACE FUNCTION update_application_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'submitted' THEN
    UPDATE listings SET application_count = application_count + 1
    WHERE id = NEW.listing_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'submitted' AND NEW.status = 'submitted' THEN
      UPDATE listings SET application_count = application_count + 1
      WHERE id = NEW.listing_id;
    ELSIF OLD.status = 'submitted' AND NEW.status != 'submitted' THEN
      UPDATE listings SET application_count = GREATEST(application_count - 1, 0)
      WHERE id = NEW.listing_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'submitted' THEN
    UPDATE listings SET application_count = GREATEST(application_count - 1, 0)
    WHERE id = OLD.listing_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER applications_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_application_count();

-- Updated_at trigger
CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Storage bucket for application documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('application-documents', 'application-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: tenants can upload to their own folder
CREATE POLICY "Tenants can upload application documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'application-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Tenants can read own documents
CREATE POLICY "Tenants can read own application documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners can read documents for applications on their listings
CREATE POLICY "Owners can read application documents for their listings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-documents'
    AND EXISTS (
      SELECT 1 FROM application_documents ad
      JOIN applications a ON a.id = ad.application_id
      JOIN listings l ON l.id = a.listing_id
      WHERE ad.storage_path = name
      AND l.owner_id = auth.uid()
    )
  );

-- Tenants can delete own documents
CREATE POLICY "Tenants can delete own application documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'application-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
