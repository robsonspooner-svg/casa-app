// Cursor-based pagination utility for Supabase queries
// Mission 19: Performance Optimization

export interface PaginationParams {
  cursor?: string;
  limit?: number;
  direction?: 'forward' | 'backward';
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  prevCursor?: string;
  hasMore: boolean;
  totalCount?: number;
}

export function encodeCursor(item: { id: string; created_at: string }): string {
  return btoa(JSON.stringify({ id: item.id, created_at: item.created_at }));
}

export function decodeCursor(cursor: string): { id: string; created_at: string } {
  return JSON.parse(atob(cursor));
}

export async function paginatedQuery<T extends { id: string; created_at: string }>(
  queryBuilder: any,
  params: PaginationParams
): Promise<PaginatedResult<T>> {
  const { cursor, limit = 20, direction = 'forward' } = params;

  let query = queryBuilder.limit(limit + 1);

  if (cursor) {
    const decoded = decodeCursor(cursor);
    query = direction === 'forward'
      ? query.lt('created_at', decoded.created_at)
      : query.gt('created_at', decoded.created_at);
  }

  query = query.order('created_at', { ascending: direction === 'backward' });

  const { data, error } = await query;
  if (error) throw error;

  const items = data || [];
  const hasMore = items.length > limit;
  const result = hasMore ? items.slice(0, limit) : items;

  return {
    data: result as T[],
    nextCursor: hasMore ? encodeCursor(result[result.length - 1]) : undefined,
    hasMore,
  };
}
