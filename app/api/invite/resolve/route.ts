import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mapInviteToTreasureDto } from '@/app/utils/server/mapInviteToTreasureDto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Public: resolve NFC coin_public_id → invite preview / revoked / launched hint. */
export async function GET(request: NextRequest) {
  try {
    const coin = request.nextUrl.searchParams.get('coin')?.trim();
    if (!coin) {
      return NextResponse.json({ status: 'not_found', coin_public_id: '' }, { status: 400 });
    }

    const { data: row, error } = await supabaseAdmin
      .from('artist_invites')
      .select('coin_public_id, artist_slug, status, draft_payload')
      .eq('coin_public_id', coin)
      .maybeSingle();

    if (error) {
      console.error('invite resolve:', error);
      return NextResponse.json(
        { status: 'error', message: 'Database error' },
        { status: 500 },
      );
    }

    if (!row) {
      return NextResponse.json({
        status: 'not_found',
        coin_public_id: coin,
      });
    }

    if (row.status === 'revoked') {
      return NextResponse.json({
        status: 'revoked',
        coin_public_id: row.coin_public_id,
        messageKey: 'he_was_taken' as const,
      });
    }

    if (row.status === 'launched') {
      return NextResponse.json({
        status: 'launched',
        artist_slug: row.artist_slug,
        coin_public_id: row.coin_public_id,
      });
    }

    if (row.status === 'draft' || row.status === 'claimed') {
      const treasure = mapInviteToTreasureDto(row.draft_payload as Record<string, unknown>);
      if (!treasure) {
        console.error('invite resolve: corrupt draft_payload for', coin);
        return NextResponse.json(
          { status: 'error', message: 'Invalid treasure payload' },
          { status: 500 },
        );
      }

      return NextResponse.json({
        status: row.status,
        artist_slug: row.artist_slug,
        coin_public_id: row.coin_public_id,
        treasure,
      });
    }

    return NextResponse.json(
      { status: 'error', message: 'Unexpected invite status' },
      { status: 500 },
    );
  } catch (e) {
    console.error('invite resolve exception:', e);
    return NextResponse.json({ status: 'error', message: 'Internal error' }, { status: 500 });
  }
}
