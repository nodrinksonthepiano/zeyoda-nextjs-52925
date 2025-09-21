"use client";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useLiveQuote(pairKey: string | null) {
  return useSWR(
    pairKey ? `/api/lp/quote?pair=${pairKey}` : null,
    fetcher,
    {
      refreshInterval: 30000,        // 30 second updates
      revalidateOnFocus: false,      // Don't refresh on tab focus
      dedupingInterval: 25000,       // Prevent duplicate requests
      keepPreviousData: true,        // Prevent flashing during updates
      errorRetryCount: 3,            // Retry failed requests
      errorRetryInterval: 5000,      // Wait 5s between retries
    }
  );
}
