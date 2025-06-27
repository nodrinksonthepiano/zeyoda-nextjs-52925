import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { SwapService } from '../utils/swapUtils';
import { ethers } from 'ethers';

// Define the types again for clarity within the hook
interface ArtistConfig {
  name: string;
  displayName: string;
  tokenName: string;
  artworkTitle: string;
  artworkYear: string;
  tokenPrice: number;           // DEPRECATED: Fallback only
  realTimePrice?: number;       // NEW: Real LP price
  hasLiquidityPool?: boolean;   // NEW: LP status
  videoSrc: string;
  contract?: string;
  swapAddress?: string;         // TreasurySwapLite contract address
  paused?: boolean;             // Emergency pause state
  theme: {
    primaryColor: string;
    accentColor: string;
    gradientStart: string;
    gradientMiddle: string;
    gradientEnd: string;
    fontFamily: string;
  };
  orbitalTokens: Array<{ name: string; angle: number; artistId?: string; }>;
}

interface UseArtistConfigReturn {
    artistConfig: ArtistConfig | null;
    allArtistsConfig: {[key: string]: ArtistConfig} | null;
    isLoading: boolean;
    error: string | null;
    refreshPrices: () => Promise<void>;
}

export function useArtistConfig(artistId: string): UseArtistConfigReturn {
  const [artistConfig, setArtistConfig] = useState<ArtistConfig | null>(null);
  const [allArtistsConfig, setAllArtistsConfig] = useState<{[key: string]: ArtistConfig} | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real-time prices for all artists
  const fetchRealTimePrices = async (artistsData: {[key: string]: ArtistConfig}) => {
    try {
      // Create a dummy signer for read-only operations
      const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
      const swapService = new SwapService(provider);

      const updatedArtists = { ...artistsData };

      for (const [id, artist] of Object.entries(artistsData)) {
        if (artist.contract) {
          try {
            console.log(`🔍 Fetching LP price for ${artist.name} (${artist.contract})`);
            
            // Check if LP exists
            const hasLP = await swapService.hasLiquidityPool(artist.contract);
            updatedArtists[id].hasLiquidityPool = hasLP;

            if (hasLP) {
              // Get real-time price from LP
              const realPrice = await swapService.getTokenPriceInUSD(artist.contract);
              updatedArtists[id].realTimePrice = realPrice;
              
              console.log(`✅ LP Price for ${artist.name}: $${realPrice.toFixed(6)} (LP exists)`);
            } else {
              console.log(`⚠️ No LP for ${artist.name}, using fallback price: $${artist.tokenPrice}`);
              updatedArtists[id].realTimePrice = artist.tokenPrice; // Fallback to Supabase
            }
          } catch (error) {
            console.error(`Error fetching price for ${artist.name}:`, error);
            updatedArtists[id].realTimePrice = artist.tokenPrice; // Fallback to Supabase
            updatedArtists[id].hasLiquidityPool = false;
          }
        } else {
          console.log(`⚠️ No contract address for ${artist.name}`);
          updatedArtists[id].realTimePrice = artist.tokenPrice; // Fallback to Supabase
          updatedArtists[id].hasLiquidityPool = false;
        }
      }

      return updatedArtists;
    } catch (error) {
      console.error('Error fetching real-time prices:', error);
      return artistsData; // Return original data on error
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
    async function fetchConfig() {
      if (!artistId) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      setArtistConfig(null);

      try {
        console.log(`📊 Fetching artist config for: ${artistId}`);
        
        const { data, error } = await supabase
          .from('artists')
          .select('*');

        if (error) throw error;

        if (!data) {
          throw new Error("No artists found in the database.");
        }

        const artistsData = data.reduce((acc: {[key: string]: ArtistConfig}, artist: any) => {
            // Add environment variable fallbacks for swap addresses
            const enhancedArtist = {
              ...artist,
              swapAddress: artist.swapAddress || 
                          (artist.id === 'gosheesh' ? process.env.NEXT_PUBLIC_GOSHEESH_SWAP : 
                           artist.id === 'jaitea' ? process.env.NEXT_PUBLIC_JAITEA_SWAP : undefined),
              paused: artist.paused ?? false
            };
            acc[artist.id] = enhancedArtist;
            return acc;
        }, {});

        console.log(`📊 Fetched ${Object.keys(artistsData).length} artists from Supabase`);

        // Fetch real-time prices for all artists
        const artistsWithPrices = await fetchRealTimePrices(artistsData);
        
        setAllArtistsConfig(artistsWithPrices);

        const currentArtistConfig = artistsWithPrices[artistId];

        if (currentArtistConfig) {
          console.log(`✅ Found config for '${artistId}':`, {
            name: currentArtistConfig.name,
            contract: currentArtistConfig.contract,
            swapAddress: currentArtistConfig.swapAddress,
            paused: currentArtistConfig.paused,
            supabasePrice: currentArtistConfig.tokenPrice,
            realTimePrice: currentArtistConfig.realTimePrice,
            hasLP: currentArtistConfig.hasLiquidityPool,
            video: currentArtistConfig.videoSrc
          });
          setArtistConfig(currentArtistConfig);
        } else {
          throw new Error(`Artist '${artistId}' not found in the database.`);
        }
      } catch (err: any) {
        console.error(`[useArtistConfig] Error fetching config for ${artistId}:`, err);
        const errorMessage = err.message || "An unknown error occurred.";
        setError(errorMessage);
        setArtistConfig(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchConfig();
  }, [artistId]);

  // Auto-refresh prices every 60 seconds
  useEffect(() => {
    if (!allArtistsConfig) return;

    const interval = setInterval(() => {
      console.log('⏰ Auto-refreshing prices...');
      refreshPrices();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [allArtistsConfig, artistId]);

  return { artistConfig, allArtistsConfig, isLoading, error, refreshPrices };
} 