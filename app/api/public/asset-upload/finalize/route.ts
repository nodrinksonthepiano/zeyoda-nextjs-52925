import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelist } from '@/app/utils/server/whitelistCheck';

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
    const body = await request.text();
    const secret = process.env.INTERNAL_API_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Server misconfigured: INTERNAL_API_SECRET missing' },
        { status: 500 },
      );
    }

    const authorization = request.headers.get('authorization');
    const forwardHeaders: Record<string, string> = {
      'content-type': 'application/json',
      'x-internal-secret': secret,
      'x-verified-email': whitelistResult.email!,
    };
    if (authorization) {
      forwardHeaders.authorization = authorization;
    }

    const response = await fetch(`${origin}/api/asset-upload/finalize`, {
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
    console.error('[public/asset-upload/finalize] proxy error:', error);
    return NextResponse.json(
      {
        error: 'Proxy request failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
