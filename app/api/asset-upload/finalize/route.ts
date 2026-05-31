import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { requireSecret, rateLimit } from '@/app/utils/apiGuard';
import { assertMagicArtistUploader } from '@/app/utils/server/assertMagicArtistUploader';
import {
  ALLOWED_COVER_MIMES,
  ASSET_UPLOAD_BUCKET,
  isAudioPrimaryMime,
  MAX_AUDIO_BYTES,
  MAX_COVER_BYTES,
  MAX_PRIMARY_BYTES,
} from '@/app/utils/server/assetUploadLimits';
import { isTrustedPendingAssetPath } from '@/app/utils/server/assetUploadPaths';
import { verifyAssetUploadProxyAuth } from '@/app/utils/server/assetUploadProxyAuth';
import { mintArtistAssetToken } from '@/app/utils/server/mintArtistAssetToken';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getStoredObjectSize(path: string): Promise<number | null> {
  const parts = path.split('/');
  const fileName = parts.pop();
  const dir = parts.join('/');
  if (!fileName || !dir) return null;

  const { data, error } = await supabase.storage.from(ASSET_UPLOAD_BUCKET).list(dir, {
    search: fileName,
    limit: 5,
  });
  if (error || !data?.length) return null;

  const match = data.find((f) => f.name === fileName);
  if (!match) return null;

  const metaSize = (match.metadata as { size?: number } | undefined)?.size;
  if (typeof metaSize === 'number' && metaSize > 0) return metaSize;

  const { data: blob, error: dlError } = await supabase.storage.from(ASSET_UPLOAD_BUCKET).download(path);
  if (dlError || !blob) return null;
  return blob.size;
}

async function promotePendingObject(pendingPath: string, artistId: string): Promise<string | null> {
  const ext = pendingPath.split('.').pop() || 'bin';
  const finalPath = `${artistId}/${uuidv4()}.${ext}`;

  const { error: copyError } = await supabase.storage
    .from(ASSET_UPLOAD_BUCKET)
    .copy(pendingPath, finalPath);

  if (copyError) {
    console.error('[asset-upload/finalize] copy failed:', copyError);
    return null;
  }

  const { error: removeError } = await supabase.storage.from(ASSET_UPLOAD_BUCKET).remove([pendingPath]);
  if (removeError) {
    console.warn('[asset-upload/finalize] pending remove failed (non-critical):', removeError);
  }

  const { data: urlData } = supabase.storage.from(ASSET_UPLOAD_BUCKET).getPublicUrl(finalPath);
  return urlData.publicUrl || null;
}

