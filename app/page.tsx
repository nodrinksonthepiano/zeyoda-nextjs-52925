"use client";
import Image from "next/image";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import Wallet from './components/Wallet';
import dynamic from 'next/dynamic';
import { useWallet } from './components/MagicProvider';
import { useToast } from './contexts/ToastContext';
import { ethers } from "ethers";
import ArtistockArtifact from '../artifacts/contracts/Artistock.sol/Artistock.json';
import { useArtistConfig } from "./hooks/useArtistConfig";

interface OrbitalToken {
  name: string; 
  angle: number; 
  artistId?: string;
}

interface RenderableToken extends OrbitalToken {
  x?: number;
  y?: number;
  z?: number;
  opacity?: number;
  scale?: number;
  blur?: number;
  isVisible?: boolean;
  element?: HTMLElement | null;
}

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
  orbitalTokens: OrbitalToken[];
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

const ORBIT_SPEED = 0.3;

export default function HomePage() {
  const { magic, user } = useWallet();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');

  const searchParams = useSearchParams();
  const router = useRouter();
  const artistIdFromUrl = searchParams.get('artist') || 'gosheesh';
  const { artistConfig, allArtistsConfig, isLoading, error } = useArtistConfig(artistIdFromUrl);

  const [isMuted, setIsMuted] = useState(true);
  const [shakeActive, setShakeActive] = useState(false);
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
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showAssetsPanel, setShowAssetsPanel] = useState<boolean>(false);
  const [downloadIpfsHash, setDownloadIpfsHash] = useState<string | null>(null);
  const [globalSafewordVerified, setGlobalSafewordVerified] = useState(false);
  const [allPurchasedDownloads, setAllPurchasedDownloads] = useState<PurchasedDownloadInfo[]>([]);
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintAmount, setMintAmount] = useState("");

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const tokenElementRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const isOrbitAnimationPaused = useRef(false);

  const [swapFromAsset, setSwapFromAsset] = useState<string>("USD");
  const [swapToAsset, setSwapToAsset] = useState<string>("");
  const [swapFromAmount, setSwapFromAmount] = useState<string>("20.00");
  const [swapToAmount, setSwapToAmount] = useState<string>("");

  const [isVideoError, setIsVideoError] = useState(false);

  const [dynamicOrbitalTokens, setDynamicOrbitalTokens] = useState<RenderableToken[]>([]);

  const [orbitAngleOffset, setOrbitAngleOffset] = useState(0);

  useEffect(() => {
    const storedOffset = parseFloat(localStorage.getItem('zeyodaOrbitAngleOffset') || '0');
    if (storedOffset) {
        setOrbitAngleOffset(storedOffset);
    }
  }, []);

  useEffect(() => {
    const videoElement = videoContainerRef.current;
    if (!artistConfig || !videoElement) {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
        return;
    }

    const allTokens = [...(artistConfig?.orbitalTokens || []), ...dynamicOrbitalTokens].filter((token, index, self) => 
        token.name && self.findIndex(t => t.name === token.name) === index
    );

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

      const contentWidth = videoElement.offsetWidth;
      const contentHeight = videoElement.offsetHeight;
      
      const radiusX = (contentWidth / 2) + 60;
      const radiusY = (contentHeight / 2) + 40;
      const currentGlobalAngleOffset = orbitAngleOffset;

      allTokens.forEach((tokenData, index) => {
        const tokenElement = tokenElementRefs.current[index];
        if (!tokenElement) return;

        const tokenSpecificInitialAngle = (typeof tokenData.angle === 'number' ? tokenData.angle : 0) * (Math.PI / 180); 
        const angle = currentGlobalAngleOffset + tokenSpecificInitialAngle;
        
        const x = radiusX * Math.cos(angle);
        const y = radiusY * Math.sin(angle);
        const z = -20;
        
        tokenElement.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) scale(1)`;
        tokenElement.style.opacity = '1';
        tokenElement.style.filter = 'blur(0px)';
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
  }, [artistConfig, dynamicOrbitalTokens, orbitAngleOffset]);

  useEffect(() => {
    if (artistConfig && artistConfig.tokenPrice > 0) {
      const usdValue = parseFloat(swapFromAmount || '0');
      const calculatedTokens = Math.floor(usdValue / artistConfig.tokenPrice);
      setPurchaseAmountArtistocks(calculatedTokens);
      setArtistocksInput(calculatedTokens > 0 ? calculatedTokens.toString() : (usdValue === 0 ? "0" : ""));
    } else if (artistConfig) {
      setPurchaseAmountArtistocks(0);
      setArtistocksInput("0");
    }
  }, [swapFromAmount, artistConfig]);

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
          for (const artistKey in initialUnlockedStates) {
            if (initialUnlockedStates.hasOwnProperty(artistKey) && initialUnlockedStates[artistKey]) {
              anyArtistUnlocked = true;
              break;
            }
          }
        } catch (e) {
          console.error("Error parsing unlocked artists from localStorage", e);
          setUnlockedArtistStates({});
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
      } else {
        setAllPurchasedDownloads([]);
      }
    } else {
      setUserTokenBalances({});
      setUnlockedArtistStates({});
      setGlobalSafewordVerified(false);
      setAllPurchasedDownloads([]);
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
    const checkOwnership = async () => {
        if (user && artistConfig && artistConfig.contract && magic) {
            const provider = new ethers.BrowserProvider(magic.rpcProvider as any);
            const contract = new ethers.Contract(artistConfig.contract, ArtistockArtifact.abi, provider);
            try {
                const owner = await contract.owner();
                const isUserOwner = owner.toLowerCase() === user.toLowerCase();
                setIsOwner(isUserOwner);
            } catch (err) {
                console.error("[checkOwnership] Error fetching contract owner:", err);
                setIsOwner(false);
            }
        } else {
            setIsOwner(false);
        }
    };
    checkOwnership();
  }, [user, artistConfig, magic]);

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

    if (user && artistConfig && safewordInput.trim().toLowerCase() === 'artistocks') {
      setSafewordVerified(true);
      const newUnlockedStates = { ...unlockedArtistStates, [currentArtistId]: true };
      setUnlockedArtistStates(newUnlockedStates);
      setGlobalSafewordVerified(true);
      localStorage.setItem('zeyodaUnlockedArtists', JSON.stringify(newUnlockedStates));
      
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

      const newBalance = (userTokenBalances[artistConfig.tokenName] || 0) + purchaseAmountArtistocks;
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

  const handleSafewordSubmit = () => {
    const input = safewordInput.trim().toLowerCase();
    if (!input) return;

    if (input === 'zeyoda') {
      router.push('/create');
      setSafewordInput('');
      return;
    }
    
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

    const correctSafeword = "artistocks";
    if (input === correctSafeword) {
      setSafewordVerified(true);
      const newUnlockedStates = { ...unlockedArtistStates, [artistIdFromUrl]: true };
      setUnlockedArtistStates(newUnlockedStates);
      setGlobalSafewordVerified(true);
      localStorage.setItem('zeyodaUnlockedArtists', JSON.stringify(newUnlockedStates));
      setSafewordInput('');
      return;
    }

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

    setUserTokenBalances({});
    setUnlockedArtistStates({});
    setHasPurchasedDownload(false);
    setShowPurchaseModal(false);
    setPurchaseAmountArtistocks(0);
    setPurchaseAmountDollars(20);
    showToast("You have been logged out.", "info");
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleSafewordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSafewordInput(e.target.value);
  };

  const handleExploreOtherArtist = () => {
    if (!artistConfig) return;
    const currentArtistId = searchParams.get('artist') || 'gosheesh';
    const nextArtistId = currentArtistId.toLowerCase() === 'gosheesh' ? 'jaitea' : 'gosheesh';
    window.location.search = `?artist=${nextArtistId}`;
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
    setShowPurchaseModal(true);
  };

  useEffect(() => {
    if (artistConfig && unlockedArtistStates[artistIdFromUrl] && artistConfig.tokenPrice > 0) {
      if (swapFromAmount.trim() === "" || parseFloat(swapFromAmount || "0") === 0) {
        const defaultUsdAmount = "20.00";
        setSwapFromAmount(defaultUsdAmount);
      }
    }
  }, [artistConfig, unlockedArtistStates, artistIdFromUrl, swapFromAmount]);

  useEffect(() => {
    if (!allArtistsConfig || !user) {
      setDynamicOrbitalTokens([]);
      return;
    }

    const ownedArtistIds = new Set<string>();

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

    if (allPurchasedDownloads && allPurchasedDownloads.length > 0) {
      allPurchasedDownloads.forEach(download => {
        if (download.artistId !== artistIdFromUrl) {
          ownedArtistIds.add(download.artistId);
        }
      });
    }

    const newOrbitalTokensData: RenderableToken[] = [];
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
        });
        currentAngle += angleIncrement;
      }
    });
    
    setDynamicOrbitalTokens(newOrbitalTokensData);

  }, [allArtistsConfig, userTokenBalances, allPurchasedDownloads, user, artistIdFromUrl]);

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
      if (meta.publicAddress && meta.email) {
        localStorage.setItem('zeyodaUserEmail', meta.email);
        showToast('Logged in as ' + meta.publicAddress, 'success');
        setTimeout(() => window.location.reload(), 1500);
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

  if (isLoading || !artistConfig) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="loading-spinner"></div>
        <p className="ml-2">Loading ZEYODA experience for {artistIdFromUrl}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-red-900 text-white">
        <h2 className="text-2xl font-bold mb-4">Oops! Something went wrong.</h2>
        <p className="text-lg">Error loading artist configuration:</p>
        <p className="text-md mt-2 p-4 bg-red-800 rounded">{error}</p>
        <p className="text-sm mt-4">Please check the artist ID in the URL or try again later.</p>
        <button onClick={() => window.location.search = ''} className="mt-6 px-4 py-2 bg-blue-500 hover:bg-blue-700 text-white font-bold rounded">
          Go to Default Artist
        </button>
      </div>
    );
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
    <div className="flex min-h-screen flex-col items-center justify-between p-24 relative bg-primary text-white font-sans">
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
          <h1 className="text-2xl font-bold">{artistConfig?.displayName?.toUpperCase()}</h1>
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
          <div className="text-center">
              <>
                <h1 className="text-6xl md:text-8xl font-bold tracking-wider mb-8" style={{ fontFamily: artistConfig.theme.fontFamily, color: artistConfig.theme.accentColor }}>
                  {artistConfig.displayName}
                </h1>
  
                <div ref={videoContainerRef} className="relative w-full max-w-4xl aspect-video rounded-xl shadow-2xl shadow-black/50 overflow-hidden mx-auto"
                     onMouseEnter={() => isOrbitAnimationPaused.current = true}
                     onMouseLeave={() => isOrbitAnimationPaused.current = false}
                >
                  {artistConfig.videoSrc && !isVideoError ? (
                    <video 
                      id="artistVideo" 
                      autoPlay 
                      loop 
                      muted={isMuted} 
                      playsInline 
                      key={artistConfig.videoSrc} 
                      className="w-full h-full object-cover"
                      onError={() => setIsVideoError(true)}
                      onCanPlay={() => setIsVideoError(false)}
                    >
                      <source src={artistConfig.videoSrc} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div className="w-full h-full bg-black flex flex-col items-center justify-center text-gray-400">
                        <div className="text-4xl">📺</div>
                        <h3 className="mt-2 text-lg">{artistConfig.displayName}'s content preview</h3>
                        <p className="text-sm">Video content {isVideoError ? 'could not be loaded' : 'is unavailable'}</p>
                    </div>
                  )}
                  
                  <div className="absolute top-1/2 left-1/2 w-full h-full" style={{ transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
                    {(([...(artistConfig?.orbitalTokens || []), ...dynamicOrbitalTokens] as RenderableToken[])
                      .filter((token, index, self) => token.name && self.findIndex(t => t.name === token.name) === index)
                      .map((token: RenderableToken, index: number) => {
                        const isClickable = token.artistId && allArtistsConfig && allArtistsConfig[token.artistId];
                        const handleTokenClick = () => {
                            if (isClickable && token.artistId) {
                                isOrbitAnimationPaused.current = true;
                                setTimeout(() => {
                                    router.push(`/?artist=${token.artistId}`);
                                    isOrbitAnimationPaused.current = false;
                                }, 300);
                            }
                        };
                        return (
                          <div 
                            key={token.artistId ? `orbit-${token.artistId}` : `orbit-token-${index}`}
                            ref={(el: HTMLDivElement | null) => {
                              tokenElementRefs.current[index] = el;
                            }}
                            className={`absolute top-1/2 left-1/2 p-2 text-xs rounded-full shadow-lg bg-black bg-opacity-50 backdrop-blur-sm text-white font-bold ${isClickable ? 'cursor-pointer hover:bg-opacity-75' : 'cursor-default'}`}
                            style={{
                              willChange: 'transform, opacity',
                              opacity: 0,
                              pointerEvents: 'auto'
                            }}
                            onClick={handleTokenClick}
                            onMouseEnter={(e) => e.currentTarget.setAttribute('data-hovered', 'true')}
                            onMouseLeave={(e) => e.currentTarget.setAttribute('data-hovered', 'false')}
                            title={isClickable && token.artistId ? `Explore ${allArtistsConfig?.[token.artistId]?.displayName || token.name}` : token.name}
                          >
                            {token.name}
                          </div>
                        );
                     }))
                    }
                  </div>
  
                  <div className="absolute bottom-2 right-2 flex space-x-2">
                      <button className="p-2 rounded-full bg-black bg-opacity-50 hover:bg-opacity-75" aria-label={isMuted ? "Unmute" : "Mute"} onClick={toggleMute}>
                       {isMuted ? '🔇' : '🔊'}
                     </button>
                  </div>
                </div>
              </>
          </div>

          {isOwner && (
            <div className="bg-gray-800 bg-opacity-80 p-4 rounded-lg mt-4 w-full max-w-sm mx-auto text-white">
              <h3 className="text-lg font-bold text-center mb-3">Owner Controls</h3>
              <div className="flex flex-col space-y-2">
                  <label htmlFor="mintAmount" className="text-sm font-medium">Amount to Mint</label>
                  <input
                      id="mintAmount"
                      type="number"
                      value={mintAmount}
                      onChange={(e) => setMintAmount(e.target.value)}
                      placeholder="e.g., 1000000"
                      className="px-3 py-2 text-gray-300 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accentColor"
                      disabled={isMinting}
                  />
                  <button
                      onClick={handleInitialMint}
                      disabled={isMinting || !mintAmount}
                      className="w-full px-4 py-2 font-bold text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-500 disabled:cursor-not-allowed"
                  >
                      {isMinting ? 'Minting...' : 'Mint New Tokens'}
                  </button>
              </div>
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
                disabled={isActionLoading && !!user}
                className={`w-full font-bold py-3 px-6 rounded-lg text-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105 
                  ${!user ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-500 hover:bg-green-600'} text-white`}
              >
                {isActionLoading && !!user ? 'Processing...' : 
                  !user ? '$1.00 INCLUDES PERMANENT ACCESS (SIGN IN TO SELECT)' : `GET DOWNLOAD ($${(1).toFixed(2)})`}
              </button>
            </div>
          )}

          {user && globalSafewordVerified && !purchaseConfirmationData && (
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
                    {allArtistsConfig && (
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
    </div>
  );
}
