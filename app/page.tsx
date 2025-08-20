'use client'

import Image from "next/image";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import Wallet from './components/Wallet';
import dynamic from 'next/dynamic';
import { useWallet } from './components/MagicProvider';
import { useToast } from './contexts/ToastContext';
import { UsdBalanceProvider } from './contexts/UsdBalanceContext';
import { ethers } from "ethers";
import ArtistockArtifact from '../artifacts/contracts/Artistock.sol/Artistock.json';
import useArtistConfig from "./hooks/useArtistConfig";
import { useFeaturedAsset } from "./hooks/useFeaturedAsset";
import OwnerControls from "./components/OwnerControls";
import ArtistVideo from "./components/ArtistVideo";
import ThemeOrbitRenderer from "./components/ThemeOrbitRenderer";
import PurchaseFlow from "./components/PurchaseFlow";
import OnboardingPanel from "./components/OnboardingPanel";
import {
  ArtistConfig,
  RenderableToken,
  UserTokenBalances
} from '../types/artist-types';
import { useCommandSystem } from './hooks/useCommandSystem';
import { clearAllSafewordStorage } from './utils/safewordStorage';
import { useOrbitTokens } from './hooks/useOrbitTokens';

interface OrbitalToken {
  name: string; 
  angle: number; 
  artistId?: string;
}

interface PriceDetails {
  currentDisplayPrice: number;
  artistShare: number;
  platformShare: number;
  investorShare: number;
}



