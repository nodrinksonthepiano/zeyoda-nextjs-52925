'use client'

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export type ArtistAsset = {
  id: string;
  artistId: string;
  assetNumber: number;
  url: string;
  type: 'video' | 'image';
  title?: string;
  priceUSD?: number;
  metadata?: any;
};

type UseArtistAssetsResult = {
  assets: ArtistAsset[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useArtistAssets(artistId: string | null | undefined): UseArtistAssetsResult {
  const [rows, setRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const lastArtistIdRef = useRef<string | null>(null);
  const refreshTriggerRef = useRef<number>(0);

  const loadAssets = async (normalizedId: string, forceRefresh = false) => {
    if (!normalizedId) {
      setRows([]);
      setError(null);
      return;
    }

    // Skip if same artist and not forcing refresh
    if (!forceRefresh && lastArtistIdRef.current === normalizedId) return;
    lastArtistIdRef.current = normalizedId;

    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('artist_assets')
        .select('*')
        .eq('artist_id', normalizedId)
        .or('is_hidden.is.null,is_hidden.eq.false')
        .order('is_pinned', { ascending: false })
        .order('asset_number', { ascending: false });

      if (error) {
        setRows([]);
        setError(error.message || 'Failed to load assets');
        setIsLoading(false);
        return;
      }

      setRows(Array.isArray(data) ? data : []);
      setIsLoading(false);
      console.log(`[useArtistAssets] ✅ Loaded ${Array.isArray(data) ? data.length : 0} assets for ${normalizedId}`);
    } catch (e: any) {
      setRows([]);
      setError(e?.message || 'Unknown error loading assets');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const normalizedId = (artistId ?? '').trim();
    
    loadAssets(normalizedId).then(() => {
      if (cancelled) return;
    });
    
    return () => {
      cancelled = true;
    };
  }, [artistId]);

  // Listen for asset deletion events to trigger refresh
  useEffect(() => {
    const handleAssetDeleted = () => {
      const normalizedId = (artistId ?? '').trim();
      if (normalizedId) {
        console.log('[useArtistAssets] 🔄 Refreshing assets after deletion');
        refreshTriggerRef.current += 1;
        loadAssets(normalizedId, true);
      }
    };

    window.addEventListener('assetDeleted', handleAssetDeleted);
    return () => {
      window.removeEventListener('assetDeleted', handleAssetDeleted);
    };
  }, [artistId]);

  const refresh = async () => {
    const normalizedId = (artistId ?? '').trim();
    if (normalizedId) {
      console.log('[useArtistAssets] 🔄 Manual refresh triggered');
      refreshTriggerRef.current += 1;
      await loadAssets(normalizedId, true);
    }
  };

  const assets: ArtistAsset[] = useMemo(() => {
    if (!rows || rows.length === 0) return [];

    const mapped: ArtistAsset[] = rows.map((r: any) => {
      const fileType = (r?.file_type || '').toString();
      const isVideo = fileType.startsWith('video/');
      const metaTitle = (r?.metadata && typeof r.metadata === 'object' && r.metadata?.title) ? String(r.metadata.title) : undefined;
      return {
        id: String(r?.id || ''),
        artistId: String(r?.artist_id || ''),
        assetNumber: typeof r?.asset_number === 'number' ? r.asset_number : parseInt(r?.asset_number || '0', 10) || 0,
        url: String(r?.file_url || ''),
        type: isVideo ? 'video' : 'image',
        title: metaTitle,
        priceUSD: typeof r?.price_usd === 'number' ? r.price_usd : (r?.price_usd ? Number(r.price_usd) : undefined),
        metadata: r?.metadata || undefined,
      };
    }).filter(a => a.id && a.artistId && a.url);

    return mapped;
  }, [rows]);

  return { assets, isLoading, error, refresh };
}


