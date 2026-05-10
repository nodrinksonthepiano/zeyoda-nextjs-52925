import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { requireSecret, rateLimit } from '@/app/utils/apiGuard';
import { isTrustedLaunchSourceUrl } from '@/app/utils/launchIntegrity';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MAX_BYTES = 280 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const secretCheck = requireSecret(request);
  if (secretCheck) return secretCheck;

  // Public proxy already verified Magic + whitelist; this internal route trusts
  // x-internal-secret (requireSecret above) plus x-verified-email from that proxy.
  const verifiedEmail = (request.headers.get('x-verified-email') ?? '').trim();
  if (!verifiedEmail) {
    return NextResponse.json(
      { error: 'Missing x-verified-email', message: 'Internal proxy must forward verified email' },
      { status: 400 },
    );
  }
  console.log('[uploadFeatured] internal proxy caller:', verifiedEmail);

  const rl = rateLimit(request, 'upload-featured', 10, 60_000);
  if (rl) return rl;

  try {
    const body = await request.json();
    const artistId = typeof body.artistId === 'string' ? body.artistId.trim() : '';
    const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '';

    if (!artistId || !isTrustedLaunchSourceUrl(sourceUrl)) {
      return NextResponse.json(
        { error: 'artistId and trusted Supabase https sourceUrl required' },
        { status: 400 },
      );
    }

    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('id')
      .eq('id', artistId)
      .single();

    if (artistError || !artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    const upstream = await fetch(sourceUrl, { redirect: 'follow' });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Could not fetch media: HTTP ${upstream.status}` },
        { status: 502 },
      );
    }

    const lenHeader = upstream.headers.get('content-length');
    if (lenHeader && Number(lenHeader) > MAX_BYTES) {
      return NextResponse.json({ error: 'Featured media too large' }, { status: 413 });
    }

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Featured media too large' }, { status: 413 });
    }

    const mime =
      upstream.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';

    const urlPath = new URL(sourceUrl).pathname;
    const pathExt = urlPath.includes('.') ? urlPath.split('.').pop() || 'bin' : 'bin';
    const safeExt = pathExt.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'bin';
    const fileName = `${artistId}/featured-${uuidv4()}.${safeExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('artist-assets')
      .upload(fileName, Buffer.from(buf), { contentType: mime, upsert: false });

    if (uploadError) {
      console.error('uploadFeatured storage error:', uploadError);
      return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('artist-assets').getPublicUrl(uploadData.path);

    return NextResponse.json({
      success: true,
      publicUrl: urlData.publicUrl,
      path: uploadData.path,
    });
  } catch (error: unknown) {
    console.error('uploadFeatured error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
