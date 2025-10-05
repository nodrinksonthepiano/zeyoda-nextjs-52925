'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ArtistAsset } from '../hooks/useArtistAssets';

type Props = {
  items: ArtistAsset[];
  index: number;
  onIndexChange: (next: number) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  peekPercent?: number; // 10 by default
};

const THRESHOLD_PX = 80;           // drag distance to reach full progress
const MAX_PROGRESS = 1.15;         // clamp while dragging
const SNAP_THRESHOLD = 0.45;       // travel before flip
const SNAP_MS = 260;               // easing time for snap
const DEPTH_Z = 160;               // px of Z parallax
const TILT_DEG = 6;                // tilt for depth cue (subtle to avoid warp)

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

export const OrbitPeekCarousel: React.FC<Props> = ({ items, index, onIndexChange, containerRef, peekPercent = 10 }) => {
  // Attach the provided containerRef so ThemeOrbitRenderer can measure the same element
  const internalRootRef = useRef<HTMLDivElement | null>(null);
  const rootRef = (containerRef as any) || internalRootRef;
  const layerPrevRef = useRef<HTMLDivElement | null>(null);
  const layerCurrRef = useRef<HTMLDivElement | null>(null);
  const layerNextRef = useRef<HTMLDivElement | null>(null);

  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);

  const progressRef = useRef(0);   // -1 .. 1 (drag progress)
  const lastTsRef = useRef(0);
  const lastPRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const snappingRef = useRef(false);
  const startYRef = useRef(0);
  const loopRef = useRef<number | null>(null);
  const dirtyRef = useRef(true);
  const snapRef = useRef<{active:boolean;start:number;from:number;to:number;dur:number}>({active:false,start:0,from:0,to:0,dur:SNAP_MS});

  // Gesture state & timers (to prevent re-entrancy and wheel double-snap)
  const stateRef = useRef<'idle' | 'dragging' | 'snapping'>('idle');
  const gestureIdRef = useRef(0);
  const wheelIdleTimerRef = useRef<number | null>(null);

  const count = items.length || 0;
  const prevIndex = (index - 1 + count) % count;
  const nextIndex = (index + 1) % count;
  const prevItem = items[prevIndex] || items[index];
  const currItem = items[index];
  const nextItem = items[nextIndex] || items[index];

  const startLoop = useCallback(() => {
    if (loopRef.current !== null) return;
    const ease = (t: number) => (t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t);
    const tick = (now: number) => {
      loopRef.current = requestAnimationFrame(tick);
      if (snapRef.current.active) {
        const { start, from, to, dur } = snapRef.current;
        const t = clamp((now - start)/dur, 0, 1);
        progressRef.current = from + (to - from) * ease(t);
        if (t >= 1) snapRef.current.active = false;
        dirtyRef.current = true;
      }
      if (dirtyRef.current) { dirtyRef.current = false; writeFrame(); return; }
      if (!draggingRef.current && !snapRef.current.active) {
        cancelAnimationFrame(loopRef.current!); loopRef.current = null;
      }
    };
    loopRef.current = requestAnimationFrame(tick);
  }, []);

  const writeFrame = useCallback(() => {
    const p = progressRef.current; // -1 .. 1
    const prevEl = layerPrevRef.current;
    const currEl = layerCurrRef.current;
    const nextEl = layerNextRef.current;

    // Tunables
    const peek = 0.30; // 30% of card height visible above/below at rest
    const scaleFar = 0.62; // smaller peeks for more distance
    const scaleNear = 0.96;

    // Pixel rounding for stability
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const roundPx = (v: number) => Math.round(v * dpr) / dpr;

    const apply = (el: HTMLDivElement | null, tyPct: number, z: number, scale: number, opacity: number, tiltDeg: number) => {
      if (!el) return;
      el.style.willChange = 'transform, opacity';
      el.style.transform = `translate3d(0, ${Math.round(tyPct*1000)/10}%, ${roundPx(z)}px) rotateX(${tiltDeg}deg) scale(${scale})`;
      el.style.opacity = String(opacity);
    };

    if (p >= 0) {
      // Dragging down toward previous
      const t = clamp(p, 0, 1);
      // current moves down/back (tilt scales with t so hero is perfectly flat at rest)
      apply(currEl, +peek*t, -DEPTH_Z*t, 1 - (1-0.88)*t, 1 - 0.05*t, TILT_DEG * 0.6 * t);
      // prev comes up/forward
      apply(prevEl, -peek*(1-t), -DEPTH_Z*(1-t), scaleFar + (scaleNear-scaleFar)*t, 0.45 + (0.95-0.45)*t, -TILT_DEG);
      // next stays far
      apply(nextEl, +peek, -DEPTH_Z, scaleFar, 0.45, +TILT_DEG);
      // z-order switch for stability near end
      if (t >= 0.7) {
        if (prevEl) prevEl.style.zIndex = '25';
        if (currEl) currEl.style.zIndex = '15';
      } else {
        if (prevEl) prevEl.style.zIndex = '5';
        if (currEl) currEl.style.zIndex = '20';
      }
    } else {
      // Dragging up toward next
      const t = clamp(-p, 0, 1);
      apply(currEl, -peek*t, -DEPTH_Z*t, 1 - (1-0.88)*t, 1 - 0.05*t, -TILT_DEG * 0.6 * t);
      apply(nextEl, +peek*(1-t), -DEPTH_Z*(1-t), scaleFar + (scaleNear-scaleFar)*t, 0.45 + (0.95-0.45)*t, +TILT_DEG);
      apply(prevEl, -peek, -DEPTH_Z, scaleFar, 0.45, -TILT_DEG);
      if (t >= 0.7) {
        if (nextEl) nextEl.style.zIndex = '25';
        if (currEl) currEl.style.zIndex = '15';
      } else {
        if (nextEl) nextEl.style.zIndex = '5';
        if (currEl) currEl.style.zIndex = '20';
      }
    }
  }, []);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (snappingRef.current) return;
    draggingRef.current = true;
    stateRef.current = 'dragging';
    gestureIdRef.current++;
    if (wheelIdleTimerRef.current) { window.clearTimeout(wheelIdleTimerRef.current); wheelIdleTimerRef.current = null; }
    startYRef.current = e.touches[0].clientY;
    lastTsRef.current = performance.now();
    lastPRef.current = progressRef.current;
    dirtyRef.current = true; startLoop();
  }, [startLoop]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!draggingRef.current || snappingRef.current) return;
    const y = e.touches[0].clientY;
    // Positive when swiping down, negative when swiping up (more intuitive mapping)
    const delta = (y - startYRef.current) / THRESHOLD_PX;
    const nextP = clamp(delta, -MAX_PROGRESS, MAX_PROGRESS);
    const now = performance.now();
    const dt = Math.max(1, now - lastTsRef.current) / 1000;
    const v = (nextP - lastPRef.current) / dt;
    velocityRef.current = 0.6 * v + 0.4 * velocityRef.current;
    lastTsRef.current = now; lastPRef.current = nextP;
    progressRef.current = nextP; dirtyRef.current = true; startLoop();
  }, [startLoop]);

  const endDrag = useCallback(async (allowFlip: boolean) => {
    // finalize current gesture
    draggingRef.current = false;
    const p = progressRef.current, v = velocityRef.current;
    const k = 0.25; // velocity influence
    const s = p + k * v;
    const trigger = Math.abs(s) >= SNAP_THRESHOLD;

    // utility: run a single snap tween
    const runSnapTo = (to: number) => new Promise<void>((resolve) => {
      snappingRef.current = true;
      stateRef.current = 'snapping';
      if (wheelIdleTimerRef.current) { window.clearTimeout(wheelIdleTimerRef.current); wheelIdleTimerRef.current = null; }
      snapRef.current = { active: true, start: performance.now(), from: progressRef.current, to, dur: SNAP_MS };
      dirtyRef.current = true; startLoop();
      const wait = () => {
        if (!snapRef.current.active) resolve(); else requestAnimationFrame(wait);
      };
      requestAnimationFrame(wait);
    });

    // helper: execute one index step
    const doOneStep = async (dir: number) => {
      await runSnapTo(dir > 0 ? +1 : -1);
      const next = (index + dir + count) % count;
      onIndexChange(next);
      progressRef.current = 0;
      dirtyRef.current = true; startLoop();
      snappingRef.current = false;
      stateRef.current = 'idle';
    };

    if (!(allowFlip && trigger)) {
      await runSnapTo(0);
      snappingRef.current = false;
      stateRef.current = 'idle';
      return;
    }

    // decide steps (default one step)
    let steps = s > 0 ? +1 : -1;
    const strong = Math.abs(v) >= 1.4 || Math.abs(p) >= 0.95;
    if (strong) {
      const k2 = 0.35;
      const cand = Math.max(-2, Math.min(2, Math.round((p + k2 * v) * 1.6)));
      if (cand !== 0 && Math.sign(cand) === Math.sign(steps)) steps = cand;
    }
    // clamp to max 2 steps
    const dir = steps > 0 ? +1 : -1;
    const total = Math.min(2, Math.abs(steps));
    for (let i = 0; i < total; i++) {
      await doOneStep(dir);
    }
  }, [count, index, onIndexChange, startLoop]);

  const onWheel = useCallback((e: WheelEvent) => {
    if (snappingRef.current) { e.preventDefault(); return; }
    e.preventDefault();
    stateRef.current = 'dragging';
    gestureIdRef.current++;
    const currentGesture = gestureIdRef.current;
    const dy = e.deltaY;
    if (Math.abs(dy) < 2) return;
    const now = performance.now();
    const last = lastTsRef.current || now;
    const dt = Math.max(1, now - last) / 1000;
    const deltaP = -dy / THRESHOLD_PX; // up (negative dy) -> forward (+progress)
    const nextP = clamp(progressRef.current + deltaP, -MAX_PROGRESS, MAX_PROGRESS);
    velocityRef.current = 0.6 * ((nextP - progressRef.current) / dt) + 0.4 * velocityRef.current;
    progressRef.current = nextP;
    lastTsRef.current = now;
    dirtyRef.current = true; startLoop();
    // accumulate within a burst window; snap once after idle
    if (wheelIdleTimerRef.current) window.clearTimeout(wheelIdleTimerRef.current);
    wheelIdleTimerRef.current = window.setTimeout(() => {
      if (gestureIdRef.current !== currentGesture) return; // stale
      endDrag(true);
    }, 200) as unknown as number;
  }, [endDrag, startLoop]);

  useEffect(() => {
    const root = (rootRef as React.RefObject<HTMLDivElement>).current;
    if (!root) return;
    const ts = (ev: Event) => onTouchStart(ev as TouchEvent);
    const tm = (ev: Event) => onTouchMove(ev as TouchEvent);
    const te = () => endDrag(true);
    const tc = () => endDrag(false);
    root.addEventListener('touchstart', ts, { passive: true });
    root.addEventListener('touchmove', tm, { passive: false });
    root.addEventListener('touchend', te, { passive: true });
    root.addEventListener('touchcancel', tc, { passive: true });
    root.addEventListener('wheel', onWheel as any, { passive: false });
    return () => {
      root.removeEventListener('touchstart', ts as any);
      root.removeEventListener('touchmove', tm as any);
      root.removeEventListener('touchend', te as any);
      root.removeEventListener('touchcancel', tc as any);
      root.removeEventListener('wheel', onWheel as any);
    };
  }, [onTouchStart, onTouchMove, endDrag, onWheel]);

  useEffect(() => { dirtyRef.current = true; startLoop(); }, [index, startLoop]);

  const renderMedia = (asset: ArtistAsset) => {
    const base: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'contain', borderRadius: 14, background: 'transparent' };
    if (asset.type === 'video') {
      return (
        <video
          src={asset.url}
          muted playsInline loop autoPlay preload="auto"
          onLoadedMetadata={(e) => {
            const v = e.currentTarget as HTMLVideoElement;
            if (v.videoWidth && v.videoHeight) setNaturalAspect(v.videoWidth / v.videoHeight);
          }}
          style={base as any}
        />
      );
    }
    return (
      <img
        src={asset.url}
        alt={asset.title || 'Artwork'}
        loading={'eager'}
        onLoad={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          if (img.naturalWidth && img.naturalHeight) setNaturalAspect(img.naturalWidth / img.naturalHeight);
        }}
        style={base as any}
      />
    );
  };

  const containerStyle: React.CSSProperties = useMemo(() => ({
    position: 'relative',
    width: 'min(90vw, 640px)',
    aspectRatio: String(naturalAspect || 16/9),
    margin: '0 auto 16px auto',
    perspective: '1100px',
    transformStyle: 'preserve-3d',
    overflow: 'visible',
    touchAction: 'none'
  }), [naturalAspect]);

  return (
    <div ref={rootRef as any} aria-roledescription="carousel" aria-label="Artist content" style={containerStyle}>
      {/* Prev (back, small) */}
      <div ref={layerPrevRef} style={{ position:'absolute', inset:0, zIndex: 5, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
        {renderMedia(prevItem)}
      </div>
      {/* Current (front, large) */}
      <div ref={layerCurrRef} style={{ position:'absolute', inset:0, zIndex: 20, display:'flex', alignItems:'center', justifyContent:'center', backfaceVisibility:'hidden' }}>
        {renderMedia(currItem)}
      </div>
      {/* Next (back, small) */}
      <div ref={layerNextRef} style={{ position:'absolute', inset:0, zIndex: 5, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
        {renderMedia(nextItem)}
      </div>
      <p className="sr-only" aria-live="polite">{`Showing item ${index + 1} of ${Math.max(1,count)}: ${currItem?.title || 'Untitled'}`}</p>
    </div>
  );
};

export default OrbitPeekCarousel;


