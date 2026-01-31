-- Mission 08: Arrears & Late Payment Management
-- Casa - Automated arrears detection, reminders, and payment plans

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Arrears severity levels based on days overdue
CREATE TYPE arrears_severity AS ENUM (
  'minor',      -- 1-7 days
  'moderate',   -- 8-14 days
  'serious',    -- 15-28 days
  'critical'    -- 29+ days
);

-- Types of actions/communications logged against an arrears record
CREATE TYPE arrears_action_type AS ENUM (
  'reminder_email',
  'reminder_sms',
  'phone_call',
  'letter_sent',
  'breach_notice',
  'payment_plan_created',
  'payment_plan_updated',
  'payment_received',
  'tribunal_application',
  'note'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Arrears records - one active record per tenancy in arrears
CREATE TABLE arrears_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Arrears details
  first_overdue_date DATE NOT NULL,
  total_overdue DECIMAL(10,2) NOT NULL,
  days_overdue INTEGER NOT NULL,
  severity arrears_severity NOT NULL DEFAULT 'minor',

  -- Payment plan reference (set when plan created)
  has_payment_plan BOOLEAN NOT NULL DEFAULT FALSE,
  payment_plan_id UUID, -- FK added after payment_plans table created

  -- Status
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One active arrears record per tenancy (resolved ones don't count)
  CONSTRAINT unique_active_arrears_per_tenancy UNIQUE (tenancy_id)
);

-- Payment plans for tenants in arrears
CREATE TABLE payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arrears_record_id UUID NOT NULL REFERENCES arrears_records(id) ON DELETE CASCADE,
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,

  -- Plan details
  total_arrears DECIMAL(10,2) NOT NULL,
  installment_amount DECIMAL(10,2) NOT NULL,
  installment_frequency payment_frequency NOT NULL,
  start_date DATE NOT NULL,
  expected_end_date DATE NOT NULL,

  -- Progress tracking
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  installments_paid INTEGER NOT NULL DEFAULT 0,
  total_installments INTEGER NOT NULL,
  next_due_date DATE,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from arrears_records to payment_plans
ALTER TABLE arrears_records
ADD CONSTRAINT fk_arrears_payment_plan
FOREIGN KEY (payment_plan_id) REFERENCES payment_plans(id) ON DELETE SET NULL;

-- Individual installments within a payment plan
CREATE TABLE payment_plan_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_plan_id UUID NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,

  -- Installment details
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,

  -- Status
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  payment_id UUID REFERENCES payments(id),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(payment_plan_id, installment_number)
);

-- Communication and action log for arrears
CREATE TABLE arrears_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arrears_record_id UUID NOT NULL REFERENCES arrears_records(id) ON DELETE CASCADE,
  action_type arrears_action_type NOT NULL,

  -- Action details
  description TEXT NOT NULL,
  template_used TEXT,

  -- Communication details (for emails/sms)
  sent_to TEXT,
  sent_at TIMESTAMPTZ,
  delivered BOOLEAN,
  opened BOOLEAN,

  -- Actor (NULL for automated actions)
  performed_by UUID REFERENCES profiles(id),
  is_automated BOOLEAN NOT NULL DEFAULT FALSE,

  -- Additional data
  metadata JSONB,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reminder templates - system defaults and owner customizations
CREATE TABLE reminder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- NULL for system defaults

  -- Template identification
  name TEXT NOT NULL,
  days_overdue INTEGER NOT NULL, -- Trigger threshold
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'both')),

  -- Content
  subject TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Settings
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_breach_notice BOOLEAN NOT NULL DEFAULT FALSE,

  -- State compliance (for breach notices)
  applicable_states TEXT[], -- NULL means all states

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Arrears records - find active arrears by severity
CREATE INDEX idx_arrears_records_active ON arrears_records(severity, days_overdue)
  WHERE NOT is_resolved;

-- Arrears records - find by tenancy
CREATE INDEX idx_arrears_records_tenancy ON arrears_records(tenancy_id)
  WHERE NOT is_resolved;

-- Arrears records - find by tenant
CREATE INDEX idx_arrears_records_tenant ON arrears_records(tenant_id)
  WHERE NOT is_resolved;

-- Arrears actions - timeline queries
CREATE INDEX idx_arrears_actions_record ON arrears_actions(arrears_record_id, created_at DESC);

-- Payment plans - find active plans
CREATE INDEX idx_payment_plans_active ON payment_plans(tenancy_id)
  WHERE status = 'active';

