-- =====================================================
-- ADDITIONAL CRON SCHEDULES
-- Adds cron jobs for Edge Functions not yet scheduled.
--
-- Extensions pg_cron and pg_net were enabled in
-- migration 000038_pg_cron_heartbeat.sql.
-- The invoke_edge_function() helper was also created
-- there — it reads the service role key from
-- private.cron_config and calls net.http_post.
--
-- Already scheduled (do NOT duplicate):
--   - process-arrears-daily          (000038)
--   - process-autopay-daily          (000038)
--   - process-email-queue-5min       (000038)
--   - agent-orchestrator-instant     (000066)
--   - agent-orchestrator-daily       (000066)
--   - agent-orchestrator-weekly      (000066)
--   - agent-orchestrator-monthly     (000066)
--   - send-arrears-reminders-daily   (000066)
--   - process-scheduled-reports-daily(000066)
--   - send-compliance-reminders-daily(000048)
--   - refresh-analytics-views        (000072)
-- =====================================================


-- =====================================================
-- 1. SEND RENT REMINDERS
-- Daily at 6am AEST (20:00 UTC previous day).
-- Sends upcoming rent due reminders to tenants
-- before their payment is due.
-- =====================================================
SELECT cron.schedule(
  'send-rent-reminders-daily',
  '0 20 * * *',
  $$SELECT public.invoke_edge_function('send-rent-reminders', '{"source": "cron"}'::jsonb)$$
);
