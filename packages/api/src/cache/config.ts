// Cache configuration for React Query / manual caching
// Defines stale times and cache times for different data types

export const CACHE_CONFIG = {
  // Near-static data (rarely changes)
  tenancyLaw: { staleTime: 24 * 60 * 60 * 1000, cacheTime: 48 * 60 * 60 * 1000 },
  subscriptionTiers: { staleTime: 24 * 60 * 60 * 1000, cacheTime: 48 * 60 * 60 * 1000 },

  // Semi-static (changes occasionally)
  profile: { staleTime: 5 * 60 * 1000, cacheTime: 30 * 60 * 1000 },
  properties: { staleTime: 2 * 60 * 1000, cacheTime: 15 * 60 * 1000 },
  tenancies: { staleTime: 2 * 60 * 1000, cacheTime: 15 * 60 * 1000 },
  documents: { staleTime: 5 * 60 * 1000, cacheTime: 30 * 60 * 1000 },

  // Dynamic data (changes frequently)
  tasks: { staleTime: 30 * 1000, cacheTime: 5 * 60 * 1000 },
  notifications: { staleTime: 15 * 1000, cacheTime: 5 * 60 * 1000 },
  conversations: { staleTime: 10 * 1000, cacheTime: 5 * 60 * 1000 },
  payments: { staleTime: 60 * 1000, cacheTime: 10 * 60 * 1000 },
  maintenance: { staleTime: 30 * 1000, cacheTime: 5 * 60 * 1000 },

  // Realtime data (handled by subscriptions, very short cache)
  chatMessages: { staleTime: 5 * 1000, cacheTime: 2 * 60 * 1000 },
  unreadCount: { staleTime: 5 * 1000, cacheTime: 60 * 1000 },
} as const;

export type CacheKey = keyof typeof CACHE_CONFIG;