-- Payment plans - find by arrears record
CREATE INDEX idx_payment_plans_arrears ON payment_plans(arrears_record_id);

-- Payment plan installments - find upcoming
CREATE INDEX idx_plan_installments_upcoming ON payment_plan_installments(payment_plan_id, due_date)
  WHERE NOT is_paid;

-- Reminder templates - find active by owner
CREATE INDEX idx_reminder_templates_owner ON reminder_templates(owner_id, days_overdue)
  WHERE is_active;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE arrears_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE arrears_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_templates ENABLE ROW LEVEL SECURITY;

-- Arrears records: Owners can view for their properties
CREATE POLICY "Owners can view arrears for their properties"
  ON arrears_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = arrears_records.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Arrears records: Tenants can view their own
CREATE POLICY "Tenants can view own arrears"
  ON arrears_records FOR SELECT
  USING (auth.uid() = tenant_id);

-- Payment plans: Owners can manage for their properties
CREATE POLICY "Owners can view payment plans for their properties"
  ON payment_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = payment_plans.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can create payment plans for their properties"
  ON payment_plans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = payment_plans.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update payment plans for their properties"
  ON payment_plans FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tenancies
      JOIN properties ON properties.id = tenancies.property_id
      WHERE tenancies.id = payment_plans.tenancy_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Payment plans: Tenants can view their own
CREATE POLICY "Tenants can view own payment plans"
  ON payment_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants
      WHERE tenancy_tenants.tenancy_id = payment_plans.tenancy_id
      AND tenancy_tenants.tenant_id = auth.uid()
    )
  );

-- Payment plan installments: Same access as payment plans
CREATE POLICY "Owners can view installments for their properties"
  ON payment_plan_installments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payment_plans
      JOIN tenancies ON tenancies.id = payment_plans.tenancy_id
      JOIN properties ON properties.id = tenancies.property_id
      WHERE payment_plans.id = payment_plan_installments.payment_plan_id
      AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can view own installments"
  ON payment_plan_installments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payment_plans
      JOIN tenancy_tenants ON tenancy_tenants.tenancy_id = payment_plans.tenancy_id
      WHERE payment_plans.id = payment_plan_installments.payment_plan_id
      AND tenancy_tenants.tenant_id = auth.uid()
    )
  );

-- Arrears actions: Owners can view and create for their properties
CREATE POLICY "Owners can view arrears actions for their properties"
  ON arrears_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM arrears_records
      JOIN tenancies ON tenancies.id = arrears_records.tenancy_id
      JOIN properties ON properties.id = tenancies.property_id
      WHERE arrears_records.id = arrears_actions.arrears_record_id
      AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can create arrears actions for their properties"
  ON arrears_actions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM arrears_records
      JOIN tenancies ON tenancies.id = arrears_records.tenancy_id
      JOIN properties ON properties.id = tenancies.property_id
      WHERE arrears_records.id = arrears_actions.arrears_record_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Arrears actions: Tenants can view their own
CREATE POLICY "Tenants can view own arrears actions"
  ON arrears_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM arrears_records
      WHERE arrears_records.id = arrears_actions.arrears_record_id
      AND arrears_records.tenant_id = auth.uid()
    )
  );

-- Reminder templates: Users can view system defaults + their own
CREATE POLICY "Users can view system and own templates"
  ON reminder_templates FOR SELECT
  USING (owner_id IS NULL OR owner_id = auth.uid());

-- Reminder templates: Owners can manage their own
CREATE POLICY "Owners can create own templates"
  ON reminder_templates FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update own templates"
  ON reminder_templates FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete own templates"
  ON reminder_templates FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to calculate severity based on days overdue
CREATE OR REPLACE FUNCTION calculate_arrears_severity(p_days_overdue INTEGER)
RETURNS arrears_severity AS $$
BEGIN
  RETURN CASE
    WHEN p_days_overdue <= 7 THEN 'minor'::arrears_severity
    WHEN p_days_overdue <= 14 THEN 'moderate'::arrears_severity
    WHEN p_days_overdue <= 28 THEN 'serious'::arrears_severity
    ELSE 'critical'::arrears_severity
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function to auto-update severity when days_overdue changes
CREATE OR REPLACE FUNCTION update_arrears_severity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.severity := calculate_arrears_severity(NEW.days_overdue);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER arrears_severity_trigger
  BEFORE INSERT OR UPDATE OF days_overdue ON arrears_records
  FOR EACH ROW EXECUTE FUNCTION update_arrears_severity();

