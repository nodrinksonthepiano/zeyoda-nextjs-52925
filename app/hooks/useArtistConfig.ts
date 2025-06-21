import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

// Define the types again for clarity within the hook
interface ArtistConfig {
  name: string;
  displayName: string;
  tokenName: string;
  artworkTitle: string;
  artworkYear: string;
  tokenPrice: number;
  videoSrc: string;
  contract?: string;
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
}

export function useArtistConfig(artistId: string): UseArtistConfigReturn {
  const [artistConfig, setArtistConfig] = useState<ArtistConfig | null>(null);
  const [allArtistsConfig, setAllArtistsConfig] = useState<{[key: string]: ArtistConfig} | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
        const { data, error } = await supabase
          .from('artists')
          .select('*');

        if (error) throw error;

        if (!data) {
          throw new Error("No artists found in the database.");
        }

        const artistsData = data.reduce((acc: {[key: string]: ArtistConfig}, artist: any) => {
            acc[artist.id] = artist;
            return acc;
        }, {});

        setAllArtistsConfig(artistsData);

        const currentArtistConfig = artistsData[artistId];

        if (currentArtistConfig) {
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

  return { artistConfig, allArtistsConfig, isLoading, error };
} 