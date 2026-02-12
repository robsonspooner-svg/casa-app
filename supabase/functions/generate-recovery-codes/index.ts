// Generate Recovery Codes - Supabase Edge Function
// Casa - Mission 18: Security & Data Protection
//
// Generates 10 recovery codes for the authenticated user, hashes them
// with SHA-256 before storing, deletes any previous codes, and returns
// the plaintext codes (shown once to the user).

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const CODE_COUNT = 10;
const CODE_LENGTH = 8;
const CODE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a random alphanumeric string of the given length using Web Crypto.
 */
function generateCode(length: number): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[randomBytes[i] % CODE_CHARS.length];
  }
  return code;
}

/**
 * Hash a string with SHA-256 and return it as a hex string.
 */
async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate user via Bearer token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getServiceClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // Verify that MFA is enabled for this user before generating recovery codes
    const { data: mfaRecord, error: mfaError } = await supabase
      .from('user_mfa')
      .select('is_enabled')
      .eq('user_id', userId)
      .single();

    if (mfaError || !mfaRecord) {
      return new Response(JSON.stringify({ error: 'MFA not configured for this user' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!mfaRecord.is_enabled) {
      return new Response(JSON.stringify({ error: 'MFA must be enabled before generating recovery codes' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate plaintext recovery codes
    const plaintextCodes: string[] = [];
    for (let i = 0; i < CODE_COUNT; i++) {
      plaintextCodes.push(generateCode(CODE_LENGTH));
    }

    // Hash each code with SHA-256
    const hashedRecords = await Promise.all(
      plaintextCodes.map(async (code) => ({
        user_id: userId,
        code_hash: await sha256Hex(code),
      }))
    );

    // Delete any previous recovery codes for this user
    const { error: deleteError } = await supabase
      .from('user_recovery_codes')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Delete old recovery codes error:', deleteError);
      return new Response(JSON.stringify({ error: 'Failed to clear existing recovery codes' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert the new hashed recovery codes
    const { error: insertError } = await supabase
      .from('user_recovery_codes')
      .insert(hashedRecords);

    if (insertError) {
      console.error('Insert recovery codes error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to store recovery codes' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return the plaintext codes (shown once to the user, never stored in plaintext)
    return new Response(JSON.stringify({
      codes: plaintextCodes,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Generate recovery codes error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