-- Trigger for updated_at timestamps
CREATE TRIGGER arrears_records_updated_at
  BEFORE UPDATE ON arrears_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER payment_plans_updated_at
  BEFORE UPDATE ON payment_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER reminder_templates_updated_at
  BEFORE UPDATE ON reminder_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to generate payment plan installments
CREATE OR REPLACE FUNCTION generate_payment_plan_installments(
  p_plan_id UUID,
  p_total_amount DECIMAL,
  p_installment_amount DECIMAL,
  p_frequency payment_frequency,
  p_start_date DATE
)
RETURNS VOID AS $$
DECLARE
  v_current_date DATE := p_start_date;
  v_remaining DECIMAL := p_total_amount;
  v_installment_num INTEGER := 1;
  v_interval INTERVAL;
BEGIN
  -- Determine interval based on frequency
  v_interval := CASE p_frequency
    WHEN 'weekly' THEN INTERVAL '1 week'
    WHEN 'fortnightly' THEN INTERVAL '2 weeks'
    WHEN 'monthly' THEN INTERVAL '1 month'
    ELSE INTERVAL '1 week'
  END;

  -- Generate installments until total is covered
  WHILE v_remaining > 0 LOOP
    INSERT INTO payment_plan_installments (
      payment_plan_id,
      installment_number,
      due_date,
      amount
    ) VALUES (
      p_plan_id,
      v_installment_num,
      v_current_date,
      LEAST(p_installment_amount, v_remaining)
    );

    v_remaining := v_remaining - p_installment_amount;
    v_current_date := v_current_date + v_interval;
    v_installment_num := v_installment_num + 1;
  END LOOP;

  -- Update payment plan with total installments and next due date
  UPDATE payment_plans
  SET
    total_installments = v_installment_num - 1,
    next_due_date = p_start_date,
    expected_end_date = v_current_date - v_interval
  WHERE id = p_plan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process a payment against arrears
