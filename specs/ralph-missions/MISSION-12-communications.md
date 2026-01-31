# Mission 12: In-App Communications

## Overview
**Goal**: Provide secure, trackable communication between owners and tenants within the app.
**Dependencies**: Mission 06 (Tenancies)
**Estimated Complexity**: Medium

## Success Criteria

### Phase A: Database Schema
- [ ] Create `conversations` table
- [ ] Create `messages` table
- [ ] Create `message_attachments` table
- [ ] Set up RLS policies
- [ ] Real-time subscriptions

### Phase B: Conversation List
- [ ] Create MessagesScreen (both apps)
- [ ] List all conversations
- [ ] Show unread count
- [ ] Last message preview
- [ ] Sort by recent activity

### Phase C: Conversation View
- [ ] Create ConversationScreen
- [ ] Message thread display
- [ ] Real-time message updates
- [ ] Message status (sent, delivered, read)
- [ ] Typing indicators

### Phase D: Messaging Features
- [ ] Send text messages
- [ ] Send images/documents
- [ ] Reply to specific message
- [ ] Message reactions (👍, etc.)
- [ ] Edit/delete own messages (within time limit)

### Phase E: Conversation Types
- [ ] Direct messages (owner ↔ tenant)
- [ ] Property-specific conversations
- [ ] Maintenance request threads
- [ ] System notifications thread

### Phase F: Smart Features
- [ ] Message templates for common responses
- [ ] PM transition welcome message templates (3-message sequence)
- [ ] Automated PM transition flow: welcome → rent setup → maintenance intro
- [ ] Suggested quick replies
- [ ] Link to relevant records (maintenance, payments)
- [ ] Search messages

### Phase G: Notifications
- [ ] Push notification for new messages
- [ ] Email fallback if app not opened
- [ ] Notification preferences

### Phase H: Testing
- [ ] Unit tests for message hooks
- [ ] Integration tests for real-time sync
- [ ] E2E test: Send message → Receive → Reply

## Database Schema

