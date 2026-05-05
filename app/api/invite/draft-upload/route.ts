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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_FEATURED_BYTES = 80 * 1024 * 1024;

type AssetKind = 'logo' | 'background' | 'featured';

function extFromFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName) && fromName.length <= 8) return fromName;
  const mime = file.type.split('/').pop()?.toLowerCase() || 'bin';
  if (mime === 'jpeg') return 'jpg';
  return mime.slice(0, 8) || 'bin';
}

/**
 * Admin-only: upload draft media to artist-assets/__drafts__/<coin_public_id>/...
 */
export async function POST(request: NextRequest) {
  const adminGate = await verifyInviteAdmin(request);
  if (adminGate instanceof NextResponse) return adminGate;

  try {
    const formData = await request.formData();
    const coinPublicId = (formData.get('coin_public_id') as string)?.trim();
    const kind = (formData.get('kind') as string)?.trim().toLowerCase() as AssetKind;
    const file = formData.get('file') as File | null;

    if (!coinPublicId || !file) {
      return NextResponse.json(
        { error: 'coin_public_id and file are required' },
        { status: 400 }
      );
    }

    if (!['logo', 'background', 'featured'].includes(kind)) {
      return NextResponse.json({ error: 'kind must be logo, background, or featured' }, { status: 400 });
    }

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('artist_invites')
      .select('id, status')
      .eq('coin_public_id', coinPublicId)
      .maybeSingle();

    if (inviteError) {
      console.error('draft-upload invite lookup:', inviteError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!invite || invite.status !== 'draft') {
      return NextResponse.json({ error: 'Invite not found or not editable' }, { status: 404 });
    }

    if (kind === 'logo' || kind === 'background') {
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Logo and background must be images' }, { status: 400 });
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: 'Image must be 5MB or smaller' }, { status: 400 });
      }
    } else {
      const ok =
        file.type.startsWith('image/') ||
        file.type.startsWith('video/') ||
        file.type.startsWith('audio/');
      if (!ok) {
        return NextResponse.json({ error: 'Featured asset must be image, video, or audio' }, { status: 400 });
      }
      if (file.size > MAX_FEATURED_BYTES) {
        return NextResponse.json({ error: 'Featured asset too large (max 80MB)' }, { status: 400 });
      }
    }

    const unique = uuidv4();
    const ext = extFromFile(file);
    const storagePath = `__drafts__/${coinPublicId}/${kind}.${unique}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('draft-upload storage:', uploadError);
      return NextResponse.json({ error: 'Upload failed', message: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(uploadData.path);
    const publicUrl = urlData.publicUrl;

    if (!publicUrl.startsWith('https://')) {
      return NextResponse.json({ error: 'Storage returned non-https URL' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      kind,
      path: uploadData.path,
      url: publicUrl,
      coin_public_id: coinPublicId,
    });
  } catch (err: unknown) {
    console.error('draft-upload:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
