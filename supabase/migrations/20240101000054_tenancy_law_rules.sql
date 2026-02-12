-- Migration: Comprehensive Australian Tenancy Law Rules
-- Structured, queryable regulatory knowledge for all 8 states/territories.
-- The agent queries this table to get EXACT regulatory requirements,
-- rather than relying on model training data.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TENANCY LAW RULES TABLE
-- Every enforceable regulatory obligation, indexed by state + category
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tenancy_law_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL CHECK (state IN ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT', 'ALL')),
  category TEXT NOT NULL CHECK (category IN (
    'entry_notice', 'rent_increase', 'bond', 'termination',
    'repairs', 'safety', 'discrimination', 'minimum_standards',
    'fees', 'inspections', 'tribunal', 'general'
  )),
  rule_key TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  notice_days INTEGER,                 -- Required notice period in calendar days (NULL if not applicable)
  notice_business_days INTEGER,        -- Required notice in business days (NULL if not applicable)
  max_frequency_months INTEGER,        -- Max frequency (e.g. rent increases max once per 12 months)
  max_amount TEXT,                     -- Max amount (e.g. bond limit "4 weeks rent")
  legislation_ref TEXT,                -- Legislation reference (e.g. "Residential Tenancies Act 2010 (NSW) s 41")
  applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'fixed_term', 'periodic', 'rooming', 'social')),
  enforcement_level TEXT NOT NULL DEFAULT 'mandatory' CHECK (enforcement_level IN ('mandatory', 'recommended', 'informational')),
  penalty_info TEXT,                   -- Penalty for non-compliance
  agent_action TEXT,                   -- What the agent should DO when this rule applies
  conditions TEXT,                     -- When this rule applies (NULL = always)
  effective_date DATE,                 -- When this rule took effect
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(state, category, rule_key)
);

CREATE INDEX idx_law_rules_state ON tenancy_law_rules(state, category);
CREATE INDEX idx_law_rules_key ON tenancy_law_rules(rule_key);
CREATE INDEX idx_law_rules_active ON tenancy_law_rules(is_active) WHERE is_active = true;

ALTER TABLE tenancy_law_rules ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (public regulatory data)
CREATE POLICY "Authenticated users can read tenancy law rules"
  ON tenancy_law_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages tenancy law rules"
  ON tenancy_law_rules FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. SEED DATA — ENTRY NOTICE REQUIREMENTS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tenancy_law_rules (state, category, rule_key, rule_text, notice_days, legislation_ref, applies_to, enforcement_level, penalty_info, agent_action, conditions) VALUES
-- NSW Entry Notice
('NSW', 'entry_notice', 'routine_inspection', 'Landlord must give at least 7 days written notice for a routine inspection. Entry between 8am-8pm on any day except Sunday or public holiday.', 7, 'Residential Tenancies Act 2010 (NSW) s 55', 'all', 'mandatory', 'Breach of quiet enjoyment — tenant may apply to NCAT', 'When scheduling an inspection, ensure at least 7 calendar days notice. Block Sunday/public holiday scheduling.', NULL),
('NSW', 'entry_notice', 'repairs_maintenance', 'Landlord must give at least 2 days notice for repairs or maintenance. Entry between 8am-8pm.', 2, 'Residential Tenancies Act 2010 (NSW) s 55(2)(d)', 'all', 'mandatory', NULL, 'When scheduling maintenance access, ensure at least 2 calendar days notice.', NULL),
('NSW', 'entry_notice', 'showing_prospective', 'Reasonable notice required to show property to prospective tenants or buyers. Must be between 8am-8pm.', 0, 'Residential Tenancies Act 2010 (NSW) s 55(2)(f)', 'all', 'mandatory', NULL, 'Request reasonable access time from tenant before scheduling showings.', 'Only in last 14 days of lease or when property is for sale'),
('NSW', 'entry_notice', 'emergency', 'Landlord may enter without notice in genuine emergency (flood, fire, risk to safety).', 0, 'Residential Tenancies Act 2010 (NSW) s 55(2)(a)', 'all', 'mandatory', NULL, 'In emergency, enter immediately and document the emergency reason.', 'Genuine emergency only'),
('NSW', 'entry_notice', 'max_inspections', 'Maximum 4 routine inspections per 12-month period.', NULL, 'Residential Tenancies Act 2010 (NSW) s 55', 'all', 'mandatory', 'Breach — tenant may apply to NCAT', 'Track inspection count per property per year. Block scheduling if 4 already conducted.', NULL),