```sql
-- Conversation type enum
CREATE TYPE conversation_type AS ENUM (
  'direct',           -- General owner-tenant chat
  'maintenance',      -- Linked to maintenance request
  'payment',          -- Payment-related discussion
  'lease',            -- Lease/tenancy matters
  'system'            -- System notifications
);

-- Message status enum
CREATE TYPE message_status AS ENUM (
  'sending',
  'sent',
  'delivered',
  'read',
  'failed'
);

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  tenancy_id UUID REFERENCES tenancies(id) ON DELETE SET NULL,

  -- Type and linking
  conversation_type conversation_type NOT NULL DEFAULT 'direct',
  linked_record_id UUID, -- maintenance_request_id, payment_id, etc.
  linked_record_type TEXT,

  -- Title (auto-generated or custom)
  title TEXT,

  -- Last activity
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversation participants
CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Read state
  last_read_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,

  -- Notifications
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  muted_until TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  left_at TIMESTAMPTZ,

  -- Metadata
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(conversation_id, user_id)
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Content
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'document', 'system')),

  -- Reply
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,

  -- Status
  status message_status NOT NULL DEFAULT 'sending',

  -- Edit/delete
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  original_content TEXT, -- Store original if edited

  -- Metadata
  metadata JSONB, -- For system messages, links, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Message attachments
CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,

  -- File details
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Message read receipts
CREATE TABLE message_read_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Message reactions
CREATE TABLE message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL, -- emoji
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, reaction)
);

-- Message templates
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- NULL for system defaults
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT, -- 'greeting', 'maintenance', 'payment', etc.
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default templates
INSERT INTO message_templates (name, content, category) VALUES
('Maintenance Acknowledged', 'Thank you for reporting this issue. I''ve received your maintenance request and will look into it shortly.', 'maintenance'),
('Payment Received', 'Thank you for your rent payment. It has been received and recorded.', 'payment'),
('Inspection Scheduled', 'I''d like to schedule a routine inspection of the property. Please let me know if the proposed date works for you.', 'inspection'),
('Welcome', 'Welcome to your new home! Please don''t hesitate to reach out if you have any questions.', 'greeting'),
('PM Transition Welcome', 'Hi {{tenant_name}}, I''m taking over management of your property at {{property_address}}. Going forward, you''ll be able to reach me directly through this app for any questions, maintenance requests, or rent queries. Nothing changes with your lease — just a simpler way to communicate. Feel free to say hi!', 'pm_transition'),
('PM Transition Rent Setup', 'Quick update: rent payments will now be processed through the Casa app. You''ll receive a secure link to set up your payment method. Your rent amount (${{rent_amount}}/week) and due date remain the same.', 'pm_transition'),
('PM Transition Maintenance', 'Just a heads up — if you need any maintenance or repairs, you can now submit requests directly through the app with photos. It''s the fastest way to get things sorted. Tap the Maintenance tab to get started.', 'pm_transition');

-- Indexes
CREATE INDEX idx_conversations_property ON conversations(property_id);
CREATE INDEX idx_conversations_tenancy ON conversations(tenancy_id);
CREATE INDEX idx_conversation_participants ON conversation_participants(user_id) WHERE is_active;
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_message_attachments ON message_attachments(message_id);

-- RLS Policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- Users can only see conversations they're part of
CREATE POLICY "View own conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
      AND conversation_participants.user_id = auth.uid()
      AND conversation_participants.is_active
    )
  );

-- Participants can view/update their participation
CREATE POLICY "Manage own participation"
  ON conversation_participants FOR ALL
  USING (auth.uid() = user_id);

-- View others in same conversation
CREATE POLICY "View co-participants"
  ON conversation_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants AS cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
      AND cp.is_active
    )
  );

-- Messages: participants can view all, send own
CREATE POLICY "View messages in conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.user_id = auth.uid()
      AND conversation_participants.is_active
    )
  );

CREATE POLICY "Send messages"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.user_id = auth.uid()
      AND conversation_participants.is_active
    )
  );

CREATE POLICY "Edit own messages"
  ON messages FOR UPDATE
  USING (auth.uid() = sender_id);

-- Attachments follow message permissions
CREATE POLICY "View attachments"
  ON message_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages
      JOIN conversation_participants ON conversation_participants.conversation_id = messages.conversation_id
      WHERE messages.id = message_attachments.message_id
      AND conversation_participants.user_id = auth.uid()
    )
  );

-- Templates: system + own
CREATE POLICY "View templates"
  ON message_templates FOR SELECT
  USING (owner_id IS NULL OR owner_id = auth.uid());

CREATE POLICY "Manage own templates"
  ON message_templates FOR ALL
  USING (owner_id = auth.uid());

-- Function to update conversation on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Update conversation last message
  UPDATE conversations SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  -- Increment unread count for other participants
  UPDATE conversation_participants SET
    unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id
    AND is_active;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER message_inserted
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- Function to reset unread on read
CREATE OR REPLACE FUNCTION mark_conversation_read(p_conversation_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE conversation_participants SET
    unread_count = 0,
    last_read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND user_id = auth.uid();

  -- Mark messages as read
  INSERT INTO message_read_receipts (message_id, user_id, read_at)
  SELECT m.id, auth.uid(), NOW()
  FROM messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id != auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM message_read_receipts
      WHERE message_id = m.id AND user_id = auth.uid()
    )
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Files to Create/Modify

### Packages
```
packages/api/src/
├── queries/
│   ├── conversations.ts        # Conversation CRUD
│   ├── messages.ts             # Message CRUD
│   └── messageTemplates.ts     # Template management
├── hooks/
│   ├── useConversations.ts     # List conversations
│   ├── useConversation.ts      # Single conversation
│   ├── useMessages.ts          # Messages with real-time
│   └── useMessageMutations.ts
└── realtime/
    └── messages.ts             # Real-time subscriptions
```

### Owner App & Tenant App (similar structure)
```
apps/[owner|tenant]/app/(app)/
├── messages/
│   ├── index.tsx               # Conversation list
│   ├── [id].tsx                # Conversation view
│   └── new.tsx                 # New conversation

