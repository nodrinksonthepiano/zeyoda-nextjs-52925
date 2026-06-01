import { NextRequest, NextResponse } from 'next/server';
import { assertMagicArtistUploader } from '@/app/utils/server/assertMagicArtistUploader';
import { getMagicAuthFromBearer } from '@/app/utils/server/magicBearerEmail';

/**
 * Public proxy for /api/uploadAsset.
 * Scoped auth: admin, treasury wallet, or claimed invite launcher for this artistId.
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || 'application/json';
  const body = await request.arrayBuffer();

  let artistId = '';
  try {
    if (contentType.includes('application/json')) {
      const parsed = JSON.parse(new TextDecoder().decode(body)) as { artistId?: unknown };
      artistId = typeof parsed.artistId === 'string' ? parsed.artistId.trim() : '';
    } else if (contentType.includes('multipart/form-data')) {
      const formRequest = new Request(request.url, {
        method: 'POST',
        headers: { 'content-type': contentType },
        body: body.slice(0),
      });
      const formData = await formRequest.formData();
      artistId = ((formData.get('artistId') as string | null) ?? '').trim();
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
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
  if (uploadDenied) {
    console.log(`❌ Public uploadAsset blocked for artistId=${artistId}`);
    return uploadDenied;
  }

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
      return NextResponse.json(
        { error: 'Server misconfigured: INTERNAL_API_SECRET missing' },
        { status: 500 },
      );
    }

    const authorization = request.headers.get('authorization');
    const forwardHeaders: Record<string, string> = {
      'content-type': contentType,
      'x-internal-secret': secret,
      'x-verified-email': verifiedEmail,
    };
    if (authorization) {
      forwardHeaders.authorization = authorization;
    }

    const response = await fetch(`${origin}/api/uploadAsset`, {
      method: 'POST',
      headers: forwardHeaders,
      body,
    });

    const responseText = await response.text();
    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error: unknown) {
    console.error('❌ Proxy error:', error);
    return NextResponse.json(
      {
        error: 'Proxy request failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
