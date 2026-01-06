'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../components/MagicProvider';
import { authenticatedFetch } from '../utils/authenticatedFetch';

interface ArtistEarningsSummary {
  artistId: string;
  artistName: string;
  totalEarnings: number;
  totalSales: number;
  recentEarnings: any[];
}

interface UseAllArtistEarningsReturn {
  hasAnyEarnings: boolean;
  artistEarnings: ArtistEarningsSummary[];
  isLoading: boolean;
  error: string | null;
  totalCombinedEarnings: number;
  totalCombinedSales: number;
  refetch: () => Promise<void>;
}

export function useAllArtistEarnings(userAddress: string | null): UseAllArtistEarningsReturn {
  const [artistEarnings, setArtistEarnings] = useState<ArtistEarningsSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getDidToken } = useWallet();
  
  const fetchAllEarnings = useCallback(async () => {
    if (!userAddress) {
      setArtistEarnings([]);
      return;
    }
    
    console.log('[useAllArtistEarnings] Fetching earnings for all artists...');
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch earnings for gosheesh, jaitea, and cancakes
      const artistIds = ['gosheesh', 'jaitea', 'cancakes'];
      const earningsPromises = artistIds.map(async (artistId) => {
        try {
          const response = await authenticatedFetch(
            `/api/artist-earnings?artistId=${artistId}`,
            { method: 'GET' },
            getDidToken
          );
          
          if (!response.ok) {
            console.warn(`Failed to fetch earnings for ${artistId}`);
            return null;
          }
          
          const data = await response.json();
          
          if (data.success && data.totals.totalEarnings > 0) {
            return {
              artistId,
              artistName: data.artist.displayName || data.artist.name,
              totalEarnings: data.totals.totalEarnings,
              totalSales: data.totals.totalSales,
              recentEarnings: data.recentEarnings || []
            };
          }
          
          return null;
        } catch (err) {
          console.warn(`Error fetching earnings for ${artistId}:`, err);
          return null;
        }
      });
      
      const results = await Promise.all(earningsPromises);
      const validEarnings = results.filter(Boolean) as ArtistEarningsSummary[];
      
      console.log('[useAllArtistEarnings] Found earnings for:', validEarnings.map(e => e.artistId));
      setArtistEarnings(validEarnings);
      
    } catch (err: any) {
      console.error('[useAllArtistEarnings] Error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userAddress, getDidToken]);

  useEffect(() => {
    fetchAllEarnings();
  }, [fetchAllEarnings]);

  // Calculate totals
  const totalCombinedEarnings = artistEarnings.reduce((sum, artist) => sum + artist.totalEarnings, 0);
  const totalCombinedSales = artistEarnings.reduce((sum, artist) => sum + artist.totalSales, 0);
  const hasAnyEarnings = artistEarnings.length > 0;

  return {
    hasAnyEarnings,
    artistEarnings,
    isLoading,
    error,
    totalCombinedEarnings,
    totalCombinedSales,
    refetch: fetchAllEarnings
  };
}
