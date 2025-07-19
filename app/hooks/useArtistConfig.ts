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
        console.log('🔍 [useArtistConfig] Fetching artist data from Supabase...');
        const { data: artistsData, error: dbError } = await supabase
          .from('artists')
          .select('*');
        
        console.log('📊 [useArtistConfig] Supabase response:', { artistsData, dbError });
        
        if (dbError) {
          console.error('❌ [useArtistConfig] Supabase error:', dbError);
          throw dbError;
        }

        // The registry from context is the primary source of truth for contract addresses
        const currentRegistry = registry;
        if (!currentRegistry) {
          throw new Error("Artist registry is not available, and fallback failed.");
        }

        const combinedConfigs: {[key: string]: ArtistConfig} = {};

        console.log(`🎨 [useArtistConfig] Processing ${artistsData?.length || 0} artists from Supabase`);
        
        for (const artistData of artistsData as ArtistDatabaseEntry[]) {
          console.log(`🎭 [useArtistConfig] Processing artist: ${artistData.id}`, artistData);
          
          const contracts = currentRegistry[artistData.id] || getFallbackArtistContracts(artistData.id);
          
          if (contracts) {
            console.log(`✅ [useArtistConfig] Found contracts for ${artistData.id}:`, contracts);
            
            combinedConfigs[artistData.id] = {
              name: artistData.name,
              displayName: artistData.display_name, // Fixed: use display_name from schema
              tokenName: artistData.token_name, // Fixed: use token_name from schema
              artworkTitle: artistData.artwork_title, // Fixed: use artwork_title from schema
              artworkYear: artistData.artwork_year, // Fixed: use artwork_year from schema
              tokenPrice: artistData.token_price || 0.0005, // Fixed: use token_price with fallback
              videoSrc: artistData.video_src, // Fixed: use video_src from schema
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
              orbitalTokens: artistData.orbitaltokens, // Fixed: use orbitaltokens (no underscore)
            };
            
            console.log(`🎨 [useArtistConfig] Created config for ${artistData.id}:`, combinedConfigs[artistData.id]);
          } else {
            console.warn(`⚠️ [useArtistConfig] No contracts found for ${artistData.id}`);
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