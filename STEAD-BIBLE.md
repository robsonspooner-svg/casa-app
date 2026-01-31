# PropBot Implementation Bible

> **Mission**: Build an AI-powered property management system that replaces traditional property managers, enabling owners to self-manage properties with 90%+ automation at 1/5th the cost.

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Market Analysis](#2-market-analysis)
3. [Technical Architecture](#3-technical-architecture)
4. [Database Schema](#4-database-schema)
5. [Agent System Design](#5-agent-system-design)
6. [Feature Specifications](#6-feature-specifications)
7. [Mobile App Design](#7-mobile-app-design)
8. [Integration Specifications](#8-integration-specifications)
9. [Security & Compliance](#9-security--compliance)
10. [Infrastructure & DevOps](#10-infrastructure--devops)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Business Model](#12-business-model)
13. [Go-to-Market Strategy](#13-go-to-market-strategy)

---

## 1. Product Vision

### 1.1 The Problem

Traditional property management costs **7-10% of rental income** (~$2,500-4,000/year on a $600/week property). Property owners tolerate this because self-managing is:

- **Time-consuming**: Tenant communications, inspections, maintenance coordination
- **Legally risky**: Compliance with tenancy laws, bond handling, notices
- **Emotionally draining**: Difficult tenants, arrears chasing, conflict resolution

### 1.2 The Solution

**PropBot** is an AI agent that handles 90%+ of property management tasks autonomously:

- **Finds tenants**: Lists, screens, and recommends the best applicants
- **Manages leases**: Generates compliant documents, handles bonds
- **Collects rent**: Auto-debits, tracks arrears, escalates when needed
- **Coordinates maintenance**: Triages requests, finds trades, books jobs
- **Conducts inspections**: Schedules and processes reports (self-service or outsourced)
- **Handles communications**: AI-powered tenant messaging 24/7

### 1.3 Value Proposition

| Traditional PM | Casa |
|----------------|------|
| $250-400/month | From $49/month |
| 9-5 availability | 24/7 AI agent |
| 24-72 hours to respond | Under 2 minutes |
| Generic service | Learns your preferences |
| Hidden fees | Flat monthly fee, transparent |
| Lock-in contracts | No lock-in, cancel anytime |

### 1.4 Target Customer

**Primary**: Property investors with 1-5 properties who:
- Currently use a PM but are frustrated with cost/service
- Currently self-manage but want automation
- Tech-comfortable (use apps for banking, etc.)
- Value control over their investment

**Secondary**: Accidental landlords (inherited property, moved overseas)

---

## 2. Market Analysis

### 2.1 Australian Rental Market

| Metric | Value |
|--------|-------|
| Total rental properties | ~3.1 million |
| Self-managed properties | ~930,000 (30%) |
| Professionally managed | ~2.17 million (70%) |
| Average weekly rent | $580 (national) |
| Average PM fee | 7.5% + GST |

### 2.2 Serviceable Market

| Segment | Properties | Annual Value |
|---------|------------|--------------|
| Frustrated PM users (want cheaper) | ~500,000 | $600M potential |
| Self-managers (want automation) | ~930,000 | $1.1B potential |
| **Total SAM** | ~1.4M | ~$1.7B |

### 2.3 Competitive Landscape

| Competitor | Model | Weakness |
|------------|-------|----------|
| PropertyMe | Software for PMs | Not for owners, B2B only |
| Kolmeo | Owner-PM platform | Still requires PM |
| :Different | Discount PM | Still 4-5%, human-dependent |
| Cubbi | Rent collection | Limited scope, no AI |
| **PropBot** | AI replaces PM | Full automation, fraction of cost |

### 2.4 Defensibility

1. **Data moat**: More properties → better tenant screening → better outcomes
2. **AI learning**: System improves at pricing, tenant selection, maintenance
3. **Network effects**: Outsourcing network (inspectors, trades) hard to replicate
4. **Switching cost**: Tenant relationships, payment history, lease data locked in
5. **Compliance engine**: State-specific legal templates continuously updated

---

## 3. Technical Architecture

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PROPBOT SYSTEM                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      CLIENT LAYER                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │   │
│  │  │  Owner App   │  │  Tenant App  │  │  Admin Panel │       │   │
│  │  │  (Expo RN)   │  │  (Expo RN)   │  │  (Next.js)   │       │   │
│  │  │  iOS/Android │  │  iOS/Android │  │  Web         │       │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │   │
│  └─────────┼─────────────────┼─────────────────┼───────────────┘   │
│            │                 │                 │                    │
│            └─────────────────┼─────────────────┘                    │
│                              │                                      │
│  ┌───────────────────────────▼─────────────────────────────────┐   │
│  │                      API LAYER                               │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │              SUPABASE                                │    │   │
│  │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐          │    │   │
│  │  │  │ PostgreSQL│ │   Auth    │ │  Realtime │          │    │   │
│  │  │  │   + RLS   │ │  (OAuth)  │ │   (WS)    │          │    │   │
│  │  │  └───────────┘ └───────────┘ └───────────┘          │    │   │
│  │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐          │    │   │
│  │  │  │  Storage  │ │   Edge    │ │  Vectors  │          │    │   │
│  │  │  │  (Photos) │ │ Functions │ │ (pgvector)│          │    │   │
│  │  │  └───────────┘ └───────────┘ └───────────┘          │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────▼─────────────────────────────────┐   │
│  │                     AGENT LAYER                              │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │         CLOUDFLARE (Workers + Durable Objects)       │    │   │
│  │  │                                                      │    │   │
│  │  │  ┌────────────────────────────────────────────────┐ │    │   │
│  │  │  │              Agent Engine (Single Agent)       │ │    │   │
│  │  │  │  • 3-pass reasoning loop (Claude API)          │ │    │   │
│  │  │  │  • State management (Durable Objects)           │ │    │   │
│  │  │  │  • 70+ tools across 7 categories                │ │    │   │
│  │  │  │  • Background tasks (cron + webhooks)           │ │    │   │
│  │  │  │  • Learning engine (corrections → rules)        │ │    │   │
│  │  │  └────────────────────────────────────────────────┘ │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────▼─────────────────────────────────┐   │
│  │                  INTEGRATION LAYER                           │   │
│  │                                                              │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │   │
│  │  │ Domain  │ │ Equifax │ │ Stripe  │ │ Twilio  │            │   │
│  │  │ REA     │ │ TICA    │ │ Connect │ │ SendGrid│            │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │   │
│  │  │ DocuSign│ │ hipages │ │ State   │ │ Banking │            │   │
│  │  │         │ │Airtasker│ │ APIs    │ │ (Basiq) │            │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Mobile Apps** | Expo (React Native) | One codebase, native feel, OTA updates |
| **Admin Web** | Next.js 14 (App Router) | React ecosystem, SSR, great DX |
| **API/Database** | Supabase | Postgres + Auth + Realtime + Storage, scales automatically |
| **Agent Runtime** | Cloudflare Workers | Edge-first, scales to zero, cheap |
| **Agent State** | Durable Objects | Stateful workflows, survives restarts |
| **Queues** | Cloudflare Queues | Reliable async processing |
| **AI** | Claude API (Anthropic) | Best reasoning, tool use, long context |
| **Payments** | Stripe Connect | Marketplace payments, owner receives directly |
| **Communications** | Twilio + SendGrid | SMS + Email, reliable delivery |
| **Documents** | DocuSign | Legally binding e-signatures |
| **Storage** | Supabase Storage (S3) | Photos, documents, inspection reports |

### 3.3 Why Supabase over NestJS

| Concern | NestJS | Supabase |
|---------|--------|----------|
| **Auth** | Implement yourself | Built-in (OAuth, MFA, RLS) |
| **Database** | Prisma migrations | Built-in migrations + GUI |
| **Realtime** | Socket.io setup | Built-in subscriptions |
| **Storage** | S3 integration | Built-in with transformations |
| **Security** | Middleware + guards | Row Level Security (database-level) |
| **Scaling** | Manage servers | Automatic |
| **Cost** | EC2/ECS expenses | Free tier generous, then usage-based |
| **Time to MVP** | 3-4 months | 4-6 weeks |

### 3.4 Why Cloudflare Workers over Traditional Backend

| Concern | Express/NestJS | Cloudflare Workers |
|---------|----------------|-------------------|
| **Cold start** | 500ms-2s | <10ms |
| **Scaling** | Configure auto-scaling | Automatic, infinite |
| **Cost** | $50-200/month minimum | Pay per request (cents) |
| **Global** | Deploy to regions | Runs in 300+ locations |
| **Stateful workflows** | Redis + custom logic | Durable Objects (built-in) |
| **Queues** | RabbitMQ/SQS setup | Cloudflare Queues (native) |

---

## 4. Database Schema

### 4.1 Core Entities

```sql
-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

-- Handled by Supabase Auth, but we extend with profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('owner', 'tenant', 'admin', 'inspector', 'trade')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PROPERTIES
-- =====================================================

CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id),

  -- Address
  street_address TEXT NOT NULL,
  unit_number TEXT,
  suburb TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT')),
  postcode TEXT NOT NULL,
  country TEXT DEFAULT 'AU',

  -- Property Details
  property_type TEXT NOT NULL CHECK (property_type IN ('house', 'apartment', 'townhouse', 'unit', 'studio', 'other')),
  bedrooms INTEGER NOT NULL,
  bathrooms INTEGER NOT NULL,
  parking INTEGER DEFAULT 0,
  land_size_sqm INTEGER,
  floor_size_sqm INTEGER,
  year_built INTEGER,

  -- Features (JSON array)
  features JSONB DEFAULT '[]',

  -- Compliance
  smoke_alarm_expiry DATE,
  safety_switch_installed BOOLEAN DEFAULT FALSE,
  pool_certificate_expiry DATE,
  gas_certificate_expiry DATE,

  -- Settings
  auto_approve_maintenance_under DECIMAL(10,2) DEFAULT 200.00,
  inspection_frequency_months INTEGER DEFAULT 3,

  -- Status
  status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant', 'listed', 'leased', 'inactive')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- LISTINGS
-- =====================================================

CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),

  -- Listing Details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  weekly_rent DECIMAL(10,2) NOT NULL,
  bond DECIMAL(10,2) NOT NULL,
  available_from DATE NOT NULL,
  lease_term_months INTEGER DEFAULT 12,

  -- Photos (array of storage URLs)
  photos JSONB DEFAULT '[]',
  virtual_tour_url TEXT,

  -- Syndication Status
  domain_listing_id TEXT,
  rea_listing_id TEXT,
  facebook_post_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'leased', 'expired')),

  -- Stats
  views_count INTEGER DEFAULT 0,
  enquiries_count INTEGER DEFAULT 0,
  applications_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- =====================================================
-- TENANCIES
-- =====================================================

CREATE TABLE tenancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  listing_id UUID REFERENCES listings(id),

  -- Dates
  start_date DATE NOT NULL,
  end_date DATE,
  lease_term_months INTEGER NOT NULL,

  -- Financials
  weekly_rent DECIMAL(10,2) NOT NULL,
  bond_amount DECIMAL(10,2) NOT NULL,
  bond_lodged BOOLEAN DEFAULT FALSE,
  bond_reference TEXT,

  -- Documents
  lease_document_url TEXT,
  entry_condition_report_id UUID,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'notice_given', 'ended')),
  notice_date DATE,
  vacate_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for tenants (supports multiple tenants per tenancy)
CREATE TABLE tenancy_tenants (
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenancy_id, tenant_id)
);

-- =====================================================
-- TENANT APPLICATIONS
-- =====================================================

CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),

  -- Applicant Details (may not have account yet)
  applicant_email TEXT NOT NULL,
  applicant_phone TEXT NOT NULL,
  applicant_first_name TEXT NOT NULL,
  applicant_last_name TEXT NOT NULL,

  -- Application Data
  current_address TEXT,
  current_rent DECIMAL(10,2),
  employment_status TEXT,
  employer_name TEXT,
  annual_income DECIMAL(12,2),

  -- References
  references JSONB DEFAULT '[]',
  -- Format: [{ type: 'rental' | 'employer' | 'personal', name, phone, email, relationship }]

  -- Documents
  id_document_url TEXT,
  payslips_urls JSONB DEFAULT '[]',
  rental_history_url TEXT,

  -- Screening Results
  credit_check_status TEXT CHECK (credit_check_status IN ('pending', 'passed', 'failed', 'review')),
  credit_check_score INTEGER,
  credit_check_report_url TEXT,
  tica_check_status TEXT CHECK (tica_check_status IN ('pending', 'clear', 'flagged')),
  reference_check_status TEXT CHECK (reference_check_status IN ('pending', 'completed')),
  reference_check_notes TEXT,

  -- AI Assessment
  ai_score INTEGER, -- 0-100
  ai_recommendation TEXT CHECK (ai_recommendation IN ('strong_yes', 'yes', 'maybe', 'no', 'strong_no')),
  ai_reasoning TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'screening', 'shortlisted', 'approved', 'rejected', 'withdrawn')),

  -- Owner Decision
  owner_decision TEXT CHECK (owner_decision IN ('approved', 'rejected')),
  owner_decision_at TIMESTAMPTZ,
  owner_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- RENT & PAYMENTS
-- =====================================================

CREATE TABLE rent_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id),

  due_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,

  -- Payment Status
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'due', 'paid', 'partial', 'overdue', 'waived')),
  paid_amount DECIMAL(10,2) DEFAULT 0,
  paid_at TIMESTAMPTZ,

  -- Payment Details
  stripe_payment_intent_id TEXT,
  payment_method TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  tenancy_id UUID REFERENCES tenancies(id),

  -- Transaction Details
  type TEXT NOT NULL CHECK (type IN ('rent', 'bond', 'maintenance', 'fee', 'refund', 'other')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,

  -- External References
  stripe_transfer_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MAINTENANCE
-- =====================================================

CREATE TABLE maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  tenancy_id UUID REFERENCES tenancies(id),
  reported_by UUID REFERENCES profiles(id),

  -- Issue Details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('plumbing', 'electrical', 'appliance', 'structural', 'pest', 'garden', 'cleaning', 'other')),
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('emergency', 'urgent', 'normal', 'low')),

  -- Photos
  photos JSONB DEFAULT '[]',

  -- AI Triage
  ai_category TEXT,
  ai_urgency TEXT,
  ai_estimated_cost DECIMAL(10,2),
  ai_suggested_trades JSONB DEFAULT '[]',

  -- Resolution
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'triaging', 'quoted', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled')),

  -- Owner Approval
  requires_approval BOOLEAN DEFAULT TRUE,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  approved_amount DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE maintenance_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id),
  trade_id UUID REFERENCES profiles(id),

  -- Quote Details
  trade_name TEXT NOT NULL,
  trade_phone TEXT,
  trade_email TEXT,

  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  estimated_duration TEXT,
  available_dates JSONB DEFAULT '[]',

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE maintenance_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id),
  quote_id UUID REFERENCES maintenance_quotes(id),
  trade_id UUID REFERENCES profiles(id),

  -- Scheduling
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,

  -- Completion
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  completion_photos JSONB DEFAULT '[]',

  -- Payment
  final_amount DECIMAL(10,2),
  paid BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INSPECTIONS
-- =====================================================

CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  tenancy_id UUID REFERENCES tenancies(id),

  -- Type
  type TEXT NOT NULL CHECK (type IN ('entry', 'routine', 'exit', 'pre_lease')),

  -- Scheduling
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,

  -- Execution
  conducted_by TEXT CHECK (conducted_by IN ('owner', 'tenant', 'inspector')),
  inspector_id UUID REFERENCES profiles(id),

  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'reminder_sent', 'in_progress', 'completed', 'cancelled', 'rescheduled')),

  -- Report
  report_url TEXT,
  report_data JSONB,

  -- For entry/exit comparisons
  compared_to_inspection_id UUID REFERENCES inspections(id),
  comparison_report_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,

  -- Location in property
  room TEXT NOT NULL,
  item TEXT NOT NULL,

  -- Assessment
  condition TEXT NOT NULL CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'damaged', 'missing')),
  notes TEXT,
  photos JSONB DEFAULT '[]',

  -- For comparisons
  previous_condition TEXT,
  condition_changed BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- COMMUNICATIONS
-- =====================================================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id),
  tenancy_id UUID REFERENCES tenancies(id),

  -- Participants
  owner_id UUID NOT NULL REFERENCES profiles(id),
  tenant_id UUID REFERENCES profiles(id),

  -- Context
  type TEXT NOT NULL CHECK (type IN ('general', 'maintenance', 'inspection', 'lease', 'application', 'arrears')),
  related_entity_id UUID, -- ID of related maintenance_request, inspection, etc.

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'resolved')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- Sender
  sender_type TEXT NOT NULL CHECK (sender_type IN ('owner', 'tenant', 'agent', 'system')),
  sender_id UUID REFERENCES profiles(id),

  -- Content
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',

  -- AI-generated flag
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_approved BOOLEAN,

  -- Delivery
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AGENT SYSTEM (9 tables - see Section 5.8)
-- Full schema in: supabase/migrations/XXXXXXXX_agent_system.sql
-- =====================================================

-- Conversations & Messages
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),
  title TEXT,
  context_summary TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  feedback TEXT CHECK (feedback IN ('positive', 'negative', 'correction')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decisions & Trajectories (learning data)
CREATE TABLE agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id),
  property_id UUID REFERENCES properties(id),
  decision_type TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input_data JSONB NOT NULL,
  output_data JSONB,
  reasoning TEXT,
  confidence DECIMAL(3,2),
  autonomy_level INTEGER NOT NULL DEFAULT 1,
  owner_feedback TEXT CHECK (owner_feedback IN ('approved', 'rejected', 'corrected')),
  owner_correction TEXT,
  embedding vector(1536),  -- pgvector for precedent search
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_trajectories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id),
  tool_sequence JSONB NOT NULL,  -- [{tool, input, output, duration_ms}]
  total_duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  efficiency_score DECIMAL(3,2),  -- vs similar past trajectories
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning Engine
CREATE TABLE agent_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),  -- NULL = global
  rule_text TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.7,
  source TEXT NOT NULL CHECK (source IN ('correction_pattern', 'explicit', 'inferred')),
  correction_ids UUID[] DEFAULT '{}',  -- corrections that generated this rule
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES agent_decisions(id),
  original_action TEXT NOT NULL,
  correction TEXT NOT NULL,
  context_snapshot JSONB NOT NULL,
  pattern_matched BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),
  category TEXT NOT NULL,
  preference_key TEXT NOT NULL,
  preference_value JSONB NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('explicit', 'inferred', 'default')),
  confidence DECIMAL(3,2) DEFAULT 1.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, property_id, category, preference_key)
);

-- Pending Actions & Background Tasks
CREATE TABLE agent_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id),
  property_id UUID REFERENCES properties(id),
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  preview_data JSONB,  -- shows owner what will happen
  tool_name TEXT NOT NULL,
  tool_params JSONB NOT NULL,
  autonomy_level INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  expires_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_background_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),
  task_type TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('cron', 'webhook', 'event')),
  schedule TEXT,  -- cron expression if cron trigger
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  result_data JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- OUTSOURCING NETWORK
-- =====================================================

CREATE TABLE service_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),

  -- Provider Details
  business_name TEXT NOT NULL,
  abn TEXT,
  service_type TEXT NOT NULL CHECK (service_type IN ('inspector', 'trade', 'open_home_host', 'photographer')),

  -- Coverage
  service_areas JSONB DEFAULT '[]', -- Array of postcodes or suburbs

  -- Availability
  available BOOLEAN DEFAULT TRUE,
  availability_schedule JSONB,

  -- Ratings
  rating DECIMAL(2,1),
  jobs_completed INTEGER DEFAULT 0,

  -- Verification
  verified BOOLEAN DEFAULT FALSE,
  insurance_verified BOOLEAN DEFAULT FALSE,
  license_verified BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_trajectories ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_pending_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_background_tasks ENABLE ROW LEVEL SECURITY;

-- Example policies (expand for each table)
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Owners can read their properties"
  ON properties FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Tenants can read their tenancy property"
  ON properties FOR SELECT
  USING (
    id IN (
      SELECT property_id FROM tenancies t
      JOIN tenancy_tenants tt ON t.id = tt.tenancy_id
      WHERE tt.tenant_id = auth.uid()
      AND t.status = 'active'
    )
  );

-- ... more policies for each table and operation
```

### 4.2 Indexes for Performance

```sql
-- Properties
CREATE INDEX idx_properties_owner ON properties(owner_id);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_location ON properties(state, suburb);

-- Tenancies
CREATE INDEX idx_tenancies_property ON tenancies(property_id);
CREATE INDEX idx_tenancies_status ON tenancies(status);
CREATE INDEX idx_tenancies_dates ON tenancies(start_date, end_date);

-- Rent Schedule
CREATE INDEX idx_rent_schedule_tenancy ON rent_schedule(tenancy_id);
CREATE INDEX idx_rent_schedule_due ON rent_schedule(due_date, status);

-- Maintenance
CREATE INDEX idx_maintenance_property ON maintenance_requests(property_id);
CREATE INDEX idx_maintenance_status ON maintenance_requests(status);
CREATE INDEX idx_maintenance_urgency ON maintenance_requests(urgency, status);

-- Messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- Agent System
CREATE INDEX idx_agent_conversations_user ON agent_conversations(user_id);
CREATE INDEX idx_agent_messages_conversation ON agent_messages(conversation_id);
CREATE INDEX idx_agent_decisions_user ON agent_decisions(user_id);
CREATE INDEX idx_agent_decisions_embedding ON agent_decisions USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_agent_rules_user ON agent_rules(user_id, active);
CREATE INDEX idx_agent_pending_actions_user ON agent_pending_actions(user_id, status);
CREATE INDEX idx_agent_background_tasks_next ON agent_background_tasks(next_run_at, status);
```

---

## 5. Agent System Design

> **Full architecture specification**: See `/specs/AGENT-ARCHITECTURE.md` for complete implementation details.

### 5.1 Design Philosophy

```
"The owner never configures complexity. They just use the app, approve or correct actions, and the system adapts."
```

The Stead agent operates like a frontier-level autonomous property manager that:
1. **Starts silent** — deploys infrastructure at Mission 03, surfaces intelligence progressively
2. **Learns from corrections** — every owner correction becomes a rule that prevents future mistakes
3. **Graduates autonomy** — conservative defaults (L1-L2), earns trust through successful actions
4. **Orchestrates everything** — one agent with many tools, not separate domain agents
5. **Runs 24/7** — background tasks handle rent monitoring, inspection scheduling, arrears escalation

### 5.2 Architecture: Three Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│ MOBILE APP (Expo)                                                    │
│  @stead/agent-client: hooks + UI components                         │
│  - useAgentInsight() (M03+): contextual suggestion cards            │
│  - useAgentActions() (M03+): pending approvals                      │
│  - useAgent() (M14+): full conversation interface                   │
│  - AgentInsightCard, ActionCard, AgentChat components               │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │ HTTP/SSE
┌───────────────────────────────────▼─────────────────────────────────┐
│ CLOUDFLARE WORKER (Runtime)                                          │
│  workers/agent/                                                      │
│  - Durable Objects: AgentSession (conversation), BackgroundTask      │
│  - Engine: 3-pass loop (think+plan → execute+verify → calibrate)     │
│  - Tools: 87 tools across 7 categories (with resilience)             │
│  - Learning: correction tracker, preference engine, trajectory       │
│  - Triggers: cron (daily/weekly), webhooks (DB events)               │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │ Service Role Key
┌───────────────────────────────────▼─────────────────────────────────┐
│ SUPABASE (Data)                                                      │
│  Agent tables: conversations, messages, decisions, trajectories,     │
│  rules, corrections, preferences, pending_actions, background_tasks  │
│  + pgvector for precedent search                                     │
│  + Realtime for action notifications                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 New Packages

| Package | Purpose | Used By |
|---------|---------|---------|
| `packages/agent-core/` | 87 tool definitions, resilience configs, workflow compositions, autonomy types (no runtime deps) | Mobile app + Worker |
| `packages/agent-client/` | React hooks + UI components for agent interactions | Mobile apps |
| `workers/agent/` | Cloudflare Worker runtime with agentic loop | Production runtime |

**`packages/agent-core/` File Structure:**
```
src/
├── types/
│   ├── autonomy.ts      — AutonomyLevel, RiskLevel, ErrorCategory, graduation constants
│   ├── tools.ts         — ToolDefinition, ToolContext, ToolResult, AgentRule, AgentPreference
│   ├── decisions.ts     — AgentDecision, AgentTrajectory, AgentPendingAction
│   ├── rules.ts         — AgentCorrection, CorrectionContext, GeneratedRule
│   ├── preferences.ts   — PropertyDefaults, DEFAULT_PROPERTY_PREFERENCES
│   ├── resilience.ts    — RetryConfig, CircuitBreakerConfig, TimeoutConfig, FallbackConfig, IdempotencyConfig
│   └── workflows.ts     — WorkflowStep, WorkflowDefinition, WorkflowCheckpoint, BackgroundTaskDefinition
├── constants/
│   ├── autonomy-defaults.ts   — CATEGORY_DEFAULT_AUTONOMY, NEVER_AUTO_EXECUTE, GRADUATED_AUTO_EXECUTE
│   ├── risk-matrix.ts         — ACTION_RISK_MATRIX (87 tools), financial threshold
│   ├── tool-catalog.ts        — TOOL_CATALOG (87 complete tool definitions with resilience)
│   ├── circuit-breakers.ts    — CIRCUIT_BREAKER_CONFIGS (13 services), notification fallback chain
│   ├── workflows.ts           — 5 workflow compositions with steps, gates, compensation
│   └── background-tasks.ts    — 12 background task definitions (cron + event triggers)
└── index.ts                   — All exports
```

### 5.4 Autonomy Levels

| Level | Name | Behavior | Example |
|-------|------|----------|---------|
| **L0** | Inform | Notify only | "Rent is due tomorrow" |
| **L1** | Suggest | Recommend, owner confirms | "Should I send a breach notice?" |
| **L2** | Draft | Prepare for review | "Here's a listing description..." |
| **L3** | Execute | Act, report after | "Sent rent reminder to tenant" |
| **L4** | Autonomous | Silent, logged only | Auto-track payment status |

**Progressive graduation**: After 10+ successful uses with 0 corrections → suggest level upgrade. Owner approves with one tap.

### 5.5 Core Agent Loop: 3-Pass Reasoning

```
Pass 1: THINK + PLAN
  - Assemble context (owner rules, preferences, property data, recent trajectories)
  - Claude receives system prompt with injected rules + precedent examples
  - For complex requests: uses plan_task tool to decompose first

Pass 2: EXECUTE + VERIFY
  - Tool calls dispatched with autonomy gating
  - If autonomy insufficient → create pending_action, return partial response
  - If tool fails → retry with different approach (max 10 iterations)
  - Each step recorded in trajectory

Pass 3: CALIBRATE (async, after response sent)
  - Record full trajectory
  - Compare efficiency vs similar past trajectories
  - Update rule confidence scores
  - Check for autonomy graduation opportunities
```

### 5.6 Tool System (87 Tools, 7 Categories)

Every tool the agent uses is defined with complete resilience configuration:

```typescript
interface ToolDefinition {
  name: string;
  description: string;         // LLM reads this to decide usage
  input_schema: JSONSchema;
  category: 'query' | 'action' | 'generate' | 'integration' | 'workflow' | 'memory' | 'planning';
  autonomyLevel: 0 | 1 | 2 | 3 | 4;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  reversible: boolean;
  availableFromMission: number;
  resilience: ToolResilience;   // Retry, circuit breaker, timeout, fallback, idempotency
  compensationTool?: string;    // Tool to call to undo this action
  dependsOn?: string[];         // Tools that must succeed first in workflows
}
```

**Tool Count by Category:**
| Category | Count | Default Autonomy | Examples |
|----------|-------|-------------------|----------|
| Query | 22 | L4 (Autonomous) | get_property, get_arrears, get_listings |
| Action | 28 | L2 (Draft) | send_message, create_maintenance, approve_quote |
| Generate | 13 | L2 (Draft) | generate_listing, triage_maintenance, generate_lease |
| Integration | 12 | L1 (Suggest) | collect_rent_stripe, send_docusign, syndicate_listing |
| Workflow | 5 | L1 (Suggest) | workflow_find_tenant, workflow_onboard_tenant |
| Memory | 4 | L4 (Autonomous) | remember, recall, search_precedent |
| Planning | 3 | L3 (Execute) | plan_task, check_plan, replan |

### 5.6.1 Resilience Architecture

Every tool failure is classified into one of 6 categories with defined handling:

| Error Category | Behavior | Examples |
|---------------|----------|----------|
| Transient (E1xx) | Retry with backoff | Network timeout, rate limit, 502/503 |
| Degraded (E2xx) | Retry then fallback | API slow, partial data |
| Permanent-System (E3xx) | Fallback path, alert ops | API removed, auth revoked |
| Permanent-Logic (E4xx) | Return to agent for re-plan | Invalid input, entity not found |
| User-Action-Required (E5xx) | Escalate to owner | Insufficient funds, legal decision |
| Safety-Halt (E6xx) | Stop execution, notify admin | Data corruption, compliance violation |

**Resilience primitives per tool:**
- **Retry**: Configurable attempts, exponential backoff, jitter, per-error-category eligibility
- **Circuit Breaker**: Per-service (13 external services), failure threshold, half-open recovery
- **Timeout**: 5 tiers (fast 5s, standard 10s, extended 30s, long 60s, workflow 120s)
- **Fallback**: cache / queue / alternative_tool / manual_escalation / skip
- **Idempotency**: Key generation from input fields, KV storage with TTL

**Notification Fallback Chain** (cascade until success):
1. Push (Expo) → 8s timeout
2. SMS (Twilio) → 10s timeout
3. Email (SendGrid) → 15s timeout
4. In-App (DB write) → always succeeds

**Payment Retry Strategy:**
- Max 1 auto-retry (never more)
- Card: retry after 2 business days
- BECS: retry after 5 days (3-day pre-notification required)
- After retry exhausted → escalate to arrears workflow

### 5.6.2 Workflow Compositions (5 Multi-Step Workflows)

Workflows orchestrate tools with checkpoints, gates, and compensation:

| Workflow | Steps | Key Gates | Duration |
|----------|-------|-----------|----------|
| `workflow_find_tenant` | 14 | Owner approval (listing draft, tenant selection) | Up to 30 days |
| `workflow_onboard_tenant` | 10 | Owner approval (lease review), webhook (signatures) | Up to 14 days |
| `workflow_end_tenancy` | 8 | Owner approval (bond deductions), webhook (inspection) | Up to 30 days |
| `workflow_maintenance_lifecycle` | 8 | Owner approval (if over threshold), webhook (completion) | Up to 14 days |
| `workflow_arrears_escalation` | 6 | Owner approval (breach notice, escalation decision) | Up to 30 days |

**Workflow features:**
- Checkpoint after each step (Durable Object state)
- Compensation stack for rollback on failure
- Gates: `owner_approval`, `webhook_wait`, `schedule_wait`
- `perItem` execution for batch operations (e.g., score each application)
- `optional` steps that don't halt workflow on failure
- Resumable after pause/failure within defined window

### 5.6.3 Background Tasks (12 Automated Triggers)

| Task | Trigger | Autonomy | Mission |
|------|---------|----------|---------|
| Rent due detection | Cron: daily 6am | L4 | M07 |
| Auto-pay processing | Cron: daily 6am | L3 | M07 |
| Arrears detection | Cron: daily 7am | L3 | M08 |
| Arrears escalation | Cron: daily 9am | L1 | M08 |
| Compliance checking | Cron: daily 8am | L4 | M15 |
| Compliance reminders | Cron: daily 8:30am | L2 | M15 |
| Inspection scheduling | Cron: weekly Mon 8am | L3 | M11 |
| Lease expiry alert | Cron: weekly Mon 8am | L2 | M06 |
| Listing performance | Cron: weekly Fri 5pm | L4 | M04 |
| Monthly reports | Cron: 1st of month 6am | L3 | M13 |
| Payment retry | Event: payment_failed | L3 | M07 |
| Maintenance triage | Event: maintenance_created | L3 | M09 |

### 5.6.4 Progressive Tool Unlock by Mission

Tools only become available when their mission's data layer exists:
- **M03**: 6 tools (property queries, memory, pending actions)
- **M04**: +9 tools (listings, syndication, generate_listing, suggest_rent_price)
- **M05**: +9 tools (applications, scoring, credit/TICA checks)
- **M06**: +10 tools (tenancy, lease, bond, onboarding workflows)
- **M07**: +11 tools (payments, Stripe, receipts, financial queries)
- **M08**: +7 tools (arrears, reminders, breach notices, escalation)
- **M09**: +7 tools (maintenance, triage, cost estimation)
- **M10**: +6 tools (trades, quotes, work orders, Hipages)
- **M11**: +5 tools (inspections, reports, comparison)
- **M12**: +6 tools (conversations, SMS, email, push notifications)
- **M13**: +2 tools (financial reports, rent analysis)
- **M14**: +4 tools (planning, precedent search)
- **M15**: +4 tools (compliance, documents, owner rules)

### 5.7 Learning Pipeline: Corrections → Rules

```
Owner corrects action
    ↓
Store in agent_corrections (with context snapshot)
    ↓
Pattern detection: 3+ similar corrections?
    ↓  YES
Claude generates rule from pattern
    ↓
Rule stored in agent_rules (confidence: 0.7)
    ↓
Rule injected into system prompt for future calls
    ↓
Rule confidence grows with successful applications
    ↓
Eventually tool auto-executes at L3+ (no more asking)
```

### 5.8 Agent Database Schema (9 Tables)

| Table | Purpose |
|-------|---------|
| `agent_conversations` | Chat sessions with context summary |
| `agent_messages` | Messages with tool calls/results and feedback |
| `agent_decisions` | Audit trail + pgvector embedding for precedent search |
| `agent_trajectories` | Recorded execution paths (tool sequences + outcomes) |
| `agent_rules` | Learned constraints (from corrections or explicit) |
| `agent_corrections` | Owner corrections (input for rule generation) |
| `agent_preferences` | Owner settings + inferred preferences |
| `agent_pending_actions` | Actions awaiting approval with preview data |
| `agent_background_tasks` | Scheduled/triggered tasks with progress tracking |

All tables have RLS: `auth.uid() = user_id`. The Worker uses service-role key with application-level ownership checks.

### 5.9 Mission Integration Timeline

| Mission | Agent Capability | Autonomy |
|---------|-----------------|----------|
| **03: Properties** | Deploy all 9 agent tables. Silent observer starts. | Infrastructure only |
| **04: Listings** | `generate_listing` tool. First visible AI: "Generate description" button. | L2 (draft) |
| **05: Applications** | `score_application`, `rank_applications`. AI scoring with reasoning. | L1-L2 |
| **06: Tenancies** | `workflow_onboard_tenant`. Multi-step coordination. | L1-L2 |
| **07: Rent** | Payment monitoring, receipt generation. Background tasks begin. | L3-L4 |
| **08: Arrears** | Escalation ladder (Day 1→3→7→14). Auto-send friendly reminders. | L1-L3 |
| **09: Maintenance** | Webhook trigger → AI triage. `triage_maintenance`, `estimate_cost`. | L2-L3 |
| **10: Trades** | `find_trades`, `request_quotes`, `compare_quotes`. | L2 |
| **11: Inspections** | Compliance scheduler. Auto-schedule within window. | L2-L3 |
| **12: Communications** | `draft_message`, `send_message`. Graduates to L3 for routine. | L2-L3 |
| **13: Reports** | Auto-generate monthly summaries. Anomaly detection. | L0-L4 |
| **14: Agent Chat** | Full conversation UI (FAB). All tools in natural language. | All levels |
| **15: Learning** | Correction-to-rule pipeline fully active. Autonomy dashboard. | Meta |

### 5.10 Safety & Escalation

**NEVER auto-execute (regardless of autonomy level):**
- `terminate_lease`, `claim_bond`, `eviction_notice` — Legal/irreversible
- `change_rent_amount`, `accept_application`, `reject_application` — Significant decisions
- `generate_notice` — Legal document generation
- `refund_payment_stripe` — Financial reversals
- Any action above owner's financial threshold (default $200 AUD)
- Confidence below 0.4

**Graduated auto-execute (after N owner approvals):**
| Approvals | Tools |
|-----------|-------|
| 0 (always auto) | `triage_maintenance`, `send_receipt`, `send_push_expo` |
| 1 | `schedule_inspection`, `retry_payment` |
| 2 | `send_rent_reminder`, `send_message`, `create_maintenance` |
| 3 | `update_maintenance_status`, `send_sms_twilio`, `send_email_sendgrid`, `shortlist_application` |
| 5 | `create_work_order`, `publish_listing`, `syndicate_listing_domain`, `syndicate_listing_rea`, `approve_quote` |

### 5.11 Conversation UI (Mission 14+)

The chat interface sits as a **floating action button (FAB)** on the main app layout. Pre-M14, the agent surfaces through:
- `AgentInsightCard` — contextual tips on relevant screens
- `ActionCard` — pending approvals in a notifications-style list
- Background task results appearing as toast/notification

### 5.12 Tool-to-Platform Integration (End-to-End Execution)

This section defines exactly how the 87 tools in `@stead/agent-core` connect to the Cloudflare Worker runtime, Supabase data layer, and mobile client — ensuring every agentic activity works seamlessly and reliably.

#### 5.12.1 Complete Request Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TOOL EXECUTION LIFECYCLE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  1. CLIENT REQUEST                                                            │
│     ─────────────────                                                         │
│     Mobile app sends AgentRequest (message + propertyIds + conversationId)    │
│     via HTTP POST to workers/agent/                                           │
│     If stream: true → opens SSE connection                                    │
│                                                                               │
│  2. WORKER ROUTING                                                            │
│     ──────────────────                                                        │
│     Worker entry point validates JWT → resolves user                          │
│     Routes to AgentSession Durable Object (keyed by conversationId)           │
│     If new conversation → creates new AgentSession                            │
│                                                                               │
│  3. CONTEXT ASSEMBLY (ContextAssembler)                                       │
│     ────────────────────────────────────                                      │
│     a. Load owner's agent_rules (active, sorted by confidence)                │
│     b. Load owner's agent_preferences (property-scoped)                       │
│     c. Load recent agent_trajectories (pgvector: similar context)             │
│     d. Determine mission level (which tools are available)                    │
│     e. Resolve financial threshold from preferences                           │
│     f. Build ExecutionContext object                                          │
│                                                                               │
│  4. TOOL ROUTING (ToolRouter)                                                 │
│     ──────────────────────────                                                │
│     a. Filter TOOL_CATALOG by availableFromMission <= context.missionLevel    │
│     b. Resolve autonomy per tool (AutonomyResolution):                        │
│        - Check NEVER_AUTO_EXECUTE → always L0                                 │
│        - Check GRADUATED_AUTO_EXECUTE + approval count                        │
│        - Check owner preference overrides                                     │
│        - Check applicable agent_rules                                         │
│        - Apply risk ceiling (RISK_TO_MAX_AUTONOMY)                            │
│     c. Format available tools as ClaudeToolDefinition[]                       │
│     d. Build autonomyMap: Record<toolName, AutonomyResolution>                │
│                                                                               │
│  5. SYSTEM PROMPT ASSEMBLY (PromptBuilder)                                    │
│     ──────────────────────────────────────                                    │
│     a. Base system prompt (agent identity, capabilities)                      │
│     b. Inject owner's active rules (from agent_rules)                         │
│     c. Inject relevant preferences                                            │
│     d. Inject trajectory precedents ("Last time you did X, owner corrected")  │
│     e. Inject autonomy context ("You can auto-execute: [...], must ask: [...]")│
│     f. Property context (address, tenancy, current issues)                    │
│                                                                               │
│  6. THREE-PASS REASONING LOOP                                                 │
│     ─────────────────────────────                                             │
│     ┌─────────────────────────────────────────────────┐                       │
│     │ PASS 1: THINK + PLAN                            │                       │
│     │ Claude receives: system prompt + tools + message│                       │
│     │ Claude responds: text + tool_use calls          │                       │
│     │ Stream text tokens to client via SSE            │                       │
│     └─────────────────────────┬───────────────────────┘                       │
│                               │ tool_use response                             │
│     ┌─────────────────────────▼───────────────────────┐                       │
│     │ PASS 2: EXECUTE + VERIFY (per tool call)        │                       │
│     │                                                  │                       │
│     │ For each tool_use in Claude's response:          │                       │
│     │   a. Resolve AutonomyResolution                 │                       │
│     │   b. Check autonomy gate:                       │                       │
│     │      - If requiresApproval → create pending     │                       │
│     │        action, send SSE 'tool_gated' event      │                       │
│     │      - If auto-execute → proceed to (c)         │                       │
│     │   c. Check idempotency (KV lookup):             │                       │
│     │      - If key exists → return cached result     │                       │
│     │      - If not → proceed to (d)                  │                       │
│     │   d. Check circuit breaker state:               │                       │
│     │      - If open → use fallback immediately       │                       │
│     │      - If closed/half-open → proceed to (e)     │                       │
│     │   e. Execute tool with timeout:                 │                       │
│     │      - Send SSE 'tool_start' event              │                       │
│     │      - Run tool implementation with timeout     │                       │
│     │      - On success: send SSE 'tool_result',      │                       │
│     │        store idempotency key, reset breaker     │                       │
│     │      - On failure: classify error category      │                       │
│     │        → Retry if Transient/Degraded            │                       │
│     │        → Fallback if retries exhausted          │                       │
│     │        → Escalate if UserActionRequired         │                       │
│     │        → Halt if SafetyHalt                     │                       │
│     │   f. Return ToolExecutionResult                 │                       │
│     │                                                  │                       │
│     │ Feed all tool results back to Claude             │                       │
│     │ Claude generates final response text             │                       │
│     └─────────────────────────┬───────────────────────┘                       │
│                               │                                               │
│     ┌─────────────────────────▼───────────────────────┐                       │
│     │ PASS 3: CALIBRATE (async, non-blocking)         │                       │
│     │                                                  │                       │
│     │ a. Record trajectory in agent_trajectories      │                       │
│     │ b. Generate decision embedding (pgvector)       │                       │
│     │ c. Score trajectory efficiency                  │                       │
│     │ d. Check graduation eligibility                 │                       │
│     │ e. Update agent_background_tasks progress       │                       │
│     └─────────────────────────────────────────────────┘                       │
│                                                                               │
│  7. RESPONSE DELIVERY                                                         │
│     ─────────────────────                                                     │
│     SSE: send 'done' event with messageId, toolsUsed, duration                │
│     HTTP: return AgentResponse JSON                                           │
│                                                                               │
│  8. CLIENT HANDLING                                                           │
│     ─────────────────                                                         │
│     - useAgent() hook processes SSE stream                                    │
│     - ToolSummary components render tool call results                         │
│     - ActionCard renders pending approvals inline                             │
│     - WorkflowProgress shows multi-step status                                │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 5.12.2 Tool Execution Pipeline (Detailed)

```typescript
// This is the execution path inside the Worker. Each tool call goes through:

async function executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
  const { toolName, toolInput, context, autonomy, toolDef } = request;
  const { resilience } = toolDef;

  // 1. AUTONOMY GATE
  if (autonomy.requiresApproval) {
    const pendingId = await createPendingAction(toolName, toolInput, context);
    return { executed: false, pendingActionId: pendingId, ... };
  }

  // 2. IDEMPOTENCY CHECK
  if (resilience.idempotency.required) {
    const key = buildIdempotencyKey(context.userId, toolName, toolInput, resilience.idempotency);
    const cached = await kvGet(key);
    if (cached) return { executed: true, result: cached, ... };
  }

  // 3. CIRCUIT BREAKER CHECK
  if (resilience.circuitBreaker) {
    const breaker = await getCircuitBreakerState(toolName);
    if (breaker.state === 'open') {
      return await executeFallback(toolDef, toolInput, context);
    }
  }

  // 4. EXECUTE WITH RETRY + TIMEOUT
  let lastError: Error;
  for (let attempt = 0; attempt <= resilience.retry.maxAttempts; attempt++) {
    try {
      const result = await withTimeout(
        toolImplementation(toolName, toolInput, context),
        resilience.timeout.executionMs
      );
      // Success: store idempotency, reset breaker, return
      await storeIdempotency(key, result, resilience.idempotency.ttlSeconds);
      await resetCircuitBreaker(toolName);
      return { executed: true, result, retriesUsed: attempt, ... };
    } catch (error) {
      lastError = error;
      const category = classifyError(error);
      if (!resilience.retry.retryableErrors.includes(category)) break;
      await delay(calculateBackoff(attempt, resilience.retry));
    }
  }

  // 5. ALL RETRIES EXHAUSTED — FALLBACK
  await recordCircuitBreakerFailure(toolName);
  return await executeFallback(toolDef, toolInput, context);
}
```

#### 5.12.3 Durable Object State Management

The `AgentSession` Durable Object maintains per-conversation state:

| State Key | Type | Purpose |
|-----------|------|---------|
| `conversationId` | string | Session identifier |
| `messageHistory` | Message[] | Sliding window (last 20 messages) |
| `circuitBreakers` | Record<string, CircuitBreakerStatus> | Per-service breaker state |
| `workflowCheckpoint` | WorkflowCheckpoint | Active workflow state |
| `toolCallCount` | number | Current iteration count (max 10) |
| `accumulatedContext` | Record<string, unknown> | Context built across tool calls |

For **Background Tasks**, a separate `BackgroundTask` Durable Object:
- Triggered by cron (Cloudflare Worker scheduled events)
- Iterates all active users → runs task for each
- Uses same `executeTool` pipeline (same resilience, same gates)
- Results written to `agent_background_tasks` table

#### 5.12.4 Pending Action Resolution Flow

```
Owner taps "Approve" on ActionCard in mobile app
    │
    ▼
HTTP POST /agent/actions/:id/resolve { decision: 'approve' }
    │
    ▼
Worker loads pending action from agent_pending_actions
    │
    ▼
Resolves original ToolExecutionRequest with stored params
    │
    ▼
Executes tool (same pipeline: idempotency → breaker → retry → fallback)
    │
    ▼
Records in agent_decisions (for precedent search)
    │
    ▼
Increments approval count for graduation tracking
    │
    ▼
If inside a workflow → advances to next step (via WorkflowCheckpoint)
    │
    ▼
Push notification to owner: "Done: [tool result summary]"
```

#### 5.12.5 Workflow Execution Integration

Workflows use the same tool execution pipeline but add orchestration:

```
WorkflowEngine.execute(workflowDef, context):
  │
  for each step in workflow.steps:
  │
  ├── If step.gate === 'owner_approval':
  │     Create pending action → pause → checkpoint state → wait
  │     (Resumed when owner approves via PendingActionResolution)
  │
  ├── If step.gate === 'webhook_wait':
  │     Checkpoint state → wait for webhook trigger
  │     (Resumed when Supabase trigger fires matching event)
  │
  ├── If step.gate === 'schedule_wait':
  │     Checkpoint state → set Durable Object alarm
  │     (Resumed when alarm fires at scheduled time)
  │
  ├── Execute step.toolName via executeTool pipeline
  │     - If step.perItem: execute once per item in previous result
  │     - If step.optional: don't halt on failure
  │     - Push CompensationAction onto stack
  │
  ├── Checkpoint after each step (if checkpointAfterEachStep)
  │
  └── On failure (non-optional step):
        Execute compensation stack in reverse (rollback)
        Record failure in agent_trajectories
        Notify owner via push
```

#### 5.12.6 Background Task Integration

```
Cloudflare Worker cron trigger fires (e.g., daily 6am)
    │
    ▼
Worker identifies which BackgroundTaskDefinitions match the cron
    │
    ▼
For each matching task:
  │
  ├── Load all active users with properties (paginated)
  │
  ├── For each user:
  │   ├── Build ExecutionContext (their rules, prefs, mission level)
  │   ├── Execute task tools via executeTool pipeline
  │   ├── Respect user's autonomy settings:
  │   │   - If graduated: auto-execute, log result
  │   │   - If not graduated: create pending action
  │   └── Update agent_background_tasks row (status, results)
  │
  └── Record overall task completion/failure

Event-triggered tasks (e.g., payment_failed):
  Supabase webhook → Worker HTTP endpoint
    → Identifies target user and task
    → Same execution pipeline as above
```

#### 5.12.7 Client Integration Contracts

The mobile app uses `@stead/agent-client` hooks that consume the Worker API:

| Hook | Worker Endpoint | Response Type | Purpose |
|------|----------------|---------------|---------|
| `useAgent()` | `POST /agent/chat` | SSE stream | Full conversation with streaming |
| `useAgentActions()` | `GET /agent/actions` | JSON | List pending approvals |
| `useAgentInsight()` | `GET /agent/insights/:propertyId` | JSON | Contextual suggestions |
| — | `POST /agent/actions/:id/resolve` | JSON | Approve/reject/modify action |
| — | `GET /agent/tasks` | JSON | Background task status |

**SSE Event Contract** (all events the client must handle):
```typescript
type SSEEventType =
  | 'token'           // { text: string } — streaming text
  | 'tool_start'      // { toolName, status: 'started' }
  | 'tool_result'     // { toolName, status: 'completed'|'failed', result, durationMs }
  | 'tool_gated'      // { toolName, status: 'gated', pendingActionId }
  | 'workflow_step'   // { workflowName, stepIndex, stepDescription, status }
  | 'error'           // { message, recoverable }
  | 'done';           // { messageId, toolsUsed, totalDurationMs }
```

#### 5.12.8 Guarantees for Reliable Execution

The following guarantees ensure the system works every single time:

| Guarantee | Mechanism | Recovery |
|-----------|-----------|----------|
| **No duplicate actions** | Idempotency keys in KV (TTL per tool) | Same request returns cached result |
| **No cascading failures** | Circuit breakers per external service | Fallback path (queue/alternative/manual) |
| **No lost workflows** | Durable Object checkpoints after each step | Resume from last checkpoint |
| **No orphaned payments** | Payment tools have max 1 auto-retry, 24h idempotency | Manual escalation after failure |
| **No silent failures** | Every tool execution recorded in agent_decisions | Push notification on failure |
| **No missed approvals** | Pending actions have 24h expiry + push notification | Owner reminded, agent suggests alternative |
| **No stale data** | Query tools have 5min cache TTL, fallback to cache on failure | Cached data clearly marked |
| **No lost compensation** | Compensation stack persisted in workflow checkpoint | Rollback runs on resume if needed |
| **No exceeded budgets** | Financial threshold checked before every cost-bearing action | Escalate to owner |
| **No legal mistakes** | NEVER_AUTO_EXECUTE list is immutable, checked before execution | Always requires explicit owner approval |

#### 5.12.9 Package Dependency Graph

```
@stead/agent-core (types + constants, no runtime deps)
    │
    ├── Used by: workers/agent/ (runtime execution)
    │   - Imports: TOOL_CATALOG, TOOL_BY_NAME, WORKFLOW_DEFINITIONS
    │   - Imports: CIRCUIT_BREAKER_CONFIGS, BACKGROUND_TASKS
    │   - Imports: NEVER_AUTO_EXECUTE, GRADUATED_AUTO_EXECUTE
    │   - Imports: All execution types (ToolExecutionRequest, etc.)
    │   - Worker implements: ToolExecutor, ToolRouter, ContextAssembler
    │
    ├── Used by: @stead/agent-client (React Native hooks)
    │   - Imports: AgentRequest, AgentResponse, SSEEvent types
    │   - Imports: PendingActionSummary, ToolExecutionSummary
    │   - Client renders: ActionCard, ToolSummary, WorkflowProgress
    │
    └── Used by: apps/owner/ (direct type references)
        - Imports: AutonomyLevel, RiskLevel (for settings screens)
        - Imports: PendingActionResolution (for action cards)
```

---

## 6. Feature Specifications

### 6.1 Tenant Finding Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    TENANT FINDING FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  OWNER ACTION                    PROPBOT ACTION                 │
│  ────────────                    ──────────────                 │
│                                                                 │
│  1. "List my property"           • Generates listing copy       │
│     [Uploads photos]             • Suggests rent price          │
│     [Confirms details]           • Creates listing draft        │
│                                                                 │
│  2. [Reviews & approves]         • Syndicates to Domain/REA     │
│                                  • Posts to Facebook groups     │
│                                  • Activates enquiry handling   │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                                                 │
│  TENANT ACTIONS                  PROPBOT ACTION                 │
│  ──────────────                  ──────────────                 │
│                                                                 │
│  3. Tenant enquires              • AI responds with info        │
│                                  • Qualifies tenant interest    │
│                                  • Offers inspection times      │
│                                                                 │
│  4. Tenant books inspection      • Confirms booking             │
│                                  • Sends reminders              │
│                                  • Provides access details      │
│                                                                 │
│  5. Tenant applies               • Receives application         │
│     [Submits docs]               • Runs background checks       │
│                                  • AI scores application        │
│                                  • Ranks all applicants         │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                                                 │
│  OWNER ACTION                    PROPBOT ACTION                 │
│  ────────────                    ──────────────                 │
│                                                                 │
│  6. [Reviews top 3]              • Shows AI reasoning           │
│     [Selects tenant]             • Highlights risks/strengths   │
│                                                                 │
│  7. [Confirms selection]         • Generates lease              │
│                                  • Sends for e-signing          │
│                                  • Collects bond                │
│                                  • Lodges with state            │
│                                  • Schedules entry inspection   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Time: ~2-3 weeks (vs 4-6 weeks with traditional PM)
Owner effort: ~2 hours total
```

### 6.2 Maintenance Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAINTENANCE FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TENANT                          PROPBOT                        │
│  ──────                          ───────                        │
│                                                                 │
│  1. Reports issue                • Receives via app             │
│     "Dishwasher not draining"    • AI triages:                  │
│     [Attaches photos]              - Category: Appliance        │
│                                    - Urgency: Normal            │
│                                    - Est. cost: $150-300        │
│                                                                 │
│  2. [Receives guidance]          • Can tenant resolve?          │
│                                    "Try cleaning filter         │
│                                    (see video)"                 │
│                                                                 │
│  3. "Still not working"          • Escalates to trade search    │
│                                  • Finds 3 local appliance      │
│                                    repair services              │
│                                  • Requests quotes              │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                                                 │
│  OWNER                           PROPBOT                        │
│  ─────                           ───────                        │
│                                                                 │
│  4. [Receives notification]      • Shows quotes ranked          │
│     "Maintenance request"        • AI recommendation:           │
│                                    "Quote 2 is best value,      │
│                                    trade has 4.8★ rating"       │
│                                                                 │
│  IF cost < auto-approve limit:   • Auto-approves                │
│                                  • Schedules with tenant        │
│                                                                 │
│  IF cost > limit:                                               │
│  5. [Approves quote]             • Confirms with trade          │
│                                  • Coordinates access           │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                                                 │
│  TRADE                           PROPBOT                        │
│  ─────                           ───────                        │
│                                                                 │
│  6. Completes job                • Tenant confirms completion   │
│     [Uploads completion photos]  • Processes payment            │
│                                  • Updates maintenance record   │
│                                  • Notifies owner               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Time: 24-72 hours for normal issues
Owner effort: ~2 mins (approve notification)
```

### 6.3 Rent Collection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    RENT COLLECTION FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  NORMAL FLOW                                                    │
│  ───────────                                                    │
│                                                                 │
│  Day -3: Reminder sent to tenant                                │
│  Day 0:  Auto-debit processes                                   │
│          ✓ Success → Receipt sent, owner notified               │
│          ✗ Failed → Retry in 2 days                             │
│                                                                 │
│  ARREARS FLOW                                                   │
│  ────────────                                                   │
│                                                                 │
│  Day 1-3:   Friendly reminder (AI-generated)                    │
│             "Hi [name], we noticed your rent payment            │
│              didn't go through. Please ensure funds             │
│              are available for retry on [date]."                │
│                                                                 │
│  Day 4-7:   Formal reminder + payment plan offer                │
│             "Your rent is now [X] days overdue.                 │
│              Total owing: $[amount].                            │
│              Would you like to set up a payment plan?"          │
│                                                                 │
│  Day 8-14:  Notice to remedy (state-specific)                   │
│             • Auto-generates compliant notice                   │
│             • Sends via registered post + email                 │
│             • Owner notified: "Arrears escalated"               │
│                                                                 │
│  Day 14+:   Owner decision required                             │
│             • Options presented:                                │
│               - Continue with breach notice                     │
│               - Negotiate payment plan                          │
│               - Refer to tribunal (facilitated)                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Owner effort: Zero until Day 8 (unless they want updates)
```

### 6.4 Inspection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    INSPECTION FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SCHEDULING (Automated)                                         │
│  ─────────────────────                                          │
│                                                                 │
│  1. System triggers inspection (quarterly)                      │
│  2. Proposes dates to tenant (within compliance window)         │
│  3. Tenant selects preferred time                               │
│  4. Owner notified of schedule                                  │
│                                                                 │
│  SELF-SERVICE OPTION                                            │
│  ───────────────────                                            │
│                                                                 │
│  1. Tenant receives inspection checklist in app                 │
│  2. Room-by-room walkthrough:                                   │
│     • Take photos of each area                                  │
│     • AI checks photo quality/completeness                      │
│     • Rate condition of each item                               │
│     • Note any issues                                           │
│  3. AI generates report                                         │
│  4. Owner reviews in app                                        │
│                                                                 │
│  PROFESSIONAL OPTION (included in Pro & Hands-Off, $99 add-on   │
│  for Starter)                                                   │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  1. Casa schedules professional inspector                       │
│  2. Inspector conducts in-person inspection                     │
│  3. Professional report uploaded                                │
│  4. Owner reviews in app                                        │
│                                                                 │
│  ENTRY/EXIT COMPARISON                                          │
│  ────────────────────                                           │
│                                                                 │
│  • AI compares photos side-by-side                              │
│  • Flags condition changes                                      │
│  • Suggests bond deductions (if any)                            │
│  • Generates comparison report                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.5 PM Transition Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PM TRANSITION FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  OWNER ACTION                    CASA ACTION                    │
│  ────────────                    ───────────                    │
│                                                                 │
│  1. Owner signs up               • Creates account              │
│     to Casa                      • Onboarding wizard starts     │
│                                                                 │
│  2. Owner notifies               • Provides template notice     │
│     current PM                     to send to existing PM       │
│                                  • Tracks handover timeline     │
│                                                                 │
│  3. [Provides tenant details]    • Imports tenant details       │
│     or Casa receives from PM     • Creates tenant profiles      │
│                                  • Sets up rent collection      │
│                                  • Imports lease documents      │
│                                  • Records bond details         │
│                                                                 │
│  4. [Confirms setup]             • Sends welcome message to     │
│                                    tenants with app download    │
│                                  • Explains new process to      │
│                                    tenants (rent, maintenance)  │
│                                  • Activates AI monitoring      │
│                                                                 │
│  Timeline: < 1 week typical                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.6 Owner Control Model ("Your Property, Your Choice")

The owner has full control over their level of involvement:

| Control | Description |
|---------|-------------|
| **Approval thresholds** | Set dollar limit for auto-approved maintenance (default $200) |
| **Notification preferences** | Choose what triggers alerts vs silent handling |
| **Autonomy levels** | Per-feature control of AI autonomy (see Section 5.4) |
| **Transparency mode** | See every cost, decision, and detail in real-time |
| **Hands-free mode** | Set rules and let Casa handle everything autonomously |
| **Custom automation rules** | Define specific behaviors per property (Hands-Off tier) |

Owner can change all settings at any time. System adapts immediately.

### 6.7 Data Export & Cancellation

When an owner cancels:
1. All data remains accessible for 30 days after cancellation
2. Full export available: tenant records, payment history, documents, inspection reports
3. Lease documents provided in PDF format
4. Payment ledger exported as CSV
5. No penalty fees, no lock-in contracts
6. Tenant app access reverts to read-only (existing data accessible)

### 6.8 Tenant App Features (Free for Tenants)

The tenant app is free — the landlord's subscription covers tenant access.

**Core Tenant Features:**

| Feature | Description |
|---------|-------------|
| **Pay Rent** | Auto-debit setup, view payment history, download receipts, track rental ledger |
| **Request Maintenance** | Submit with photos, track progress in real-time, notified on completion |
| **Communicate 24/7** | Chat with Casa AI for instant answers, escalation to landlord for important matters |
| **Digital Documents** | Access lease, condition reports, payment receipts anytime |
| **Notifications** | Inspections, lease renewals, maintenance updates |
| **Faster Resolution** | AI triage means requests actioned in minutes, not days |

**Tenant Chat Capabilities:**
- Report maintenance issues via natural language
- AI logs urgency, checks available tradespeople
- Requests photos for better diagnosis
- Provides appointment windows
- Confirms bookings and sends reminders
- Suggested actions: "Check my rent", "Lease details", "Report issue"

### 6.9 AI Condition Report Comparison (All Tiers)

Available to all tiers including Starter:
- AI compares entry and exit condition report photos side-by-side
- Flags condition changes between inspections
- Highlights wear-and-tear vs damage
- Suggests bond deductions (if any)
- Generates comparison report with photo evidence
- Works with both self-service and professional inspection reports

---

## 7. Mobile App Design

### 7.1 App Structure

```
OWNER APP                          TENANT APP
──────────                         ──────────

[Home]                             [Home]
├── Property Overview              ├── My Rental
│   ├── Rent status                │   ├── Rent due
│   ├── Upcoming tasks             │   ├── Lease info
│   └── Recent activity            │   └── Property details
│                                  │
[Properties]                       [Payments]
├── Property 1                     ├── Pay rent
│   ├── Listing                    ├── Payment history
│   ├── Tenancy                    └── Set up auto-pay
│   ├── Maintenance                │
│   ├── Inspections                [Maintenance]
│   └── Financials                 ├── Report issue
├── Property 2                     ├── Track requests
└── + Add Property                 └── View history
                                   │
[Messages]                         [Messages]
├── All conversations              ├── Chat with owner
└── AI suggestions                 └── Support
                                   │
[Finances]                         [Documents]
├── Income summary                 ├── Lease
├── Expenses                       ├── Inspection reports
├── Tax reports                    └── Receipts
└── Transactions                   │
                                   [Profile]
[Settings]                         ├── Personal info
├── Notifications                  ├── Payment methods
├── Preferences                    └── Settings
└── Subscription
```

### 7.2 Key Screens (Owner App)

#### Home Screen
```
┌─────────────────────────────────┐
│ Good morning, Sarah       ⚙️   │
├─────────────────────────────────┤
│                                 │
│ ┌─────────────────────────────┐ │
│ │  💰 This Month              │ │
│ │  $2,400 collected           │ │
│ │  $2,400 expected            │ │
│ │  ████████████████████ 100%  │ │
│ └─────────────────────────────┘ │
│                                 │
│ ⚡ Needs Attention              │
│ ┌─────────────────────────────┐ │
│ │ 🔧 Maintenance Request       │ │
│ │ 42 Smith St - Dishwasher    │ │
│ │ Quote: $180 [Approve]       │ │
│ └─────────────────────────────┘ │
│                                 │
│ 📅 Upcoming                     │
│ ┌─────────────────────────────┐ │
│ │ 📋 Inspection - Jan 28      │ │
│ │ 15 Jones Ave                │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 📄 Lease Renewal - Feb 15   │ │
│ │ 42 Smith St                 │ │
│ └─────────────────────────────┘ │
│                                 │
│ 📊 Recent Activity              │
│ • Rent received - $600         │
│ • Inspection complete          │
│ • Tenant message answered      │
│                                 │
├─────────────────────────────────┤
│ 🏠    💬    📊    ⚙️           │
│ Home  Msgs  Finance Settings   │
└─────────────────────────────────┘
```

#### Maintenance Approval
```
┌─────────────────────────────────┐
│ ← Maintenance Request           │
├─────────────────────────────────┤
│                                 │
│ 🔧 Dishwasher Not Draining      │
│ 42 Smith St, Newtown            │
│ Reported: 2 days ago            │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ [Photo 1]  [Photo 2]        │ │
│ └─────────────────────────────┘ │
│                                 │
│ Tenant says:                    │
│ "Water sitting in bottom,       │
│ tried cleaning filter but       │
│ still not draining"             │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ 🤖 PropBot Assessment           │
│ Category: Appliance             │
│ Urgency: Normal                 │
│ Est. cost: $150-250             │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ 📋 Quotes Received              │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ⭐ Recommended               │ │
│ │ Jim's Appliance Repair      │ │
│ │ ★★★★★ (4.9) • 127 jobs      │ │
│ │ $180 • Available tomorrow   │ │
│ │ [Select]                    │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Sydney Appliance Services   │ │
│ │ ★★★★☆ (4.2) • 89 jobs       │ │
│ │ $220 • Available in 3 days  │ │
│ │ [Select]                    │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ [   Approve & Schedule   ]  │ │
│ │                             │ │
│ │ [     Get More Quotes    ]  │ │
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

### 7.3 Design System

```typescript
// colors.ts
export const colors = {
  // Primary - Professional blue
  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
  },

  // Success - Green for positive states
  success: {
    50: '#F0FDF4',
    500: '#22C55E',
    700: '#15803D',
  },

  // Warning - Amber for attention
  warning: {
    50: '#FFFBEB',
    500: '#F59E0B',
    700: '#B45309',
  },

  // Error - Red for problems
  error: {
    50: '#FEF2F2',
    500: '#EF4444',
    700: '#B91C1C',
  },

  // Neutral - Grays
  neutral: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
};

// typography.ts
export const typography = {
  h1: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '600', lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
};

// spacing.ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
```

---

## 8. Integration Specifications

### 8.1 Property Portals

#### Domain API
```typescript
interface DomainIntegration {
  // Listing Management
  createListing(listing: ListingData): Promise<{ listingId: string }>;
  updateListing(listingId: string, updates: Partial<ListingData>): Promise<void>;
  removeListing(listingId: string): Promise<void>;

  // Enquiry Handling (webhook)
  handleEnquiry(webhook: DomainEnquiryWebhook): Promise<void>;

  // Analytics
  getListingStats(listingId: string): Promise<ListingStats>;
}

// Note: Domain API requires agency agreement
// Alternative: Use Domain's listing form submission (scraping as fallback)
```

#### REA Group API
```typescript
interface REAIntegration {
  // Similar to Domain
  // Requires commercial agreement with REA Group
  // Fallback: Manual posting with saved templates
}
```

### 8.2 Background Checks

#### Equifax
```typescript
interface EquifaxIntegration {
  runCreditCheck(applicant: ApplicantDetails): Promise<CreditReport>;
  verifyIdentity(applicant: ApplicantDetails): Promise<IdentityVerification>;
}

interface CreditReport {
  score: number; // 0-1000
  riskGrade: 'A' | 'B' | 'C' | 'D' | 'E';
  defaults: Default[];
  enquiries: Enquiry[];
  judgments: Judgment[];
}
```

#### TICA (Tenancy Database)
```typescript
interface TICAIntegration {
  checkTenant(applicant: ApplicantDetails): Promise<TICAResult>;
}

interface TICAResult {
  status: 'clear' | 'listed';
  listings?: TICAListing[];
}
```

### 8.3 Payments

#### Stripe Connect
```typescript
interface StripeIntegration {
  // Onboard owner as connected account
  createConnectedAccount(owner: OwnerDetails): Promise<{ accountId: string }>;

  // Set up tenant payment method
  setupPaymentMethod(tenant: TenantDetails): Promise<{ paymentMethodId: string }>;

  // Collect rent (funds go directly to owner, minus fee)
  collectRent(params: {
    amount: number;
    ownerId: string;
    tenantPaymentMethodId: string;
    applicationFee: number; // Our fee
  }): Promise<{ paymentIntentId: string }>;

  // Refund (for bond release, etc)
  createRefund(paymentIntentId: string, amount: number): Promise<void>;
}

// Fee structure:
// Stripe: 1.75% + $0.30
// PropBot: 0.5% (our margin)
// Total to tenant: ~2.25% + $0.30
```

### 8.4 Communications

#### Twilio
```typescript
interface TwilioIntegration {
  sendSMS(to: string, message: string): Promise<{ sid: string }>;
  sendWhatsApp(to: string, message: string): Promise<{ sid: string }>;
  makeCall(to: string, twiml: string): Promise<{ callSid: string }>;
}
```

#### SendGrid
```typescript
interface SendGridIntegration {
  sendEmail(params: {
    to: string;
    templateId: string;
    dynamicData: Record<string, any>;
  }): Promise<{ messageId: string }>;

  sendTransactional(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<{ messageId: string }>;
}
```

### 8.5 Documents

#### DocuSign
```typescript
interface DocuSignIntegration {
  createEnvelope(params: {
    templateId: string;
    signers: Signer[];
    customFields: Record<string, string>;
  }): Promise<{ envelopeId: string }>;

  getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatus>;

  downloadDocument(envelopeId: string): Promise<Buffer>;
}

// Templates needed:
// - NSW Residential Tenancy Agreement
// - VIC Residential Tenancy Agreement
// - QLD Residential Tenancy Agreement
// - Bond Lodgement Form
// - Notice to Vacate
// - Breach Notice
```

### 8.6 Trade Services

#### Hipages API
```typescript
interface HipagesIntegration {
  searchTrades(params: {
    category: string;
    postcode: string;
    jobDescription: string;
  }): Promise<Trade[]>;

  requestQuote(tradeId: string, jobDetails: JobDetails): Promise<{ quoteRequestId: string }>;
}
```

#### Airtasker API
```typescript
interface AirtaskerIntegration {
  postTask(task: TaskDetails): Promise<{ taskId: string }>;
  getOffers(taskId: string): Promise<Offer[]>;
  acceptOffer(taskId: string, offerId: string): Promise<void>;
}
```

### 8.7 State Tenancy Authorities

#### NSW Fair Trading (Rental Bonds Online)
```typescript
interface NSWBondIntegration {
  lodgeBond(params: {
    tenancyDetails: TenancyDetails;
    tenantDetails: TenantDetails[];
    amount: number;
  }): Promise<{ bondNumber: string }>;

  claimBond(params: {
    bondNumber: string;
    claimAmount: number;
    reason: string;
    tenantAgreed: boolean;
  }): Promise<{ claimId: string }>;
}
```

---

## 9. Security & Compliance

### 9.1 Data Protection

```typescript
// Row Level Security ensures data isolation
// Example policies:

-- Owners can only see their own properties
CREATE POLICY "owner_properties" ON properties
  FOR ALL
  USING (owner_id = auth.uid());

-- Tenants can only see properties they're renting
CREATE POLICY "tenant_properties" ON properties
  FOR SELECT
  USING (
    id IN (
      SELECT property_id FROM tenancies t
      JOIN tenancy_tenants tt ON t.id = tt.tenancy_id
      WHERE tt.tenant_id = auth.uid()
      AND t.status = 'active'
    )
  );

-- PII encryption at rest (Supabase handles this)
-- PII encryption in transit (HTTPS enforced)
-- PII access logging (audit table)
```

### 9.2 Authentication

```typescript
// Supabase Auth configuration
const supabaseAuthConfig = {
  // Require email verification
  emailConfirmation: true,

  // MFA for owners (optional but encouraged)
  mfa: {
    enabled: true,
    methods: ['totp', 'sms'],
  },

  // Session management
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    refreshTokenRotation: true,
  },

  // OAuth providers
  providers: ['google', 'apple'],
};
```

### 9.3 Compliance Checklist

| Requirement | Implementation |
|-------------|----------------|
| **Privacy Act 1988** | Privacy policy, data handling procedures, right to deletion |
| **Residential Tenancies Act (state)** | State-specific lease templates, compliant notices |
| **Anti-Money Laundering** | Identity verification for payments >$10k |
| **Consumer Data Right** | Not applicable (not banking/energy) |
| **GDPR** | N/A for AU-only launch, but design for it |

### 9.4 Audit Logging

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-log changes
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to sensitive tables
CREATE TRIGGER audit_properties
  AFTER INSERT OR UPDATE OR DELETE ON properties
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

---

## 10. Infrastructure & DevOps

### 10.1 Environment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ENVIRONMENTS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DEVELOPMENT (Local)                                            │
│  ├── Supabase Local (Docker)                                    │
│  ├── Cloudflare Wrangler (local workers)                        │
│  └── Expo Go (mobile preview)                                   │
│                                                                 │
│  STAGING (Preview)                                              │
│  ├── Supabase Project: propbot-staging                          │
│  ├── Cloudflare Workers: staging.propbot.workers.dev            │
│  ├── Expo: propbot-staging (internal TestFlight/Play)           │
│  └── Branch deploys on PR                                       │
│                                                                 │
│  PRODUCTION                                                     │
│  ├── Supabase Project: propbot-prod                             │
│  ├── Cloudflare Workers: api.propbot.com.au                     │
│  ├── Expo: propbot (App Store/Play Store)                       │
│  └── Deploy on main branch merge                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
      - run: bun run lint
      - run: bun run typecheck

  deploy-supabase:
    needs: test
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
          supabase db push

  deploy-workers:
    needs: test
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy

  deploy-mobile:
    needs: [deploy-supabase, deploy-workers]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: eas build --platform all --non-interactive
      - run: eas submit --platform all --non-interactive
```

### 10.3 Monitoring & Observability

```typescript
// Monitoring stack
const monitoring = {
  // Error tracking
  sentry: {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  },

  // Metrics (Cloudflare Analytics + custom)
  metrics: {
    // Agent performance
    agentTaskDuration: 'histogram',
    agentTaskSuccess: 'counter',
    agentTaskError: 'counter',

    // Business metrics
    propertiesActive: 'gauge',
    rentCollected: 'counter',
    maintenanceRequests: 'counter',
  },

  // Alerting
  alerts: [
    {
      name: 'High error rate',
      condition: 'error_rate > 1%',
      channels: ['slack', 'pagerduty'],
    },
    {
      name: 'Payment failure spike',
      condition: 'payment_failures > 5 in 1h',
      channels: ['slack', 'email'],
    },
    {
      name: 'Agent queue backup',
      condition: 'queue_length > 100',
      channels: ['slack'],
    },
  ],
};
```

### 10.4 Cost Estimation

| Service | Free Tier | Estimated Cost (1000 properties) |
|---------|-----------|----------------------------------|
| **Supabase** | 500MB DB, 1GB storage | ~$25/month (Pro plan) |
| **Cloudflare Workers** | 100k requests/day | ~$5/month |
| **Cloudflare Queues** | 1M messages | ~$2/month |
| **Claude API** | N/A | ~$200/month (est. 500k tokens/day) |
| **Twilio** | $15 credit | ~$50/month (SMS) |
| **SendGrid** | 100 emails/day | ~$20/month |
| **Stripe** | N/A | 1.75% + $0.30 per txn (passed to tenant) |
| **Expo/EAS** | Free builds | $99/month (priority builds) |
| **Domain/REA API** | N/A | Negotiated (or manual posting) |
| **Equifax** | N/A | ~$5-10 per check |
| **TICA** | N/A | ~$15-20 per check |
| **DocuSign** | N/A | ~$25/month (API plan) |
| **Total** | | **~$450/month + per-check costs** |

At $99/property/month with 1000 properties = $99,000/month revenue
Infrastructure cost = ~$500/month + ~$2,500/month (background checks)
Gross margin = ~97%

---

## 11. Implementation Roadmap

> **Note**: Implementation follows a mission-based system. See `/specs/ralph-missions/` for full specs.

### Mission Status Tracker (as of January 2026)

| # | Mission | Priority | Status | Key Deliverables |
|---|---------|----------|--------|------------------|
| 01 | Project Setup | P0 | COMPLETE | Monorepo, Expo apps, shared packages, Supabase config |
| 02 | Auth & Profiles | P0 | COMPLETE | Auth flow, profiles, premium UI, RLS, feature gating |
| 03 | Properties CRUD | P0 | COMPLETE | Property management, Google Places, image upload |
| 04 | Listings & Marketplace | P1 | COMPLETE | Listings CRUD, search with filters, favourites, saved searches, featured listings, portal syndication clients |
| 05 | Applications | P1 | COMPLETE | 6-step application form, document upload, reference tracking, email notifications. Equifax/TICA deferred (external blocker) |
| 06 | Tenancies & Leases | P1 | COMPLETE | Lease lifecycle, rent increase rules, lease generator, condition reports, compliance checklists, direct invitations |
| 07 | Rent Collection | P0 | COMPLETE | Stripe Connect structure, rent schedules, payment tracking |
| 08 | Arrears Management | P1 | COMPLETE | Escalation ladder, payment plans, breach notices, 61 tests |
| 09 | Maintenance Requests | P1 | NOT STARTED | Request system, AI triage, cost estimation |
| 10 | Trade Coordination | P2 | NOT STARTED | Trade marketplace, quoting, job tracking |
| 11 | Inspections | P1 | NOT STARTED | Scheduling, room-by-room reports, AI photo comparison |
| 12 | Communications | P1 | NOT STARTED | Unified inbox, Twilio SMS, SendGrid, templates |
| 13 | Financial Reports | P2 | NOT STARTED | Income/expense tracking, tax reports, analytics |
| 14 | AI Orchestrator | P1 | **50% COMPLETE** | Chat UI, Tasks UI, heartbeat, autonomy settings. Missing: 72/87 tools, integrations, workflows, learning |
| 15 | Learning Engine | P2 | NOT STARTED | Correction-to-rule pipeline, autonomy graduation |
| 16 | Document Management | P2 | NOT STARTED | Centralized storage, templates, sharing |
| 17 | Notifications | P1 | NOT STARTED | Expo Push, preferences, delivery tracking |
| 18 | Security Audit | P0 | NOT STARTED | MFA, session management, audit logging, GDPR |
| 19 | Performance | P2 | NOT STARTED | Optimization, caching, bundle size |
| 20 | Launch Prep | P0 | NOT STARTED | App Store assets, onboarding, marketing site |

### Mission 14 Agent Gap Analysis

The agent infrastructure is built but capabilities are limited:

| Component | Target | Current | Gap |
|-----------|--------|---------|-----|
| Tools defined | 87 | 15 | 72 tools missing |
| Real write actions | 20+ | 5 | Most actions are read-only |
| External integrations | 4 (Domain, Stripe, Twilio, Equifax) | 0 | No external API connections |
| Multi-step workflows | 3 (find tenant, onboard, exit) | 0 | No workflow orchestration |
| Learning system | Full correction-to-rule pipeline | 0 | Schema exists, code unused |
| Heartbeat scanners | 10+ | 4 | Limited proactive scanning |
| Vector/semantic retrieval | pgvector embeddings | Schema only | Code never populates/queries embeddings |

### Agent Architecture Evolution Plan

**Current**: Supabase Edge Function (`agent-chat`) with 15 tools, single-shot Claude API calls with tool_use loop.

**Target**: Frontier-grade autonomous agent inspired by Moltbot/Clawdbot architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│ MOBILE APP (Expo)                                               │
│  Chat tab + Tasks tab + Autonomy Settings                       │
│  AgentProvider (30s polling for pending tasks)                   │
│  useAgentChat, useAgentTasks, useAgentInsights hooks            │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS + SSE
┌───────────────────────────▼─────────────────────────────────────┐
│ CLOUDFLARE WORKER (Claude Agent SDK)                            │
│  @anthropic-ai/claude-agent-sdk                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Gateway  │  │  Agent   │  │  Skills  │  │  Memory  │       │
│  │ (routing)│  │ (Claude) │  │ (87 tools)│  │(pgvector)│       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ Heartbeat Engine (cron: hourly proactive scans)     │       │
│  │ • Lease expiry • Overdue rent • Compliance gaps     │       │
│  │ • Maintenance follow-up • Inspection scheduling     │       │
│  │ • Market rent analysis • Insurance renewal          │       │
│  └──────────────────────────────────────────────────────┘       │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ Learning Engine (correction → rule pipeline)        │       │
│  │ • 3+ similar corrections → generate persistent rule │       │
│  │ • Autonomy graduation (earned trust over time)      │       │
│  │ • Precedent search via pgvector similarity          │       │
│  └──────────────────────────────────────────────────────┘       │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Service Role Key
┌───────────────────────────▼─────────────────────────────────────┐
│ SUPABASE (Data) + MCP SERVERS (Integrations)                    │
│  12 agent tables + pgvector embeddings                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐             │
│  │ Stripe  │ │ Twilio  │ │ Domain  │ │ Equifax │             │
│  │  MCP    │ │  MCP    │ │  MCP    │ │  MCP    │             │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### Frontier Agent Architecture — Key Patterns

#### Self-Evolving Skills
The agent creates new `agent_rules` as persistent tool behaviors. When the agent receives 3+ similar corrections from an owner, it generates a persistent rule (stored in `agent_rules` table) that modifies its future behavior without code changes. This is the Moltbot "self-evolving skills" pattern applied to property management:
- Owner corrects "don't send reminders before 9am" → rule generated → all future reminders respect this
- Owner corrects "always CC me on maintenance quotes over $500" → rule generated → agent always CCs
- Rules are injected into the system prompt dynamically via context assembly
- Rules can be viewed, edited, and deactivated by the owner in Settings

#### Proactive Engine (Heartbeat)
Beyond the 4 current scanners, the heartbeat expands to cover every aspect of property management:
- **Lease lifecycle**: Expiry warnings (90/60/30 days), renewal drafting, rent review scheduling
- **Rent collection**: Overdue detection, escalation ladder, payment plan monitoring
- **Maintenance follow-up**: Stale requests (>48h unassigned), quote follow-up, job completion tracking
- **Compliance deadlines**: Smoke alarm checks, pool fencing, gas safety, state-specific requirements
- **Inspection scheduling**: Routine inspection reminders (quarterly), entry/exit report deadlines
- **Communication scheduling**: Tenant check-in reminders, lease anniversary messages, seasonal updates
- **Insurance renewal**: Policy expiry tracking, renewal reminders
- **Market rent analysis**: Weekly comparable rent scans, price adjustment suggestions
- **Listing performance**: View/enquiry metrics, price/description optimisation suggestions
- **Application processing**: Auto-scoring on arrival, reference check follow-up

Each scanner checks the user's autonomy threshold before acting. Above threshold → auto-execute + log. Below threshold → create pending action in Tasks + post proactive message to chat.

#### Domain-Specific Skill Library (87 Tools → 565+ Equivalent Coverage)
Every property management action that an owner can perform manually becomes a callable tool. The 87 tools cover 565+ equivalent discrete actions across 7 categories, matching and exceeding what the best human property managers do.

#### Memory with Retrieval (pgvector)
Schema exists (`agent_decisions` with pgvector index) but code must populate and query embeddings:
- Every `agent_decision` generates an embedding via Claude's embedding API
- On new decisions, the agent searches for similar past decisions using cosine similarity
- Precedent search informs confidence scoring and recommendations
- Owner preferences are embedded for semantic retrieval ("what does this owner prefer for maintenance?")
- Trajectory patterns are embedded for workflow optimisation

### 87 Tool Catalog — Full Breakdown

#### Category 1: Property Intelligence (12 tools)
Every query an owner might ask about their portfolio, answered instantly from live data.

| Tool | Description | Autonomy |
|------|-------------|----------|
| `get_properties` | Fetch all properties with status, vacancy, tenant info | L4 Auto |
| `get_property_detail` | Deep property detail: features, documents, history, compliance status | L4 Auto |
| `get_tenancies` | All tenancies with lease dates, rent amounts, tenant details | L4 Auto |
| `get_arrears` | Overdue rent with amounts, days overdue, escalation status | L4 Auto |
| `get_listings` | Active listings with view counts, enquiry stats, time on market | L4 Auto |
| `get_applications` | Applications for a listing with scores, documents, reference status | L4 Auto |
| `get_rent_schedule` | Upcoming rent due dates across all properties | L4 Auto |
| `get_maintenance_requests` | Open/closed maintenance with status, quotes, assigned trades | L4 Auto |
| `get_inspection_history` | Past inspections with reports, photos, condition changes | L4 Auto |
| `get_financial_summary` | Income, expenses, net yield per property and portfolio-wide | L4 Auto |
| `get_market_comparables` | Comparable rental properties in same suburb with pricing data | L4 Auto |
| `get_compliance_status` | State-specific compliance checklist status per property | L4 Auto |

#### Category 2: Action Execution (25 tools)
Every CRUD operation the owner can do manually, the agent does programmatically. These are autonomy-gated.

| Tool | Description | Autonomy |
|------|-------------|----------|
| `create_listing` | Create new property listing with generated or provided copy | L2 Draft |
| `publish_listing` | Publish listing to Casa marketplace + external portals | L1 Suggest |
| `update_listing` | Modify listing details, price, photos, or availability | L2 Draft |
| `unpublish_listing` | Remove listing from all channels | L1 Suggest |
| `send_rent_reminder` | Send rent reminder to tenant via in-app + optional SMS/email | L3 Execute |
| `send_breach_notice` | Generate and send formal breach notice (state-compliant) | L0 Inform |
| `shortlist_application` | Move application to shortlisted status | L2 Draft |
| `approve_application` | Approve tenant application and trigger onboarding | L1 Suggest |
| `reject_application` | Reject application with optional reason message | L1 Suggest |
| `create_tenancy` | Create new tenancy record from approved application | L1 Suggest |
| `update_tenancy_dates` | Modify lease start/end dates | L1 Suggest |
| `end_tenancy` | Initiate tenancy termination with compliance steps | L0 Inform |
| `create_maintenance_request` | Log new maintenance request with category, urgency, photos | L2 Draft |
| `assign_maintenance_trade` | Assign a trade/contractor to a maintenance request | L2 Draft |
| `approve_maintenance_quote` | Approve a maintenance quote for work to proceed | L1 Suggest |
| `schedule_inspection` | Schedule routine or entry/exit inspection | L2 Draft |
| `generate_lease` | Generate state-compliant lease agreement PDF | L2 Draft |
| `generate_condition_report` | Generate condition report PDF with room-by-room detail | L2 Draft |
| `generate_breach_notice` | Generate formal breach notice document | L0 Inform |
| `create_rent_increase` | Draft rent increase notice with CPI justification | L0 Inform |
| `lodge_bond` | Initiate bond lodgement with state bond authority | L1 Suggest |
| `request_bond_release` | Initiate bond release/claim process | L0 Inform |
| `update_property_details` | Modify property features, photos, or metadata | L3 Execute |
| `create_payment_plan` | Set up structured payment plan for arrears | L1 Suggest |
| `record_manual_payment` | Record a payment received outside the app (cash, direct deposit) | L2 Draft |

#### Category 3: Integration Bridge (15 tools)
Connect to external services. Each integration is implemented as an MCP server that the agent can invoke.

| Tool | Description | Integration | Autonomy |
|------|-------------|-------------|----------|
| `domain_publish_listing` | Syndicate listing to Domain.com.au | Domain API | L1 Suggest |
| `domain_update_listing` | Update listing on Domain | Domain API | L2 Draft |
| `domain_unpublish_listing` | Remove listing from Domain | Domain API | L1 Suggest |
| `rea_publish_listing` | Syndicate listing to realestate.com.au | REA API | L1 Suggest |
| `rea_update_listing` | Update listing on REA | REA API | L2 Draft |
| `stripe_create_payment` | Create Stripe payment intent for rent collection | Stripe Connect | L1 Suggest |
| `stripe_process_refund` | Process a refund via Stripe | Stripe Connect | L0 Inform |
| `stripe_get_balance` | Check Stripe Connect account balance | Stripe Connect | L4 Auto |
| `twilio_send_sms` | Send SMS to tenant or trade | Twilio | L3 Execute |
| `sendgrid_send_email` | Send email notification or document | SendGrid | L3 Execute |
| `equifax_credit_check` | Run credit check on tenant applicant | Equifax | L1 Suggest |
| `tica_tenancy_check` | Check tenancy database for applicant history | TICA | L1 Suggest |
| `bond_lodge_nsw` | Lodge bond with NSW Fair Trading | NSW Bond API | L1 Suggest |
| `bond_lodge_vic` | Lodge bond with RTBA Victoria | VIC Bond API | L1 Suggest |
| `bond_lodge_qld` | Lodge bond with RTA Queensland | QLD Bond API | L1 Suggest |

#### Category 4: Workflow Orchestration (10 tools)
Multi-step processes that chain multiple tools together in a managed sequence with checkpoints.

| Tool | Description | Steps | Autonomy |
|------|-------------|-------|----------|
| `workflow_find_tenant` | Full tenant finding process | 7: list → publish → collect apps → score → shortlist → approve → onboard | L1 Suggest |
| `workflow_onboard_tenant` | New tenant onboarding | 5: create tenancy → generate lease → lodge bond → set up rent → welcome | L1 Suggest |
| `workflow_end_tenancy` | Tenancy termination | 6: notice → final inspection → bond claim → close tenancy → relist | L0 Inform |
| `workflow_maintenance_resolution` | Maintenance from request to completion | 5: triage → find trade → get quotes → approve → verify completion | L2 Draft |
| `workflow_compliance_check` | Full compliance audit for a property | 4: check items → identify gaps → create tasks → track completion | L2 Draft |
| `workflow_rent_increase` | Rent increase process | 4: market analysis → draft notice → serve notice → update schedule | L0 Inform |
| `workflow_lease_renewal` | Lease renewal process | 4: check expiry → draft renewal → negotiate → execute | L1 Suggest |
| `workflow_inspection` | Full inspection cycle | 5: schedule → notify tenant → conduct → generate report → follow-up | L2 Draft |
| `workflow_arrears_escalation` | Arrears management ladder | 5: remind → formal notice → payment plan → breach → tribunal | L0 Inform |
| `workflow_property_onboard` | New property setup | 4: details → compliance check → listing → tenant finding | L2 Draft |

#### Category 5: Memory & Learning (10 tools)
The self-evolving intelligence layer. Every interaction makes the agent smarter for this specific owner.

| Tool | Description | Autonomy |
|------|-------------|----------|
| `remember` | Store a preference or fact about the owner ("I prefer trades from Hipages") | L4 Auto |
| `recall` | Retrieve stored preferences and facts | L4 Auto |
| `record_correction` | Log when owner corrects agent behavior | L4 Auto |
| `generate_rule` | Create persistent rule from 3+ similar corrections | L4 Auto |
| `search_precedents` | Search past decisions via pgvector similarity for similar situations | L4 Auto |
| `get_owner_rules` | Retrieve all active rules for this owner | L4 Auto |
| `update_rule` | Modify an existing rule | L4 Auto |
| `deactivate_rule` | Disable a rule without deleting it | L4 Auto |
| `log_trajectory` | Record full tool sequence + outcome for a completed task | L4 Auto |
| `evaluate_trajectory` | Score trajectory efficiency vs historical similar trajectories | L4 Auto |

#### Category 6: Planning & Reasoning (8 tools)
Complex analysis and multi-step planning capabilities.

| Tool | Description | Autonomy |
|------|-------------|----------|
| `plan_task` | Create a multi-step plan for a complex goal | L4 Auto |
| `check_plan` | Verify plan completeness and identify blockers | L4 Auto |
| `estimate_cost` | Estimate costs for maintenance, renovations, or improvements | L2 Draft |
| `assess_risk` | Risk assessment for tenant applications, rent pricing, or maintenance | L2 Draft |
| `compare_options` | Compare multiple options with pros/cons analysis | L4 Auto |
| `calculate_yield` | Calculate rental yield and ROI metrics | L4 Auto |
| `forecast_cashflow` | Project cash flow for next 3/6/12 months | L2 Draft |
| `suggest_improvements` | Suggest property improvements to increase rental value | L2 Draft |

#### Category 7: Communication & Reporting (7 tools)
Draft messages in the owner's tone and generate professional reports.

| Tool | Description | Autonomy |
|------|-------------|----------|
| `draft_message` | Draft message to tenant in owner's communication style | L2 Draft |
| `draft_tenant_notice` | Draft formal tenant notice (compliant with state legislation) | L1 Suggest |
| `generate_income_report` | Generate income/expense report for a period | L2 Draft |
| `generate_tax_summary` | Generate end-of-year tax summary with deductions | L2 Draft |
| `generate_portfolio_report` | Full portfolio performance report | L2 Draft |
| `send_notification` | Send push notification to owner or tenant | L3 Execute |
| `generate_inspection_report` | Generate formatted inspection report from data | L2 Draft |

### Anthropic Agent SDK Migration Path

The agent runtime evolves from Supabase Edge Functions to a Cloudflare Worker powered by the Anthropic Agent SDK:

#### Current Runtime: Supabase Edge Function
- Deno runtime, 60-second timeout, cold starts
- Single Claude API call with `tool_use` loop (max 10 iterations)
- Tools defined inline in `agent-chat/index.ts`
- Simple but limited: can't handle long-running workflows

#### Target Runtime: Cloudflare Worker + Claude Agent SDK
```
┌──────────────────────────────────────────────────────────────────┐
│ CLOUDFLARE WORKER                                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Claude Agent SDK (@anthropic-ai/claude-agent-sdk)           ││
│  │                                                             ││
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  ││
│  │  │ Tool Search  │  │ Programmatic │  │ MCP Server       │  ││
│  │  │ Tool         │  │ Tool Calling │  │ Connections      │  ││
│  │  │              │  │              │  │                  │  ││
│  │  │ Dynamically  │  │ Agent picks  │  │ Each integration │  ││
│  │  │ discovers    │  │ tools based  │  │ is a standalone  │  ││
│  │  │ relevant     │  │ on context,  │  │ MCP server the   │  ││
│  │  │ tools from   │  │ not static   │  │ agent connects   │  ││
│  │  │ the 87-tool  │  │ registry     │  │ to on demand     │  ││
│  │  │ catalog      │  │              │  │                  │  ││
│  │  └─────────────┘  └──────────────┘  └──────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Durable Objects (Persistent State)                          ││
│  │  • Long-running workflow state (find tenant = days/weeks)   ││
│  │  • Conversation context across sessions                     ││
│  │  • Background task scheduling without pg_cron               ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
          │                    │                    │
    ┌─────▼─────┐  ┌──────────▼──────────┐  ┌─────▼─────┐
    │ Supabase  │  │ MCP Servers          │  │ Claude    │
    │ (Data)    │  │                      │  │ API       │
    │           │  │ ┌──────────────────┐ │  │           │
    │ 12 agent  │  │ │ Stripe MCP       │ │  │ Messages  │
    │ tables +  │  │ │ • create_payment │ │  │ + Tools   │
    │ pgvector  │  │ │ • process_refund │ │  │           │
    │           │  │ │ • get_balance    │ │  │           │
    │           │  │ ├──────────────────┤ │  │           │
    │           │  │ │ Twilio MCP       │ │  │           │
    │           │  │ │ • send_sms       │ │  │           │
    │           │  │ │ • send_whatsapp  │ │  │           │
    │           │  │ ├──────────────────┤ │  │           │
    │           │  │ │ Domain MCP       │ │  │           │
    │           │  │ │ • publish        │ │  │           │
    │           │  │ │ • update         │ │  │           │
    │           │  │ │ • get_analytics  │ │  │           │
    │           │  │ ├──────────────────┤ │  │           │
    │           │  │ │ Equifax MCP      │ │  │           │
    │           │  │ │ • credit_check   │ │  │           │
    │           │  │ │ • identity_verify│ │  │           │
    │           │  │ ├──────────────────┤ │  │           │
    │           │  │ │ SendGrid MCP     │ │  │           │
    │           │  │ │ • send_email     │ │  │           │
    │           │  │ │ • send_template  │ │  │           │
    │           │  │ ├──────────────────┤ │  │           │
    │           │  │ │ State Bond MCP   │ │  │           │
    │           │  │ │ • lodge_bond     │ │  │           │
    │           │  │ │ • release_bond   │ │  │           │
    │           │  │ └──────────────────┘ │  │           │
    └───────────┘  └─────────────────────┘  └───────────┘
```

#### Tool Search Tool
Instead of loading all 87 tools into every Claude API call (which wastes context), the Claude Agent SDK's **Tool Search Tool** dynamically discovers the most relevant tools based on the user's query:
- User says "send John a reminder" → Tool Search finds `send_rent_reminder`, `draft_message`, `twilio_send_sms`
- User says "how's my portfolio doing?" → Tool Search finds `get_financial_summary`, `get_properties`, `calculate_yield`
- Only 5-10 relevant tools loaded per call instead of all 87

#### Programmatic Tool Calling
The agent can call tools based on runtime context rather than static tool definitions:
- Workflow tools (`workflow_find_tenant`) programmatically chain sub-tools
- Heartbeat scanners programmatically invoke action tools based on scan results
- Learning engine programmatically generates new tool behaviors from rules

#### MCP Servers Per Integration
Each external integration runs as a standalone MCP (Model Context Protocol) server:
- **Stripe MCP**: Payment intents, refunds, balance, payouts, Connect onboarding
- **Twilio MCP**: SMS send/receive, WhatsApp (future), call forwarding (future)
- **Domain MCP**: Listing CRUD, analytics, leads, price estimation
- **Equifax MCP**: Credit checks, identity verification, fraud scoring
- **SendGrid MCP**: Transactional emails, templates, delivery tracking
- **State Bond MCP**: Bond lodgement, release, claim — per-state APIs (NSW Fair Trading, VIC RTBA, QLD RTA)

MCP servers are deployed as separate Cloudflare Workers and connected via the Agent SDK's MCP client.

### Legal Compliance (Australia)

| Requirement | Our Approach |
|-------------|-------------|
| Privacy Act 2024 amendment (Dec 2026 deadline) | Disclose automated decision-making in privacy policy |
| No standalone AI law | Comply with existing tenancy, consumer, and privacy legislation |
| Liability stays with owner | Autonomy gates (L0-L4) ensure owner approval for consequential actions |
| State tenancy legislation | State-specific rules enforced in code (notice periods, rent increase limits) |
| Audit trail | Every agent action logged in `agent_decisions` with reasoning + outcome |

### External Integration Blockers

| Integration | Mission | Blocker | Lead Time | Status |
|-------------|---------|---------|-----------|--------|
| Equifax | M05 | Business verification required | 2-4 weeks | Not started |
| TICA | M05 | Credentials required | 1-2 weeks | Not started |
| DocuSign | M06 | Developer account approval | 1-2 weeks | Not started |
| State Bond APIs (NSW/VIC/QLD) | M06 | Registration required | 2-4 weeks | Not started |
| Stripe Connect | M07 | Account setup | 1-2 weeks | Not started |
| Domain API | M04 | Partnership application | 2-4 weeks | Not started |
| REA API | M04 | Partnership application | 4-6 weeks | Not started |
| Twilio | M12 | Account setup | Instant | Not started |
| SendGrid | M12 | Account setup | Instant | Configured |

### Launch-Critical Path

**Must complete before launch (P0-P1):**
1. Missions 09 (Maintenance), 11 (Inspections), 12 (Communications), 17 (Notifications)
2. Mission 14 agent tools expansion (at minimum: 25 action tools + 4 integration tools)
3. Mission 18 (Security Audit) — MFA, session management, audit logging
4. Mission 20 (Launch Prep) — App Store, onboarding
5. External integration applications (Stripe, Domain, Equifax — start NOW due to lead times)

**Can launch without (P2):**
- Missions 10 (Trade Coordination), 13 (Financial Reports), 15 (Learning Engine), 16 (Document Management), 19 (Performance)
- Full 87-tool agent (15 core tools sufficient for launch)
- AI photo comparison for inspections

---

## 12. Business Model

### 12.1 Pricing Tiers

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRICING TIERS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  STARTER              PRO                 HANDS-OFF             │
│  $49/month            $89/month           $149/month            │
│  per property         per property        per property          │
│                                                                 │
│  ✓ Tenant comms       ✓ Everything in     ✓ Everything in Pro   │
│  ✓ Rent tracking        Starter           ✓ Open homes included │
│  ✓ Maintenance        ✓ Tenant finding    ✓ Entry/exit reports  │
│    requests           ✓ Lease mgmt        ✓ Priority support    │
│  ✓ AI condition       ✓ Bond handling     ✓ Dedicated account   │
│    report comparison  ✓ Professional        manager             │
│  ✓ Basic reports        inspections       ✓ Custom automation   │
│                       ✓ Full automation     rules               │
│                       ✓ Financial reports                       │
│                                                                 │
│  Best for:            Best for:           Best for:             │
│  Have tenant,         Full self-mgmt      Investors wanting     │
│  need help managing   with AI             zero effort           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Add-ons (Starter only — included from Pro):
• Professional inspection: $99 (included in Pro & Hands-Off)
• Open home hosting: $79/session (included in Hands-Off)
• Photography: $149
• Emergency callout coordination: $49

Contract & Cancellation:
• No lock-in contracts
• Cancel anytime from account settings
• Full data export on cancellation (tenant records, payment history, documents)
• Tenant app is free (landlord subscription covers it)
```

### 12.2 Unit Economics

```
Revenue per property (Pro tier): $89/month = $1,068/year

Costs per property:
├── Infrastructure (shared): ~$0.50/month
├── AI (Claude API): ~$2-5/month
├── Background checks (amortized): ~$3/month
├── Communications: ~$1/month
├── Payment processing: passed to tenant
└── Total: ~$7-10/month

Gross margin: ~90-93%

Customer acquisition cost (est.): $50-100
Payback period: ~1 month
LTV (24-month avg tenure): ~$2,138
LTV:CAC ratio: 21-43x
```

### 12.3 Growth Model

```
Year 1 (Launch):
├── Month 1-3: Beta with 50 properties
├── Month 4-6: Launch NSW, target 200 properties
├── Month 7-9: Expand VIC, target 500 properties
├── Month 10-12: Expand QLD, target 1,000 properties
└── ARR: ~$1.2M

Year 2 (Scale):
├── National coverage (all states)
├── Outsourcing network buildout
├── Target: 5,000 properties
└── ARR: ~$6M

Year 3 (Expand):
├── New Zealand launch
├── Commercial property support
├── Target: 15,000 properties
└── ARR: ~$18M
```

---

## 13. Go-to-Market Strategy

### 13.1 Launch Channels

| Channel | Strategy | CAC Est. |
|---------|----------|----------|
| **Property investor groups** | Facebook groups, BiggerPockets AU | $30 |
| **Content marketing** | SEO: "how to self-manage property" | $20 |
| **Referral program** | $50 credit for referrer + referred | $50 |
| **PM switchers** | Target owners with PM complaints | $40 |
| **Real estate agent referrals** | Kickback for investor referrals | $100 |

### 13.2 Messaging

**Primary**: "Property management without the property manager"

**Supporting messages**:
- "Save $3,000/year per property"
- "Your AI property manager, 24/7"
- "Self-manage without the hassle"
- "From listing to leasing in 2 weeks"

### 13.3 Launch Sequence

```
Pre-launch (4 weeks before):
├── Landing page with waitlist
├── "Coming soon" content
├── Beta user recruitment
└── PR/media outreach

Soft launch (2 weeks):
├── Beta users only
├── High-touch onboarding
├── Rapid iteration
└── Case study development

Public launch:
├── App Store/Play Store live
├── Press release
├── Social media campaign
├── Launch offer: "First month free"
└── Referral program activation
```

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **PropBot** | Working name for the AI property management platform |
| **Agent** | Autonomous AI component that handles specific domain (listing, tenant, maintenance) |
| **Orchestrator** | Central system coordinating all agents |
| **Durable Object** | Cloudflare stateful worker that persists between requests |
| **RLS** | Row Level Security - database-level access control |
| **Bond** | Security deposit held by state authority |
| **TICA** | Tenancy Information Centre Australia - tenancy database |

---

## Appendix B: State Differences

| Aspect | NSW | VIC | QLD |
|--------|-----|-----|-----|
| Bond authority | Fair Trading | RTBA | RTA |
| Max bond | 4 weeks rent | 1 month rent | 4 weeks rent |
| Inspection notice | 7 days | 24 hours | 24 hours (entry) |
| Inspection frequency | Every 6 months | Every 6 months | Every 3 months |
| Lease break fee | Varies | 4 weeks | Varies |

---

## Appendix C: Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Domain/REA API access denied | Medium | High | Manual posting fallback, negotiate early |
| Equifax/TICA API changes | Low | Medium | Abstract integration, multiple providers |
| State law changes | Medium | Medium | Legal review quarterly, template versioning |
| AI makes bad tenant recommendation | Medium | High | Human approval required, clear disclaimers |
| Payment fraud | Low | High | Stripe fraud protection, verification |
| Data breach | Low | Critical | SOC2 compliance, pen testing, encryption |

---

*This document is the single source of truth for PropBot development. Update it as decisions are made and architecture evolves.*
