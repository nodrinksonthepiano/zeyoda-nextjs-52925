import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyInviteAdmin } from '@/app/utils/server/verifyInviteAdmin';
import { normalizeReservedEmail } from '@/app/utils/server/normalizeReservedEmail';
import { slugFromDisplayName } from '@/app/utils/server/slugFromDisplayName';
import { generateCoinPublicId } from '@/app/utils/server/coinPublicId';
import {
  assertHttpsUrlsForMediaFields,
  assertNoDisallowedUrlStrings,
} from '@/app/utils/server/draftPayloadValidation';
import { treasureUrlForInvite } from '@/app/utils/server/inviteUrls';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface SaveDraftBody {
  coin_public_id?: string | null;
  reserved_email?: string;
  draft_payload: Record<string, unknown>;
}

function validateDraftShape(payload: Record<string, unknown>): void {
  if (payload.schema_version !== 1) {
    throw new Error('draft_payload.schema_version must be 1');
  }
  if (typeof payload.displayname !== 'string' || !payload.displayname.trim()) {
    throw new Error('draft_payload.displayname is required');
  }
  if (typeof payload.tokenName !== 'string' || !payload.tokenName.trim()) {
    throw new Error('draft_payload.tokenName is required');
  }
}

/**
 * Admin-only: create or update treasure draft (JSON only — upload binaries via POST /api/invite/draft-upload).
 */
export async function POST(request: NextRequest) {
  const adminGate = await verifyInviteAdmin(request);
  if (adminGate instanceof NextResponse) return adminGate;
  const adminEmail = adminGate.email;

  try {
    const body = (await request.json()) as SaveDraftBody;
    const draft_payload = body.draft_payload;
    if (!draft_payload || typeof draft_payload !== 'object') {
      return NextResponse.json({ error: 'draft_payload is required' }, { status: 400 });
    }

    validateDraftShape(draft_payload);
    assertNoDisallowedUrlStrings(draft_payload);
    assertHttpsUrlsForMediaFields(draft_payload);

    const coin_public_id = body.coin_public_id?.trim() || null;

    // --- Update existing draft ---
    if (coin_public_id) {
      const { data: row, error: fetchError } = await supabaseAdmin
        .from('artist_invites')
        .select('id, status, artist_slug, coin_public_id')
        .eq('coin_public_id', coin_public_id)
        .maybeSingle();

      if (fetchError) {
        console.error('save-draft fetch:', fetchError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      if (!row || row.status !== 'draft') {
        return NextResponse.json({ error: 'Draft not found or not editable' }, { status: 404 });
      }

      const lockedSlug = row.artist_slug;
      const slugFromPayload = slugFromDisplayName(String(draft_payload.displayname));
      if (slugFromPayload !== lockedSlug) {
        return NextResponse.json(
          {
            error: 'artist_slug_locked',
            message: 'Display name cannot change the locked artist slug; revert display name or create a new invite',
          },
          { status: 409 }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from('artist_invites')
        .update({
          draft_payload,
          updated_at: new Date().toISOString(),
        })
        .eq('coin_public_id', coin_public_id)
        .eq('status', 'draft');

      if (updateError) {
        console.error('save-draft update:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        coin_public_id,
        artist_slug: lockedSlug,
        treasure_url: treasureUrlForInvite(lockedSlug, coin_public_id),
        updated: true,
      });
    }

    // --- Create new invite ---
    if (!body.reserved_email || typeof body.reserved_email !== 'string') {
      return NextResponse.json({ error: 'reserved_email is required for new drafts' }, { status: 400 });
    }

    const reserved_email_normalized = normalizeReservedEmail(body.reserved_email);
    if (!reserved_email_normalized.includes('@')) {
      return NextResponse.json({ error: 'reserved_email must be a valid email' }, { status: 400 });
    }

    const artist_slug = slugFromDisplayName(String(draft_payload.displayname));

    const { data: liveArtist, error: liveErr } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('id', artist_slug)
      .maybeSingle();

    if (liveErr) {
      console.error('save-draft artists lookup:', liveErr);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (liveArtist) {
      return NextResponse.json(
        {
          error: 'slug_conflict',
          message: `Live artist already exists for slug "${artist_slug}"`,
        },
        { status: 409 }
      );
    }

    const { data: activeInvite, error: activeErr } = await supabaseAdmin
      .from('artist_invites')
      .select('id, coin_public_id')
      .eq('artist_slug', artist_slug)
      .in('status', ['draft', 'claimed'])
      .maybeSingle();

    if (activeErr) {
      console.error('save-draft active invite:', activeErr);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (activeInvite) {
      return NextResponse.json(
        {
          error: 'active_invite_exists',
          message: `An active invite already exists for "${artist_slug}"`,
          coin_public_id: activeInvite.coin_public_id,
        },
        { status: 409 }
      );
    }

    let newCoin = generateCoinPublicId();
    // Extremely unlikely collision loop
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: clash } = await supabaseAdmin
        .from('artist_invites')
        .select('id')
        .eq('coin_public_id', newCoin)
        .maybeSingle();
      if (!clash) break;
      newCoin = generateCoinPublicId();
    }

    const { error: insertError } = await supabaseAdmin.from('artist_invites').insert({
      artist_slug,
      coin_public_id: newCoin,
      status: 'draft',
      draft_payload,
      reserved_email_normalized,
      created_by_email: adminEmail,
    });

    if (insertError) {
      console.error('save-draft insert:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      coin_public_id: newCoin,
      artist_slug,
      treasure_url: treasureUrlForInvite(artist_slug, newCoin),
      created: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const isValidation =
      message.includes('draft_payload') ||
      message.includes('slug') ||
      message.includes('must be') ||
      message.includes('disallowed');
    return NextResponse.json({ error: message }, { status: isValidation ? 400 : 500 });
  }
}
