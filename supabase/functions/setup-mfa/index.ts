// Setup MFA - Supabase Edge Function
// Casa - Mission 18: Security & Data Protection
//
// Generates a TOTP secret for the authenticated user, encrypts it,
// stores it in user_mfa, and returns the provisioning URI + base32 secret.

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { encryptField } from '../_shared/encryption.ts';

// Base32 alphabet (RFC 4648)
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encodeBase32(buffer: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 0x1f];
  }

  return output;
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

    // Validate the JWT and get the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const email = user.email || 'user';

    // Generate a 20-byte random secret (standard TOTP secret length)
    const secretBytes = crypto.getRandomValues(new Uint8Array(20));
    const base32Secret = encodeBase32(secretBytes);

    // Encrypt the secret before storing
    const encryptedSecret = await encryptField(base32Secret);

    // Upsert into user_mfa (insert or update if user already has a pending setup)
    const { error: upsertError } = await supabase
      .from('user_mfa')
      .upsert(
        {
          user_id: userId,
          totp_secret: encryptedSecret,
          is_enabled: false,
          verified_at: null,
          last_used_at: null,
        },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      console.error('MFA upsert error:', upsertError);
      return new Response(JSON.stringify({ error: 'Failed to store MFA secret' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the otpauth provisioning URI
    const issuer = 'Casa';
    const label = encodeURIComponent(`${issuer}:${email}`);
    const params = new URLSearchParams({
      secret: base32Secret,
      issuer,
      algorithm: 'SHA1',
      digits: '6',
      period: '30',
    });
    const provisioningUri = `otpauth://totp/${label}?${params.toString()}`;

    return new Response(JSON.stringify({
      provisioning_uri: provisioningUri,
      secret: base32Secret,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Setup MFA error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