export async function POST(request: NextRequest) {
  const secretCheck = requireSecret(request);
  if (secretCheck) return secretCheck;

  const proxyAuth = await verifyAssetUploadProxyAuth(request);
  if (!proxyAuth.ok) return proxyAuth.response;

  const rl = rateLimit(request, 'asset-upload-finalize', 20, 60_000);
  if (rl) return rl;

  try {
    const body = await request.json();
    const artistId = typeof body.artistId === 'string' ? body.artistId.trim() : '';
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const primaryPath = typeof body.primaryPath === 'string' ? body.primaryPath.trim() : '';
    const coverPath = typeof body.coverPath === 'string' ? body.coverPath.trim() : '';
    const primaryMime = typeof body.primaryMime === 'string' ? body.primaryMime.toLowerCase().split(';')[0].trim() : '';
    const coverMime =
      typeof body.coverMime === 'string' ? body.coverMime.toLowerCase().split(';')[0].trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const userAddress = typeof body.userAddress === 'string' ? body.userAddress.trim() : '';
    const rawDescription = typeof body.description === 'string' ? body.description : '';
    const description = rawDescription.trim().replace(/\r\n/g, '\n');
    const price = typeof body.price === 'number' ? body.price : parseFloat(String(body.price ?? ''));
    const parsedAssetNumber = Number(body.assetNumber);
    const requestedAssetNumber =
      Number.isInteger(parsedAssetNumber) && parsedAssetNumber > 0 ? parsedAssetNumber : null;
    const requireMint = body.requireMint === true;

    if (!artistId || !sessionId || !primaryPath || !primaryMime || !title || !userAddress) {
      return NextResponse.json({ error: 'Missing required finalize fields' }, { status: 400 });
    }

    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: 'price must be greater than 0' }, { status: 400 });
    }

    if (!isTrustedPendingAssetPath(primaryPath, artistId, sessionId, 'primary')) {
      return NextResponse.json({ error: 'Untrusted primary storage path' }, { status: 400 });
    }

    const isAudio = isAudioPrimaryMime(primaryMime);
    if (isAudio) {
      if (!coverPath || !coverMime) {
        return NextResponse.json(
          { error: 'Cover path and MIME are required for audio uploads' },
          { status: 400 },
        );
      }
      if (!ALLOWED_COVER_MIMES.has(coverMime)) {
        return NextResponse.json(
          { error: 'Thumbnail / Cover Art must be JPEG, PNG, or WebP' },
          { status: 400 },
        );
      }
      if (!isTrustedPendingAssetPath(coverPath, artistId, sessionId, 'cover')) {
        return NextResponse.json({ error: 'Untrusted cover storage path' }, { status: 400 });
      }
    } else if (coverPath) {
      return NextResponse.json(
        { error: 'Cover image can only be uploaded with audio files' },
        { status: 400 },
      );
    }

    const uploadDenied = await assertMagicArtistUploader(request, artistId, proxyAuth.auth);
    if (uploadDenied) return uploadDenied;

    const primarySize = await getStoredObjectSize(primaryPath);
    if (primarySize == null) {
      return NextResponse.json(
        { error: 'Primary file not found in storage — upload may have failed' },
        { status: 400 },
      );
    }

    const primaryMax = isAudio ? MAX_AUDIO_BYTES : MAX_PRIMARY_BYTES;
    if (primarySize > primaryMax) {
      return NextResponse.json({ error: 'Primary file exceeds allowed size' }, { status: 413 });
    }

    if (isAudio) {
      const coverSize = await getStoredObjectSize(coverPath);
      if (coverSize == null) {
        return NextResponse.json(
          { error: 'Cover file not found in storage — upload may have failed' },
          { status: 400 },
        );
      }
      if (coverSize > MAX_COVER_BYTES) {
        return NextResponse.json({ error: 'Cover file exceeds allowed size' }, { status: 413 });
      }
    }

    const primaryPublicUrl = await promotePendingObject(primaryPath, artistId);
    if (!primaryPublicUrl) {
      return NextResponse.json({ error: 'Failed to finalize primary file in storage' }, { status: 500 });
    }

    let coverImageUrl: string | undefined;
    if (isAudio) {
      const coverPublicUrl = await promotePendingObject(coverPath, artistId);
      if (!coverPublicUrl) {
        return NextResponse.json({ error: 'Failed to finalize cover file in storage' }, { status: 500 });
      }
      coverImageUrl = coverPublicUrl;
    }

    const { data: existingAssets, error: assetsError } = await supabase
      .from('artist_assets')
      .select('asset_number')
      .eq('artist_id', artistId)
      .order('asset_number', { ascending: false })
      .limit(1);

    if (assetsError) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const assetNumber =
      requestedAssetNumber ??
      (existingAssets && existingAssets.length > 0 ? existingAssets[0].asset_number + 1 : 1);

    const assetRecord = {
      artist_id: artistId,
      asset_number: assetNumber,
      file_url: primaryPublicUrl,
      file_type: primaryMime,
      file_size_bytes: primarySize,
      price_usd: price,
      metadata: {
        title,
        description: description || `${title} - uploaded via Zeyoda`,
        desc: description || `${title} - uploaded via Zeyoda`,
        ...(coverImageUrl ? { cover_image_url: coverImageUrl } : {}),
      },
    };

    const { data: existingTarget, error: existingTargetError } = requestedAssetNumber
      ? await supabase
          .from('artist_assets')
          .select('id, asset_number')
          .eq('artist_id', artistId)
          .eq('asset_number', assetNumber)
          .maybeSingle()
      : { data: null, error: null };

    if (existingTargetError) {
      console.error('[asset-upload/finalize] target asset lookup failed:', existingTargetError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const writeQuery = existingTarget
      ? supabase
          .from('artist_assets')
          .update(assetRecord)
          .eq('artist_id', artistId)
          .eq('asset_number', assetNumber)
          .select()
          .single()
      : supabase.from('artist_assets').insert(assetRecord).select().single();

    const { data: assetData, error: assetError } = await writeQuery;

    if (assetError) {
      console.error('[asset-upload/finalize] DB write failed:', assetError);
      return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
    }

    const mintResult = await mintArtistAssetToken({
      artistId,
      assetNumber,
      title,
      requireMint,
    });

    if (!mintResult.ok) {
      return NextResponse.json(
        {
          success: false,
          error: mintResult.error,
          details: mintResult.details,
          asset: assetData,
        },
        { status: mintResult.status },
      );
    }

    return NextResponse.json({
      success: true,
      asset: assetData,
      assetNumber,
      mintTx: mintResult.mintTx,
      explorerUrl: mintResult.explorerUrl,
      alreadyMinted: mintResult.alreadyMinted,
      message: mintResult.message,
    });
  } catch (error: unknown) {
    console.error('[asset-upload/finalize] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
