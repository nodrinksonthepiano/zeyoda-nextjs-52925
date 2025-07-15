import { useState, useEffect, useCallback } from 'react';
import { ArtistConfig } from '../../types/artist-types';
import { getDownloadPrice } from '../utils/downloadUtils';
import { getSliderConfig, SWAP_PRICING_CONFIG } from '../utils/swapConstants';

/**
 * The return type for the useSwapEngine hook.
 * Exported to allow components to strongly type their props.
 */
export type UseSwapEngineReturn = ReturnType<typeof useSwapEngine>;

/**
 * A hook to manage the state and logic of the swap/purchase UI.
 * This hook is UI-agnostic and only deals with data and callbacks.
 *
 * @param artistConfig - The configuration for the currently active artist.
 */
export const useSwapEngine = (artistConfig: ArtistConfig | null) => {
  const [swapFromAsset, setSwapFromAsset] = useState<string>('USD');
  const [swapToAsset, setSwapToAsset] = useState<string>('GOSH33SH'); // Default to an artist token
  const [swapFromAmount, setSwapFromAmount] = useState<string>('20.00');
  const [swapToAmount, setSwapToAmount] = useState<string>('');
  const [artistocksInput, setArtistocksInput] = useState<string>('');
  const [includeDownload, setIncludeDownload] = useState(true);
  const [totalPurchasePrice, setTotalPurchasePrice] = useState(0);
  const [totalUsdIncludingDownload, setTotalUsdIncludingDownload] = useState(0);

  // Effect to update the 'to' asset when the artist changes
  useEffect(() => {
    if (artistConfig) {
      // Determine the correct token name based on artistId, falling back to tokenName
      const artistId = artistConfig.name.toLowerCase();
      const tokenName = artistId === 'gosheesh' ? 'GOSH33SH' : artistId === 'jaitea' ? 'JAIT33' : artistConfig.tokenName;
      setSwapToAsset(tokenName);
    }
  }, [artistConfig]);

  // Effect to sync the artist token amount with the USD input amount
  useEffect(() => {
    if (swapFromAsset === 'USD' && artistConfig && artistConfig.tokenPrice > 0) {
      const usdValue = parseFloat(swapFromAmount || '0');
      const calculatedTokens = Math.floor(usdValue / artistConfig.tokenPrice);
      setArtistocksInput(calculatedTokens > 0 ? calculatedTokens.toString() : '0');
    }
  }, [swapFromAmount, swapFromAsset, artistConfig]);
  
  // Effect to calculate the total purchase price (legacy - for backward compatibility)
  useEffect(() => {
    const fromAmount = parseFloat(swapFromAmount || '0');
    const downloadCost = includeDownload ? getDownloadPrice(artistConfig) : 0;
    setTotalPurchasePrice(fromAmount + downloadCost);
  }, [swapFromAmount, includeDownload, artistConfig]);

  // Effect to calculate the total USD amount including download
  useEffect(() => {
    const fromAmount = parseFloat(swapFromAmount || '0');
    const downloadCost = includeDownload ? getDownloadPrice(artistConfig) : 0;
    setTotalUsdIncludingDownload(fromAmount + downloadCost);
  }, [swapFromAmount, includeDownload, artistConfig]);

  const handleFromAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSwapFromAmount(e.target.value);
  }, []);

  const handleArtistocksInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setArtistocksInput(e.target.value);
    // Future: Could add logic here to sync back to USD amount if needed
  }, []);

  const handleIncludeDownloadChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setIncludeDownload(e.target.checked);
  }, []);

  // Slider configuration helpers
  const getSliderConfigForAsset = useCallback((assetType: 'USD' | 'TOKEN', userBalance?: number) => {
    return getSliderConfig(assetType, userBalance);
  }, []);

  const getCurrentSliderConfig = useCallback((userTokenBalances: { [key: string]: number } = {}) => {
    if (swapFromAsset === 'USD') {
      return getSliderConfigForAsset('USD');
    } else {
      const userBalance = userTokenBalances[swapFromAsset] || 0;
      return getSliderConfigForAsset('TOKEN', userBalance);
    }
  }, [swapFromAsset, getSliderConfigForAsset]);

  return {
    // State
    swapFromAsset,
    swapToAsset,
    swapFromAmount,
    swapToAmount,
    artistocksInput,
    includeDownload,
    totalPurchasePrice,
    totalUsdIncludingDownload,

    // Setters & Handlers
    setSwapFromAsset,
    setSwapToAsset,
    setSwapFromAmount,
    setSwapToAmount,
    handleFromAmountChange,
    handleArtistocksInputChange,
    handleIncludeDownloadChange,

    // Slider configuration helpers
    getSliderConfigForAsset,
    getCurrentSliderConfig,
  };
}; 