apps/[owner|tenant]/components/
├── ConversationCard.tsx        # Conversation list item
├── MessageBubble.tsx           # Message display
├── MessageInput.tsx            # Compose message
├── AttachmentPicker.tsx        # Add attachments
├── TemplateSelector.tsx        # Quick templates
├── TypingIndicator.tsx         # Typing status
└── ReplyPreview.tsx            # Reply context
```

### Shared UI
```
packages/ui/src/components/
├── Avatar.tsx                  # Update for groups
├── Badge.tsx                   # Unread count badge
├── MessageTimestamp.tsx        # Relative timestamps
└── ReadReceipts.tsx            # Read status display
```

## Real-Time Implementation

```typescript
// packages/api/src/realtime/messages.ts
import { supabase } from '../client'

export function subscribeToConversation(
  conversationId: string,
  onMessage: (message: Message) => void
) {
  return supabase
    .channel(`conversation:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onMessage(payload.new as Message)
    )
    .subscribe()
}

export function subscribeToTyping(
  conversationId: string,
  onTyping: (userId: string, isTyping: boolean) => void
) {
  return supabase
    .channel(`typing:${conversationId}`)
    .on('presence', { event: 'sync' }, () => {
      // Handle typing presence
    })
    .subscribe()
}
```

## Push Notification Integration

Link to Mission 17 for full implementation:
- New message → Push notification
- Respect mute settings
- Deep link to conversation

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Commit Message Pattern
```
feat(communications): <description>

Mission-12: In-App Communications
```

## Notes
- All communications stored for legal record
- Real-time via Supabase Realtime
- Consider message retention policy for GDPR
- Templates speed up common responses
- Link messages to records (maintenance, payments) for context
- Typing indicators improve UX but are optional
- Email fallback ensures critical messages aren't missed
- Consider AI-suggested responses in future

## PM Transition Tenant Welcome Flow

When an owner switches from a traditional property manager to Casa, the tenant needs a smooth introduction. This flow is triggered when an owner completes the PM transition onboarding wizard (Mission 20) and imports existing tenants.

### Welcome Message Sequence
1. **Immediate**: "PM Transition Welcome" — introduces the owner, explains Casa, reassures tenant
2. **After 24 hours**: "PM Transition Rent Setup" — explains new payment process with setup link
3. **After 48 hours**: "PM Transition Maintenance" — shows them how to submit maintenance requests

### Implementation
```typescript
// packages/api/src/services/pmTransitionMessages.ts

interface PMTransitionService {
  // Trigger welcome sequence for a tenant after PM transition
  initiateWelcomeSequence(params: {
    ownerId: string;
    tenantId: string;
    propertyId: string;
    tenantName: string;
    propertyAddress: string;
    weeklyRent: number;
  }): Promise<void>;
}

// The sequence is scheduled via Supabase Edge Function cron:
// 1. Send welcome message immediately
// 2. Schedule rent setup message for +24h
// 3. Schedule maintenance intro for +48h
// Each message uses the template system with dynamic variables filled in
```

### Variables Available for Templates
- `{{tenant_name}}` — Tenant's first name
- `{{property_address}}` — Full property address
- `{{rent_amount}}` — Weekly rent amount
- `{{owner_name}}` — Owner's first name
- `{{lease_end_date}}` — Current lease end date (if known)

---

## Third-Party Integrations (CRITICAL FOR LAUNCH)

### Multi-Channel Communications
**Why**: Not all users check the app constantly. SMS and email fallbacks ensure critical messages (rent reminders, maintenance updates, emergency notices) reach tenants and owners reliably.

### Twilio Integration (SMS & WhatsApp)
| Aspect | Details |
|--------|---------|
| **API** | Twilio Programmable Messaging API |
| **Channels** | SMS, WhatsApp Business |
| **Purpose** | Critical notifications, 2FA, message fallback |
| **Features** | Delivery receipts, templates, scheduling |
| **Pricing** | Per-message (SMS ~$0.05 AU, WhatsApp ~$0.02) |

**API Functions (from STEAD-BIBLE.md)**:
```typescript
// packages/integrations/src/twilio/client.ts
interface TwilioService {
  // Send SMS
  sendSMS(params: {
    to: string;              // E.164 format: +61412345678
    body: string;
    statusCallback?: string; // Webhook for delivery status
    scheduledAt?: Date;      // Future send time
  }): Promise<SMSResult>;

  // Send WhatsApp message
  sendWhatsApp(params: {
    to: string;              // WhatsApp number
    templateId?: string;     // Pre-approved template
    templateParams?: Record<string, string>;
    body?: string;           // For session messages only
  }): Promise<WhatsAppResult>;

  // Check message status
  getMessageStatus(messageSid: string): Promise<MessageStatus>;

  // Verify phone number (for 2FA)
  sendVerificationCode(to: string): Promise<VerificationResult>;
  checkVerificationCode(to: string, code: string): Promise<boolean>;
}

interface SMSResult {
  sid: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  to: string;
  dateCreated: Date;
}

interface WhatsAppResult {
  sid: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  to: string;
  templateId?: string;
}
```

**WhatsApp Business Templates** (Must be pre-approved):
```typescript
// packages/integrations/src/twilio/whatsappTemplates.ts
export const WHATSAPP_TEMPLATES = {
  // Rent reminders
  RENT_DUE_REMINDER: {
    id: 'rent_due_reminder',
    category: 'UTILITY',
    content: 'Hi {{1}}, your rent of {{2}} is due on {{3}}. Pay now in the Casa app.',
    params: ['tenant_name', 'amount', 'due_date'],
  },

  // Maintenance updates
  MAINTENANCE_UPDATE: {
    id: 'maintenance_update',
    category: 'UTILITY',
    content: 'Update on your maintenance request #{{1}}: {{2}}. View details in the Casa app.',
    params: ['request_id', 'status_message'],
  },

  // Inspection scheduled
  INSPECTION_SCHEDULED: {
    id: 'inspection_scheduled',
    category: 'UTILITY',
    content: 'Property inspection scheduled for {{1}} at {{2}}. Reply YES to confirm or contact your landlord to reschedule.',
    params: ['date', 'time'],
  },

  // Payment received
  PAYMENT_RECEIVED: {
    id: 'payment_received',
    category: 'UTILITY',
    content: 'Payment of {{1}} received for {{2}}. Thank you! View receipt in the Casa app.',
    params: ['amount', 'property_address'],
  },
};
```

**Implementation Tasks**:
- [ ] Create Twilio account and verify business
- [ ] Purchase Australian phone number(s) for SMS
- [ ] Apply for WhatsApp Business API access
- [ ] Submit WhatsApp templates for approval (takes 24-48 hours)
- [ ] Create `packages/integrations/src/twilio/` service module
- [ ] Implement SMS fallback logic (in-app → push → SMS)
- [ ] Implement delivery status webhooks
- [ ] Build opt-out/unsubscribe handling (required by law)

### SendGrid Integration (Email)
| Aspect | Details |
|--------|---------|
| **API** | SendGrid Mail Send API |
| **Purpose** | Transactional emails, receipts, reminders |
| **Features** | Templates, tracking, analytics, scheduled sends |
| **Deliverability** | High (verified domain, DKIM/SPF) |
| **Pricing** | Per-email with free tier (100/day) |

**API Functions (from STEAD-BIBLE.md)**:
```typescript
// packages/integrations/src/sendgrid/client.ts
interface SendGridService {
  // Send transactional email
  sendEmail(params: {
    to: string | string[];
    from: string;            // Must be verified sender
    subject: string;
    templateId?: string;     // Dynamic template ID
    dynamicData?: Record<string, any>;
    html?: string;           // Or raw HTML
    text?: string;           // Plain text fallback
    attachments?: Attachment[];
    categories?: string[];   // For analytics
    sendAt?: number;         // Unix timestamp for scheduled send
  }): Promise<EmailResult>;

  // Send with template
  sendTemplatedEmail(params: {
    to: string | string[];
    templateId: string;
    dynamicData: Record<string, any>;
    categories?: string[];
  }): Promise<EmailResult>;

  // Get email statistics
  getEmailStats(startDate: Date, endDate: Date): Promise<EmailStats>;
}

interface EmailResult {
  messageId: string;
  statusCode: number;
}

interface Attachment {
  content: string;          // Base64 encoded
  filename: string;
  type: string;             // MIME type
  disposition: 'attachment' | 'inline';
}
```

**Email Templates**:
```typescript
// packages/integrations/src/sendgrid/templates.ts
export const EMAIL_TEMPLATES = {
  // Authentication
  WELCOME_EMAIL: 'd-xxx1',
  PASSWORD_RESET: 'd-xxx2',
  EMAIL_VERIFICATION: 'd-xxx3',

  // Payments
  PAYMENT_RECEIPT: 'd-xxx4',
  PAYMENT_FAILED: 'd-xxx5',
  RENT_REMINDER: 'd-xxx6',
  PAYMENT_OVERDUE: 'd-xxx7',

  // Applications
  APPLICATION_RECEIVED: 'd-xxx8',
  APPLICATION_STATUS_UPDATE: 'd-xxx9',
  APPLICATION_APPROVED: 'd-xxx10',

  // Maintenance
  MAINTENANCE_REQUEST_RECEIVED: 'd-xxx11',
  MAINTENANCE_UPDATE: 'd-xxx12',
  MAINTENANCE_COMPLETED: 'd-xxx13',

  // Tenancy
  LEASE_FOR_SIGNING: 'd-xxx14',
  LEASE_SIGNED: 'd-xxx15',
  LEASE_EXPIRY_REMINDER: 'd-xxx16',
  INSPECTION_SCHEDULED: 'd-xxx17',

  // System
  WEEKLY_SUMMARY_OWNER: 'd-xxx18',
  MONTHLY_STATEMENT_TENANT: 'd-xxx19',
};
```

**Implementation Tasks**:
- [ ] Create SendGrid account and verify domain
- [ ] Set up DKIM, SPF, and DMARC records
- [ ] Create dynamic templates in SendGrid dashboard
- [ ] Create `packages/integrations/src/sendgrid/` service module
- [ ] Implement email tracking webhooks
- [ ] Build unsubscribe handling
- [ ] Create email preference center

### Notification Priority System
```typescript
// packages/api/src/services/notifications.ts

/**
 * Multi-channel notification dispatcher
 * Sends via most appropriate channel based on urgency and user preferences
 */
interface NotificationService {
  send(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    channels?: NotificationChannel[];  // Override auto-selection
  }): Promise<NotificationResult>;
}

type NotificationChannel = 'push' | 'in_app' | 'email' | 'sms' | 'whatsapp';

// Channel selection logic
function selectChannels(priority: string, userPrefs: UserPrefs): NotificationChannel[] {
  switch (priority) {
    case 'urgent':
      // Emergency - all channels
      return ['push', 'in_app', 'sms', 'email'];

    case 'high':
      // Important - push + fallback to SMS/email
      return ['push', 'in_app', 'sms'];

    case 'normal':
      // Standard - push + email
      return ['push', 'in_app', 'email'];

    case 'low':
      // Informational - in-app only
      return ['in_app'];

    default:
      return ['push', 'in_app'];
  }
}
```

### Notification Triggers
```typescript
// packages/api/src/services/notificationTriggers.ts

export const NOTIFICATION_TRIGGERS = {
  // Payments (HIGH priority)
  RENT_DUE_3_DAYS: {
    type: 'rent_reminder',
    priority: 'normal',
    channels: ['push', 'email'],
    template: { sms: 'RENT_DUE_REMINDER', email: 'RENT_REMINDER' },
  },
  RENT_DUE_TODAY: {
    type: 'rent_reminder',
    priority: 'high',
    channels: ['push', 'sms', 'email'],
    template: { sms: 'RENT_DUE_REMINDER', email: 'RENT_REMINDER' },
  },
  RENT_OVERDUE: {
    type: 'rent_overdue',
    priority: 'urgent',
    channels: ['push', 'sms', 'email', 'whatsapp'],
    template: { sms: 'RENT_OVERDUE', email: 'PAYMENT_OVERDUE' },
  },
  PAYMENT_RECEIVED: {
    type: 'payment_received',
    priority: 'normal',
    channels: ['push', 'email'],
    template: { email: 'PAYMENT_RECEIPT' },
  },

  // Maintenance
  MAINTENANCE_REQUEST_CREATED: {
    type: 'maintenance_created',
    priority: 'normal',
    channels: ['push', 'email'],
    template: { email: 'MAINTENANCE_REQUEST_RECEIVED' },
  },
  MAINTENANCE_EMERGENCY: {
    type: 'maintenance_emergency',
    priority: 'urgent',
    channels: ['push', 'sms', 'email'],
  },

  // Messages (varies by conversation context)
  NEW_MESSAGE: {
    type: 'new_message',
    priority: 'normal',
    channels: ['push'],
    // Falls back to email after 30 min if unread
    fallbackAfterMinutes: 30,
    fallbackChannels: ['email'],
  },

  // Inspections
  INSPECTION_SCHEDULED: {
    type: 'inspection_scheduled',
    priority: 'high',
    channels: ['push', 'email', 'sms'],
    template: { sms: 'INSPECTION_SCHEDULED', email: 'INSPECTION_SCHEDULED' },
  },
};
```

### Database Additions
```sql
-- Notification preferences per user
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  -- Channel preferences
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- Quiet hours
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',
  quiet_hours_timezone TEXT DEFAULT 'Australia/Sydney',

  -- Notification types
  rent_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  payment_receipts BOOLEAN NOT NULL DEFAULT TRUE,
  maintenance_updates BOOLEAN NOT NULL DEFAULT TRUE,
  message_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  marketing_emails BOOLEAN NOT NULL DEFAULT FALSE,

  -- Phone for SMS/WhatsApp (verified)
  sms_phone TEXT,
  sms_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_phone TEXT,
  whatsapp_opted_in_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification log for tracking and debugging
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Notification details
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL, -- 'push', 'email', 'sms', 'whatsapp', 'in_app'
  priority TEXT NOT NULL,

  -- Content
  title TEXT,
  body TEXT,
  data JSONB,

  -- External IDs
  external_id TEXT,  -- Twilio SID, SendGrid message ID, etc.

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'bounced'
  status_detail TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unsubscribe tracking (legal requirement)
CREATE TABLE notification_unsubscribes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT,
  phone TEXT,
  channel TEXT NOT NULL,
  reason TEXT,
  unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX idx_notification_logs_user ON notification_logs(user_id, created_at DESC);
CREATE INDEX idx_notification_logs_status ON notification_logs(status, channel);
```

### Environment Variables
```bash
# Twilio
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+61xxxxxxxxx      # For SMS
TWILIO_WHATSAPP_NUMBER=+1xxxxxxxxxx   # WhatsApp sender
TWILIO_VERIFY_SERVICE_SID=VAxxx       # For phone verification

# SendGrid
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=noreply@casapm.com.au
SENDGRID_FROM_NAME=Casa
SENDGRID_REPLY_TO=support@casapm.com.au

# Webhook secrets
TWILIO_WEBHOOK_SECRET=xxx
SENDGRID_WEBHOOK_SECRET=xxx
```

### Files to Create for Integrations
```
packages/integrations/
├── src/
│   ├── twilio/
│   │   ├── client.ts              # Twilio client
│   │   ├── sms.ts                 # SMS functions
│   │   ├── whatsapp.ts            # WhatsApp functions
│   │   ├── verify.ts              # Phone verification
│   │   ├── templates.ts           # WhatsApp templates
│   │   └── webhooks.ts            # Status webhooks
│   ├── sendgrid/
│   │   ├── client.ts              # SendGrid client
│   │   ├── email.ts               # Email functions
│   │   ├── templates.ts           # Template IDs
│   │   └── webhooks.ts            # Event webhooks
│   └── notifications/
│       ├── dispatcher.ts          # Multi-channel dispatcher
│       ├── triggers.ts            # Notification triggers
│       └── preferences.ts         # User preferences

supabase/functions/
├── twilio-webhook/                # SMS/WhatsApp status
│   └── index.ts
├── sendgrid-webhook/              # Email events
│   └── index.ts
├── send-notification/             # Dispatch notifications
│   └── index.ts
└── scheduled-notifications/       # Rent reminders, etc.
    └── index.ts
```

### Owner/Tenant App UI Additions
- [ ] Notification preferences screen
- [ ] Phone verification flow for SMS
- [ ] WhatsApp opt-in flow
- [ ] Email preference center
- [ ] Quiet hours configuration
- [ ] Notification history view

### Integration Priority
| Integration | Priority | MVP Required | Notes |
|-------------|----------|--------------|-------|
| SendGrid Email | P1 | Yes | Essential for receipts, reminders |
| Twilio SMS | P1 | Yes | Critical notifications fallback |
| Push (Expo) | P1 | Yes | Primary notification channel |
| Twilio WhatsApp | P3 | No | Nice-to-have, higher engagement |

### Compliance Notes
- SMS: Must include opt-out instructions ("Reply STOP to unsubscribe")
- Email: Must include unsubscribe link (CAN-SPAM/Australian Spam Act)
- WhatsApp: Must use approved templates for business-initiated messages
- All: Respect user notification preferences and quiet hours

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All migrations applied to remote Supabase (`conversations`, `messages`, `message_attachments`)
- [ ] RLS policies verified: users can only view conversations they are part of
- [ ] RLS policies verified: users can only send messages to their own conversations
- [ ] Real-time subscriptions configured for new messages
- [ ] Indexes created for conversation lookup and message ordering
- [ ] Foreign keys correct with CASCADE on messages and attachments
- [ ] Notification preferences table supports per-channel settings

### Feature Verification (Mission-Specific)
- [ ] Conversation list shows all user's conversations with unread count
- [ ] Last message preview and timestamp display correctly
- [ ] Conversations sort by most recent activity
- [ ] Real-time message delivery works (sender sees instant, receiver sees within seconds)
- [ ] Message status indicators work (sent, delivered, read)
- [ ] Typing indicators display when other party is typing
- [ ] User can send text messages
- [ ] User can send images and document attachments
- [ ] User can reply to a specific message (threaded reply)
- [ ] Property-specific conversations link to correct property
- [ ] Maintenance request threads link to correct request
- [ ] SendGrid email integration sends notifications for new messages
- [ ] Twilio SMS integration works for critical notifications
- [ ] Message templates for common responses work
- [ ] Message search finds results across conversations
- [ ] Notification preferences respected (no notifications during quiet hours)

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
- [ ] Messages encrypted in transit
- [ ] Attachment URLs use signed/expiring links (not publicly accessible)


---

## Gateway Implementation (Pre-Built)

> The following gateway infrastructure was created in Mission 07 to facilitate this mission:

### Files Created
- `packages/api/src/hooks/gateways/useMessagesGateway.ts` — Hook with navigation entry points and placeholder state
- `packages/api/src/types/gateways.ts` — Type definitions for messaging entities

### What's Already Done
1. **Types defined**: All TypeScript interfaces including:
   - `Conversation` with type, property/tenancy links, last message tracking
   - `Message` with sender, content, status (sending → sent → delivered → read)
   - `MessageAttachment` for file sharing
   - `ConversationType` (direct, maintenance, application, inspection)
2. **Gateway hook**: `useMessagesGateway(conversationId?)` provides:
   - State: `items`, `unreadCount`, `activeConversation`, `messages`
   - Navigation: `navigateToConversationsList()`, `navigateToConversation()`, `navigateToNewConversation()`
   - Actions: `createConversation()`, `sendMessage()`, `markConversationRead()`, `getMessages()`
   - Real-time stubs: `subscribeToConversation()`, `subscribeToUnreadCount()`
3. **Exported from `@casa/api`**: Import directly in components

### What This Mission Needs to Do
1. Create database migration with conversation/message tables
2. Set up Supabase Realtime subscriptions
3. Implement actual message sending/receiving
4. Build conversation UI with typing indicators
5. Create message template system

### Usage Example (Already Works)
```typescript
import { useMessagesGateway } from '@casa/api';

function MessagesScreen() {
  const { items, unreadCount, navigateToConversation, sendMessage } = useMessagesGateway();
}
```
