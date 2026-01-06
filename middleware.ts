import { NextRequest, NextResponse } from 'next/server';
import { verifyWhitelist } from './app/utils/server/whitelistCheck';

/**
 * Next.js Middleware - Security Guard
 * 
 * Intercepts ALL API requests and verifies:
 * 1. Valid Magic DID token
 * 2. Email is whitelisted
 * 
 * Runs BEFORE route handlers execute.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only process API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Public routes that don't require authentication
  const publicRoutes = [
    '/api/_health',           // Health check endpoint
    '/api/checkWhitelist',   // Needed for login flow
  ];

  // Check if this is a public route
  if (publicRoutes.includes(pathname)) {
    console.log(`✅ Public route accessed: ${pathname}`);
    return NextResponse.next();
  }

  // Special case: /api/registry GET is public (read-only)
  if (pathname === '/api/registry' && request.method === 'GET') {
    console.log(`✅ Public GET route accessed: ${pathname}`);
    return NextResponse.next();
  }

  // All other API routes require authentication + whitelist
  console.log(`🛡️ Middleware intercepting: ${pathname} (${request.method})`);

  // Verify Magic token and whitelist status
  const whitelistResult = await verifyWhitelist(request);

  if (!whitelistResult.verified) {
    console.log(`❌ Request blocked: ${whitelistResult.error || 'Not verified'}`);
    
    // Return appropriate status code
    const statusCode = whitelistResult.email === null ? 401 : 403;
    const errorMessage = whitelistResult.error || 'Unauthorized';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        message: statusCode === 401 
          ? 'Authentication required' 
          : 'Access denied - not whitelisted'
      },
      { status: statusCode }
    );
  }

  // Request is verified and whitelisted - allow through
  console.log(`✅ Request allowed for whitelisted user: ${whitelistResult.email}`);

  // Add verified email to request headers for route handlers to use
  const response = NextResponse.next();
  response.headers.set('x-verified-email', whitelistResult.email!);
  
  return response;
}

/**
 * Configure which routes the middleware runs on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

