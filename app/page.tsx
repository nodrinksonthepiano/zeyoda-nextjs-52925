"use client";
import Image from "next/image";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import Wallet from './components/Wallet';
import dynamic from 'next/dynamic';
import { useWallet } from './components/MagicProvider';
import { useToast } from './contexts/ToastContext';
import { ethers } from "ethers";
import erc20Abi from '../contracts/Artistock.json';
import ArtistockArtifact from '../artifacts/contracts/Artistock.sol/Artistock.json';

interface ArtistConfig {
  name: string;
  displayName: string;
  tokenName: string;
  artworkTitle: string;
  artworkYear: string;
  tokenPrice: number;
  videoSrc: string;
  contract?: string;
  theme: {
    primaryColor: string;
    accentColor: string;
    gradientStart: string;
    gradientMiddle: string;
    gradientEnd: string;
    fontFamily: string;
  };
  orbitalTokens: Array<{ name: string; angle: number; artistId?: string; x?: number; y?: number; z?: number; opacity?: number; scale?: number; blur?: number; isVisible?: boolean; element?: HTMLElement | null }>;
}

interface PriceDetails {
  currentDisplayPrice: number;
  artistShare: number;
  platformShare: number;
  investorShare: number;
}

interface UserTokenBalances {
  [tokenSymbol: string]: number;
}

interface PurchasedDownloadInfo {
  artistId: string;
  artworkTitle: string;
  artistDisplayName: string;
  ipfsHash: string | null;
}

const ORBIT_SPEED = 0.3; // Radians per second - adjust as needed
const PERSPECTIVE_BASE = 1000; // For perspective calculations