export default function HomePage() {
  const { magic, user, isReady, isLoading: authLoading, error: authError } = useWallet();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');

  // Onboarding mode state
  const [appMode, setAppMode] = useState<'normal' | 'onboarding'>('normal');
  const [onboardingArtistName, setOnboardingArtistName] = useState('WELCOME, ARTIST!');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [onboardingData, setOnboardingData] = useState<any>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const { artistConfig, allArtistsConfig, isLoading: configLoading, error: configError } = useArtistConfig();
  
  const artistIdFromUrl = (searchParams.get('artist') ?? 'gosheesh') as string;
  const { featuredAsset, videoUrl, isLoading: assetLoading, error: assetError } = useFeaturedAsset(artistIdFromUrl);

  const [isMuted, setIsMuted] = useState(true);
  const [shakeActive, setShakeActive] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [userTokenBalances, setUserTokenBalances] = useState<UserTokenBalances>({});
  const [hasPurchasedDownload, setHasPurchasedDownload] = useState<boolean>(false);
  const [showExploreButton, setShowExploreButton] = useState<boolean>(false);
  const [purchaseAmountDollars, setPurchaseAmountDollars] = useState(20);
  const [includeDownload, setIncludeDownload] = useState(true);
  const [purchaseAmountArtistocks, setPurchaseAmountArtistocks] = useState(0);
  const [artistocksInput, setArtistocksInput] = useState<string>("");
  const [totalPurchasePrice, setTotalPurchasePrice] = useState(0);
  const [purchaseConfirmationData, setPurchaseConfirmationData] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showAssetsPanel, setShowAssetsPanel] = useState<boolean>(false);
  const [downloadIpfsHash, setDownloadIpfsHash] = useState<string | null>(null);
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintAmount, setMintAmount] = useState("");

  // Command system hook - handles safeword input, unlocking, and commands
  const {
    input: safewordInput,
    globalSafewordVerified,
    unlockedArtistStates,
    safewordVerified,
    onChange: handleSafewordInputChange,
    onSubmit: handleSafewordSubmit,
    updateUnlockedStates,
    setGlobalVerified
  } = useCommandSystem(
    artistIdFromUrl,
    user || null,
    artistConfig,
    showToast,
    setShowAssetsPanel,
    setAppMode,
    setOnboardingArtistName,
    appMode
  );

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const isOrbitAnimationPaused = useRef(false);

  // File upload handlers
  const handleFileSelect = useCallback((file: File) => {
    setUploadedFile(file);
    setOnboardingData(prev => ({ ...prev, uploadedFile: file }));
    console.log('File selected:', file.name, file.type, file.size);
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // Onboarding form handlers
  const handleOnboardingDataChange = useCallback((data: any) => {
    setOnboardingData(data);
    
    // Update header if displayname changes
    if (data.displayname) {
      setOnboardingArtistName(data.displayname);
    }
    
    // Update uploaded file state
    if (data.uploadedFile !== undefined) {
      setUploadedFile(data.uploadedFile);
    }
  }, []);

  const handleLivePreview = useCallback((field: string, value: any) => {
    console.log('Live preview:', field, value);
    
    // Apply changes immediately to the page
    switch(field) {
      case 'displayname':
        setOnboardingArtistName(value);
        break;
      case 'theme.fontFamily':
        document.body.style.fontFamily = value;
        // Also update header font
        const headerElement = document.querySelector('h1');
        if (headerElement) {
          headerElement.style.fontFamily = value;
        }
        break;
      case 'theme.primaryColor':
        // Apply to entire page background
        document.body.style.background = value;
        document.documentElement.style.setProperty('--primary-color', value);
        break;
      case 'theme.accentColor':
        // Apply to text and UI elements
        document.documentElement.style.setProperty('--accent-color', value);
        // Also update header text color
        const headerElement2 = document.querySelector('h1');
        if (headerElement2) {
          headerElement2.style.color = value;
        }
        break;
      case 'theme.gradientStart':
      case 'theme.gradientMiddle':
      case 'theme.gradientEnd':
        // Update gradient when any gradient color changes
        const currentTheme = onboardingData.theme || {};
        const start = field === 'theme.gradientStart' ? value : currentTheme.gradientStart || '#FAF0E6';
        const middle = field === 'theme.gradientMiddle' ? value : currentTheme.gradientMiddle || '#FDF5E6';
        const end = field === 'theme.gradientEnd' ? value : currentTheme.gradientEnd || '#F5F5DC';
        document.body.style.background = `linear-gradient(135deg, ${start} 0%, ${middle} 50%, ${end} 100%)`;
        break;
    }
  }, [onboardingData]);

  const handleSaveArtist = useCallback(async (artistData: any) => {
    console.log('Saving artist:', artistData);
    
    // Clear onboarding mode flag
    (window as any).onboardingMode = false;
    
    // TODO: Deploy contracts and save to Supabase
    showToast('🎉 Artist page created successfully!', 'success');
    setAppMode('normal');
  }, [showToast]);

  const handleExitOnboarding = useCallback(() => {
    // Clear onboarding mode flag
    (window as any).onboardingMode = false;
    
    setAppMode('normal');
    setOnboardingArtistName('WELCOME, ARTIST!');
    setOnboardingData({});
    setUploadedFile(null);
    showToast('Onboarding cancelled', 'info');
  }, [showToast]);

  const [swapFromAsset, setSwapFromAsset] = useState<string>("USD");
  const [swapToAsset, setSwapToAsset] = useState<string>("");
  const [swapFromAmount, setSwapFromAmount] = useState<string>("20.00");
  const [swapToAmount, setSwapToAmount] = useState<string>("");

  const [isVideoError, setIsVideoError] = useState(false);

  // Use the new orbit tokens hook with includeUnowned for orbit display
  const orbitTokens = useOrbitTokens(userTokenBalances, allArtistsConfig, { includeUnowned: true });





  useEffect(() => {
    if (artistConfig && artistConfig.tokenPrice > 0) {
      const usdValue = parseFloat(swapFromAmount || '0');
      const calculatedTokens = Math.floor(usdValue / artistConfig.tokenPrice);
      setPurchaseAmountArtistocks(calculatedTokens);
      setArtistocksInput(calculatedTokens > 0 ? calculatedTokens.toString() : (usdValue === 0 ? "0" : ""));
      console.log(`[SyncEffect] Synced USD: $${usdValue} to ${calculatedTokens} tokens for ${artistConfig.name} (Price: ${artistConfig.tokenPrice})`);
    } else if (artistConfig) {
      // If token price is 0 or invalid, ensure tokens are 0
      setPurchaseAmountArtistocks(0);
      setArtistocksInput("0");
      console.log(`[SyncEffect] Token price is 0 or invalid for ${artistConfig.name}. Setting tokens to 0.`);
    }
  }, [swapFromAmount, artistConfig]);

  useEffect(() => {
    const currentArtistId = artistIdFromUrl;
    setHasPurchasedDownload(false);
    setDownloadIpfsHash(null);

    // Load user data if Magic Link user exists
    if (user) {
      const storedBalances = localStorage.getItem('zeyodaUserTokenBalances');
      if (storedBalances) {
        try {
          setUserTokenBalances(JSON.parse(storedBalances));
        } catch (e) {
          console.error("Error parsing token balances from localStorage", e);
          setUserTokenBalances({});
        }
      } else {
        setUserTokenBalances({});
      }

      const storedDownloadStatus = localStorage.getItem('zeyodaHasPurchasedDownload_' + currentArtistId);
      if (storedDownloadStatus === 'true') {
        setHasPurchasedDownload(true);
        const storedIpfsHash = localStorage.getItem('zeyodaIpfsHash_' + currentArtistId);
        if (storedIpfsHash) {
          setDownloadIpfsHash(storedIpfsHash);
        }
        console.log(`[Wallet] Loaded hasPurchasedDownload for ${currentArtistId}: true`);
      } else {
        console.log(`[Wallet] No stored hasPurchasedDownload for ${currentArtistId} or not true.`);
      }

      if (allArtistsConfig) {
        // Note: Download management now handled by ERC-1155 tokens in Wallet component
        console.log('[WalletData] Download management now handled by ERC-1155 tokens');
      } else {
        console.log('[WalletData] allArtistsConfig not yet available to populate download data');
      }
    } else {
      // Clear user data when no Magic Link user
      setUserTokenBalances({});
    }
  }, [searchParams, artistIdFromUrl, allArtistsConfig, user]);

  useEffect(() => {
    if (user && artistConfig && hasPurchasedDownload) {
      if (userTokenBalances[artistConfig.tokenName] && userTokenBalances[artistConfig.tokenName] > 0) {
        setShowExploreButton(true);
      } else {
        setShowExploreButton(false);
      }
    } else {
      setShowExploreButton(false);
    }
  }, [user, artistConfig, hasPurchasedDownload, userTokenBalances]);

  useEffect(() => {
    const checkOwnership = async () => {
        console.log("🔍 Checking ownership...", { user, artistConfig: artistConfig?.contract, magic: !!magic });
        
        if (user && artistConfig && artistConfig.contract && magic) {
            try {
                const provider = new ethers.BrowserProvider(magic.rpcProvider as any);
                const contract = new ethers.Contract(artistConfig.contract, ArtistockArtifact.abi, provider);
                
                const owner = await contract.owner();
                const isUserOwner = owner.toLowerCase() === user.toLowerCase();
                
                console.log("👑 Ownership check:", {
                    contractOwner: owner,
                    userAddress: user,
                    isOwner: isUserOwner,
                    contract: artistConfig.contract
                });
                
                setIsOwner(isUserOwner);
            } catch (err) {
                console.error("[checkOwnership] Error fetching contract owner:", err);
                setIsOwner(false);
            }
        } else {
            console.log("❌ Ownership check failed - missing requirements");
            setIsOwner(false);
        }
    };
    checkOwnership();
  }, [user, artistConfig, magic]);

  // Initialize onboarding theme once when entering onboarding mode
  useEffect(() => {
    if (appMode === 'onboarding') {
      // Set global flag to suspend auto-refreshes
      (window as any).onboardingMode = true;
      
      // Apply initial onboarding theme
      document.documentElement.style.setProperty('--primary-color', '#FAF0E6');
      document.documentElement.style.setProperty('--accent-color', '#B8860B');
      document.documentElement.style.setProperty('--gradient-start', '#FAF0E6');
      document.documentElement.style.setProperty('--gradient-middle', '#FDF5E6');
      document.documentElement.style.setProperty('--gradient-end', '#F5F5DC');
      document.body.style.background = 'linear-gradient(135deg, #FAF0E6 0%, #FDF5E6 50%, #F5F5DC 100%)';
      document.body.style.fontFamily = 'Bungee, cursive';
      console.log('🎨 Applied onboarding linen canvas background');
    } else {
      // Clear onboarding flag when exiting onboarding mode
      (window as any).onboardingMode = false;
    }
  }, [appMode]); // ONLY depend on appMode, not artistConfig
  
  // Separate useEffect for normal theme application - NEVER runs during onboarding
  useEffect(() => {
    // COMPLETELY SKIP if in onboarding mode
    if (appMode === 'onboarding') {
      console.log('🚫 Skipping theme application - onboarding mode active');
      return;
    }
    
    // Normal mode: use artist theme
    const { theme } = artistConfig || {};
    if (theme) {
      document.documentElement.style.setProperty('--primary-color', theme.primaryColor || '#000000');
      if (theme.accentColor) {
        document.documentElement.style.setProperty('--accent-color', theme.accentColor);
        document.documentElement.style.setProperty(
          '--accent-color-rgb',
          theme.accentColor.match(/\d+/g)?.join(', ') ?? '0,0,0'
        );
      }
      document.documentElement.style.setProperty('--gradient-start', theme.gradientStart || '#ffffff');
      document.documentElement.style.setProperty('--gradient-middle', theme.gradientMiddle || '#cccccc');
      document.documentElement.style.setProperty('--gradient-end', theme.gradientEnd || '#999999');
      document.body.style.fontFamily = theme.fontFamily || 'Geist Sans, sans-serif';
      
      // Apply primary color to body background - NO MORE BLACK!
      document.body.style.background = theme.primaryColor || '#000000';
      console.log('🎨 Applied artist background color:', theme.primaryColor);
    }
  }, [artistConfig]); // Only when artistConfig changes, but NEVER during onboarding

  useEffect(() => {
    const dollarValueForTokens = parseFloat(swapFromAmount || '0');

    let calculatedTotal = 0;
    
    // Only add token cost if we're buying tokens
    if (dollarValueForTokens > 0) {
      calculatedTotal += dollarValueForTokens;
    }
    
    // Only add download cost if checkbox is checked and not already purchased
    if (includeDownload && !hasPurchasedDownload) {
      calculatedTotal += 1;
    }
    
    console.log("💰 Price calculation:", {
      dollarValueForTokens,
      includeDownload,
      hasPurchasedDownload,
      calculatedTotal
    });
    
    setTotalPurchasePrice(calculatedTotal);
  }, [swapFromAmount, includeDownload, hasPurchasedDownload]);



  const toggleMute = () => {
    const video = document.getElementById('artistVideo') as HTMLVideoElement;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  };

  const handlePrimaryAction = () => {
      if (!user) {
        showToast('Please sign in to continue.', 'info');
        const commandInput = document.querySelector('input[placeholder="Enter your email address to continue"]') as HTMLInputElement;
        commandInput?.focus();
        return;
      }
  
      const isUnlocked = artistConfig && unlockedArtistStates[artistConfig.name];
  
      if (isUnlocked) {
          handlePreviewSwap();
      } else {
          const safewordInputEl = document.querySelector('input[placeholder*="safeword"]') as HTMLInputElement;
          safewordInputEl?.focus();
          showToast(`To swap for ${artistConfig?.tokenName}, enter the safeword.`, 'info');
      }
  };

  const handleConfirmPurchase = async (paymentMethod?: string) => {
    if (!artistConfig || !user) {
      showToast("Artist configuration or user not loaded.", "error");
      return;
    }
    
    setIsActionLoading(true);
    showToast("Processing your purchase...", "info");

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const newBalance = BigInt(Number(userTokenBalances[artistConfig.tokenName] || 0) + purchaseAmountArtistocks);
      const updatedBalances = { ...userTokenBalances, [artistConfig.tokenName]: newBalance };
      setUserTokenBalances(updatedBalances);
      localStorage.setItem('zeyodaUserTokenBalances', JSON.stringify(updatedBalances));

      if (includeDownload) {
        setHasPurchasedDownload(true);
        const ipfsHash = 'Qm...'; // Placeholder
        setDownloadIpfsHash(ipfsHash);
        localStorage.setItem('zeyodaHasPurchasedDownload_' + artistIdFromUrl, 'true');
        localStorage.setItem('zeyodaIpfsHash_' + artistIdFromUrl, ipfsHash);
      }
      
      showToast(`Successfully purchased ${purchaseAmountArtistocks} ${artistConfig.tokenName}!`, "success");
      setShowPurchaseModal(false);

    } catch (e) {
      console.error("Purchase failed", e);
      showToast(e instanceof Error ? e.message : "An unknown error occurred.", "error");
    } finally {
      setIsActionLoading(false);
    }
  };



  const handleLogout = async () => {
    if (magic) {
      await magic.user.logout();
    }
    localStorage.removeItem('zeyodaUserEmail');
    localStorage.removeItem('zeyodaUserTokenBalances');
    localStorage.removeItem('zeyodaHasPurchasedDownload_gosheesh');
    localStorage.removeItem('zeyodaHasPurchasedDownload_jaitea');
    clearAllSafewordStorage();

    setUserTokenBalances({});
    updateUnlockedStates({});
    setHasPurchasedDownload(false);
    setShowPurchaseModal(false);
    setPurchaseAmountArtistocks(0);
    setPurchaseAmountDollars(20);
    showToast("You have been logged out. Refreshing...", "info");
    
    // Force proper Magic Link state refresh
    setTimeout(() => window.location.reload(), 1000);
  };



  const handleExploreOtherArtist = () => {
    const currentArtistId = searchParams?.get('artist') || 'gosheesh';
    const otherArtistId = currentArtistId === 'gosheesh' ? 'jaitea' : 'gosheesh';
    router.push(`/?artist=${otherArtistId}`);
  };

  const handleArtistocksInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tokensString = e.target.value;
    setArtistocksInput(tokensString);

    const numArtistocks = parseInt(tokensString || '0', 10);
    const validNumArtistocks = isNaN(numArtistocks) || numArtistocks < 0 ? 0 : numArtistocks;
    setPurchaseAmountArtistocks(validNumArtistocks);

    const effectivePrice = artistConfig?.realTimePrice ?? artistConfig?.tokenPrice ?? 0;
    if (artistConfig && effectivePrice > 0) {
      const equivalentDollars = validNumArtistocks * effectivePrice;
      if (swapFromAsset === "USD") {
        setSwapFromAmount(equivalentDollars.toFixed(2));
      }
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const usdString = e.target.value;
    setSwapFromAmount(usdString);

    const effectivePrice = artistConfig?.realTimePrice ?? artistConfig?.tokenPrice ?? 0;
    if (artistConfig && effectivePrice > 0) {
      const usdValue = parseFloat(usdString || '0');
      const calculatedTokens = Math.floor(usdValue / effectivePrice);
      setPurchaseAmountArtistocks(calculatedTokens);
      setArtistocksInput(calculatedTokens > 0 ? calculatedTokens.toString() : (usdValue === 0 ? "0" : ""));
    }
  };

  const handleIncludeDownloadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIncludeDownload(e.target.checked);
  };

  const handleDollarPurchase = async () => {
    if (!artistConfig || !magic) return;
    setIsActionLoading(true);
    showToast("Preparing transaction...", "info");
    try {
      await new Promise(res => setTimeout(res, 1500));
      showToast("This flow is for demonstration only.", "success");
    } catch (error) {
      console.error("Dollar purchase error:", error);
      showToast(error instanceof Error ? error.message : "An unknown error occurred.", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Initialize swapToAsset when artistConfig loads or FROM asset changes
  useEffect(() => {
    if (artistConfig) {
      // Always update TO asset based on FROM asset
      const defaultToAsset = swapFromAsset === "USD" ? artistConfig.tokenName : "USD";
      setSwapToAsset(defaultToAsset);
    }
  }, [artistConfig, swapFromAsset]);

  useEffect(() => {
    const calculateSwapOutput = async () => {
      if (!artistConfig || !allArtistsConfig) return;
      
      // Debug state values
      console.log('🔍 CALCULATION PATH DEBUG:', {
        swapFromAsset,
        swapToAsset,
        swapFromAmount,
        swapToAmount,
        pathCheck: {
          isUSDToToken: swapFromAsset === "USD",
          isTokenToUSD: swapFromAsset !== "USD" && swapToAsset === "USD",
          isTokenToToken: swapFromAsset !== "USD" && swapToAsset !== "USD"
        }
      });
      
      const effectivePrice = artistConfig?.realTimePrice ?? artistConfig?.tokenPrice ?? 0;
      
      // USD to Token swap (existing logic)
      if (swapFromAsset === "USD" && effectivePrice > 0) {
        const fromVal = parseFloat(swapFromAmount);
        if (!isNaN(fromVal) && fromVal > 0) {
          setSwapToAmount((fromVal / effectivePrice).toFixed(8));
          setArtistocksInput(Math.floor(fromVal / effectivePrice).toString());
        } else {
          setSwapToAmount("");
          setArtistocksInput("0");
        }
      }
      // Token to Token swap (FIXED - use AMM quotes with proper provider)
      else if (swapFromAsset !== "USD" && swapToAsset !== "USD" && artistConfig?.hasLiquidityPool && magic) {
        const fromTokenConfig = Object.values(allArtistsConfig).find(
          config => config.tokenName === swapFromAsset
        );
        
        if (fromTokenConfig?.hasLiquidityPool && fromTokenConfig?.contract && artistConfig?.contract && parseFloat(swapFromAmount) > 0) {
          try {
            // Import SwapService with proper Magic Link provider
            const { SwapService } = await import('./utils/swapUtils');
            const provider = new ethers.BrowserProvider(magic.rpcProvider as any);
            const swapService = new SwapService(provider);
            
            // Get cross-token quote: fromToken → ETH → toToken
            const fromTokenAmount = swapFromAmount;
            const ethQuote = await swapService.getEthQuote(fromTokenConfig.contract, fromTokenAmount);
            const tokenQuote = await swapService.getTokenQuote(artistConfig.contract, ethQuote.outputAmount);
            
            const expectedOutput = parseFloat(tokenQuote.outputAmount);
            setSwapToAmount(expectedOutput.toFixed(8));
            setArtistocksInput(Math.floor(expectedOutput).toString());
            
            console.log(`🔄 Cross-token quote: ${swapFromAmount} ${swapFromAsset} → ${expectedOutput.toFixed(2)} ${artistConfig.tokenName}`);
          } catch (error) {
            console.error('❌ Failed to get AMM quote:', error);
            setSwapToAmount("");
            setArtistocksInput("0");
          }
        } else {
          setSwapToAmount("");
          setArtistocksInput("0");
        }
      }
      // Token to USD swap (CASH-OUT) - FIXED PRICE CALCULATION
      else if (swapFromAsset !== "USD" && swapToAsset === "USD") {
        // Find the correct artist config for the token being cashed out
        const fromTokenConfig = Object.values(allArtistsConfig).find(
          config => config.tokenName === swapFromAsset
        );
        
        if (fromTokenConfig) {
          // Use the correct live price for the token being swapped
          const fromTokenPrice = fromTokenConfig.realTimePrice ?? fromTokenConfig.tokenPrice ?? 0;
          
          console.log(`🔍 CASH-OUT DEBUG:`, {
            swapFromAsset,
            swapFromAmount,
            fromTokenConfig: fromTokenConfig.name,
            realTimePrice: fromTokenConfig.realTimePrice,
            fallbackPrice: fromTokenConfig.tokenPrice,
            usingPrice: fromTokenPrice,
            hasLiquidityPool: fromTokenConfig.hasLiquidityPool
          });
          
          if (fromTokenPrice > 0) {
            const fromTokenAmount = parseFloat(swapFromAmount);
            if (!isNaN(fromTokenAmount) && fromTokenAmount > 0) {
              // Calculate USD value: tokenAmount * tokenPrice = USD
              const usdValue = fromTokenAmount * fromTokenPrice;
              setSwapToAmount(usdValue.toFixed(2));
              setArtistocksInput("0"); // Not applicable for cash-out
              
              console.log(`💰 Cash-out quote: ${fromTokenAmount.toLocaleString()} ${swapFromAsset} × $${fromTokenPrice.toFixed(6)} = $${usdValue.toFixed(2)} USD`);
            } else {
              setSwapToAmount("");
              setArtistocksInput("0");
            }
          } else {
            console.log(`❌ No price available for ${swapFromAsset}`);
            setSwapToAmount("");
            setArtistocksInput("0");
          }
        } else {
          console.log(`❌ No config found for ${swapFromAsset}`);
          setSwapToAmount("");
          setArtistocksInput("0");
        }
      }
      // No valid swap path
      else {
        setSwapToAmount("");
        setArtistocksInput("0");
      }
    };
    
    calculateSwapOutput();
  }, [swapFromAmount, swapFromAsset, artistConfig, allArtistsConfig, magic]);

  const handleSwapFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const usdString = e.target.value;
    setSwapFromAmount(usdString);

    if (swapFromAsset === "USD" && artistConfig && artistConfig.tokenPrice > 0) {
      const usdValue = parseFloat(usdString || '0');
      const calculatedTokens = Math.floor(usdValue / artistConfig.tokenPrice);
      setPurchaseAmountArtistocks(calculatedTokens);
      setArtistocksInput(calculatedTokens > 0 ? calculatedTokens.toString() : (usdValue === 0 ? "0" : ""));
    }
  };

  const handlePreviewSwap = () => {
    setShowPurchaseModal(true);
  };





  async function login() {
    if (!magic) return;
    try {
      console.log("🔐 Starting Magic.link login process...");
      
      const didToken = await magic.auth.loginWithEmailOTP({ email });
      const meta = await magic.user.getInfo();
      if (meta.publicAddress && meta.email) {
        localStorage.setItem('zeyodaUserEmail', meta.email);
        showToast('Logged in as ' + meta.publicAddress, 'success');
        
        // Trigger a simple refresh after a short delay to let Magic.link settle
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error("magic login failed", error);
      showToast('Login failed. Please try again.', 'error');
    }
  }

  const handleInitialMint = async () => {
    if (!artistConfig?.contract || !mintAmount) {
        showToast("Error: Missing contract address or mint amount.", 'error');
        return;
    }
    if (isNaN(Number(mintAmount)) || Number(mintAmount) <= 0) {
        showToast("Error: Please enter a valid positive number for the amount.", 'error');
        return;
    }

    if (!magic) {
        showToast("Error: Wallet provider not initialized.", 'error');
        return;
    }

    setIsMinting(true);
    showToast("Preparing to mint new tokens...", 'info');

    try {
        const provider = new ethers.BrowserProvider(magic.rpcProvider as any);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(artistConfig.contract, ArtistockArtifact.abi, signer);
        
        const amountToMint = ethers.parseUnits(mintAmount, 18);

        const tx = await contract.mint(await signer.getAddress(), amountToMint);
        
        showToast("Mint transaction sent! Waiting for confirmation...", 'info');
        await tx.wait(); 

        showToast(`Successfully minted ${mintAmount} ${artistConfig.tokenName}!`, 'success');
        setMintAmount("");

    } catch (error) {
        console.error('Error minting tokens:', error);
        showToast("Error minting tokens. Check console for details.", 'error');
    } finally {
        setIsMinting(false);
    }
  };

  // Listen for balance updates from the wallet
  useEffect(() => {
    const handleBalanceUpdate = (event: any) => {
      console.log('📊 Balance update received:', event.detail);
      const newBalances = event.detail;
      setUserTokenBalances(newBalances);
      
      // Update localStorage with new balances
      try {
        localStorage.setItem('zeyodaUserTokenBalances', JSON.stringify({
          balances: newBalances,
          timestamp: Date.now(),
          userAddress: user || ''
        }));
      } catch (error) {
        console.warn('Failed to cache balances:', error);
      }
    };

    window.addEventListener('walletBalancesUpdated', handleBalanceUpdate);
    return () => window.removeEventListener('walletBalancesUpdated', handleBalanceUpdate);
  }, [user]);

  // Load initial balances
  useEffect(() => {
    if (user) {
      const storedBalances = localStorage.getItem('zeyodaUserTokenBalances');
      if (storedBalances) {
        try {
          const parsed = JSON.parse(storedBalances);
          // Only use cached balances if they're for the current user and less than 5 minutes old
          if (parsed.userAddress === user && 
              Date.now() - parsed.timestamp < 5 * 60 * 1000) {
            setUserTokenBalances(parsed.balances);
          } else {
            // Clear outdated balances
            localStorage.removeItem('zeyodaUserTokenBalances');
            setUserTokenBalances({});
          }
        } catch (e) {
          console.error("Error parsing token balances from localStorage", e);
          setUserTokenBalances({});
        }
      } else {
        setUserTokenBalances({});
      }

      // ... rest of the user data loading code ...
    } else {
      // Clear user data when no Magic Link user
      setUserTokenBalances({});
    }
  }, [searchParams, artistIdFromUrl, allArtistsConfig, user]);

  // Calculate video source with proper fallback and type safety
  const getVideoSource = (): string => {
    if (videoUrl) return videoUrl;
    if (artistConfig?.videoSrc) return `/${artistConfig.videoSrc}`;
    // Ensure artistIdFromUrl is defined before using it
    const artistId = artistIdFromUrl || 'gosheesh';
    return `/assets/1${artistId.toUpperCase()}.mp4`;
  };
  
  const videoSource = getVideoSource();

  // Show authentication loading screen first
  if (authLoading || !isReady) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner"></div>
        <p className="auth-loading-text">Connecting wallet...</p>
      </div>
    );
  }

  // Show authentication error if present
  if (authError) {
    return (
      <div className="auth-loading">
        <div className="auth-error-icon">⚠️</div>
        <p className="auth-error-text">Authentication failed: {authError ?? 'Unknown error'}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="auth-retry-button"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Show artist config loading
  if (configLoading) {
    return <div className="flex justify-center items-center h-screen">Loading artist profile...</div>;
  }

  // Show artist config error
  if (configError) {
    return <div className="flex justify-center items-center h-screen">Error: {configError}</div>;
  }

  if (!artistConfig) {
    return <div className="flex justify-center items-center h-screen">Artist not found.</div>;
  }

  const { name: artistName, tokenName: artistTokenName, artworkTitle } = artistConfig;

  let buyButtonText = "LOADING...";
  let buyButtonDisabled = true; 
  let buyButtonAction: () => void = handlePrimaryAction;

  if (!user) {
    buyButtonText = "SELECT DOWNLOAD OR AMOUNT";
    buyButtonDisabled = true; 
  } else {
    if (globalSafewordVerified) { 
      const purchasingDownloadNow = includeDownload && !hasPurchasedDownload;
      const purchasingTokensNow = purchaseAmountArtistocks > 0;

      if (!purchasingDownloadNow && !purchasingTokensNow) {
          buyButtonDisabled = true;
          const currentArtistOwnsTokens = userTokenBalances[artistTokenName] && userTokenBalances[artistTokenName] > 0;
          if (hasPurchasedDownload && currentArtistOwnsTokens) {
              buyButtonText = `GET MORE ${artistTokenName || 'TOKENS'}`;
          } else if (hasPurchasedDownload) {
              buyButtonText = `GET ${artistTokenName || 'TOKENS'}`;
          } else if (currentArtistOwnsTokens) {
               buyButtonText = `GET DOWNLOAD + MORE ${artistTokenName || 'TOKENS'}`;
          } else {
              buyButtonText = "SELECT DOWNLOAD OR AMOUNT";
          }
      } else {
          buyButtonDisabled = false;
          let textParts = [];
          if (purchasingDownloadNow) {
              textParts.push("DOWNLOAD");
          }
          if (purchasingTokensNow) {
              textParts.push(`${purchaseAmountArtistocks} ${artistTokenName || 'TOKENS'}`);
          }
          buyButtonText = `GET ${textParts.join(' + ')} ($${totalPurchasePrice.toFixed(2)})`;
      }
    } else {
      buyButtonText = `UNLOCK ${artistTokenName?.toUpperCase() || 'TOKENS'} SWAP`; 
      buyButtonDisabled = true;
    }
  }
  if (showPurchaseModal) buyButtonDisabled = true;

  return (
    <UsdBalanceProvider userAddress={user || null}>
      <div className="flex min-h-screen flex-col items-center justify-between p-24 relative bg-primary text-white font-sans">
        <div id="particles" className="cosmic-particles"></div>

        {user && (
          <Wallet
            artistConfig={artistConfig}
            allArtistsConfig={allArtistsConfig}
            userTokenBalances={userTokenBalances}
            showAssetsPanel={showAssetsPanel}
            onClose={() => setShowAssetsPanel(false)}
            userAddress={user}
            magic={magic}
          />
        )}

        <header className="app-header">
          {user ? (
            <div className="flex items-center gap-4">
              <div 
                className="text-sm cursor-pointer bg-gray-800 px-3 py-2 rounded-md hover:bg-gray-700"
                onClick={() => setShowFullAddress(!showFullAddress)}
              >
                <p title={user}>
                  ✅ Connected: {showFullAddress ? user : `${user.slice(0, 6)}...${user.slice(-4)}`}
                </p>
              </div>
              <button onClick={handleLogout} className="logout-button">
                Data Reset
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="border p-2 rounded text-black"
              />
              <button onClick={login} className="bg-blue-600 text-white px-4 py-2 rounded">
                Login
              </button>
            </div>
          )}
        </header>

        <main className="app-main">
          <div className="text-center">
              <>
                <h1 
                  className="text-2xl md:text-3xl font-bold tracking-wider mb-4 cursor-pointer hover:opacity-80 transition-opacity" 
                  style={{ 
                    fontFamily: appMode === 'onboarding' ? 'Bungee, cursive' : artistConfig.theme.fontFamily, 
                    color: appMode === 'onboarding' ? '#B8860B' : artistConfig.theme.accentColor 
                  }}
                  onDoubleClick={() => {
                    if (appMode === 'onboarding') {
                      const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                      input?.focus();
                    }
                  }}
                  title={appMode === 'onboarding' ? 'Double-click to edit' : ''}
                >
                  {appMode === 'onboarding' ? onboardingArtistName : artistConfig.displayName}
                </h1>
  
                <div className="relative w-full max-w-4xl mx-auto">
                  {appMode === 'onboarding' ? (
                    // Onboarding: Drag & drop upload zone
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*,video/*,image/*,.txt,.md,.pdf"
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                      <div 
                        className="w-full aspect-video bg-white bg-opacity-20 rounded-lg border-2 border-dashed border-yellow-600 flex flex-col items-center justify-center p-8 hover:bg-opacity-30 transition-all duration-200 cursor-pointer"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={handleUploadClick}
                      >
                        {uploadedFile ? (
                          // Show uploaded file info
                          <>
                            <div className="text-4xl mb-4">🎉</div>
                            <div className="text-lg font-bold mb-2" style={{ color: '#B8860B', fontFamily: 'Bungee, cursive' }}>
                              FILE UPLOADED!
                            </div>
                            <div className="text-sm mb-2" style={{ color: '#B8860B' }}>
                              {uploadedFile.name}
                            </div>
                            <div className="text-xs opacity-60" style={{ color: '#B8860B' }}>
                              {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB • {uploadedFile.type || 'Unknown type'}
                            </div>
                            <button 
                              className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors text-sm"
                              style={{ backgroundColor: '#B8860B' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setUploadedFile(null);
                              }}
                            >
                              Change File
                            </button>
                          </>
                        ) : (
                          // Show upload prompt
                          <>
                            <div className="text-6xl mb-4">📁</div>
                            <div className="text-xl font-bold mb-2" style={{ color: '#B8860B', fontFamily: 'Bungee, cursive' }}>
                              DROP YOUR CONTENT HERE
                            </div>
                            <div className="text-sm mb-4 opacity-80" style={{ color: '#B8860B' }}>
                              Audio, video, images, text - any format
                            </div>
                            <button 
                              className="px-6 py-3 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors"
                              style={{ backgroundColor: '#B8860B' }}
                            >
                              Or Click to Upload
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    // Normal mode: Video with orbital tokens
                    <>
                      <ArtistVideo
                        isMuted={isMuted}
                        isVideoError={isVideoError}
                        setIsVideoError={setIsVideoError}
                        toggleMute={toggleMute}
                        videoContainerRef={videoContainerRef}
                        videoSrc={videoSource}
                      />
                      <ThemeOrbitRenderer
                        artistConfig={artistConfig}
                        orbitTokens={orbitTokens}
                        videoContainerRef={videoContainerRef}
                        isOrbitAnimationPaused={isOrbitAnimationPaused}
                        allArtistsConfig={allArtistsConfig}
                      />
                    </>
                  )}
                </div>
              </>
          </div>

          {isOwner && (
            <OwnerControls
              isMinting={isMinting}
              mintAmount={mintAmount}
              setMintAmount={setMintAmount}
              handleInitialMint={handleInitialMint}
            />
          )}

          {appMode !== 'onboarding' && (
            <PurchaseFlow
              user={user}
              artistConfig={artistConfig}
              allArtistsConfig={allArtistsConfig}
              isActionLoading={isActionLoading}
              hasPurchasedDownload={hasPurchasedDownload}
              globalSafewordVerified={globalSafewordVerified}
              purchaseConfirmationData={purchaseConfirmationData}
              swapFromAsset={swapFromAsset}
              setSwapFromAsset={setSwapFromAsset}
              swapToAsset={swapToAsset}
              setSwapToAsset={setSwapToAsset}
              unlockedArtistStates={unlockedArtistStates}
              userTokenBalances={userTokenBalances}
              swapFromAmount={swapFromAmount}
              handleSwapFromAmountChange={handleSwapFromAmountChange}
              artistocksInput={artistocksInput}
              handleArtistocksInputChange={handleArtistocksInputChange}
              includeDownload={includeDownload}
              handleIncludeDownloadChange={handleIncludeDownloadChange}
              totalPurchasePrice={totalPurchasePrice}
              handlePreviewSwap={handlePreviewSwap}
              handleDollarPurchase={handleDollarPurchase}
              setShakeActive={setShakeActive}
              swapToAmount={swapToAmount}
            />
          )}

          <div className="action-section text-center mb-4">
            {!user && (
              <div id="login-prompts-container" className="login-prompts mt-6">
                <h3 id="accessHeadline" className="access-headline">
                  Sign in to purchase {artistTokenName || 'tokens'}
                </h3>
                <div className="social-login-container mt-3">
                  <p className="login-separator">or continue with</p>
                  <div className="social-buttons">
                    <button className="login-btn twitter" onClick={() => alert('Twitter login coming soon!')}>X (Twitter)</button>
                    <button className="login-btn gmail" onClick={() => alert('Gmail login coming soon!')}>Gmail</button>
                    <button className="login-btn phone" onClick={() => alert('Phone login coming soon!')}>Phone</button>
                    <button className="login-btn facebook" onClick={() => alert('Facebook login coming soon!')}>Facebook</button>
                  </div>
                </div>
              </div>
            )}

            {user && showPurchaseModal && artistConfig && (
              <div className="purchase-modal-overlay">
                <div className="purchase-modal p-6 bg-gray-800 bg-opacity-80 backdrop-blur-md shadow-2xl rounded-xl border border-gray-700">
                  <h2 className="text-2xl font-bold mb-3 text-center text-white">CONFIRM PURCHASE: <span className="text-accentColor">{artistConfig.tokenName.toUpperCase()}</span></h2>
                  <p className="text-center text-gray-300 mb-6 text-sm">
                    You are about to acquire {includeDownload && !hasPurchasedDownload ? <><span className="font-semibold text-white">1 x Featured Download</span> and </> : ''}
                    {purchaseAmountArtistocks > 0 ? <><span className="font-semibold text-white">{purchaseAmountArtistocks} {artistConfig.tokenName}s</span> </> : (includeDownload && !hasPurchasedDownload ? '' : 'items')}
                    for the digital asset: <strong className="text-white">{artworkTitle}</strong>.
                  </p>
                  <div className="price-breakdown mb-6 p-4 bg-gray-900 bg-opacity-70 rounded-lg">
                    <p className="text-center text-xl font-semibold text-white">TOTAL PRICE: <span className="text-green-400">${totalPurchasePrice.toFixed(2)}</span></p>
                  </div>
                  <div className="mock-payment-options mt-4 mb-6">
                    <h4 className="text-lg font-semibold mb-4 text-center text-gray-200">CHOOSE PAYMENT METHOD:</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { name: 'Venmo', icon: 'V' }, 
                        { name: 'PayPal', icon: 'P' }, 
                        { name: 'Crypto', icon: '₿' }, 
                        { name: 'Credit/Debit', icon: '💳' }
                      ].map(method => (
                        <button 
                          key={method.name}
                          onClick={() => handleConfirmPurchase(method.name)} 
                          className="payment-option-btn group flex flex-col items-center justify-center p-3 bg-gray-700 hover:bg-accentColor text-white rounded-lg transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accentColor focus:ring-opacity-50 shadow-md hover:shadow-lg"
                        >
                          <span className="text-2xl mb-1 group-hover:text-white">{method.icon}</span>
                          <span className="text-xs sm:text-sm group-hover:text-white">{method.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="purchase-actions mt-6 text-center">
                    <button 
                      onClick={() => setShowPurchaseModal(false)} 
                      className="cancel-purchase-btn px-8 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors duration-150 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {user && purchaseConfirmationData && (
              <div className="purchase-confirmation-section mock-ui-section p-6 my-6 border border-gray-700 rounded-xl bg-gray-800 bg-opacity-80 backdrop-blur-md shadow-2xl max-w-lg mx-auto">
                <h3 className="text-3xl font-bold mb-4 text-center text-green-400 glow-text-green">PURCHASE SUCCESSFUL!</h3>
                <div className="text-left text-gray-300 space-y-2 text-sm bg-gray-900 bg-opacity-70 p-4 rounded-lg mb-6">
                  <p className="whitespace-pre-line leading-relaxed">{purchaseConfirmationData.replace("Purchase Confirmed! ", "")}</p>
                </div>
                <button
                  onClick={() => {
                    setPurchaseConfirmationData(null);
                    handleExploreOtherArtist();
                  }}
                  className="mt-4 px-6 py-3 bg-accentColor hover:bg-opacity-80 text-white font-bold rounded-lg w-full custom-buy-button text-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accentColor focus:ring-opacity-50"
                >
                  Explore {artistName?.toLowerCase() === 'gosheesh' ? 'JAI TEA' : 'GOSHEESH'}
                </button>
              </div>
            )}

            {user && !globalSafewordVerified && showExploreButton && !purchaseConfirmationData && (
              <div className="text-center p-4 my-6 bg-yellow-500 bg-opacity-20 rounded-lg max-w-md mx-auto">
                <p className="text-lg mb-3 text-white">
                  You do not have permanent access to this artist's content.
                </p>
                <button 
                  onClick={handleExploreOtherArtist}
                  className="custom-buy-button explore-artists-button"
                >
                  Explore {artistName?.toLowerCase() === 'gosheesh' ? 'JAI TEA' : 'GOSHEESH'}
                </button>
              </div>
            )}
          </div>

          {/* Onboarding chat appears above input - like purchase slider */}
          {appMode === 'onboarding' && (
            <OnboardingPanel
              artistName={onboardingArtistName}
              onArtistNameChange={setOnboardingArtistName}
              onSave={handleSaveArtist}
              onExit={handleExitOnboarding}
            />
          )}

          <div 
            className={`unified-input-container mock-ui-section p-4 border-t-2 border-gray-700 mt-8 ${!user && shakeActive ? 'shake' : ''}`}
          >
            {user && (
              <h3 className="text-xl font-semibold mb-3 text-center">Chat / Command</h3>
            )}
            <div className="flex items-center max-w-xl mx-auto">
              <input
                type={user ? "text" : "email"}
                value={user ? safewordInput : email}
                onChange={user ? handleSafewordInputChange : (e) => setEmail(e.target.value)}
                placeholder={
                  user 
                    ? (appMode === 'onboarding' 
                        ? (uploadedFile 
                            ? "Type your artist name or try: gold, emerald, sapphire..." 
                            : "Type your artist name, upload content, or try colors: gold, emerald...")
                        : "Type command, search, or safeword...")
                    : "Enter your email address to continue"
                }
                className="flex-grow p-3 border border-gray-600 rounded-l-lg bg-gray-900 bg-opacity-70 text-white focus:ring-accentColor focus:border-accentColor backdrop-blur-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (!user) {
                      login();
                    } else {
                      handleSafewordSubmit();
                    }
                  }
                }}
                aria-label={user ? "Chat or command input" : "Email address input"}
              />
              <button
                onClick={() => {
                  if (!user) {
                    login();
                  } else {
                    handleSafewordSubmit();
                  }
                }}
                className="p-3 bg-accentColor text-white rounded-r-lg hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-accentColor focus:ring-opacity-50"
              >
                {user ? "Send" : "Continue"}
              </button>
            </div>
          </div>
        </main>

        {/* Top-left wallet button - MOVED TO END TO ENSURE TOP Z-INDEX */}
        {user && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowAssetsPanel(!showAssetsPanel);
            }}
            className="fixed top-4 left-4 z-[9999] bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-white font-medium transition-colors shadow-lg cursor-pointer"
            type="button"
          >
            💰 {showAssetsPanel ? 'Close' : 'Wallet'}
          </button>
        )}
      </div>
    </UsdBalanceProvider>
  );
}
