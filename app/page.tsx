"use client";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from 'next/navigation';
import Wallet from './components/Wallet';

interface ArtistConfig {
  name: string;
  displayName: string;
  tokenName: string;
  artworkTitle: string;
  artworkYear: string;
  tokenPrice: number;
  videoSrc: string;
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

export default function HomePage() {
  const searchParams = useSearchParams();
  const artistIdFromUrl = searchParams.get('artist') || 'gosheesh';
  const [artistConfig, setArtistConfig] = useState<ArtistConfig | null>(null);
  const [allArtistsConfig, setAllArtistsConfig] = useState<{[key: string]: ArtistConfig} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [shakeActive, setShakeActive] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
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

  // Ref for the video container to dynamically adjust orbit
  const videoContainerRef = useRef<HTMLDivElement | null>(null);

  // State for the Swap Interface
  const [swapFromAsset, setSwapFromAsset] = useState<string>("USD");
  const [swapToAsset, setSwapToAsset] = useState<string>("");
  const [swapFromAmount, setSwapFromAmount] = useState<string>("");
  const [swapToAmount, setSwapToAmount] = useState<string>("");

  // State for Video Player
  const [isVideoError, setIsVideoError] = useState(false);

  // State for Orbital Token Dragging
  const orbitalTokensContainerRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingOrbit, setIsDraggingOrbit] = useState(false);
  const [orbitAngleOffset, setOrbitAngleOffset] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseFloat(localStorage.getItem('zeyodaOrbitAngleOffset') || '0');
    }
    return 0;
  });
  const dragStartCoords = useRef<{ x: number; y: number } | null>(null);
  const lastDragCoords = useRef<{ x: number; y: number } | null>(null);
  const animationFrameIdRef = useRef<number | null>(null); // To store animation frame ID
  const isOrbitAnimationPaused = useRef(false); // To pause animation during drag

  useEffect(() => {
    const currentArtistId = artistIdFromUrl;
    setHasPurchasedDownload(false);
    setDownloadIpfsHash(null);
    setSafewordVerified(false);

    const storedEmail = localStorage.getItem('zeyodaUserEmail');
    if (storedEmail) {
      setIsLoggedIn(true);
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
      setIsLoggedIn(false);
      setUserTokenBalances({});
      setUnlockedArtistStates({});
      setGlobalSafewordVerified(false); // Reset if not logged in
      setAllPurchasedDownloads([]); // Clear if not logged in
    }
  }, [searchParams, artistIdFromUrl, allArtistsConfig]);

  useEffect(() => {
    if (isLoggedIn && artistConfig && hasPurchasedDownload) {
      if (userTokenBalances[artistConfig.tokenName] && userTokenBalances[artistConfig.tokenName] > 0) {
        setShowExploreButton(true);
      } else {
        setShowExploreButton(false);
      }
    } else {
      setShowExploreButton(false);
    }
  }, [isLoggedIn, artistConfig, hasPurchasedDownload, userTokenBalances]);

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
            x: 0, y: 0, z: 0, opacity: 0.85, scale: 1, blur: 5, isVisible: true 
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

  useEffect(() => {
    if (!artistConfig || !artistConfig.orbitalTokens) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      return;
    }

    const videoElement = videoContainerRef.current;
    if (!videoElement) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      } 
      return; // Don't animate if video container isn't there yet
    }

    const animate = (timestamp: number) => {
      if (isOrbitAnimationPaused.current && !isDraggingOrbit) { // Pause if requested and not actively dragging
        animationFrameIdRef.current = requestAnimationFrame(animate);
        return;
      }

      // Update the shared orbitAngleOffset state for persistence and manual interaction feedback
      // The actual animation speed is primarily driven by timestamp in the style calculation below
      if (!isDraggingOrbit) { // Only let automatic animation update offset if not dragging
        setOrbitAngleOffset(prevOffset => (prevOffset + 0.05) % 360); // Slow continuous drift for the state offset
      }

      setArtistConfig(prevConfig => {
        if (!prevConfig || !prevConfig.orbitalTokens) return prevConfig;
        
        const rect = videoElement.getBoundingClientRect();
        const videoWidth = rect.width;
        const videoHeight = rect.height;

        // Log dimensions for debugging orbit
        if (timestamp % 300 < 16) { // Log roughly every 5 seconds (assuming 60fps)
            console.log(`[AnimateOrbit] Video dimensions: width=${videoWidth}, height=${videoHeight}`);
        }

        const orbitPadding = 60; 
        let dynamicOrbitRadius = Math.max(videoWidth, videoHeight) / 2 + orbitPadding;

        if (videoWidth === 0 && videoHeight === 0) { // Fallback if video dimensions are not yet available
            dynamicOrbitRadius = 200; // Default radius
            if (timestamp % 300 < 16) {
                console.warn("[AnimateOrbit] Video dimensions are 0. Using fallback orbit radius:", dynamicOrbitRadius);
            }
        } else {
            if (timestamp % 300 < 16) {
                console.log("[AnimateOrbit] Calculated dynamicOrbitRadius:", dynamicOrbitRadius);
            }
        }

        const animationSpeed = 0.0005;

        const currentGlobalAngleOffsetRad = orbitAngleOffset * (Math.PI / 180);

        const updatedTokens = prevConfig.orbitalTokens.map((token, index) => {
          const initialAngleRad = (token.angle || 0) * (Math.PI / 180);
          const timeBasedAngleRad = !isDraggingOrbit ? (animationSpeed * timestamp) : 0;
          
          const currentAngleRad = initialAngleRad + timeBasedAngleRad + currentGlobalAngleOffsetRad;
          
          const x = dynamicOrbitRadius * Math.cos(currentAngleRad);
          // Make y circular, not elliptical
          const y = dynamicOrbitRadius * Math.sin(currentAngleRad);
          // Keep z-effect for perspective if desired, or simplify
          const z = dynamicOrbitRadius * Math.sin(currentAngleRad) * Math.cos(currentAngleRad) * 0.1; // Reduced z influence for less distortion
          
          const perspectiveFactor = 1 + z / (dynamicOrbitRadius * 2); // Adjust perspective calculation if z changes
          const scale = Math.max(0.5, Math.min(1.5, perspectiveFactor));
          const opacity = Math.max(0.3, Math.min(1, ( (z + dynamicOrbitRadius*0.3) / (dynamicOrbitRadius*0.6) * 0.7 + 0.3)));
          const blur = Math.max(0, Math.min(4, 2 - (z / (dynamicOrbitRadius * 0.4)) * 2));
          return {
            ...token,
            x,
            y,
            z,
            opacity,
            scale,
            blur,
            isVisible: true
          };
        });
        return { ...prevConfig, orbitalTokens: updatedTokens };
      });
      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    if (!isDraggingOrbit) { // Start animation if not currently dragging
        isOrbitAnimationPaused.current = false;
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = requestAnimationFrame(animate);
    } else {
        isOrbitAnimationPaused.current = true;
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [artistConfig?.name, orbitAngleOffset, isDraggingOrbit]); // Add isDraggingOrbit and orbitAngleOffset dependencies

  // Effect for saving orbitAngleOffset to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('zeyodaOrbitAngleOffset', orbitAngleOffset.toString());
    }
  }, [orbitAngleOffset]);

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
    const dollarValueForTokens = (unlockedArtistStates[artistIdFromUrl] && swapFromAsset === 'USD')
                                     ? parseFloat(swapFromAmount || '0')
                                     : purchaseAmountDollars;

    let calculatedTotal = dollarValueForTokens;
    if (includeDownload && !hasPurchasedDownload) {
      calculatedTotal += 1;
    }
    setTotalPurchasePrice(calculatedTotal);
  }, [swapFromAmount, swapFromAsset, unlockedArtistStates, artistIdFromUrl, purchaseAmountDollars, includeDownload, hasPurchasedDownload]);

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
    if (!isLoggedIn) {
      setShakeActive(true);
      setTimeout(() => setShakeActive(false), 500);
      emailInputRef.current?.focus();
      return;
    }
    if (artistConfig) {
      const details = calculatePriceDetails(artistConfig.tokenPrice);
      setPriceDetails(details);
      setShowPurchaseModal(true);
    }
  };

  const handlePrimaryAction = () => {
    if (!isLoggedIn) {
      setShakeActive(true);
      setTimeout(() => setShakeActive(false), 500);
      emailInputRef.current?.focus();
      return;
    }
    if (artistConfig) {
      const details = calculatePriceDetails(totalPurchasePrice);
      setPriceDetails(details);
      setShowPurchaseModal(true);
    }
  };

  const handleConfirmPurchase = (paymentMethod?: string) => {
    setShowPurchaseModal(false);
    if (!artistConfig) return;

    let itemsPurchasedMessage = [];
    let newBalances = { ...userTokenBalances };
    const artistId = searchParams.get('artist') || 'gosheesh';
    let purchasedDownloadThisTransaction = false;

    if (includeDownload && !hasPurchasedDownload) {
      itemsPurchasedMessage.push(`1 x Featured Download for "${artistConfig.artworkTitle}"`);
      setHasPurchasedDownload(true);
      localStorage.setItem('zeyodaHasPurchasedDownload_' + artistId, 'true');
      const placeholderHash = "QmSyXs8d2jzAH79Fn1ZBPnp7FqcasunHkT9qTrpcbu5HdX";
      setDownloadIpfsHash(placeholderHash);
      localStorage.setItem('zeyodaIpfsHash_' + artistId, placeholderHash);
      purchasedDownloadThisTransaction = true;
      console.log(`[Purchase] Set hasPurchasedDownload for ${artistId} to true in localStorage during confirm.`);
    }

    if (purchaseAmountArtistocks > 0) {
      itemsPurchasedMessage.push(`${purchaseAmountArtistocks} ${artistConfig.tokenName}s`);
      newBalances[artistConfig.tokenName] = (newBalances[artistConfig.tokenName] || 0) + purchaseAmountArtistocks;
    }
    
    if (itemsPurchasedMessage.length === 0) {
        setPurchaseConfirmationData("No new items were selected for purchase.");
        return;
    }

    setUserTokenBalances(newBalances);
    localStorage.setItem('zeyodaUserTokenBalances', JSON.stringify(newBalances));

    const confirmationMessage = `Purchase Confirmed! Items: ${itemsPurchasedMessage.join(', ')}. Total Price: $${totalPurchasePrice.toFixed(2)}. Payment Method: ${paymentMethod || 'Confirmed'}. Your new ${artistConfig.tokenName} balance: ${newBalances[artistConfig.tokenName] || 0}.`;
    setPurchaseConfirmationData(confirmationMessage);
    
    setShowExploreButton(true);
    if (purchasedDownloadThisTransaction || purchaseAmountArtistocks > 0) {
      setShowAssetsPanel(true);
    }

    setPurchaseAmountDollars(20);
    setIncludeDownload(true);
  };

  const handleSafewordSubmit = () => {
    if (!artistConfig || !artistConfig.name) {
      alert("Artist data is still loading. Please wait a moment and try submitting the safeword again.");
      return;
    }
    console.log("Attempting safeword submission...");
    const expectedSafeword = artistConfig.name.toLowerCase() + "unlock";
    console.log("Safeword input:", safewordInput, "Expected:", expectedSafeword, "Artist ID:", artistIdFromUrl);

    if (safewordInput.toLowerCase() === expectedSafeword) {
      console.log("Safeword CORRECT for artist:", artistIdFromUrl);
      setSafewordVerified(true);
      setGlobalSafewordVerified(true);

      const newUnlockedStates = { ...unlockedArtistStates, [artistIdFromUrl]: true };
      setUnlockedArtistStates(newUnlockedStates);
      localStorage.setItem('zeyodaUnlockedArtists', JSON.stringify(newUnlockedStates));
      
      setSafewordInput('');
      setPurchaseConfirmationData(null);

      setSwapFromAsset("USD");
      const defaultUsdAmount = "20.00";
      setSwapFromAmount(defaultUsdAmount);

      if (artistConfig.tokenPrice > 0) {
        const usdValue = parseFloat(defaultUsdAmount);
        const calculatedTokens = Math.floor(usdValue / artistConfig.tokenPrice);
        setPurchaseAmountArtistocks(calculatedTokens);
        setArtistocksInput(calculatedTokens > 0 ? calculatedTokens.toString() : (usdValue === 0 ? "0" : ""));
      } else {
        setPurchaseAmountArtistocks(0);
        setArtistocksInput("");
      }
    } else {
      console.log("Safeword INCORRECT or artistConfig not fully loaded for check.");
      alert("Incorrect safeword. Please try again.");
      setSafewordVerified(false); 
    }
  };

  const handleEmailLogin = () => {
    const email = emailInputRef.current?.value;
    if (email && email.trim() !== "" && email.includes('@')) {
      localStorage.setItem('zeyodaUserEmail', email);
      setIsLoggedIn(true);
      const storedBalances = localStorage.getItem('zeyodaUserTokenBalances');
      if (storedBalances) {
        try {
          setUserTokenBalances(JSON.parse(storedBalances));
        } catch (e) {
          console.error("Error parsing token balances from localStorage", e);
          setUserTokenBalances({});
        }
      }
      setShowPurchaseModal(false);
      setSafewordInput('');
    } else {
      alert("Please enter a valid email address.");
      setShakeActive(true);
      setTimeout(() => setShakeActive(false), 500);
      emailInputRef.current?.focus();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('zeyodaUserEmail');
    localStorage.removeItem('zeyodaUserTokenBalances');
    localStorage.removeItem('zeyodaHasPurchasedDownload_gosheesh');
    localStorage.removeItem('zeyodaHasPurchasedDownload_jaitea');
    localStorage.removeItem('zeyodaUnlockedArtists');

    setIsLoggedIn(false);
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
    alert("You have been logged out. Your token balance has been reset.");
  };

  const handleSafewordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSafewordInput(newValue);

    if (isLoggedIn && artistConfig && artistConfig.name && artistConfig.tokenPrice > 0 && !unlockedArtistStates[artistIdFromUrl]) {
      if (newValue.toLowerCase().includes("artistocks")) {
        console.log(`"artistocks" keyword detected, unlocking for artist: ${artistIdFromUrl}`);
        setGlobalSafewordVerified(true);
        
        const newUnlockedStates = { ...unlockedArtistStates, [artistIdFromUrl]: true };
        setUnlockedArtistStates(newUnlockedStates);
        localStorage.setItem('zeyodaUnlockedArtists', JSON.stringify(newUnlockedStates));
        
        setSwapFromAsset("USD");
        const defaultUsdAmount = "20.00";
        setSwapFromAmount(defaultUsdAmount);

        const usdValue = parseFloat(defaultUsdAmount);
        const calculatedTokens = Math.floor(usdValue / artistConfig.tokenPrice);
        setPurchaseAmountArtistocks(calculatedTokens);
        setArtistocksInput(calculatedTokens > 0 ? calculatedTokens.toString() : (usdValue === 0 ? "0" : ""));

        setPurchaseConfirmationData(null);
      }
    }
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
        console.log(`Setting $20 default for already unlocked artist: ${artistIdFromUrl}`);
        const defaultUsdAmount = "20.00";
        setSwapFromAsset("USD");
        setSwapFromAmount(defaultUsdAmount);

        const usdValue = parseFloat(defaultUsdAmount);
        const calculatedTokens = Math.floor(usdValue / artistConfig.tokenPrice);
        setPurchaseAmountArtistocks(calculatedTokens);
        setArtistocksInput(calculatedTokens > 0 ? calculatedTokens.toString() : "0");
      }
    }
  }, [artistConfig, unlockedArtistStates, artistIdFromUrl, swapFromAmount]);

  const navigateToArtist = (artistId: string) => {
    if (artistId) {
      console.log(`[navigateToArtist] Navigating to artist: ${artistId}`);
      window.location.search = `?artist=${artistId}`;
    } else {
      console.warn("[navigateToArtist] Attempted to navigate with undefined artistId");
    }
  };

  // Orbital Token Drag Handlers
  useEffect(() => {
    const container = orbitalTokensContainerRef.current;
    if (!container) return;

    // Helper to get coordinates from either mouse or touch event
    const getCoords = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if (e instanceof MouseEvent) return { x: e.clientX, y: e.clientY };
      if ('touches' in e && e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return null;
    };

    const handleDragStart = (e: MouseEvent | TouchEvent) => {
      const coords = getCoords(e);
      if (!coords) return;

      setIsDraggingOrbit(true);
      // isOrbitAnimationPaused.current is set by the animation useEffect when isDraggingOrbit is true
      dragStartCoords.current = coords;
      lastDragCoords.current = coords;
      
      // For touch events, prevent default if we are indeed starting a drag on the orbit container
      // This helps distinguish from page scroll.
      if (e.target === container && 'touches' in e) {
         // No explicit preventDefault here, let touchmove handle it if it's a drag
      }
    };

    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingOrbit || !dragStartCoords.current || !lastDragCoords.current) return;
      
      const coords = getCoords(e);
      if (!coords) return;

      // Only prevent default and update angle if actually dragging
      if (e.cancelable && ('touches' in e)) {
        e.preventDefault(); 
      }

      const deltaX = coords.x - lastDragCoords.current.x;
      const angleChangeFactor = 0.5; // Adjust sensitivity
      
      setOrbitAngleOffset(prevOffset => {
        const newOffset = (prevOffset - deltaX * angleChangeFactor);
        // Normalize to 0-360 if desired, though raw accumulation also works for transform
        return (newOffset % 360 + 360) % 360; 
      });

      lastDragCoords.current = coords;
    };

    const handleDragEnd = () => {
      if (!isDraggingOrbit) return; // Only act if a drag was in progress
      setIsDraggingOrbit(false);
      // isOrbitAnimationPaused.current will be set to false by the animation useEffect
      dragStartCoords.current = null;
      lastDragCoords.current = null;
      // orbitAngleOffset is saved to localStorage by its own useEffect
    };

    // Mouse events
    container.addEventListener('mousedown', handleDragStart as EventListener);
    document.addEventListener('mousemove', handleDragMove as EventListener); // Listen on document for wider drag area
    document.addEventListener('mouseup', handleDragEnd); // Listen on document
    document.addEventListener('mouseleave', handleDragEnd); // If mouse leaves window while dragging

    // Touch events
    // passive: false for touchmove to allow preventDefault
    container.addEventListener('touchstart', handleDragStart as EventListener, { passive: true });
    container.addEventListener('touchmove', handleDragMove as EventListener, { passive: false });
    container.addEventListener('touchend', handleDragEnd);
    container.addEventListener('touchcancel', handleDragEnd);

    return () => {
      container.removeEventListener('mousedown', handleDragStart as EventListener);
      document.removeEventListener('mousemove', handleDragMove as EventListener);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('mouseleave', handleDragEnd);
      container.removeEventListener('touchstart', handleDragStart as EventListener);
      container.removeEventListener('touchmove', handleDragMove as EventListener);
      container.removeEventListener('touchend', handleDragEnd);
      container.removeEventListener('touchcancel', handleDragEnd);
    };
  }, [isDraggingOrbit]); // Re-setup if isDraggingOrbit changes (though it primarily gates internal logic)

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

  const showActualSwapInterface = isLoggedIn && currentArtistBalance > 0 && artistConfig && unlockedArtistStates[artistIdFromUrl] && !purchaseConfirmationData;

  let buyButtonText = "LOADING...";
  let buyButtonDisabled = true; 
  let buyButtonAction: () => void = () => {};

  if (artistConfig) {
    if (!isLoggedIn) {
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
    <>
      <div id="particles" className="cosmic-particles"></div>

      {isLoggedIn && (
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
        {isLoggedIn && artistConfig ? (
          <div className="header-user-info flex items-center justify-between w-full">
            <div className="flex items-center">
              <button 
                onClick={() => setShowAssetsPanel(!showAssetsPanel)} 
                className="wallet-button mr-4"
                style={{
                  padding: '8px 12px',
                  background: 'linear-gradient(to bottom, #5c8eff, #2850cc)',
                  border: 'none',
                  borderRadius: '30px',
                  color: 'white',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 0 rgba(0,0,0,0.2)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.4)'
                }}
              >
                {showAssetsPanel ? 'Hide Assets' : 'Your Assets'}
              </button>
            </div>
            
            <div className="flex items-center">
              <button onClick={handleLogout} className="logout-button">
                LOG OUT / RESET
              </button>
            </div>
          </div>
        ) : (
          <span className="login-prompt-header">Login to engage</span>
        )}
      </header>

      <main className="app-main">
        <div className="main-title-container">
          <h1 className="main-artist-title">{displayName?.toUpperCase()}</h1>
        </div>

        <div className="video-container">
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
          
          {currentOrbitalTokens && currentOrbitalTokens.length > 0 && (
            <div 
              id="orbitalTokens" 
              className="orbital-tokens"
              ref={orbitalTokensContainerRef}
            >
              {currentOrbitalTokens.map((token, index) => {
                const isClickable = token.artistId && allArtistsConfig && allArtistsConfig[token.artistId];
                return (
                  <div 
                    key={`${artistName}-token-${index}`}
                    className={`orbit-token ${isClickable ? 'cursor-pointer' : ''}`}
                    style={{
                      transform: `translate3d(${token.x || 0}px, ${token.y || 0}px, ${token.z || 0}px) scale(${token.scale || 1})`,
                      opacity: token.opacity,
                      filter: `blur(${token.blur || 0}px)`,
                      zIndex: 5 + Math.floor(token.z || 0), 
                    }}
                    onClick={() => {
                      if (isClickable && token.artistId) {
                        navigateToArtist(token.artistId);
                      }
                    }}
                    {...(isClickable && token.artistId && { 'data-artist-id': token.artistId })}
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

        {!hasPurchasedDownload && (!isLoggedIn || (isLoggedIn && !globalSafewordVerified)) && (
          <div className="my-4 w-full max-w-md mx-auto">
            <button
              onClick={() => {
                if (!isLoggedIn) {
                  setShakeActive(true);
                  setTimeout(() => setShakeActive(false), 500);
                  emailInputRef.current?.focus();
                } else {
                  handleDollarPurchase();
                }
              }}
              disabled={isLoading && isLoggedIn}
              className={`w-full font-bold py-3 px-6 rounded-lg text-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105 
                ${!isLoggedIn ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-500 hover:bg-green-600'} text-white`}
            >
              {isLoading && isLoggedIn ? 'Processing...' : 
                !isLoggedIn ? '$1.00 INCLUDES PERMANENT ACCESS (SIGN IN TO SELECT)' : `GET DOWNLOAD ($${(1).toFixed(2)})`}
            </button>
          </div>
        )}

        {isLoggedIn && globalSafewordVerified && !purchaseConfirmationData && artistConfig && (
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
          {!isLoggedIn && (
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

          {isLoggedIn && showPurchaseModal && priceDetails && artistConfig && (
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

          {isLoggedIn && purchaseConfirmationData && (
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

          {isLoggedIn && artistConfig && !globalSafewordVerified && showExploreButton && !purchaseConfirmationData && (
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
          className={`unified-input-container mock-ui-section p-4 border-t-2 border-gray-700 mt-8 ${!isLoggedIn && shakeActive ? 'shake' : ''}`}
        >
          {isLoggedIn && (
            <h3 className="text-xl font-semibold mb-3 text-center">Chat / Command</h3>
          )}
          <div className="flex items-center max-w-xl mx-auto">
            <input
              ref={emailInputRef}
              type="text"
              value={safewordInput}
              onChange={handleSafewordInputChange}
              placeholder={
                isLoggedIn 
                  ? "Type command, search, or safeword..." 
                  : "Enter your email address to continue"
              }
              className="flex-grow p-3 border border-gray-600 rounded-l-lg bg-gray-900 bg-opacity-70 text-white focus:ring-accentColor focus:border-accentColor backdrop-blur-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (!isLoggedIn) {
                    handleEmailLogin();
                  } else {
                    handleSafewordSubmit();
                  }
                }
              }}
              aria-label={isLoggedIn ? "Chat or command input" : "Email address input"}
            />
            <button
              onClick={() => {
                if (!isLoggedIn) {
                  handleEmailLogin();
                } else {
                  handleSafewordSubmit();
                }
              }}
              className="p-3 bg-accentColor text-white rounded-r-lg hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-accentColor focus:ring-opacity-50"
            >
              {isLoggedIn ? "Send" : "Continue"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
