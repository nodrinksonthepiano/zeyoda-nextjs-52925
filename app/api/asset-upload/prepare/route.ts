import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { requireSecret, rateLimit } from '@/app/utils/apiGuard';
import { assertMagicArtistUploader } from '@/app/utils/server/assertMagicArtistUploader';
import {
  ALLOWED_COVER_MIMES,
  ASSET_UPLOAD_BUCKET,
  isAllowedPrimaryMime,
  isAudioPrimaryMime,
  MAX_AUDIO_BYTES,
  MAX_COVER_BYTES,
  MAX_PRIMARY_BYTES,
} from '@/app/utils/server/assetUploadLimits';
import {
  buildPendingCoverPath,
  buildPendingPrimaryPath,
} from '@/app/utils/server/assetUploadPaths';
import { verifyAssetUploadProxyAuth } from '@/app/utils/server/assetUploadProxyAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

type FileIntent = {
  mime?: unknown;
  size?: unknown;
  fileName?: unknown;
};

function parseFileIntent(raw: unknown): { mime: string; size: number; fileName?: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as FileIntent;
  const mime = typeof o.mime === 'string' ? o.mime.toLowerCase().split(';')[0].trim() : '';
  const size = typeof o.size === 'number' ? o.size : Number(o.size);
  const fileName = typeof o.fileName === 'string' ? o.fileName : undefined;
  if (!mime || !Number.isFinite(size) || size <= 0) return null;
  return { mime, size, fileName };
}

export async function POST(request: NextRequest) {
  const secretCheck = requireSecret(request);
  if (secretCheck) return secretCheck;

  const proxyAuth = await verifyAssetUploadProxyAuth(request);
  if (!proxyAuth.ok) return proxyAuth.response;

  const rl = rateLimit(request, 'asset-upload-prepare', 20, 60_000);
  if (rl) return rl;

  try {
    const body = await request.json();
    const artistId = typeof body.artistId === 'string' ? body.artistId.trim() : '';
    const primary = parseFileIntent(body.primary);
    const cover = parseFileIntent(body.cover);

    if (!artistId || !primary) {
      return NextResponse.json({ error: 'artistId and primary { mime, size } are required' }, { status: 400 });
    }

    if (!isAllowedPrimaryMime(primary.mime)) {
      return NextResponse.json({ error: 'Unsupported primary media type' }, { status: 400 });
    }

    const isAudio = isAudioPrimaryMime(primary.mime);
    const primaryMax = isAudio ? MAX_AUDIO_BYTES : MAX_PRIMARY_BYTES;
    if (primary.size > primaryMax) {
      return NextResponse.json(
        {
          error: isAudio
            ? 'Audio file must be 45 MB or smaller'
            : 'Primary file must be 45 MB or smaller',
        },
        { status: 413 },
      );
    }

    if (isAudio) {
      if (!cover) {
        return NextResponse.json(
          { error: 'Thumbnail / Cover Art is required when uploading audio' },
          { status: 400 },
        );
      }
      if (!ALLOWED_COVER_MIMES.has(cover.mime)) {
        return NextResponse.json(
          { error: 'Thumbnail / Cover Art must be JPEG, PNG, or WebP' },
          { status: 400 },
        );
      }
      if (cover.size > MAX_COVER_BYTES) {
        return NextResponse.json(
          { error: 'Thumbnail / Cover Art must be 5 MB or smaller' },
          { status: 413 },
        );
      }
    } else if (cover) {
      return NextResponse.json(
        { error: 'Cover image can only be uploaded with audio files' },
        { status: 400 },
      );
    }

    const uploadDenied = await assertMagicArtistUploader(request, artistId, proxyAuth.auth);
    if (uploadDenied) return uploadDenied;

    const sessionId = uuidv4();
    const primaryPath = buildPendingPrimaryPath(
      artistId,
      sessionId,
      primary.mime,
      primary.fileName,
    );
    if (!primaryPath) {
      return NextResponse.json({ error: 'Invalid artistId or session path' }, { status: 400 });
    }

    const { data: primarySigned, error: primarySignError } = await supabase.storage
      .from(ASSET_UPLOAD_BUCKET)
      .createSignedUploadUrl(primaryPath);

    if (primarySignError || !primarySigned?.token) {
      console.error('[asset-upload/prepare] primary signed URL error:', primarySignError);
      return NextResponse.json({ error: 'Could not create primary upload URL' }, { status: 500 });
    }

    let coverUpload: {
      path: string;
      token: string;
      signedUrl: string;
    } | null = null;

    if (isAudio && cover) {
      const coverPath = buildPendingCoverPath(artistId, sessionId, cover.mime);
      if (!coverPath) {
        return NextResponse.json({ error: 'Invalid cover upload path' }, { status: 400 });
      }

      const { data: coverSigned, error: coverSignError } = await supabase.storage
        .from(ASSET_UPLOAD_BUCKET)
        .createSignedUploadUrl(coverPath);

      if (coverSignError || !coverSigned?.token) {
        console.error('[asset-upload/prepare] cover signed URL error:', coverSignError);
        return NextResponse.json({ error: 'Could not create cover upload URL' }, { status: 500 });
      }

      coverUpload = {
        path: coverPath,
        token: coverSigned.token,
        signedUrl: coverSigned.signedUrl,
      };
    }

    console.log('[asset-upload/prepare] session created', {
      artistId,
      sessionId,
      primaryPath,
      hasCover: !!coverUpload,
    });

    return NextResponse.json({
      success: true,
      sessionId,
      bucket: ASSET_UPLOAD_BUCKET,
      primary: {
        path: primaryPath,
        token: primarySigned.token,
        signedUrl: primarySigned.signedUrl,
        mime: primary.mime,
        maxBytes: primaryMax,
      },
      cover: coverUpload
        ? {
            ...coverUpload,
            mime: cover!.mime,
            maxBytes: MAX_COVER_BYTES,
          }
        : null,
    });
  } catch (error: unknown) {
    console.error('[asset-upload/prepare] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
