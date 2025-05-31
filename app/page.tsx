"use client";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from 'next/navigation';

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
  orbitalTokens: Array<{ name: string; angle: number; x?: number; y?: number; z?: number; opacity?: number; scale?: number; blur?: number; isVisible?: boolean; element?: HTMLElement | null }>;
}

interface PriceDetails {
  currentDisplayPrice: number;
  artistShare: number;
  platformShare: number;
  investorShare: number;
}

export default function HomePage() {
  const searchParams = useSearchParams();
  const [artistConfig, setArtistConfig] = useState<ArtistConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [shakeActive, setShakeActive] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [priceDetails, setPriceDetails] = useState<PriceDetails | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [userTokenBalance, setUserTokenBalance] = useState<number>(0);

  useEffect(() => {
    const storedEmail = localStorage.getItem('zeyodaUserEmail');
    if (storedEmail) {
      setIsLoggedIn(true);
      const storedBalance = localStorage.getItem('zeyodaUserTokenBalance');
      if (storedBalance) {
        setUserTokenBalance(parseFloat(storedBalance));
      }
    }
  }, []);

  useEffect(() => {
    async function fetchConfig() {
      const artistIdFromUrl = searchParams.get('artist') || 'gosheesh';
      try {
        setArtistConfig(null);
        setError(null);

        const response = await fetch('/artists/config.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} while fetching /artists/config.json`);
        }
        const data = await response.json();

        if (data.artists && data.artists[artistIdFromUrl]) {
          const config = data.artists[artistIdFromUrl];
          const initializedTokens = config.orbitalTokens.map((token: any) => ({ 
            ...token, 
            x: 0, y: 0, z: 0, opacity: 0.85, scale: 1, blur: 5, isVisible: true 
          }));
          setArtistConfig({...config, orbitalTokens: initializedTokens });
        } else {
          console.error(`Artist configuration not found for ID: '${artistIdFromUrl}' in data:`, data);
          throw new Error(`Artist configuration not found for ID: '${artistIdFromUrl}'. Valid IDs might be: ${Object.keys(data.artists || {}).join(', ')}`);
        }
      } catch (e) {
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError("An unknown error occurred while fetching artist config.");
        }
        console.error(`Failed to load artist config for ${artistIdFromUrl}:`, e);
      }
    }

    fetchConfig();
  }, [searchParams]);

  useEffect(() => {
    if (!artistConfig || !artistConfig.orbitalTokens) return;
    const orbitRadius = 200;
    const animationSpeed = 0.0005;
    let animationFrameId: number;
    const animate = (timestamp: number) => {
      setArtistConfig(prevConfig => {
        if (!prevConfig || !prevConfig.orbitalTokens) return prevConfig;
        const updatedTokens = prevConfig.orbitalTokens.map((token, index) => {
          const initialAngleRad = (token.angle || 0) * (Math.PI / 180);
          const currentAngleRad = initialAngleRad + animationSpeed * timestamp;
          const x = orbitRadius * Math.cos(currentAngleRad);
          const y = orbitRadius * Math.sin(currentAngleRad) * 0.5;
          const z = orbitRadius * Math.sin(currentAngleRad) * Math.cos(currentAngleRad) * 0.3;
          const perspectiveFactor = 1 + z / (orbitRadius * 2);
          const scale = Math.max(0.5, Math.min(1.5, perspectiveFactor));
          const opacity = Math.max(0.3, Math.min(1, ( (z + orbitRadius*0.3) / (orbitRadius*0.6) * 0.7 + 0.3)));
          const blur = Math.max(0, Math.min(10, 5 - (z / (orbitRadius * 0.3)) * 5));
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
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [artistConfig?.name]);

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
    const artistShare = currentDisplayPrice * 0.80;
    const platformShare = currentDisplayPrice * 0.15;
    const investorShare = currentDisplayPrice * 0.05;
    return { currentDisplayPrice, artistShare, platformShare, investorShare };
  };
  const handleDownloadVideo = () => {
    if (!isLoggedIn) {
      setShakeActive(true);
      setTimeout(() => setShakeActive(false), 500);
      const loginSectionEl = document.getElementById('loginSection');
      loginSectionEl?.scrollIntoView({ behavior: 'smooth' });
      emailInputRef.current?.focus();
      return;
    }
    if (artistConfig) {
      const details = calculatePriceDetails(artistConfig.tokenPrice);
      setPriceDetails(details);
      setShowPurchaseModal(true);
    }
  };

  const handleConfirmPurchase = () => {
    setShowPurchaseModal(false);
    const newBalance = userTokenBalance + 1;
    setUserTokenBalance(newBalance);
    localStorage.setItem('zeyodaUserTokenBalance', newBalance.toString());
    alert(`Purchase confirmed for 1 ${artistConfig?.tokenName || 'token'}! Your new balance: ${newBalance}. Video: ${artistConfig?.videoSrc}`);
  };

  const handleEmailLogin = () => {
    const email = emailInputRef.current?.value;
    if (email && email.trim() !== "") {
      localStorage.setItem('zeyodaUserEmail', email);
      setIsLoggedIn(true);
      const storedBalance = localStorage.getItem('zeyodaUserTokenBalance'); 
      setUserTokenBalance(storedBalance ? parseFloat(storedBalance) : 0);
      setShowPurchaseModal(false);
    } else {
      alert("Please enter your email address.");
      emailInputRef.current?.focus();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('zeyodaUserEmail');
    setIsLoggedIn(false);
    setUserTokenBalance(0); 
    setShowPurchaseModal(false);
    setPriceDetails(null);
    alert("You have been logged out. Your token balance for this session has been reset.");
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
        <p className="ml-2">Loading ZEYODA experience for artist...</p>
      </div>
    );
  }

  const { displayName, artworkTitle, videoSrc, tokenPrice, artworkYear, orbitalTokens: currentOrbitalTokens, name: artistName, tokenName: artistTokenName } = artistConfig;

  return (
    <>
      <div id="particles" className="cosmic-particles"></div>

      <header className="app-header">
        {isLoggedIn ? (
          <div className="header-user-info">
            <span className="token-balance">Your {artistTokenName}s: {userTokenBalance}</span>
            <button onClick={handleLogout} className="logout-button">
              LOG OUT / RESET
            </button>
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
          {videoSrc ? (
            <video id="artistVideo" autoPlay loop muted={isMuted} playsInline key={videoSrc}>
              <source src={videoSrc} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="video-fallback" style={{display: 'flex'}}>
                <div className="fallback-icon">📺</div>
                <h3>{displayName}'s content preview</h3>
                <p className="fallback-note">Video content temporarily unavailable</p>
            </div>
          )}
          
          <div className="orbit-glow"></div>
          
          {currentOrbitalTokens && currentOrbitalTokens.length > 0 && (
            <div id="orbitalTokens" className="orbital-tokens">
              {currentOrbitalTokens.map((token, index) => (
                <div 
                  key={`${artistName}-token-${index}`}
                  className="orbit-token" 
                  style={{
                    transform: `translate3d(${token.x || 0}px, ${token.y || 0}px, ${token.z || 0}px) scale(${token.scale || 1})`,
                    opacity: token.opacity,
                    filter: `blur(${token.blur || 0}px)`,
                    zIndex: 5 + Math.floor(token.z || 0), 
                  }}
                >
                  {token.name}
                </div>
              ))}
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

        <div className="action-section">
          <button 
            id="getDownloadButton" 
            className="get-download-button" 
            onClick={handleDownloadVideo}
            disabled={showPurchaseModal || (isLoggedIn && userTokenBalance > 0)} 
          >
            <span className="lock-icon">
              {isLoggedIn ? (userTokenBalance > 0 ? '✅' : '🔓') : '🔒'}
            </span>
            {isLoggedIn && userTokenBalance > 0 ? 
              `OWNED (${artistTokenName})` : 
              `GET DOWNLOAD ($${tokenPrice.toFixed(2)})`
            }
          </button>

          {!isLoggedIn && (
            <div 
              id="loginSection" 
              className={`login-section ${shakeActive ? 'shake' : ''}`}
            >
              <h3 id="accessHeadline" className="access-headline">
                Sign in to purchase {artistTokenName}
              </h3>
              <div className="email-login-container">
                <input 
                  type="email" 
                  id="emailInput" 
                  ref={emailInputRef}
                  placeholder="Enter your email address" 
                  className="email-input" 
                  onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()}
                />
                <button id="emailLoginBtn" className="login-btn email" onClick={handleEmailLogin}>
                  Continue with Email
                </button>
              </div>
              <div className="social-login-container">
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
              <div className="purchase-modal">
                <h2>Confirm Purchase: {artistConfig.tokenName}</h2>
                <p>You are about to acquire 1 <strong>{artistConfig.tokenName}</strong> for the digital asset: <strong>{artistConfig.artworkTitle}</strong>.</p>
                <div className="price-breakdown">
                  <p>Total Price: <strong>${priceDetails.currentDisplayPrice.toFixed(4)}</strong></p>
                  <hr />
                  <p>Artist ({artistConfig.displayName}) Receives: ${priceDetails.artistShare.toFixed(4)} (80%)</p>
                  <p>Platform (ZEYODA) Fee: ${priceDetails.platformShare.toFixed(4)} (15%)</p>
                  <p>Ecosystem Investors: ${priceDetails.investorShare.toFixed(4)} (5%)</p>
                </div>
                <div className="purchase-actions">
                  <button onClick={handleConfirmPurchase} className="confirm-purchase-btn">Confirm & Get 1 {artistConfig.tokenName}</button>
                  <button onClick={() => setShowPurchaseModal(false)} className="cancel-purchase-btn">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {isLoggedIn && userTokenBalance > 0 && artistConfig && (
            <div className="swap-section mock-ui-section">
              <h3>Swap Your {artistConfig.tokenName}s</h3>
              <div className="swap-form">
                <div className="form-group">
                  <label htmlFor="swapAmount">Amount to Swap:</label>
                  <input type="number" id="swapAmount" defaultValue="1" min="1" max={userTokenBalance} className="swap-input" />
                </div>
                <div className="form-group">
                  <label htmlFor="swapFrom">From:</label>
                  <select id="swapFrom" className="swap-select" disabled>
                    <option value={artistConfig.tokenName}>{artistConfig.tokenName} (Balance: {userTokenBalance})</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="swapTo">To:</label>
                  <select id="swapTo" className="swap-select">
                    <option value="ETH">MockETH</option>
                    <option value="USDC">MockUSDC</option>
                    {artistConfig.orbitalTokens && artistConfig.orbitalTokens.slice(0,2).map(ot => <option key={ot.name} value={ot.name}>{ot.name} Token</option>)} 
                  </select>
                </div>
                <button className="swap-execute-btn" onClick={() => alert('Mock swap executed! Real integration coming soon.')}>Execute Mock Swap</button>
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
