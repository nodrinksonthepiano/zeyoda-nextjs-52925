'use client'

import React from 'react';
import Image from "next/image";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import Wallet from './components/Wallet';
import dynamic from 'next/dynamic';
import { useWallet } from './components/MagicProvider';
import { useToast } from './contexts/ToastContext';
import { authenticatedFetch } from './utils/authenticatedFetch';
import { UsdBalanceProvider } from './contexts/UsdBalanceContext';
import { ethers } from "ethers";
import ArtistockArtifact from '../artifacts/contracts/Artistock.sol/Artistock.json';
import useArtistConfig from "./hooks/useArtistConfig";
import { useFeaturedAsset } from "./hooks/useFeaturedAsset";
import OwnerControls from "./components/OwnerControls";
import ArtistVideo from "./components/ArtistVideo";
import { useArtistAssets } from './hooks/useArtistAssets';
import { useAllArtistsDownloadAccess } from './hooks/useDownloadAccess';
import OrbitPeekCarousel from './components/OrbitPeekCarousel';
import OvalGlowBackdrop from './components/OvalGlowBackdrop';
import ThemeOrbitRenderer from "./components/ThemeOrbitRenderer";
import PurchaseFlow from "./components/PurchaseFlow";
import OnboardingPanel from "./components/OnboardingPanel";
import ProfileEditPanel from "./components/ProfileEditPanel";
import AssetEditPanel from "./components/AssetEditPanel";
import {
  ArtistConfig,
  RenderableToken,
  UserTokenBalances
} from '../types/artist-types';
import { applyArtistBackground } from './utils/themeBackground';
import { useCommandSystem } from './hooks/useCommandSystem';
import { ArtistFactoryABI } from './utils/abis/ArtistFactoryABI';
import { clearAllSafewordStorage } from './utils/safewordStorage';
import { useOrbitTokens } from './hooks/useOrbitTokens';
import { supabase } from './utils/supabaseClient';
import ArtistTokenArtifact from '../artifacts/contracts/ArtistToken.sol/ArtistToken.json';
import ArtistDownloadsArtifact from '../artifacts/contracts/ArtistDownloads.sol/ArtistDownloads.json';

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

