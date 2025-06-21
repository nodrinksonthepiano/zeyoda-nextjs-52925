"use client";
import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArtistConfig, RenderableToken } from '../../types/artist-types'; 

interface ThemeOrbitRendererProps {
  artistConfig: ArtistConfig | null;
  dynamicOrbitalTokens: RenderableToken[];
  videoContainerRef: React.RefObject<HTMLDivElement | null>;
  isOrbitAnimationPaused: React.MutableRefObject<boolean>;
  allArtistsConfig: { [key: string]: ArtistConfig } | null;
}

const ORBIT_SPEED = 0.3;

const ThemeOrbitRenderer: React.FC<ThemeOrbitRendererProps> = ({
  artistConfig,
  dynamicOrbitalTokens,
  videoContainerRef,
  isOrbitAnimationPaused,
  allArtistsConfig,
}) => {
  const router = useRouter();
  const tokenElementRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const [orbitAngleOffset, setOrbitAngleOffset] = React.useState(0);

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
      localStorage.setItem('zeyodaOrbitAngleOffset', orbitAngleOffset.toString());
    };
  }, [artistConfig, dynamicOrbitalTokens, orbitAngleOffset, isOrbitAnimationPaused, videoContainerRef]);

  if (!artistConfig) return null;

  return (
    <div 
        className="absolute top-1/2 left-1/2 w-full h-full" 
        style={{ transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}
        onMouseEnter={() => isOrbitAnimationPaused.current = true}
        onMouseLeave={() => isOrbitAnimationPaused.current = false}
    >
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
  );
};

export default ThemeOrbitRenderer; 