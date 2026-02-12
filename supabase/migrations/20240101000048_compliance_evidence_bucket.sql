-- Migration: Create compliance-evidence storage bucket and policies
-- For storing compliance evidence photos (smoke alarm checks, safety inspections, etc.)

-- Create compliance-evidence bucket (public - evidence images viewable by anyone with URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance-evidence', 'compliance-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view compliance evidence images (public bucket)
CREATE POLICY "Compliance evidence images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'compliance-evidence');

-- Owners can upload compliance evidence images (folder = user id)
CREATE POLICY "Owners can upload compliance evidence"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'compliance-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Owners can update their compliance evidence images
CREATE POLICY "Owners can update compliance evidence"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'compliance-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Owners can delete their compliance evidence images
CREATE POLICY "Owners can delete compliance evidence"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'compliance-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add send-compliance-reminders to pg_cron schedule (daily at 7am AEST = 20:00 UTC prev day)
-- Uses the existing invoke_edge_function helper from migration 038
SELECT cron.schedule(
  'send-compliance-reminders-daily',
  '0 20 * * *',
  $$SELECT public.invoke_edge_function('send-compliance-reminders')$$
);
