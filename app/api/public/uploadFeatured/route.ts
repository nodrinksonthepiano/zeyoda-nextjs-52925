import { NextRequest, NextResponse } from 'next/server';
import { assertMagicArtistUploader } from '@/app/utils/server/assertMagicArtistUploader';
import { getMagicAuthFromBearer } from '@/app/utils/server/magicBearerEmail';

/**
 * Public proxy for /api/uploadFeatured — copies HTTPS draft media into artist-assets for videosrc.
 * Scoped auth: admin, treasury wallet, or claimed invite launcher for this artistId.
 */
export async function POST(request: NextRequest) {
  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  let artistId = '';
  try {
    const parsed = JSON.parse(bodyText) as { artistId?: unknown };
    artistId = typeof parsed.artistId === 'string' ? parsed.artistId.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!artistId) {
    return NextResponse.json({ error: 'artistId required' }, { status: 400 });
  }

  const auth = await getMagicAuthFromBearer(request);
  if (!auth) {
    return NextResponse.json(
      { error: 'Authentication required', message: 'Valid Magic DID token required' },
      { status: 401 },
    );
  }

  const uploadDenied = await assertMagicArtistUploader(request, artistId, auth);
  if (uploadDenied) return uploadDenied;

  const verifiedEmail = auth.email || auth.issuer;
  if (!verifiedEmail) {
    return NextResponse.json(
      {
        error: 'Authentication required',
        message: 'Magic session lacks email or issuer — cannot bind to proxy',
      },
      { status: 401 },
    );
  }

  try {
    const origin = request.headers.get('x-forwarded-origin') || new URL(request.url).origin;
    const secret = process.env.INTERNAL_API_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Server misconfigured: INTERNAL_API_SECRET missing' }, { status: 500 });
    }

    const response = await fetch(`${origin}/api/uploadFeatured`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-secret': secret,
        'x-verified-email': verifiedEmail,
      },
      body: bodyText,
    });

    const responseText = await response.text();
    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error: unknown) {
    console.error('uploadFeatured proxy error:', error);
    return NextResponse.json(
      { error: 'Proxy request failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
