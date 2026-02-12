-- Mission 11 Phase M: Authority Submission Tracking & Proof of Service
-- Tracks submissions to state authorities (bond lodgement, tribunal applications, etc.)
-- and records proof of service for legal notices.

-- ============================================================
-- 1. Authority Submissions
-- ============================================================
CREATE TABLE IF NOT EXISTS authority_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,

  -- What's being submitted
  submission_type TEXT NOT NULL CHECK (submission_type IN (
    'bond_lodgement', 'bond_claim', 'bond_refund',
    'condition_report', 'notice_to_vacate', 'breach_notice',
    'rent_increase_notice', 'entry_notice',
    'tribunal_application', 'tribunal_response',
    'compliance_certificate', 'insurance_claim',
    'other'
  )),
  authority_name TEXT NOT NULL, -- e.g. 'RTA QLD', 'NSW Fair Trading', 'VCAT', 'NCAT'
  authority_state TEXT NOT NULL CHECK (authority_state IN ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT')),

  -- How it was submitted
  submission_method TEXT NOT NULL CHECK (submission_method IN ('api', 'email', 'post', 'online_portal', 'in_person')),

  -- Tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'submitted', 'acknowledged', 'processed', 'rejected', 'requires_action'
  )),
  reference_number TEXT,
  submitted_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,

  -- Proof of service
  proof_type TEXT CHECK (proof_type IN (
    'email_receipt', 'registered_post_tracking', 'portal_confirmation',
    'statutory_declaration', 'hand_delivery_witness', 'court_filing_stamp'
  )),
  proof_url TEXT,
  tracking_number TEXT, -- for registered post

  -- Response from authority
  authority_response TEXT,
  response_received_at TIMESTAMPTZ,

  -- Linked tenancy (optional)
  tenancy_id UUID REFERENCES tenancies(id) ON DELETE SET NULL,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Add legislation references to compliance_requirements
-- ============================================================
ALTER TABLE compliance_requirements ADD COLUMN IF NOT EXISTS legislation_section TEXT;
ALTER TABLE compliance_requirements ADD COLUMN IF NOT EXISTS prescribed_form_number TEXT;
ALTER TABLE compliance_requirements ADD COLUMN IF NOT EXISTS authority_name TEXT;
ALTER TABLE compliance_requirements ADD COLUMN IF NOT EXISTS submission_url TEXT;

-- ============================================================
-- 3. RLS Policies
-- ============================================================
ALTER TABLE authority_submissions ENABLE ROW LEVEL SECURITY;

-- Owner can read/manage their own submissions
CREATE POLICY "authority_submissions_owner_select" ON authority_submissions
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "authority_submissions_owner_insert" ON authority_submissions
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "authority_submissions_owner_update" ON authority_submissions
  FOR UPDATE USING (owner_id = auth.uid());

-- Service role full access
CREATE POLICY "authority_submissions_service_role" ON authority_submissions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_authority_submissions_owner ON authority_submissions(owner_id);
CREATE INDEX IF NOT EXISTS idx_authority_submissions_property ON authority_submissions(property_id);
CREATE INDEX IF NOT EXISTS idx_authority_submissions_status ON authority_submissions(status);
CREATE INDEX IF NOT EXISTS idx_authority_submissions_type ON authority_submissions(submission_type);
CREATE INDEX IF NOT EXISTS idx_authority_submissions_state ON authority_submissions(authority_state);

-- ============================================================
-- 5. Updated_at trigger
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_authority_submissions_updated_at') THEN
    CREATE TRIGGER update_authority_submissions_updated_at
      BEFORE UPDATE ON authority_submissions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- 6. Update seeded compliance requirements with legislation refs
-- ============================================================
-- NSW
UPDATE compliance_requirements SET
  legislation_section = 'Residential Tenancies Act 2010, s 64',
  authority_name = 'NSW Fair Trading',
  submission_url = 'https://www.fairtrading.nsw.gov.au'
WHERE state = 'NSW' AND category = 'smoke_alarm';

UPDATE compliance_requirements SET
  legislation_section = 'Swimming Pools Act 1992, s 22C',
  prescribed_form_number = 'Swimming Pool Register',
  authority_name = 'NSW Fair Trading',
  submission_url = 'https://www.swimmingpoolregister.nsw.gov.au'
WHERE state = 'NSW' AND category = 'pool_safety';

UPDATE compliance_requirements SET
  legislation_section = 'Residential Tenancies Act 2010, s 52(1)',
  authority_name = 'NSW Fair Trading'
WHERE state = 'NSW' AND category = 'building_insurance';

UPDATE compliance_requirements SET
  legislation_section = 'Residential Tenancies Regulation 2019, cl 18',
  authority_name = 'NSW Fair Trading'
WHERE state = 'NSW' AND category = 'blind_cord';

UPDATE compliance_requirements SET
  legislation_section = 'Residential Tenancies Regulation 2019, Schedule 3',
  authority_name = 'NSW Fair Trading'
WHERE state = 'NSW' AND category = 'energy_rating';

UPDATE compliance_requirements SET
  legislation_section = 'Work Health and Safety Regulation 2017, cl 422',
  authority_name = 'SafeWork NSW'
WHERE state = 'NSW' AND category = 'asbestos_register';

-- VIC
UPDATE compliance_requirements SET
  legislation_section = 'Residential Tenancies Act 1997, s 68',
  authority_name = 'Consumer Affairs Victoria',
  submission_url = 'https://www.consumer.vic.gov.au'
WHERE state = 'VIC' AND category = 'smoke_alarm';

