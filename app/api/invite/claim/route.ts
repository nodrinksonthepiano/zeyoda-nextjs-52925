import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMagicAuthFromBearer } from '@/app/utils/server/magicBearerEmail';
import { normalizeReservedEmail } from '@/app/utils/server/normalizeReservedEmail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface ClaimBody {
  coin_public_id?: string;
  artist_slug?: string;
  claimed_by_wallet?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getMagicAuthFromBearer(request);
    if (!auth?.email) {
      return NextResponse.json(
        { code: 'unauthorized', message: 'Authentication required' },
        { status: 401 },
      );
    }
    const email = auth.email;

    let body: ClaimBody;
    try {
      body = (await request.json()) as ClaimBody;
    } catch {
      return NextResponse.json({ code: 'invalid_body', message: 'Invalid JSON' }, { status: 400 });
    }

    const coin = body.coin_public_id?.trim();
    if (!coin) {
      return NextResponse.json(
        { code: 'invalid_coin', message: 'coin_public_id is required' },
        { status: 400 },
      );
    }

    const { data: row, error } = await supabaseAdmin
      .from('artist_invites')
      .select(
        'id, status, coin_public_id, artist_slug, reserved_email_normalized, claimed_by_email, draft_payload',
      )
      .eq('coin_public_id', coin)
      .maybeSingle();

    if (error) {
      console.error('invite claim fetch:', error);
      return NextResponse.json(
        { code: 'database_error', message: 'Database error' },
        { status: 500 },
      );
    }

    if (!row) {
      return NextResponse.json(
        { code: 'invalid_coin', message: 'Invite not found' },
        { status: 404 },
      );
    }

    if (body.artist_slug && body.artist_slug.trim() !== row.artist_slug) {
      return NextResponse.json(
        { code: 'slug_mismatch', message: 'artist_slug does not match invite' },
        { status: 400 },
      );
    }

    if (row.status === 'draft') {
      if (normalizeReservedEmail(email) !== row.reserved_email_normalized) {
        return NextResponse.json(
          { code: 'reserved_email_mismatch', message: 'This coin was prepared for another email.' },
          { status: 403 },
        );
      }

      const bodyWallet =
        typeof body.claimed_by_wallet === 'string' ? body.claimed_by_wallet.trim() : null;
      const wallet = bodyWallet || auth.publicAddress || null;

      const { error: updErr } = await supabaseAdmin
        .from('artist_invites')
        .update({
          status: 'claimed',
          claimed_by_email: normalizeReservedEmail(email),
          claimed_by_wallet: wallet || null,
          claimed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('coin_public_id', coin)
        .eq('status', 'draft');

      if (updErr) {
        console.error('invite claim update:', updErr);
        return NextResponse.json(
          { code: 'database_error', message: 'Failed to claim' },
          { status: 500 },
        );
      }

      return NextResponse.json({
        coin_public_id: row.coin_public_id,
        artist_slug: row.artist_slug,
        status: 'claimed',
        draft_payload: row.draft_payload,
      });
    }

    if (row.status === 'claimed') {
      const claimant = row.claimed_by_email
        ? normalizeReservedEmail(row.claimed_by_email as string)
        : null;

      if (claimant !== normalizeReservedEmail(email)) {
        return NextResponse.json(
          { code: 'already_claimed', message: 'This treasure was claimed by someone else.' },
          { status: 409 },
        );
      }

      return NextResponse.json({
        coin_public_id: row.coin_public_id,
        artist_slug: row.artist_slug,
        status: 'claimed',
        draft_payload: row.draft_payload,
      });
    }

    if (row.status === 'launched') {
      return NextResponse.json(
        { code: 'already_launched', message: 'Invite is already launched' },
        { status: 410 },
      );
    }

    if (row.status === 'revoked') {
      return NextResponse.json({ code: 'revoked', message: 'Invite is revoked' }, { status: 410 });
    }

    return NextResponse.json(
      { code: 'not_draft', message: 'Invite cannot be claimed' },
      { status: 400 },
    );
  } catch (e) {
    console.error('invite claim exception:', e);
    return NextResponse.json(
      { code: 'internal_error', message: 'Internal error' },
      { status: 500 },
    );
  }
}
