import { ethers } from 'ethers';

/** Must match `UupsAMM.ARTIST_CASHOUT_MIN_ETH_WEI` (0.005 ether). */
export const ARTIST_CASHOUT_FLOOR_WEI = 5_000_000_000_000_000n;

export function ethWeiSurplusAboveFloor(ethReserveWei: bigint): bigint {
  return ethReserveWei > ARTIST_CASHOUT_FLOOR_WEI ? ethReserveWei - ARTIST_CASHOUT_FLOOR_WEI : 0n;
}

/** Gross USD label for ETH skim above floor (fixed-rate UI); settlement is ETH on-chain. */
export function surplusEthUsd(ethReserveWei: bigint, ethUsdRate: number): number {
  const surplusWei = ethWeiSurplusAboveFloor(ethReserveWei);
  const surplusEth = Number(ethers.formatEther(surplusWei));
  if (!Number.isFinite(surplusEth) || !(surplusEth > 0)) return 0;
  return surplusEth * ethUsdRate;
}

/**
 * Basis-point slice of surplus wei (percent 1–100, same rounding as withdraw route).
 */
export function surplusWeiForWithdrawPercent(surplusWei: bigint, percent: number): bigint {
  const clampedPercent = Math.max(1, Math.min(100, Math.round(percent * 10) / 10));
  const bps = Math.round(clampedPercent * 100); // 100.0% → 10000
  return (surplusWei * BigInt(bps)) / 10000n;
}
