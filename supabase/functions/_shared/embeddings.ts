// Semantic Embedding Utilities for Casa Agent
// Uses Supabase built-in gte-small model (free, 384-dim, runs natively in Edge Functions)
// No external API keys required

// Declare Supabase AI types for Deno Edge Runtime
declare const Supabase: {
  ai: {
    Session: new (model: string) => {
      run: (input: string | string[], options?: { mean_pool?: boolean; normalize?: boolean }) => Promise<number[] | number[][]>;
    };
  };
};

// Lazy-initialized session (shared across requests within a single invocation)
let _session: ReturnType<typeof Supabase.ai.Session> | null = null;

function getSession() {
  if (!_session) {
    _session = new Supabase.ai.Session('gte-small');
  }
  return _session;
}

/**
 * Truncate text to approximately 512 tokens (gte-small max).
 * Rough heuristic: ~4 chars per token, so ~2048 chars.
 */
function truncateForEmbedding(text: string): string {
  const MAX_CHARS = 2000;
  if (text.length <= MAX_CHARS) return text;
  return text.slice(0, MAX_CHARS);
}

/**
 * Generate a 384-dimensional embedding for a single text string.
 * Uses Supabase built-in gte-small model (free, no API key needed).
 *
 * @param text - The text to embed (will be truncated to ~512 tokens)
 * @returns 384-dimensional number array
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    // Return zero vector for empty text
    return new Array(384).fill(0);
  }

  const session = getSession();
  const truncated = truncateForEmbedding(text.trim());

  const result = await session.run(truncated, {
    mean_pool: true,
    normalize: true,
  });

  // session.run returns number[] for single string input
  return result as number[];
}

/**
 * Generate embeddings for multiple texts in batch.
 *
 * @param texts - Array of texts to embed
 * @returns Array of 384-dimensional number arrays
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Process sequentially to avoid overwhelming the runtime
  const results: number[][] = [];
  for (const text of texts) {
    const embedding = await generateEmbedding(text);
    results.push(embedding);
  }
  return results;
}

/**
 * Compute cosine similarity between two embedding vectors.
 * Both vectors should be normalized (which gte-small produces by default).
 * For normalized vectors, cosine similarity = dot product.
 *
 * @returns Similarity score between -1 and 1 (higher = more similar)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }
  return dotProduct;
}

/**
 * Build embedding text for an agent decision.
 * Combines key fields into a searchable text representation.
 */
export function buildDecisionEmbeddingText(
  toolName: string,
  reasoning: string | null,
  inputData: Record<string, unknown> | null,
): string {
  const parts: string[] = [];
  if (toolName) parts.push(`tool: ${toolName}`);
  if (reasoning) parts.push(reasoning);
  if (inputData) {
    const inputStr = JSON.stringify(inputData).slice(0, 300);
    parts.push(`input: ${inputStr}`);
  }
  return parts.join(' | ');
}

/**
 * Build embedding text for a user preference.
 */
export function buildPreferenceEmbeddingText(
  category: string,
  key: string,
  value: unknown,
): string {
  const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
  return `${category}: ${key} = ${valueStr}`.slice(0, 500);
}

/**
 * Format an embedding array for Supabase pgvector storage.
 * pgvector expects a string like '[0.1, 0.2, ...]'
 */
export function formatEmbeddingForStorage(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