export default function HomePage() {
  const { magic, user } = useWallet();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');

  const searchParams = useSearchParams();
  const router = useRouter();
  const artistIdFromUrl = searchParams.get('artist') || 'gosheesh';
  const [artistConfig, setArtistConfig] = useState<ArtistConfig | null>(null);
  const [allArtistsConfig, setAllArtistsConfig] = useState<{[key: string]: ArtistConfig} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [shakeActive, setShakeActive] = useState(false);
  const [priceDetails, setPriceDetails] = useState<PriceDetails | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [userTokenBalances, setUserTokenBalances] = useState<UserTokenBalances>({});
  const [safewordInput, setSafewordInput] = useState('');
  const [unlockedArtistStates, setUnlockedArtistStates] = useState<{ [key: string]: boolean }>({});
  const [hasPurchasedDownload, setHasPurchasedDownload] = useState<boolean>(false);
  const [showExploreButton, setShowExploreButton] = useState<boolean>(false);
  const [purchaseAmountDollars, setPurchaseAmountDollars] = useState(20);
  const [includeDownload, setIncludeDownload] = useState(true);
  const [purchaseAmountArtistocks, setPurchaseAmountArtistocks] = useState(0);
  const [artistocksInput, setArtistocksInput] = useState<string>("");
  const [totalPurchasePrice, setTotalPurchasePrice] = useState(0);
  const [purchaseConfirmationData, setPurchaseConfirmationData] = useState<string | null>(null);
  const [safewordVerified, setSafewordVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAssetsPanel, setShowAssetsPanel] = useState<boolean>(false);
  const [downloadIpfsHash, setDownloadIpfsHash] = useState<string | null>(null);
  const [globalSafewordVerified, setGlobalSafewordVerified] = useState(false);
  const [allPurchasedDownloads, setAllPurchasedDownloads] = useState<PurchasedDownloadInfo[]>([]);
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  // Ref for the video container to dynamically adjust orbit
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const tokenElementRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const isOrbitAnimationPaused = useRef(false);

  // State for the Swap Interface
  const [swapFromAsset, setSwapFromAsset] = useState<string>("USD");
  const [swapToAsset, setSwapToAsset] = useState<string>("");
  const [swapFromAmount, setSwapFromAmount] = useState<string>("20.00");
  const [swapToAmount, setSwapToAmount] = useState<string>("");

  // State for Video Player
  const [isVideoError, setIsVideoError] = useState(false);

  // State for dynamically generated orbital tokens based on user's assets
  const [dynamicOrbitalTokens, setDynamicOrbitalTokens] = useState<ArtistConfig['orbitalTokens']>([]);

  // Ensured: orbitAngleOffset is ONLY defined here as useState
  const [orbitAngleOffset, setOrbitAngleOffset] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseFloat(localStorage.getItem('zeyodaOrbitAngleOffset') || '0');
    }
    return 0;
  });

  // === BEGIN NEW useEffect: Sync USD amount with token calculation ===
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
  }, [swapFromAmount, artistConfig]); // Runs when swapFromAmount or artistConfig changes
  // === END NEW useEffect ===

  useEffect(() => {
    const currentArtistId = artistIdFromUrl;
    setHasPurchasedDownload(false);
    setDownloadIpfsHash(null);

    const storedEmail = localStorage.getItem('zeyodaUserEmail');
    if (storedEmail) {
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

      const storedUnlockedArtists = localStorage.getItem('zeyodaUnlockedArtists');
      let initialUnlockedStates: { [key: string]: boolean } = {};
      let anyArtistUnlocked = false;
      if (storedUnlockedArtists) {
        try {
          initialUnlockedStates = JSON.parse(storedUnlockedArtists);
          // Check if any artist in the stored object is true
          for (const artistKey in initialUnlockedStates) {
            if (initialUnlockedStates.hasOwnProperty(artistKey) && initialUnlockedStates[artistKey]) {
              anyArtistUnlocked = true;
              break;
            }
          }
        } catch (e) {
          console.error("Error parsing unlocked artists from localStorage", e);
          setUnlockedArtistStates({}); // Reset to empty if error
        }
      }
      setUnlockedArtistStates(initialUnlockedStates);
      setGlobalSafewordVerified(anyArtistUnlocked);

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
        const downloads: PurchasedDownloadInfo[] = [];
        for (const id in allArtistsConfig) {
          if (localStorage.getItem('zeyodaHasPurchasedDownload_' + id) === 'true') {
            downloads.push({
              artistId: id,
              artworkTitle: allArtistsConfig[id].artworkTitle,
              artistDisplayName: allArtistsConfig[id].displayName,
              ipfsHash: localStorage.getItem('zeyodaIpfsHash_' + id) || null,
            });
          }
        }
        setAllPurchasedDownloads(downloads);
        console.log('[WalletData] Populated allPurchasedDownloads:', downloads);
      } else {
        console.log('[WalletData] allArtistsConfig not yet available to populate allPurchasedDownloads');
        setAllPurchasedDownloads([]); // Clear if config is not ready
      }
    } else {
      setUserTokenBalances({});
      setUnlockedArtistStates({});
      setGlobalSafewordVerified(false); // Reset if not logged in
      setAllPurchasedDownloads([]); // Clear if not logged in
    }
  }, [searchParams, artistIdFromUrl, allArtistsConfig]);

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
    async function fetchConfig() {
      try {
        console.log(`[fetchConfig] Attempting to fetch configuration for artistIdFromUrl: '${artistIdFromUrl}'`);
        setArtistConfig(null);
        setError(null);

        const cacheBuster = `?v=${new Date().getTime()}`;
        const response = await fetch(`/artists/config.json${cacheBuster}`, { cache: 'no-store' });
        console.log(`[fetchConfig] Response received for /artists/config.json${cacheBuster}. Status: ${response.status}, OK: ${response.ok}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[fetchConfig] HTTP error! Status: ${response.status}. Response text: ${errorText}`);
          throw new Error(`HTTP error! status: ${response.status} while fetching /artists/config.json. Server said: ${errorText}`);
        }
        
        const responseText = await response.text();
        console.log("[fetchConfig] Raw response text from /artists/config.json" + cacheBuster + ":\n", responseText);

        let data;
        try {
          data = JSON.parse(responseText);
          console.log("[fetchConfig] Successfully parsed data from /artists/config.json" + cacheBuster + ". Initial parsed data object:\n", JSON.stringify(data, null, 2));
        } catch (parseError) {
          console.error("[fetchConfig] JSON parsing error for /artists/config.json" + cacheBuster + ":", parseError);
          console.error("[fetchConfig] Raw text that failed to parse:", responseText); // Log the text that failed
          throw new Error("Failed to parse artist configuration.");
        }

        if (!data || !data.artists) {
          console.warn("[fetchConfig] data.artists is missing or data is null/undefined after parsing config.json. Data object received:", data);
          setAllArtistsConfig({}); 
          throw new Error("Parsed artist configuration is invalid or missing 'artists' property.");
        }
        
        console.log("[fetchConfig] 'data.artists' object keys before setting to state:", Object.keys(data.artists));
        setAllArtistsConfig(data.artists); // Set all artists first
        
        // Now check for the specific artist ID
        const currentArtistKey = artistIdFromUrl;
        console.log(`[fetchConfig] Checking for artist key: '${currentArtistKey}' in parsed data.artists.`);

        if (data.artists.hasOwnProperty(currentArtistKey)) {
          const config = data.artists[currentArtistKey];
          console.log(`[fetchConfig] Successfully found config for '${currentArtistKey}'.`);
          const initializedTokens = config.orbitalTokens.map((token: any) => ({ 
            ...token, 
            x: 0, y: 0, z: 0, opacity: 1, scale: 1, blur: 0, isVisible: true 
          }));
          setArtistConfig({...config, orbitalTokens: initializedTokens });
        } else {
          const availableKeys = Object.keys(data.artists).join(', ') || 'No keys found';
          const dataSnapshot = JSON.stringify(data); 
          const dataArtistsSnapshot = JSON.stringify(data.artists);

          console.error(`[fetchConfig] Artist configuration not found for ID: '${currentArtistKey}'. 
                         Available artist IDs in data.artists: ${availableKeys}. 
                         Full data object snapshot: ${dataSnapshot}. 
                         data.artists snapshot: ${dataArtistsSnapshot}.`);
          throw new Error(`Artist configuration not found for ID: '${currentArtistKey}'. Valid IDs in loaded config: ${availableKeys}`);
        }
      } catch (e) {
        console.error(`[fetchConfig] General error during fetchConfig for ${artistIdFromUrl}:`, e);
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError("An unknown error occurred while fetching artist config.");
        }
      }
    }

    fetchConfig();
  }, [searchParams, artistIdFromUrl]);

  // This is the animation useEffect block. We are refining its initial guard clauses.
  useEffect(() => {
    const videoElement = videoContainerRef.current;
    if (!artistConfig || !artistConfig.orbitalTokens || artistConfig.orbitalTokens.length === 0 || !videoElement) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      tokenElementRefs.current.forEach(el => {
        if (el) {
          el.style.transform = 'translate3d(0px,0px,-10000px) scale(0)';
          el.style.opacity = '0';
        }
      });
      console.log("[AnimateOrbit] Bailing: Missing artistConfig, tokens, or videoElement.");
      return;
    }
    console.log("[AnimateOrbit] Proceeding with animation. Tokens from artistConfig count:", artistConfig.orbitalTokens.length);

    let lastTimestamp = 0;
    const animate = (timestamp: number) => {
      if (!lastTimestamp) {
        lastTimestamp = timestamp;
        animationFrameIdRef.current = requestAnimationFrame(animate);
        return;
      }
      const deltaTime = (timestamp - lastTimestamp) * 0.001; 
      lastTimestamp = timestamp;

      if (!isOrbitAnimationPaused.current) {
        setOrbitAngleOffset(prevOffset => (prevOffset + ORBIT_SPEED * deltaTime));
      }

      // Get the actual content element (video or fallback)
      let contentElement: HTMLElement | null = document.getElementById('artistVideo');
      if (!contentElement || contentElement.offsetParent === null) { // Check if displayed
        contentElement = document.querySelector('.video-fallback');
      }

      if (!contentElement) { // If no content element is found, bail on this frame
        animationFrameIdRef.current = requestAnimationFrame(animate);
        return;
      }

      const contentWidth = contentElement.offsetWidth;
      const contentHeight = contentElement.offsetHeight;
      
      let radiusX, radiusY;
      const horizontalPadding = 120; // For a wider horizontal orbit
      const verticalPadding = 70;   // Keep vertical padding, creates elliptical effect

      if (contentWidth > 0 && contentHeight > 0) {
        radiusX = (contentWidth / 2) + horizontalPadding;
        radiusY = (contentHeight / 2) + verticalPadding;
      } else {
        // Fallback if content dimensions are zero (e.g. not loaded yet)
        const fallbackRadiusX = 250; // Wider fallback
        const fallbackRadiusY = 180;
        radiusX = fallbackRadiusX;
        radiusY = fallbackRadiusY;
      }

      const currentGlobalAngleOffset = orbitAngleOffset; 
      const tokensToAnimate = artistConfig.orbitalTokens; 

      tokensToAnimate.forEach((tokenData, index) => {
        const tokenElement = tokenElementRefs.current[index] as HTMLElement;
        if (!tokenElement) {
            return;
        }

        const tokenSpecificInitialAngle = (typeof tokenData.angle === 'number' ? tokenData.angle : 0) * (Math.PI / 180); 
        const angle = currentGlobalAngleOffset + tokenSpecificInitialAngle;

        // Use radiusX and radiusY for elliptical orbit
        const x = radiusX * Math.cos(angle);
        const y = radiusY * Math.sin(angle);
        const z = -20; 

        const baseScale = 0.8; // Base scale of tokens
        const hoverEffectScaleMultiplier = 1.25; // Multiplier for hover effect

        let currentScaleTarget = baseScale;
        if (tokenElement.getAttribute('data-hovered') === 'true') {
          currentScaleTarget = baseScale * hoverEffectScaleMultiplier;
        }
        
        const perspectiveValue = PERSPECTIVE_BASE; 
        const perspectiveFactor = perspectiveValue / (perspectiveValue - z); 
        const finalScaleToApply = currentScaleTarget * perspectiveFactor;
        
        tokenElement.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) scale(${finalScaleToApply.toFixed(2)})`;
        tokenElement.style.opacity = '1'; // Ensure full opacity during animation
        tokenElement.style.filter = 'blur(0px)';
        tokenElement.style.zIndex = '15'; 
      });

      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    animationFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [artistConfig, orbitAngleOffset]);

  useEffect(() => {
    if (artistConfig && artistConfig.theme) {
      const { theme } = artistConfig;
      document.documentElement.style.setProperty('--primary-color', theme.primaryColor);
      document.documentElement.style.setProperty('--accent-color', theme.accentColor);
      document.documentElement.style.setProperty('--accent-color-rgb', theme.accentColor.match(/\d+/g)?.join(', ') || '64, 115, 255');
      document.documentElement.style.setProperty('--gradient-start', theme.gradientStart);
      document.documentElement.style.setProperty('--gradient-middle', theme.gradientMiddle);
      document.documentElement.style.setProperty('--gradient-end', theme.gradientEnd);
      document.body.style.fontFamily = theme.fontFamily || 'Geist Sans, sans-serif';
    }
  }, [artistConfig?.theme]);

  useEffect(() => {
    const dollarValueForTokens = parseFloat(swapFromAmount || '0');

    let calculatedTotal = dollarValueForTokens;
    if (includeDownload && !hasPurchasedDownload) {
      calculatedTotal += 1;
    }
    setTotalPurchasePrice(calculatedTotal);
  }, [swapFromAmount, includeDownload, hasPurchasedDownload]);

  const handleSafewordAutosubmit = () => {
    const currentArtistId = artistIdFromUrl;

    // Ensure we have what we need to avoid running on initial load or with bad data
    if (user && artistConfig && safewordInput.trim().toLowerCase() === 'artistocks') {
      console.log(`[Safeword] Correct safeword detected for artist ${currentArtistId}`);
      
      // Trigger unlock logic
      setSafewordVerified(true);
      const newUnlockedStates = { ...unlockedArtistStates, [currentArtistId]: true };
      setUnlockedArtistStates(newUnlockedStates);
      setGlobalSafewordVerified(true);
      localStorage.setItem('zeyodaUnlockedArtists', JSON.stringify(newUnlockedStates));
      
      // Provide feedback and clear input
      showToast(`Artist "${artistConfig.displayName}" unlocked!`, 'success');
      setSafewordInput('');
    }
  };

  useEffect(() => {
    handleSafewordAutosubmit();
  }, [safewordInput, user, artistConfig, artistIdFromUrl, unlockedArtistStates]);

  const toggleMute = () => {
    const video = document.getElementById('artistVideo') as HTMLVideoElement;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  };
  const toggleFullscreen = () => {
    const video = document.getElementById('artistVideo') as HTMLVideoElement;
    if (video) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        video.requestFullscreen().catch(err => {
          alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
      }
    }
  };
  const calculatePriceDetails = (basePrice: number): PriceDetails => {
    const currentDisplayPrice = basePrice;
    return { currentDisplayPrice, artistShare: 0, platformShare: 0, investorShare: 0 };
  };
  const handleDownloadVideo = () => {
    if (!user) {
      showToast('Please sign in to download.', 'info');
      const commandInput = document.querySelector('input[placeholder="Enter your email address to continue"]') as HTMLInputElement;
      commandInput?.focus();
      return;
    }
    if (downloadIpfsHash) {
        const url = `https://ipfs.io/ipfs/${downloadIpfsHash}`;
        window.open(url, '_blank');
    } else {
        showToast("Download is not available at this time.", "error");
    }
  };

  const handlePrimaryAction = () => {
      if (!user) {
        showToast('Please sign in to continue.', 'info');
        const commandInput = document.querySelector('input[placeholder="Enter your email address to continue"]') as HTMLInputElement;
        commandInput?.focus();
        return;
      }
  
      // Determine if the user has unlocked this specific artist
      const isUnlocked = artistConfig && unlockedArtistStates[artistConfig.name];
  
      if (isUnlocked) {
          // If unlocked, the primary action should be to show the purchase/swap modal
          handlePreviewSwap();
      } else {
          // If not unlocked, prompt them with the safeword input
          const safewordInputEl = document.querySelector('input[placeholder*="safeword"]') as HTMLInputElement;
          safewordInputEl?.focus();
          showToast(`To swap for ${artistConfig?.tokenName}, enter the safeword.`, 'info');
      }
  };

  const handleConfirmPurchase = async (paymentMethod?: string) => {
    if (!user || !artistConfig?.contract) {
      showToast("User or artist details are missing. Cannot proceed.", "error");
      return;
    }
    
    console.log(`Attempting purchase with ${paymentMethod}. Total: $${totalPurchasePrice.toFixed(2)}`);
    setIsLoading(true);

    try {
      const response = await fetch('/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractAddress: artistConfig.contract,
          userAddress: user,
          amount: purchaseAmountArtistocks,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'An unknown error occurred during minting.');
      }

      // SUCCESS CASE
      console.log(`Mint successful! Tx: ${data.txHash}`);
      const artistTokenName = artistConfig.tokenName || 'ARTISTOCK';
      let confirmationMessage = `${purchaseAmountArtistocks.toLocaleString()} ${artistTokenName}`;
      
      showToast('Purchase successful!', 'success');

      // Update balance
      const newBalances = { ...userTokenBalances };
      newBalances[artistTokenName] = (newBalances[artistTokenName] || 0) + purchaseAmountArtistocks;
      setUserTokenBalances(newBalances);
      localStorage.setItem('zeyodaUserTokenBalances', JSON.stringify(newBalances));

      // Handle download if included
      if (includeDownload && !hasPurchasedDownload) {
        setHasPurchasedDownload(true);
        const ipfsHash = "bafybeigodx24h6vchaybce32klc4rnzsvlqg2ks6n7nbp6lowkvh734wcu"; // Replace with actual hash
        setDownloadIpfsHash(ipfsHash);
        const currentArtistId = artistIdFromUrl;
        localStorage.setItem('zeyodaHasPurchasedDownload_' + currentArtistId, 'true');
        localStorage.setItem('zeyodaIpfsHash_' + currentArtistId, ipfsHash);
        confirmationMessage += " + Permanent Download";
        
        const newDownloadInfo: PurchasedDownloadInfo = {
          artistId: currentArtistId,
          artworkTitle: artistConfig?.artworkTitle || 'Unknown Title',
          artistDisplayName: artistConfig?.displayName || 'Unknown Artist',
          ipfsHash: ipfsHash,
        };
        
        // Avoid adding duplicates
        if (!allPurchasedDownloads.some(d => d.artistId === currentArtistId)) {
          setAllPurchasedDownloads([...allPurchasedDownloads, newDownloadInfo]);
        }
      }
      
      setPurchaseConfirmationData(confirmationMessage);

    } catch (error: any) {
      console.error("Minting failed", error);
      showToast(`Minting failed: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
      setShowPurchaseModal(false);
    }
  };

  const handleSafewordSubmit = () => {
    const input = safewordInput.trim().toLowerCase();
    if (!input) return; // Do nothing if the user submits an empty string

    // Command: Navigate to Create Profile page
    if (input === 'zeyoda') {
      router.push('/create');
      setSafewordInput('');
      return;
    }
    
    // Command: Show/Hide Portfolio
    if (input === '/wallet' || input === '/portfolio') {
      setShowAssetsPanel(true);
      setSafewordInput('');
      return;
    }
    if (input === '/exit' || input === '/close') {
      setShowAssetsPanel(false);
      setSafewordInput('');
      return;
    }

    // Fallback for safeword if Enter is pressed quickly
    const correctSafeword = "artistocks";
    if (input === correctSafeword) {
      // The useEffect handles the main success case with the alert.
      // This is just a silent fallback to prevent an error message on a race condition.
      console.log(`[Safeword] Correct safeword submitted via Enter for artist ${artistIdFromUrl}`);
      setSafewordVerified(true);
      const newUnlockedStates = { ...unlockedArtistStates, [artistIdFromUrl]: true };
      setUnlockedArtistStates(newUnlockedStates);
      setGlobalSafewordVerified(true);
      localStorage.setItem('zeyodaUnlockedArtists', JSON.stringify(newUnlockedStates));
      setSafewordInput('');
      return;
    }

    // If no command or safeword matches, show a generic message
    showToast(`Command not recognized: "${safewordInput}"`, 'error');
    setSafewordInput('');
  };

  const handleLogout = async () => {
    if (magic) {
      await magic.user.logout();
    }
    localStorage.removeItem('zeyodaUserEmail');
    localStorage.removeItem('zeyodaUserTokenBalances');
    localStorage.removeItem('zeyodaHasPurchasedDownload_gosheesh');
    localStorage.removeItem('zeyodaHasPurchasedDownload_jaitea');
    localStorage.removeItem('zeyodaUnlockedArtists');

    setUnlockedArtistStates({});
    setUserTokenBalances({});
    setHasPurchasedDownload(false);
    setShowPurchaseModal(false);
    setPriceDetails(null);
    setShowExploreButton(false);
    setIncludeDownload(true);
    setSwapFromAmount("");
    setArtistocksInput("");
    setPurchaseAmountArtistocks(0);
    setPurchaseAmountDollars(20);
    showToast("You have been logged out.", "info");
    // Small delay to allow toast to be seen before reload
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleSafewordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSafewordInput(e.target.value);
  };

  const alreadyOwnsEverything = hasPurchasedDownload && artistConfig && userTokenBalances[artistConfig.tokenName] && userTokenBalances[artistConfig.tokenName] > 0;

  const handleExploreOtherArtist = () => {
    if (!artistConfig) return;
    const currentArtistId = searchParams.get('artist') || 'gosheesh';
    const nextArtistId = currentArtistId.toLowerCase() === 'gosheesh' ? 'jaitea' : 'gosheesh';
    window.location.search = `?artist=${nextArtistId}`;
  };

  const handleDollarInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const amountString = e.target.value;
    if (amountString === "") {
      setPurchaseAmountDollars(0);
      return;
    }
    const amount = parseFloat(amountString);
    if (!isNaN(amount) && amount >= 0) {
      setPurchaseAmountDollars(amount);
    }
  };

  const handleArtistocksInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tokensString = e.target.value;
    setArtistocksInput(tokensString);

    const numArtistocks = parseInt(tokensString || '0', 10);
    const validNumArtistocks = isNaN(numArtistocks) || numArtistocks < 0 ? 0 : numArtistocks;
    setPurchaseAmountArtistocks(validNumArtistocks);

    if (artistConfig && artistConfig.tokenPrice > 0) {
      const equivalentDollars = validNumArtistocks * artistConfig.tokenPrice;
      if (swapFromAsset === "USD") {
        setSwapFromAmount(equivalentDollars.toFixed(2));
      }
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const usdString = e.target.value;
    setSwapFromAmount(usdString);

    if (artistConfig && artistConfig.tokenPrice > 0) {
      const usdValue = parseFloat(usdString || '0');
      const calculatedTokens = Math.floor(usdValue / artistConfig.tokenPrice);
      setPurchaseAmountArtistocks(calculatedTokens);
      setArtistocksInput(calculatedTokens > 0 ? calculatedTokens.toString() : (usdValue === 0 ? "0" : ""));
    }
  };

  const handleIncludeDownloadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIncludeDownload(e.target.checked);
  };

  const handleDollarPurchase = async () => {
    if (!artistConfig) return;
    setIsLoading(true);
    setPurchaseConfirmationData(null);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const artistId = searchParams.get('artist') || 'gosheesh';
    setHasPurchasedDownload(true);
    localStorage.setItem('zeyodaHasPurchasedDownload_' + artistId, 'true');
    const placeholderHash = "QmSyXs8d2jzAH79Fn1ZBPnp7FqcasunHkT9qTrpcbu5HdX";
    setDownloadIpfsHash(placeholderHash);
    localStorage.setItem('zeyodaIpfsHash_' + artistId, placeholderHash);
    console.log(`[Purchase] Set hasPurchasedDownload for ${artistId} to true in localStorage during $1 handleDollarPurchase.`);
    
    setUserTokenBalances(prevBalances => ({ ...prevBalances }));

    setPurchaseConfirmationData(`Successfully purchased featured download for "${artistConfig.artworkTitle}" for $1.00!`);
    setIsLoading(false);
    setShowExploreButton(true);
    setShowAssetsPanel(true);
  };

  useEffect(() => {
    if (artistConfig) {
      setSwapToAsset(artistConfig.tokenName);
    }
  }, [artistConfig]);

  useEffect(() => {
    if (swapFromAsset === "USD" && swapToAsset === artistConfig?.tokenName && artistConfig && artistConfig.tokenPrice > 0) {
      const fromVal = parseFloat(swapFromAmount);
      if (!isNaN(fromVal) && fromVal > 0) {
        setSwapToAmount((fromVal / artistConfig.tokenPrice).toFixed(8)); 
      } else {
        setSwapToAmount("");
      }
    } else {
      setSwapToAmount(""); 
    }
  }, [swapFromAmount, swapFromAsset, swapToAsset, artistConfig]);

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
    console.log("SWAP PREVIEW:");
    console.log("FROM:", swapFromAmount, swapFromAsset);
    console.log("TO:", swapToAmount, swapToAsset);
    alert(`Previewing Swap: ${swapFromAmount} ${swapFromAsset} to ${swapToAmount} ${swapToAsset}`);
  };

  useEffect(() => {
    if (artistConfig && unlockedArtistStates[artistIdFromUrl] && artistConfig.tokenPrice > 0) {
      if (swapFromAmount.trim() === "" || parseFloat(swapFromAmount || "0") === 0) {
        console.log(`Setting $20 default for already unlocked artist: ${artistIdFromUrl} (swapFromAmount was empty or zero)`);
        const defaultUsdAmount = "20.00";
        // setSwapFromAsset("USD"); // Not strictly needed here if it's already USD
        setSwapFromAmount(defaultUsdAmount);
        // Token calculation will now be handled by the new useEffect above
      }
    }
  }, [artistConfig, unlockedArtistStates, artistIdFromUrl, swapFromAmount]);

  const navigateToArtist = (artistId: string) => {
    console.log("[Navigation] Navigating to artist:", artistId);
    // Full page navigation
    window.location.href = `/?artist=${artistId}`;
  };

  // Orbital Token Drag Handlers
  // const orbitalTokensContainerRef = useRef<HTMLDivElement | null>(null);
  // const [isDraggingOrbit, setIsDraggingOrbit] = useState(false);
  // const dragStartCoords = useRef<{ x: number; y: number } | null>(null);
  // const lastDragCoords = useRef<{ x: number; y: number } | null>(null);
  // const isOrbitAnimationPaused = useRef(false); // This is used by animation

  // New useEffect to generate dynamic orbital tokens based on user assets
  useEffect(() => {
    if (!allArtistsConfig || !user) {
      setDynamicOrbitalTokens([]);
      return;
    }

    const ownedArtistIds = new Set<string>();

    // Add artists from token balances
    if (userTokenBalances && Object.keys(userTokenBalances).length > 0) {
      for (const artistId in allArtistsConfig) {
        const artist = allArtistsConfig[artistId];
        if (artist.tokenName && userTokenBalances[artist.tokenName] && userTokenBalances[artist.tokenName] > 0) {
          if (artistId !== artistIdFromUrl) {
            ownedArtistIds.add(artistId);
          }
        }
      }
    }

    // Add artists from purchased downloads
    if (allPurchasedDownloads && allPurchasedDownloads.length > 0) {
      allPurchasedDownloads.forEach(download => {
        if (download.artistId !== artistIdFromUrl) {
          ownedArtistIds.add(download.artistId);
        }
      });
    }

    const newOrbitalTokensData: ArtistConfig['orbitalTokens'] = [];
    const totalOwnedArtists = ownedArtistIds.size;
    let angleIncrement = totalOwnedArtists > 0 ? 360 / totalOwnedArtists : 0;
    let currentAngle = 0;

    ownedArtistIds.forEach(id => {
      const artist = allArtistsConfig[id];
      if (artist) {
        newOrbitalTokensData.push({
          name: artist.displayName || artist.name,
          artistId: id,
          angle: currentAngle,
          // x, y, z, etc., will be calculated by the animation effect
        });
        currentAngle += angleIncrement;
      }
    });
    
    console.log('[DynamicOrbit] Generated dynamic orbital tokens:', newOrbitalTokensData);
    setDynamicOrbitalTokens(newOrbitalTokensData);

  }, [allArtistsConfig, userTokenBalances, allPurchasedDownloads, user, artistIdFromUrl]);

  // useEffect for saving orbitAngleOffset to localStorage (ensure this is present)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('zeyodaOrbitAngleOffset', orbitAngleOffset.toString());
    }
  }, [orbitAngleOffset]);

  async function login() {
    if (!magic) return;
    try {
      const didToken = await magic.auth.loginWithEmailOTP({ email });
      const meta = await magic.user.getInfo();
      if (meta.publicAddress) {
        showToast('Logged in as ' + meta.publicAddress, 'success');
        // Add a small delay for the user to see the message before reload
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (error) {
      console.error("magic login failed", error);
      showToast('Login failed. Please try again.', 'error');
    }
  }

  async function handleBuy(amount: number) {
    if (!user || !artistConfig || !artistConfig.contract) {
      showToast("Please log in first.", "error");
      return;
    }
    
    try {
      const response = await fetch('/api/mint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractAddress: artistConfig.contract,
          userAddress: user, // The logged-in user's address
          amount: amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Minting failed.');
      }

      showToast(`Mint successful!`, 'success');
      // Optionally, refresh user balance here
      
    } catch (error) {
      console.error("Minting failed", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      showToast(`Minting failed: ${errorMessage}`, "error");
    }
  }

  // NEW: Check for ownership to display mint button
  useEffect(() => {
    const checkOwnership = async () => {
      if (user && magic && artistConfig && artistConfig.contract) {
        const provider = new ethers.BrowserProvider(magic.rpcProvider as any);
        const contract = new ethers.Contract(artistConfig.contract, ArtistockArtifact.abi, provider);
        try {
          const owner = await contract.owner();
          setIsOwner(owner.toLowerCase() === user.toLowerCase());
        } catch (e) {
          console.error("Could not check contract ownership:", e);
          setIsOwner(false);
        }
      } else {
        setIsOwner(false);
      }
    };
    checkOwnership();
  }, [user, magic, artistConfig]);

  const handleInitialMint = async () => {
    if (!user || !magic || !artistConfig || !artistConfig.contract) {
      showToast("Cannot mint: Missing user or contract details.", "error");
      return;
    }

    setIsMinting(true);
    try {
      const provider = new ethers.BrowserProvider(magic.rpcProvider as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(artistConfig.contract, ArtistockArtifact.abi, signer);
      
      const initialSupply = ethers.parseUnits("1000000000", 18); // 1 billion tokens
      
      showToast("Sending mint transaction... Please confirm in the wallet popup.", "info");
      const mintTx = await contract.mint(user, initialSupply);
      
      showToast("Waiting for mint confirmation...", "info");
      await mintTx.wait();
      
      showToast("1 Billion tokens minted successfully!", "success");
      
      // Force a reload to refresh balances and UI state
      setTimeout(() => window.location.reload(), 2000);

    } catch (e: any) {
      console.error("Initial mint failed:", e);
      showToast(`Error: ${e.message}`, "error");
    } finally {
      setIsMinting(false);
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-red-900 text-white">
        <h2 className="text-2xl font-bold mb-4">Oops! Something went wrong.</h2>
        <p className="text-lg">Error loading artist configuration:</p>
        <p className="text-md mt-2 p-4 bg-red-800 rounded">{error}</p>
        <p className="text-sm mt-4">Please check the artist ID in the URL (e.g., ?artist=gosheesh) or try again later.</p>
        <button onClick={() => window.location.search = ''} className="mt-6 px-4 py-2 bg-blue-500 hover:bg-blue-700 text-white font-bold rounded">
          Go to Default Artist
        </button>
      </div>
    );
  }
  if (!artistConfig) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="loading-spinner"></div>
        <p className="ml-2">Loading ZEYODA experience for {artistIdFromUrl}...</p>
      </div>
    );
  }

  console.log("Current isSwapUnlocked state (on render):", unlockedArtistStates);
  console.log("Current userTokenBalances state (on render):", userTokenBalances);

  const { displayName, artworkTitle, videoSrc, tokenPrice, artworkYear, orbitalTokens: currentOrbitalTokens, name: artistName, tokenName: artistTokenName } = artistConfig;

  const currentArtistBalance = userTokenBalances[artistTokenName] || 0;

  const showActualSwapInterface = user && currentArtistBalance > 0 && artistConfig && unlockedArtistStates[artistIdFromUrl] && !purchaseConfirmationData;

  let buyButtonText = "LOADING...";
  let buyButtonDisabled = true; 
  let buyButtonAction: () => void = () => {};

  if (artistConfig) {
    if (!user) {
      // Login prompt logic (buyButtonText might be set to 'LOGIN TO PURCHASE' or similar, and disabled)
      // This part seems okay as per current structure, focusing on the logged-in state.
    } else {
      // If globally verified, enable purchase functionality
      if (globalSafewordVerified) { 
        buyButtonAction = handlePrimaryAction;
            
        const purchasingDownloadNow = includeDownload && !hasPurchasedDownload;
        const purchasingTokensNow = purchaseAmountArtistocks > 0;

        if (!purchasingDownloadNow && !purchasingTokensNow) {
            buyButtonDisabled = true;
            // Clarify button text based on what is already owned for the CURRENT artist
            const currentArtistOwnsTokens = userTokenBalances[artistTokenName] && userTokenBalances[artistTokenName] > 0;
            if (hasPurchasedDownload && currentArtistOwnsTokens) { // Owns download AND tokens for current artist
                buyButtonText = `GET MORE ${artistTokenName || 'TOKENS'}`;
            } else if (hasPurchasedDownload) { // Owns download, but not tokens for current artist (or 0)
                buyButtonText = `GET ${artistTokenName || 'TOKENS'}`;
            } else if (currentArtistOwnsTokens) { // Owns tokens, but not download for current artist
                 buyButtonText = `GET DOWNLOAD + MORE ${artistTokenName || 'TOKENS'}`;
            } else { // Owns neither for current artist
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
        // If not globally verified, prompt to unlock with safeword for the current artist
        buyButtonText = `UNLOCK ${artistTokenName.toUpperCase()} SWAP`; 
        buyButtonDisabled = true; // Button is disabled, action would be safeword submission via input field
      }
    }
  }
  if (showPurchaseModal) buyButtonDisabled = true; 

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 relative bg-primary text-white font-sans">
      {artistConfig && (
        <>
          {/* Video Background */}
          <div id="particles" className="cosmic-particles"></div>

          {user && (
            <Wallet
              artistConfig={artistConfig}
              allArtistsConfig={allArtistsConfig}
              userTokenBalances={userTokenBalances}
              allPurchasedDownloads={allPurchasedDownloads}
              showAssetsPanel={showAssetsPanel}
              onClose={() => setShowAssetsPanel(false)}
            />
          )}

          <header className="app-header">
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--artist-font)' }}>{artistConfig?.displayName?.toUpperCase()}</h1>
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
                <a href="/create" className="logout-button">Create Profile</a>
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
            <div className="main-title-container">
              <h1 className="main-artist-title">{displayName?.toUpperCase()}</h1>
            </div>

            <div className="video-container" ref={videoContainerRef}>
              {videoSrc && !isVideoError ? (
                <video 
                  id="artistVideo" 
                  autoPlay 
                  loop 
                  muted={isMuted} 
                  playsInline 
                  key={videoSrc} 
                  onError={() => setIsVideoError(true)}
                  onCanPlay={() => setIsVideoError(false)} // Reset error if video becomes playable
                >
                  <source src={videoSrc} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="video-fallback" style={{display: 'flex'}}>
                    <div className="fallback-icon">📺</div>
                    <h3>{displayName}\'s content preview</h3>
                    <p className="fallback-note">Video content {isVideoError ? 'could not be loaded' : 'temporarily unavailable'}</p>
                </div>
              )}
              
              <div className="orbit-glow"></div>
              
              {artistConfig && artistConfig.orbitalTokens && artistConfig.orbitalTokens.length > 0 && (
                <div 
                  id="orbitalTokens" 
                  className="orbital-tokens"
                >
                  {artistConfig.orbitalTokens.map((token, index) => {
                    const isClickable = token.artistId && allArtistsConfig && allArtistsConfig[token.artistId];
                    
                    const handleTokenClick = () => {
                      console.log('[TokenClick] Initiated. Token raw data:', JSON.stringify(token));
                      console.log('[TokenClick] Token Name:', token.name, '| Artist ID from token object:', token.artistId);
                      console.log('[TokenClick] allArtistsConfig is available:', !!allArtistsConfig);
                      
                      if (token.artistId && allArtistsConfig) {
                        console.log('[TokenClick] Config for target artistId (' + token.artistId + '):', JSON.stringify(allArtistsConfig[token.artistId]));
                      }
                      
                      const isActuallyClickable = token.artistId && allArtistsConfig && allArtistsConfig[token.artistId];
                      console.log('[TokenClick] Determination for isActuallyClickable:', isActuallyClickable);

                      if (isActuallyClickable && token.artistId) {
                        console.log('[TokenClick] NAVIGATION APPROVED: Attempting navigation to /?artist=' + token.artistId);
                        // Pause orbit animation before navigation
                        if (animationFrameIdRef.current) {
                          cancelAnimationFrame(animationFrameIdRef.current);
                          animationFrameIdRef.current = null;
                        }
                        isOrbitAnimationPaused.current = true; // Explicitly pause
                        
                        // TEMPORARY: Using window.location.href for testing navigation
                        window.location.href = `/?artist=${token.artistId}`;
                        // router.push(`/?artist=${token.artistId}`); // Original line
                      } else {
                        // console.log('[TokenClick] Navigation conditions not met. isClickable:', isClickable, 'token.artistId:', token.artistId);
                        console.warn('[TokenClick] NAVIGATION DENIED. Conditions not met. isActuallyClickable:', isActuallyClickable, 'token.artistId:', token.artistId, 'Potentially missing in allArtistsConfig or artistId field empty on token.');
                      }
                    };

                    return (
                      <div 
                        key={token.artistId ? `orbit-${token.artistId}` : `orbit-token-${index}`}
                        className={`orbit-token ${isClickable ? 'cursor-pointer' : ''}`}
                        onClick={handleTokenClick}
                        onMouseEnter={(e) => e.currentTarget.setAttribute('data-hovered', 'true')}
                        onMouseLeave={(e) => e.currentTarget.removeAttribute('data-hovered')}
                        ref={el => {
                          if (el) {
                            tokenElementRefs.current[index] = el;
                          } else {
                            // On detach, React calls ref with null. We might need to clear the specific index if array length is managed elsewhere.
                            // For now, this ensures the ref is updated.
                            if (tokenElementRefs.current[index]) {
                               tokenElementRefs.current[index] = null; // Explicitly nullify on detach
                            }
                          }
                        }}
                        style={{
                          // Initial style properties from the token data in artistConfig
                          // These are set in fetchConfig: x:0, y:0, z:0, opacity:0.85, scale:1, blur:5
                          // The animate function will override transform, opacity, filter, zIndex.
                          transform: `translate3d(${token.x || 0}px, ${token.y || 0}px, ${token.z || 0}px) scale(${token.scale || 1})`,
                          opacity: token.opacity, // Use opacity from config
                          filter: `blur(${token.blur || 0}px)`, // Use blur from config
                          zIndex: 5 + Math.floor(token.z || 0), 
                        }}
                        title={isClickable && token.artistId ? `Explore ${allArtistsConfig?.[token.artistId]?.displayName || token.name}` : token.name}
                      >
                        {token.name}
                      </div>
                    );
                  })}
                </div>
              )}
              
              <div className="artwork-and-controls">
                <div className="artwork-info">
                  <h3 id="artworkTitle" className="artwork-title">{artworkTitle}</h3>
                  <small className="artwork-description">&copy; {artworkYear}</small>
                </div>

                <div className="video-controls">
                  <button id="muteToggle" className="video-control-btn" aria-label={isMuted ? "Unmute" : "Mute"} onClick={toggleMute}>
                    {isMuted ? <span className="muted-icon">🔇</span> : <span className="unmuted-icon">🔊</span>}
                  </button>
                  <button id="fullscreenToggle" className="video-control-btn" aria-label="Fullscreen" onClick={toggleFullscreen}>
                    <span className="fullscreen-icon">⛶</span>
                  </button>
                </div>
              </div>
            </div>

            {isOwner && (
              <div className="owner-actions my-6 p-4 bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded-lg text-center max-w-md mx-auto">
                <h3 className="text-xl font-bold text-yellow-300">Artist Owner Control</h3>
                <p className="text-yellow-400 my-2">You are the owner of this contract.</p>
                <button
                  onClick={handleInitialMint}
                  disabled={isMinting}
                  className="w-full font-bold py-3 px-6 rounded-lg text-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105 
                    bg-yellow-500 hover:bg-yellow-600 text-black disabled:bg-gray-500"
                >
                  {isMinting ? 'Minting...' : 'Mint Initial 1B Token Supply'}
                </button>
              </div>
            )}

            {!hasPurchasedDownload && (!user || (user && !globalSafewordVerified)) && (
              <div className="my-4 w-full max-w-md mx-auto">
                <button
                  onClick={() => {
                    if (!user) {
                      setShakeActive(true);
                      setTimeout(() => setShakeActive(false), 500);
                      const commandInput = document.querySelector<HTMLInputElement>('input[placeholder="Enter your email address to continue"]');
                      commandInput?.focus();
                    } else {
                      handleDollarPurchase();
                    }
                  }}
                  disabled={isLoading && !!user}
                  className={`w-full font-bold py-3 px-6 rounded-lg text-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105 
                    ${!user ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-500 hover:bg-green-600'} text-white`}
                >
                  {isLoading && !!user ? 'Processing...' : 
                    !user ? '$1.00 INCLUDES PERMANENT ACCESS (SIGN IN TO SELECT)' : `GET DOWNLOAD ($${(1).toFixed(2)})`}
                </button>
              </div>
            )}

            {user && globalSafewordVerified && !purchaseConfirmationData && artistConfig && (
              <div className="purchase-slider-section mock-ui-section p-4 md:p-6 bg-gray-800 bg-opacity-70 shadow-xl rounded-lg border border-gray-700 backdrop-blur-md mb-8 max-w-2xl mx-auto">
                <h3 className="text-xl font-semibold mb-3 text-center text-white">Purchase Options</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">FROM</label>
                  <div className="flex items-center space-x-2">
                    <select 
                      id="fromAsset"
                      value={swapFromAsset} 
                      onChange={(e) => {
                        setSwapFromAsset(e.target.value);
                      }}
                      className="w-2/5 p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-accentColor focus:border-accentColor"
                    >
                      <option value="USD">USD (Cash)</option>
                      {artistConfig && allArtistsConfig && (
                        unlockedArtistStates[artistIdFromUrl] ? (
                          Object.entries(allArtistsConfig).map(([id, artist]) => {
                            const isOwned = userTokenBalances[artist.tokenName] && userTokenBalances[artist.tokenName] > 0;
                            if (isOwned || id === artistIdFromUrl) {
                              return <option key={artist.tokenName} value={artist.tokenName}>{artist.tokenName}</option>;
                            }
                            return null;
                          })
                        ) : (
                          (userTokenBalances[artistConfig.tokenName] && userTokenBalances[artistConfig.tokenName] > 0 || artistIdFromUrl === artistConfig.name.toLowerCase()) && (
                             <option key={artistConfig.tokenName} value={artistConfig.tokenName}>{artistConfig.tokenName}</option>
                          )
                        )
                      )}
                    </select>
                    <input
                      type="number"
                      value={swapFromAmount}
                      onChange={handleSwapFromAmountChange}
                      placeholder="0.00"
                      className="w-3/5 p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-accentColor focus:border-accentColor"
                      aria-label="Amount of asset to swap from"
                    />
                  </div>
                </div>

                {swapFromAsset === "USD" && (
                  <div className="mb-6">
                    <label htmlFor="usdSlider" className="block text-sm font-medium text-gray-300 mb-1">
                      Adjust USD Amount (Slider)
                    </label>
                    <input
                      type="range"
                      id="usdSlider"
                      min="0"
                      max="500"
                      step="1"
                      value={swapFromAmount || '0'}
                      onChange={handleSliderChange}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accentColor"
                    />
                    <div className="text-xs text-gray-400 mt-1 text-center">
                      Current: ${parseFloat(swapFromAmount || '0').toFixed(2)}
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">TO</label>
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-2 bg-gray-700 text-white rounded-md text-sm">{artistConfig.tokenName}</span>
                    <input
                      type="number"
                      value={artistocksInput}
                      onChange={handleArtistocksInputChange}
                      min="0"
                      step="1"
                      placeholder="0"
                      className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-accentColor focus:border-accentColor"
                      aria-label={`Amount in ${artistConfig.tokenName}`}
                    />
                  </div>
                  {artistConfig.tokenPrice > 0 && purchaseAmountDollars > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      (Current Price: ${artistConfig.tokenPrice.toFixed(4)} per {artistConfig.tokenName})
                    </p>
                  )}
                </div>
                
                <div className="mb-6 flex items-center">
                  {hasPurchasedDownload ? (
                    <>
                      <input 
                        type="checkbox" 
                        id="downloadOwned" 
                        checked 
                        disabled 
                        className="h-4 w-4 text-green-600 border-gray-500 rounded focus:ring-green-500 bg-gray-700 cursor-not-allowed"
                      />
                      <label 
                        htmlFor="downloadOwned" 
                        className="ml-2 text-sm font-medium text-green-400"
                      >
                        Featured Download (Already Owned)
                      </label>
                    </>
                  ) : (
                    <>
                      <input
                        type="checkbox"
                        id="includeDownload"
                        name="includeDownload"
                        checked={includeDownload}
                        onChange={handleIncludeDownloadChange}
                        className="h-4 w-4 text-accentColor border-gray-500 rounded focus:ring-accentColor bg-gray-700"
                      />
                      <label 
                        htmlFor="includeDownload" 
                        className="ml-2 text-sm font-medium text-gray-300"
                      >
                        Include Featured Download ($1.00)
                      </label>
                    </>
                  )}
                </div>
                
                <button
                  onClick={buyButtonAction}
                  disabled={buyButtonDisabled}
                  className={`w-full font-bold py-3 px-6 rounded-lg text-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105
                    ${buyButtonDisabled ? 'bg-gray-600 cursor-not-allowed' : 'custom-buy-button bg-green-500 hover:bg-green-600'} text-white`}
                >
                  {buyButtonText}
                </button>
              </div>
            )}

            <div className="action-section text-center mb-4">
              {!user && (
                <div id="login-prompts-container" className="login-prompts mt-6">
                  <h3 id="accessHeadline" className="access-headline">
                    Sign in to purchase {artistTokenName}
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

              {user && showPurchaseModal && priceDetails && artistConfig && (
                <div className="purchase-modal-overlay">
                  <div className="purchase-modal p-6 bg-gray-800 bg-opacity-80 backdrop-blur-md shadow-2xl rounded-xl border border-gray-700">
                    <h2 className="text-2xl font-bold mb-3 text-center text-white">CONFIRM PURCHASE: <span className="text-accentColor">{artistConfig.tokenName.toUpperCase()}</span></h2>
                    <p className="text-center text-gray-300 mb-6 text-sm">
                      You are about to acquire {includeDownload && !hasPurchasedDownload ? <><span className="font-semibold text-white">1 x Featured Download</span> and </> : ''}
                      {purchaseAmountArtistocks > 0 ? <><span className="font-semibold text-white">{purchaseAmountArtistocks} {artistConfig.tokenName}s</span> </> : (includeDownload && !hasPurchasedDownload ? '' : 'items')}
                      for the digital asset: <strong className="text-white">{artistConfig.artworkTitle}</strong>.
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

              {user && artistConfig && !globalSafewordVerified && showExploreButton && !purchaseConfirmationData && (
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
                      ? "Type command, search, or safeword..." 
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
        </>
      )}
    </main>
  );
}
