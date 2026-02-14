-- Low Severity Fixes Migration
-- Fix #5: Add pg_cron job to auto-refresh dashboard materialized views

-- Schedule refresh_analytics_views() to run every 6 hours
-- This keeps the financial_summary and property_metrics views up to date
SELECT cron.schedule(
  'refresh-analytics-views',
  '0 */6 * * *',
  $$SELECT refresh_analytics_views()$$
);
