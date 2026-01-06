import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelist } from '../../utils/server/whitelistCheck';

/**
 * Public proxy for /api/uploadAsset
 * Adds x-internal-secret header server-side before forwarding to internal route
 * 
 * NOTE: This route is also protected by middleware, but we add whitelist check here
 * as defense-in-depth to ensure no bypass routes exist.
 */
export async function POST(request: NextRequest) {
  // First: Check whitelist (defense-in-depth)
  const whitelistResult = await verifyWhitelist(request);
  if (!whitelistResult.verified) {
    console.log(`❌ Public route blocked: ${whitelistResult.error || 'Not whitelisted'}`);
    return NextResponse.json(
      { 
        error: whitelistResult.error || 'Unauthorized',
        message: 'Access denied - whitelist required'
      },
      { status: whitelistResult.email === null ? 401 : 403 }
    );
  }

  try {
    // Get origin from request (works in dev and prod)
    const origin = request.headers.get('x-forwarded-origin') || new URL(request.url).origin;
    
    // Preserve raw body as ArrayBuffer (FormData needs binary data, not text)
    const body = await request.arrayBuffer();
    
    // Forward request to internal route with secret header
    const secret = process.env.INTERNAL_API_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Server misconfigured: INTERNAL_API_SECRET missing' },
        { status: 500 }
      );
    }
    
    // Get content-type from original request (needed for FormData boundary)
    const contentType = request.headers.get('content-type') || 'application/json';
    
    const response = await fetch(`${origin}/api/uploadAsset`, {
      method: 'POST',
      headers: {
        'content-type': contentType, // Preserve multipart/form-data boundary
        'x-internal-secret': secret, // Always overwrite, never trust client
        'x-verified-email': whitelistResult.email!, // Pass verified email to internal route
      },
      body: body, // Use ArrayBuffer to preserve FormData structure
    });
    
    // Pass through response
    const responseText = await response.text();
    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
      },
    });
    
  } catch (error: any) {
    console.error('❌ Proxy error:', error);
    return NextResponse.json(
      { error: 'Proxy request failed', details: error.message },
      { status: 500 }
    );
  }
}

