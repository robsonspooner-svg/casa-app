# Mission 17: Push Notifications & Alerts

## Overview
**Goal**: Implement comprehensive push notification system for real-time alerts and reminders.
**Dependencies**: Mission 02 (Auth)
**Estimated Complexity**: Medium

## Success Criteria

### Phase A: Infrastructure Setup
- [ ] Set up Expo Push Notifications
- [ ] Create notification service
- [ ] Store push tokens in database
- [ ] Handle token refresh

### Phase B: Database Schema
- [ ] Create `push_tokens` table
- [ ] Create `notifications` table
- [ ] Create `notification_preferences` table
- [ ] Set up RLS policies

### Phase C: Notification Types
- [ ] Payment received
- [ ] Payment due/overdue
- [ ] Maintenance request updates
- [ ] New application received
- [ ] Message received
- [ ] Inspection reminder
- [ ] Compliance due
- [ ] Lease expiring

### Phase D: Notification Preferences
- [ ] Create PreferencesScreen
- [ ] Toggle by notification type
- [ ] Quiet hours setting
- [ ] Email fallback preferences
- [ ] Per-property settings

### Phase E: Notification Center
- [ ] Create NotificationsScreen
- [ ] List all notifications
- [ ] Mark as read
- [ ] Clear all
- [ ] Deep link to relevant screen

### Phase F: In-App Notifications
- [ ] Toast notifications
- [ ] Badge counts
- [ ] Tab bar badges
- [ ] Notification bell icon

### Phase G: Email Notifications
- [ ] Email templates
- [ ] Digest options (immediate, daily, weekly)
- [ ] Unsubscribe handling

### Phase H: Testing
- [ ] Unit tests for notification service
- [ ] Integration tests for delivery
- [ ] E2E test: Trigger event → Receive notification

---

## Deferred from Mission 05: Application Email Notifications

### New Application Notification (to Owner)
When a tenant submits an application, the owner should receive an email notification.

**Trigger**: `applications` table INSERT with `status = 'submitted'` (use database trigger or listen to realtime event)

**Email Template**:
```
Subject: New application for {listing.title}

Hi {owner.full_name},

You've received a new application for your listing "{listing.title}" at {property.address_line_1}, {property.suburb}.

Applicant: {application.full_name}
Proposed move-in: {application.move_in_date}
Employment: {application.employment_type} at {application.employer_name}

View the full application in your Casa app.
```

