import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyWhitelist } from '@/app/utils/server/whitelistCheck';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL and service role key are required.');
}

const serviceSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
  try {
    const whitelistResult = await verifyWhitelist(request);
    if (!whitelistResult.verified || !whitelistResult.email) {
      return NextResponse.json(
        { error: whitelistResult.error || 'Unauthorized', message: 'Authentication required' },
        { status: whitelistResult.email === null ? 401 : 403 }
      );
    }

    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const artistId = typeof body?.artist_id === 'string' ? body.artist_id.trim() || null : null;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required', message: 'Please enter feedback' },
        { status: 400 }
      );
    }

    // Check role for source (admin vs user)
    const { data: whitelistData } = await serviceSupabase
      .from('whitelist_emails')
      .select('role')
      .eq('email', whitelistResult.email)
      .single();

    const source = whitelistData?.role === 'admin' ? 'admin' : 'user';

    const { data, error } = await serviceSupabase
      .from('feedback')
      .insert({
        message,
        submitted_by: whitelistResult.email,
        source,
        status: 'open',
        artist_id: artistId,
      })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('❌ Feedback insert error:', error);
      return NextResponse.json(
        { error: 'Failed to save feedback', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: data.id, created_at: data.created_at }, { status: 201 });
  } catch (err: any) {
    console.error('❌ Feedback API error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
