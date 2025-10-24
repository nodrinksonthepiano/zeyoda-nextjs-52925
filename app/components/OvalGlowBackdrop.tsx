'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  primaryColor?: string; // plate color (page background)
  accentColor?: string;  // unused for plate; kept for compatibility
  intensity?: number; // 0..1 controls halo strength
  zIndex?: number;
};

function toRGBA(hexOrRgb: string, alpha: number) {
  // Accept #rrggbb or rgb(a)
  if (!hexOrRgb) return `rgba(64,115,255,${alpha})`;
  const h = hexOrRgb.trim();
  if (h.startsWith('#')) {
    const n = h.length === 4
      ? h.slice(1).split('').map(c => c + c).join('')
      : h.slice(1);
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (h.startsWith('rgb')) {
    return h.replace(/rgba?\(([^)]+)\)/, (_m, inner) => {
      const parts = inner.split(',').map(p => p.trim());
      const [r, g, b] = parts;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    });
  }
  return `rgba(64,115,255,${alpha})`;
}

const OvalGlowBackdrop: React.FC<Props> = ({ containerRef, primaryColor = '#0a1a3b', accentColor = '#4073ff', intensity = 0.9, zIndex = 2 }) => {
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const lastCarouselDimensionsRef = useRef<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;

    let timeoutId: number | null = null;
    const debounce = (func: () => void, delay: number) => {
      return () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        timeoutId = window.setTimeout(() => {
          func();
        }, delay);
      };
    };

    const calculateAndSetSize = (carouselW?: number, carouselH?: number) => {
      // If carousel dimensions provided (from hero:pinned), use them directly
      let sourceWidth: number;
      let sourceHeight: number;

      if (carouselW && carouselH) {
        sourceWidth = carouselW;
        sourceHeight = carouselH;
        lastCarouselDimensionsRef.current = { w: carouselW, h: carouselH };
      } else {
        // Fallback: measure the container element
        const r = el.getBoundingClientRect();
        if (r.width < 50) return; // Ignore insignificant sizes during transitions
        sourceWidth = r.width;
        sourceHeight = r.height;
      }

      const vw = Math.max(320, window.innerWidth || 0);
      const sideMargin = Math.round(vw * 0.05);
      const maxSafeW = Math.max(240, vw - 2 * sideMargin);

      // The halo should be a tight, consistent border around the content. 1.25x is the sweet spot.
      const idealWidth = Math.round(sourceWidth * 1.25);
      const finalWidth = Math.min(idealWidth, maxSafeW);
      const finalHeight = Math.round(finalWidth * 0.60);

      setBox(prevBox => {
        if (Math.abs(prevBox.w - finalWidth) < 2 && Math.abs(prevBox.h - finalHeight) < 2) {
          return prevBox;
        }
        return { w: finalWidth, h: finalHeight };
      });
    };

    // Primary listener: hero:pinned event from carousel (stable, authoritative dimensions)
    const onHeroPinned = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { w, h } = customEvent.detail || {};
      if (w && h) {
        // Use carousel's stable dimensions directly - no debounce needed
        calculateAndSetSize(w, h);
      }
    };

    // Secondary listener: window resize (for viewport changes, not carousel animations)
    const debouncedCalculateSize = debounce(() => {
      // On window resize, recalculate using last known carousel dimensions if available
      if (lastCarouselDimensionsRef.current) {
        calculateAndSetSize(lastCarouselDimensionsRef.current.w, lastCarouselDimensionsRef.current.h);
      } else {
        calculateAndSetSize();
      }
    }, 100);

    // Fallback observer: only for cases where hero:pinned isn't available
    const observer = new ResizeObserver((entries) => {
      // Only respond to ResizeObserver if we haven't received hero:pinned yet
      if (!lastCarouselDimensionsRef.current) {
        debouncedCalculateSize();
      }
    });
    observer.observe(el);

    // Listen to hero:pinned as primary source of truth
    window.addEventListener('hero:pinned', onHeroPinned);
    
    // Also listen to window resize for responsiveness
    window.addEventListener('resize', debouncedCalculateSize);

    // Run an initial calculation after a short delay to catch the first render.
    const initialTimeout = window.setTimeout(() => calculateAndSetSize(), 150);

    return () => {
      observer.disconnect();
      window.removeEventListener('hero:pinned', onHeroPinned);
      window.removeEventListener('resize', debouncedCalculateSize);
      if (timeoutId) window.clearTimeout(timeoutId);
      window.clearTimeout(initialTimeout);
    };
  }, [containerRef]);

  const { wrapperStyle, plateStyle, ringStyle } = useMemo(() => {
    const w = box.w || 0; const h = box.h || 0;
    const halo1 = toRGBA('#ffffff', Math.min(0.25 * intensity, 0.55));
    const halo2 = toRGBA('#ffffff', Math.min(0.16 * intensity, 0.40));
    const rim   = toRGBA('#ffffff', Math.min(0.12 * intensity, 0.25));
    return {
      wrapperStyle: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: w ? `${w}px` : '0px',
        height: h ? `${h}px` : '0px',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex,
        overflow: 'visible',
        transition: 'width 0.3s ease, height 0.3s ease', // Smooth transition on resize
      } as React.CSSProperties,
      // Plate with white halo, no blend with hero
      plateStyle: {
        position: 'absolute', inset: 0,
        borderRadius: '50% / 50%',
        background: primaryColor,
        boxShadow: `0 0 110px 28px ${halo1}, 0 0 52px 18px ${halo2}, 0 0 2px 1px ${rim} inset`,
        filter: 'none',
        willChange: 'transform',
      } as React.CSSProperties,
      // Thin outer ring-only highlight to mimic eclipse rim
      ringStyle: {
        position: 'absolute', inset: 0,
        borderRadius: '50% / 50%',
        background: `radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0) 66%, rgba(255,255,255,${Math.min(0.20 * intensity, 0.32)}) 82%, rgba(255,255,255,0) 98%)`,
        filter: 'blur(6px)',
        opacity: 1,
        willChange: 'transform',
      } as React.CSSProperties,
    };
  }, [box, primaryColor, intensity, zIndex]);

  if (!box.w || !box.h) return null;
  return (
    <div aria-hidden style={wrapperStyle}>
      <div style={plateStyle} />
      <div style={ringStyle} />
    </div>
  );
};

export default OvalGlowBackdrop;


