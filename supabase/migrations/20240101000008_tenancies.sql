-- Mission 06: Tenancies & Leases
-- Database migration for tenancies, tenancy tenants, documents, rent increases, bonds

-- Tenancy status enum
CREATE TYPE tenancy_status AS ENUM (
  'pending',
  'active',
  'ending',
  'ended',
  'terminated'
);

-- Bond status enum
CREATE TYPE bond_status AS ENUM (
  'pending',
  'lodged',
  'claimed',
  'returned',
  'partial'
);

-- Tenancies table
CREATE TABLE tenancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,

  -- Lease details
  lease_start_date DATE NOT NULL,
  lease_end_date DATE NOT NULL,
  lease_type lease_term NOT NULL,
  is_periodic BOOLEAN NOT NULL DEFAULT FALSE,

  -- Rent
  rent_amount DECIMAL(10,2) NOT NULL,
  rent_frequency payment_frequency NOT NULL,
  rent_due_day INTEGER NOT NULL DEFAULT 1,

  -- Bond
  bond_amount DECIMAL(10,2) NOT NULL,
  bond_lodgement_number TEXT,
  bond_status bond_status NOT NULL DEFAULT 'pending',
  bond_lodged_date DATE,

  -- Status
  status tenancy_status NOT NULL DEFAULT 'pending',
  notice_given_date DATE,
  notice_period_days INTEGER DEFAULT 14,
  actual_end_date DATE,
  end_reason TEXT,

  -- Documents
  lease_document_url TEXT,
  lease_signed_at TIMESTAMPTZ,

  -- DocuSign integration
  docusign_envelope_id TEXT,
  docusign_status TEXT DEFAULT 'not_sent',
  lease_sent_at TIMESTAMPTZ,
  all_signed_at TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Multiple tenants per tenancy
CREATE TABLE tenancy_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_leaseholder BOOLEAN NOT NULL DEFAULT TRUE,
  moved_in_date DATE,
  moved_out_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenancy_id, tenant_id)
);

-- Tenancy documents
CREATE TABLE tenancy_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'lease',
    'condition_report_entry',
    'condition_report_exit',
    'notice_to_vacate',
    'notice_to_leave',
    'bond_lodgement',
    'bond_claim',
    'rent_increase_notice',
    'other'
  )),
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rent increase tracking
CREATE TABLE rent_increases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,

  -- Amounts
  current_amount DECIMAL(10,2) NOT NULL,
  new_amount DECIMAL(10,2) NOT NULL,
  increase_percentage DECIMAL(5,2),

  -- Dates
  notice_date DATE NOT NULL,
  effective_date DATE NOT NULL,
  minimum_notice_days INTEGER NOT NULL,

  -- Notice
  notice_document_url TEXT,
  notice_sent_at TIMESTAMPTZ,
  notice_method TEXT,

  -- Tenant response
  tenant_acknowledged_at TIMESTAMPTZ,
  tenant_disputed BOOLEAN DEFAULT FALSE,
  tenant_dispute_reason TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'notice_sent', 'acknowledged', 'disputed', 'applied', 'cancelled'
  )),

  -- Justification
  justification TEXT,
  cpi_rate DECIMAL(5,2),
  comparable_rents JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bond lodgements (state authority tracking)
CREATE TABLE bond_lodgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE RESTRICT,

  -- Bond authority details
  state TEXT NOT NULL CHECK (state IN ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT')),
  bond_number TEXT UNIQUE,
  lodgement_reference TEXT,

  -- Amounts
  amount DECIMAL(10,2) NOT NULL,
  lodgement_fee DECIMAL(10,2),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'lodged', 'active', 'claim_pending', 'claimed', 'refunded', 'disputed'
  )),

  -- Payment
  payment_method TEXT,
  payment_reference TEXT,
  payment_date DATE,

  -- Receipt
  receipt_url TEXT,
  receipt_number TEXT,

  -- Timestamps
  lodged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bond claims
CREATE TABLE bond_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bond_lodgement_id UUID NOT NULL REFERENCES bond_lodgements(id),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id),

  -- Claim details
  claim_type TEXT NOT NULL CHECK (claim_type IN ('full_tenant', 'full_landlord', 'partial', 'disputed')),
  tenant_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  landlord_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  reason TEXT,

  -- Consent tracking
  tenant_consent_at TIMESTAMPTZ,
  landlord_consent_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending_consent' CHECK (status IN (
    'pending_consent', 'submitted', 'approved', 'disputed', 'paid'
  )),

  -- Dispute
  dispute_lodged_at TIMESTAMPTZ,
  dispute_reference TEXT,
  tribunal_date DATE,

  -- Payment
  payment_date DATE,
  payment_reference TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lease signing events (audit trail)
CREATE TABLE lease_signing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  envelope_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  signer_email TEXT,
  signer_name TEXT,
  signer_role TEXT,
  ip_address INET,
  event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Indexes
