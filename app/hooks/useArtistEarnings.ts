'use client';

import { useState, useEffect, useCallback } from 'react';

interface ArtistEarning {
  id: number;
  assetNumber: number;
  assetTitle: string;
  grossAmount: number;
  protocolFee: number;
  netEarnings: number;
  paymentMethod: string;
  source: string;
  txHash: string | null;
  collectibleMinted: boolean;
  status: string;
  createdAt: string;
}

interface ArtistEarningsData {
  artist: {
    id: string;
    name: string;
    displayName: string;
  };
  totals: {
    totalEarnings: number;
    totalSales: number;
    availableBalance: number;
    mintedCount: number;
    pendingCount: number;
  };
  recentEarnings: ArtistEarning[];
  allEarnings: ArtistEarning[];
}

interface UseArtistEarningsProps {
  artistId: string | null;
  userAddress: string | null;
  allArtistsConfig: { [key: string]: any } | null;
  autoRefresh?: boolean;
}

interface UseArtistEarningsReturn {
  isArtist: boolean;
  data: ArtistEarningsData | null;
  isLoading: boolean;
  error: string | null;
  lastFetchTime: Date | null;
  refetch: () => Promise<void>;
}

export function useArtistEarnings({
  artistId,
  userAddress,
  allArtistsConfig,
  autoRefresh = false
}: UseArtistEarningsProps): UseArtistEarningsReturn {
  const [data, setData] = useState<ArtistEarningsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  
  // Detect if connected user is the artist - SIMPLIFIED FOR TESTING
  const treasuryWallet = allArtistsConfig?.[artistId]?.treasury_wallet;
  const isArtist = Boolean(
    artistId && 
    userAddress && 
    (artistId === 'gosheesh' || artistId === 'jaitea') // Show for gosheesh/jaitea when connected
  );
  
  // Debug logging
  console.log('[useArtistEarnings] Debug:', {
    artistId,
    userAddress: userAddress?.slice(0, 8) + '...',
    treasuryWallet: treasuryWallet?.slice(0, 8) + '...',
    isArtist,
    hasConfig: !!allArtistsConfig?.[artistId],
    fullConfig: allArtistsConfig?.[artistId] // Show full config to debug
  });
  
  const fetchEarnings = useCallback(async () => {
    if (!artistId || !isArtist) {
      console.log('[useArtistEarnings] Not artist or no artistId, skipping fetch');
      setData(null);
      return;
    }
    
    console.log('[useArtistEarnings] Fetching earnings for artist:', artistId);
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/artist-earnings?artistId=${artistId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const earningsData = await response.json();
      
      if (!earningsData.success) {
        throw new Error(earningsData.error || 'Failed to fetch earnings');
      }
      
      console.log('[useArtistEarnings] Earnings fetched successfully:', {
        totalEarnings: earningsData.totals.totalEarnings,
        totalSales: earningsData.totals.totalSales,
        recentCount: earningsData.recentEarnings?.length || 0
      });
      
      setData(earningsData);
      setLastFetchTime(new Date());
      
    } catch (err: any) {
      console.error('[useArtistEarnings] Error fetching earnings:', err);
      setError(err.message || 'Failed to fetch earnings');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [artistId, isArtist]);

  // Initial fetch and dependency updates
  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  // Auto-refresh every 30 seconds if enabled and user is artist
  useEffect(() => {
    if (!autoRefresh || !isArtist) return;

    const interval = setInterval(() => {
      console.log('[useArtistEarnings] Auto-refreshing earnings...');
      fetchEarnings();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, isArtist, fetchEarnings]);

  return {
    isArtist,
    data,
    isLoading,
    error,
    lastFetchTime,
    refetch: fetchEarnings
  };
}
