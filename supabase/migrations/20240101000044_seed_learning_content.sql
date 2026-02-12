-- Mission 15 Phase H: Seed learning content articles for the Learning Hub
-- These are starter articles across the main categories. Content will grow over time.

INSERT INTO learning_content (title, slug, content_markdown, category, state, tags, reading_time_minutes, is_published, published_at)
VALUES
-- Getting Started
(
  'New Landlord Guide: Your First 30 Days',
  'new-landlord-guide',
  E'# New Landlord Guide\n\nCongratulations on becoming a property investor! Here''s what to do in your first 30 days.\n\n## Week 1: Set Up Your Property\n\n- Get building and landlord insurance in place\n- Set up a dedicated bank account for rental income\n- Take a full photographic record of the property condition\n- Ensure all compliance items are up to date (smoke alarms, safety switches)\n\n## Week 2: Find the Right Tenant\n\n- Create a compelling listing with professional photos\n- Set a competitive rental price based on local market data\n- Screen applicants thoroughly — check references, employment, and rental history\n\n## Week 3: Prepare the Lease\n\n- Use your state''s prescribed residential tenancy agreement\n- Include all required disclosures (asbestos, pool safety, etc.)\n- Collect the bond and lodge it with the relevant authority\n\n## Week 4: Hand Over\n\n- Complete an entry condition report with the tenant\n- Provide all required keys, remotes, and access information\n- Set up rent payment collection\n- Introduce Casa as your property management assistant\n\n## Tips for Success\n\n- Keep detailed records of all income and expenses for tax time\n- Respond to maintenance requests promptly — it''s your legal obligation\n- Build a good relationship with your tenant — happy tenants stay longer\n- Let Casa handle the day-to-day so you can focus on your investment strategy',
  'getting_started',
  NULL,
  ARRAY['beginner', 'setup', 'investment'],
  8,
  true,
  NOW()
),
(
  'Understanding Your Legal Obligations as a Landlord',
  'landlord-obligations',
  E'# Your Legal Obligations\n\nAs a landlord in Australia, you have specific legal responsibilities. Here''s what you need to know.\n\n## Providing a Habitable Property\n\nYou must ensure the property is:\n- Structurally sound and weatherproof\n- In reasonable repair\n- Has adequate plumbing, drainage, and hot water\n- Has working locks on all external doors and windows\n\n## Maintenance Responsibilities\n\n- Urgent repairs must be addressed within 24-48 hours depending on your state\n- Routine repairs should be completed within a reasonable timeframe\n- You cannot charge the tenant for fair wear and tear\n\n## Entry Rights\n\nYou can only enter the property:\n- With proper written notice (varies by state, usually 7 days for inspections)\n- For specific permitted reasons (inspection, repairs, showing to buyers)\n- Between reasonable hours (typically 8am-8pm)\n- In emergencies, no notice is required\n\n## Bond Management\n\n- Bonds must be lodged with the state authority within the required timeframe\n- You cannot claim the bond without the tenant''s agreement or a tribunal order\n- Bond claims must be for actual loss, not general wear and tear\n\n## Discrimination\n\nIt is illegal to discriminate against tenants based on race, gender, age, disability, family status, or other protected attributes.',
  'legal',
  NULL,
  ARRAY['obligations', 'law', 'rights'],
  7,
  true,
  NOW()
),
-- NSW Specific
(
  'NSW Tenancy Laws: What Every Landlord Needs to Know',
  'nsw-tenancy-laws',
  E'# NSW Tenancy Laws\n\nNew South Wales residential tenancy is governed by the Residential Tenancies Act 2010.\n\n## Key Requirements\n\n### Bond\n- Maximum 4 weeks rent (6 weeks if weekly rent exceeds $1,250)\n- Must be lodged with NSW Fair Trading within 10 business days\n\n### Rent Increases\n- Fixed term: only if the agreement allows it and with 60 days written notice\n- Periodic: 60 days written notice required\n- Maximum one increase per 12-month period\n\n### Entry Notice\n- Routine inspections: 7 days written notice, max 4 per year\n- Repairs: 2 days notice\n- Prospective tenants/buyers: reasonable notice\n\n### Smoke Alarms\n- Must be installed on every level\n- Landlord responsible for installation and replacement\n- Tenant responsible for replacing batteries (unless unreachable)\n\n### Minimum Standards\n- All rental properties must meet minimum habitability standards\n- Adequate ventilation, natural light, and privacy\n- Functioning kitchen, bathroom, and laundry facilities\n\n### Ending a Tenancy\n- Landlord no-grounds termination: 90 days notice (periodic) \n- Tenant: 14 days for fixed term breach, 21 days periodic\n- No-grounds terminations are being phased out under reforms',
  'legal',
  'NSW',
  ARRAY['nsw', 'law', 'tenancy', 'bond', 'rent'],
  6,
  true,
  NOW()
),
-- VIC Specific
(
  'VIC Rental Laws: Gas Safety and Minimum Standards',
  'vic-rental-laws',
  E'# Victorian Rental Laws\n\nVictoria has some of the most comprehensive rental regulations in Australia, governed by the Residential Tenancies Act 1997.\n\n## Minimum Standards (Since 2021)\n\nAll Victorian rental properties must meet 14 minimum standards:\n- Functioning kitchen with stovetop and oven\n- Functioning bathroom and toilet\n- Hot and cold running water\n- Adequate heating in the main living area\n- Window coverings in bedrooms and living areas\n- External doors must be lockable\n- Adequate ventilation\n\n## Gas Safety Checks\n\n- Mandatory every 2 years by a licensed gasfitter\n- Applies to all properties with gas appliances or fittings\n- Landlord must provide a copy of the safety check to the tenant\n- Records must be kept for at least 5 years\n\n## Bond\n- Maximum 4 weeks rent (1 month for monthly-paid rent)\n- Must be lodged with RTBA within 10 business days\n\n## Rent Increases\n- Once per 12 months\n- 60 days written notice\n- Tenant can challenge excessive increases at VCAT\n\n## Renting Reforms\n\nVictoria has introduced significant reforms including:\n- Banning rental bidding\n- Limiting rent increases to once per year\n- Strengthening protections against unreasonable evictions',
  'legal',
  'VIC',
  ARRAY['vic', 'gas', 'safety', 'minimum-standards'],
  7,
  true,
  NOW()
),
-- Financial
(
  'Tax Deductions Every Landlord Should Know',
  'landlord-tax-deductions',
  E'# Tax Deductions for Landlords\n\nAs a property investor, you can claim many expenses against your rental income.\n\n## Immediately Deductible Expenses\n\n- Property management fees\n- Insurance premiums (building, landlord, contents)\n- Council rates and water charges\n- Body corporate fees\n- Land tax\n- Interest on your investment loan\n- Advertising for tenants\n- Cleaning and gardening\n- Pest control\n- Repairs and maintenance\n\n## Capital Works Deductions\n\n- Building constructed after 16 September 1987: 2.5% per year\n- Renovations and improvements: 2.5% per year\n- Must get a tax depreciation schedule from a qualified quantity surveyor\n\n## Depreciation\n\n- Plant and equipment items (carpets, blinds, appliances) can be depreciated\n- Must use the diminishing value or prime cost method\n- Items over $300 are depreciated over their effective life\n- Items $300 or under can be immediately written off\n\n## Record Keeping\n\n- Keep all receipts and records for at least 5 years\n- Use a dedicated bank account for rental income and expenses\n- Casa automatically tracks your income and expenses for easy tax reporting\n\n## Common Mistakes\n\n- Claiming the full cost of improvements as repairs\n- Not splitting personal and investment expenses correctly\n- Forgetting to claim depreciation on the building and fittings\n- Not keeping adequate records',
  'financial',
  NULL,
  ARRAY['tax', 'deductions', 'ato', 'depreciation'],
  6,
  true,
  NOW()
),
-- Maintenance
(
  'Urgent vs Routine Repairs: Your Legal Obligations',
  'urgent-vs-routine-repairs',
  E'# Urgent vs Routine Repairs\n\nUnderstanding the difference between urgent and routine repairs is critical for landlords.\n\n## Urgent Repairs\n\nUrgent repairs must be attended to as soon as possible. They include:\n\n- Burst water service or serious water leak\n- Blocked or broken toilet\n- Serious roof leak\n- Gas leak\n- Dangerous electrical fault\n- Flooding or serious flood damage\n- Serious storm, fire, or impact damage\n- Failure or breakdown of essential services (hot water, cooking, heating, cooling, laundry)\n- Fault likely to cause injury\n- Serious fault in staircase, lift, or other common area\n\n### Timeframes\n- NSW: As soon as possible, tenant can arrange repairs up to $1,000 if landlord is unresponsive\n- VIC: 24 hours, tenant can arrange urgent repairs up to $2,500\n- QLD: 24 hours for emergency repairs, 7 days for urgent\n\n## Routine Repairs\n\nEverything else is a routine repair. These should be addressed within a reasonable timeframe, typically:\n- 14-28 days depending on the nature of the repair\n- Your state may specify exact timeframes\n\n## Using Casa for Maintenance\n\nCasa automatically categorises repair requests by urgency and helps you:\n- Respond within required timeframes\n- Find qualified tradespeople\n- Track repair costs for tax purposes\n- Maintain a complete maintenance history',
  'maintenance',
  NULL,
  ARRAY['repairs', 'urgent', 'maintenance', 'obligations'],
  5,
  true,
  NOW()
),
-- Tenant Relations
(
  'Screening Tenants: A Complete Guide',
  'tenant-screening-guide',
  E'# Screening Tenants Effectively\n\nChoosing the right tenant is one of the most important decisions you''ll make as a landlord.\n\n## What to Check\n\n### Employment and Income\n- Verify employment with their employer directly\n- Income should be at least 3x the weekly rent\n- Consider stability of employment (contract vs permanent)\n- Self-employed? Ask for tax returns or business financials\n\n### Rental History\n- Contact previous landlords/agents (at least 2)\n- Check for any tribunal orders or blacklist entries\n- Verify length of previous tenancies\n- Ask about bond claims\n\n### References\n- Personal references can provide character insight\n- Professional references help verify employment\n- Always call references rather than just accepting written ones\n\n### Identity\n- Verify identity documents (driver''s licence, passport)\n- Ensure the application matches the ID provided\n\n## Red Flags\n\n- Reluctance to provide references\n- Gaps in rental history with no explanation\n- Frequent moves (less than 12 months per tenancy)\n- Income that doesn''t support the rent\n- Pressuring you for a quick decision\n\n## Legal Considerations\n\n- You cannot discriminate on protected grounds\n- You must comply with privacy laws when handling personal information\n- Keep application records secure\n- Inform unsuccessful applicants promptly\n\n## How Casa Helps\n\nCasa assists with tenant screening by:\n- Analysing application completeness\n- Flagging potential issues\n- Helping you compare multiple applicants\n- Storing records securely',
  'tenant_relations',
  NULL,
  ARRAY['screening', 'tenants', 'applications', 'references'],
  7,
  true,
  NOW()
),
-- QLD Specific
(
  'QLD Safety Compliance: Smoke Alarms and Safety Switches',
  'qld-safety-compliance',
  E'# QLD Safety Compliance\n\nQueensland has specific safety requirements that landlords must meet.\n\n## Smoke Alarms\n\nSince 1 January 2022, all QLD rental properties must have:\n- Interconnected photoelectric smoke alarms\n- In every bedroom\n- In hallways connecting bedrooms\n- On every level of the property\n\n### Key Requirements\n- Must be hardwired or have a 10-year lithium battery\n- Must be replaced every 10 years\n- Annual testing is the landlord''s responsibility\n- Must be compliant at the start of each new tenancy\n\n## Safety Switches (RCDs)\n\n- All power circuits must be protected by safety switches\n- Must be tested every 2 years by a licensed electrician\n- Testing certificate must be provided to the tenant\n\n## Pool Safety\n\n- Properties with pools must have a current pool safety certificate\n- Certificates are valid for 1 year (shared pools) or 2 years (non-shared)\n- Must be displayed in a prominent position at the pool\n- Must be registered with the QBCC\n\n## Penalties\n\nNon-compliance can result in:\n- Fines up to $2,611 per offence for smoke alarm violations\n- Body corporate liability for shared properties\n- Insurance claims may be denied for non-compliant properties\n\nCasa tracks all these compliance deadlines and reminds you before they''re due.',
  'compliance',
  'QLD',
  ARRAY['qld', 'smoke-alarms', 'safety-switch', 'pool', 'compliance'],
  5,
  true,
  NOW()
)
-- SA Specific
,(
  'SA Tenancy Laws: Bond, Rent and Notice Requirements',
  'sa-tenancy-laws',
  E'# South Australia Tenancy Laws\n\nSouth Australian residential tenancies are governed by the Residential Tenancies Act 1995.\n\n## Bond\n- Maximum 4 weeks rent (6 weeks for furnished properties)\n- Must be lodged with Consumer and Business Services (CBS)\n- Lodgement within CBS timelines\n\n## Rent Increases\n- Fixed term: only if the agreement allows it\n- Minimum 60 days written notice\n- Only once per 12 months\n\n## Entry Notice\n- Routine inspections: 7-14 days written notice\n- Repairs: 48 hours notice\n- Maximum 4 inspections per year\n\n## Smoke Alarms\n- Must comply with SA smoke alarm requirements\n- Landlord responsible for installation and compliance at start of tenancy\n\n## Ending a Tenancy\n- End of fixed term: 28 days notice by landlord\n- Periodic: 90 days notice (no grounds)\n- Breach: 14 days notice\n\n## Key Authority\n- SACAT handles disputes\n- Consumer and Business Services manages bonds\n\nCasa tracks all SA-specific deadlines and ensures you meet every requirement automatically.',
  'legal',
  'SA',
  ARRAY['sa', 'law', 'tenancy', 'bond', 'rent'],
  5,
  true,
  NOW()
),
-- WA Specific
(
  'WA Tenancy Laws: Understanding Western Australian Requirements',
  'wa-tenancy-laws',
  E'# Western Australia Tenancy Laws\n\nWA residential tenancies are governed by the Residential Tenancies Act 1987.\n\n## Bond\n- Maximum 4 weeks rent\n- Must be lodged with the Bond Administrator within 14 days\n- Landlord must provide a Property Condition Report at lease start\n\n## Rent Increases\n- Fixed term: only if the agreement provides for it\n- 60 days written notice required\n- No more than once every 6 months\n\n## Entry Notice\n- Routine inspections: 7-14 days written notice (72 hours minimum)\n- Maximum 4 inspections per year\n- Repairs: 72 hours notice\n\n## Safety Requirements\n- Working smoke alarms required (battery or hardwired)\n- RCDs on all power and lighting circuits\n- Pool safety barriers must comply with current standards\n\n## Ending a Tenancy\n- End of fixed term: 30 days notice by landlord\n- Periodic: 60 days notice (no grounds)\n- Breach: 14 days notice\n\n## Key Authority\n- Magistrates Court handles disputes (no specialist tribunal)\n- Department of Commerce manages bonds\n\nCasa ensures your WA properties stay compliant with all requirements.',
  'legal',
  'WA',
  ARRAY['wa', 'law', 'tenancy', 'bond', 'rent'],
  5,
  true,
  NOW()
),
-- TAS Specific
(
  'TAS Tenancy Laws: A Tasmanian Landlord Guide',
  'tas-tenancy-laws',
  E'# Tasmania Tenancy Laws\n\nTasmanian residential tenancies are governed by the Residential Tenancy Act 1997.\n\n## Bond\n- Maximum 4 weeks rent\n- Must be lodged with the Rental Deposit Authority within 10 business days\n\n## Rent Increases\n- 60 days written notice required\n- Only once per 12 months\n- Tenant can dispute at the Residential Tenancy Commissioner\n\n## Entry Notice\n- Routine inspections: 24 hours to 7 days written notice\n- Repairs: 24 hours notice\n- Maximum 4 inspections per year (once per quarter)\n\n## Safety Requirements\n- Working smoke alarms required on every level\n- Landlord responsible for compliance\n- Pool safety certificates required if applicable\n\n## Ending a Tenancy\n- End of fixed term: 14 days notice by landlord\n- Periodic: 42 days notice (no grounds)\n\n## Key Authority\n- Residential Tenancy Commissioner handles disputes\n- CBOS Tasmania manages bonds\n\nCasa tracks all Tasmania-specific deadlines and compliance requirements.',
  'legal',
  'TAS',
  ARRAY['tas', 'law', 'tenancy', 'bond', 'rent'],
  5,
  true,
  NOW()
),
-- NT Specific
(
  'NT Tenancy Laws: Northern Territory Landlord Requirements',
  'nt-tenancy-laws',
  E'# Northern Territory Tenancy Laws\n\nNT residential tenancies are governed by the Residential Tenancies Act 1999.\n\n## Bond\n- Maximum 4 weeks rent\n- Must be lodged with NT Consumer Affairs within 14 days\n\n## Rent Increases\n- 30 days written notice required\n- No more than once every 6 months\n\n## Entry Notice\n- Routine inspections: 24 hours notice\n- Maximum 4 inspections per year\n- Repairs: 24 hours notice\n\n## Safety Requirements\n- Working smoke alarms required\n- Landlord responsible for installation and compliance\n- Pool safety barriers must meet current standards\n\n## Ending a Tenancy\n- End of fixed term: 14 days notice by landlord\n- Periodic: 42 days notice (no grounds)\n- Breach: 14 days notice\n\n## Key Authority\n- NTCAT handles tenancy disputes\n- NT Consumer Affairs manages bonds\n\nCasa ensures NT landlords meet all compliance deadlines automatically.',
  'legal',
  'NT',
  ARRAY['nt', 'law', 'tenancy', 'bond', 'rent'],
  4,
  true,
  NOW()
),
-- ACT Specific
(
  'ACT Tenancy Laws: Understanding ACT Rental Requirements',
  'act-tenancy-laws',
  E'# ACT Tenancy Laws\n\nACT residential tenancies are governed by the Residential Tenancies Act 1997.\n\n## Bond\n- Maximum 4 weeks rent\n- Must be lodged with the Office of Rental Bonds within 4 weeks\n\n## Rent Increases\n- 8 weeks written notice required\n- Only once per 12 months\n- Tenant can apply to ACAT if increase is excessive\n\n## Entry Notice\n- Routine inspections: 1 week written notice\n- Repairs: 24 hours notice (or as agreed)\n- Maximum 4 inspections per year (once per quarter)\n\n## Minimum Housing Standards\n- The ACT has prescribed minimum housing standards\n- Includes energy efficiency requirements\n- Properties must meet standards before being leased\n- Includes ceiling insulation requirements\n\n## Ending a Tenancy\n- End of fixed term: 26 weeks notice by landlord (no grounds)\n- Periodic: 26 weeks notice (no grounds)\n- The ACT has some of the longest notice requirements in Australia\n\n## Key Authority\n- ACAT handles tenancy disputes\n- Access Canberra manages bonds\n\nCasa tracks all ACT-specific requirements including the unique energy efficiency standards.',
  'legal',
  'ACT',
  ARRAY['act', 'law', 'tenancy', 'bond', 'rent', 'energy'],
  5,
  true,
  NOW()
)
ON CONFLICT (slug) DO NOTHING;
