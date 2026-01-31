-- =============================================================================
-- Mission 10 Fixes: Empty string validation + FK cascade safety
-- Found during E2E functional testing
-- =============================================================================

-- =============================================================================
-- FIX 1: Prevent empty strings on required text fields
-- PostgreSQL NOT NULL allows '', which is functionally invalid
-- =============================================================================

ALTER TABLE trades
  ADD CONSTRAINT trades_business_name_not_empty CHECK (trim(business_name) <> ''),
  ADD CONSTRAINT trades_contact_name_not_empty CHECK (trim(contact_name) <> ''),
  ADD CONSTRAINT trades_email_not_empty CHECK (trim(email) <> ''),
  ADD CONSTRAINT trades_phone_not_empty CHECK (trim(phone) <> '');

ALTER TABLE work_orders
  ADD CONSTRAINT work_orders_title_not_empty CHECK (trim(title) <> ''),
  ADD CONSTRAINT work_orders_description_not_empty CHECK (trim(description) <> '');

-- =============================================================================
-- FIX 2: Change trade FK cascades from CASCADE to RESTRICT
-- Prevents accidental deletion of a trade wiping all work order history & reviews
-- Trade deletion should be blocked if work orders or reviews reference it
-- =============================================================================

-- work_orders.trade_id: CASCADE → RESTRICT
ALTER TABLE work_orders DROP CONSTRAINT work_orders_trade_id_fkey;
ALTER TABLE work_orders
  ADD CONSTRAINT work_orders_trade_id_fkey
  FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE RESTRICT;

-- trade_reviews.trade_id: CASCADE → RESTRICT
ALTER TABLE trade_reviews DROP CONSTRAINT trade_reviews_trade_id_fkey;
ALTER TABLE trade_reviews
  ADD CONSTRAINT trade_reviews_trade_id_fkey
  FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE RESTRICT;

-- trade_portfolio.trade_id: CASCADE → RESTRICT
ALTER TABLE trade_portfolio DROP CONSTRAINT trade_portfolio_trade_id_fkey;
ALTER TABLE trade_portfolio
  ADD CONSTRAINT trade_portfolio_trade_id_fkey
  FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE RESTRICT;

-- owner_trades.trade_id stays CASCADE — removing from network is non-destructive
-- owner_trades.owner_id stays CASCADE — if user is deleted, their network links go too
-- work_orders.maintenance_request_id stays SET NULL — unlinking is fine
-- work_orders.property_id stays CASCADE — if property deleted, WOs for it go too
-- trade_reviews.work_order_id stays CASCADE — if WO deleted, its review goes too
