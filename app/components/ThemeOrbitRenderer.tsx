"use client";
import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArtistConfig, RenderableToken } from '../../types/artist-types';
import { OrbitToken } from '../hooks/useOrbitTokens'; 

interface ThemeOrbitRendererProps {
  artistConfig: ArtistConfig | null;
  orbitTokens: OrbitToken[];
  videoContainerRef: React.RefObject<HTMLDivElement | null>;
  isOrbitAnimationPaused: React.MutableRefObject<boolean>;
  allArtistsConfig: { [key: string]: ArtistConfig } | null;
}

const ORBIT_SPEED = 0.3;

const ThemeOrbitRenderer: React.FC<ThemeOrbitRendererProps> = ({
  artistConfig,
  orbitTokens,
  videoContainerRef,
  isOrbitAnimationPaused,
  allArtistsConfig,
}) => {
  const tokenElementRefs = useRef<(HTMLElement | null)[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const [orbitAngleOffset, setOrbitAngleOffset] = React.useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedOffset = parseFloat(localStorage.getItem('zeyodaOrbitAngleOffset') || '0');
      if (storedOffset) {
        setOrbitAngleOffset(storedOffset);
      }
    }
  }, []);

  // Resize throttling effect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      isOrbitAnimationPaused.current = true;
      setTimeout(() => {
        isOrbitAnimationPaused.current = false;
      }, 300);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOrbitAnimationPaused]);
  
  useEffect(() => {
    const videoElement = videoContainerRef.current;
    if (!artistConfig || !videoElement) {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
        return;
    }

    const combinedTokens = [...(artistConfig?.orbitalTokens || []), ...orbitTokens.map(token => ({
      name: token.displayName,
      angle: 0, // Will be recalculated below
      artistId: token.artistId
    }))].filter((token, index, self) => 
        token.name && self.findIndex(t => t.name === token.name) === index
    );

    // Distribute angles evenly across all tokens with offset
    const allTokens = combinedTokens.map((token, index) => ({
      ...token,
      angle: ((index + 0.5) * 360) / (combinedTokens.length || 1) // Even distribution with offset
    }));

    let lastTimestamp = 0;
    const animate = (timestamp: number) => {
      // SSR guard and visibility throttling
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden') {
        animationFrameIdRef.current = requestAnimationFrame(animate);
        return;
      }

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
        
        const orbitPos = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px)`;
        tokenElement.style.setProperty('--orbit-pos', orbitPos);
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
      if (typeof window !== 'undefined') {
        localStorage.setItem('zeyodaOrbitAngleOffset', orbitAngleOffset.toString());
      }
    };
  }, [artistConfig, orbitTokens, orbitAngleOffset, isOrbitAnimationPaused, videoContainerRef]);

  if (!artistConfig) return null;

  return (
    <div className="orbit-theme">
      <div 
        className="orbital-tokens"
        onMouseEnter={() => isOrbitAnimationPaused.current = true}
        onMouseLeave={() => isOrbitAnimationPaused.current = false}
      >
        {(([...(artistConfig?.orbitalTokens || []), ...orbitTokens.map(token => ({
          name: token.displayName,
          angle: 0,
          artistId: token.artistId
        }))] as RenderableToken[])
          .filter((token, index, self) => token.name && self.findIndex(t => t.name === token.name) === index)
          .map((token: RenderableToken, index: number) => {
            return (
              <Link 
                key={`orbit-${token.name}-${token.artistId || 'standalone'}-${index}`}
                href={`/?artist=${token.artistId?.toLowerCase()}`}
                className="orbit-token"
                data-artist-id={token.artistId?.toLowerCase()}
                ref={(el: HTMLElement | null) => {
                  tokenElementRefs.current[index] = el;
                }}
                style={{
                  willChange: 'transform, opacity',
                  opacity: 0,
                }}
                onMouseEnter={(e) => e.currentTarget.setAttribute('data-hovered', 'true')}
                onMouseLeave={(e) => e.currentTarget.setAttribute('data-hovered', 'false')}
                title={token.artistId ? `Explore ${allArtistsConfig?.[token.artistId]?.displayName || token.name}` : token.name}
              >
                {token.name}
              </Link>
            );
          }))
        }
      </div>
    </div>
  );
};

export default ThemeOrbitRenderer; 