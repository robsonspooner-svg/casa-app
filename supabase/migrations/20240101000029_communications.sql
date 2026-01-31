-- Mission 12: In-App Communications
-- Secure messaging between owners and tenants

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE conversation_type AS ENUM (
  'direct',
  'maintenance',
  'payment',
  'lease',
  'system'
);

CREATE TYPE message_status AS ENUM (
  'sending',
  'sent',
  'delivered',
  'read',
  'failed'
);

-- ============================================================
-- TABLES
-- ============================================================

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  tenancy_id UUID REFERENCES tenancies(id) ON DELETE SET NULL,
  conversation_type conversation_type NOT NULL DEFAULT 'direct',
  linked_record_id UUID,
  linked_record_type TEXT CHECK (linked_record_type IS NULL OR linked_record_type IN ('maintenance_request', 'payment', 'inspection', 'application', 'lease')),
  title TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversation participants
CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  muted_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  left_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'document', 'system')),
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  status message_status NOT NULL DEFAULT 'sent',
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  original_content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Message attachments
CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Message read receipts
CREATE TABLE message_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Message reactions
CREATE TABLE message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (char_length(reaction) <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, reaction)
);

-- Message templates
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) <= 200),
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  category TEXT CHECK (category IS NULL OR category IN ('greeting', 'maintenance', 'payment', 'inspection', 'pm_transition', 'general')),
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_conversations_property ON conversations(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_conversations_tenancy ON conversations(tenancy_id) WHERE tenancy_id IS NOT NULL;
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC NULLS LAST);
CREATE INDEX idx_conversations_linked ON conversations(linked_record_id, linked_record_type) WHERE linked_record_id IS NOT NULL;

CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id) WHERE is_active;
CREATE INDEX idx_conversation_participants_conversation ON conversation_participants(conversation_id) WHERE is_active;

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_reply ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

CREATE INDEX idx_message_attachments_message ON message_attachments(message_id);
CREATE INDEX idx_message_read_receipts_message ON message_read_receipts(message_id);
CREATE INDEX idx_message_reactions_message ON message_reactions(message_id);

CREATE INDEX idx_message_templates_owner ON message_templates(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX idx_message_templates_category ON message_templates(category) WHERE category IS NOT NULL;

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is active participant in conversation (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION is_conversation_participant(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
      AND user_id = p_user_id
      AND is_active
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Conversations: view only if participant
CREATE POLICY "conversations_select_participant"
  ON conversations FOR SELECT
  USING (is_conversation_participant(id, auth.uid()));

-- Conversations: authenticated users can create
CREATE POLICY "conversations_insert_authenticated"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Conversations: participants can update (e.g. title)
CREATE POLICY "conversations_update_participant"
  ON conversations FOR UPDATE
  USING (is_conversation_participant(id, auth.uid()));

-- Participants: view if in same conversation
CREATE POLICY "participants_select_same_conversation"
  ON conversation_participants FOR SELECT
  USING (is_conversation_participant(conversation_id, auth.uid()));

-- Participants: insert own record
CREATE POLICY "participants_insert_own"
  ON conversation_participants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Participants: update own record
CREATE POLICY "participants_update_own"
  ON conversation_participants FOR UPDATE
  USING (user_id = auth.uid());

-- Messages: view if participant
CREATE POLICY "messages_select_participant"
  ON messages FOR SELECT
  USING (is_conversation_participant(conversation_id, auth.uid()));

-- Messages: send if participant
CREATE POLICY "messages_insert_participant"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND is_conversation_participant(conversation_id, auth.uid())
  );

-- Messages: edit own messages
CREATE POLICY "messages_update_own"
  ON messages FOR UPDATE
  USING (sender_id = auth.uid());

-- Attachments: view if message participant
CREATE POLICY "attachments_select_participant"
  ON message_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = message_attachments.message_id
        AND is_conversation_participant(m.conversation_id, auth.uid())
    )
  );