const ArtistPageContent: React.FC<{
  artistConfig: ArtistConfig;
  allArtistsConfig: { [key: string]: ArtistConfig } | null;
  artistAssets: any[] | null;
  featuredAsset: any | null;
  videoUrl: string | null;
  user: string | null;
  magic: any | null;
}> = ({ 
  artistConfig: initialArtistConfig, 
  allArtistsConfig, 
  artistAssets,
  featuredAsset,
  videoUrl,
  user, 
  magic 
}) => {
  const { showToast } = useToast();
  const { getDidToken } = useWallet();
  const [email, setEmail] = useState('');
  
  // Whitelist and treasure hunt state
  const [showClueInput, setShowClueInput] = useState(false);
  const [clueMessage, setClueMessage] = useState('');
  const [isCheckingWhitelist, setIsCheckingWhitelist] = useState(false);
  const [treasureMessage, setTreasureMessage] = useState('');

  // Onboarding mode state
  const [appMode, setAppMode] = useState<'normal' | 'onboarding' | 'upload-asset' | 'profile-edit' | 'edit-asset'>('normal');
  const [onboardingArtistName, setOnboardingArtistName] = useState('WELCOME, ARTIST!');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [onboardingAspectRatio, setOnboardingAspectRatio] = useState<number | null>(null);
  const [onboardingData, setOnboardingData] = useState<any>({});
  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [artistResults, setArtistResults] = useState<any[]>([]);
  const [assetResults, setAssetResults] = useState<any[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [assetMetadata, setAssetMetadata] = useState<{ [key: string]: any }>({});

  // Feedback state
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // Admin state (for feedback inbox)
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = getDidToken ? await getDidToken() : null;
        const res = await fetch('/api/me', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setIsAdmin(data.isAdmin === true);
        } else {
          setIsAdmin(false);
        }
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, getDidToken]);
  
  // Upload mode state
  const [uploadAssetData, setUploadAssetData] = useState({
    title: '',
    price: 5,
    description: ''
  });

  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Use state to manage artistConfig within this component to respond to prop changes
  const [artistConfig, setArtistConfig] = useState(initialArtistConfig);
  const lastSaveTimeRef = useRef<number>(0); // Track when Save happened to prevent overwrite
  
  useEffect(() => {
    // Don't overwrite if user is actively editing profile (preserve live preview state)
    if (appMode === 'profile-edit') {
      console.log('[page.tsx] ⏭️ Skipping artistConfig sync - profile-edit mode active');
      return;
    }
    
    // CRITICAL: Don't overwrite if we just saved (within last 2 seconds)
    // This prevents the hook refresh from overwriting our updated state
    const timeSinceSave = Date.now() - lastSaveTimeRef.current;
    if (timeSinceSave < 2000) {
      console.log('[page.tsx] ⏭️ Skipping artistConfig sync - recent save detected', {
        timeSinceSave,
        preservingLogoFields: {
          logo_url: artistConfig?.logo_url,
          logo_use_background: artistConfig?.logo_use_background
        }
      });
      return;
    }
    
    // Only sync if initialArtistConfig actually changed (logo fields OR theme fields)
    // This prevents overwriting with stale data that's missing logo/theme fields
    const hasLogoChanges = initialArtistConfig && (
      initialArtistConfig.logo_url !== artistConfig?.logo_url ||
      initialArtistConfig.logo_use_background !== artistConfig?.logo_use_background ||
      initialArtistConfig.background_image_url !== artistConfig?.background_image_url ||
      initialArtistConfig.background_use_image !== artistConfig?.background_use_image
    );
    
    const hasThemeChanges = initialArtistConfig && (
      initialArtistConfig.theme?.primaryColor !== artistConfig?.theme?.primaryColor ||
      initialArtistConfig.theme?.accentColor !== artistConfig?.theme?.accentColor ||
      initialArtistConfig.theme?.fontFamily !== artistConfig?.theme?.fontFamily
    );
    
    if (initialArtistConfig && (hasLogoChanges || hasThemeChanges)) {
      console.log('[page.tsx] 🔄 Syncing artistConfig from hook:', {
        logo_url: initialArtistConfig.logo_url,
        logo_use_background: initialArtistConfig.logo_use_background,
        background_image_url: initialArtistConfig.background_image_url,
        background_use_image: initialArtistConfig.background_use_image,
        primaryColor: initialArtistConfig.theme?.primaryColor,
        accentColor: initialArtistConfig.theme?.accentColor
      });
      setArtistConfig(initialArtistConfig);
    }
  }, [initialArtistConfig, appMode, artistConfig]);

  // Live primary color for halo updates during editing
  const [livePrimaryColor, setLivePrimaryColor] = useState<string | null>(null);
  
  // Listen for primary color changes from ProfileEditPanel
  useEffect(() => {
    const handlePrimaryColorChange = (e: CustomEvent) => {
      setLivePrimaryColor(e.detail.color);
    };
    
    window.addEventListener('primaryColorChange' as any, handlePrimaryColorChange as EventListener);
    
    return () => {
      window.removeEventListener('primaryColorChange' as any, handlePrimaryColorChange as EventListener);
    };
  }, []);
  
  // Reset live color when exiting edit mode
  useEffect(() => {
    if (appMode !== 'profile-edit' && appMode !== 'onboarding') {
      setLivePrimaryColor(null);
    }
  }, [appMode]);
  
  // Get the current primary color (live during editing, or from config)
  const currentPrimaryColor = livePrimaryColor || artistConfig?.theme?.primaryColor || '#0a1a3b';

  const artistIdFromUrl = (searchParams.get('artist') ?? 'gosheesh') as string;
  const assetNumberFromUrl = searchParams.get('asset');
  const [carouselIndex, setCarouselIndex] = useState(0);

  // When artist changes, reset the carousel to the first item.
  useEffect(() => {
    setCarouselIndex(0);
  }, [artistIdFromUrl]);

  // Deep-link: Focus specific asset from URL parameter (race-safe)
  useEffect(() => {
    // Only run client-side after assets are loaded
    if (typeof window === 'undefined') return;
    if (!assetNumberFromUrl || !artistAssets || artistAssets.length === 0) return;
    
    const targetAssetNumber = parseInt(assetNumberFromUrl, 10);
    
    // Guard against NaN/negative
    if (isNaN(targetAssetNumber) || targetAssetNumber < 0) {
      console.warn('[Deep-link] Invalid asset number:', assetNumberFromUrl);
      setCarouselIndex(0);
      return;
    }
    
    // Find by assetNumber (not array index!)
    const foundIndex = artistAssets.findIndex((a: any) => a.assetNumber === targetAssetNumber);
    
    if (foundIndex >= 0) {
      setCarouselIndex(foundIndex);
      console.log('[Deep-link] ✅ Focused asset:', targetAssetNumber, 'at index', foundIndex);
    } else {
      // Asset doesn't exist - fallback to first
      setCarouselIndex(0);
      console.warn('[Deep-link] ⚠️ Asset not found:', targetAssetNumber, '- falling back to first asset');
    }
  }, [assetNumberFromUrl, artistAssets]);

  // ==================== SEARCH FUNCTIONALITY ====================
  
  // Debounce hook
  function useDebounced<T>(value: T, delay: number = 150): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    
    useEffect(() => {
      const timer = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(timer);
    }, [value, delay]);
    
    return debouncedValue;
  }
  
  const debouncedQuery = useDebounced(searchQuery, 150);
  
  // Damerau-Levenshtein distance (handles transpositions)
  function damerauLevenshtein(a: string, b: string): number {
    const len1 = a.length, len2 = b.length;
    const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
    
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i-1][j] + 1,      // deletion
          matrix[i][j-1] + 1,      // insertion
          matrix[i-1][j-1] + cost  // substitution
        );
        
        // Transposition
        if (i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1]) {
          matrix[i][j] = Math.min(matrix[i][j], matrix[i-2][j-2] + cost);
        }
      }
    }
    
    return matrix[len1][len2];
  }

  /** Smallest DL distance from query to any alphanumeric token in target (matches anywhere in the title). */
  function fuzzyBestDistance(q: string, t: string): number {
    const tokens = t.split(/[^a-z0-9]+/i).filter((x) => x.length > 0);
    const candidates = tokens.length > 0 ? tokens : [t];
    let minD = Infinity;
    for (const c of candidates) {
      const d = damerauLevenshtein(q, c);
      if (d < minD) minD = d;
    }
    return minD === Infinity ? damerauLevenshtein(q, t) : minD;
  }

  function distanceToFuzzyScore(distance: number, queryLen: number): number {
    if (distance === 0) return 100;
    if (distance === 1) return 60;
    // Two edits: allow short queries (was queryLen >= 5 only)
    if (distance === 2 && queryLen >= 3) return 40;
    return 0;
  }
  
  // Score a match (higher is better)
  function scoreMatch(query: string, target: string, queryLen: number): number {
    const q = query.toLowerCase().trim();
    const t = target.toLowerCase().trim();
    
    if (!q || !t) return 0;

    // Prefix match (highest priority)
    if (t.startsWith(q)) return 100;
    
    // Substring match
    if (t.includes(q)) return 80;

    // Per-token substring (query appears inside a word after punctuation)
    const tokens = t.split(/[^a-z0-9]+/i).filter((x) => x.length > 0);
    for (const token of tokens) {
      if (token.includes(q)) return 80;
    }
    
    // Fuzzy: best distance against any token (typo tolerance, e.g. "gaoa" → "gaia")
    const distance = fuzzyBestDistance(q, t);
    return distanceToFuzzyScore(distance, queryLen);
  }

  const selectedAsset = React.useMemo(() => {
    if (!artistAssets || artistAssets.length === 0) return null;
    const idx = ((carouselIndex % artistAssets.length) + artistAssets.length) % artistAssets.length;
    return artistAssets[idx];
  }, [artistAssets, carouselIndex]);

  // Provide a stable remount key for the carousel per artist + dataset
  const carouselKey = React.useMemo(() => {
    const ids = (artistAssets || []).map((a: any) => a?.id ?? a?.url ?? '').join('_');
    return `${artistIdFromUrl}:${(artistAssets?.length || 0)}:${ids}`;
  }, [artistIdFromUrl, artistAssets]);

  const featuredForPurchaseFlow = React.useMemo(() => {
    if (selectedAsset) {
      return {
        price_usd: selectedAsset.priceUSD ?? 5,
        file_url: selectedAsset.url,
        file_type: selectedAsset.type === 'video' ? 'video/mp4' : 'image/jpeg',
        asset_number: selectedAsset.assetNumber
      } as any;
    }
    return featuredAsset as any;
  }, [selectedAsset, featuredAsset]);

  // Handle upload mode from URL parameter
  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'upload' && user && artistConfig) {
      const isOwner = artistConfig.treasury_wallet?.toLowerCase() === user.toLowerCase();
      if (isOwner) {
        setAppMode('upload-asset');
        // Remove mode parameter from URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('mode');
        router.replace(newUrl.pathname + newUrl.search);
      }
    }
  }, [searchParams, user, artistConfig, router]);

  // Close upload form if user navigates to a page they don't own
  useEffect(() => {
    if (appMode === 'upload-asset' && user && artistConfig) {
      const isOwner = artistConfig.treasury_wallet?.toLowerCase() === user.toLowerCase();
      if (!isOwner) {
        setAppMode('normal');
        setUploadedFile(null);
        setUploadAssetData({ title: '', price: 5, description: '' });
      }
    }
  }, [artistIdFromUrl, user, artistConfig, appMode]);

  const [isMuted, setIsMuted] = useState(true);
  const [shakeActive, setShakeActive] = useState(false);
  const [editPanelShakeActive, setEditPanelShakeActive] = useState(false);
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
  const onboardingContainerRef = useRef<HTMLDivElement>(null);
  const isOrbitAnimationPaused = useRef(false);
  const lastShakeRequestRef = useRef<number>(0);

  // File upload handlers
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  
  const handleFileSelect = useCallback((file: File) => {
    // Clean up previous preview URL
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    
    // Create new preview URL
    const previewUrl = URL.createObjectURL(file);
    setFilePreviewUrl(previewUrl);
    
    setUploadedFile(file);
    setOnboardingData(prev => ({ ...prev, uploadedFile: file }));
    console.log('File selected:', file.name, file.type, file.size);
  }, [filePreviewUrl]);
  
  // Cleanup preview URL when component unmounts
  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  // ==================== SEARCH FUNCTIONALITY ====================
  
  // Fetch user's downloads for search
  const { allDownloads } = useAllArtistsDownloadAccess(
    user || null,
    allArtistsConfig
  );
  
  // Fetch asset metadata for search
  useEffect(() => {
    if (!allDownloads || !allArtistsConfig) return;
    
    const fetchMetadata = async () => {
      const metadata: { [key: string]: any } = {};
      
      for (const [artistId, downloads] of Object.entries(allDownloads)) {
        if (!downloads || downloads.length === 0) continue;
        
        for (const download of downloads as any[]) {
          const assetKey = `${artistId}_${download.assetNumber}`;
          
          try {
            const { data } = await supabase
              .from('artist_assets')
              .select('metadata, asset_number')
              .eq('artist_id', artistId)
              .eq('asset_number', download.assetNumber)
              .single();
            
            if (data) {
              metadata[assetKey] = data;
            }
          } catch (error) {
            console.warn(`Failed to fetch metadata for ${assetKey}:`, error);
          }
        }
      }
      
      setAssetMetadata(metadata);
    };
    
    fetchMetadata();
  }, [allDownloads, allArtistsConfig]);
  
  // Build owned assets index (for search)
  const ownedAssetsIndex = useMemo(() => {
    if (!allArtistsConfig || !allDownloads) return [];
    
    const index: any[] = [];
    
    Object.entries(allDownloads).forEach(([artistId, downloads]) => {
      const config = allArtistsConfig[artistId];
      if (!config || !downloads || downloads.length === 0) return;
      
      (downloads as any[]).forEach((download: any) => {
        const assetKey = `${artistId}_${download.assetNumber}`;
        const metadata = assetMetadata?.[assetKey];
        const title = metadata?.metadata?.title || `${config.artworkTitle || config.name} #${download.assetNumber}`;
        
        index.push({
          kind: '1155',
          artistId,
          artistDisplayName: config.displayName || config.name,
          assetNumber: download.assetNumber,
          title,
          titleNorm: title.toLowerCase().trim(),
          theme: config.theme
        });
      });
    });
    
    return index;
  }, [allArtistsConfig, allDownloads, assetMetadata]);
  
  // Build owned artists index (for search)
  const ownedArtistsIndex = useMemo(() => {
    if (!allArtistsConfig || !user) return [];
    
    return Object.entries(allArtistsConfig).filter(([id, config]) => {
      const tokenBalance = userTokenBalances?.[config.tokenName] ?? 0n;
      const hasTokens = (typeof tokenBalance === 'bigint' ? tokenBalance : BigInt(tokenBalance || 0)) > 0n;
      const hasDownloads = allDownloads?.[id] && allDownloads[id].length > 0;
      return hasTokens || hasDownloads;
    }).map(([id, config]) => ({
      kind: 'artist' as const,
      id,
      config,
      scoreFields: [
        config.name?.toLowerCase() || '',
        config.displayName?.toLowerCase() || '',
        config.tokenName?.toLowerCase() || ''
      ]
    }));
  }, [allArtistsConfig, userTokenBalances, allDownloads, user]);
  
  // Search effect (runs on debounced query)
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length === 0) {
      setArtistResults([]);
      setAssetResults([]);
      setShowSearchDropdown(false);
      return;
    }
    
    if (!user) return;
    
    const queryLen = debouncedQuery.length;
    
    // Search artists
    const scoredArtists = ownedArtistsIndex
      .map(artist => {
        const maxScore = Math.max(
          ...artist.scoreFields.map(field => scoreMatch(debouncedQuery, field, queryLen))
        );
        return { artist, score: maxScore };
      })
      .filter(({ score }) => score >= 40)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ artist }) => artist);
    
    // Search owned assets
    const scoredAssets = ownedAssetsIndex
      .map(asset => {
        const score = Math.max(
          scoreMatch(debouncedQuery, asset.titleNorm, queryLen),
          scoreMatch(debouncedQuery, asset.artistDisplayName.toLowerCase(), queryLen)
        );
        return { asset, score };
      })
      .filter(({ score }) => score >= 40)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ asset }) => asset);
    
    setArtistResults(scoredArtists);
    setAssetResults(scoredAssets);
    setShowSearchDropdown(scoredArtists.length > 0 || scoredAssets.length > 0);
    setSelectedSearchIndex(0);
  }, [debouncedQuery, ownedArtistsIndex, ownedAssetsIndex, user]);
  
  // Click outside to close dropdown
  useEffect(() => {
    if (!showSearchDropdown) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.chat-input-container')) {
        setShowSearchDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSearchDropdown]);

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
    console.log('🚀 Starting UUPS artist deployment via factory...', artistData);
    
    try {
      if (!magic) throw new Error('Magic not initialized');
      
      showToast('⚡ Deploying via Factory (single transaction)...', 'info');
      
      const provider = new ethers.BrowserProvider(magic.rpcProvider as any);
      const signer = await provider.getSigner();
      const artistWallet = await signer.getAddress();
      
      // Get factory address from env
      const factoryAddress = process.env.NEXT_PUBLIC_ARTIST_FACTORY;
      if (!factoryAddress) {
        throw new Error('Factory not configured. Add NEXT_PUBLIC_ARTIST_FACTORY to .env.local');
      }
      
      const factory = new ethers.Contract(
        factoryAddress,
        ArtistFactoryABI,
        signer
      );
      
      // Prepare artist identifiers
      const tokenName = artistData.tokenName || artistData.name;
      const tokenSymbol = tokenName.toUpperCase().replace(/\s+/g, '');
      const artistId = tokenSymbol.toLowerCase();
      
      console.log('📝 Calling factory.createArtist()...');
      console.log('   Name:', tokenName);
      console.log('   Symbol:', tokenSymbol);
      console.log('   ID:', artistId);
      console.log('   Artist Wallet:', artistWallet);
      
      // Single transaction deploys everything
      const tx = await factory.createArtist(
        tokenName,
        tokenSymbol,
        artistId,
        artistWallet
      );
      
      showToast('⏳ Deploying contracts...', 'info');
      const receipt = await tx.wait();
      
      // Parse ArtistCreated event
      console.log('📡 Parsing ArtistCreated event...');
      const iface = new ethers.Interface(ArtistFactoryABI);
      let tokenProxy: string | undefined;
      let downloadsProxy: string | undefined;
      let ammProxy: string | undefined;
      
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === 'ArtistCreated') {
            tokenProxy = parsed.args.tokenProxy;
            downloadsProxy = parsed.args.downloadsProxy;
            ammProxy = parsed.args.ammProxy;
            console.log('✅ Event parsed successfully');
            break;
          }
        } catch (e) {
          // Skip non-matching logs
        }
      }
      
      if (!tokenProxy || !downloadsProxy || !ammProxy) {
        throw new Error('ArtistCreated event not found in transaction receipt');
      }
      
      console.log('✅ Factory deployment complete!');
      console.log('   Token:', tokenProxy);
      console.log('   Downloads:', downloadsProxy);
      console.log('   AMM:', ammProxy);
      
      // Upload featured content
      console.log('📝 Uploading featured content...');
      const contentUrl = await uploadFeaturedContent(uploadedFile, artistId);
      
      // Save to Supabase
      console.log('📝 Saving to Supabase...');
      await saveArtistToDatabase({
        ...artistData,
        id: artistId,
        tokenAddress: tokenProxy,
        downloadsAddress: downloadsProxy,
        poolAddress: ammProxy,
        contentUrl: contentUrl,
        treasuryWallet: artistWallet
      });
      
      // Upload logo and background images (if provided)
      if (artistData.logoFile) {
        try {
          console.log('📤 Uploading logo...');
          const logoFormData = new FormData();
          logoFormData.append('file', artistData.logoFile);
          logoFormData.append('artistId', artistId);
          
          const logoResponse = await authenticatedFetch('/api/uploadLogo', {
            method: 'POST',
            headers: {
              'x-wallet-address': artistWallet.toLowerCase()
            },
            body: logoFormData
          }, getDidToken);
          
          if (logoResponse.ok) {
            const logoResult = await logoResponse.json();
            // Update artist with logo URL
            await authenticatedFetch('/api/artist/profile', {
              method: 'PATCH',
              headers: {
                'x-wallet-address': artistWallet.toLowerCase()
              },
              body: JSON.stringify({
                artistId: artistId,
                logo_url: logoResult.logoUrl,
                logo_use_background: artistData.logo_use_background || false
              })
            }, getDidToken);
            console.log('✅ Logo uploaded');
          }
        } catch (logoError) {
          console.warn('⚠️ Logo upload failed (non-critical):', logoError);
        }
      }
      
      if (artistData.backgroundFile) {
        try {
          console.log('📤 Uploading background image...');
          const bgFormData = new FormData();
          bgFormData.append('file', artistData.backgroundFile);
          bgFormData.append('artistId', artistId);
          
          const bgResponse = await authenticatedFetch('/api/uploadBackground', {
            method: 'POST',
            headers: {
              'x-wallet-address': artistWallet.toLowerCase()
            },
            body: bgFormData
          }, getDidToken);
          
          if (bgResponse.ok) {
            const bgResult = await bgResponse.json();
            // Update artist with background URL
            await authenticatedFetch('/api/artist/profile', {
              method: 'PATCH',
              headers: {
                'x-wallet-address': artistWallet.toLowerCase()
              },
              body: JSON.stringify({
                artistId: artistId,
                background_image_url: bgResult.backgroundImageUrl,
                background_use_image: artistData.background_use_image || false
              })
            });
            console.log('✅ Background image uploaded');
          }
        } catch (bgError) {
          console.warn('⚠️ Background upload failed (non-critical):', bgError);
        }
      }
      
      // Mint first asset as ERC-1155 (if file was uploaded)
      if (uploadedFile) {
        console.log('🪙 Minting Asset #1...');
        try {
          const formData = new FormData();
          formData.append('file', uploadedFile);
          formData.append('artistId', artistId);
          formData.append('title', artistData.artworktitle || 'Featured Content');
          formData.append('price', (artistData.downloadPrice || 1).toString());
          formData.append('description', artistData.description || 'First featured asset');
          formData.append('userAddress', artistWallet);
          
          const uploadResponse = await authenticatedFetch('/api/public/uploadAsset', {
            method: 'POST',
            body: formData
          }, getDidToken);
          
          if (uploadResponse.ok) {
            console.log('✅ Asset #1 minted successfully!');
          } else {
            console.warn('⚠️ Asset minting failed (non-critical)');
          }
        } catch (mintError) {
          console.warn('⚠️ Asset minting error:', mintError);
        }
      }
      
      console.log('🎉 Artist created successfully!');
      showToast(`🎉 ${tokenName} launched successfully!`, 'success');
      
      // Redirect to new artist page
      window.location.href = `/?artist=${artistId}`;
      
    } catch (error: any) {
      console.error('❌ Factory deployment failed:', error);
      showToast(`❌ Deployment failed: ${error.message}`, 'error');
    }
  }, [magic, uploadedFile, showToast]);

  // ASSET EDIT HANDLER
  const handleSaveAssetEdit = useCallback(async (updates: { title: string; description: string; price: number }) => {
    if (!editingAsset || !user) return;
    
    try {
      showToast('💾 Saving changes...', 'info');
      
      const response = await authenticatedFetch('/api/updateAsset', {
        method: 'POST',
        body: JSON.stringify({
          artistId: artistIdFromUrl,
          assetNumber: editingAsset.assetNumber,
          title: updates.title,
          description: updates.description,
          price: updates.price,
          userAddress: user
        })
      }, getDidToken);
      
      if (!response.ok) {
        throw new Error('Update failed');
      }
      
      showToast('✅ Asset updated!', 'success');
      setAppMode('normal');
      setEditingAsset(null);
      
      // Refresh page to show updated asset
      setTimeout(() => window.location.reload(), 500);
      
    } catch (error: any) {
      console.error('❌ Asset update failed:', error);
      showToast(`❌ Update failed: ${error.message}`, 'error');
    }
  }, [editingAsset, user, artistIdFromUrl, showToast]);

  // DEPLOYMENT HELPER FUNCTIONS
  const checkExistingToken = async (artistId: string) => {
    try {
      // Check Supabase for existing token address
      const { data, error } = await supabase
        .from('artists')
        .select('token_address')
        .eq('id', artistId)
        .single();
      
      if (error || !data?.token_address) {
        return null;
      }
      
      console.log(`🔍 Found existing token for ${artistId}: ${data.token_address}`);
      return data.token_address;
    } catch (error) {
      console.warn('Error checking existing token:', error);
      return null;
    }
  };

  const deployArtistToken = async (artistData: any) => {
    if (!magic) throw new Error('Magic not initialized');
    
    const provider = new ethers.BrowserProvider(magic.rpcProvider as any);
    const signer = await provider.getSigner();
    const ownerAddress = await signer.getAddress();
    
    const factory = new ethers.ContractFactory(
      ArtistTokenArtifact.abi,
      ArtistTokenArtifact.bytecode,
      signer
    );
    
    // Generate token symbol from artist name (like CANCAKES -> CANCAKES)
    const tokenName = artistData.tokenName || artistData.name;
    const tokenSymbol = (artistData.tokenName || artistData.name).replace(/\s+/g, '').toUpperCase();
    
    console.log(`Deploying ArtistToken for ${tokenName} (${tokenSymbol}) with artist ${ownerAddress}...`);
    
    const protocolVault = "0x615258a5263DBEe0DDEED3166ddC1f442D937eB3";
    const contract = await factory.deploy(
      tokenName,      // ✅ Token name (e.g., "CANCAKES")
      tokenSymbol,    // ✅ Token symbol (e.g., "CANCAKES") 
      ownerAddress,   // ✅ Artist wallet
      protocolVault   // ✅ Protocol vault
    );
    
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    console.log("✅ Contract deployed successfully at:", address);
    
    // Execute initial mint (10B distribution) - using contract interface
    const artistToken = new ethers.Contract(address, ArtistTokenArtifact.abi, signer);
    console.log(`Minting 10B ${tokenSymbol} with automatic distribution...`);
    const mintTx = await artistToken.initialMint();
    await mintTx.wait();
    console.log("✅ 10B supply minted and distributed. Tx:", mintTx.hash);
    console.log("Distribution: 1B to artist, 100M to protocol (LP seeding), 8.9B to vault");
    
    return { address, contract };
  };
  
  const deployArtistDownloads = async (artistData: any, tokenAddress: string) => {
    if (!magic) throw new Error('Magic not initialized');
    
    const provider = new ethers.BrowserProvider(magic.rpcProvider as any);
    const signer = await provider.getSigner();
    
    const factory = new ethers.ContractFactory(
      ArtistDownloadsArtifact.abi,
      ArtistDownloadsArtifact.bytecode,
      signer
    );
    
    console.log(`Deploying ArtistDownloads for ${artistData.id}...`);
    
    // ArtistDownloads constructor: (artistId, baseURI)
    const baseURI = `https://api.zeyoda.com/metadata/${artistData.id}/`;
    const contract = await factory.deploy(
      artistData.id,    // ✅ Artist ID (e.g., "cancakes")
      baseURI          // ✅ Base URI for metadata
    );
    
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    
    console.log('✅ ArtistDownloads deployed successfully at:', address);
    return { address, contract };
  };
  
  const createLiquidityPool = async (tokenAddress: string, artistData: any) => {
    if (!magic) throw new Error('Magic not initialized');
    
    console.log('🏊 Creating liquidity pool for', artistData.name);
    
    const provider = new ethers.BrowserProvider(magic.rpcProvider as any);
    const signer = await provider.getSigner();
    
    // Use the NEW main swap contract (deployer-owned)
    const MAIN_SWAP_ADDRESS = "0xdBBfFD696484bBFCa3dA059FB1d8e2Cf40c450dE";
    
    const swapABI = [
      "function createPool(address token, uint256 tokenAmount) external payable",
      "function getPool(address token) external view returns (tuple(address token, uint256 tokenReserve, uint256 ethReserve, bool active))"
    ];
    
    const erc20ABI = [
      "function approve(address spender, uint256 amount) external returns (bool)",
      "function balanceOf(address owner) external view returns (uint256)"
    ];
    
    try {
      const swapContract = new ethers.Contract(MAIN_SWAP_ADDRESS, swapABI, signer);
      const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, signer);
      
      // Check if pool already exists
      const existingPool = await swapContract.getPool(tokenAddress);
      if (existingPool.active) {
        console.log('✅ Liquidity pool already exists');
        return MAIN_SWAP_ADDRESS;
      }
      
      // LP amounts: 100M tokens + 0.01 ETH (same as other artists)
      const LP_TOKENS = ethers.parseUnits("100000000", 18);  // 100M tokens
      const LP_ETH = ethers.parseEther("0.01");               // 0.01 ETH
      
      console.log(`Creating pool with ${ethers.formatUnits(LP_TOKENS, 18)} tokens + ${ethers.formatEther(LP_ETH)} ETH`);
      
      // Approve tokens for the swap contract
      const approveTx = await tokenContract.approve(MAIN_SWAP_ADDRESS, LP_TOKENS);
      await approveTx.wait();
      console.log('✅ Tokens approved for LP creation');
      
      // Create the liquidity pool
      const createTx = await swapContract.createPool(tokenAddress, LP_TOKENS, {
        value: LP_ETH,
        gasLimit: 500000
      });
      
      await createTx.wait();
      console.log('✅ Liquidity pool created successfully!');
      
      return MAIN_SWAP_ADDRESS;
      
    } catch (error: any) {
      console.error('❌ LP creation failed:', error.message);
      // Don't fail the entire onboarding - LP can be created later
      showToast('⚠️ LP creation failed, but artist created successfully', 'warning');
      return MAIN_SWAP_ADDRESS;
    }
  };
  
  const uploadFeaturedContent = async (file: File | null, artistId: string) => {
    if (!file) {
      console.log('📁 No file uploaded, using placeholder');
      return 'assets/placeholder.mp4';
    }
    
    try {
      console.log('📤 Uploading featured content to Supabase storage...');
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${artistId}/featured.${fileExt}`;
      
      // Upload to artist-assets bucket (same as regular assets - this bucket exists!)
      const { data, error } = await supabase.storage
        .from('artist-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) {
        console.warn('⚠️ File upload failed, using placeholder:', error.message);
        return 'assets/placeholder.mp4';
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('artist-assets')
        .getPublicUrl(fileName);
      
      console.log('✅ File uploaded successfully:', urlData.publicUrl);
      return urlData.publicUrl;
      
    } catch (error) {
      console.warn('⚠️ File upload error, using placeholder:', error);
      return 'assets/placeholder.mp4';
    }
  };
  
  const saveArtistToDatabase = async (artistData: any) => {
    // Use service role to bypass RLS - call our API route instead
    console.log('💾 Saving to database via API route...');
    
    // Get signer for treasury wallet
    const provider = new ethers.BrowserProvider(magic.rpcProvider as any);
    const signer = await provider.getSigner();
    
    // Prepare complete artist data for API
    const completeArtistData = {
      // Basic info
      id: artistData.id,
      name: artistData.name,
      displayname: artistData.displayname,
      tokenName: artistData.tokenName || artistData.name, // Add missing tokenName field
      artworktitle: artistData.artworktitle,
      artworkyear: artistData.artworkyear,
      
      // Contract addresses
      tokenAddress: artistData.tokenAddress,
      downloadsAddress: artistData.downloadsAddress,
      poolAddress: artistData.poolAddress,
      contentUrl: artistData.contentUrl,
      
      // Theme data
      primaryColor: artistData.theme?.primaryColor,
      accentColor: artistData.theme?.accentColor,
      gradientStart: artistData.theme?.gradientStart,
      gradientMiddle: artistData.theme?.gradientMiddle,
      gradientEnd: artistData.theme?.gradientEnd,
      fontFamily: artistData.theme?.fontFamily,
      
      // Treasury wallet
      treasuryWallet: await signer.getAddress(),
      
      // Download price
      downloadPrice: artistData.downloadPrice || 5
    };
    
    // Call API route to save with service role permissions
    const response = await authenticatedFetch('/api/createArtist', {
      method: 'POST',
      body: JSON.stringify(completeArtistData),
    }, getDidToken);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${errorData.error || 'Unknown error'}`);
    }
    
    const result = await response.json();
    console.log('✅ Artist saved via API:', result);
    
    console.log('✅ Artist saved to database');
  };

  const handleExitOnboarding = useCallback(() => {
    // Clear onboarding mode flag
    (window as any).onboardingMode = false;
    
    setAppMode('normal');
    setOnboardingArtistName('WELCOME, ARTIST!');
    setOnboardingData({});
    setUploadedFile(null);
    setUploadAssetData({ title: '', price: 5, description: '' });
    showToast(appMode === 'upload-asset' ? 'Upload cancelled' : 'Onboarding cancelled', 'info');
  }, [showToast, appMode]);

  const handleUploadAsset = useCallback(async (assetData: any) => {
    if (!artistConfig || !uploadedFile || !user) {
      showToast('Please select a file and enter asset details', 'error');
      return;
    }

    console.log('🎨 Uploading new asset for', artistConfig.name, assetData);
    
    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('artistId', artistIdFromUrl);
      formData.append('title', assetData.artworktitle);
      formData.append('price', assetData.downloadPrice.toString());
      formData.append('description', assetData.description || '');
      formData.append('userAddress', user);

      const response = await authenticatedFetch('/api/public/uploadAsset', {
        method: 'POST',
        body: formData,
      }, getDidToken);

      const result = await response.json();

      if (response.ok) {
        showToast(result.message, 'success');
        setAppMode('normal');
        setUploadedFile(null);
        setUploadAssetData({ title: '', price: 5, description: '' });
        // TODO: Refresh the page to show new asset
      } else {
        showToast(`Upload failed: ${result.error}`, 'error');
      }
    } catch (error: any) {
      showToast(`Upload failed: ${error.message}`, 'error');
    }
  }, [artistConfig, uploadedFile, user, showToast, setAppMode, setUploadedFile, setUploadAssetData, artistIdFromUrl]);

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

  // Initialize onboarding theme once when entering onboarding mode (NEW ARTISTS ONLY)
  useEffect(() => {
    // CRITICAL: Never run onboarding cleanup during profile-edit mode
    // ProfileEditPanel handles its own background during editing
    if (appMode === 'profile-edit') {
      console.log('[page.tsx] 🚫 Skipping onboarding cleanup - profile-edit mode active');
      return;
    }
    
    if (appMode === 'onboarding') {
      // Set global flag to suspend auto-refreshes
      (window as any).onboardingMode = true;
      
      // Apply initial onboarding theme (tan canvas for new artists)
      document.documentElement.style.setProperty('--primary-color', '#FAF0E6');
      document.documentElement.style.setProperty('--accent-color', '#B8860B');
      document.documentElement.style.setProperty('--gradient-start', '#FAF0E6');
      document.documentElement.style.setProperty('--gradient-middle', '#FDF5E6');
      document.documentElement.style.setProperty('--gradient-end', '#F5F5DC');
      document.body.style.background = 'linear-gradient(135deg, #FAF0E6 0%, #FDF5E6 50%, #F5F5DC 100%)';
      document.body.style.fontFamily = 'Bungee, cursive';
      console.log('[page.tsx] 🎨 Applied onboarding linen canvas background');
    } else {
      // Clear onboarding flag when exiting onboarding mode
      (window as any).onboardingMode = false;
      
      // CRITICAL: Don't clear background here - let theme effect handle it
      // Clearing here can cause tan flash if ProfileEditPanel just applied logo
      console.log('[page.tsx] 🧹 Onboarding mode exited, theme effect will restore correct background');
      // DO NOT clear background styles here - let the theme effect do it atomically
    }
  }, [appMode]); // ONLY depend on appMode - never run during profile-edit
  
  // Separate useEffect for normal theme application - NEVER runs during onboarding or profile-edit
  useEffect(() => {
    // COMPLETELY SKIP if in onboarding mode (new artists get tan canvas)
    if (appMode === 'onboarding') {
      console.log('[page.tsx] 🚫 Skipping theme application - onboarding mode active');
      return;
    }
    
    // SKIP if in profile-edit mode (ProfileEditPanel handles live preview)
    if (appMode === 'profile-edit') {
      console.log('[page.tsx] 🚫 Skipping theme application - profile-edit mode active (handled by panel)');
      return;
    }
    
    // Normal mode: use artist theme via single decider function
    console.log('[page.tsx] 🎨 Theme effect: Applying background with config:', {
      logo_url: artistConfig?.logo_url,
      logo_use_background: artistConfig?.logo_use_background,
      background_image_url: artistConfig?.background_image_url,
      background_use_image: artistConfig?.background_use_image,
      primaryColor: artistConfig?.theme?.primaryColor,
      appMode
    });
    applyArtistBackground(artistConfig);
  }, [artistConfig, appMode]);

  useEffect(() => {
    const dollarValueForTokens = parseFloat(swapFromAmount || '0');

    let calculatedTotal = 0;
    
    // Only add token cost if we're buying tokens
    if (dollarValueForTokens > 0) {
      calculatedTotal += dollarValueForTokens;
    }
    
    // Only add download cost if checkbox is checked and not already purchased
    if (includeDownload && !hasPurchasedDownload) {
      const downloadPrice = featuredAsset?.price_usd || 5;
      calculatedTotal += downloadPrice;
    }
    
    console.log("💰 Price calculation:", {
      dollarValueForTokens,
      includeDownload,
      hasPurchasedDownload,
      calculatedTotal
    });
    
    setTotalPurchasePrice(calculatedTotal);
  }, [swapFromAmount, includeDownload, hasPurchasedDownload, featuredAsset]);



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

    try {
      // Handle download purchase with new record→mint flow
      if (includeDownload) {
        console.log('🛒 Starting download purchase flow for:', artistConfig.name);
        showToast("Recording your purchase...", "info");

        // 1) Generate unique external ID for idempotency
        const externalId = `eth-${user}-${artistConfig.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const assetNumber = 1; // Featured asset for now

        // 2) Record the sale
        const recordResponse = await authenticatedFetch('/api/record-sale', {
          method: 'POST',
          body: JSON.stringify({
            userAddress: user,
            artistId: artistConfig.name,
            assetNumber,
            externalId
          })
        });

        const recordResult = await recordResponse.json();

        if (!recordResult.success && !recordResult.duplicate) {
          throw new Error(recordResult.error || 'Failed to record sale');
        }

        if (recordResult.duplicate) {
          showToast('Purchase already processed', 'info');
          setShowPurchaseModal(false);
          return;
        }

        console.log('✅ Sale recorded, earning ID:', recordResult.earningId);
        showToast("Minting your collectible...", "info");

        // 3) Mint the collectible (gas-sponsored)
        const mintResponse = await authenticatedFetch('/api/public/mintCollectible', {
          method: 'POST',
          body: JSON.stringify({
            userAddress: user,
            artistId: artistConfig.name,
            assetNumber
          })
        }, getDidToken);

        const mintResult = await mintResponse.json();

        if (!mintResult.success) {
          if (mintResult.budget === 'exceeded') {
            showToast('Network busy; sale recorded. We\'ll retry minting shortly.', 'warning');
          } else {
            showToast('Sale recorded; mint pending. We\'ll retry.', 'warning');
          }
        } else {
          console.log('✅ Collectible minted, tx:', mintResult.txHash);
          showToast('✅ Download collectible minted!', 'success');
          
          // Update local state
          setHasPurchasedDownload(true);
          localStorage.setItem('zeyodaHasPurchasedDownload_' + artistIdFromUrl, 'true');
        }

        // Trigger balance update event for wallet refresh
        window.dispatchEvent(new CustomEvent('balanceUpdate'));
        
        showToast(`Purchase complete! Artist receives $${recordResult.netEarnings?.toFixed(2) || '0.00'}`, 'success');
        setShowPurchaseModal(false);

      } else {
        // Handle artistock token purchase (existing AMM flow)
        showToast("Token purchases coming soon!", "info");
        setShowPurchaseModal(false);
      }

    } catch (error: any) {
      console.error("Purchase failed:", error);
      showToast(error.message || "Purchase failed", "error");
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
      // Token to Token swap - DISABLED (requires multiple UUPS artists)
      else if (swapFromAsset !== "USD" && swapToAsset !== "USD" && artistConfig?.hasLiquidityPool && magic) {
        console.warn('⚠️ Token-to-token preview disabled - requires multiple artists');
            setSwapToAmount("");
            setArtistocksInput("0");
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





  // Check whitelist function
  async function checkWhitelist(emailToCheck: string, clue?: string) {
    try {
      // Skip auth for whitelist check (needed for login)
      const response = await authenticatedFetch('/api/checkWhitelist', {
        method: 'POST',
        body: JSON.stringify({ email: emailToCheck, clue })
      }, getDidToken, true); // skipAuth = true
      return await response.json();
    } catch (error) {
      console.error('Whitelist check failed:', error);
      return { isWhitelisted: false, error: 'Network error' };
    }
  }

  // Handle clue submission
  async function submitClue() {
    if (!clueMessage.trim()) {
      showToast('Please enter a clue message', 'error');
      return;
    }

    setIsCheckingWhitelist(true);
    const result = await checkWhitelist(email, clueMessage);
    
    setTreasureMessage('Thank you! Keep looking out for treasure... 🏴‍☠️');
    setShowClueInput(false);
    setClueMessage('');
    setIsCheckingWhitelist(false);
    
    // Clear treasure message after 3 seconds
    setTimeout(() => {
      setTreasureMessage('');
    }, 3000);
  }

  async function login() {
    if (!magic || !email) return;
    
    setIsCheckingWhitelist(true);
    
    try {
      console.log("🔍 Checking whitelist for:", email);
      
      // 1. Check whitelist first
      const whitelistResult = await checkWhitelist(email);
      
      if (!whitelistResult.isWhitelisted) {
        console.log("❌ Email not whitelisted, showing treasure hunt");
        setShowClueInput(true);
        setIsCheckingWhitelist(false);
        showToast('You appear to be rare treasure! We need to dig you up...', 'info');
        return;
      }
      
      console.log("✅ Email whitelisted, proceeding with Magic.link");
      
      // 2. Proceed with Magic.link if whitelisted
      console.log("🔐 Starting Magic.link login process...");
      
      const didToken = await magic.auth.loginWithEmailOTP({ email });
      const meta = await magic.user.getInfo();
      if (meta.publicAddress && meta.email) {
        localStorage.setItem('zeyodaUserEmail', meta.email);
        
        // Auto-fund new wallets
        try {
          console.log('🏴‍☠️ Checking if wallet needs treasure...');
          const fundingResponse = await authenticatedFetch('/api/fundWallet', {
            method: 'POST',
            body: JSON.stringify({ 
              userAddress: meta.publicAddress, 
              email: meta.email 
            })
          }, getDidToken);
          
          const fundingResult = await fundingResponse.json();
          
          if (fundingResult.success) {
            showToast(fundingResult.treasureMessage, 'success');
          } else if (fundingResult.treasureMessage) {
            showToast(fundingResult.treasureMessage, 'info');
          }
        } catch (fundingError) {
          console.warn('⚠️ Auto-funding failed:', fundingError);
          // Don't block login if funding fails
        }
        
        showToast('Logged in as ' + meta.publicAddress, 'success');
        
        // Trigger a simple refresh after a short delay to let Magic.link settle
        setTimeout(() => {
          window.location.reload();
        }, 2000); // Slightly longer delay for funding
      }
    } catch (error) {
      console.error("Login failed:", error);
      showToast('Login failed. Please try again.', 'error');
    } finally {
      setIsCheckingWhitelist(false);
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
      <div className="flex min-h-screen flex-col items-center justify-between pt-10 px-6 pb-6 relative bg-primary text-white font-sans">
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
            isAdmin={isAdmin}
          />
        )}

        <header className="app-header">
          {user && (
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
          )}
        </header>

        <main className="app-main">
          <div className="text-center">
              <>
                <h1 
                  className="text-4xl md:text-5xl font-bold tracking-wider mt-1 md:mt-2 mb-3 md:mb-3 cursor-pointer hover:opacity-80 transition-opacity" 
                  style={{ 
                    fontFamily: appMode === 'onboarding' ? 'Bungee, cursive' : artistConfig.theme.fontFamily, 
                    color: appMode === 'onboarding' ? '#B8860B' : artistConfig.theme.accentColor,
                    position: 'relative',
                    zIndex: 100,
                    pointerEvents: 'none',
                    maxWidth: '85%',
                    margin: '0 auto',
                    lineHeight: '1.1'
                  }}
                  onDoubleClick={() => {
                    if (appMode === 'onboarding') {
                      const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                      input?.focus();
                    }
                  }}
                  title={appMode === 'onboarding' ? 'Double-click to edit' : ''}
                >
                  {appMode === 'onboarding' ? onboardingArtistName : 
                   appMode === 'upload-asset' ? `ADD NEW ASSET TO ${artistConfig.displayName}` : 
                   artistConfig.displayName}
                </h1>
  
                <div className="relative w-full max-w-5xl mx-auto mt-6 md:mt-14 mb-12 md:mb-16">
                  {(appMode === 'onboarding' || appMode === 'upload-asset') ? (
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
                        ref={onboardingContainerRef}
                        className="relative"
                        style={{
                          height: 'clamp(280px, 50vh, 720px)',
                          width: 'auto',
                          maxWidth: 'min(92vw, 1000px)',
                          aspectRatio: onboardingAspectRatio || 16/9,
                          margin: '0 auto 16px auto',
                          overflow: 'visible',
                          cursor: uploadedFile ? 'default' : 'pointer'
                        }}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={!uploadedFile ? handleUploadClick : undefined}
                      >
                        {/* Halo for onboarding - behind content */}
                        {appMode === 'onboarding' && (
                          <OvalGlowBackdrop
                            containerRef={onboardingContainerRef}
                            primaryColor={currentPrimaryColor}
                            intensity={0.95}
                            zIndex={-1}
                          />
                        )}
                        {/* Content wrapper - in front of halo */}
                        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {uploadedFile ? (
                            // Show uploaded file exactly like carousel
                            <>
                              {filePreviewUrl && uploadedFile.type.startsWith('image/') ? (
                                <img 
                                  src={filePreviewUrl} 
                                  alt={uploadedFile.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 14, background: 'transparent' }}
                                  onLoad={(e) => {
                                    const img = e.currentTarget as HTMLImageElement;
                                    if (img.naturalWidth && img.naturalHeight) {
                                      setOnboardingAspectRatio(img.naturalWidth / img.naturalHeight);
                                    }
                                  }}
                                />
                              ) : filePreviewUrl && uploadedFile.type.startsWith('video/') ? (
                                <video 
                                  src={filePreviewUrl} 
                                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 14, background: 'transparent' }}
                                  controls
                                  muted
                                  preload="metadata"
                                  onLoadedMetadata={(e) => {
                                    const v = e.currentTarget as HTMLVideoElement;
                                    if (v.videoWidth && v.videoHeight) {
                                      setOnboardingAspectRatio(v.videoWidth / v.videoHeight);
                                    }
                                  }}
                                />
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                  <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
                                    {uploadedFile.type.startsWith('audio/') ? '🎵' : '📁'}
                                  </div>
                                  <div style={{ fontSize: '1rem', color: '#B8860B', fontFamily: 'Bungee, cursive' }}>
                                    {uploadedFile.name}
                                  </div>
                                </div>
                              )}
                              {/* X button to remove file - positioned like carousel controls */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (filePreviewUrl) {
                                    URL.revokeObjectURL(filePreviewUrl);
                                  }
                                  setFilePreviewUrl(null);
                                  setUploadedFile(null);
                                  setOnboardingAspectRatio(null);
                                }}
                                style={{
                                  position: 'absolute',
                                  right: 12,
                                  top: 12,
                                  background: 'rgba(0,0,0,0.4)',
                                  color: '#fff',
                                  border: '1px solid rgba(255,255,255,0.6)',
                                  borderRadius: 8,
                                  padding: '6px 8px',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  height: 28,
                                  lineHeight: 1,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 28,
                                  zIndex: 100
                                }}
                                aria-label="Remove file"
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            // Show upload prompt - centered over halo
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
                              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📁</div>
                              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#B8860B', fontFamily: 'Bungee, cursive' }}>
                                DROP YOUR CONTENT HERE
                              </div>
                              <div style={{ fontSize: '0.875rem', marginBottom: '1rem', opacity: 0.8, color: '#B8860B' }}>
                                Audio, video, images, text - any format
                              </div>
                              <button 
                                className="px-6 py-3 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors"
                                style={{ backgroundColor: '#B8860B' }}
                              >
                                Or Click to Upload
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    // Normal mode: OrbitPeekCarousel with orbital tokens layered on top
                    <>
                      {(artistAssets && artistAssets.length >= 1) ? (
                        <>
                          <OvalGlowBackdrop
                            containerRef={videoContainerRef}
                            primaryColor={currentPrimaryColor}
                            intensity={0.95}
                            zIndex={1}
                          />
                          <OrbitPeekCarousel
                            key={carouselKey}
                            items={artistAssets}
                            index={carouselIndex}
                            onIndexChange={(nextIndex) => {
                              setCarouselIndex(nextIndex);
                              // Clear deep-link parameter on manual navigation
                              if (assetNumberFromUrl) {
                                router.replace(`/?artist=${artistIdFromUrl}`, { scroll: false });
                              }
                            }}
                            containerRef={videoContainerRef}
                            peekPercent={10}
                            theme={{ fontFamily: artistConfig?.theme?.fontFamily, primaryColor: artistConfig?.theme?.primaryColor, accentColor: artistConfig?.theme?.accentColor }}
                            artistId={artistIdFromUrl}
                            treasuryWallet={artistConfig?.treasury_wallet}
                            currentUser={user}
                            onEditAsset={(asset) => {
                              setEditingAsset(asset);
                              setAppMode('edit-asset');
                            }}
                            disabled={appMode === 'edit-asset'}
                            onShakeRequest={() => {
                              const now = Date.now();
                              // Debounce: only shake if last shake was more than 1500ms ago (reduced frequency)
                              if (now - lastShakeRequestRef.current > 1500) {
                                lastShakeRequestRef.current = now;
                                setEditPanelShakeActive(true);
                                setTimeout(() => setEditPanelShakeActive(false), 500);
                              }
                            }}
                          />
                          <ThemeOrbitRenderer
                            artistConfig={artistConfig}
                            orbitTokens={orbitTokens}
                            videoContainerRef={videoContainerRef}
                            isOrbitAnimationPaused={isOrbitAnimationPaused}
                            allArtistsConfig={allArtistsConfig}
                          />
                        </>
                      ) : (
                        <>
                          <ArtistVideo
                            isMuted={isMuted}
                            isVideoError={isVideoError}
                            setIsVideoError={setIsVideoError}
                            toggleMute={toggleMute}
                            videoContainerRef={videoContainerRef}
                            videoSrc={videoSource}
                            fileType={featuredAsset?.file_type}
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

          {appMode === 'normal' && (
            <PurchaseFlow
              user={user}
              artistConfig={artistConfig}
              allArtistsConfig={allArtistsConfig}
              featuredAsset={featuredForPurchaseFlow}
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
          {(appMode === 'onboarding' || appMode === 'upload-asset') && (
            <OnboardingPanel
              artistName={onboardingArtistName}
              onArtistNameChange={setOnboardingArtistName}
              onSave={appMode === 'upload-asset' ? handleUploadAsset : handleSaveArtist}
              onExit={handleExitOnboarding}
              uploadedFile={uploadedFile}
              filePreviewUrl={filePreviewUrl}
              onUploadClick={handleUploadClick}
              mode={appMode} // Pass mode to panel
              existingArtist={artistConfig} // Pass artist config
            />
          )}

          {/* Asset Edit Panel - appears above input like onboarding */}
          {appMode === 'edit-asset' && editingAsset && (
            <AssetEditPanel
              asset={editingAsset}
              onSave={handleSaveAssetEdit}
              onCancel={() => {
                setAppMode('normal');
                setEditingAsset(null);
              }}
              shakeActive={editPanelShakeActive}
            />
          )}

          {/* Profile Edit Panel - appears above input like onboarding */}
          {appMode === 'profile-edit' && artistConfig && user && (
            <ProfileEditPanel
              artistConfig={artistConfig}
              userAddress={user}
              onClose={() => setAppMode('normal')}
              onSave={(updates) => {
                console.log('[page.tsx] ✅ Profile updates received:', {
                  logo_url: updates.logo_url,
                  logo_use_background: updates.logo_use_background,
                  background_image_url: updates.background_image_url,
                  background_use_image: updates.background_use_image,
                  hasThemeUpdates: !!(updates.primary_color || updates.accent_color || updates.font_family)
                });
                
                // Record save time to prevent state sync overwrite
                lastSaveTimeRef.current = Date.now();
                
                // Merge updates into artistConfig state IMMEDIATELY
                setArtistConfig(prev => {
                  if (!prev) return prev;
                  
                  const updated = {
                    ...prev,
                    theme: updates.primary_color || updates.accent_color || updates.font_family || updates.gradient_start || updates.gradient_end ? {
                      ...prev.theme,
                      primaryColor: updates.primary_color ?? prev.theme?.primaryColor,
                      accentColor: updates.accent_color ?? prev.theme?.accentColor,
                      gradientStart: updates.gradient_start ?? prev.theme?.gradientStart,
                      gradientEnd: updates.gradient_end ?? prev.theme?.gradientEnd,
                      fontFamily: updates.font_family ?? prev.theme?.fontFamily,
                    } : prev.theme,
                    logo_url: updates.logo_url !== undefined ? updates.logo_url : prev.logo_url,
                    background_image_url: updates.background_image_url !== undefined ? updates.background_image_url : prev.background_image_url,
                    logo_use_background: updates.logo_use_background !== undefined ? Boolean(updates.logo_use_background) : prev.logo_use_background,
                    background_use_image: updates.background_use_image !== undefined ? Boolean(updates.background_use_image) : prev.background_use_image,
                  };
                  
                  console.log('[page.tsx] ✅ Merged state update:', {
                    logo_url: updated.logo_url,
                    logo_use_background: updated.logo_use_background,
                    background_image_url: updated.background_image_url,
                    background_use_image: updated.background_use_image,
                    primaryColor: updated.theme?.primaryColor
                  });
                  
                  // Apply background immediately with updated config
                  applyArtistBackground(updated);
                  
                  return updated;
                });
                
                showToast('Profile saved successfully!', 'success');
                // Note: appMode change happens via ProfileEditPanel's onClose() call
                // The theme effect will run when appMode changes to 'normal'
              }}
            />
          )}


          <div 
            className={`unified-input-container mock-ui-section p-4 border-t-2 border-gray-700 mt-8 ${!user && shakeActive ? 'shake' : ''}`}
          >
            {user && (
              <h3 className="text-xl font-semibold mb-3 text-center">Chat / Command</h3>
            )}
            <div className="flex flex-col items-center max-w-xl mx-auto gap-3">
              {/* Treasure message */}
              {treasureMessage && (
                <div className="text-center text-gold-400 font-medium animate-pulse">
                  {treasureMessage}
                </div>
              )}
              
              {/* Main input */}
              <div className="flex items-center w-full chat-input-container relative">
                {/* Feedback panel - inline above input, same pattern as search dropdown */}
                {user && showFeedbackPanel && (
                  <div 
                    className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900 border border-gray-600 rounded-lg p-3 z-[10000]"
                    style={{ backdropFilter: 'blur(10px)' }}
                  >
                  {feedbackSuccess ? (
                    <div className="text-emerald-400 text-sm py-1">Got it — thanks</div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={feedbackMessage}
                        onChange={(e) => setFeedbackMessage(e.target.value)}
                        placeholder="Leave feedback..."
                        className="w-full p-2 rounded bg-gray-800 border border-gray-600 text-white text-sm mb-2 focus:ring-accentColor focus:border-accentColor"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (feedbackMessage.trim()) {
                              (async () => {
                                try {
                                  setIsSubmittingFeedback(true);
                                  const token = getDidToken ? await getDidToken() : null;
                                  const res = await fetch('/api/feedback', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                    },
                                    body: JSON.stringify({
                                      message: feedbackMessage.trim(),
                                      artist_id: artistIdFromUrl || null,
                                    }),
                                  });
                                  if (!res.ok) throw new Error((await res.json()).error || 'Failed');
                                  setFeedbackMessage('');
                                  setFeedbackSuccess(true);
                                  setTimeout(() => {
                                    setShowFeedbackPanel(false);
                                    setFeedbackSuccess(false);
                                  }, 2000);
                                } catch (err: any) {
                                  showToast(err.message || 'Failed to submit feedback', 'error');
                                } finally {
                                  setIsSubmittingFeedback(false);
                                }
                              })();
                            }
                          }
                          if (e.key === 'Escape') {
                            setShowFeedbackPanel(false);
                            setFeedbackMessage('');
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setShowFeedbackPanel(false);
                            setFeedbackMessage('');
                          }}
                          className="px-3 py-1 text-sm text-gray-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            if (!feedbackMessage.trim()) return;
                            try {
                              setIsSubmittingFeedback(true);
                              const token = getDidToken ? await getDidToken() : null;
                              const res = await fetch('/api/feedback', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                },
                                body: JSON.stringify({
                                  message: feedbackMessage.trim(),
                                  artist_id: artistIdFromUrl || null,
                                }),
                              });
                              if (!res.ok) throw new Error((await res.json()).error || 'Failed');
                              setFeedbackMessage('');
                              setFeedbackSuccess(true);
                              setTimeout(() => {
                                setShowFeedbackPanel(false);
                                setFeedbackSuccess(false);
                              }, 2000);
                            } catch (err: any) {
                              showToast(err.message || 'Failed to submit feedback', 'error');
                            } finally {
                              setIsSubmittingFeedback(false);
                            }
                          }}
                          disabled={!feedbackMessage.trim() || isSubmittingFeedback}
                          className="px-3 py-1 text-sm bg-accentColor text-white rounded hover:opacity-80 disabled:opacity-50"
                        >
                          {isSubmittingFeedback ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                )}

                {/* Action buttons - match top button styling */}
                {user && (
                  <div className="flex gap-2 mr-3">
                    <button
                      onClick={() => {
                        setShowFeedbackPanel(!showFeedbackPanel);
                        if (showFeedbackPanel) {
                          setFeedbackMessage('');
                          setFeedbackSuccess(false);
                        }
                      }}
                      className="bg-gray-600 hover:bg-gray-500 px-3 py-2 rounded text-white text-sm font-medium transition-colors w-10 h-8 flex items-center justify-center"
                      title="Leave feedback"
                    >
                      🎤→📢
                    </button>
                    {artistConfig && artistConfig.contract && (
                      <>
                        <button
                          onClick={() => {
                            if (appMode === 'upload-asset') {
                              setAppMode('normal');
                              setUploadedFile(null);
                              setUploadAssetData({ title: '', price: 5, description: '' });
                            } else {
                              // Find user's owned artist
                              const ownedArtist = allArtistsConfig ? Object.values(allArtistsConfig).find(artist => 
                                artist.treasury_wallet?.toLowerCase() === user?.toLowerCase()
                              ) : null;
                              
                              if (ownedArtist) {
                                // Navigate to their own artist page with upload mode
                                router.push(`/?artist=${ownedArtist.name?.toLowerCase()}&mode=upload`);
                              } else {
                                setAppMode('upload-asset');
                                setOnboardingArtistName('ADD NEW ASSET');
                              }
                            }
                          }}
                          className="bg-gray-600 hover:bg-gray-500 px-3 py-2 rounded text-white text-sm font-medium transition-colors w-10 h-8 flex items-center justify-center"
                          title="Create new 1155 asset"
                        >
                          {appMode === 'upload-asset' ? '✕' : '+'}
                        </button>
                        {artistConfig.treasury_wallet && 
                         user.toLowerCase() === artistConfig.treasury_wallet.toLowerCase() && (
                          <button
                            onClick={() => setAppMode('profile-edit')}
                            className="bg-yellow-600 hover:bg-yellow-500 px-3 py-2 rounded text-white text-sm font-medium transition-colors w-10 h-8 flex items-center justify-center"
                            title="Edit artist page"
                          >
                            ✏️
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
                
                {/* Search Dropdown */}
                {showSearchDropdown && (artistResults.length > 0 || assetResults.length > 0) && (
                  <div 
                    className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900 border border-gray-600 rounded-lg shadow-2xl max-h-96 overflow-y-auto z-[10000]"
                    style={{ backdropFilter: 'blur(10px)' }}
                  >
                    {/* My Downloads Section */}
                    {assetResults.length > 0 && (
                      <>
                        <div className="px-3 py-2 text-xs text-gray-400 font-bold uppercase border-b border-gray-700">
                          My Downloads
                        </div>
                        {assetResults.map((asset, idx) => {
                          const globalIdx = idx;
                          const isSelected = globalIdx === selectedSearchIndex;
                          
                          return (
                            <div
                              key={`asset-${asset.artistId}-${asset.assetNumber}`}
                              className={`p-3 cursor-pointer transition-all min-h-[44px] flex flex-col justify-center ${
                                isSelected ? 'opacity-100' : 'opacity-70 hover:opacity-90'
                              }`}
                              style={{
                                backgroundColor: isSelected 
                                  ? `${asset.theme.primaryColor}CC` 
                                  : `${asset.theme.primaryColor}80`,
                                borderLeft: isSelected 
                                  ? `4px solid ${asset.theme.accentColor}` 
                                  : '4px solid transparent'
                              }}
                              onClick={() => {
                                router.push(`/?artist=${asset.artistId}&asset=${asset.assetNumber}`);
                                setSearchQuery('');
                                setSafewordInput('');
                                setShowSearchDropdown(false);
                              }}
                              onMouseEnter={() => {
                                router.prefetch(`/?artist=${asset.artistId}&asset=${asset.assetNumber}`);
                              }}
                            >
                              <div 
                                className="font-bold text-base"
                                style={{ 
                                  color: asset.theme.accentColor,
                                  fontFamily: asset.theme.fontFamily || 'inherit'
                                }}
                              >
                                {asset.title}
                              </div>
                              <div className="text-xs text-gray-300">
                                by {asset.artistDisplayName} • #{asset.assetNumber} <span className="text-green-400">• Owned</span>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                    
                    {/* Artists Section */}
                    {artistResults.length > 0 && (
                      <>
                        <div className="px-3 py-2 text-xs text-gray-400 font-bold uppercase border-b border-gray-700">
                          Artists
                        </div>
                        {artistResults.map((artist, idx) => {
                          const globalIdx = assetResults.length + idx;
                          const isSelected = globalIdx === selectedSearchIndex;
                          
                          return (
                            <div
                              key={`artist-${artist.id}`}
                              className={`p-3 cursor-pointer transition-all min-h-[44px] flex flex-col justify-center ${
                                isSelected ? 'opacity-100' : 'opacity-70 hover:opacity-90'
                              }`}
                              style={{
                                backgroundColor: isSelected 
                                  ? `${artist.config.theme.primaryColor}CC` 
                                  : `${artist.config.theme.primaryColor}80`,
                                borderLeft: isSelected 
                                  ? `4px solid ${artist.config.theme.accentColor}` 
                                  : '4px solid transparent'
                              }}
                              onClick={() => {
                                router.push(`/?artist=${artist.id}`);
                                setSearchQuery('');
                                setSafewordInput('');
                                setShowSearchDropdown(false);
                              }}
                              onMouseEnter={() => {
                                router.prefetch(`/?artist=${artist.id}`);
                              }}
                            >
                              <div 
                                className="font-bold text-lg"
                                style={{ 
                                  color: artist.config.theme.accentColor,
                                  fontFamily: artist.config.theme.fontFamily || 'inherit'
                                }}
                              >
                                {artist.config.displayName || artist.config.name}
                              </div>
                              <div className="text-sm text-gray-300">
                                {artist.config.tokenName}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
                
                <input
                  type={user ? "text" : "email"}
                  value={showClueInput ? clueMessage : (user ? safewordInput : email)}
                  onChange={(e) => {
                    const value = e.target.value;
                    
                    if (showClueInput) {
                      setClueMessage(value);
                    } else if (user) {
                      // Update search query for dropdown
                      setSearchQuery(value);
                      // CRITICAL: Call the proper safeword handler to maintain functionality
                      handleSafewordInputChange(e);
                    } else {
                      setEmail(value);
                    }
                  }}
                  placeholder={
                    user 
                      ? (appMode === 'onboarding' 
                          ? (uploadedFile 
                              ? "Type your artist name or try: gold, emerald, sapphire..." 
                              : "Type your artist name, upload content, or try colors: gold, emerald...")
                          : "Search artists & downloads you own, or type command...")
                      : showClueInput 
                        ? "Who sent you? Enter a clue here..." 
                        : "Enter your email address to continue"
                  }
                className={`flex-grow p-3 border border-gray-600 ${user ? '' : 'rounded-l-lg'} bg-gray-900 bg-opacity-70 text-white focus:ring-accentColor focus:border-accentColor backdrop-blur-sm`}
                onKeyDown={(e) => {
                  const totalResults = artistResults.length + assetResults.length;
                  
                  // Navigation for dropdown
                  if (showSearchDropdown && totalResults > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedSearchIndex((prev) => (prev + 1) % totalResults);
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedSearchIndex((prev) => (prev - 1 + totalResults) % totalResults);
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setShowSearchDropdown(false);
                      return;
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const allResults = [...assetResults, ...artistResults];
                      const selected = allResults[selectedSearchIndex];
                      
                      if (selected) {
                        if (selected.kind === 'artist') {
                          router.push(`/?artist=${selected.id}`);
                        } else {
                          router.push(`/?artist=${selected.artistId}&asset=${selected.assetNumber}`);
                        }
                        setSearchQuery('');
                        setSafewordInput('');
                        setShowSearchDropdown(false);
                      }
                      return;
                    }
                  }
                  
                  // Original Enter logic (safeword/login)
                  if (e.key === 'Enter') {
                    if (!user) {
                      if (showClueInput) {
                        submitClue();
                      } else {
                        login();
                      }
                    } else {
                      // Clear search query before executing safeword
                      setSearchQuery('');
                      setShowSearchDropdown(false);
                      handleSafewordSubmit();
                    }
                  }
                }}
                aria-label={user ? "Chat or command input" : "Email address input"}
              />
              <button
                onClick={() => {
                  if (!user) {
                    if (showClueInput) {
                      submitClue();
                    } else {
                      login();
                    }
                  } else {
                    // Clear search query before executing safeword
                    setSearchQuery('');
                    setShowSearchDropdown(false);
                    handleSafewordSubmit();
                  }
                }}
                className="p-3 bg-accentColor text-white rounded-r-lg hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-accentColor focus:ring-opacity-50"
                disabled={isCheckingWhitelist}
              >
                {isCheckingWhitelist 
                  ? "🔍" 
                  : user 
                    ? "Send" 
                    : showClueInput 
                      ? "Submit Clue 🏴‍☠️" 
                      : "Continue"
                }
              </button>
              </div>
            </div>
          </div>
        </main>

        {/* Top-left wallet button - MOVED TO END TO ENSURE TOP Z-INDEX */}
        {user && (
          <div className="fixed top-4 left-4 z-[9999] flex gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAssetsPanel(!showAssetsPanel);
              }}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-white font-medium transition-colors shadow-lg cursor-pointer"
              type="button"
            >
              💰 {showAssetsPanel ? 'Close' : 'Wallet'}
            </button>

            {/* Action Buttons */}
            <button
              onClick={() => {
                // Find user's owned artist
                const ownedArtist = allArtistsConfig ? Object.values(allArtistsConfig).find(artist => 
                  artist.treasury_wallet?.toLowerCase() === user?.toLowerCase()
                ) : null;
                
                if (ownedArtist) {
                  // Navigate to their own artist page with upload mode
                  router.push(`/?artist=${ownedArtist.name?.toLowerCase()}&mode=upload`);
                } else {
                  setAppMode('upload-asset');
                  setOnboardingArtistName('ADD NEW ASSET');
                }
              }}
              className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-md text-white font-medium transition-colors shadow-lg"
            >
              + Create New
            </button>
            
            {artistConfig && artistConfig.treasury_wallet && 
             user.toLowerCase() === artistConfig.treasury_wallet.toLowerCase() && (
              <button
                onClick={() => setAppMode('profile-edit')}
                className="bg-yellow-600 hover:bg-yellow-500 px-4 py-2 rounded-md text-white font-medium transition-colors shadow-lg"
              >
                ✏️ Edit Artist Page
              </button>
            )}
          </div>
        )}

      </div>
    </UsdBalanceProvider>
  );
}


export default function HomePage() {
  const { magic, user, isReady, isLoading: authLoading, error: authError } = useWallet();
  const { artistConfig, allArtistsConfig, isLoading: configLoading, error: configError } = useArtistConfig();
  
  // Get artistId from URL once and pass it down
  const searchParams = useSearchParams();
  const artistIdFromUrl = searchParams.get('artist') ?? 'gosheesh';

  // **ALL DATA FETCHING MOVED HERE**
  const { featuredAsset, videoUrl, isLoading: assetLoading, error: assetError } = useFeaturedAsset(artistIdFromUrl);
  const { assets: artistAssets } = useArtistAssets(artistIdFromUrl);

  // Unified loading state
  const isLoading = authLoading || !isReady || configLoading || assetLoading;

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

  // Show a unified loading state until all core data is ready
  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading artist profile...</div>;
  }

  // Show artist config error
  if (configError || assetError) {
    return <div className="flex justify-center items-center h-screen">Error: {configError || assetError}</div>;
  }

  if (!artistConfig) {
    return <div className="flex justify-center items-center h-screen">Artist not found.</div>;
  }

  return (
    <ArtistPageContent
      artistConfig={artistConfig}
      allArtistsConfig={allArtistsConfig}
      artistAssets={artistAssets}
      featuredAsset={featuredAsset}
      videoUrl={videoUrl}
      user={user}
      magic={magic}
    />
  );
}
