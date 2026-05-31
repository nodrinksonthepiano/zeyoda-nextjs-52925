import { supabase } from '@/app/utils/supabaseClient';

type PrepareResponse = {
  success?: boolean;
  bucket?: string;
  path?: string;
  token?: string;
  signedUrl?: string;
  url?: string;
  error?: string;
};

/**
 * Admin treasure draft: upload featured media (especially audio) directly to Supabase.
 * Avoids sending large binaries through Vercel FormData on /api/invite/draft-upload.
 */
export async function uploadTreasureDraftFeaturedDirect(params: {
  getDidToken: () => Promise<string | null>;
  coinPublicId: string;
  file: File;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { getDidToken, coinPublicId, file } = params;

  const token = await getDidToken();
  if (!token) return { ok: false, error: 'Sign in required for draft upload.' };

  const mime = (file.type || 'application/octet-stream').toLowerCase().split(';')[0].trim();

  let prepareRes: Response;
  try {
    prepareRes = await fetch('/api/invite/draft-upload/prepare', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coin_public_id: coinPublicId,
        mime,
        size: file.size,
        fileName: file.name,
      }),
    });
  } catch {
    return { ok: false, error: 'Could not prepare draft upload.' };
  }

  const prepareJson = (await prepareRes.json().catch(() => ({}))) as PrepareResponse;
  if (!prepareRes.ok || !prepareJson.path || !prepareJson.token) {
    return {
      ok: false,
      error: prepareJson.error || 'Could not prepare draft upload.',
    };
  }

  const bucket = prepareJson.bucket || 'artist-assets';
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(prepareJson.path, prepareJson.token, file, { contentType: mime });

  if (uploadError) {
    return { ok: false, error: uploadError.message || 'Direct storage upload failed.' };
  }

  const url = typeof prepareJson.url === 'string' ? prepareJson.url : '';
  if (!url.startsWith('https://')) {
    return { ok: false, error: 'Upload did not return an HTTPS URL.' };
  }

  return { ok: true, url };
}
