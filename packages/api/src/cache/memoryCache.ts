// Simple in-memory cache for Supabase queries
// Works without React Query — standalone cache with TTL support
// Mission 19: Performance Optimization

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleTime: number;
}

const cache = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.staleTime) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(key: string, data: T, staleTimeMs: number = 5 * 60 * 1000): void {
  cache.set(key, { data, timestamp: Date.now(), staleTime: staleTimeMs });
}

export function invalidateCache(keyPattern?: string): void {
  if (!keyPattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(keyPattern)) {
      cache.delete(key);
    }
  }
}

// Stale times per query type (milliseconds)
export const MEMORY_CACHE_CONFIG = {
  properties: 10 * 60 * 1000,       // 10 min
  payments: 1 * 60 * 1000,          // 1 min
  notifications: 30 * 1000,          // 30 sec
  analytics: 30 * 60 * 1000,        // 30 min
  autonomy: 30 * 60 * 1000,         // 30 min
  agentConversations: 30 * 1000,     // 30 sec
  agentTasks: 10 * 1000,            // 10 sec
};
