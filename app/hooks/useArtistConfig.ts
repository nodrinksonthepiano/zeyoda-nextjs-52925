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

  // Fetch real-time prices for all artists (simplified to avoid ENS issues)
  const fetchRealTimePrices = async (artistsData: {[key: string]: ArtistConfig}) => {
    try {
      console.log('🔄 Loading artist configs without price fetching...');
      
      // Temporarily disable real-time pricing to fix the core loading issue
      const updatedArtists = { ...artistsData };

      for (const [artistId, config] of Object.entries(updatedArtists)) {
        updatedArtists[artistId] = {
          ...config,
          hasLiquidityPool: true, // Assume true for now
          realTimePrice: config.tokenPrice || 0.000001 // Use static price
        };
      }

      console.log('✅ Artist configs loaded successfully:', Object.keys(updatedArtists));
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
              swap: contracts.swap,
              downloads: contracts.downloads || undefined,
              treasury_wallet: contracts.treasury_wallet || undefined,
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

  // Auto-refresh prices every 60 seconds (suspended during onboarding)
  useEffect(() => {
    if (!allArtistsConfig || (window as any).onboardingMode) return;

    const interval = setInterval(() => {
      console.log('⏰ Auto-refreshing prices...');
      refreshPrices();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [allArtistsConfig, artistId]);

  return { artistConfig, allArtistsConfig, isLoading: isLoading || isRegistryLoading, error, refreshPrices };
};

export default useArtistConfig; 