**Implementation**:
- Create Supabase Edge Function `send-application-notification` or use existing Cloudflare Worker
- Use Resend API (key available in marketing site's `.env.local`: `RESEND_API_KEY`)
- From address: `notifications@casa-property.com` (or configured domain)
- Database trigger on `applications` INSERT calls Edge Function via `pg_net`

### Application Status Change Notification (to Tenant)
When an owner changes application status, the tenant should receive an email.

**Trigger**: `applications` table UPDATE where `status` changes to `under_review`, `shortlisted`, `approved`, or `rejected`

**Email Template**:
```
Subject: Application update for {listing.title}

Hi {application.full_name},

Your application for "{listing.title}" at {property.address_line_1} has been updated.

Status: {new_status}
{rejection_reason if status = 'rejected'}

{next_steps based on status:
  under_review: "The owner is reviewing your application."
  shortlisted: "Great news! You've been shortlisted."
  approved: "Congratulations! Your application has been approved."
  rejected: "Unfortunately your application was not successful."}

View your application status in the Casa app.
```

**Implementation**:
- Add to the same Edge Function or create `send-status-update-notification`
- Database trigger on `applications` UPDATE where `OLD.status != NEW.status`
- Only send for meaningful status transitions (not draft → draft)

### Testing Requirements
- [ ] New application → owner receives email notification
- [ ] Status change to under_review → tenant receives email
- [ ] Status change to shortlisted → tenant receives email
- [ ] Status change to approved → tenant receives email
- [ ] Status change to rejected → tenant receives email with rejection reason
- [ ] Withdrawn applications do not trigger owner notification

---

## Database Schema

```sql
-- Push tokens
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Token details
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id TEXT,
  device_name TEXT,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, token)
);

-- Notification types enum
CREATE TYPE notification_type AS ENUM (
  -- Payments
  'payment_received',
  'payment_due',
  'payment_overdue',
  'autopay_scheduled',
  'autopay_failed',

  -- Maintenance
  'maintenance_submitted',
  'maintenance_acknowledged',
  'maintenance_scheduled',
  'maintenance_completed',

  -- Applications
  'application_received',
  'application_status_changed',

  -- Messages
  'message_received',

  -- Inspections
  'inspection_scheduled',
  'inspection_reminder',
  'inspection_completed',

  -- Compliance
  'compliance_due_soon',
  'compliance_overdue',

  -- Tenancy
  'lease_expiring_soon',
  'lease_renewed',
  'tenant_moved_out',

  -- System
  'system_announcement',
  'feature_update'
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Notification content
  notification_type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB, -- Additional payload

  -- Related records
  related_type TEXT, -- 'property', 'tenancy', 'payment', etc.
  related_id UUID,

  -- Delivery
  push_sent BOOLEAN NOT NULL DEFAULT FALSE,
  push_sent_at TIMESTAMPTZ,
  push_error TEXT,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,

  -- Status
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification preferences
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Type-specific settings
  notification_type notification_type NOT NULL,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- Metadata
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, notification_type)
);

-- Global notification settings
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  -- Quiet hours
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',
  quiet_hours_timezone TEXT DEFAULT 'Australia/Sydney',

  -- Email digest
  email_digest TEXT NOT NULL DEFAULT 'immediate' CHECK (email_digest IN ('immediate', 'daily', 'weekly', 'none')),
  email_digest_time TIME DEFAULT '09:00',

  -- Do not disturb
  do_not_disturb_until TIMESTAMPTZ,

  -- Metadata
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scheduled notifications
CREATE TABLE scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Notification content
  notification_type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,

  -- Schedule
  scheduled_for TIMESTAMPTZ NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_rule TEXT, -- iCal RRULE format

  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'cancelled')),
  sent_at TIMESTAMPTZ,

  -- Related
  related_type TEXT,
  related_id UUID,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_push_tokens_user ON push_tokens(user_id) WHERE is_active;
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE NOT is_read;
CREATE INDEX idx_notification_preferences ON notification_preferences(user_id);
CREATE INDEX idx_scheduled_notifications ON scheduled_notifications(scheduled_for) WHERE status = 'scheduled';

-- RLS Policies
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push tokens"
  ON push_tokens FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own notifications"
  ON notifications FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own settings"
  ON notification_settings FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own scheduled notifications"
  ON scheduled_notifications FOR ALL
  USING (auth.uid() = user_id);

-- Function to send notification
CREATE OR REPLACE FUNCTION send_notification(
  p_user_id UUID,
  p_type notification_type,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT NULL,
  p_related_type TEXT DEFAULT NULL,
  p_related_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
  user_prefs notification_preferences%ROWTYPE;
  global_settings notification_settings%ROWTYPE;
  should_push BOOLEAN := TRUE;
  should_email BOOLEAN := TRUE;
BEGIN
  -- Get user preferences for this type
  SELECT * INTO user_prefs
  FROM notification_preferences
  WHERE user_id = p_user_id AND notification_type = p_type;

  -- Get global settings
  SELECT * INTO global_settings
  FROM notification_settings
  WHERE user_id = p_user_id;

  -- Check preferences
  IF user_prefs IS NOT NULL THEN
    should_push := user_prefs.push_enabled;
    should_email := user_prefs.email_enabled;
  END IF;

  -- Check quiet hours
  IF global_settings.quiet_hours_enabled THEN
    IF CURRENT_TIME BETWEEN global_settings.quiet_hours_start AND global_settings.quiet_hours_end THEN
      should_push := FALSE;
    END IF;
  END IF;

  -- Check do not disturb
  IF global_settings.do_not_disturb_until IS NOT NULL AND NOW() < global_settings.do_not_disturb_until THEN
    should_push := FALSE;
  END IF;

  -- Create notification record
  INSERT INTO notifications (
    user_id, notification_type, title, body, data,
    related_type, related_id
  )
  VALUES (
    p_user_id, p_type, p_title, p_body, p_data,
    p_related_type, p_related_id
  )
  RETURNING id INTO notification_id;

  -- Queue push notification via edge function (handled separately)
  -- Queue email notification via edge function (handled separately)

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Initialize default preferences for new users
CREATE OR REPLACE FUNCTION init_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_settings (user_id) VALUES (NEW.id);

  INSERT INTO notification_preferences (user_id, notification_type)
  SELECT NEW.id, unnest(enum_range(NULL::notification_type));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER user_notification_prefs_init
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION init_notification_preferences();

-- Updated_at triggers
CREATE TRIGGER push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Files to Create/Modify

### Packages
```
packages/api/src/
├── queries/
│   ├── notifications.ts        # Notification CRUD
│   └── pushTokens.ts           # Token management
├── hooks/
│   ├── useNotifications.ts     # List notifications
│   ├── useNotificationPrefs.ts # Preferences
│   ├── usePushToken.ts         # Register token
│   └── useUnreadCount.ts       # Badge count
└── services/
    ├── pushNotifications.ts    # Expo push service
    └── emailNotifications.ts   # Email service

packages/notifications/         # New package
├── package.json
├── src/
│   ├── index.ts
│   ├── expo.ts                 # Expo Push API
│   ├── templates/
│   │   ├── push.ts             # Push templates
│   │   └── email.ts            # Email templates
│   └── scheduler.ts            # Scheduled notifications
```

### Backend (Edge Functions)
```
supabase/functions/
├── send-push-notification/
│   └── index.ts                # Send via Expo
├── send-email-notification/
│   └── index.ts                # Send via email service
└── process-scheduled-notifications/
    └── index.ts                # Process scheduled queue
```

### Owner App & Tenant App
```
apps/[owner|tenant]/
├── app/(app)/
│   ├── notifications/
│   │   ├── index.tsx           # Notification center
│   │   └── settings.tsx        # Preferences
│   └── _layout.tsx             # Update: badge on tab

├── components/
│   ├── NotificationList.tsx    # Notification list
│   ├── NotificationItem.tsx    # Single notification
│   ├── NotificationBell.tsx    # Bell icon with badge
│   ├── NotificationToast.tsx   # In-app toast
│   └── PreferenceToggle.tsx    # Preference switch

├── providers/
│   └── NotificationProvider.tsx # Push token + handlers

└── hooks/
    └── useNotificationSetup.ts  # Setup push notifications
```

## Push Notification Setup

```typescript
// apps/owner/providers/NotificationProvider.tsx
import * as Notifications from 'expo-notifications'
import { useEffect } from 'react'

export function NotificationProvider({ children }) {
  useEffect(() => {
    // Request permission
    Notifications.requestPermissionsAsync()

    // Get push token
    const token = await Notifications.getExpoPushTokenAsync()

    // Register with backend
    await registerPushToken(token.data)

    // Handle notification received while app is open
    Notifications.addNotificationReceivedListener(notification => {
      // Show in-app toast
    })

    // Handle notification tap
    Notifications.addNotificationResponseReceivedListener(response => {
      // Navigate to relevant screen
    })
  }, [])

  return children
}
```

## Notification Templates

### Push Notification
```typescript
{
  to: expoPushToken,
  title: "Payment Received",
  body: "John Smith paid $500 rent for 42 Oak Street",
  data: {
    type: "payment_received",
    paymentId: "uuid",
    screen: "payments/uuid"
  },
  sound: "default",
  badge: 1
}
```

### Email Notification
```html
Subject: Payment Received - 42 Oak Street

Hi {{owner_name}},

Great news! You've received a rent payment.

Amount: ${{amount}}
From: {{tenant_name}}
Property: {{property_address}}

[View Payment Details]

---
Manage notification preferences: {{preferences_link}}
```

## Agent Integration (Mission 14)

Mission 14's agent and heartbeat engine interact with this mission's notification system:

### Notification Preference Check
Agent tools that send messages (`send_rent_reminder`, `send_notification`, `twilio_send_sms`, `sendgrid_send_email`) MUST check notification preferences before sending:

```sql
-- Helper function (create in this mission's migration)
CREATE FUNCTION should_notify(
  p_user_id UUID,
  p_notification_type notification_type,
  p_channel TEXT -- 'push', 'email', 'sms'
) RETURNS BOOLEAN AS $$
  SELECT CASE p_channel
    WHEN 'push' THEN push_enabled
    WHEN 'email' THEN email_enabled
    WHEN 'sms' THEN sms_enabled
    ELSE FALSE
  END
  FROM notification_preferences
  WHERE user_id = p_user_id AND notification_type = p_notification_type;
$$ LANGUAGE sql STABLE;
```

### Heartbeat ↔ Scheduled Notifications
Before creating a proactive task, the heartbeat engine MUST check for existing scheduled notifications to prevent duplicates:
```sql
SELECT COUNT(*) FROM scheduled_notifications
WHERE user_id = $1 AND related_entity_id = $2 AND status = 'scheduled';
```

### Single Approval Principle
When an owner approves an agent action (e.g., approves breach notice in Tasks tab), that approval covers both the action AND any resulting notifications. The agent does NOT require separate notification approval.

### Quiet Hours
Agent must respect quiet hours stored in `notification_preferences`. SMS and push are suppressed during quiet hours; emails are queued for next morning.

### Phase I: Notification Dispatch Service

The notification dispatch service is the central hub for all notifications. It handles routing, deduplication, and delivery tracking.

```typescript
// supabase/functions/dispatch-notification/index.ts

interface NotificationDispatch {
  // Unified entry point for all notifications
  dispatch(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    relatedType?: string;
    relatedId?: string;
    channels?: ('push' | 'email' | 'sms')[]; // Override default channels
    priority?: 'normal' | 'high' | 'critical'; // Critical bypasses quiet hours
  }): Promise<{ notificationId: string; deliveryResults: DeliveryResult[] }>;

  // Batch dispatch (for heartbeat scanner results)
  batchDispatch(notifications: NotificationDispatch[]): Promise<void>;
}

// Delivery logic:
// 1. Check user preferences for this notification type
// 2. Check quiet hours (except for 'critical' priority)
// 3. Check deduplication (same type + source within 24h)
// 4. Send via enabled channels:
//    - Push: Expo Push API → device
//    - Email: SendGrid API → inbox
//    - SMS: Twilio API → phone (only for urgent/critical)
// 5. Log delivery status
// 6. If push fails → fallback to email
// 7. If all channels fail → queue for retry
```

### Phase J: Agent Notification Integration

The agent's heartbeat engine and tool executions trigger notifications. The full integration:

**Agent-Triggered Notifications:**
| Agent Event | Notification Type | Channels | Priority |
|-------------|------------------|----------|----------|
| Rent payment received | payment_received | push, email | normal |
| Rent overdue (Day 1) | payment_overdue | push, email | high |
| Rent overdue (Day 7+) | payment_overdue | push, email, sms | critical |
| Maintenance request created | maintenance_submitted | push | normal |
| Maintenance work scheduled | maintenance_scheduled | push, email | normal |
| New application received | application_received | push, email | normal |
| Inspection scheduled | inspection_scheduled | push, email | normal |
| Inspection due (7 days) | inspection_reminder | push | normal |
| Lease expiring (30 days) | lease_expiring_soon | push, email | high |
| Compliance due (30 days) | compliance_due_soon | push | normal |
| Compliance overdue | compliance_overdue | push, email | high |
| Agent completed autonomous action | system_announcement | push | normal |
| Agent needs owner decision | system_announcement | push | high |

**Tenant Notifications (via tenant app):**
| Event | Notification Type | Channels |
|-------|------------------|----------|
| Rent due (3 days) | payment_due | push |
| Rent overdue | payment_overdue | push, email |
| Maintenance update | maintenance_acknowledged/scheduled/completed | push |
| Inspection scheduled | inspection_scheduled | push, email |
| Message from owner | message_received | push |
| Lease renewal available | lease_expiring_soon | push, email |

**SMS Templates (Twilio):**
All SMS must comply with Australian spam regulations (Spam Act 2003):
- Include sender identification
- Include opt-out mechanism
- No SMS between 9pm-9am unless critical (emergency maintenance)

```typescript
const SMS_TEMPLATES = {
  rent_reminder: "Hi {tenant_name}, a reminder that rent of ${amount} for {address} is due on {date}. Pay easily via the Casa app. Reply STOP to opt out.",
  maintenance_scheduled: "Hi {tenant_name}, maintenance has been scheduled for {address} on {date} at {time}. {tradesperson_name} will attend. Reply STOP to opt out.",
  inspection_notice: "Hi {tenant_name}, a routine inspection of {address} has been scheduled for {date}. This is {notice_days} days notice as required. Reply STOP to opt out.",
  urgent_maintenance: "URGENT: {description} reported at {address}. An emergency tradesperson is being arranged. We'll keep you updated. Reply STOP to opt out.",
};
```

**Email Templates (SendGrid):**
- Professional HTML templates matching Casa brand
- All emails include: Casa logo, property address, action button, unsubscribe link
- Template IDs stored in environment variables
- Dynamic data injected per send

---

## Validation Commands
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Commit Message Pattern
```
feat(notifications): <description>

Mission-17: Push Notifications
```

## Notes
- Expo Push Notifications handle both iOS and Android
- Store tokens per device (user may have multiple)
- Respect quiet hours and DND settings
- Email fallback for critical notifications
- Badge count syncs across devices
- Deep linking navigates to relevant screen
- Consider SMS for critical alerts (arrears, emergencies)
- Implement notification grouping for high-volume users
- Track delivery and open rates for optimization

---

## Mission-Complete Testing Checklist

> Reference: `/specs/TESTING-METHODOLOGY.md` for full methodology.

### Build Health
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all tests pass, none skipped
- [ ] No `// TODO` or `// FIXME` in mission code
- [ ] No `console.log` debugging statements in production code

### Database Integrity
- [ ] All migrations applied to remote Supabase (`push_tokens`, `notifications`, `notification_preferences`)
- [ ] RLS policies verified: users can only manage their own push tokens
- [ ] RLS policies verified: users can only view their own notifications
- [ ] RLS policies verified: users can only manage their own preferences
- [ ] Push tokens refresh correctly on app restart
- [ ] Indexes created for user, read status, and notification type queries
- [ ] Old/expired push tokens cleaned up automatically

### Feature Verification (Mission-Specific)
- [ ] Push notification permission requested on first launch (iOS)
- [ ] Push token stored in database on permission grant
- [ ] Payment received notification delivers to owner
- [ ] Payment due/overdue notification delivers to tenant
- [ ] Maintenance request update notifications work for both parties
- [ ] New application notification delivers to owner
- [ ] New message notification delivers to recipient
- [ ] Inspection reminder notifications fire at correct intervals
- [ ] Lease expiring notifications fire at 90/60/30 days
- [ ] Notification preferences screen allows toggle by type
- [ ] Quiet hours setting prevents notifications during configured period
- [ ] Email fallback sends when push fails or user prefers email
- [ ] Notification centre lists all notifications with read/unread status
- [ ] Tapping a notification deep-links to the relevant screen
- [ ] Badge count updates on tab bar and app icon
- [ ] Toast notifications display for in-app events
- [ ] Mark all as read works correctly
- [ ] Agent-triggered notifications deliver correctly for each event type
- [ ] SMS templates comply with Australian Spam Act 2003
- [ ] Email templates include unsubscribe link and Casa branding
- [ ] Critical notifications bypass quiet hours
- [ ] Notification deduplication prevents duplicate sends within 24h
- [ ] Tenant app receives notifications for relevant events
- [ ] SMS opt-out (STOP keyword) works correctly

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
- [ ] Push notification payloads do not contain sensitive data (use IDs, not content)
- [ ] Email notifications include unsubscribe link (Australian Spam Act compliance)


---

## Gateway Implementation (Pre-Built)

> The following gateway infrastructure was created in Mission 07 to facilitate this mission:

### Files Created
- `packages/api/src/hooks/gateways/useNotificationsGateway.ts` — Hook with navigation entry points and placeholder state
- `packages/api/src/types/gateways.ts` — Type definitions for notification entities

### What's Already Done
1. **Types defined**: All TypeScript interfaces including:
   - `Notification` with type, title, body, delivery tracking
   - `NotificationPreference` for per-type push/email/sms toggles
   - `NotificationSettings` for quiet hours and digest preferences
   - `NotificationType` enum with all 22 notification types
2. **Gateway hook**: `useNotificationsGateway()` provides:
   - State: `items`, `unreadCount`, `preferences`, `settings`
   - Navigation: `navigateToNotificationCenter()`, `navigateToNotificationSettings()`
   - Actions: `markAsRead()`, `markAllAsRead()`, `deleteNotification()`, `clearAll()`
   - Token management: `registerPushToken()`, `unregisterPushToken()`
   - Preferences: `updatePreference()`, `updateSettings()`
   - Deep linking: `handleNotificationPress()` with route resolution
   - Real-time: `subscribeToNotifications()`
3. **Helper function**: `getNotificationRoute(type, relatedId)` for deep linking
4. **Exported from `@casa/api`**: Import directly in components

### What This Mission Needs to Do
1. Create database migration with notification tables
2. Set up Expo Push Notifications service
3. Implement push token registration/refresh
4. Create notification dispatch service (push + email fallback)
5. Build notification center UI
6. Implement preference management screens

### Usage Example (Already Works)
```typescript
import { useNotificationsGateway, getNotificationRoute } from '@casa/api';

function NotificationBell() {
  const { unreadCount, navigateToNotificationCenter, handleNotificationPress } = useNotificationsGateway();
}
```
