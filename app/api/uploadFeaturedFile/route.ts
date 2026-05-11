import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assertMagicArtistUploader } from '@/app/utils/server/assertMagicArtistUploader';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MAX_BYTES = 280 * 1024 * 1024;

const ALLOWED_VIDEO_PREFIXES = ['video/'];
const ALLOWED_EXT = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogg']);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const artistId = (formData.get('artistId') as string | null)?.trim() ?? '';

    if (!file || !artistId) {
      return NextResponse.json({ error: 'Missing file or artistId' }, { status: 400 });
    }

    const uploadDenied = await assertMagicArtistUploader(request, artistId);
    if (uploadDenied) return uploadDenied;

    const { data: artistRow } = await supabase
      .from('artists')
      .select('treasury_wallet')
      .eq('id', artistId)
      .maybeSingle();

    if (!artistRow?.treasury_wallet) {
      return NextResponse.json(
        {
          error: 'Artist not found or treasury not set. Save artist first, then upload featured media.',
        },
        { status: 404 },
      );
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const typeOk =
      ALLOWED_VIDEO_PREFIXES.some((p) => file.type.startsWith(p)) ||
      (ext && ALLOWED_EXT.has(ext));
    if (!typeOk) {
      return NextResponse.json(
        { error: 'Invalid file type. Upload a video file (e.g. MP4, WebM, MOV).' },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Featured video is too large (max ~280 MB).' }, { status: 413 });
    }

    const fileExt = ext || 'mp4';
    const filePath = `${artistId}/featured.${fileExt}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('artist-assets')
      .upload(filePath, file, {
        contentType: file.type || `video/${fileExt}`,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('[uploadFeaturedFile] storage error:', uploadError);
      return NextResponse.json(
        { error: uploadError.message || 'Storage upload failed' },
        { status: 500 },
      );
    }

    const { data: urlData } = supabase.storage.from('artist-assets').getPublicUrl(uploadData.path);

    return NextResponse.json({
      success: true,
      publicUrl: urlData.publicUrl,
      path: uploadData.path,
    });
  } catch (error: unknown) {
    console.error('[uploadFeaturedFile]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
