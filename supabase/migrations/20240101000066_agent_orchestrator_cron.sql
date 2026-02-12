-- =====================================================
-- AGENT ORCHESTRATOR CRON SCHEDULES
-- Tiered scheduling for the intelligent agent orchestrator:
--   - Instant: Every 2 minutes (processes event queue)
--   - Daily: 6am AEST (20:00 UTC prev day) — property reviews with Haiku
--   - Weekly: Monday 7am AEST (21:00 UTC Sunday) — deep analysis with Sonnet
--   - Monthly: 1st of month 8am AEST (22:00 UTC prev day) — portfolio review
--
-- Also wires the send-arrears-reminder and send-breach-notice
-- scheduled functions which were previously called manually.
-- =====================================================


-- =====================================================
-- 1. INSTANT EVENT PROCESSOR
-- Polls agent_event_queue every 2 minutes for events
-- created by DB triggers (payments, maintenance, etc.)
-- Uses 'instant' mode to process only queue events.
-- =====================================================
SELECT cron.schedule(
  'agent-orchestrator-instant',
  '*/2 * * * *',
  $$SELECT public.invoke_edge_function('agent-orchestrator', '{"mode": "instant"}'::jsonb)$$
);


-- =====================================================
-- 2. DAILY PROPERTY REVIEW
-- Runs at 6am AEST (20:00 UTC previous day)
-- Reviews all properties with Haiku model for routine
-- checks: arrears, maintenance, compliance, lease expiry.
-- =====================================================
SELECT cron.schedule(
  'agent-orchestrator-daily',
  '0 20 * * *',
  $$SELECT public.invoke_edge_function('agent-orchestrator', '{"mode": "daily"}'::jsonb)$$
);


-- =====================================================
-- 3. WEEKLY DEEP ANALYSIS
-- Runs Monday at 7am AEST (21:00 UTC Sunday)
-- Deep analysis with Sonnet: market intelligence,
-- tenant retention scoring, property health updates,
-- weekly summary notification to owners.
-- =====================================================
SELECT cron.schedule(
  'agent-orchestrator-weekly',
  '0 21 * * 0',
  $$SELECT public.invoke_edge_function('agent-orchestrator', '{"mode": "weekly"}'::jsonb)$$
);


-- =====================================================
-- 4. MONTHLY PORTFOLIO REVIEW
-- Runs 1st of month at 8am AEST (22:00 UTC prev day)
-- Full portfolio review with Sonnet: financials,
-- compliance horizon, property health scores,
-- monthly digest notification.
-- =====================================================
SELECT cron.schedule(
  'agent-orchestrator-monthly',
  '0 22 1 * *',
  $$SELECT public.invoke_edge_function('agent-orchestrator', '{"mode": "monthly"}'::jsonb)$$
);


-- =====================================================
-- 5. ARREARS REMINDERS (daily, scheduled mode)
-- Runs daily at 10am AEST (00:00 UTC) to send
-- automated arrears reminders based on days_overdue.
-- =====================================================
SELECT cron.schedule(
  'send-arrears-reminders-daily',
  '0 0 * * *',
  $$SELECT public.invoke_edge_function('send-arrears-reminder', '{"scheduled": true}'::jsonb)$$
);


-- =====================================================
-- 6. SCHEDULED REPORTS PROCESSOR
-- Runs daily at 5am AEST (19:00 UTC prev day) to
-- check for scheduled reports due to run.
-- =====================================================
SELECT cron.schedule(
  'process-scheduled-reports-daily',
  '0 19 * * *',
  $$SELECT public.invoke_edge_function('process-scheduled-reports')$$
);


-- =====================================================
-- 7. DECOMMISSION OLD HEARTBEAT
-- The agent-orchestrator replaces the procedural
-- agent-heartbeat. Remove the old 15-min schedule.
-- We keep the heartbeat Edge Function deployed as
-- fallback but stop calling it via cron.
-- =====================================================
SELECT cron.unschedule('agent-heartbeat-15min');
