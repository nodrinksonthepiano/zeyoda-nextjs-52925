'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useArtistRegistryContext } from '../contexts/ArtistRegistryContext';
import { getArtistContracts as getFallbackArtistContracts } from '../utils/addressRegistryFallback';
import { supabase } from '../utils/supabaseClient';
import { SwapService } from '../utils/swapUtils';
import { ethers } from 'ethers';
import { ArtistConfig, ArtistDatabaseEntry } from '../../types/artist-types';

interface UseArtistConfigReturn {
  artistConfig: ArtistConfig | null;
  allArtistsConfig: { [key: string]: ArtistConfig } | null;
  isLoading: boolean;
  error: string | null;
  refreshPrices: () => Promise<void>;
}

const useArtistConfig = (): UseArtistConfigReturn => {
  const { registry, isLoading: isRegistryLoading, error: registryError } = useArtistRegistryContext();
  const searchParams = useSearchParams();
  const artistId = searchParams.get('artist');

  const [artistConfig, setArtistConfig] = useState<ArtistConfig | null>(null);
  const [allArtistsConfig, setAllArtistsConfig] = useState<{[key: string]: ArtistConfig} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real-time prices for all artists
  const fetchRealTimePrices = async (artistsData: {[key: string]: ArtistConfig}) => {
    try {
      // Create a dummy signer for read-only operations
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC!);
      const swapService = new SwapService(provider);

      const updatedArtists = { ...artistsData };

      for (const [artistId, config] of Object.entries(updatedArtists)) {
        if (config.contract) {
          try {
            const hasLiquidityPool = await swapService.hasLiquidityPool(config.contract);
            const realTimePrice = hasLiquidityPool ? 
              await swapService.getTokenPriceInUSD(config.contract) : 
              config.tokenPrice;
            
            updatedArtists[artistId] = {
              ...config,
              hasLiquidityPool,
              realTimePrice: realTimePrice || config.tokenPrice
            };
          } catch (e) {
            console.warn(`Failed to fetch price for ${artistId}:`, e);
          }
        }
      }

      return updatedArtists;
    } catch (e) {
      console.error('Failed to fetch real-time prices:', e);
      return artistsData;
    }
  };

  const refreshPrices = async () => {
    if (!allArtistsConfig) return;
    
    console.log('🔄 Refreshing real-time prices...');
    const updatedArtists = await fetchRealTimePrices(allArtistsConfig);
    setAllArtistsConfig(updatedArtists);
    
    // Update current artist config if it exists
    if (artistId && updatedArtists[artistId]) {
      setArtistConfig(updatedArtists[artistId]);
    }
  };

  useEffect(() => {
    const fetchConfig = async () => {
      if (isRegistryLoading) {
        // Wait until the registry is loaded, errored, or has a fallback
        return;
      }
      
      setIsLoading(true);
      setError(null);

      try {
        // Fetch base artist data from the artists table
        const { data: artistsData, error: dbError } = await supabase
          .from('artists')
          .select('*');
        
        if (dbError) throw dbError;

        // The registry from context is the primary source of truth for contract addresses
        const currentRegistry = registry;
        if (!currentRegistry) {
          throw new Error("Artist registry is not available, and fallback failed.");
        }

        const combinedConfigs: {[key: string]: ArtistConfig} = {};

        for (const artistData of artistsData as ArtistDatabaseEntry[]) {
          const contracts = currentRegistry[artistData.id] || getFallbackArtistContracts(artistData.id);
          
          if (contracts) {
            combinedConfigs[artistData.id] = {
              name: artistData.name,
              displayName: artistData.display_name,
              tokenName: artistData.token_name,
              artworkTitle: artistData.artwork_title,
              artworkYear: artistData.artwork_year,
              tokenPrice: artistData.token_price,
              videoSrc: artistData.video_src,
              contract: contracts.token,
              swap: contracts.swap,
              downloads: contracts.downloads || undefined,
              treasury_wallet: contracts.treasury_wallet || undefined,
              theme: {
                primaryColor: artistData.primary_color,
                accentColor: artistData.accent_color,
                gradientStart: artistData.gradient_start,
                gradientMiddle: artistData.gradient_middle,
                gradientEnd: artistData.gradient_end,
                fontFamily: artistData.font_family,
              },
              orbitalTokens: artistData.orbital_tokens,
            };
          }
        }
        
        // Fetch real-time prices
        const configsWithPrices = await fetchRealTimePrices(combinedConfigs);
        setAllArtistsConfig(configsWithPrices);

        if (artistId && configsWithPrices[artistId]) {
          setArtistConfig(configsWithPrices[artistId]);
        } else if (artistId) {
          setError(`Configuration for artist "${artistId}" not found.`);
        }

      } catch (e: any) {
        console.error("Failed to fetch artist configurations:", e);
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, [artistId, isRegistryLoading, registry]); // Rerun when artist changes or registry loads

  // Auto-refresh prices every 60 seconds
  useEffect(() => {
    if (!allArtistsConfig) return;

    const interval = setInterval(() => {
      console.log('⏰ Auto-refreshing prices...');
      refreshPrices();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [allArtistsConfig, artistId]);

  return { artistConfig, allArtistsConfig, isLoading: isLoading || isRegistryLoading, error, refreshPrices };
};

export default useArtistConfig; 