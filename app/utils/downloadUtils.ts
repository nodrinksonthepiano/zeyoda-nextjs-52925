import { ArtistConfig } from '../../types/artist-types';

/**
 * Get the download price for an artist's featured asset
 * @param featuredAsset - The featured asset object with price_usd property
 * @returns The download price in USD (defaults to $5)
 */
export const getDownloadPrice = (featuredAsset?: any): number => {
  // Ensure price_usd is a number, default to 5 if missing/null/undefined
  const price = featuredAsset?.price_usd;
  if (typeof price === 'number' && price >= 0) {
    return price;
  }
  return 5; // Default to $5 instead of $1
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
  return `$${getDownloadPrice(featuredAsset).toFixed(2)}`;
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
  swapTxHash: string
) => {
  return {
    artistId: artistConfig.name?.toLowerCase() || '',
    userAddress,
    assetId: 1, // Featured asset is always #1
    txHash: swapTxHash,
    amount: 1,
    downloadPrice: getDownloadPrice(artistConfig) // Include price for server logs
  };
}; 