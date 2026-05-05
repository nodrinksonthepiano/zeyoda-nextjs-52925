import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMagicEmailFromBearer } from '@/app/utils/server/magicBearerEmail';
import { normalizeReservedEmail } from '@/app/utils/server/normalizeReservedEmail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Bearer required (middleware): is viewer the claimant? */
export async function GET(request: NextRequest) {
  try {
    const email = await getMagicEmailFromBearer(request);
    if (!email) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 },
      );
    }

    const coin = request.nextUrl.searchParams.get('coin')?.trim();
    if (!coin) {
      return NextResponse.json(
        { error: 'missing_coin', message: 'coin query required' },
        { status: 400 },
      );
    }

    const { data: row, error } = await supabaseAdmin
      .from('artist_invites')
      .select('claimed_by_email, coin_public_id')
      .eq('coin_public_id', coin)
      .maybeSingle();

    if (error) {
      console.error('me-state:', error);
      return NextResponse.json(
        { error: 'database_error', message: 'Database error' },
        { status: 500 },
      );
    }

    if (!row) {
      return NextResponse.json({ error: 'not_found', message: 'No invite for coin' }, { status: 404 });
    }

    const claimedNorm = row.claimed_by_email
      ? normalizeReservedEmail(row.claimed_by_email as string)
      : '';

    const isClaimant =
      !!claimedNorm && claimedNorm === normalizeReservedEmail(email);

    return NextResponse.json({ isClaimant });
  } catch (e) {
    console.error('me-state exception:', e);
    return NextResponse.json({ error: 'internal_error', message: 'Internal error' }, { status: 500 });
  }
}
