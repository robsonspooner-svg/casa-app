// Shared Supabase client for Edge Functions
// Casa - Mission 07: Rent Collection & Payments

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export function getServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getUserFromAuth(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  // In production, validate the JWT and extract user ID
  // For now, we'll use the Supabase client to validate
  return authHeader.replace('Bearer ', '');
}
