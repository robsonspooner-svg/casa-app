// Verify MFA - Supabase Edge Function
// Casa - Mission 18: Security & Data Protection
//
// Verifies a TOTP code against the user's stored secret.
// For 'setup' action: marks MFA as enabled after first successful verification.
// For 'login' action: validates the code during login and updates last_used_at.

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { decryptField } from '../_shared/encryption.ts';

// Base32 alphabet (RFC 4648)
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(input: string): Uint8Array {
  const cleaned = input.replace(/=+$/, '').toUpperCase();
  const output: number[] = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_CHARS.indexOf(cleaned[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

/**
 * Generate a TOTP code for a given secret and time counter using HMAC-SHA1.
 */
async function generateTOTP(secretBase32: string, counter: bigint): Promise<string> {
  const secretBytes = decodeBase32(secretBase32);

  // Import the secret as an HMAC-SHA1 key
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  // Convert counter to 8-byte big-endian buffer
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  // Split bigint into two 32-bit parts for DataView compatibility
  counterView.setUint32(0, Number(counter >> 32n), false);
  counterView.setUint32(4, Number(counter & 0xffffffffn), false);

  // HMAC-SHA1
  const hmacResult = await crypto.subtle.sign('HMAC', key, counterBuffer);
  const hmacBytes = new Uint8Array(hmacResult);

  // Dynamic truncation (RFC 4226)
  const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
  const binary =
    ((hmacBytes[offset] & 0x7f) << 24) |
    ((hmacBytes[offset + 1] & 0xff) << 16) |
    ((hmacBytes[offset + 2] & 0xff) << 8) |
    (hmacBytes[offset + 3] & 0xff);

  // 6-digit code
  const otp = binary % 1_000_000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verify a TOTP code, allowing +/- 1 time step window (30s each).
 */
async function verifyTOTP(secretBase32: string, code: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const timeStep = 30;
  const currentCounter = BigInt(Math.floor(now / timeStep));

  // Check current window and +/- 1 step
  for (let offset = -1; offset <= 1; offset++) {
    const counter = currentCounter + BigInt(offset);
    const expected = await generateTOTP(secretBase32, counter);
    if (expected === code) {
      return true;
    }
  }

  return false;
}

interface VerifyMFARequest {
  code: string;
  action: 'setup' | 'login';
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

    // Parse request body
    const { code, action } = (await req.json()) as VerifyMFARequest;

    if (!code || !action) {
      return new Response(JSON.stringify({ error: 'code and action are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action !== 'setup' && action !== 'login') {
      return new Response(JSON.stringify({ error: 'action must be "setup" or "login"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the user's MFA record
    const { data: mfaRecord, error: mfaError } = await supabase
      .from('user_mfa')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (mfaError || !mfaRecord) {
      return new Response(JSON.stringify({ error: 'MFA not configured for this user' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decrypt the stored TOTP secret
    const decryptedSecret = await decryptField(mfaRecord.totp_secret);

    // Verify the TOTP code
    const isValid = await verifyTOTP(decryptedSecret, code);

    if (!isValid) {
      return new Response(JSON.stringify({ verified: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Code is valid - update based on action
    const now = new Date().toISOString();

    if (action === 'setup') {
      // Mark MFA as enabled and record verification time
      const { error: updateError } = await supabase
        .from('user_mfa')
        .update({
          is_enabled: true,
          verified_at: now,
          last_used_at: now,
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('MFA enable update error:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to enable MFA' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Also update the profile mfa_enabled flag
      await supabase
        .from('profiles')
        .update({ mfa_enabled: true })
        .eq('id', userId);

    } else {
      // Login verification - update last_used_at
      const { error: updateError } = await supabase
        .from('user_mfa')
        .update({ last_used_at: now })
        .eq('user_id', userId);

      if (updateError) {
        console.error('MFA last_used_at update error:', updateError);
      }
    }

    return new Response(JSON.stringify({ verified: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Verify MFA error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