UPDATE compliance_requirements SET
  legislation_section = 'Building Regulations 2018, Part 9',
  prescribed_form_number = 'Pool Barrier Certificate',
  authority_name = 'Victorian Building Authority',
  submission_url = 'https://www.vba.vic.gov.au'
WHERE state = 'VIC' AND category = 'pool_safety';

UPDATE compliance_requirements SET
  legislation_section = 'Gas Safety Act 1997, s 75',
  prescribed_form_number = 'Type A Gas Appliance Safety Check',
  authority_name = 'Energy Safe Victoria',
  submission_url = 'https://www.esv.vic.gov.au'
WHERE state = 'VIC' AND category = 'gas_safety';

UPDATE compliance_requirements SET
  legislation_section = 'Residential Tenancies Act 1997, s 68A',
  authority_name = 'Consumer Affairs Victoria'
WHERE state = 'VIC' AND category = 'blind_cord';

UPDATE compliance_requirements SET
  legislation_section = 'Residential Tenancies Act 1997, s 27A',
  authority_name = 'Consumer Affairs Victoria'
WHERE state = 'VIC' AND category = 'building_insurance';

UPDATE compliance_requirements SET
  legislation_section = 'Residential Tenancies Act 1997, s 27C',
  authority_name = 'Consumer Affairs Victoria'
WHERE state = 'VIC' AND category = 'energy_rating';

UPDATE compliance_requirements SET
  legislation_section = 'Occupational Health and Safety Regulations 2017, r 4.3.3',
  authority_name = 'WorkSafe Victoria'
WHERE state = 'VIC' AND category = 'asbestos_register';

-- QLD
UPDATE compliance_requirements SET
  legislation_section = 'Fire and Emergency Services Act 1990, s 104RA',
  prescribed_form_number = 'Form 24c',
  authority_name = 'Queensland Fire and Emergency Services',
  submission_url = 'https://www.qfes.qld.gov.au'
WHERE state = 'QLD' AND category = 'smoke_alarm';

UPDATE compliance_requirements SET
  legislation_section = 'Building Act 1975, s 231B',
  prescribed_form_number = 'Pool Safety Certificate',
  authority_name = 'QBCC',
  submission_url = 'https://www.qbcc.qld.gov.au'
WHERE state = 'QLD' AND category = 'pool_safety';

UPDATE compliance_requirements SET
  legislation_section = 'Electrical Safety Act 2002, s 56',
  authority_name = 'Electrical Safety Office Queensland',
  submission_url = 'https://www.worksafe.qld.gov.au/electrical-safety'
WHERE state = 'QLD' AND category = 'electrical_safety';

UPDATE compliance_requirements SET
  legislation_section = 'Residential Tenancies and Rooming Accommodation Act 2008, s 196',
  authority_name = 'RTA Queensland',
  submission_url = 'https://www.rta.qld.gov.au'
WHERE state = 'QLD' AND category = 'blind_cord';

UPDATE compliance_requirements SET
  legislation_section = 'Residential Tenancies and Rooming Accommodation Act 2008, s 211',
  authority_name = 'RTA Queensland'
WHERE state = 'QLD' AND category = 'building_insurance';

-- SA
UPDATE compliance_requirements SET
  legislation_section = 'South Australian Housing Safety Authority Guidelines',
  authority_name = 'Consumer and Business Services SA',
  submission_url = 'https://www.cbs.sa.gov.au'
WHERE state = 'SA' AND category = 'smoke_alarm';

UPDATE compliance_requirements SET
  legislation_section = 'Development Act 1993, Schedule 1A',
  prescribed_form_number = 'Pool Safety Inspection Report',
  authority_name = 'SA Planning Portal'
WHERE state = 'SA' AND category = 'pool_safety';

UPDATE compliance_requirements SET
  legislation_section = 'Residential Tenancies Act 1995, s 67',
  authority_name = 'Consumer and Business Services SA'
WHERE state = 'SA' AND category = 'building_insurance';

-- WA
UPDATE compliance_requirements SET
  legislation_section = 'Building Regulations 2012, r 55',
  authority_name = 'Department of Mines, Industry Regulation and Safety WA',
  submission_url = 'https://www.commerce.wa.gov.au'
WHERE state = 'WA' AND category = 'smoke_alarm';

UPDATE compliance_requirements SET
  legislation_section = 'Building Act 2011, s 108',
  prescribed_form_number = 'Pool Barrier Compliance Certificate',
  authority_name = 'WA Building Commission'
WHERE state = 'WA' AND category = 'pool_safety';

UPDATE compliance_requirements SET
  legislation_section = 'Residential Tenancies Act 1987, s 42(1)',
  authority_name = 'Department of Commerce WA'
WHERE state = 'WA' AND category = 'building_insurance';

-- TAS
UPDATE compliance_requirements SET
  legislation_section = 'Building Regulations 2014, r 75',
  authority_name = 'Consumer, Building and Occupational Services TAS',
  submission_url = 'https://www.cbos.tas.gov.au'
WHERE state = 'TAS' AND category = 'smoke_alarm';

UPDATE compliance_requirements SET
  legislation_section = 'Building Act 2016, s 237',
  prescribed_form_number = 'Pool Barrier Compliance Certificate',
  authority_name = 'Director of Building Control TAS'
WHERE state = 'TAS' AND category = 'pool_safety';

UPDATE compliance_requirements SET
  legislation_section = 'Residential Tenancy Act 1997, s 36',
  authority_name = 'Consumer, Building and Occupational Services TAS'
WHERE state = 'TAS' AND category = 'building_insurance';
