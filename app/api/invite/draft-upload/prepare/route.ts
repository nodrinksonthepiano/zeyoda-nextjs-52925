import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { verifyInviteAdmin } from '@/app/utils/server/verifyInviteAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = 'artist-assets';
const MAX_FEATURED_BYTES = 80 * 1024 * 1024;

function extFromMime(mime: string, fileName?: string): string {
  const fromName = fileName?.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName) && fromName.length <= 8) return fromName;
  const part = mime.split('/').pop()?.toLowerCase() || 'bin';
  if (part === 'jpeg') return 'jpg';
  if (part === 'mpeg') return 'mp3';
  return part.slice(0, 8) || 'bin';
}

/**
 * Admin-only JSON: signed upload URL for treasure draft featured media.
 * Browser uploads bytes directly to Supabase — never through Vercel body.
 */
export async function POST(request: NextRequest) {
  const adminGate = await verifyInviteAdmin(request);
  if (adminGate instanceof NextResponse) return adminGate;

  try {
    const body = await request.json();
    const coinPublicId = typeof body.coin_public_id === 'string' ? body.coin_public_id.trim() : '';
    const mime = typeof body.mime === 'string' ? body.mime.toLowerCase().split(';')[0].trim() : '';
    const size = typeof body.size === 'number' ? body.size : Number(body.size);
    const fileName = typeof body.fileName === 'string' ? body.fileName : undefined;

    if (!coinPublicId || !mime || !Number.isFinite(size) || size <= 0) {
      return NextResponse.json(
        { error: 'coin_public_id, mime, and size are required' },
        { status: 400 },
      );
    }

    const ok =
      mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/');
    if (!ok) {
      return NextResponse.json(
        { error: 'Featured asset must be image, video, or audio' },
        { status: 400 },
      );
    }

    if (size > MAX_FEATURED_BYTES) {
      return NextResponse.json({ error: 'Featured asset too large (max 80MB)' }, { status: 413 });
    }

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('artist_invites')
      .select('id, status')
      .eq('coin_public_id', coinPublicId)
      .maybeSingle();

    if (inviteError) {
      console.error('draft-upload/prepare invite lookup:', inviteError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!invite || invite.status !== 'draft') {
      return NextResponse.json({ error: 'Invite not found or not editable' }, { status: 404 });
    }

    const unique = uuidv4();
    const ext = extFromMime(mime, fileName);
    const storagePath = `__drafts__/${coinPublicId}/featured.${unique}.${ext}`;

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signError || !signed?.token) {
      console.error('draft-upload/prepare signed URL:', signError);
      return NextResponse.json({ error: 'Could not create upload URL' }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    if (!publicUrl.startsWith('https://')) {
      return NextResponse.json({ error: 'Storage returned non-https URL' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      bucket: BUCKET,
      path: storagePath,
      token: signed.token,
      signedUrl: signed.signedUrl,
      url: publicUrl,
      mime,
      maxBytes: MAX_FEATURED_BYTES,
      coin_public_id: coinPublicId,
    });
  } catch (err: unknown) {
    console.error('draft-upload/prepare:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