CREATE INDEX idx_tenancies_property ON tenancies(property_id);
CREATE INDEX idx_tenancies_status ON tenancies(status) WHERE status IN ('active', 'ending');
CREATE INDEX idx_tenancies_dates ON tenancies(lease_end_date) WHERE status = 'active';
CREATE INDEX idx_tenancy_tenants_tenant ON tenancy_tenants(tenant_id);
CREATE INDEX idx_tenancy_tenants_tenancy ON tenancy_tenants(tenancy_id);
CREATE INDEX idx_tenancy_documents ON tenancy_documents(tenancy_id);
CREATE INDEX idx_rent_increases_tenancy ON rent_increases(tenancy_id);
CREATE INDEX idx_rent_increases_effective ON rent_increases(effective_date) WHERE status = 'notice_sent';
CREATE INDEX idx_bond_lodgements_tenancy ON bond_lodgements(tenancy_id);
CREATE INDEX idx_bond_claims_lodgement ON bond_claims(bond_lodgement_id);
CREATE INDEX idx_lease_signing_events_tenancy ON lease_signing_events(tenancy_id);

-- RLS Policies
ALTER TABLE tenancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancy_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_increases ENABLE ROW LEVEL SECURITY;
ALTER TABLE bond_lodgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bond_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_signing_events ENABLE ROW LEVEL SECURITY;

-- Owners can CRUD tenancies for their properties
CREATE POLICY "Owners can CRUD own tenancies"
  ON tenancies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = tenancies.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Tenants can view their tenancies
CREATE POLICY "Tenants can view own tenancies"
  ON tenancies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants
      WHERE tenancy_tenants.tenancy_id = tenancies.id
      AND tenancy_tenants.tenant_id = auth.uid()
    )
  );

-- Owners can manage tenancy tenants
CREATE POLICY "Owners can manage tenancy tenants"
  ON tenancy_tenants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = tenancy_tenants.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Tenants can view co-tenants
CREATE POLICY "Tenants can view co-tenants"
  ON tenancy_tenants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants AS tt
      WHERE tt.tenancy_id = tenancy_tenants.tenancy_id
      AND tt.tenant_id = auth.uid()
    )
  );

-- Owners can manage tenancy documents
CREATE POLICY "Owners can manage tenancy documents"
  ON tenancy_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = tenancy_documents.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Tenants can view tenancy documents
CREATE POLICY "Tenants can view tenancy documents"
  ON tenancy_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants
      WHERE tenancy_tenants.tenancy_id = tenancy_documents.tenancy_id
      AND tenancy_tenants.tenant_id = auth.uid()
    )
  );

-- Owners can manage rent increases
CREATE POLICY "Owners can manage rent increases"
  ON rent_increases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = rent_increases.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Tenants can view rent increases
CREATE POLICY "Tenants can view rent increases"
  ON rent_increases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants
      WHERE tenancy_tenants.tenancy_id = rent_increases.tenancy_id
      AND tenancy_tenants.tenant_id = auth.uid()
    )
  );

-- Owners can manage bond lodgements
CREATE POLICY "Owners can manage bond lodgements"
  ON bond_lodgements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = bond_lodgements.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Tenants can view bond lodgements
CREATE POLICY "Tenants can view bond lodgements"
  ON bond_lodgements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants
      WHERE tenancy_tenants.tenancy_id = bond_lodgements.tenancy_id
      AND tenancy_tenants.tenant_id = auth.uid()
    )
  );

-- Owners can manage bond claims
CREATE POLICY "Owners can manage bond claims"
  ON bond_claims FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = bond_claims.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Tenants can view bond claims
CREATE POLICY "Tenants can view bond claims"
  ON bond_claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants
      WHERE tenancy_tenants.tenancy_id = bond_claims.tenancy_id
      AND tenancy_tenants.tenant_id = auth.uid()
    )
  );

-- Owners can view signing events
CREATE POLICY "Owners can view signing events"
  ON lease_signing_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = lease_signing_events.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Tenants can view signing events
CREATE POLICY "Tenants can view signing events"
  ON lease_signing_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants
      WHERE tenancy_tenants.tenancy_id = lease_signing_events.tenancy_id
      AND tenancy_tenants.tenant_id = auth.uid()
    )
  );

-- Trigger: Update property status when tenancy changes
CREATE OR REPLACE FUNCTION update_property_status_on_tenancy()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE properties SET status = 'occupied' WHERE id = NEW.property_id;
  ELSIF NEW.status IN ('ended', 'terminated') THEN
    UPDATE properties SET status = 'vacant' WHERE id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tenancy_status_change
  AFTER UPDATE OF status ON tenancies
  FOR EACH ROW EXECUTE FUNCTION update_property_status_on_tenancy();

CREATE TRIGGER tenancy_created
  AFTER INSERT ON tenancies
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION update_property_status_on_tenancy();

-- Trigger: updated_at on tenancies
CREATE TRIGGER tenancies_updated_at
  BEFORE UPDATE ON tenancies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: updated_at on rent_increases
CREATE TRIGGER rent_increases_updated_at
  BEFORE UPDATE ON rent_increases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: updated_at on bond_lodgements
CREATE TRIGGER bond_lodgements_updated_at
  BEFORE UPDATE ON bond_lodgements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: updated_at on bond_claims
CREATE TRIGGER bond_claims_updated_at
  BEFORE UPDATE ON bond_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Storage bucket for tenancy documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenancy-documents', 'tenancy-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for tenancy documents
CREATE POLICY "Owners can upload tenancy documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tenancy-documents'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Authenticated users can view tenancy documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'tenancy-documents'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Owners can delete tenancy documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'tenancy-documents'
    AND auth.uid() IS NOT NULL
  );
