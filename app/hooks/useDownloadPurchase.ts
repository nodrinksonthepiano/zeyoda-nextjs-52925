'use client';

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../components/MagicProvider';
import { useUsdBalance } from '../contexts/UsdBalanceContext';
import { useDownloadAccess } from './useDownloadAccess';
import { ArtistConfig } from '../../types/artist-types';
import { SwapService } from '../utils/swapUtils';
import { TreasurySwapLiteService } from '../utils/treasurySwapUtils';

export interface UseDownloadPurchaseResult {
  purchaseDownload: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  downloadAvailable: boolean;
  hasAccess: boolean;
  transactionHash: string | null;
}

interface DownloadPurchaseOptions {
  baseUsdAmount: number;
  includeDownload: boolean;
  artistConfig: ArtistConfig;
  user: string;
}

// Telemetry stub - to be wired later
const analytics = {
  track: (event: string, properties?: Record<string, any>) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Analytics: ${event}`, properties);
    }
    // TODO: Wire to actual analytics service
  }
};

export const useDownloadPurchase = (
  artistConfig: ArtistConfig | null,
  user: string | null
): UseDownloadPurchaseResult => {
  const { magic } = useWallet();
  const { setUsdBalance } = useUsdBalance();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  // Check download access for current artist
  const { hasAccessToAsset, hasAnyAccess, downloadAccess, isLoading: checkingAccess, refreshDownloadAccess } = useDownloadAccess(
    user, 
    artistConfig?.name?.toLowerCase() || null
  );

  const downloadPrice = Number(1); // TODO: Add downloadPrice to ArtistConfig type
  const downloadAvailable = !!(artistConfig && user && !hasAccessToAsset(1));
  const hasAccess = !!(user && hasAccessToAsset(1));

  const purchaseDownload = useCallback(async () => {
    if (!magic || !artistConfig?.contract || !user) {
      const errorMsg = 'Magic, artist contract, or user not available';
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }

    setIsLoading(true);
    setError(null);
    setTransactionHash(null);

    try {
      // Analytics tracking
      analytics.track('download_purchase_started', {
        artistId: artistConfig.name,
        price: downloadPrice,
        timestamp: Date.now()
      });

      const provider = magic.rpcProvider;
      const browserProvider = new ethers.BrowserProvider(provider as unknown as ethers.Eip1193Provider);
      const signer = await browserProvider.getSigner();
      
      // Calculate total USD amount including download fee
      const baseUsdAmount = 0; // For standalone download, no base swap amount
      const downloadFee = downloadPrice;
      const totalUsdAmount = baseUsdAmount + downloadFee;
      
      console.log('💰 Download purchase breakdown:', {
        baseSwapAmount: baseUsdAmount,
        downloadFee: downloadFee,
        totalAmount: totalUsdAmount,
        includeDownload: true
      });
      
      // DEBUG: Log the artist configuration for download debugging
      console.log('🔍 Download Debug Info for', artistConfig.name, {
        swap: artistConfig.swap,
        paused: artistConfig.paused,
        hasLiquidityPool: artistConfig.hasLiquidityPool,
        contract: artistConfig.contract,
        downloadPrice: downloadPrice
      });
      
      // FIXED ROUTING LOGIC: Prioritize AMM when liquidity pools exist
      const hasLiquidityPool = artistConfig.hasLiquidityPool;
      const hasTreasurySwap = artistConfig.swap && !artistConfig.paused;
      
      let swapTransactionHash = '';
      let swapType = '';
      
      if (hasLiquidityPool) {
        // ✅ PRIORITY: Use AMM for USD purchases when liquidity pools exist (live pricing)
        console.log('🏊 Using AMM system for download purchase (live pricing)');
        
        const swapService = new SwapService(signer);
        
        // Convert total USD amount to ETH for AMM with proper precision
        const ethAmount = (totalUsdAmount / 2500).toFixed(18); // Max 18 decimals for ETH
        swapType = `$${totalUsdAmount} USD → ${artistConfig.tokenName} + Download (AMM Live Price)`;
        
        // Get actual AMM quote with proper slippage tolerance
        const quote = await swapService.getTokenQuote(artistConfig.contract, ethAmount);
        console.log('📊 AMM Quote for download:', {
          ethAmount,
          expectedTokens: quote.outputAmount,
          minimumOutput: quote.minimumOutput,
          includesDownloadFee: true
        });
        
        const tx = await swapService.swapEthForTokens(
          artistConfig.contract,
          ethAmount,
          quote.minimumOutput
        );
        
        await tx.wait();
        swapTransactionHash = tx.hash;
        console.log('✅ AMM swap successful for download:', tx.hash);
        
      } else if (hasTreasurySwap) {
        // ⚠️ FALLBACK: Use TreasurySwapLite for download purchase (fixed rate)
        console.log('🎯 Using TreasurySwapLite for download purchase (fixed rate fallback)');
        swapType = `$${totalUsdAmount} USD → ${artistConfig.tokenName} + Download (Fixed Rate)`;
        
        const treasurySwap = new TreasurySwapLiteService(artistConfig.swap!, signer);
        
        const tx = await treasurySwap.buyTokensWithUSD(totalUsdAmount);
        await tx.wait();
        swapTransactionHash = tx.hash;
        console.log('✅ TreasurySwapLite swap successful for download:', tx.hash);
      } else {
        throw new Error('No swap mechanism available for this artist');
      }
      
      // Trigger balance refresh
      window.dispatchEvent(new CustomEvent('transactionSuccess', {
        detail: { type: 'download_purchase', hash: swapTransactionHash }
      }));
      
      let downloadTxHash = '';
      
      // 🎯 DOWNLOAD TOKEN MINTING (after successful swap)
      if (swapTransactionHash && user) {
        console.log('🪙 Starting download token mint via backend relayer...');
        
        try {
          const mintRequestBody = {
            artistId: artistConfig.name?.toLowerCase() || '',
            userAddress: user,
            assetId: 1, // Featured asset is always #1
            txHash: swapTransactionHash,
            amount: 1
          };
          
          console.log('🔍 DEBUG: Sending mint request for download:', mintRequestBody);
          
          const mintResponse = await fetch('/api/mintDownload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(mintRequestBody)
          });
          
          const mintData = await mintResponse.json();
          
          console.log('🔍 DEBUG: Mint response for download:', {
            status: mintResponse.status,
            ok: mintResponse.ok,
            data: mintData
          });
          
          if (mintResponse.ok && mintData.success) {
            downloadTxHash = mintData.mintTxHash;
            console.log('✅ Download token minted successfully:', downloadTxHash);
            
            if (mintData.alreadyOwned) {
              console.log('ℹ️ User already owned this download');
            }
            
            // Refresh download access to show the newly minted token
            refreshDownloadAccess();
          } else {
            // Handle mint errors with user-friendly messages
            const errorDetails = {
              status: mintResponse.status,
              error: mintData.error || 'Unknown error',
              details: mintData.details || {},
              fullResponse: mintData
            };
            
            console.error('❌ Download mint API error details:', errorDetails);
            
            let userErrorMessage = `⚠️ Download Token Update\n\n`;
            
            if (mintData.error === 'Transaction not found on blockchain' || 
                mintData.error === 'Transaction still pending confirmation') {
              userErrorMessage += `Your payment was successful! 🎉\n\n`;
              userErrorMessage += `However, we need to wait for the network to confirm it.\n`;
              userErrorMessage += `This usually takes 1-2 minutes.\n\n`;
              userErrorMessage += mintData.details?.suggestion || 'Please wait a moment and try again.';
            } else {
              userErrorMessage += `There was an issue processing your download:\n`;
              userErrorMessage += mintData.error;
              
              if (mintData.details?.suggestion) {
                userErrorMessage += `\n\n${mintData.details.suggestion}`;
              }
            }
            
            throw new Error(userErrorMessage);
          }
          
        } catch (mintError: any) {
          console.error('❌ Download mint failed:', mintError);
          throw new Error(`Download mint failed: ${mintError.message}`);
        }
      }
      
      // 🎉 SUCCESS - Set transaction hash and analytics
      setTransactionHash(swapTransactionHash);
      
      analytics.track('download_purchase_completed', {
        artistId: artistConfig.name,
        swapTxHash: swapTransactionHash,
        downloadTxHash: downloadTxHash,
        price: downloadPrice,
        swapType: swapType,
        timestamp: Date.now()
      });
      
      // Success message
      let successMessage = `🎉 DOWNLOAD PURCHASE SUCCESSFUL!\n\n${swapType}\n\nSwap Transaction: ${swapTransactionHash.substring(0, 10)}...`;
      
      if (downloadTxHash) {
        successMessage += `\n\n🎵 Download Token Minted! ✅\nMint Transaction: ${downloadTxHash.substring(0, 10)}...\n\nYour download access is now available in your wallet!`;
      }
      
      alert(successMessage);
      
      // Force wallet balance refresh with delay
      setTimeout(() => {
        console.log('🔄 Triggering wallet balance refresh after download purchase...');
        
        // Clear any cached balances
        localStorage.removeItem('zeyodaUserTokenBalances');
        
        // Trigger refresh event
        const refreshEvent = new CustomEvent('refreshWalletBalances', {
          detail: { 
            transactionHash: swapTransactionHash, 
            downloadTxHash,
            swapType, 
            forceRefresh: true,
            includeDownload: true 
          }
        });
        window.dispatchEvent(refreshEvent);
        
      }, 8000);
      
    } catch (error: any) {
      console.error('❌ Download purchase failed:', error);
      setError(error.message || 'Download purchase failed');
      
      analytics.track('download_purchase_failed', {
        artistId: artistConfig.name,
        error: error.message,
        timestamp: Date.now()
      });
      
      // User-friendly error message
      alert(`❌ Download purchase failed: ${error.message}`);
      
    } finally {
      setIsLoading(false);
    }
  }, [magic, artistConfig, user, downloadPrice, hasAccessToAsset, refreshDownloadAccess, setUsdBalance]);

  return {
    purchaseDownload,
    isLoading,
    error,
    downloadAvailable,
    hasAccess,
    transactionHash
  };
}; 