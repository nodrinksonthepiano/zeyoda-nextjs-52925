import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyInviteAdmin } from '@/app/utils/server/verifyInviteAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Admin-only read of draft_payload for editable draft rows only. */
export async function GET(request: NextRequest) {
  const adminGate = await verifyInviteAdmin(request);
  if (adminGate instanceof NextResponse) return adminGate;

  const coin = request.nextUrl.searchParams.get('coin')?.trim() ?? '';
  if (!coin) {
    return NextResponse.json({ error: 'coin query parameter is required' }, { status: 400 });
  }

  const { data: row, error } = await supabaseAdmin
    .from('artist_invites')
    .select('coin_public_id, artist_slug, status, draft_payload')
    .eq('coin_public_id', coin)
    .maybeSingle();

  if (error) {
    console.error('admin-draft fetch:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  if (row.status !== 'draft') {
    return NextResponse.json(
      {
        error: 'Invite is not in draft status; load is only supported for drafts',
        status: row.status,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    coin_public_id: row.coin_public_id,
    artist_slug: row.artist_slug,
    status: row.status as 'draft',
    draft_payload: row.draft_payload,
  });
}
