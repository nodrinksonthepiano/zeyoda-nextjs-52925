import { authenticatedFetch } from '@/app/utils/authenticatedFetch';
import { supabase } from '@/app/utils/supabaseClient';

type PrepareUploadSlot = {
  path: string;
  token: string;
  signedUrl: string;
  mime: string;
};

type PrepareResponse = {
  success?: boolean;
  sessionId?: string;
  bucket?: string;
  primary?: PrepareUploadSlot & { maxBytes?: number };
  cover?: (PrepareUploadSlot & { maxBytes?: number }) | null;
  error?: string;
};

type FinalizeResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

async function uploadFileToSignedUrl(
  bucket: string,
  path: string,
  token: string,
  file: File,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file, {
    contentType,
  });
  if (error) {
    throw new Error(error.message || 'Direct storage upload failed');
  }
}

export async function uploadArtistAssetDirect(params: {
  getDidToken: () => Promise<string | null>;
  artistId: string;
  userAddress: string;
  primaryFile: File;
  coverFile?: File | null;
  title: string;
  price: number;
  description: string;
  assetNumber?: number;
  requireMint?: boolean;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const {
    getDidToken,
    artistId,
    userAddress,
    primaryFile,
    coverFile,
    title,
    price,
    description,
    assetNumber,
    requireMint,
  } = params;

  const primaryMime = (primaryFile.type || 'application/octet-stream').toLowerCase().split(';')[0].trim();
  const isAudio = primaryMime.startsWith('audio/');

  const prepareRes = await authenticatedFetch(
    '/api/public/asset-upload/prepare',
    {
      method: 'POST',
      body: JSON.stringify({
        artistId,
        primary: {
          mime: primaryMime,
          size: primaryFile.size,
          fileName: primaryFile.name,
        },
        cover:
          isAudio && coverFile
            ? {
                mime: (coverFile.type || '').toLowerCase().split(';')[0].trim(),
                size: coverFile.size,
                fileName: coverFile.name,
              }
            : undefined,
      }),
    },
    getDidToken,
  );

  const prepareJson = (await prepareRes.json().catch(() => ({}))) as PrepareResponse;
  if (!prepareRes.ok || !prepareJson.sessionId || !prepareJson.primary) {
    return {
      ok: false,
      error: prepareJson.error || 'Could not prepare asset upload',
    };
  }

  const bucket = prepareJson.bucket || 'artist-assets';

  await uploadFileToSignedUrl(
    bucket,
    prepareJson.primary.path,
    prepareJson.primary.token,
    primaryFile,
    primaryMime,
  );

  if (isAudio) {
    if (!coverFile || !prepareJson.cover) {
      return { ok: false, error: 'Cover upload info missing from prepare response' };
    }
    const coverMime = (coverFile.type || '').toLowerCase().split(';')[0].trim();
    await uploadFileToSignedUrl(
      bucket,
      prepareJson.cover.path,
      prepareJson.cover.token,
      coverFile,
      coverMime,
    );
  }

  const finalizeRes = await authenticatedFetch(
    '/api/public/asset-upload/finalize',
    {
      method: 'POST',
      body: JSON.stringify({
        artistId,
        sessionId: prepareJson.sessionId,
        primaryPath: prepareJson.primary.path,
        primaryMime,
        coverPath: prepareJson.cover?.path || '',
        coverMime: coverFile ? (coverFile.type || '').toLowerCase().split(';')[0].trim() : '',
        title,
        price,
        description,
        userAddress,
        ...(assetNumber != null ? { assetNumber } : {}),
        ...(requireMint === true ? { requireMint: true } : {}),
      }),
    },
    getDidToken,
  );

  const finalizeJson = (await finalizeRes.json().catch(() => ({}))) as FinalizeResponse;
  if (!finalizeRes.ok || finalizeJson.success === false) {
    return {
      ok: false,
      error: finalizeJson.error || 'Could not finalize asset upload',
    };
  }

  return {
    ok: true,
    message: finalizeJson.message || 'Asset uploaded successfully',
  };
}
