// app/utils/apiGuard.ts

import { NextRequest, NextResponse } from 'next/server';

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Requires a secret header to be present for write operations.
 * Returns null if authorized, or a 401 Response if not.
 */
export function requireSecret(req: NextRequest) {
  const expected = process.env.INTERNAL_API_SECRET;
  const got = req.headers.get('x-internal-secret') ?? '';
  
  console.error('[GUARD] requireSecret called');
  console.error('[GUARD] Expected secret exists:', !!expected);
  console.error('[GUARD] Got header:', !!got);
  console.error('[GUARD] Match:', got === expected);
  
  // Fail-closed: Block if secret is not configured
  if (!expected) {
    console.error('[GUARD] BLOCKING: Secret not configured');
    return NextResponse.json(
      { error: 'Server misconfigured: INTERNAL_API_SECRET missing' },
      { status: 500 }
    );
  }
  
  // Block if header doesn't match
  if (got !== expected) {
    console.error('[GUARD] BLOCKING: Header mismatch or missing');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  console.error('[GUARD] ALLOWING: Secret matches');
  return null; // ok
}

/**
 * Rate limits requests per IP address.
 * Returns null if under limit, or a 429 Response if exceeded.
 * @param req - The NextRequest object
 * @param key - Unique key for this route (e.g., 'purchase-1155')
 * @param limit - Maximum requests per window (default: 10)
 * @param windowMs - Time window in milliseconds (default: 60 seconds)
 */
export function rateLimit(req: NextRequest, key: string, limit = 10, windowMs = 60_000) {
  const id =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'local';
  const bucketKey = `${key}:${id}`;
  const now = Date.now();
  const bucket = buckets.get(bucketKey);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return null; // ok
  }

  if (bucket.count >= limit) {
    const retry = Math.max(0, bucket.resetAt - now);
    return NextResponse.json(
      { error: 'Too many requests', retryAfterMs: retry },
      { status: 429 }
    );
  }

  bucket.count += 1;
  return null; // ok
}

/**
 * Minimal logging: only in dev, and never print secrets
 */
export function logInfo(...args: unknown[]) {
  if (process.env.NODE_ENV !== 'production') console.log(...args);
}

export function logError(...args: unknown[]) {
  console.error(...args);
}
