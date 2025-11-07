import { useState, useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';

export interface PurchaseResult {
  success: boolean;
  txHash?: string;
  error?: string;
  code?: string;
  retryable?: boolean;
}

export interface PurchaseParams {
  artistId: string;
  assetNumber: number;
  quantity: number;
  userAddress: string;
}

/**
 * React hook for ERC-1155 purchase flow
 * Handles API call, loading states, error handling, and toast notifications
 */
export function usePurchase1155() {
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  const purchaseAsset = useCallback(async (
    params: PurchaseParams
  ): Promise<PurchaseResult> => {
    const { artistId, assetNumber, quantity, userAddress } = params;
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/purchase/1155', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId,
          assetNumber,
          quantity,
          userAddress
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Purchase failed';
        const errorCode = data.code;
        const retryable = data.retryable || false;
        
        // Show structured error
        showToast(errorMessage, 'error');
        
        return {
          success: false,
          error: errorMessage,
          code: errorCode,
          retryable
        };
      }

      // Success
      const shortHash = data.txHash?.slice(0, 10) || 'unknown';
      showToast(`Purchase complete! TX: ${shortHash}...`, 'success');
      
      return {
        success: true,
        txHash: data.txHash
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Network error. Please try again.';
      showToast(errorMessage, 'error');
      
      return {
        success: false,
        error: errorMessage,
        retryable: true // Network errors are retryable
      };
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  return { purchaseAsset, isLoading };
}





