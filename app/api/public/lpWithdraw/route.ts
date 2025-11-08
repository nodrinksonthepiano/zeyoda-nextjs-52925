import { NextRequest, NextResponse } from 'next/server';

/**
 * Public proxy for /api/lp/withdraw
 * Adds x-internal-secret header server-side before forwarding to internal route
 */
export async function POST(request: NextRequest) {
  try {
    // Get origin from request (works in dev and prod)
    const origin = request.headers.get('x-forwarded-origin') || new URL(request.url).origin;
    
    // Preserve raw body
    const body = await request.text();
    
    // Forward request to internal route with secret header
    const secret = process.env.INTERNAL_API_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Server misconfigured: INTERNAL_API_SECRET missing' },
        { status: 500 }
      );
    }
    
    // Preserve x-wallet-address header if present (needed for lp/withdraw auth)
    const walletAddress = request.headers.get('x-wallet-address');
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-internal-secret': secret, // Always overwrite, never trust client
    };
    if (walletAddress) {
      headers['x-wallet-address'] = walletAddress;
    }
    
    const response = await fetch(`${origin}/api/lp/withdraw`, {
      method: 'POST',
      headers,
      body, // Use raw body text
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

