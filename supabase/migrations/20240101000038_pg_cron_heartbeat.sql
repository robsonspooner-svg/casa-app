-- =====================================================
-- PG_CRON HEARTBEAT SCHEDULE
-- Automatically runs the agent-heartbeat edge function
-- every 15 minutes. This is the backbone of Casa's
-- proactive AI system — it must run autonomously.
-- =====================================================

-- Enable pg_net for HTTP calls from within PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Enable pg_cron for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Grant usage so cron can schedule in our schema
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Ensure the private schema exists
CREATE SCHEMA IF NOT EXISTS private;

-- Config table for system secrets (service role key for cron jobs).
-- This table is only accessible to the postgres role (no RLS needed
-- since it's not exposed via the API).
CREATE TABLE IF NOT EXISTS private.cron_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Revoke all access from anon and authenticated roles
REVOKE ALL ON private.cron_config FROM anon, authenticated;

-- Create a helper function that pg_cron can call.
-- This reads the service role key from private.cron_config and
-- fires an HTTP POST to the agent-heartbeat edge function.
CREATE OR REPLACE FUNCTION public.invoke_agent_heartbeat()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _service_key text;
BEGIN
  SELECT value INTO _service_key
  FROM private.cron_config
  WHERE key = 'service_role_key'
  LIMIT 1;

  IF _service_key IS NULL THEN
    RAISE WARNING 'agent-heartbeat: service_role_key not configured in private.cron_config — skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://woxlvhzgannzhajtjnke.supabase.co/functions/v1/agent-heartbeat',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := '{"source": "pg_cron"}'::jsonb
  );
END;
$$;

-- Helper to invoke any edge function with auth
CREATE OR REPLACE FUNCTION public.invoke_edge_function(function_name text, payload jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _service_key text;
  _url text;
BEGIN
  SELECT value INTO _service_key
  FROM private.cron_config
  WHERE key = 'service_role_key'
  LIMIT 1;

  IF _service_key IS NULL THEN
    RAISE WARNING 'invoke_edge_function: service_role_key not configured — skipping %', function_name;
    RETURN;
  END IF;

  _url := 'https://woxlvhzgannzhajtjnke.supabase.co/functions/v1/' || function_name;

  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := payload
  );
END;
$$;

-- Schedule: agent-heartbeat every 15 minutes
SELECT cron.schedule(
  'agent-heartbeat-15min',
  '*/15 * * * *',
  'SELECT public.invoke_agent_heartbeat()'
);

-- Schedule: process-arrears daily at 9am AEST (23:00 UTC previous day)
SELECT cron.schedule(
  'process-arrears-daily',
  '0 23 * * *',
  $$SELECT public.invoke_edge_function('process-arrears')$$
);

-- Schedule: process-autopay daily at 8am AEST (22:00 UTC previous day)
SELECT cron.schedule(
  'process-autopay-daily',
  '0 22 * * *',
  $$SELECT public.invoke_edge_function('process-autopay')$$
);

-- Schedule: process-email-queue every 5 minutes
SELECT cron.schedule(
  'process-email-queue-5min',
  '*/5 * * * *',
  $$SELECT public.invoke_edge_function('process-email-queue')$$
);
