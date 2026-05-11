'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '../components/MagicProvider';
import { authenticatedFetch } from '../utils/authenticatedFetch';
import type { ArtistEarningsData } from './useArtistEarnings';

export interface OwnedArtistEarningEntry {
  artistId: string;
  data: ArtistEarningsData | null;
  error: string | null;
  isLoading: boolean;
}

interface UseOwnedArtistsEarningsProps {
  ownedArtistIds: string[];
  userAddress: string | null;
  allArtistsConfig: { [key: string]: { treasury_wallet?: string | null } } | null;
  autoRefresh?: boolean;
}

export function useOwnedArtistsEarnings({
  ownedArtistIds,
  userAddress,
  allArtistsConfig,
  autoRefresh = false
}: UseOwnedArtistsEarningsProps) {
  const { getDidToken } = useWallet();
  const [entries, setEntries] = useState<OwnedArtistEarningEntry[]>([]);

  const sortedIds = useMemo(() => [...ownedArtistIds].sort(), [ownedArtistIds]);

  const fetchAll = useCallback(async () => {
    if (sortedIds.length === 0) {
      setEntries([]);
      return;
    }

    setEntries((prev) => {
      const prevMap = new Map(prev.map((e) => [e.artistId, e]));
      return sortedIds.map((artistId) => {
        const p = prevMap.get(artistId);
        return {
          artistId,
          data: p?.data ?? null,
          error: null as string | null,
          isLoading: true
        };
      });
    });

    const settled = await Promise.allSettled(
      sortedIds.map(async (artistId) => {
        const response = await authenticatedFetch(
          `/api/artist-earnings?artistId=${encodeURIComponent(artistId)}`,
          { method: 'GET' },
          getDidToken
        );

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error((errBody as { error?: string }).error || `HTTP ${response.status}`);
        }

        const earningsData = (await response.json()) as ArtistEarningsData & { success?: boolean };
        if (!earningsData.success) {
          throw new Error('Failed to fetch earnings');
        }

        return { artistId, data: earningsData, error: null as string | null };
      })
    );

    setEntries(
      sortedIds.map((artistId, i) => {
        const r = settled[i];
        if (r.status === 'fulfilled') {
          return {
            artistId,
            data: r.value.data,
            error: r.value.error,
            isLoading: false
          };
        }
        return {
          artistId,
          data: null,
          error: r.reason instanceof Error ? r.reason.message : 'Failed to load earnings',
          isLoading: false
        };
      })
    );
  }, [sortedIds, getDidToken]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!autoRefresh || sortedIds.length === 0) return;

    const interval = setInterval(() => {
      fetchAll();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, sortedIds.length, fetchAll]);

  const isLoading = entries.some((e) => e.isLoading);

  return { entries, refetch: fetchAll, isLoading };
}