-- Attachments: insert if message sender
CREATE POLICY "attachments_insert_sender"
  ON message_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = message_attachments.message_id
        AND m.sender_id = auth.uid()
    )
  );

-- Read receipts: view if participant
CREATE POLICY "read_receipts_select_participant"
  ON message_read_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = message_read_receipts.message_id
        AND is_conversation_participant(m.conversation_id, auth.uid())
    )
  );

-- Read receipts: insert own
CREATE POLICY "read_receipts_insert_own"
  ON message_read_receipts FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Reactions: view if participant
CREATE POLICY "reactions_select_participant"
  ON message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = message_reactions.message_id
        AND is_conversation_participant(m.conversation_id, auth.uid())
    )
  );

-- Reactions: insert own
CREATE POLICY "reactions_insert_own"
  ON message_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Reactions: delete own
CREATE POLICY "reactions_delete_own"
  ON message_reactions FOR DELETE
  USING (user_id = auth.uid());

-- Templates: view system defaults + own
CREATE POLICY "templates_select_accessible"
  ON message_templates FOR SELECT
  USING (owner_id IS NULL OR owner_id = auth.uid());

-- Templates: insert own
CREATE POLICY "templates_insert_own"
  ON message_templates FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Templates: update own
CREATE POLICY "templates_update_own"
  ON message_templates FOR UPDATE
  USING (owner_id = auth.uid());

-- Templates: delete own
CREATE POLICY "templates_delete_own"
  ON message_templates FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Updated_at trigger for conversations
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function: update conversation on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Update conversation last message info
  UPDATE conversations SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  -- Increment unread count for other active participants
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

-- Function: mark conversation as read (RPC)
CREATE OR REPLACE FUNCTION mark_conversation_read(p_conversation_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Reset unread count
  UPDATE conversation_participants SET
    unread_count = 0,
    last_read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND user_id = auth.uid();

  -- Create read receipts for unread messages
  INSERT INTO message_read_receipts (message_id, user_id, read_at)
  SELECT m.id, auth.uid(), NOW()
  FROM messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id != auth.uid()
    AND m.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM message_read_receipts rr
      WHERE rr.message_id = m.id AND rr.user_id = auth.uid()
    )
  ON CONFLICT (message_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  FALSE,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for message attachments
CREATE POLICY "message_attachments_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "message_attachments_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'message-attachments'
    AND auth.uid() IS NOT NULL
  );

-- ============================================================
-- DEFAULT MESSAGE TEMPLATES
-- ============================================================

INSERT INTO message_templates (name, content, category) VALUES
  ('Maintenance Acknowledged', 'Thank you for reporting this issue. I''ve received your maintenance request and will look into it shortly.', 'maintenance'),
  ('Payment Received', 'Thank you for your rent payment. It has been received and recorded.', 'payment'),
  ('Inspection Scheduled', 'I''d like to schedule a routine inspection of the property. Please let me know if the proposed date works for you.', 'inspection'),
  ('Welcome', 'Welcome to your new home! Please don''t hesitate to reach out if you have any questions.', 'greeting'),
  ('PM Transition Welcome', 'Hi {{tenant_name}}, I''m taking over management of your property at {{property_address}}. Going forward, you''ll be able to reach me directly through this app for any questions, maintenance requests, or rent queries. Nothing changes with your lease — just a simpler way to communicate. Feel free to say hi!', 'pm_transition'),
  ('PM Transition Rent Setup', 'Quick update: rent payments will now be processed through the Casa app. You''ll receive a secure link to set up your payment method. Your rent amount (${{rent_amount}}/week) and due date remain the same.', 'pm_transition'),
  ('PM Transition Maintenance', 'Just a heads up — if you need any maintenance or repairs, you can now submit requests directly through the app with photos. It''s the fastest way to get things sorted. Tap the Maintenance tab to get started.', 'pm_transition');

-- ============================================================
-- ENABLE REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
