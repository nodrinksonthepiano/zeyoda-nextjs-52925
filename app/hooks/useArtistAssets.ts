"use client";

import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

export interface ArtistAsset {
  id: string;
  url: string;
  type: "image" | "video";
  title?: string;
  priceUsd?: number;
  artistId: string;
  assetNumber: number;
}

export function useArtistAssets(artistId: string | null) {
  const [assets, setAssets] = useState<ArtistAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    async function fetchAssets() {
      if (!artistId) {
        setAssets([]);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("artist_assets")
          .select(
            "id, artist_id, asset_number, file_url, file_type, price_usd, metadata, is_hidden, is_pinned"
          )
          .eq("artist_id", artistId)
          .or("is_hidden.is.null,is_hidden.eq.false")
          .order("is_pinned", { ascending: false })
          .order("asset_number", { ascending: false });

        if (error) throw error;

        const mapped: ArtistAsset[] = (data || []).map((a: any) => ({
          id: a.id,
          url: a.file_url,
          type: a.file_type?.startsWith("video/") ? "video" : "image",
          title: a.metadata?.title,
          priceUsd: a.price_usd ?? undefined,
          artistId: a.artist_id,
          assetNumber: a.asset_number,
        }));

        if (!isCancelled) setAssets(mapped);
      } catch (e: any) {
        if (!isCancelled) {
          setError(e?.message || "Failed to fetch artist assets");
          setAssets([]);
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }
    fetchAssets();
    return () => {
      isCancelled = true;
    };
  }, [artistId]);

  return { assets, isLoading, error };
}



