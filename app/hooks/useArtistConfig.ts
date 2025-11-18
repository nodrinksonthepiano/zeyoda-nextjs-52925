'use client';

import { useState, useEffect, useCallback } from 'react';
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
  refreshConfig: () => Promise<void>;
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
            
            // Create provider (use public RPC in browser)
            const rpcUrl = typeof window !== 'undefined' 
              ? 'https://sepolia.base.org' 
              : (process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org');
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            
            // FIXED: Query the correct AMM (config.swap, not hardcoded legacy AMM)
            const ammAbi = ['function getReserves(address) view returns (uint256 tokenReserve, uint256 ethReserve)'];
            const ammContract = new ethers.Contract(config.swap, ammAbi, provider);
            
            try {
              const [tokenReserve, ethReserve] = await ammContract.getReserves(config.contract);
              
              if (tokenReserve > 0n && ethReserve > 0n) {
                // Calculate price from reserves
                const ethPerToken = Number(ethers.formatEther(ethReserve)) / Number(ethers.formatUnits(tokenReserve, 18));
                const ethUsdRate = 2500; // Fallback ETH price (or fetch live from Coinbase)
                realTimePrice = ethPerToken * ethUsdRate;
                hasLiquidityPool = true;
                
                console.log(`[AMM] price`, {
                  artistId,
                  mode: 'live',
                  tokenReserve: ethers.formatUnits(tokenReserve, 18),
                  ethReserve: ethers.formatEther(ethReserve),
                  priceUsd: realTimePrice.toFixed(8),
                  ammAddress: config.swap
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
            } catch (error) {
              console.error(`[AMM] price`, {
                artistId,
                mode: 'fallback',
                reason: 'amm-query-failed',
                error: error instanceof Error ? error.message : String(error),
                ammAddress: config.swap
              });
              realTimePrice = config.tokenPrice || 0.000001;
              hasLiquidityPool = false;
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

  // Extract fetch logic into reusable function (memoized to avoid stale closures)
  const fetchConfig = useCallback(async () => {
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
            // Logo and background image fields
            logo_url: artistData.logo_url || null,
            background_image_url: artistData.background_image_url || null,
            logo_use_background: Boolean(artistData.logo_use_background),
            background_use_image: Boolean(artistData.background_use_image),
          };
          
          // Debug log logo fields loading
          console.log(`[useArtistConfig] ✅ Loaded config for ${artistData.id}:`, {
            logo_url: combinedConfigs[artistData.id].logo_url,
            logo_use_background: combinedConfigs[artistData.id].logo_use_background,
            background_image_url: combinedConfigs[artistData.id].background_image_url,
            background_use_image: combinedConfigs[artistData.id].background_use_image,
            primaryColor: combinedConfigs[artistData.id].theme.primaryColor
          });
          
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
  }, [artistId, isRegistryLoading, registry]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]); // fetchConfig is memoized with correct dependencies

  // Listen for logo/background deletion events to trigger refresh
  useEffect(() => {
    const handleLogoDeleted = () => {
      // Small delay to ensure database update completes
      console.log('[useArtistConfig] 🔄 Refreshing config after logo/background deletion (delayed 500ms)');
      setTimeout(() => {
        fetchConfig();
      }, 500);
    };

    window.addEventListener('logoDeleted', handleLogoDeleted);
    window.addEventListener('backgroundDeleted', handleLogoDeleted);
    return () => {
      window.removeEventListener('logoDeleted', handleLogoDeleted);
      window.removeEventListener('backgroundDeleted', handleLogoDeleted);
    };
  }, [fetchConfig]); // fetchConfig is memoized, so this is stable

  const refreshConfig = async () => {
    console.log('[useArtistConfig] 🔄 Manual config refresh triggered');
    await fetchConfig();
  };

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

  return { artistConfig, allArtistsConfig, isLoading: isLoading || isRegistryLoading, error, refreshPrices, refreshConfig };
};

export default useArtistConfig; 