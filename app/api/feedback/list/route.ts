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

    const { data: whitelistData } = await serviceSupabase
      .from('whitelist_emails')
      .select('role')
      .eq('email', whitelistResult.email)
      .single();

    if (whitelistData?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }

    const { data, error } = await serviceSupabase
      .from('feedback')
      .select('id, message, submitted_by, source, status, artist_id, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Feedback list error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch feedback', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ feedback: data || [] });
  } catch (err: any) {
    console.error('❌ /api/feedback/list error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
