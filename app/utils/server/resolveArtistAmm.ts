import type { SupabaseClient } from '@supabase/supabase-js';

/** Minimal ABI for reading pool state — shared by artist-earnings, lp/quote, lp/withdraw */
export const AMM_GET_POOL_ABI = [
  'function getPool(address token) view returns (tuple(address token, uint256 tokenReserve, uint256 ethReserve, bool active))',
] as const;

export type ResolveArtistAmmResult =
  | { ok: true; tokenAddress: string; swapAddress: string }
  | { ok: false; error: string };

/**
 * Resolve the canonical (token, swap) pair for LP reads.
 * Prefer `artists.contract` + `artists.swap_address`, then `artist_registry.token` + `artist_registry.swap`.
 */
export async function resolveArtistAmmPool(
  supabase: SupabaseClient,
  artistId: string
): Promise<ResolveArtistAmmResult> {
  const id = artistId?.trim();
  if (!id) {
    return { ok: false, error: 'artistId required' };
  }

  const { data: artistRow, error: artistErr } = await supabase
    .from('artists')
    .select('contract, swap_address')
    .eq('id', id)
    .maybeSingle();

  if (artistErr) {
    console.warn('[resolveArtistAmmPool] artists lookup:', artistErr.message);
  }

  const tokenFromArtist = (artistRow?.contract as string | null | undefined)?.trim();
  const swapFromArtist = (artistRow?.swap_address as string | null | undefined)?.trim();
  if (tokenFromArtist && swapFromArtist) {
    return { ok: true, tokenAddress: tokenFromArtist, swapAddress: swapFromArtist };
  }

  const { data: regRow, error: regErr } = await supabase
    .from('artist_registry')
    .select('token, swap')
    .eq('id', id)
    .maybeSingle();

  if (regErr) {
    console.warn('[resolveArtistAmmPool] artist_registry lookup:', regErr.message);
  }

  const token = (regRow?.token as string | null | undefined)?.trim();
  const swap = (regRow?.swap as string | null | undefined)?.trim();
  if (token && swap) {
    return { ok: true, tokenAddress: token, swapAddress: swap };
  }

  return {
    ok: false,
    error: 'Token and swap addresses not configured for this artist',
  };
}

/** Prefer server RPC env so LP reads align with guarded withdraw when both are set */
export function getBaseSepoliaReadRpcUrl(): string | undefined {
  return process.env.SERVER_BASE_SEPOLIA_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
}
