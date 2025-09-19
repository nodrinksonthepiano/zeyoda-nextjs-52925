'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { ARTIST_REGISTRY as fallbackRegistry } from '../utils/addressRegistryFallback';

export interface ArtistRegistryEntry {
  token: string;
  swap: string;
  downloads: string | null;
  treasury_wallet: string | null;
}

export type ArtistRegistry = Record<string, ArtistRegistryEntry>;

const useArtistRegistry = () => {
  const [registry, setRegistry] = useState<ArtistRegistry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRegistry = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('📋 Fetching artist registry from API...');
      
      const response = await fetch('/api/registry?v=1');
      
      if (!response.ok) {
        throw new Error(`Registry API failed: ${response.status} ${response.statusText}`);
      }
      
      const registryResponse = await response.json();
      
      if (!registryResponse.artists || !Array.isArray(registryResponse.artists)) {
        throw new Error('Invalid registry response format');
      }
      
      // Convert array to lookup object
      const formattedRegistry = registryResponse.artists.reduce((acc: ArtistRegistry, artist: any) => {
        acc[artist.id] = {
          token: artist.token,
          swap: artist.swap,
          downloads: artist.downloads,
          treasury_wallet: artist.treasury_wallet,
        };
        return acc;
      }, {});

      console.log('✅ Artist registry loaded from API:', formattedRegistry);
      
      if (registryResponse.excluded && registryResponse.excluded.length > 0) {
        console.warn('⚠️ Some artists excluded from registry:', registryResponse.excluded);
      }
      
      setRegistry(formattedRegistry);

    } catch (e: any) {
      console.warn('⚠️ Failed to load artist registry from API, using fallback.', e.message);
      setError(e);
      
      // Use hardcoded fallback only if feature flag is enabled
      const fallbackEnabled = process.env.NEXT_PUBLIC_REGISTRY_FALLBACK_ENABLED === 'true';
      
      if (fallbackEnabled) {
        console.log('[REGISTRY_FALLBACK] Using hardcoded map (temporary)');
        // @ts-ignore
        setRegistry(fallbackRegistry);
      } else {
        console.error('❌ Registry fallback disabled, no artist data available');
        setRegistry({});
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  return { registry, isLoading, error, refreshRegistry: fetchRegistry };
};

export default useArtistRegistry; 