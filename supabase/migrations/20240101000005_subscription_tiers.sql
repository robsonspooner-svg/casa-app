-- Migration: Add subscription tier support to profiles
-- Mission 02 Phase F: Subscription Tier & Feature Gating

-- Subscription tier enum
CREATE TYPE subscription_tier AS ENUM ('starter', 'pro', 'hands_off');

-- Subscription status enum
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled');

-- Add subscription fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS subscription_status subscription_status DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Index for Stripe customer lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Index for subscription status queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON profiles(subscription_tier, subscription_status);

-- Update handle_new_user to set default subscription tier for owners
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, subscription_tier, subscription_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'owner'),
    CASE
      WHEN COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'owner') = 'owner' THEN 'starter'::subscription_tier
      ELSE NULL
    END,
    CASE
      WHEN COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'owner') = 'owner' THEN 'active'::subscription_status
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
