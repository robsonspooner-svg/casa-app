-- Add metadata JSONB column to maintenance_comments for storing structured
-- data like email audit trails (to, cc, bcc, subject, html_content, etc.)
ALTER TABLE maintenance_comments ADD COLUMN IF NOT EXISTS metadata JSONB;
