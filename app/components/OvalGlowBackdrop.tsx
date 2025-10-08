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
  const roRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      const vw = Math.max(320, Math.round(window.innerWidth || 0));
      // Safe margins so the oval never touches the phone edges; simple, one-size fit
      const sideMargin = Math.round(vw * 0.05); // 5% viewport margin each side
      const maxSafeW = Math.max(240, vw - 2 * sideMargin);
      // Base oval width is hero*1.35, but clamped to safe viewport width
      const baseW = Math.round(r.width * 1.35);
      const w = Math.min(baseW, maxSafeW);
      // Aspect ratio for a pleasing oval; about 0.60 of width for height
      const h = Math.round(w * 0.60);
      setBox({ w, h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    roRef.current = ro;
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const onVV = () => update();
    if (vv) { try { vv.addEventListener('resize', onVV); vv.addEventListener('scroll', onVV); } catch {} }
    window.addEventListener('orientationchange', update);
    window.addEventListener('resize', update);
    return () => {
      try { ro.disconnect(); } catch {}
      if (vv) { try { vv.removeEventListener('resize', onVV); vv.removeEventListener('scroll', onVV); } catch {} }
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('resize', update);
    };
  }, [containerRef]);

  // Subscribe to hero:pinned as the single source of truth for sizing
  useEffect(() => {
    const apply = (w: number, h: number) => {
      const vw = Math.max(320, Math.round(window.innerWidth || 0));
      const sideMargin = Math.round(vw * 0.05);
      const maxSafeW = Math.max(240, vw - 2 * sideMargin);
      const baseW = Math.round(w * 1.35);
      const finalW = Math.min(baseW, maxSafeW);
      const finalH = Math.round(finalW * 0.60);
      setBox(prev => {
        const dw = Math.abs((prev.w || 0) - finalW) / Math.max(1, finalW);
        const dh = Math.abs((prev.h || 0) - finalH) / Math.max(1, finalH);
        if (dw < 0.02 && dh < 0.02) return prev;
        return { w: finalW, h: finalH };
      });
    };
    const onPinned = (e: any) => {
      const d = e?.detail;
      if (!d || !d.w || !d.h) return;
      apply(d.w, d.h);
    };
    window.addEventListener('hero:pinned', onPinned);
    // If previous pinned payload exists, apply immediately
    const cached = (window as any).__heroPinnedCache;
    if (cached?.w && cached?.h) {
      apply(cached.w, cached.h);
    }
    return () => { window.removeEventListener('hero:pinned', onPinned); };
  }, [containerRef]);

  // Fallback: ensure we compute shortly after mount if hero:pinned hasn't fired yet
  useEffect(() => {
    let fired = false;
    const onPinned = () => { fired = true; };
    window.addEventListener('hero:pinned', onPinned, { once: true } as any);
    const timer = window.setTimeout(() => {
      if (fired) return;
      const el = containerRef?.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = Math.max(320, Math.round(window.innerWidth || 0));
      const sideMargin = Math.round(vw * 0.05);
      const maxSafeW = Math.max(240, vw - 2 * sideMargin);
      const baseW = Math.round(r.width * 1.35);
      const w = Math.min(baseW, maxSafeW);
      const h = Math.round(w * 0.60);
      setBox({ w, h });
    }, 120) as unknown as number;
    return () => { window.removeEventListener('hero:pinned', onPinned); window.clearTimeout(timer); };
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