-- VIC Entry Notice
('VIC', 'entry_notice', 'routine_inspection', 'Landlord must give at least 7 days written notice for a routine inspection. Entry between 8am-6pm. Must state reason, proposed date and time.', 7, 'Residential Tenancies Act 1997 (VIC) s 86', 'all', 'mandatory', 'Fine up to $1,847 (20 penalty units)', 'When scheduling an inspection, ensure at least 7 calendar days written notice with date, time, and reason. No entry after 6pm.', NULL),
('VIC', 'entry_notice', 'repairs_maintenance', 'At least 24 hours notice for repairs. Must be between 8am-6pm.', 1, 'Residential Tenancies Act 1997 (VIC) s 86(1)(b)', 'all', 'mandatory', NULL, 'Ensure at least 24 hours notice for maintenance access.', NULL),
('VIC', 'entry_notice', 'emergency', 'Entry without notice permitted only in genuine emergency.', 0, 'Residential Tenancies Act 1997 (VIC) s 85', 'all', 'mandatory', NULL, 'In emergency, enter immediately and document reason.', 'Genuine emergency only'),
('VIC', 'entry_notice', 'max_inspections', 'Maximum 4 routine inspections per 12-month period. Not more than once every 3 months.', NULL, 'Residential Tenancies Act 1997 (VIC) s 86', 'all', 'mandatory', 'Fine applies', 'Track inspection count. Ensure minimum 3-month gap between routine inspections.', NULL),

-- QLD Entry Notice
('QLD', 'entry_notice', 'routine_inspection', 'Landlord must give at least 7 days written notice (Entry Notice Form 9). Entry between 8am-6pm on weekdays.', 7, 'Residential Tenancies and Rooming Accommodation Act 2008 (QLD) s 192', 'all', 'mandatory', 'Breach — tenant may apply to QCAT', 'Use Form 9 (Entry Notice). Ensure 7 days notice minimum. Weekdays only, 8am-6pm.', NULL),
('QLD', 'entry_notice', 'repairs_maintenance', 'At least 24 hours notice for non-urgent repairs. Entry between 8am-6pm.', 1, 'RTRA Act 2008 (QLD) s 192(1)(c)', 'all', 'mandatory', NULL, 'Ensure at least 24 hours notice for non-urgent repairs.', NULL),
('QLD', 'entry_notice', 'max_inspections', 'Once every 3 months maximum for routine inspections.', NULL, 'RTRA Act 2008 (QLD) s 192', 'all', 'mandatory', NULL, 'Ensure minimum 3-month gap between routine inspections.', NULL),

-- SA Entry Notice
('SA', 'entry_notice', 'routine_inspection', 'At least 7 days written notice. Entry between 8am-8pm. Not on Sundays or public holidays.', 7, 'Residential Tenancies Act 1995 (SA) s 72', 'all', 'mandatory', NULL, 'Ensure at least 7 calendar days written notice. Block Sundays and public holidays.', NULL),
('SA', 'entry_notice', 'repairs_maintenance', 'At least 48 hours notice for repairs.', 2, 'Residential Tenancies Act 1995 (SA) s 72(1)(c)', 'all', 'mandatory', NULL, 'Ensure at least 48 hours notice for maintenance.', NULL),
('SA', 'entry_notice', 'max_inspections', 'Maximum 4 inspections per 12-month period.', NULL, 'Residential Tenancies Act 1995 (SA) s 72', 'all', 'mandatory', NULL, 'Track inspection count. Block if 4 already conducted this year.', NULL),

-- WA Entry Notice
('WA', 'entry_notice', 'routine_inspection', 'At least 7 days written notice (or 14 days if posted). Entry between 8am-6pm weekdays, 9am-5pm weekends.', 7, 'Residential Tenancies Act 1987 (WA) s 46', 'all', 'mandatory', NULL, 'Ensure at least 7 days written notice. Different weekend hours apply.', NULL),
('WA', 'entry_notice', 'repairs_maintenance', 'At least 72 hours notice for non-urgent repairs.', 3, 'Residential Tenancies Act 1987 (WA) s 46(3)(c)', 'all', 'mandatory', NULL, 'Ensure at least 72 hours notice for maintenance access.', NULL),
('WA', 'entry_notice', 'max_inspections', 'Maximum once every 4 weeks (approximately 13 per year, but typically quarterly in practice).', NULL, 'Residential Tenancies Act 1987 (WA) s 46', 'all', 'mandatory', NULL, 'Ensure minimum 4-week gap between inspections.', NULL),

-- TAS Entry Notice
('TAS', 'entry_notice', 'routine_inspection', 'At least 24 hours written notice. Entry between 8am-6pm. Must be at a reasonable time.', 1, 'Residential Tenancy Act 1997 (TAS) s 54', 'all', 'mandatory', NULL, 'Ensure at least 24 hours written notice. Entry 8am-6pm only.', NULL),
('TAS', 'entry_notice', 'repairs_maintenance', 'Reasonable notice required for repairs (at least 24 hours recommended).', 1, 'Residential Tenancy Act 1997 (TAS) s 54', 'all', 'mandatory', NULL, 'Ensure at least 24 hours notice for maintenance.', NULL),
('TAS', 'entry_notice', 'max_inspections', 'Inspections must not be more frequent than reasonably necessary. Practice standard is quarterly (4 per year).', NULL, 'Residential Tenancy Act 1997 (TAS) s 54', 'all', 'recommended', NULL, 'Limit routine inspections to once per quarter (4 per year). Track inspection count.', NULL),

