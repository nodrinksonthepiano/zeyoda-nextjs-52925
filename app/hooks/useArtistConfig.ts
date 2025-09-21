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

  // Fetch real-time prices for all artists (with proper AMM pricing)
  const fetchRealTimePrices = async (artistsData: {[key: string]: ArtistConfig}) => {
    try {
      console.log('🔄 Loading artist configs with AMM pricing...', Object.keys(artistsData));
      
      const updatedArtists = { ...artistsData };

      for (const [artistId, config] of Object.entries(updatedArtists)) {
        let realTimePrice = 0.000001; // Default fallback
        let hasLiquidityPool = false;
        
        try {
          // Use registry data for AMM pricing (no hardcoded addresses)
          if (config.swap && config.contract) {
            console.log(`💰 Fetching live AMM price for ${artistId}...`);
            
            // Create SwapService instance with a provider
            const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org');
            const swapService = new SwapService(provider);
            
            // Get live price from AMM reserves
            const livePrice = await swapService.getTokenPriceInUSD(config.contract);
            
            if (livePrice > 0) {
              realTimePrice = livePrice;
              hasLiquidityPool = true;
              console.log(`[AMM] price`, {
                artistId,
                mode: 'live',
                tokenReserve: 'loaded',
                ethReserve: 'loaded',
                priceUsd: realTimePrice.toFixed(8),
                chainId: 'base-sepolia'
              });
            } else {
              realTimePrice = config.tokenPrice || 0.000001;
              hasLiquidityPool = false;
              console.log(`[AMM] price`, {
                artistId,
                mode: 'fallback',
                reason: 'empty-pool',
                priceUsd: realTimePrice.toFixed(8)
              });
            }
          } else {
            realTimePrice = config.tokenPrice || 0.000001;
            hasLiquidityPool = false;
            console.log(`[AMM] price`, {
              artistId,
              mode: 'fallback',
              reason: 'missing-swap-or-token',
              swap: !!config.swap,
              contract: !!config.contract,
              priceUsd: realTimePrice.toFixed(8)
            });
          }
        } catch (error) {
          console.error(`[AMM] price`, {
            artistId,
            mode: 'fallback',
            reason: 'rpc-error',
            error: error instanceof Error ? error.message : String(error),
            priceUsd: (config.tokenPrice || 0.000001).toFixed(8)
          });
          realTimePrice = config.tokenPrice || 0.000001;
          hasLiquidityPool = false;
        }
        
        updatedArtists[artistId] = {
          ...config,
          hasLiquidityPool,
          realTimePrice
        };
      }

      console.log('✅ Artist configs loaded with pricing:', Object.keys(updatedArtists));
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
          
          // Debug registry data
          console.debug('[ArtistConfig] registry for', artistData.id, ':', contracts);
          
          if (contracts) {
            // Extract theme data with better fallbacks
            const themeData = artistData.theme as any || {};
            
            combinedConfigs[artistData.id] = {
              name: artistData.name,
              displayName: artistData.displayname,
              tokenName: artistData.tokenName,
              artworkTitle: artistData.artworktitle,
              artworkYear: artistData.artworkyear,
              tokenPrice: artistData.tokenprice,
              videoSrc: artistData.videosrc,
              contract: contracts.token,
              swap: contracts.swap || artistData.swap_address || undefined,
              downloads: contracts.downloads || artistData.download_address || undefined,
              treasury_wallet: artistData.treasury_wallet || contracts.treasury_wallet || undefined,
              theme: {
                primaryColor: themeData.primaryColor || artistData.primary_color || '#000000',
                accentColor: themeData.accentColor || artistData.accent_color || '#4073ff',
                gradientStart: themeData.gradientStart || themeData.accentColor || artistData.gradient_start || '#FFD700',
                gradientMiddle: themeData.gradientMiddle || themeData.accentColor || artistData.gradient_middle || '#FFD700',
                gradientEnd: themeData.gradientEnd || themeData.accentColor || artistData.gradient_end || '#FFD700',
                fontFamily: themeData.fontFamily || artistData.font_family || 'Geist',
              },
              orbitalTokens: artistData.orbital_tokens,
            };
            
            // Debug logging for treasury_wallet loading
            console.debug('[ArtistConfig] loaded', { 
              id: artistData.id, 
              treasury_wallet: artistData.treasury_wallet || contracts.treasury_wallet || 'undefined'
            });
            
            // Debug log the theme extraction
            console.log(`🎨 Theme extracted for ${artistData.id}:`, {
              primary: combinedConfigs[artistData.id].theme.primaryColor,
              accent: combinedConfigs[artistData.id].theme.accentColor,
              source: themeData.primaryColor ? 'theme object' : 'fallback'
            });
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

  // DISABLED: Auto-refresh to prevent page remounts  
  // Price refresh moved to SWR-based system for stability
  // useEffect(() => {
  //   if (!allArtistsConfig || (window as any).onboardingMode) return;
  //   const interval = setInterval(() => {
  //     console.log('⏰ Auto-refreshing prices...');
  //     refreshPrices();
  //   }, 60000);
  //   return () => clearInterval(interval);
  // }, [allArtistsConfig, artistId]);

  return { artistConfig, allArtistsConfig, isLoading: isLoading || isRegistryLoading, error, refreshPrices };
};

export default useArtistConfig; 