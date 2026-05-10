import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelist } from '@/app/utils/server/whitelistCheck';

/**
 * Public proxy for /api/uploadFeatured — copies HTTPS draft media into artist-assets for videosrc.
 */
export async function POST(request: NextRequest) {
  const whitelistResult = await verifyWhitelist(request);
  if (!whitelistResult.verified) {
    return NextResponse.json(
      {
        error: whitelistResult.error || 'Unauthorized',
        message: 'Access denied - whitelist required',
      },
      { status: whitelistResult.email === null ? 401 : 403 },
    );
  }

  try {
    const origin = request.headers.get('x-forwarded-origin') || new URL(request.url).origin;
    const bodyText = await request.text();
    const secret = process.env.INTERNAL_API_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Server misconfigured: INTERNAL_API_SECRET missing' }, { status: 500 });
    }

    const response = await fetch(`${origin}/api/uploadFeatured`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-secret': secret,
        'x-verified-email': whitelistResult.email!,
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