-- NT Entry Notice
('NT', 'entry_notice', 'routine_inspection', 'At least 7 days written notice. Entry at a reasonable time.', 7, 'Residential Tenancies Act 1999 (NT) s 74', 'all', 'mandatory', NULL, 'Ensure at least 7 days written notice for inspections.', NULL),
('NT', 'entry_notice', 'repairs_maintenance', 'Reasonable notice for repairs (recommended 24 hours minimum).', 1, 'Residential Tenancies Act 1999 (NT) s 74', 'all', 'mandatory', NULL, 'Ensure reasonable notice (minimum 24 hours) for maintenance.', NULL),
('NT', 'entry_notice', 'max_inspections', 'Inspections must be at reasonable intervals. Practice standard is once every 3 months (4 per year).', NULL, 'Residential Tenancies Act 1999 (NT) s 74', 'all', 'recommended', NULL, 'Limit routine inspections to once per quarter. Track inspection count.', NULL),

-- ACT Entry Notice
('ACT', 'entry_notice', 'routine_inspection', 'At least 1 weeks notice. Entry between 8am-6pm on weekdays, 9am-5pm Saturdays. Not Sundays or public holidays.', 7, 'Residential Tenancies Act 1997 (ACT) s 71B', 'all', 'mandatory', NULL, 'Ensure at least 7 days written notice. Block Sundays/public holidays. Saturday hours 9am-5pm.', NULL),
('ACT', 'entry_notice', 'repairs_maintenance', 'At least 2 days notice for non-urgent repairs.', 2, 'Residential Tenancies Act 1997 (ACT) s 71B', 'all', 'mandatory', NULL, 'Ensure at least 2 days notice for non-urgent repairs.', NULL),
('ACT', 'entry_notice', 'max_inspections', 'No more than once every 4 weeks. Must be reasonable frequency.', NULL, 'Residential Tenancies Act 1997 (ACT) s 71B', 'all', 'mandatory', NULL, 'Ensure minimum 4-week gap between inspections.', NULL);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. SEED DATA — RENT INCREASE RULES
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tenancy_law_rules (state, category, rule_key, rule_text, notice_days, max_frequency_months, legislation_ref, applies_to, enforcement_level, penalty_info, agent_action) VALUES
('NSW', 'rent_increase', 'notice_period', 'Landlord must give at least 60 days written notice of a rent increase.', 60, NULL, 'Residential Tenancies Act 2010 (NSW) s 41', 'all', 'mandatory', 'Increase is void if insufficient notice given', 'When creating a rent increase, calculate effective date = today + 60 days minimum.'),
('NSW', 'rent_increase', 'max_frequency', 'Rent cannot be increased more than once in any 12-month period.', NULL, 12, 'Residential Tenancies Act 2010 (NSW) s 41(2)', 'all', 'mandatory', 'Increase is void', 'Block rent increase if another increase was applied within the last 12 months.'),
('NSW', 'rent_increase', 'fixed_term_restriction', 'For fixed-term agreements, rent can only increase if the agreement specifically allows it and states the new amount or calculation method.', NULL, NULL, 'Residential Tenancies Act 2010 (NSW) s 41(1A)', 'fixed_term', 'mandatory', NULL, 'Check lease agreement for rent review clause before allowing mid-lease increase.'),

('VIC', 'rent_increase', 'notice_period', 'Landlord must give at least 60 days written notice of a rent increase.', 60, NULL, 'Residential Tenancies Act 1997 (VIC) s 44', 'all', 'mandatory', 'Increase is void if insufficient notice', 'When creating a rent increase, calculate effective date = today + 60 days minimum.'),
('VIC', 'rent_increase', 'max_frequency', 'Rent cannot be increased more than once in any 12-month period.', NULL, 12, 'Residential Tenancies Act 1997 (VIC) s 44(3)', 'all', 'mandatory', 'Increase is void', 'Block rent increase if another increase was applied within the last 12 months.'),
('VIC', 'rent_increase', 'excessive_increase', 'Tenant can challenge an excessive rent increase at VCAT. Increase must not be excessive having regard to the general market level of rents.', NULL, NULL, 'Residential Tenancies Act 1997 (VIC) s 45', 'all', 'informational', NULL, 'When suggesting rent increase amount, compare to market data to ensure reasonableness.'),

('QLD', 'rent_increase', 'notice_period', 'Landlord must give at least 2 months (60 days) written notice of a rent increase using Form 13.', 60, NULL, 'RTRA Act 2008 (QLD) s 93', 'all', 'mandatory', 'Increase is void', 'Use Form 13. Calculate effective date = today + 60 days minimum.'),
('QLD', 'rent_increase', 'max_frequency', 'Rent cannot be increased more than once in any 6-month period.', NULL, 6, 'RTRA Act 2008 (QLD) s 93(2)', 'all', 'mandatory', 'Increase is void', 'Block rent increase if another increase was applied within the last 6 months. QLD has stricter frequency.'),

('SA', 'rent_increase', 'notice_period', 'Landlord must give at least 60 days written notice of a rent increase.', 60, NULL, 'Residential Tenancies Act 1995 (SA) s 55', 'all', 'mandatory', 'Increase is void', 'Calculate effective date = today + 60 days minimum.'),
('SA', 'rent_increase', 'max_frequency', 'Rent cannot be increased more than once in any 12-month period.', NULL, 12, 'Residential Tenancies Act 1995 (SA) s 55(2)', 'all', 'mandatory', NULL, 'Block rent increase if another increase was applied within the last 12 months.'),

