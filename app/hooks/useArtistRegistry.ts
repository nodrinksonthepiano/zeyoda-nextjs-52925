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
      const { data, error: dbError } = await supabase
        .from('artist_registry')
        .select('id, token, swap, downloads, treasury_wallet');

      if (dbError) {
        throw dbError;
      }

      const formattedRegistry = data.reduce((acc: ArtistRegistry, row) => {
        acc[row.id] = {
          token: row.token,
          swap: row.swap,
          downloads: row.downloads,
          treasury_wallet: row.treasury_wallet,
        };
        return acc;
      }, {});

      console.log('✅ Artist registry loaded from Supabase:', formattedRegistry);
      setRegistry(formattedRegistry);

    } catch (e: any) {
      console.warn('⚠️ Failed to load artist registry from Supabase, using fallback.', e.message);
      setError(e);
      // @ts-ignore
      setRegistry(fallbackRegistry); // Use the hardcoded fallback on error
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