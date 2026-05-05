import { NextRequest } from 'next/server';
import { Magic } from '@magic-sdk/admin';

const magicSecretKey = process.env.MAGIC_SECRET_KEY;
if (!magicSecretKey) {
  throw new Error('MAGIC_SECRET_KEY environment variable is required');
}

const magicAdmin = new Magic(magicSecretKey);

/**
 * Validates Authorization Bearer DID token and returns the user's email (lowercased).
 * Does not check whitelist — used where invite/admin logic replaces whitelist gates.
 */
export async function getMagicEmailFromBearer(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const didToken = authHeader.substring(7).trim();
  if (!didToken) return null;

  try {
    await magicAdmin.token.validate(didToken);
    const userMetadata = await magicAdmin.users.getMetadataByToken(didToken);
    if (!userMetadata) return null;
    const raw = userMetadata.email || userMetadata.issuer;
    if (!raw || typeof raw !== 'string') return null;
    return raw.trim().toLowerCase();
  } catch {
    return null;
  }
}