('WA', 'rent_increase', 'notice_period', 'Landlord must give at least 60 days written notice of a rent increase.', 60, NULL, 'Residential Tenancies Act 1987 (WA) s 30', 'all', 'mandatory', 'Increase is void', 'Calculate effective date = today + 60 days minimum.'),
('WA', 'rent_increase', 'max_frequency', 'Rent cannot be increased more than once in any 6-month period.', NULL, 6, 'Residential Tenancies Act 1987 (WA) s 30(2)', 'all', 'mandatory', NULL, 'Block rent increase if another was applied within the last 6 months.'),

('TAS', 'rent_increase', 'notice_period', 'Landlord must give at least 60 days written notice of a rent increase.', 60, NULL, 'Residential Tenancy Act 1997 (TAS) s 26', 'all', 'mandatory', NULL, 'Calculate effective date = today + 60 days minimum.'),
('TAS', 'rent_increase', 'max_frequency', 'Rent cannot be increased more than once in any 12-month period.', NULL, 12, 'Residential Tenancy Act 1997 (TAS) s 26', 'all', 'mandatory', NULL, 'Block rent increase if another was applied within the last 12 months.'),

('NT', 'rent_increase', 'notice_period', 'Landlord must give at least 30 days written notice of a rent increase.', 30, NULL, 'Residential Tenancies Act 1999 (NT) s 38', 'all', 'mandatory', NULL, 'Calculate effective date = today + 30 days minimum. NT has shorter notice.'),
('NT', 'rent_increase', 'max_frequency', 'Rent cannot be increased more than once in any 6-month period.', NULL, 6, 'Residential Tenancies Act 1999 (NT) s 38(2)', 'all', 'mandatory', NULL, 'Block rent increase if another was applied within the last 6 months.'),

('ACT', 'rent_increase', 'notice_period', 'Landlord must give at least 8 weeks (56 days) written notice of a rent increase.', 56, NULL, 'Residential Tenancies Act 1997 (ACT) s 65', 'all', 'mandatory', NULL, 'Calculate effective date = today + 56 days minimum.'),
('ACT', 'rent_increase', 'max_frequency', 'Rent cannot be increased more than once in any 12-month period.', NULL, 12, 'Residential Tenancies Act 1997 (ACT) s 65(2)', 'all', 'mandatory', NULL, 'Block rent increase if another was applied within the last 12 months.');

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. SEED DATA — BOND RULES
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tenancy_law_rules (state, category, rule_key, rule_text, notice_business_days, max_amount, legislation_ref, enforcement_level, penalty_info, agent_action) VALUES
('NSW', 'bond', 'max_amount', 'Bond cannot exceed 4 weeks rent. If weekly rent exceeds $1,250, bond can be up to 6 weeks.', NULL, '4 weeks rent (6 weeks if rent > $1,250/week)', 'Residential Tenancies Act 2010 (NSW) s 159', 'mandatory', 'Fine up to $2,200', 'When creating tenancy, validate bond amount <= 4 weeks rent (or 6 weeks if rent > $1,250/week).'),
('NSW', 'bond', 'lodgement_deadline', 'Bond must be lodged with NSW Fair Trading within 10 business days of receipt.', 10, NULL, 'Residential Tenancies Act 2010 (NSW) s 162', 'mandatory', 'Fine up to $2,200', 'Create task to lodge bond. Set deadline = receipt date + 10 business days. Escalate if approaching deadline.'),
('NSW', 'bond', 'claim_deadline', 'Bond claim must be made within 14 days of tenancy ending. If no claim, bond returned to tenant.', 14, NULL, 'Residential Tenancies Act 2010 (NSW) s 168', 'mandatory', NULL, 'At lease end, create urgent task for bond claim within 14 days or it defaults to tenant.'),

('VIC', 'bond', 'max_amount', 'Bond cannot exceed 1 months rent. No pet bond allowed.', NULL, '1 month rent', 'Residential Tenancies Act 1997 (VIC) s 31', 'mandatory', 'Fine applies', 'When creating tenancy, validate bond amount <= 1 months rent. Never accept pet bond.'),
('VIC', 'bond', 'lodgement_deadline', 'Bond must be lodged with RTBA within 10 business days of receipt.', 10, NULL, 'Residential Tenancies Act 1997 (VIC) s 33', 'mandatory', 'Fine up to $1,847', 'Create task to lodge bond. Set deadline = receipt date + 10 business days.'),
('VIC', 'bond', 'claim_deadline', 'Bond claim must be lodged within 10 business days of tenant vacating.', 10, NULL, 'Residential Tenancies Act 1997 (VIC) s 41A', 'mandatory', NULL, 'At lease end, create urgent task for bond claim within 10 business days.'),

('QLD', 'bond', 'max_amount', 'Bond cannot exceed 4 weeks rent.', NULL, '4 weeks rent', 'RTRA Act 2008 (QLD) s 146', 'mandatory', NULL, 'When creating tenancy, validate bond amount <= 4 weeks rent.'),
('QLD', 'bond', 'lodgement_deadline', 'Bond must be lodged with RTA QLD within 10 business days of receipt.', 10, NULL, 'RTRA Act 2008 (QLD) s 148', 'mandatory', 'Fine up to $2,611', 'Create task to lodge bond. Set deadline = receipt date + 10 business days.'),
('QLD', 'bond', 'claim_deadline', 'Bond refund/claim must be processed within 14 days of receiving a Form 4 (Refund of Rental Bond).', 14, NULL, 'RTRA Act 2008 (QLD) s 150', 'mandatory', NULL, 'At lease end, process bond claim within 14 days of receiving tenant refund form.'),