CREATE OR REPLACE FUNCTION process_arrears_payment(
  p_arrears_id UUID,
  p_amount DECIMAL,
  p_payment_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_arrears arrears_records%ROWTYPE;
  v_plan payment_plans%ROWTYPE;
  v_installment payment_plan_installments%ROWTYPE;
  v_remaining DECIMAL := p_amount;
BEGIN
  -- Get the arrears record
  SELECT * INTO v_arrears FROM arrears_records WHERE id = p_arrears_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Arrears record not found';
  END IF;

  -- Update total overdue
  UPDATE arrears_records
  SET
    total_overdue = GREATEST(0, total_overdue - p_amount),
    updated_at = NOW()
  WHERE id = p_arrears_id;

  -- If there's a payment plan, mark installments as paid
  IF v_arrears.has_payment_plan AND v_arrears.payment_plan_id IS NOT NULL THEN
    -- Mark unpaid installments as paid (oldest first)
    FOR v_installment IN
      SELECT * FROM payment_plan_installments
      WHERE payment_plan_id = v_arrears.payment_plan_id
      AND NOT is_paid
      ORDER BY due_date ASC
    LOOP
      IF v_remaining >= v_installment.amount THEN
        UPDATE payment_plan_installments
        SET is_paid = TRUE, paid_at = NOW(), payment_id = p_payment_id
        WHERE id = v_installment.id;

        v_remaining := v_remaining - v_installment.amount;

        -- Update plan progress
        UPDATE payment_plans
        SET
          amount_paid = amount_paid + v_installment.amount,
          installments_paid = installments_paid + 1,
          next_due_date = (
            SELECT MIN(due_date) FROM payment_plan_installments
            WHERE payment_plan_id = v_arrears.payment_plan_id AND NOT is_paid
          )
        WHERE id = v_arrears.payment_plan_id;
      ELSE
        EXIT;
      END IF;
    END LOOP;

    -- Check if plan is completed
    UPDATE payment_plans
    SET status = 'completed'
    WHERE id = v_arrears.payment_plan_id
    AND NOT EXISTS (
      SELECT 1 FROM payment_plan_installments
      WHERE payment_plan_id = v_arrears.payment_plan_id AND NOT is_paid
    );
  END IF;

  -- Log the payment action
  INSERT INTO arrears_actions (
    arrears_record_id,
    action_type,
    description,
    is_automated,
    metadata
  ) VALUES (
    p_arrears_id,
    'payment_received',
    'Payment of $' || p_amount || ' received',
    TRUE,
    jsonb_build_object('amount', p_amount, 'payment_id', p_payment_id)
  );

  -- Check if arrears are fully resolved
  IF (SELECT total_overdue FROM arrears_records WHERE id = p_arrears_id) <= 0 THEN
    UPDATE arrears_records
    SET
      is_resolved = TRUE,
      resolved_at = NOW(),
      resolved_reason = 'Paid in full'
    WHERE id = p_arrears_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SYSTEM DEFAULT TEMPLATES
-- ============================================================================

INSERT INTO reminder_templates (name, days_overdue, channel, subject, body, is_breach_notice) VALUES
(
  'Friendly Reminder',
  1,
  'email',
  'Rent Payment Reminder - {{property_address}}',
  E'Hi {{tenant_name}},\n\nThis is a friendly reminder that your rent payment of ${{amount}} was due on {{due_date}}.\n\nPlease make payment at your earliest convenience.\n\nIf you''ve already paid, please disregard this message.\n\nKind regards,\n{{owner_name}}',
  FALSE
),
(
  'Formal Reminder',
  7,
  'email',
  'Overdue Rent Notice - {{property_address}}',
  E'Dear {{tenant_name}},\n\nOur records show that your rent payment of ${{amount}} is now {{days_overdue}} days overdue.\n\nTotal outstanding: ${{total_arrears}}\n\nPlease make payment immediately to avoid any further action.\n\nIf you are experiencing financial difficulties, please contact us to discuss a payment arrangement.\n\nRegards,\n{{owner_name}}',
  FALSE
),
(
  'Final Warning',
  14,
  'email',
  'Urgent: Overdue Rent - Action Required',
  E'Dear {{tenant_name}},\n\nDespite previous reminders, your rent remains unpaid.\n\nAmount overdue: ${{total_arrears}}\nDays overdue: {{days_overdue}}\n\nIf payment is not received within 7 days, we may be required to issue a formal breach notice.\n\nPlease contact us immediately to resolve this matter.\n\nRegards,\n{{owner_name}}',
  FALSE
),
(
  'Breach Notice (NSW)',
  21,
  'email',
  'Notice of Breach - Non-Payment of Rent',
  E'NOTICE OF BREACH OF RESIDENTIAL TENANCY AGREEMENT\n\nTo: {{tenant_name}}\nProperty: {{property_address}}\n\nYou are in breach of your residential tenancy agreement for non-payment of rent.\n\nRent owing: ${{total_arrears}}\nPeriod: {{overdue_period}}\n\nYou must pay the full amount within 14 days of receiving this notice to remedy the breach.\n\nIf you do not remedy the breach within 14 days, we may apply to the NSW Civil and Administrative Tribunal for termination of the tenancy.\n\nDate: {{today}}\n\n{{owner_name}}',
  TRUE
),
(
  'Breach Notice (VIC)',
  21,
  'email',
  'Notice to Vacate - Rent Arrears',
  E'NOTICE TO VACATE - NON-PAYMENT OF RENT\n\nTo: {{tenant_name}}\nProperty: {{property_address}}\n\nYou are required to vacate the rental property due to non-payment of rent.\n\nRent owing: ${{total_arrears}}\nPeriod: {{overdue_period}}\n\nThis notice is given under the Residential Tenancies Act 1997 (Vic).\n\nYou must vacate by {{vacate_date}} (14 days from this notice) unless you pay the full amount owing.\n\nDate: {{today}}\n\n{{owner_name}}',
  TRUE
),
(
  'Breach Notice (QLD)',
  21,
  'email',
  'Notice to Remedy Breach - Non-Payment of Rent',
  E'NOTICE TO REMEDY BREACH\n\nTo: {{tenant_name}}\nProperty: {{property_address}}\n\nYou have breached your residential tenancy agreement by failing to pay rent.\n\nRent owing: ${{total_arrears}}\nPeriod: {{overdue_period}}\n\nUnder the Residential Tenancies and Rooming Accommodation Act 2008 (Qld), you are required to remedy this breach within 7 days.\n\nIf you fail to remedy the breach, a Notice to Leave may be issued.\n\nDate: {{today}}\n\n{{owner_name}}',
  TRUE
);

-- Add applicable states to breach notices
UPDATE reminder_templates SET applicable_states = ARRAY['NSW'] WHERE name = 'Breach Notice (NSW)';
UPDATE reminder_templates SET applicable_states = ARRAY['VIC'] WHERE name = 'Breach Notice (VIC)';
UPDATE reminder_templates SET applicable_states = ARRAY['QLD'] WHERE name = 'Breach Notice (QLD)';
