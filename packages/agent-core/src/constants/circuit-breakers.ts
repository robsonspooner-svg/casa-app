import type { CircuitBreakerConfig } from '../types/resilience';

/**
 * Circuit breaker configurations per external service.
 * Prevents cascading failures by opening the circuit after repeated failures.
 *
 * States:
 * - Closed: Normal operation, requests pass through
 * - Open: All requests fail-fast without calling the service
 * - Half-Open: Limited requests pass through to test recovery
 */

export const CIRCUIT_BREAKER_CONFIGS: Record<string, CircuitBreakerConfig> = {
  /** Stripe — Payment processing. Conservative thresholds. */
  stripe: {
    failureThreshold: 3,
    failureWindowMs: 60_000,
    halfOpenAfterMs: 30_000,
    halfOpenMaxAttempts: 1,
  },

  /** Twilio — SMS notifications. More tolerant. */
  twilio: {
    failureThreshold: 5,
    failureWindowMs: 60_000,
    halfOpenAfterMs: 30_000,
    halfOpenMaxAttempts: 2,
  },

  /** SendGrid — Email notifications. More tolerant. */
  sendgrid: {
    failureThreshold: 5,
    failureWindowMs: 60_000,
    halfOpenAfterMs: 30_000,
    halfOpenMaxAttempts: 2,
  },

  /** Equifax — Credit checks. Slow service, conservative. */
  equifax: {
    failureThreshold: 3,
    failureWindowMs: 120_000,
    halfOpenAfterMs: 60_000,
    halfOpenMaxAttempts: 1,
  },

  /** TICA — Tenancy database. Slow service, conservative. */
  tica: {
    failureThreshold: 3,
    failureWindowMs: 120_000,
    halfOpenAfterMs: 60_000,
    halfOpenMaxAttempts: 1,
  },

  /** DocuSign — Document signing. Moderate tolerance. */
  docusign: {
    failureThreshold: 3,
    failureWindowMs: 120_000,
    halfOpenAfterMs: 60_000,
    halfOpenMaxAttempts: 1,
  },

  /** Domain.com.au — Listing syndication. High tolerance, slow recovery. */
  domain: {
    failureThreshold: 5,
    failureWindowMs: 300_000,
    halfOpenAfterMs: 120_000,
    halfOpenMaxAttempts: 1,
  },

  /** realestate.com.au — Listing syndication. High tolerance, slow recovery. */
  rea: {
    failureThreshold: 5,
    failureWindowMs: 300_000,
    halfOpenAfterMs: 120_000,
    halfOpenMaxAttempts: 1,
  },

  /** Hipages — Trade search. High tolerance, slow recovery. */
  hipages: {
    failureThreshold: 5,
    failureWindowMs: 300_000,
    halfOpenAfterMs: 120_000,
    halfOpenMaxAttempts: 1,
  },

  /** State bond authorities (NSW/VIC/QLD) — Government API. Very conservative. */
  bond_state: {
    failureThreshold: 3,
    failureWindowMs: 300_000,
    halfOpenAfterMs: 300_000,
    halfOpenMaxAttempts: 1,
  },

  /** Claude API — Agent brain. Critical service, fast recovery. */
  claude_api: {
    failureThreshold: 3,
    failureWindowMs: 60_000,
    halfOpenAfterMs: 30_000,
    halfOpenMaxAttempts: 1,
  },

  /** Supabase — Core database. Very tolerant, fast recovery. */
  supabase: {
    failureThreshold: 5,
    failureWindowMs: 30_000,
    halfOpenAfterMs: 10_000,
    halfOpenMaxAttempts: 3,
  },

  /** Expo Push — Push notifications. Very tolerant, fast recovery. */
  expo_push: {
    failureThreshold: 10,
    failureWindowMs: 60_000,
    halfOpenAfterMs: 15_000,
    halfOpenMaxAttempts: 3,
  },
};

/**
 * Notification fallback chain.
 * Every notification follows this cascade until one succeeds.
 * For critical notifications, ALL channels fire simultaneously.
 */
export const NOTIFICATION_FALLBACK_CHAIN = [
  { channel: 'push', tool: 'send_push_expo', timeoutMs: 8_000 },
  { channel: 'sms', tool: 'send_sms_twilio', timeoutMs: 10_000 },
  { channel: 'email', tool: 'send_email_sendgrid', timeoutMs: 15_000 },
  { channel: 'in_app', tool: null, timeoutMs: 0 }, // DB write, always succeeds
] as const;

/**
 * Payment retry strategy constants.
 */
export const PAYMENT_RETRY_STRATEGY = {
  /** Maximum auto-retries before escalating to arrears */
  maxAutoRetries: 1,
  /** Delay before first retry (ms) — 2 business days */
  cardRetryDelayMs: 172_800_000,
  /** BECS retry delay (ms) — 5 days */
  becsRetryDelayMs: 432_000_000,
  /** BECS pre-notification required (ms) — 3 days */
  becsPreNotificationMs: 259_200_000,
} as const;