('SA', 'bond', 'max_amount', 'Bond cannot exceed 4 weeks rent. For furnished premises, 6 weeks.', NULL, '4 weeks rent (6 weeks furnished)', 'Residential Tenancies Act 1995 (SA) s 61', 'mandatory', NULL, 'Validate bond <= 4 weeks (6 if furnished).'),
('SA', 'bond', 'lodgement_deadline', 'Bond must be lodged with Consumer and Business Services within 2 business days.', 2, NULL, 'Residential Tenancies Act 1995 (SA) s 63', 'mandatory', NULL, 'Lodge bond within 2 business days. SA has the strictest deadline.'),

('WA', 'bond', 'max_amount', 'Bond cannot exceed 4 weeks rent.', NULL, '4 weeks rent', 'Residential Tenancies Act 1987 (WA) s 29', 'mandatory', NULL, 'Validate bond <= 4 weeks rent.'),
('WA', 'bond', 'lodgement_deadline', 'Bond must be lodged with the Bond Administrator within 14 days.', NULL, NULL, 'Residential Tenancies Act 1987 (WA) s 29(3)', 'mandatory', NULL, 'Lodge bond within 14 calendar days.'),

('TAS', 'bond', 'max_amount', 'Bond cannot exceed 4 weeks rent.', NULL, '4 weeks rent', 'Residential Tenancy Act 1997 (TAS) s 22', 'mandatory', NULL, 'Validate bond <= 4 weeks rent.'),
('TAS', 'bond', 'lodgement_deadline', 'Bond must be lodged with Rental Deposit Authority within 2 business days.', 2, NULL, 'Residential Tenancy Act 1997 (TAS) s 22(3)', 'mandatory', NULL, 'Lodge bond within 2 business days.'),

('NT', 'bond', 'max_amount', 'Bond cannot exceed 4 weeks rent.', NULL, '4 weeks rent', 'Residential Tenancies Act 1999 (NT) s 33', 'mandatory', NULL, 'Validate bond <= 4 weeks rent.'),
('NT', 'bond', 'lodgement_deadline', 'Bond must be lodged with NT Consumer Affairs within 14 days.', NULL, NULL, 'Residential Tenancies Act 1999 (NT) s 33(3)', 'mandatory', NULL, 'Lodge bond within 14 calendar days.'),

('ACT', 'bond', 'max_amount', 'Bond cannot exceed 4 weeks rent.', NULL, '4 weeks rent', 'Residential Tenancies Act 1997 (ACT) s 20', 'mandatory', NULL, 'Validate bond <= 4 weeks rent.'),
('ACT', 'bond', 'lodgement_deadline', 'Bond must be lodged with the Office of Rental Bonds within 4 weeks.', NULL, NULL, 'Residential Tenancies Act 1997 (ACT) s 21', 'mandatory', NULL, 'Lodge bond within 4 weeks (28 calendar days).');

-- WA, NT, ACT use calendar days (not business days) for bond lodgement — set notice_days
UPDATE tenancy_law_rules SET notice_days = 14 WHERE state = 'WA' AND category = 'bond' AND rule_key = 'lodgement_deadline';
UPDATE tenancy_law_rules SET notice_days = 14 WHERE state = 'NT' AND category = 'bond' AND rule_key = 'lodgement_deadline';
UPDATE tenancy_law_rules SET notice_days = 28 WHERE state = 'ACT' AND category = 'bond' AND rule_key = 'lodgement_deadline';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. SEED DATA — TERMINATION/NOTICE TO VACATE RULES
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tenancy_law_rules (state, category, rule_key, rule_text, notice_days, legislation_ref, applies_to, enforcement_level, agent_action) VALUES
('NSW', 'termination', 'end_of_fixed_term', 'Landlord must give at least 30 days notice before end of fixed term (no grounds).', 30, 'Residential Tenancies Act 2010 (NSW) s 84', 'fixed_term', 'mandatory', 'When lease is approaching end, prompt owner at 30+ days out whether to renew, go periodic, or terminate.'),
('NSW', 'termination', 'periodic_no_grounds', 'Landlord must give at least 90 days notice to end a periodic tenancy (no grounds).', 90, 'Residential Tenancies Act 2010 (NSW) s 85', 'periodic', 'mandatory', 'For periodic tenancy termination without cause, provide 90 days written notice minimum.'),
('NSW', 'termination', 'breach_non_payment', 'Landlord may give 14 days notice for non-payment of rent (rent arrears > 14 days).', 14, 'Residential Tenancies Act 2010 (NSW) s 87', 'all', 'mandatory', 'After 14+ days rent arrears, flag option to serve 14-day termination notice. Tenant can remedy.'),
('NSW', 'termination', 'tenant_notice_fixed', 'Tenant must give at least 14 days notice before end of fixed term.', 14, 'Residential Tenancies Act 2010 (NSW) s 96', 'fixed_term', 'informational', 'Track tenant notice periods.'),
('NSW', 'termination', 'tenant_notice_periodic', 'Tenant must give at least 21 days notice for periodic tenancy.', 21, 'Residential Tenancies Act 2010 (NSW) s 96', 'periodic', 'informational', 'Track tenant notice periods.'),

