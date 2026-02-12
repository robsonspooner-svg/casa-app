-- Populate the cron_config with the service role key so pg_cron jobs can authenticate.
-- This is a one-time seed that enables the heartbeat and other scheduled functions.
INSERT INTO private.cron_config (key, value)
VALUES (
  'service_role_key',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndveGx2aHpnYW5uemhhanRqbmtlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTA4NjA1NywiZXhwIjoyMDg0NjYyMDU3fQ.ZxWmgLToiq3EMMYSJ9FL5LDqP2as6FyIKOaxvt-Dv2E'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
