'use client';

import { useState, useEffect, useCallback } from 'react';

interface TreasuryEarningsData {
  totalProtocolFees: number;
  downloadFeesUsd: number;
  swapFeesUsd: number;
  totalTransactions: number;
  recentFees: {
    id: number;
    artistId: string;
    artistName: string;
    feeAmount: number;
    feeType: string;
    createdAt: string;
  }[];
}

interface UseTreasuryEarningsProps {
  userAddress: string | null;
  autoRefresh?: boolean;
}

interface UseTreasuryEarningsReturn {
  isTreasury: boolean;
  data: TreasuryEarningsData | null;
  isLoading: boolean;
  error: string | null;
  lastFetchTime: Date | null;
  refetch: () => Promise<void>;
}

// Treasury wallet address - using the gosheesh wallet you're connected with
const TREASURY_WALLET = '0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8';

export function useTreasuryEarnings({
  userAddress,
  autoRefresh = false
}: UseTreasuryEarningsProps): UseTreasuryEarningsReturn {
  const [data, setData] = useState<TreasuryEarningsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  
  // Detect if connected user should see treasury data (admin privileges)
  const isTreasury = Boolean(
    userAddress && 
    (
      // Direct treasury wallet match
      (TREASURY_WALLET && userAddress.toLowerCase() === TREASURY_WALLET.toLowerCase()) ||
      // GOSHEESH wallet gets admin treasury view
      userAddress.toLowerCase() === '0xeE699E81717F03B745bf21EC08c2978B8e6aa0e8'.toLowerCase()
    )
  );
  
  const fetchTreasuryEarnings = useCallback(async () => {
    if (!isTreasury) {
      console.log('[useTreasuryEarnings] Not treasury wallet, skipping fetch');
      setData(null);
      return;
    }
    
    console.log('[useTreasuryEarnings] Fetching treasury earnings...');
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/treasury-earnings');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const treasuryData = await response.json();
      
      if (!treasuryData.success) {
        throw new Error(treasuryData.error || 'Failed to fetch treasury earnings');
      }
      
      console.log('[useTreasuryEarnings] Treasury earnings fetched successfully:', {
        totalProtocolFees: treasuryData.totalProtocolFees,
        downloadFees: treasuryData.downloadFeesUsd,
        swapFees: treasuryData.swapFeesUsd,
        totalTransactions: treasuryData.totalTransactions,
        recentCount: treasuryData.recentFees?.length || 0
      });
      
      setData(treasuryData);
      setLastFetchTime(new Date());
      
    } catch (err: any) {
      console.error('[useTreasuryEarnings] Error fetching treasury earnings:', err);
      setError(err.message || 'Failed to fetch treasury earnings');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [isTreasury]);

  // Initial fetch and dependency updates
  useEffect(() => {
    fetchTreasuryEarnings();
  }, [fetchTreasuryEarnings]);

  // DISABLED: Auto-refresh to prevent page remounts
  // Treasury refresh moved to SWR-based system for stability  
  // useEffect(() => {
  //   if (!autoRefresh || !isTreasury) return;
  //   const interval = setInterval(() => {
  //     console.log('[useTreasuryEarnings] Auto-refreshing treasury earnings...');
  //     fetchTreasuryEarnings();
  //   }, 30000);
  //   return () => clearInterval(interval);
  // }, [autoRefresh, isTreasury, fetchTreasuryEarnings]);

  return {
    isTreasury,
    data,
    isLoading,
    error,
    lastFetchTime,
    refetch: fetchTreasuryEarnings
  };
}
