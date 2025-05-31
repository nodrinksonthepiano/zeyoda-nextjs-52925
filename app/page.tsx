'use client';
import Image from "next/image";
import { useEffect, useState } from "react";

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

export default function HomePage() {
  console.log("HomePage component rendering"); // Debug log
  const [artistConfig, setArtistConfig] = useState<ArtistConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    async function fetchConfig() {
      console.log("fetchConfig called"); // Debug log
      try {
        // const artistIdFromEnv = process.env.NEXT_PUBLIC_ARTIST_ID;
        // if (!artistIdFromEnv) {
        //   console.warn("NEXT_PUBLIC_ARTIST_ID environment variable is not set. Falling back to 'yourartistid'.");
        // }
        // const artistIdToLoad = artistIdFromEnv || 'yourartistid'; // Fallback to a known working ID
        const artistIdToLoad = 'gosheesh'; // Directly loading gosheesh for now
        console.log(`Attempting to load config for: ${artistIdToLoad}`); // Debug log

        const response = await fetch('/artists/config.json');
        console.log("Fetch response status:", response.status); // Debug log
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} while fetching /artists/config.json`);
        }
        const data = await response.json();
        console.log("Fetched config data:", data); // Debug log

        if (data.artists && data.artists[artistIdToLoad]) {
          const config = data.artists[artistIdToLoad];
          console.log("Found artist config:", config); // Debug log
          // Initialize orbital tokens with default visibility and transformation properties
          const initializedTokens = config.orbitalTokens.map((token: any) => ({ 
            ...token, 
            x: 0, y: 0, z: 0, opacity: 0.85, scale: 1, blur: 5, isVisible: true 
          }));
          setArtistConfig({...config, orbitalTokens: initializedTokens });
          console.log(`Successfully loaded configuration for artist ID: ${artistIdToLoad}`);
        } else {
          console.error(`Artist configuration not found for ID: '${artistIdToLoad}' in data:`, data); // Debug log
          throw new Error(`Artist configuration not found for ID: '${artistIdToLoad}' in /artists/config.json`);
        }
      } catch (e) {
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError("An unknown error occurred");
        }
        console.error("Failed to load artist config:", e);
      }
    }

    fetchConfig();
  }, []);

  // Orbital animation effect
  useEffect(() => {
    if (!artistConfig || !artistConfig.orbitalTokens) return;

    const orbitRadius = 200; // px, adjust as needed
    const animationSpeed = 0.0005; // Radians per millisecond
    let animationFrameId: number;

    const animate = (timestamp: number) => {
      setArtistConfig(prevConfig => {
        if (!prevConfig || !prevConfig.orbitalTokens) return prevConfig;

        const updatedTokens = prevConfig.orbitalTokens.map((token, index) => {
          const initialAngleRad = (token.angle || 0) * (Math.PI / 180); // Convert initial angle to radians
          const currentAngleRad = initialAngleRad + animationSpeed * timestamp;
          
          const x = orbitRadius * Math.cos(currentAngleRad);
          const y = orbitRadius * Math.sin(currentAngleRad) * 0.5; // Elliptical orbit
          const z = orbitRadius * Math.sin(currentAngleRad) * Math.cos(currentAngleRad) * 0.3; // 3D effect

          const perspectiveFactor = 1 + z / (orbitRadius * 2); // Simple perspective
          const scale = Math.max(0.5, Math.min(1.5, perspectiveFactor));
          const opacity = Math.max(0.3, Math.min(1, ( (z + orbitRadius*0.3) / (orbitRadius*0.6) * 0.7 + 0.3))); // Vary opacity based on Z
          const blur = Math.max(0, Math.min(10, 5 - (z / (orbitRadius * 0.3)) * 5)); // Vary blur based on Z

          return {
            ...token,
            x,
            y,
            z,
            opacity,
            scale,
            blur,
            isVisible: true // Tokens are always visible in this animation logic
          };
        });
        return { ...prevConfig, orbitalTokens: updatedTokens };
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [artistConfig?.name]); // Re-run if artist changes, ensuring tokens are for the current artist

  // Apply theme variables to the root element for CSS to use
  useEffect(() => {
    if (artistConfig && artistConfig.theme) { // Ensure artistConfig and theme exist
      const { theme } = artistConfig;
      document.documentElement.style.setProperty('--primary-color', theme.primaryColor);
      document.documentElement.style.setProperty('--accent-color', theme.accentColor);
      document.documentElement.style.setProperty('--accent-color-rgb', theme.accentColor.match(/\d+/g)?.join(', ') || '64, 115, 255');
      document.documentElement.style.setProperty('--gradient-start', theme.gradientStart);
      document.documentElement.style.setProperty('--gradient-middle', theme.gradientMiddle);
      document.documentElement.style.setProperty('--gradient-end', theme.gradientEnd);
      // Fonts are handled by globals.css and layout.tsx
    }
  }, [artistConfig?.theme]); // Depend on artistConfig.theme

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
  
  // Placeholder for actual download logic
  const handleDownloadVideo = () => {
    if(artistConfig && artistConfig.videoSrc) {
        //This is a placeholder. Implement actual download logic or link generation.
        alert(`Download for ${artistConfig.videoSrc} would start here.`);
        // window.open(artistConfig.videoSrc, '_blank');
    }
  };


  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-red-900 text-white">
        <p className="text-xl">Error loading configuration:</p>
        <p className="text-md mt-2">{error}</p>
        <p className="text-xs mt-4">Please check the console for more details and ensure 'public/artists/config.json' is correctly set up.</p>
      </div>
    );
  }

  if (!artistConfig) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="loading-spinner"></div>
        <p className="ml-2">Loading ZEYODA experience...</p>
      </div>
    );
  }

  const { theme, displayName, artworkTitle, videoSrc, tokenPrice, artworkYear, orbitalTokens: currentOrbitalTokens, name: artistName, tokenName: artistTokenName } = artistConfig;

  return (
    <>
      <div id="particles" className="cosmic-particles"></div>

      <header className="app-header">
        <button id="logoutButton" className="logout-button">LOGGING OUT...</button>
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
          <button id="getDownloadButton" className="get-download-button" onClick={handleDownloadVideo}>
            <span className="lock-icon">☑</span>
            GET DOWNLOAD (${tokenPrice.toFixed(2)})
          </button>

          <div id="loginSection" className="login-section">
            <h3 id="accessHeadline" className="access-headline">
              Sign in to purchase {artistTokenName}
            </h3>
            <div className="email-login-container">
              <input 
                type="email" 
                id="emailInput" 
                placeholder="Enter your email address" 
                className="email-input" 
              />
              <button id="emailLoginBtn" className="login-btn email">
                Continue with Email
              </button>
            </div>
            <div className="social-login-container">
              <p className="login-separator">or continue with</p>
              <div className="social-buttons">
                <button className="login-btn twitter">X (Twitter)</button>
                <button className="login-btn gmail">Gmail</button>
                <button className="login-btn phone">Phone</button>
                <button className="login-btn facebook">Facebook</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
