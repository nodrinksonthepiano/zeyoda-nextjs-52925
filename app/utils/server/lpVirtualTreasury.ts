import type { SupabaseClient } from '@supabase/supabase-js';

export const LP_WITHDRAWAL_REASON = 'LP_WITHDRAWAL' as const;

/** Sum ledger LP exits for mock remaining-LP math (same convention as `error_reason` on insert). */
export async function sumVirtualLpWithdrawnUsd(
  supabase: SupabaseClient,
  artistId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('artist_earnings')
    .select('net_earnings_usd')
    .eq('artist_id', artistId)
    .eq('error_reason', LP_WITHDRAWAL_REASON);

  if (error) {
    console.error('[sumVirtualLpWithdrawnUsd]', error.message);
    return 0;
  }

  let sum = 0;
  for (const row of data ?? []) {
    sum += parseFloat(String(row.net_earnings_usd ?? 0)) || 0;
  }
  return sum;
}

export function remainingLpWithdrawableUsd(
  onChainLpWithdrawableUsd: number,
  virtualWithdrawnUsd: number
): number {
  const r = onChainLpWithdrawableUsd - virtualWithdrawnUsd;
  return r > 0 ? r : 0;
}

/** Same USD math as lp/quote / artist-earnings (99.7% of pool, $2500/ETH). */
export function poolReservesToOnChainLpWithdrawableUsd(
  ethReserve: number,
  tokenReserve: number,
  ethUsdRate = 2500
): number {
  if (!(tokenReserve > 0) || !Number.isFinite(ethReserve) || !Number.isFinite(tokenReserve)) {
    return 0;
  }
  const tokenPriceUsd = (ethReserve / tokenReserve) * ethUsdRate;
  const totalPoolUsd = ethReserve * ethUsdRate + tokenReserve * tokenPriceUsd;
  return totalPoolUsd * 0.997;
}
