import { NextRequest, NextResponse } from 'next/server';
import { getMagicAuthFromBearer, type MagicBearerAuth } from '@/app/utils/server/magicBearerEmail';
import { normalizeReservedEmail } from '@/app/utils/server/normalizeReservedEmail';

export type AssetUploadProxyAuth =
  | { ok: true; verifiedEmail: string; auth: MagicBearerAuth }
  | { ok: false; response: NextResponse };

export async function verifyAssetUploadProxyAuth(
  request: NextRequest,
): Promise<AssetUploadProxyAuth> {
  const verifiedEmail = (request.headers.get('x-verified-email') ?? '').trim();
  if (!verifiedEmail) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Missing x-verified-email', message: 'Internal proxy must forward verified email' },
        { status: 400 },
      ),
    };
  }

  const auth = await getMagicAuthFromBearer(request);
  if (!auth) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Authentication required', message: 'Valid Magic DID token required' },
        { status: 401 },
      ),
    };
  }

  const bearerIdentity = auth.email?.trim() || auth.issuer?.trim();
  if (!bearerIdentity) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Magic session lacks email or issuer — cannot bind to proxy',
        },
        { status: 401 },
      ),
    };
  }

  if (normalizeReservedEmail(bearerIdentity) !== normalizeReservedEmail(verifiedEmail)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Identity mismatch', message: 'Token identity does not match verified proxy caller' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, verifiedEmail, auth };
}
