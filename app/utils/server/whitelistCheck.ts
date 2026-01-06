import { NextRequest } from 'next/server';
import { Magic } from '@magic-sdk/admin';
import { createClient } from '@supabase/supabase-js';

// Initialize Magic Admin SDK (server-side only)
const magicSecretKey = process.env.MAGIC_SECRET_KEY;
if (!magicSecretKey) {
  throw new Error('MAGIC_SECRET_KEY environment variable is required');
}

const magicAdmin = new Magic(magicSecretKey);

// Initialize Supabase client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL and service role key are required');
}

const serviceSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * Result of whitelist verification
 */
export interface WhitelistCheckResult {
  verified: boolean;        // true if token is valid AND email is whitelisted
  email: string | null;    // email extracted from token (or null if invalid)
  error: string | null;    // error message if verification failed
}

/**
 * Verifies Magic DID token and checks if the user's email is whitelisted
 * 
 * @param request - Next.js request object
 * @returns WhitelistCheckResult with verification status
 */
export async function verifyWhitelist(request: NextRequest): Promise<WhitelistCheckResult> {
  try {
    // 1. Extract DID token from Authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No Authorization header or invalid format');
      return {
        verified: false,
        email: null,
        error: 'No token provided'
      };
    }

    const didToken = authHeader.substring(7); // Remove "Bearer " prefix
    
    if (!didToken || didToken.trim().length === 0) {
      console.log('❌ Empty token');
      return {
        verified: false,
        email: null,
        error: 'Empty token'
      };
    }

    console.log('🔍 Verifying Magic DID token...');

    // 2. Verify token with Magic Admin SDK
    let tokenMetadata;
    try {
      tokenMetadata = await magicAdmin.token.validate(didToken);
    } catch (magicError: any) {
      console.error('❌ Magic token verification failed:', magicError.message);
      return {
        verified: false,
        email: null,
        error: `Invalid token: ${magicError.message}`
      };
    }

    // 3. Extract email from verified token
    const email = tokenMetadata.issuer || tokenMetadata.email;
    
    if (!email) {
      console.error('❌ No email found in token metadata');
      return {
        verified: false,
        email: null,
        error: 'No email in token'
      };
    }

    console.log(`✅ Token verified for email: ${email}`);

    // 4. Check if email is whitelisted in Supabase
    const { data: whitelistData, error: whitelistError } = await serviceSupabase
      .from('whitelist_emails')
      .select('email, role')
      .eq('email', email)
      .single();

    if (whitelistError && whitelistError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error, just not whitelisted)
      console.error('❌ Whitelist database error:', whitelistError);
      return {
        verified: false,
        email: email,
        error: 'Database error checking whitelist'
      };
    }

    const isWhitelisted = !!whitelistData;

    if (isWhitelisted) {
      console.log(`✅ Email ${email} is whitelisted (role: ${whitelistData.role})`);
      return {
        verified: true,
        email: email,
        error: null
      };
    } else {
      console.log(`❌ Email ${email} is NOT whitelisted`);
      return {
        verified: false,
        email: email,
        error: 'Not whitelisted'
      };
    }

  } catch (error: any) {
    console.error('❌ Unexpected error in verifyWhitelist:', error);
    return {
      verified: false,
      email: null,
      error: `Verification failed: ${error.message}`
    };
  }
}

