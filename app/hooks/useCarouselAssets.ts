"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

export interface CarouselAsset {
  id: string;
  fileUrl: string;
  fileType: 'image' | 'video';
  title?: string;
}

export function useCarouselAssets(artistId: string | null): CarouselAsset[] {
  const [assets, setAssets] = useState<CarouselAsset[]>([]);

  useEffect(() => {
    if (!artistId) {
      setAssets([]);
      return;
    }

    async function fetchAssets() {
      try {
        console.log(`🎠 Fetching carousel assets for artist: ${artistId}`);
        
        const { data, error } = await supabase
          .from('artist_assets')
          .select('id, file_url, file_type, metadata')
          .eq('artist_id', artistId)
          .order('asset_number', { ascending: true });

        if (error) {
          console.error('Error fetching carousel assets:', error);
          setAssets([]);
          return;
        }

        // Transform Supabase data to CarouselAsset format
        const transformedAssets: CarouselAsset[] = (data || []).map(asset => ({
          id: asset.id,
          fileUrl: asset.file_url,
          fileType: asset.file_type?.startsWith('image/') ? 'image' : 'video',
          title: asset.metadata?.title || `Asset ${asset.id}`
        }));

        console.log(`✅ Found ${transformedAssets.length} carousel assets for ${artistId}`);

        // Development mode: if < 2 assets, create clones for testing
        if (process.env.NODE_ENV === 'development' && transformedAssets.length < 2) {
          if (transformedAssets.length > 0) {
            // We have 1 asset, create clones
            const baseAsset = transformedAssets[0];
            const devAssets = Array.from({ length: 5 }, (_, i) => ({
              ...baseAsset,
              id: `dev-clone-${i}`,
              title: `${baseAsset.title} #${i + 1}`
            }));
            
            console.log(`🧪 Dev mode: Created ${devAssets.length} clones for testing`);
            setAssets(devAssets);
          } else {
            // No assets in database - return empty array to trigger fallback
            console.log(`📝 No assets found for ${artistId}, will use fallback video`);
            setAssets([]);
          }
        } else {
          // Production or sufficient assets: use real data
          setAssets(transformedAssets);
        }

      } catch (error) {
        console.error('Failed to fetch carousel assets:', error);
        setAssets([]);
      }
    }

    fetchAssets();
  }, [artistId]);

  return assets;
}