('VIC', 'termination', 'end_of_fixed_term', 'Fixed-term tenancies now automatically convert to periodic at end. Landlord cannot terminate at end of fixed term without a reason.', NULL, 'Residential Tenancies Act 1997 (VIC) s 91ZZA (2024 reforms)', 'fixed_term', 'mandatory', 'VIC landlords cannot issue no-grounds termination at end of fixed term. Must have a prescribed reason.'),
('VIC', 'termination', 'prescribed_reason', 'Landlord can only terminate periodic tenancy with a prescribed reason (owner moving in, major renovation, property sale, demolition). 60-90 days notice depending on reason.', 60, 'Residential Tenancies Act 1997 (VIC) s 91ZZA', 'periodic', 'mandatory', 'VIC requires a prescribed reason for termination. Present owner with valid reason options only.'),
('VIC', 'termination', 'breach_non_payment', 'Landlord may give 14 days notice for non-payment of rent.', 14, 'Residential Tenancies Act 1997 (VIC) s 91ZM', 'all', 'mandatory', 'After 14+ days rent arrears, flag option to serve 14-day breach notice.'),

('QLD', 'termination', 'end_of_fixed_term', 'Landlord must give at least 2 months notice for end of fixed-term tenancy (without grounds).', 60, 'RTRA Act 2008 (QLD) s 291', 'fixed_term', 'mandatory', 'At 60+ days before lease end, prompt owner to decide on renewal or termination.'),
('QLD', 'termination', 'periodic_no_grounds', 'Landlord must give at least 2 months notice for periodic tenancy (without grounds).', 60, 'RTRA Act 2008 (QLD) s 291', 'periodic', 'mandatory', 'For periodic termination, provide 2 months written notice.'),
('QLD', 'termination', 'breach_non_payment', 'Landlord may issue a Notice to Remedy Breach for non-payment of rent (7 days to remedy).', 7, 'RTRA Act 2008 (QLD) s 281', 'all', 'mandatory', 'After rent arrears, issue Form 11 (Notice to Remedy Breach) giving 7 days to pay.'),

('SA', 'termination', 'end_of_fixed_term', 'Landlord must give at least 28 days notice before end of fixed term.', 28, 'Residential Tenancies Act 1995 (SA) s 83', 'fixed_term', 'mandatory', 'Prompt owner at 28+ days before lease end.'),
('SA', 'termination', 'periodic_no_grounds', 'Landlord must give at least 90 days notice for periodic tenancy (no grounds).', 90, 'Residential Tenancies Act 1995 (SA) s 83A', 'periodic', 'mandatory', 'For periodic termination, 90 days notice required.'),

('WA', 'termination', 'end_of_fixed_term', 'Landlord must give at least 30 days notice before end of fixed term.', 30, 'Residential Tenancies Act 1987 (WA) s 67', 'fixed_term', 'mandatory', 'Prompt owner at 30+ days before lease end.'),
('WA', 'termination', 'periodic_no_grounds', 'Landlord must give at least 60 days written notice for periodic tenancy (no grounds).', 60, 'Residential Tenancies Act 1987 (WA) s 68', 'periodic', 'mandatory', 'For periodic termination, 60 days notice required.'),

('TAS', 'termination', 'end_of_fixed_term', 'Landlord must give at least 14 days notice for end of fixed term.', 14, 'Residential Tenancy Act 1997 (TAS) s 38', 'fixed_term', 'mandatory', 'Prompt owner at 14+ days before lease end.'),
('TAS', 'termination', 'periodic_no_grounds', 'Landlord must give at least 42 days notice for periodic tenancy (no grounds).', 42, 'Residential Tenancy Act 1997 (TAS) s 39', 'periodic', 'mandatory', 'For periodic termination, 42 days notice required.'),

('NT', 'termination', 'end_of_fixed_term', 'Landlord must give at least 14 days notice before end of fixed term.', 14, 'Residential Tenancies Act 1999 (NT) s 89', 'fixed_term', 'mandatory', 'Prompt owner at 14+ days before lease end.'),
('NT', 'termination', 'periodic_no_grounds', 'Landlord must give at least 42 days notice for periodic tenancy (no grounds).', 42, 'Residential Tenancies Act 1999 (NT) s 90', 'periodic', 'mandatory', 'For periodic termination, 42 days notice required.'),

