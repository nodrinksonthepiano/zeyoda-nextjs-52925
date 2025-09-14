import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

export interface FeaturedAsset {
  id: string;
  artist_id: string;
  asset_number: number;
  file_url: string;
  file_type: string;
  metadata: any;
}

export function useFeaturedAsset(artistId: string | null) {
  const [featuredAsset, setFeaturedAsset] = useState<FeaturedAsset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!artistId) {
      setFeaturedAsset(null);
      return;
    }

    async function fetchFeaturedAsset() {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log(`🎬 Fetching featured asset for artist: ${artistId}`);
        
        const { data, error } = await supabase
          .from('artist_assets')
          .select('*')
          .eq('artist_id', artistId)
          .eq('asset_number', 1) // Featured asset is always #1
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No data found - not an error, just no featured asset
            console.log(`📝 No featured asset found for ${artistId}`);
            setFeaturedAsset(null);
          } else {
            throw error;
          }
        } else if (data) {
          console.log(`✅ Found featured asset for ${artistId}:`, {
            asset_number: data.asset_number,
            file_url: data.file_url,
            file_type: data.file_type
          });
          setFeaturedAsset(data);
        }
        
      } catch (error: any) {
        console.error('Error fetching featured asset:', error);
        setError(error.message || 'Failed to fetch featured asset');
        setFeaturedAsset(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFeaturedAsset();
  }, [artistId]);

  // Convert file_url to proper format for display
  const getDisplayUrl = (fileUrl: string | null) => {
    if (!fileUrl) return null;
    
    // If it's already a full URL (starts with http), use as-is
    if (fileUrl.startsWith('http')) {
      return fileUrl;
    }
    
    // If it's a storage path (starts with artistId/), convert to public URL
    if (fileUrl.includes('/') && !fileUrl.startsWith('/')) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      return `${supabaseUrl}/storage/v1/object/public/artist-assets/${fileUrl}`;
    }
    
    // Legacy format (starts with /assets/ or assets/), use as-is
    return fileUrl;
  };

  return {
    featuredAsset,
    isLoading,
    error,
    videoUrl: getDisplayUrl(featuredAsset?.file_url ?? null)
  };
} 