// Casa Shared Configuration
// Design System: BRAND-AND-UI.md - Premium Property Management

export const APP_CONFIG = {
  name: 'Casa',
  version: '0.1.0',
  company: 'Casa Property Management Pty Ltd',
} as const;

// Supabase config - values injected at runtime by the apps
export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

export const SUPABASE_CONFIG: SupabaseConfig = {
  url: '',
  anonKey: '',
};

/**
 * Casa Design System Theme
 * Based on BRAND-AND-UI.md specification
 *
 * Key principles:
 * - Casa Navy (#1B1464) as primary brand color
 * - Canvas background is #FAFAFA, not white
 * - Cards are white (#FFFFFF) floating above canvas
 * - 4px base spacing unit
 * - 95% neutrals, 5% semantic color
 */
export const THEME = {
  colors: {
    // Backgrounds
    canvas: '#FAFAFA',      // Primary background - NOT white
    surface: '#FFFFFF',     // Cards, elevated elements
    subtle: '#FAF8F5',      // Warm cream tint for alternate sections

    // Text
    textPrimary: '#0A0A0A',   // Headlines, primary text
    textSecondary: '#525252', // Body text, descriptions
    textTertiary: '#A3A3A3',  // Placeholders, hints
    textInverse: '#FAFAFA',   // Text on dark backgrounds

    // Brand
    brand: '#1B1464',         // Casa Navy - primary brand color
    brandLight: '#2D2080',    // Navy hover states, gradients
    brandIndigo: '#4338CA',   // Accent gradients, highlights
    brandIndigoLight: '#6366F1', // Secondary accents

    // Semantic
    success: '#16A34A',
    successBg: '#F0FDF4',
    warning: '#CA8A04',
    warningBg: '#FEFCE8',
    error: '#DC2626',
    errorBg: '#FEF2F2',
    info: '#2563EB',
    infoBg: '#EFF6FF',

    // UI
    border: '#E5E5E5',
    borderFocus: '#1B1464',
  },

  spacing: {
    xs: 4,      // Tight spacing (icon gaps)
    sm: 8,      // Default component padding
    md: 12,     // Between related elements
    base: 16,   // Standard spacing
    lg: 24,     // Between sections
    xl: 32,     // Major section breaks
    '2xl': 48,  // Screen padding top/bottom
    '3xl': 64,  // Hero spacing
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },

  fontSize: {
    caption: 11,    // Labels, timestamps
    bodySmall: 13,  // Secondary content
    body: 15,       // Primary content
    h3: 17,         // Card titles
    h2: 20,         // Section headers
    h1: 24,         // Screen titles
    display: 32,    // Hero numbers, key metrics
  },

  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },

  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
  },

  // Component-specific tokens
  components: {
    button: {
      height: 48,         // Touch-friendly
      borderRadius: 12,
      paddingHorizontal: 24,
    },
    card: {
      borderRadius: 16,
      padding: 16,
    },
    input: {
      height: 48,
      borderRadius: 12,
      borderWidth: 1.5,
    },
    tabBar: {
      height: 83,         // Includes safe area
      iconSize: 24,
      labelSize: 11,
    },
    fab: {
      size: 56,
      borderRadius: 16,
      iconSize: 24,
    },
  },

  // Animation tokens
  animation: {
    fast: 100,
    normal: 200,
    slow: 300,
  },
} as const;

export type Theme = typeof THEME;

// Subscription Tier Types
export type SubscriptionTier = 'starter' | 'pro' | 'hands_off';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';

export const TIER_PRICES = {
  starter: 49,
  pro: 89,
  hands_off: 149,
} as const;

export const TIER_FEATURES = {
  starter: {
    maxProperties: 3,
    aiChat: true,
    rentCollection: true,
    maintenanceRequests: true,
    basicReporting: true,
    tenantFinding: false,
    professionalInspections: false,
    leaseManagement: 'basic' as const,
    communications: 'basic' as const,
    arrears: 'reminders' as const,
  },
  pro: {
    maxProperties: 10,
    aiChat: true,
    rentCollection: true,
    maintenanceRequests: true,
    basicReporting: true,
    tenantFinding: true,
    professionalInspections: false,
    leaseManagement: 'full' as const,
    communications: 'full' as const,
    arrears: 'full' as const,
  },
  hands_off: {
    maxProperties: Infinity,
    aiChat: true,
    rentCollection: true,
    maintenanceRequests: true,
    basicReporting: true,
    tenantFinding: true,
    professionalInspections: true,
    leaseManagement: 'full' as const,
    communications: 'full' as const,
    arrears: 'full' as const,
  },
} as const;
