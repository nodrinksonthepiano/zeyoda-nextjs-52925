import { useMemo } from 'react';
import { ArtistConfig } from '../../types/artist-types';

export interface OrbitToken {
  symbol: string;
  displayName: string;
  img: string;
  balance: bigint;
  artistId: string;
}

interface UseOrbitTokensOptions {
  includeUnowned?: boolean;
}

export function useOrbitTokens(
  userTokenBalances: { [key: string]: bigint },
  allArtistsConfig: { [key: string]: ArtistConfig } | null,
  options: UseOrbitTokensOptions = {}
): OrbitToken[] {
  const { includeUnowned = false } = options;

  return useMemo(() => {
    if (!allArtistsConfig || Object.keys(allArtistsConfig).length === 0) {
      console.warn('[useOrbitTokens] No artist config available');
      return [];
    }

    const orbitTokens: OrbitToken[] = [];
    const processedSymbols = new Set<string>();

    // Process user's token balances first (owned tokens)
    for (const [tokenSymbol, balance] of Object.entries(userTokenBalances)) {
      // Find artist config by token symbol
      const artist = Object.values(allArtistsConfig).find(a => a.tokenName === tokenSymbol);
      
      if (artist) {
        orbitTokens.push({
          symbol: tokenSymbol,
          displayName: artist.displayName,
          img: artist.videoSrc, // Using videoSrc as img for now
          balance,
          artistId: artist.name // Using name as artistId
        });
        processedSymbols.add(tokenSymbol);
      } else {
        // Log warning for missing token mapping
        console.warn(`useOrbitTokens: No artist config found for token symbol "${tokenSymbol}"`);
      }
    }

    // Add all other artists' tokens with zero balance (for unowned tokens)
    // Only if includeUnowned is true
    if (includeUnowned) {
      for (const artist of Object.values(allArtistsConfig)) {
        if (!processedSymbols.has(artist.tokenName)) {
          orbitTokens.push({
            symbol: artist.tokenName,
            displayName: artist.displayName,
            img: artist.videoSrc, // Using videoSrc as img for now
            balance: 0n,
            artistId: artist.name // Using name as artistId
          });
        }
      }
    }

    // Sort deterministically by displayName for consistent ordering
    const sortedTokens = orbitTokens.sort((a, b) => a.displayName.localeCompare(b.displayName));

    // Debug logging
    if (sortedTokens.length === 0) {
      console.warn('⚠️ orbitTokens empty – check artist config or wallet balances');
    }

    return sortedTokens;
  }, [userTokenBalances, allArtistsConfig, includeUnowned]);
} 