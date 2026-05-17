import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware - Lightweight Security Guard (Edge Runtime Compatible)
 * 
 * Intercepts:
 * - Requests to `/create` → redirect `/` (legacy route disabled).
 * - API routes: Bearer token OR internal secret (first-line guard; APIs verify Magic in Node).
 *
 * Runs BEFORE route handlers execute.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Legacy /create shipped historical protocol vault defaults — block direct URL navigation
  if (pathname === '/create' || pathname === '/create/') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Only process API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Public routes that don't require authentication
  const publicRoutes = [
    '/api/_health',           // Health check endpoint
    '/api/checkWhitelist',   // Needed for login flow
    '/api/invite/resolve',
    '/api/treasure-interest',
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

  // All other API routes require authentication token OR internal secret
  console.log(`🛡️ Middleware intercepting: ${pathname} (${request.method})`);

  // Check for internal secret header (for server-to-server/internal routes)
  const internalSecret = request.headers.get('x-internal-secret');
  const expectedSecret = process.env.INTERNAL_API_SECRET;
  
  if (internalSecret && expectedSecret && internalSecret === expectedSecret) {
    console.log(`✅ Internal route accessed with secret header`);
    return NextResponse.next();
  }

  // Check for Authorization header with Bearer token (for client requests)
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`❌ Request blocked: No Authorization header or internal secret`);
    return NextResponse.json(
      { 
        error: 'No token provided',
        message: 'Authentication required - please log in'
      },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix
  
  if (!token || token.trim().length === 0) {
    console.log(`❌ Request blocked: Empty token`);
    return NextResponse.json(
      { 
        error: 'Empty token',
        message: 'Authentication required - please log in'
      },
      { status: 401 }
    );
  }

  // Token format is valid - allow through
  // Actual Magic token verification happens in API routes (Node.js runtime)
  console.log(`✅ Token present, forwarding to route handler for verification`);
  
  return NextResponse.next();
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

