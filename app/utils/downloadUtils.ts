import { ArtistConfig } from '../../types/artist-types';

/**
 * Resolved download price from featured asset row. No default — unknown returns null so UI cannot silently show $5.
 */
export const getDownloadPrice = (featuredAsset?: any): number | null => {
  const price = featuredAsset?.price_usd;
  if (typeof price === 'number' && price > 0) {
    return price;
  }
  return null;
};

/**
 * Check if download is available for purchase
 * @param artistConfig - The artist configuration object
 * @param user - The user address
 * @param hasExistingAccess - Whether user already owns the download (ignored - users can purchase multiple times)
 * @returns Whether download can be purchased
 */
export const isDownloadAvailable = (
  artistConfig: ArtistConfig | null,
  user: string | null,
  hasExistingAccess: boolean
): boolean => {
  return !!(artistConfig && user);
};

/**
 * Format download price for display
 * @param featuredAsset - The featured asset object with price_usd property
 * @returns Formatted price string (e.g., "$5.00")
 */
export const formatDownloadPrice = (featuredAsset?: any): string => {
  const p = getDownloadPrice(featuredAsset);
  return p == null ? '—' : `$${p.toFixed(2)}`;
};

/**
 * Create download mint request payload
 * @param artistConfig - The artist configuration object
 * @param userAddress - The user's wallet address
 * @param swapTxHash - The swap transaction hash
 * @returns Request payload for /api/mintDownload
 */
export const createDownloadMintPayload = (
  artistConfig: ArtistConfig,
  userAddress: string,
  swapTxHash: string,
  downloadPriceUsd: number
) => {
  return {
    artistId: artistConfig.name?.toLowerCase() || '',
    userAddress,
    assetId: 1, // Featured asset is always #1
    txHash: swapTxHash,
    amount: 1,
    downloadPrice: downloadPriceUsd,
  };
}; 