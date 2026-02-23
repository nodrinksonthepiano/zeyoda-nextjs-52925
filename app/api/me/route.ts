import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyWhitelist } from '@/app/utils/server/whitelistCheck';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL and service role key are required.');
}

const serviceSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: NextRequest) {
  try {
    const whitelistResult = await verifyWhitelist(request);
    if (!whitelistResult.verified || !whitelistResult.email) {
      return NextResponse.json(
        { error: whitelistResult.error || 'Unauthorized', message: 'Authentication required' },
        { status: whitelistResult.email === null ? 401 : 403 }
      );
    }

    const { data } = await serviceSupabase
      .from('whitelist_emails')
      .select('email, role')
      .eq('email', whitelistResult.email)
      .single();

    if (!data) {
      return NextResponse.json(
        { error: 'Not whitelisted', message: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      email: data.email,
      role: data.role || 'user',
      isAdmin: data.role === 'admin',
    });
  } catch (err: any) {
    console.error('❌ /api/me error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