('ACT', 'termination', 'end_of_fixed_term', 'Fixed-term tenancies convert to periodic at end unless 4 weeks notice is given by either party.', 28, 'Residential Tenancies Act 1997 (ACT) s 36G', 'fixed_term', 'mandatory', 'At 4+ weeks before lease end, prompt owner to decide on renewal.'),
('ACT', 'termination', 'periodic_prescribed_reason', 'ACT requires a prescribed reason for termination of periodic tenancy. 26 weeks notice for most reasons.', 182, 'Residential Tenancies Act 1997 (ACT) s 36J', 'periodic', 'mandatory', 'ACT requires prescribed reason and 26 weeks (6 months) notice for periodic termination.');

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. SEED DATA — REPAIRS & MAINTENANCE OBLIGATIONS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tenancy_law_rules (state, category, rule_key, rule_text, notice_days, legislation_ref, enforcement_level, agent_action) VALUES
('ALL', 'repairs', 'urgent_repair_timeframe', 'Urgent repairs (burst pipes, dangerous electrical, gas leaks, flooding, serious storm damage, failure of essential services) must be attended to as soon as reasonably possible — typically within 24-48 hours.', NULL, 'Various state RTAs', 'mandatory', 'Flag emergency/urgent maintenance as CRITICAL priority. Auto-contact preferred trade if autonomy allows. Create task with 24-hour deadline.'),
('ALL', 'repairs', 'non_urgent_timeframe', 'Non-urgent repairs must be attended to within a reasonable time — generally 14-28 days depending on the state.', NULL, 'Various state RTAs', 'mandatory', 'Create maintenance task with 14-day target. Escalate if not actioned within 21 days.'),
('ALL', 'repairs', 'landlord_obligation', 'The landlord must maintain the property in a reasonable state of repair, having regard to the age and character of the property and its condition at the start of the tenancy.', NULL, 'Various state RTAs', 'mandatory', 'Track maintenance requests and ensure timely resolution. Flag properties with high outstanding maintenance count.'),
('VIC', 'repairs', 'urgent_repair_24h', 'Victorian law specifically requires urgent repairs to be arranged within 24 hours. If landlord cannot be contacted, tenant may arrange repairs up to $2,500.', NULL, 'Residential Tenancies Act 1997 (VIC) s 72A', 'mandatory', 'VIC: Emergency maintenance must be responded to within 24 hours. Tenant may self-arrange up to $2,500 if owner unreachable.'),
('QLD', 'repairs', 'emergency_repair_response', 'Emergency repairs must be carried out as soon as possible. Tenant may arrange emergency repairs if landlord cannot be contacted within 24 hours.', NULL, 'RTRA Act 2008 (QLD) s 214', 'mandatory', 'QLD: Respond to emergency repairs immediately. Tenant can self-arrange if not contacted within 24 hours.'),
('NSW', 'repairs', 'urgent_repair_response', 'Urgent repairs must be arranged within 24 hours. If landlord does not respond within 2 days, tenant may arrange up to $1,000 in repairs.', NULL, 'Residential Tenancies Act 2010 (NSW) s 62A', 'mandatory', 'NSW: Respond to urgent repairs within 24 hours. Tenant can self-arrange up to $1,000 after 2 days no response.');

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. SEED DATA — DISCRIMINATION & GENERAL OBLIGATIONS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tenancy_law_rules (state, category, rule_key, rule_text, legislation_ref, enforcement_level, agent_action) VALUES
('ALL', 'discrimination', 'protected_grounds', 'Landlords cannot discriminate against tenants on the basis of race, sex, age, disability, marital status, family status, pregnancy, sexual orientation, gender identity, or religion.', 'Anti-Discrimination Act (various states) + federal laws', 'mandatory', 'Never suggest or execute tenant selection based on protected characteristics. Only assess applications on rental history, income, and references.'),
('ALL', 'discrimination', 'assistance_animals', 'Landlords cannot refuse tenants with assistance animals. Body corporate rules restricting pets do not apply to assistance animals.', 'Disability Discrimination Act 1992 (Cth) + state RTAs', 'mandatory', 'Never reject an application because the tenant has an assistance animal. Flag to owner that refusal is unlawful.'),
('ALL', 'discrimination', 'domestic_violence', 'In most states, victims of domestic violence have special protections including the ability to end a tenancy early without penalty and change locks.', 'Various state RTAs (domestic violence amendments)', 'mandatory', 'If a tenant raises domestic violence, provide information about their rights. Never share their details. Facilitate early lease termination if requested.'),
('VIC', 'discrimination', 'rental_bidding_ban', 'Rental bidding is banned in Victoria. Landlords/agents cannot solicit or accept offers above the advertised rent.', 'Residential Tenancies Act 1997 (VIC) s 30E (2024 amendment)', 'mandatory', 'For VIC properties: Never suggest or accept rent offers above advertised amount. Set listing rent as the maximum.'),
('ALL', 'general', 'condition_report', 'A condition report must be completed at the start and end of every tenancy. Both landlord and tenant sign. This is essential for bond claims.', 'Various state RTAs', 'mandatory', 'Auto-create condition report task when new tenancy starts. Ensure both parties sign. Create another at tenancy end for bond comparison.'),
('ALL', 'general', 'tenant_privacy', 'Landlord must respect tenant privacy and quiet enjoyment. Only enter for permitted reasons with proper notice.', 'Various state RTAs', 'mandatory', 'Always check entry notice requirements before scheduling any property access. Log all entry events.'),
('ALL', 'general', 'receipts_required', 'Landlord must provide a receipt for all rent and bond payments within 2-3 business days.', 'Various state RTAs', 'mandatory', 'Auto-generate and send payment receipts when rent payments are recorded.');

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. SEED DATA — MINIMUM PROPERTY STANDARDS (VIC specific + general)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tenancy_law_rules (state, category, rule_key, rule_text, legislation_ref, enforcement_level, agent_action, effective_date) VALUES
('VIC', 'minimum_standards', 'bathroom', 'Bathroom must have a washbasin, shower or bath in working order, and adequate hot and cold water.', 'Residential Tenancies (Minimum Standards) Regulations 2021 (VIC)', 'mandatory', 'Include bathroom condition in inspection checklists. Flag non-compliance.', '2021-03-29'),
('VIC', 'minimum_standards', 'kitchen', 'Kitchen must have a functioning stove/oven (at least 2 burners and an oven), a sink with hot and cold water, and adequate food storage.', 'Residential Tenancies (Minimum Standards) Regulations 2021 (VIC)', 'mandatory', 'Include kitchen appliance condition in inspections. Flag if stove/oven non-functional.', '2021-03-29'),
('VIC', 'minimum_standards', 'laundry', 'Laundry must have adequate plumbing for a washing machine or shared laundry facilities.', 'Residential Tenancies (Minimum Standards) Regulations 2021 (VIC)', 'mandatory', NULL, '2021-03-29'),
('VIC', 'minimum_standards', 'heating', 'At least one fixed heater in the main living area in working order. Must be an energy-efficient type (no open-flued gas heaters).', 'Residential Tenancies (Minimum Standards) Regulations 2021 (VIC)', 'mandatory', 'Flag VIC properties without working heating in main living area. Open-flued gas heaters must be replaced.', '2021-03-29'),
('VIC', 'minimum_standards', 'structural_soundness', 'Property must be structurally sound and weatherproof. No damp, mould, or vermin.', 'Residential Tenancies (Minimum Standards) Regulations 2021 (VIC)', 'mandatory', 'Track mould/damp reports in maintenance. Flag as compliance issue for VIC properties.', '2021-03-29'),
('VIC', 'minimum_standards', 'locks_security', 'All external doors must have functioning deadlocks. Windows must be lockable.', 'Residential Tenancies (Minimum Standards) Regulations 2021 (VIC)', 'mandatory', 'Include lock checks in inspection templates for VIC properties.', '2021-03-29'),
('VIC', 'minimum_standards', 'window_coverings', 'All windows in bedrooms and living areas must have window coverings for privacy.', 'Residential Tenancies (Minimum Standards) Regulations 2021 (VIC)', 'mandatory', NULL, '2021-03-29'),
('VIC', 'minimum_standards', 'lighting', 'Adequate lighting must be provided in all rooms and common areas.', 'Residential Tenancies (Minimum Standards) Regulations 2021 (VIC)', 'mandatory', NULL, '2021-03-29'),
('VIC', 'minimum_standards', 'ventilation', 'Adequate ventilation in bathroom and kitchen (exhaust fan or openable window).', 'Residential Tenancies (Minimum Standards) Regulations 2021 (VIC)', 'mandatory', NULL, '2021-03-29'),
('VIC', 'minimum_standards', 'electrical_safety', 'All electrical installations must be safe and in working order. Switchboard must have a safety switch (RCD).', 'Residential Tenancies (Minimum Standards) Regulations 2021 (VIC)', 'mandatory', 'Check RCD/safety switch during inspections for VIC properties.', '2021-03-29'),
('VIC', 'minimum_standards', 'toilet', 'Must have at least one flushing toilet connected to sewerage or an approved system.', 'Residential Tenancies (Minimum Standards) Regulations 2021 (VIC)', 'mandatory', NULL, '2021-03-29'),
('VIC', 'minimum_standards', 'smoke_alarms', 'Working smoke alarms must be installed on every storey. Must comply with Building Code.', 'Residential Tenancies (Minimum Standards) Regulations 2021 (VIC)', 'mandatory', 'Covered by smoke alarm compliance requirement. Ensure all storeys have alarms.', '2021-03-29');

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. HELPER FUNCTION — Query applicable rules for a property action
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_tenancy_law_rules(
  p_state TEXT,
  p_category TEXT DEFAULT NULL,
  p_rule_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  state TEXT,
  category TEXT,
  rule_key TEXT,
  rule_text TEXT,
  notice_days INTEGER,
  notice_business_days INTEGER,
  max_frequency_months INTEGER,
  max_amount TEXT,
  legislation_ref TEXT,
  applies_to TEXT,
  enforcement_level TEXT,
  penalty_info TEXT,
  agent_action TEXT,
  conditions TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    r.id, r.state, r.category, r.rule_key, r.rule_text,
    r.notice_days, r.notice_business_days, r.max_frequency_months,
    r.max_amount, r.legislation_ref, r.applies_to, r.enforcement_level,
    r.penalty_info, r.agent_action, r.conditions
  FROM tenancy_law_rules r
  WHERE r.is_active = true
    AND (r.state = p_state OR r.state = 'ALL')
    AND (p_category IS NULL OR r.category = p_category)
    AND (p_rule_key IS NULL OR r.rule_key = p_rule_key)
  ORDER BY
    CASE WHEN r.state = p_state THEN 0 ELSE 1 END,
    r.category,
    r.rule_key;
$$;
