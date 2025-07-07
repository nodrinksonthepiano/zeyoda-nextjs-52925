import { supabase } from '@/app/utils/supabaseClient';
import { ARTIST_REGISTRY as fallbackRegistry } from '@/app/utils/addressRegistryFallback';

interface ArtistContractInfo {
  token: string;
  swap: string;
  downloads: string | null;
  treasury_wallet: string | null;
}

// In-memory cache for the registry to reduce DB hits on the server
let registryCache: Record<string, ArtistContractInfo> | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

async function fetchAndCacheRegistry(): Promise<Record<string, ArtistContractInfo>> {
  try {
    const { data, error } = await supabase
      .from('artist_registry')
      .select('id, token, swap, downloads, treasury_wallet');

    if (error) throw error;

    const registry = data.reduce((acc, row) => {
      acc[row.id] = {
        token: row.token,
        swap: row.swap,
        downloads: row.downloads,
        treasury_wallet: row.treasury_wallet,
      };
      return acc;
    }, {} as Record<string, ArtistContractInfo>);
    
    registryCache = registry;
    cacheTimestamp = Date.now();
    console.log('✅ Server-side artist registry cached from Supabase.');
    return registry;

  } catch (e: any) {
    console.warn('⚠️ Could not fetch server-side registry, using fallback.', e.message);
    // @ts-ignore
    return fallbackRegistry;
  }
}

export async function getArtistContractsFromServer(artistId: string): Promise<ArtistContractInfo | null> {
  const now = Date.now();
  if (!registryCache || now - cacheTimestamp > CACHE_DURATION_MS) {
    await fetchAndCacheRegistry();
  }

  // @ts-ignore
  return registryCache ? (registryCache[artistId] || null) : (fallbackRegistry[artistId] || null);
} 