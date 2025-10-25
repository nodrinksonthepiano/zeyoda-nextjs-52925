'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import type { ArtistAsset } from '../hooks/useArtistAssets';

type Props = {
  items: ArtistAsset[];
  index: number;
  onIndexChange: (next: number) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  peekPercent?: number; // 10 by default
  theme?: { fontFamily?: string; primaryColor?: string; accentColor?: string };
};

const THRESHOLD_PX = 80;           // drag distance to reach full progress
const MAX_PROGRESS = 1.15;         // clamp while dragging
const SNAP_THRESHOLD = 0.55;       // travel before flip (stricter)
const SNAP_MS = 200;               // easing time for snap (quicker)
const DEPTH_Z = 240;               // px of Z parallax (stronger depth)
const TILT_DEG = 6;                // tilt for depth cue (subtle to avoid warp)
const DRAG_SLOWDOWN = 1.4;         // dampen trackpad/finger sensitivity (snappier)
const FLIP_EXTRA_MARGIN = 0.03;    // small extra beyond threshold to commit flip
const DRAG_CAP_START = 0.90;       // start easing the cap near the end
const DRAG_CAP_MAX = 0.99;         // absolute drag limit (near full travel)
const MIN_COMMIT_DIST = 0.08;      // require some actual drag distance to allow a flip (matches dead-zone)

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function shortestSignedDistance(a: number, b: number, count: number) {
  if (count === 0) return 0;
  let d = a - b;
  const half = count / 2;
  if (d > half) d -= count;
  if (d < -half) d += count;
  return d;
}
function softCapProgress(raw: number): number {
  const sign = raw < 0 ? -1 : 1;
  const a = Math.min(Math.abs(raw), DRAG_CAP_MAX);
  if (a <= DRAG_CAP_START) return sign * a;
  const t = Math.min(1, (a - DRAG_CAP_START) / (DRAG_CAP_MAX - DRAG_CAP_START));
  // easeOutQuad toward the cap for a soft finish
  const eased = DRAG_CAP_START + (1 - (1 - t) * (1 - t)) * (DRAG_CAP_MAX - DRAG_CAP_START);
  return sign * eased;
}

export const OrbitPeekCarousel: React.FC<Props> = ({ items, index, onIndexChange, containerRef, peekPercent = 10, theme }) => {
  // Attach the provided containerRef so ThemeOrbitRenderer can measure the same element
  const internalRootRef = useRef<HTMLDivElement | null>(null);
  const rootRef = (containerRef as any) || internalRootRef;
  const VISIBLE_RADIUS = 3; // render window of items around index
  const itemLayerRefs = useRef<Map<number, HTMLDivElement>>(new Map()); // keyed by itemIdx
  const setItemRef = (itemIdx: number) => (el: HTMLDivElement | null) => {
    if (!itemLayerRefs.current) return;
    if (el) itemLayerRefs.current.set(itemIdx, el); else itemLayerRefs.current.delete(itemIdx);
  };

  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);
  const [showHeroOverlay, setShowHeroOverlay] = useState<boolean>(false);
  const [showPauseFlash, setShowPauseFlash] = useState<boolean>(false);
  const [isHeroPaused, setIsHeroPaused] = useState<boolean>(false);
  const [isHeroMuted, setIsHeroMuted] = useState<boolean>(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState<boolean>(false);
  const [showTitleDescription, setShowTitleDescription] = useState<boolean>(false);
  const overlayHideTimerRef = useRef<number | null>(null);
  const volumeHideTimerRef = useRef<number | null>(null);
  const lastNonZeroVolumeRef = useRef<number | null>(null);
  const isHeroMutedRef = useRef<boolean>(true);
  const volumeSliderRef = useRef<HTMLInputElement | null>(null);
  const controlOwnerRef = useRef<'volume' | null>(null);
  // Track the media wrapper elements to compute letterbox-aware overlay in the wrapper's own coords
  const mediaWrapRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const setMediaWrapRef = (itemIdx: number) => (el: HTMLDivElement | null) => {
    if (el) {
      mediaWrapRefs.current.set(itemIdx, el);
    } else {
      mediaWrapRefs.current.delete(itemIdx);
    }
  };
  const heroOverlayRORef = useRef<{ ro: ResizeObserver | null; el: Element | null }>({ ro: null, el: null });

  const progressRef = useRef(0);   // -1 .. 1 (drag progress)
  const lastTsRef = useRef(0);
  const lastPRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const snappingRef = useRef(false);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const dragPendingRef = useRef<boolean>(false);
  const loopRef = useRef<number | null>(null);
  const dirtyRef = useRef(true);
  const snapRef = useRef<{active:boolean;start:number;from:number;to:number;dur:number}>({active:false,start:0,from:0,to:0,dur:SNAP_MS});
  const idleSnapTimerRef = useRef<number | null>(null);
  const cachedHRef = useRef<number | null>(null);
  const lastWRef = useRef<number | null>(null);
  const pinnedActiveRef = useRef<boolean>(false);
  const pinnedWRef = useRef<number>(0);
  const pinnedHRef = useRef<number>(0);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map()); // keyed by itemIdx
  const imageRefs = useRef<Map<number, HTMLImageElement>>(new Map()); // keyed by itemIdx
  const heroReadyRef = useRef<boolean>(false);
  const snapLockRef = useRef<boolean>(false);
  const preloadStateRef = useRef<Map<number, 'auto' | 'metadata'>>(new Map());
  const playStateRef = useRef<Map<number, boolean>>(new Map());
  const intentDirRef = useRef<0 | 1 | -1>(0);

  // Gesture state & timers (to prevent re-entrancy and wheel double-snap)
  const stateRef = useRef<'idle' | 'dragging' | 'snapping'>('idle');
  const gestureIdRef = useRef(0);
  const wheelIdleTimerRef = useRef<number | null>(null);
  const lastCommitTsRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(true);
  const viewportChangingRef = useRef<boolean>(false);
  const viewportChangeTimerRef = useRef<number | null>(null);
  const flattenStageRef = useRef<boolean>(false);
  const guardUntilRef = useRef<number>(0);
  const [effectiveIndex, setEffectiveIndex] = useState<number>(index);
  const effectiveIndexRef = useRef<number>(index);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stabilizingRef = useRef<boolean>(false);
  const bodyLockRef = useRef<number>(0);
  const wheelDragActiveRef = useRef<boolean>(false);

  const lockBodyScroll = useCallback(() => {
    try {
      bodyLockRef.current++;
      document.body.classList.add('carousel-scroll-lock');
      // Defensive inline style for browsers ignoring class during gestures
      const prev = (document.body.style as any).overscrollBehavior;
      (document.body.style as any).overscrollBehavior = 'none';
      setTimeout(() => { (document.body.style as any).overscrollBehavior = prev || ''; }, 0);
    } catch {}
  }, []);

  const unlockBodyScroll = useCallback(() => {
    try {
      bodyLockRef.current = Math.max(0, bodyLockRef.current - 1);
      if (bodyLockRef.current === 0) {
        document.body.classList.remove('carousel-scroll-lock');
        (document.body.style as any).overscrollBehavior = '';
      }
    } catch {}
  }, []);

  const count = items.length || 0;
  const prevIndex = (effectiveIndex - 1 + count) % count;
  const nextIndex = (effectiveIndex + 1) % count;
  const prevItem = items[prevIndex] || items[effectiveIndex];
  const currItem = items[effectiveIndex];
  const nextItem = items[nextIndex] || items[effectiveIndex];

  useEffect(() => { effectiveIndexRef.current = effectiveIndex; }, [effectiveIndex]);
  useEffect(() => { isHeroMutedRef.current = isHeroMuted; }, [isHeroMuted]);
  // Reset description when index changes
  useEffect(() => { setShowTitleDescription(false); }, [effectiveIndex]);
  // Sync overlay target to current hero video and listen to play/pause changes
  useEffect(() => {
    const v = videoRefs.current.get(effectiveIndex);
    if (!v) { setIsHeroPaused(false); return; }
    const onPlay = () => { setIsHeroPaused(false); };
    const onPause = () => { setIsHeroPaused(true); };
    const onVol = () => { try { setIsHeroMuted(v.muted || v.volume === 0); if (v.volume > 0) lastNonZeroVolumeRef.current = v.volume; } catch {} };
    try {
      setIsHeroPaused(v.paused);
      setIsHeroMuted(v.muted || v.volume === 0);
      v.addEventListener('play', onPlay);
      v.addEventListener('pause', onPause);
      v.addEventListener('volumechange', onVol);
    } catch {}
    return () => {
      try { v.removeEventListener('play', onPlay); v.removeEventListener('pause', onPause); v.removeEventListener('volumechange', onVol); } catch {}
    };
  }, [effectiveIndex]);

  // Update CSS variables on the hero media wrapper to describe the inner picture rect (letterbox-aware)
  const updateHeroOverlayVars = useCallback(() => {
    const wrap = mediaWrapRefs.current.get(effectiveIndexRef.current);
    if (!wrap) return;
    const wrapW = Math.round(wrap.clientWidth || 0);
    const wrapH = Math.round(wrap.clientHeight || 0);
    if (!wrapW || !wrapH) return;
    const r = Math.max(0.2, Math.min(5, naturalAspect || 16 / 9));
    const wrapperAspect = wrapW / Math.max(1, wrapH);
    let contentW = wrapW, contentH = Math.round(wrapW / r), padX = 0, padY = 0;
    if (wrapperAspect > r) {
      // Bars left/right
      contentH = wrapH;
      contentW = Math.round(wrapH * r);
      padX = Math.round((wrapW - contentW) / 2);
      padY = 0;
    } else {
      // Bars top/bottom
      contentW = wrapW;
      contentH = Math.round(wrapW / r);
      padX = 0;
      padY = Math.round((wrapH - contentH) / 2);
    }
    try {
      wrap.style.setProperty('--pad-x', `${padX}px`);
      wrap.style.setProperty('--pad-y', `${padY}px`);
      wrap.style.setProperty('--content-w', `${contentW}px`);
      wrap.style.setProperty('--content-h', `${contentH}px`);
    } catch {}
  }, [naturalAspect]);

  // Attach ResizeObserver to the current hero's wrapper and refresh on hero:pinned
  useEffect(() => {
    const attach = () => {
      const target = mediaWrapRefs.current.get(effectiveIndexRef.current);
      const ref = heroOverlayRORef.current;
      if (ref.ro && ref.el && ref.el !== target) { try { ref.ro.unobserve(ref.el); } catch {} }
      if (!target) return;
      if (!ref.ro) {
        try {
          ref.ro = new ResizeObserver(() => { requestAnimationFrame(updateHeroOverlayVars); });
        } catch {
          ref.ro = null;
        }
      }
      ref.el = target;
      if (ref.ro) { try { ref.ro.observe(target); } catch {} }
      requestAnimationFrame(() => { requestAnimationFrame(updateHeroOverlayVars); });
    };
    attach();
    const onPinned = () => {
      // Two-rAF settle after pin to avoid transient viewport/toolbar deltas
      requestAnimationFrame(() => requestAnimationFrame(updateHeroOverlayVars));
    };
    window.addEventListener('hero:pinned', onPinned);
    return () => { window.removeEventListener('hero:pinned', onPinned); };
  }, [effectiveIndex, updateHeroOverlayVars]);

  // Briefly show title on hero land (from hero:pinned)
  useEffect(() => {
    const onPinned = () => {
      setShowHeroOverlay(true);
      if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current);
      overlayHideTimerRef.current = window.setTimeout(() => setShowHeroOverlay(false), 4000) as unknown as number;
    };
    window.addEventListener('hero:pinned', onPinned);
    return () => window.removeEventListener('hero:pinned', onPinned);
  }, []);

  // Reset overlay state on hero index change
  useEffect(() => {
    setShowHeroOverlay(false);
    setShowPauseFlash(false);
    setShowVolumeSlider(false);
    if (overlayHideTimerRef.current) { window.clearTimeout(overlayHideTimerRef.current); overlayHideTimerRef.current = null; }
    if (volumeHideTimerRef.current) { window.clearTimeout(volumeHideTimerRef.current); volumeHideTimerRef.current = null; }
  }, [effectiveIndex]);
  const itemsSignature = useMemo(() => {
    try {
      return `${items.length}:${items.map((it: any) => (it?.id ?? it?.url ?? '')).join('|')}`;
    } catch {
      return String(items.length);
    }
  }, [items]);
  // Reset pinned measurements and gesture/snap state whenever the dataset changes
  // Ensures sizes/peeks don't leak across artists and drag state is clean
  useLayoutEffect(() => {
    const root = (rootRef as React.RefObject<HTMLDivElement>).current;
    // Clear timers
    if (wheelIdleTimerRef.current) { try { window.clearTimeout(wheelIdleTimerRef.current); } catch {} wheelIdleTimerRef.current = null; }
    if (idleSnapTimerRef.current) { try { window.clearTimeout(idleSnapTimerRef.current); } catch {} idleSnapTimerRef.current = null; }
    if (viewportChangeTimerRef.current) { try { window.clearTimeout(viewportChangeTimerRef.current); } catch {} viewportChangeTimerRef.current = null; }
    // Reset interaction state
    draggingRef.current = false;
    snappingRef.current = false;
    snapLockRef.current = false;
    dragPendingRef.current = false;
    stateRef.current = 'idle';
    gestureIdRef.current = 0;
    progressRef.current = 0;
    velocityRef.current = 0;
    lastPRef.current = 0;
    guardUntilRef.current = 0;
    lastCommitTsRef.current = 0;
    heroReadyRef.current = false;
    preloadStateRef.current.clear();
    playStateRef.current.clear();
    // Reset pinning and cached measurements
    pinnedActiveRef.current = false;
    pinnedWRef.current = 0; pinnedHRef.current = 0;
    cachedHRef.current = null; lastWRef.current = null;
    if (root) { try { (root as HTMLDivElement).style.width = ''; (root as HTMLDivElement).style.height = ''; } catch {} }
    // Accept external index immediately for new dataset
    effectiveIndexRef.current = index; setEffectiveIndex(index);
    // Defer to aspect-aware fit-box pin in the mount effect; just request a paint to rest
    requestAnimationFrame(() => {
      progressRef.current = 0;
      dirtyRef.current = true; startLoop();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsSignature, index]);
  useEffect(() => {
    // Only accept external index updates when we're not inside the guarded commit window
    if (performance.now() >= guardUntilRef.current) {
      setEffectiveIndex(index);
    }
  }, [index]);

  const startLoop = useCallback(() => {
    if (loopRef.current !== null) return;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic for snappier finish
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
    const baseIndex = effectiveIndexRef.current;

    // Pixel rounding for stability
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const roundPx = (v: number) => Math.round(v * dpr) / dpr;

    // Measurements (cache height so rest state matches initial load)
    const root = rootRef.current;
    let H = cachedHRef.current ?? 0;
    const rect = root?.getBoundingClientRect();
    const wNow = rect?.width || 0;
    if (pinnedActiveRef.current) {
      // Use pinned height always during idle/scroll; do not re-measure
      H = pinnedHRef.current || H;
    } else {
      if (!H) {
        const measured = Math.max(1, rect?.height || 0);
        if (measured) { cachedHRef.current = measured; H = measured; }
        if (wNow) lastWRef.current = wNow;
      } else {
        // Only re-measure when width changes materially (>2%) while not pinned
        if (wNow && lastWRef.current && Math.abs(wNow - lastWRef.current) / lastWRef.current > 0.02) {
          const measured = Math.max(1, rect?.height || 0);
          if (measured) { cachedHRef.current = measured; H = measured; }
          lastWRef.current = wNow;
        }
      }
      // do not pin here anymore; initial pin handled on mount rAF
    }
    if (!H) return; // wait until measured at least once

    const visiblePeek = 0.44; // micro-adjust: slightly reduce peek to avoid clash
    const sAnchors = [1.0, 0.5, 0.25, 0.125];

    // For stable z-ordering, compute transforms for each visible item and then set zIndex from depth
    const depthPer: { key: number; depth: number }[] = [];
    let heroKey = -1;
    let heroMin = Infinity;

    const seen = new Set<number>();
    const isInteracting = (stateRef.current !== 'idle') || Math.abs(p) > 0.001;
    for (let j = -VISIBLE_RADIUS; j <= VISIBLE_RADIUS; j++) {
      const itemIdx = (baseIndex + j + count) % count;
      if (seen.has(itemIdx)) continue; // avoid duplicate renders when count < window
      seen.add(itemIdx);
      const el = itemLayerRefs.current.get(itemIdx);
      if (!el) continue;
      const rel = shortestSignedDistance(itemIdx, baseIndex + p, count);
      const a = Math.abs(rel);
      const sign = rel === 0 ? 0 : (rel > 0 ? 1 : -1);
      const k0 = Math.min(3, Math.floor(a));
      const k1 = Math.min(3, k0 + 1);
      const t = Math.max(0, Math.min(1, a - k0));

      const s0 = sAnchors[k0];
      const s1 = sAnchors[k1];
      const s = s0 + (s1 - s0) * t;

      const yFor = (k: number, sK: number, sgn: number) => {
        if (k === 0 || sgn === 0) return 0;
        return sgn * (0.5 * H + sK * (0.5 - visiblePeek) * H);
      };
      const y0 = yFor(k0, s0, sign);
      const y1 = yFor(k1, s1, sign === 0 ? 1 : sign);
      const yPx = roundPx(y0 + (y1 - y0) * t);

      const z0 = -DEPTH_Z * (1 - s0);
      const z1 = -DEPTH_Z * (1 - s1);
      let z = roundPx(z0 + (z1 - z0) * t);

      let tilt = (isInteracting && sign !== 0) ? TILT_DEG * (1 - s) * sign : 0;
      if (flattenStageRef.current || !isVisibleRef.current || !isInteracting) { tilt = 0; }

      el.style.willChange = isInteracting ? 'transform' : '';
      el.style.transform = `translate3d(0px, ${yPx}px, ${z}px) rotateX(${tilt}deg) scale(${s})`;
      el.style.opacity = '1';
      depthPer.push({ key: itemIdx, depth: z });

      const dist = Math.abs(rel);
      if (dist < heroMin) { heroMin = dist; heroKey = itemIdx; }
    }

    if (flattenStageRef.current && heroKey !== -1) {
      // Force hero on top deterministically while frozen
      const heroEl = itemLayerRefs.current.get(heroKey);
      if (heroEl) heroEl.style.zIndex = String(999);
      const others = depthPer.filter(d => d.key !== heroKey).sort((a, b) => a.depth - b.depth);
      others.forEach((entry, idx) => {
        const el = itemLayerRefs.current.get(entry.key);
        if (!el) return;
        el.style.zIndex = String(5 + idx);
      });
    } else {
      depthPer.sort((a, b) => a.depth - b.depth);
      depthPer.forEach((entry, idx) => {
        const el = itemLayerRefs.current.get(entry.key);
        if (!el) return;
        el.style.zIndex = String(5 + idx);
      });
    }

    // Media orchestration: only hero/in-transit items play; coalesce attribute writes
    for (let j = -VISIBLE_RADIUS; j <= VISIBLE_RADIUS; j++) {
      const itemIdx = (baseIndex + j + count) % count;
      if (seen.size && !seen.has(itemIdx)) continue;
      const v = videoRefs.current.get(itemIdx);
      if (!v) continue;
      const rel = shortestSignedDistance(itemIdx, baseIndex + p, count);
      const dist = Math.abs(rel);
      const shouldPlay = dist < 0.5 || (stateRef.current === 'dragging' && dist < 1.2);
      // Determine hero readiness
      if (itemIdx === heroKey && (v.readyState >= 2 || v.currentTime > 0)) heroReadyRef.current = true;
      // Preload policy (coalesced)
      const desiredPreload: 'auto' | 'metadata' = heroReadyRef.current ? (dist <= 2 ? 'auto' : 'metadata') : (itemIdx === heroKey ? 'auto' : 'metadata');
      const lastPreload = preloadStateRef.current.get(itemIdx);
      if (lastPreload !== desiredPreload) { try { v.preload = desiredPreload; } catch {} preloadStateRef.current.set(itemIdx, desiredPreload); }
      // Only the hero can be unmuted
      try { v.muted = (itemIdx !== heroKey) ? true : !!isHeroMutedRef.current; } catch {}
      v.playsInline = true as any;
      const lastPlay = playStateRef.current.get(itemIdx) || false;
      const wantPlay = shouldPlay && v.readyState >= 2;
      if (wantPlay !== lastPlay) {
        if (wantPlay) { try { void v.play(); } catch {} } else { try { if (!v.paused) v.pause(); } catch {} }
        playStateRef.current.set(itemIdx, wantPlay);
      }
    }

  }, []);

  // Compute a pixel-true fit-box so the hero occupies ~50% of the viewport in both axes
  const computeFitBox = useCallback(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const vw = Math.max(320, Math.round(vv?.width || window.innerWidth || 0));
    const vh = Math.max(320, Math.round(vv?.height || window.innerHeight || 0));
    const r = Math.max(0.2, Math.min(5, naturalAspect || 16 / 9)); // guard extreme ratios
    const targetW = Math.min(Math.round(0.5 * vw), Math.round(0.5 * vh * r));
    const targetH = Math.round(targetW / r);
    const clampedW = Math.max(280, Math.min(1000, targetW));
    const clampedH = Math.max(180, Math.min(Math.round(1000 / r), targetH));
    // Guarantee some side margin so oval doesn’t appear clipped on small screens
    const sidePad = Math.round(vw * 0.04);
    const safeW = Math.min(clampedW, vw - sidePad * 2);
    return { w: safeW, h: clampedH };
  }, [naturalAspect]);

  const waitForItemReady = useCallback((itemIdx: number, maxWaitMs: number = 250) => {
    return new Promise<void>((resolve) => {
      const start = performance.now();
      const check = () => {
        const v = videoRefs.current.get(itemIdx);
        if (v && (v.readyState >= 2 || v.currentTime > 0)) { resolve(); return; }
        const img = imageRefs.current.get(itemIdx);
        if (img && img.complete && img.naturalWidth > 0) { resolve(); return; }
        if (performance.now() - start >= maxWaitMs) { resolve(); return; }
        requestAnimationFrame(check);
      };
      check();
    });
  }, []);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (controlOwnerRef.current) return; // a control owns the gesture
    if (snappingRef.current || count <= 1) return;
    // Defer capturing until movement proves intent (prevents page-scroll from updating progress)
    draggingRef.current = false;
    dragPendingRef.current = true;
    stateRef.current = 'idle';
    gestureIdRef.current++;
    if (wheelIdleTimerRef.current) { window.clearTimeout(wheelIdleTimerRef.current); wheelIdleTimerRef.current = null; }
    if (idleSnapTimerRef.current) { window.clearTimeout(idleSnapTimerRef.current); idleSnapTimerRef.current = null; }
    startYRef.current = e.touches[0].clientY;
    startXRef.current = e.touches[0].clientX;
    lastTsRef.current = performance.now();
    lastPRef.current = progressRef.current;
    intentDirRef.current = 0;
    lockBodyScroll();
    dirtyRef.current = true; startLoop();
  }, [startLoop]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (controlOwnerRef.current) return; // ignore while interacting with controls
    if (count <= 1) return;
    if (snappingRef.current || snapLockRef.current || stabilizingRef.current || !isVisibleRef.current) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    // capture gesture only after threshold
    if (dragPendingRef.current && !draggingRef.current) {
      const dx = Math.abs(x - startXRef.current);
      const dy = Math.abs(y - startYRef.current);
      const TAKEOVER = 12; // px
      if (dy > TAKEOVER && dy > dx * 1.2) {
        draggingRef.current = true;
        dragPendingRef.current = false;
        stateRef.current = 'dragging';
        // prevent page scroll now that carousel has captured the gesture
        try { (e as any).preventDefault?.(); } catch {}
      } else {
        return; // let page scroll
      }
    }
    if (!draggingRef.current) return;
    // Swipe up should advance to next (positive progress)
    const delta = (startYRef.current - y) / (THRESHOLD_PX * DRAG_SLOWDOWN);
    // Detect intent early and prewarm incoming neighbor once
    if (intentDirRef.current === 0) {
      const px = Math.abs(startYRef.current - y);
      if (px > 8) {
        intentDirRef.current = (startYRef.current - y) > 0 ? 1 : -1;
        const targetIdx = (effectiveIndexRef.current + intentDirRef.current + count) % count;
        const v = videoRefs.current.get(targetIdx);
        if (v) { try { v.preload = 'auto'; } catch {} try { void v.play().catch(()=>{}); v.pause(); } catch {} }
      }
    }
    const raw = clamp(delta, -MAX_PROGRESS, MAX_PROGRESS);
    const nextP = softCapProgress(raw);
    const now = performance.now();
    const dt = Math.max(1, now - lastTsRef.current) / 1000;
    const v = (nextP - lastPRef.current) / dt;
    velocityRef.current = 0.6 * v + 0.4 * velocityRef.current;
    lastTsRef.current = now; lastPRef.current = nextP;
    progressRef.current = nextP; dirtyRef.current = true; startLoop();
    // reset idle snap fallback while moving
    if (idleSnapTimerRef.current) { window.clearTimeout(idleSnapTimerRef.current); idleSnapTimerRef.current = null; }
  }, [startLoop]);

  const endDrag = useCallback(async (allowFlip: boolean) => {
    if (count <= 1) { progressRef.current = 0; dirtyRef.current = true; startLoop(); return; }
    // ignore stray calls right after a commit
    if (performance.now() - lastCommitTsRef.current < 240) return;
    // finalize current gesture
    draggingRef.current = false;
    unlockBodyScroll();
    if (wheelIdleTimerRef.current) { window.clearTimeout(wheelIdleTimerRef.current); wheelIdleTimerRef.current = null; }
    if (idleSnapTimerRef.current) { window.clearTimeout(idleSnapTimerRef.current); idleSnapTimerRef.current = null; }
    const p = progressRef.current, v = velocityRef.current;
    const k = 0.25; // velocity influence
    const s = p + k * v;
    const commitThreshold = SNAP_THRESHOLD + FLIP_EXTRA_MARGIN; // require a bit beyond threshold
    const trigger = Math.abs(s) >= commitThreshold && Math.abs(p) >= MIN_COMMIT_DIST;

    // utility: run a single snap tween
    const runSnapTo = (to: number) => new Promise<void>((resolve) => {
      snappingRef.current = true;
      snapLockRef.current = true;
      stateRef.current = 'snapping';
      if (wheelIdleTimerRef.current) { window.clearTimeout(wheelIdleTimerRef.current); wheelIdleTimerRef.current = null; }
      snapRef.current = { active: true, start: performance.now(), from: progressRef.current, to, dur: SNAP_MS };
      dirtyRef.current = true; startLoop();
      const wait = () => {
        if (!snapRef.current.active) resolve(); else requestAnimationFrame(wait);
      };
      requestAnimationFrame(wait);
    });

    // dead-zone around center: always snap to 0 if close
    if (Math.abs(progressRef.current) < 0.08) {
      stabilizingRef.current = true; lockBodyScroll();
      await runSnapTo(0);
      progressRef.current = 0;
      try { writeFrame(); } catch {}
      dirtyRef.current = true; startLoop();
      requestAnimationFrame(() => { dirtyRef.current = true; startLoop(); });
      snappingRef.current = false;
      stateRef.current = 'idle';
      snapLockRef.current = false;
      stabilizingRef.current = false; unlockBodyScroll();
      try { window.dispatchEvent(new CustomEvent('carousel:stable')); } catch {}
      return;
    }

    // helper: execute one index step
    const doOneStep = async (dir: number) => {
      stabilizingRef.current = true; lockBodyScroll();
      await runSnapTo(dir > 0 ? +1 : -1);
      // Paint the final anchored frame at p = ±1 before flipping index
      try { writeFrame(); } catch {}
      const baseIndex = effectiveIndexRef.current;
      const next = (baseIndex + dir + count) % count;
      // ensure the incoming hero media (by itemIdx) is ready to avoid flash
      await waitForItemReady(next, 900);
      requestAnimationFrame(() => {
        setEffectiveIndex(next);
        effectiveIndexRef.current = next;
        onIndexChange(next);
        progressRef.current = 0;
        // Immediately paint the new anchored hero at p = 0
        try { writeFrame(); } catch {}
        dirtyRef.current = true; startLoop();
        requestAnimationFrame(() => {
          dirtyRef.current = true; startLoop();
          snappingRef.current = false;
          stateRef.current = 'idle';
          snapLockRef.current = false;
          // hard reset gesture state so we don't immediately re-trigger another snap back
          velocityRef.current = 0;
          intentDirRef.current = 0;
          if (wheelIdleTimerRef.current) { window.clearTimeout(wheelIdleTimerRef.current); wheelIdleTimerRef.current = null; }
          lastCommitTsRef.current = performance.now();
          guardUntilRef.current = lastCommitTsRef.current + 180;
          stabilizingRef.current = false; unlockBodyScroll();
          try { window.dispatchEvent(new CustomEvent('carousel:stable')); } catch {}
        });
      });
    };

    if (!(allowFlip && trigger)) {
      await runSnapTo(0);
      snappingRef.current = false;
      stateRef.current = 'idle';
      snapLockRef.current = false;
      return;
    }

    // one-at-a-time only
    const dir = s > 0 ? +1 : -1;
    await doOneStep(dir);
  }, [count, onIndexChange, startLoop, waitForItemReady]);

  const onWheel = useCallback((e: WheelEvent) => {
    if (count <= 1) { e.preventDefault(); return; }
    if (snappingRef.current || snapLockRef.current || stabilizingRef.current || !isVisibleRef.current) { e.preventDefault(); e.stopPropagation(); return; }
    e.preventDefault(); e.stopPropagation();
    stateRef.current = 'dragging';
    if (!wheelDragActiveRef.current) { wheelDragActiveRef.current = true; lockBodyScroll(); }
    gestureIdRef.current++;
    const currentGesture = gestureIdRef.current;
    const dy = e.deltaY;
    if (Math.abs(dy) < 2) return;
    const now = performance.now();
    const last = lastTsRef.current || now;
    const dt = Math.max(1, now - last) / 1000;
    const deltaP = -dy / (THRESHOLD_PX * DRAG_SLOWDOWN); // dampened wheel
    const raw = clamp(progressRef.current + deltaP, -MAX_PROGRESS, MAX_PROGRESS);
    const nextP = softCapProgress(raw);
    velocityRef.current = 0.6 * ((nextP - progressRef.current) / dt) + 0.4 * velocityRef.current;
    progressRef.current = nextP;
    lastTsRef.current = now;
    dirtyRef.current = true; startLoop();
    // accumulate within a burst window; snap once after idle
    if (wheelIdleTimerRef.current) window.clearTimeout(wheelIdleTimerRef.current);
    wheelIdleTimerRef.current = window.setTimeout(() => {
      if (gestureIdRef.current !== currentGesture) return; // stale
      endDrag(true);
      wheelDragActiveRef.current = false; unlockBodyScroll();
    }, 120) as unknown as number;
    // stranded fallback: if progress is left between anchors without a clear release, snap
    if (idleSnapTimerRef.current) window.clearTimeout(idleSnapTimerRef.current);
    idleSnapTimerRef.current = window.setTimeout(() => {
      if (!draggingRef.current && !snappingRef.current) {
        const pNow = progressRef.current;
        if (Math.abs(pNow) > 0.06) endDrag(true);
      }
      wheelDragActiveRef.current = false; unlockBodyScroll();
    }, 100) as unknown as number;
  }, [endDrag, startLoop]);

  useEffect(() => {
    const root = (rootRef as React.RefObject<HTMLDivElement>).current;
    if (!root) return;
    // Aspect-aware first pin: wait for media readiness or a short timeout, then pin.
    let raf: number | null = null;
    let timeoutId: number | null = null;
    let timeoutFired = false;
    const tryPin = () => {
      try {
        if (pinnedActiveRef.current) return;
        const aspectReady = !!naturalAspect || heroReadyRef.current;
        if (aspectReady || timeoutFired) {
          const { w, h } = computeFitBox();
          pinnedActiveRef.current = true;
          pinnedWRef.current = w;
          pinnedHRef.current = h;
          (root as HTMLDivElement).style.width = `${w}px`;
          (root as HTMLDivElement).style.height = `${h}px`;
        cachedHRef.current = pinnedHRef.current;
          lastWRef.current = pinnedWRef.current;
          dirtyRef.current = true; startLoop();
          // Emit hero pinned payload for dependents
          try {
            const detail = { w: pinnedWRef.current, h: pinnedHRef.current, ts: performance.now() };
            (window as any).__heroPinnedCache = detail;
            window.dispatchEvent(new CustomEvent('hero:pinned', { detail } as any));
            requestAnimationFrame(() => {
              window.dispatchEvent(new CustomEvent('hero:pinned', { detail: { ...detail, ts: performance.now() } } as any));
              window.dispatchEvent(new CustomEvent('carousel:stable'));
            });
          } catch {}
          return;
        }
      } finally {
        raf = requestAnimationFrame(tryPin);
      }
    };
    raf = requestAnimationFrame(tryPin);
    timeoutId = window.setTimeout(() => { timeoutFired = true; }, 300) as unknown as number;
    const onReflow = () => {
      // Only react to real layout changes (>10% width delta)
      if (pinnedActiveRef.current) {
        const { w, h } = computeFitBox();
        const dw = Math.abs(w - pinnedWRef.current) / (pinnedWRef.current || 1);
        const dh = Math.abs(h - pinnedHRef.current) / (pinnedHRef.current || 1);
        if (dw > 0.03 || dh > 0.03) {
          // Re-pin width and height to new layout using fit-box
          pinnedWRef.current = w; pinnedHRef.current = h;
          try {
            (root as HTMLDivElement).style.width = `${w}px`;
            (root as HTMLDivElement).style.height = `${h}px`;
          } catch {}
          cachedHRef.current = pinnedHRef.current; lastWRef.current = w;
          try {
            const detail = { w: pinnedWRef.current, h: pinnedHRef.current, ts: performance.now() };
            (window as any).__heroPinnedCache = detail;
            window.dispatchEvent(new CustomEvent('hero:pinned', { detail } as any));
            requestAnimationFrame(() => {
              window.dispatchEvent(new CustomEvent('hero:pinned', { detail: { ...detail, ts: performance.now() } } as any));
              window.dispatchEvent(new CustomEvent('carousel:stable'));
            });
          } catch {}
        } else {
          // Ignore minor viewport jitters
          return;
        }
      } else {
        cachedHRef.current = null; lastWRef.current = null;
      }
      dirtyRef.current = true; startLoop();
    };
    // Visibility guard: if carousel is mostly off-screen, snap to rest and ignore wheel deltas
    const io = new IntersectionObserver((entries) => {
      const ent = entries[0];
      const vis = (ent && ent.intersectionRatio >= 0.85);
      isVisibleRef.current = !!vis;
      if (!vis && !draggingRef.current && !snappingRef.current) {
        progressRef.current = 0;
        dirtyRef.current = true; startLoop();
      }
    }, { threshold: [0, 0.25, 0.5, 0.75, 0.85, 1] });
    try { io.observe(root); } catch {}
    // iOS visual viewport guard: debounced lock to rest during UI chrome show/hide
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const onVV = () => {
      viewportChangingRef.current = true; flattenStageRef.current = true;
      draggingRef.current = false;
      progressRef.current = 0;
      dirtyRef.current = true; startLoop();
      if (viewportChangeTimerRef.current) window.clearTimeout(viewportChangeTimerRef.current);
      viewportChangeTimerRef.current = window.setTimeout(() => {
        viewportChangingRef.current = false; flattenStageRef.current = false;
        const s = stageRef.current;
        if (s) { try { s.style.transform = 'translateZ(0)'; requestAnimationFrame(() => { s.style.transform = ''; dirtyRef.current = true; startLoop(); }); } catch {} }
        for (const el of itemLayerRefs.current.values()) { try { el.style.willChange = ''; } catch {} }
      }, 80) as unknown as number;
    };
    if (vv) {
      try { vv.addEventListener('resize', onVV); vv.addEventListener('scroll', onVV); } catch {}
    }
    const onScroll = () => {
      viewportChangingRef.current = true; flattenStageRef.current = true;
      draggingRef.current = false;
      progressRef.current = 0;
      dirtyRef.current = true; startLoop();
      if (viewportChangeTimerRef.current) window.clearTimeout(viewportChangeTimerRef.current);
      viewportChangeTimerRef.current = window.setTimeout(() => {
        viewportChangingRef.current = false; flattenStageRef.current = false;
        const s = stageRef.current;
        if (s) { try { s.style.transform = 'translateZ(0)'; requestAnimationFrame(() => { s.style.transform = ''; dirtyRef.current = true; startLoop(); }); } catch {} }
        for (const el of itemLayerRefs.current.values()) { try { el.style.willChange = ''; } catch {} }
      }, 80) as unknown as number;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const ts = (ev: Event) => onTouchStart(ev as TouchEvent);
    const tm = (ev: Event) => onTouchMove(ev as TouchEvent);
    const te = () => endDrag(true);
    const tc = () => endDrag(false);
    root.addEventListener('touchstart', ts, { passive: true });
    root.addEventListener('touchmove', tm, { passive: false });
    root.addEventListener('touchend', te, { passive: true });
    root.addEventListener('touchcancel', tc, { passive: true });
    // Prevent page scroll while the pointer is over the carousel by default
    root.addEventListener('wheel', onWheel as any, { passive: false });
    root.addEventListener('touchmove', (e: any) => {
      try {
        // Allow native handling for in-control drags (e.g., volume slider)
        if (!controlOwnerRef.current) {
          e.preventDefault();
        }
      } catch {}
    }, { passive: false });
    window.addEventListener('resize', onReflow);
    window.addEventListener('orientationchange', onReflow);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (timeoutId) window.clearTimeout(timeoutId);
      root.removeEventListener('touchstart', ts as any);
      root.removeEventListener('touchmove', tm as any);
      root.removeEventListener('touchend', te as any);
      root.removeEventListener('touchcancel', tc as any);
      root.removeEventListener('wheel', onWheel as any);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('orientationchange', onReflow);
      window.removeEventListener('scroll', onScroll as any);
      try { io.disconnect(); } catch {}
      if (vv) { try { vv.removeEventListener('resize', onVV); vv.removeEventListener('scroll', onVV); } catch {} }
    };
  }, [onTouchStart, onTouchMove, endDrag, onWheel]);

  // Re-pin when natural aspect is learned and differs materially from first pin
  useEffect(() => {
    const root = (rootRef as React.RefObject<HTMLDivElement>).current;
    if (!root) return;
    try {
      if (!naturalAspect) return;
      const { w, h } = computeFitBox();
      pinnedActiveRef.current = true;
      pinnedWRef.current = w; pinnedHRef.current = h;
      (root as HTMLDivElement).style.width = `${w}px`;
      (root as HTMLDivElement).style.height = `${h}px`;
      cachedHRef.current = pinnedHRef.current; lastWRef.current = w;
      dirtyRef.current = true; startLoop();
      try {
        const detail = { w: pinnedWRef.current, h: pinnedHRef.current, ts: performance.now() };
        (window as any).__heroPinnedCache = detail;
        window.dispatchEvent(new CustomEvent('hero:pinned', { detail } as any));
        requestAnimationFrame(() => {
          window.dispatchEvent(new CustomEvent('hero:pinned', { detail: { ...detail, ts: performance.now() } } as any));
          window.dispatchEvent(new CustomEvent('carousel:stable'));
        });
      } catch {}
    } catch {}
  }, [naturalAspect, startLoop, computeFitBox]);

  useEffect(() => { dirtyRef.current = true; startLoop(); }, [effectiveIndex, startLoop]);

  const renderMedia = (asset?: ArtistAsset | null, itemIdx?: number) => {
    if (!asset || !asset.url) return null;
    const base: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'contain', borderRadius: 14, background: 'transparent' };
    const overlayFont = theme?.fontFamily || 'inherit';
    const overlayBg = theme?.primaryColor || 'rgba(0,0,0,0.6)';
    const overlayFg = theme?.accentColor || '#ffffff';
    const isHero = typeof itemIdx === 'number' && itemIdx === effectiveIndex;
    if (asset.type === 'video') {
      return (
        <div ref={typeof itemIdx === 'number' ? setMediaWrapRef(itemIdx) : undefined} style={{ position:'relative', width:'100%', height:'100%' }}
          onMouseEnter={() => { setShowHeroOverlay(true); if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current); }}
          onMouseLeave={() => { if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current); overlayHideTimerRef.current = window.setTimeout(()=>setShowHeroOverlay(false), 4000) as unknown as number; }}
          onTouchStart={(e) => { setShowHeroOverlay(true); if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current); }}
          onTouchEnd={(e) => { if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current); overlayHideTimerRef.current = window.setTimeout(()=>setShowHeroOverlay(false), 4000) as unknown as number; }}
          onClick={(e) => {
            // Tap outside the volume/mute area toggles play/pause and resets the 4s overlay timer
            const target = e.target as HTMLElement;
            if (target && (target.closest('input[type="range"]') || target.closest('button'))) return;
            const v = videoRefs.current.get(itemIdx!);
            if (!v) return;
            try {
              if (v.paused) { void v.play(); setShowPauseFlash(true); window.setTimeout(()=>setShowPauseFlash(false), 600); }
              else { v.pause(); }
            } catch {}
            setShowHeroOverlay(true);
            if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current);
            overlayHideTimerRef.current = window.setTimeout(()=>setShowHeroOverlay(false), 4000) as unknown as number;
          }}
        >
          <video
            src={asset.url}
            muted playsInline loop autoPlay preload="auto"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget as HTMLVideoElement;
              if (v.videoWidth && v.videoHeight) setNaturalAspect(v.videoWidth / v.videoHeight);
            }}
            ref={(el) => {
              if (typeof itemIdx === 'number') {
                if (el) { videoRefs.current.set(itemIdx, el); try { el.setAttribute('playsinline', ''); (el as any).setAttribute('webkit-playsinline', 'true'); } catch {} } else { videoRefs.current.delete(itemIdx); }
              }
            }}
            style={base as any}
          />
          {/* Overlay box aligned to the inner picture using wrapper CSS vars */}
          {isHero && (() => {
            const overlayBoxStyle: React.CSSProperties = { position:'absolute', left:'var(--pad-x, 0px)', top:'var(--pad-y, 0px)', width: 'var(--content-w, 100%)', height: 'var(--content-h, 100%)', pointerEvents:'none', transform:'translateZ(1px)' };
            return (
              <div style={overlayBoxStyle}>
                {/* Title with clickable description */}
                {(() => {
                  const desc = (asset as any).metadata?.description ?? (asset as any).metadata?.desc ?? '';
                  const hasDescription = desc && desc !== `${asset.title} - uploaded via Zeyoda`;
                  
                  return (
                    <div style={{ position:'absolute', left:6, bottom:12, maxWidth:'70%' }}>
                      {/* Title button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasDescription) {
                            setShowTitleDescription(!showTitleDescription);
                            setShowHeroOverlay(true);
                            if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current);
                          }
                        }}
                        style={{ 
                          display:'flex', 
                          alignItems:'center', 
                          gap:6, 
                          padding:'6px 10px', 
                          borderRadius:8, 
                          background: overlayBg, 
                          color: overlayFg, 
                          fontFamily: overlayFont, 
                          fontSize:12, 
                          lineHeight:1.2, 
                          pointerEvents: hasDescription ? 'auto' : 'none',
                          opacity:(showHeroOverlay ? 1 : 0), 
                          transition:'opacity .15s ease', 
                          whiteSpace:'nowrap', 
                          overflow:'hidden', 
                          textOverflow:'ellipsis',
                          cursor: hasDescription ? 'pointer' : 'default',
                          border: 'none'
                        }} 
                        className="carousel-media-overlay"
                      >
                        <span style={{ fontWeight:600 }}>{asset.title || 'Untitled'}</span>
                        {hasDescription && <span style={{ fontSize:10 }}>{showTitleDescription ? '▲' : '▼'}</span>}
                      </button>
                      
                      {/* Description panel */}
                      {showTitleDescription && hasDescription && (
                        <div 
                          style={{ 
                            marginTop:8, 
                            padding:'8px 12px', 
                            borderRadius:8, 
                            background: overlayBg,
                            color: overlayFg,
                            fontFamily: overlayFont,
                            fontSize:11,
                            lineHeight:1.4,
                            maxWidth:300,
                            maxHeight:200,
                            overflowY:'auto',
                            whiteSpace:'pre-wrap',
                            wordBreak:'break-word',
                            pointerEvents:'auto',
                            opacity:(showHeroOverlay ? 1 : 0),
                            transition:'opacity .15s ease'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {desc}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* Mute/Volume bottom-right with vertical slider above */}
                <div style={{ position:'absolute', right:12, bottom:12, display:'block', opacity:(showHeroOverlay ? 1 : 0), transition:'opacity .15s ease', pointerEvents:'auto' }} className="carousel-media-overlay" onMouseEnter={() => { if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current); }} onMouseLeave={() => { overlayHideTimerRef.current = window.setTimeout(()=>setShowHeroOverlay(false), 4000) as unknown as number; }}>
                  <div style={{ position:'relative', display:'inline-block' }}>
                    {showVolumeSlider && (
                      <input ref={(el)=>{volumeSliderRef.current = el}} type="range" min={0} max={1} step={0.01}
                        defaultValue={(videoRefs.current.get(itemIdx!)?.muted ? 0 : (videoRefs.current.get(itemIdx!)?.volume ?? 1))}
                        onInput={(e) => { const v = videoRefs.current.get(itemIdx!); if (!v) return; const val = Number((e.currentTarget as HTMLInputElement).value); v.volume = val; if (val > 0) { v.muted = false; lastNonZeroVolumeRef.current = val; } else { v.muted = true; } setIsHeroMuted(v.muted); }}
                        onChange={(e) => { const v = videoRefs.current.get(itemIdx!); if (!v) return; const val = Number((e.currentTarget as HTMLInputElement).value); v.volume = val; if (val > 0) { v.muted = false; lastNonZeroVolumeRef.current = val; } else { v.muted = true; } setIsHeroMuted(v.muted); if (volumeHideTimerRef.current) window.clearTimeout(volumeHideTimerRef.current); volumeHideTimerRef.current = window.setTimeout(()=>setShowVolumeSlider(false), 3000) as unknown as number; }}
                        onPointerDown={(e)=>{ e.stopPropagation(); try { (e.currentTarget as any).setPointerCapture?.(e.pointerId); } catch {}; controlOwnerRef.current = 'volume'; lockBodyScroll(); setShowHeroOverlay(true); if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current); }}
                        onPointerMove={(e)=>{ e.stopPropagation(); }}
                        onPointerUp={(e)=>{ e.stopPropagation(); try { (e.currentTarget as any).releasePointerCapture?.(e.pointerId); } catch {}; controlOwnerRef.current = null; unlockBodyScroll(); overlayHideTimerRef.current = window.setTimeout(()=>setShowHeroOverlay(false), 4000) as unknown as number; }}
                        onWheel={(e)=>{ e.stopPropagation(); e.preventDefault(); }}
                        onPointerCancel={(e)=>{ e.stopPropagation(); controlOwnerRef.current = null; unlockBodyScroll(); }}
                        onMouseDown={(e)=>{ e.stopPropagation(); controlOwnerRef.current = 'volume'; setShowHeroOverlay(true); if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current); }}
                        onMouseMove={(e)=>{ if (controlOwnerRef.current==='volume') { e.stopPropagation(); } }}
                        onMouseUp={(e)=>{ e.stopPropagation(); controlOwnerRef.current = null; overlayHideTimerRef.current = window.setTimeout(()=>setShowHeroOverlay(false), 4000) as unknown as number; }}
                        onTouchStart={(e)=>{ e.stopPropagation(); controlOwnerRef.current = 'volume'; lockBodyScroll(); setShowHeroOverlay(true); if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current); }}
                        onTouchMove={(e)=>{ e.stopPropagation(); setShowHeroOverlay(true); if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current); }}
                        onTouchEnd={(e)=>{ e.stopPropagation(); controlOwnerRef.current = null; unlockBodyScroll(); overlayHideTimerRef.current = window.setTimeout(()=>setShowHeroOverlay(false), 4000) as unknown as number; }}
                        aria-label="Volume"
                        aria-orientation="vertical"
                        style={{ position:'absolute', left:'50%', bottom:'calc(100% + 6px)', transform:'translateX(-50%) rotate(-90deg)', transformOrigin:'center bottom', width:64, height:22, background:'transparent', touchAction:'manipulation' }} />
                    )}
                    <button onClick={(e)=>{ e.stopPropagation(); const v=videoRefs.current.get(itemIdx!); if(!v) return;
                      setShowHeroOverlay(true); if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current); overlayHideTimerRef.current = window.setTimeout(()=>setShowHeroOverlay(false), 4000) as unknown as number;
                      setShowVolumeSlider(true); if (volumeHideTimerRef.current) window.clearTimeout(volumeHideTimerRef.current); volumeHideTimerRef.current = window.setTimeout(()=>setShowVolumeSlider(false), 3000) as unknown as number;
                      if (v.muted || v.volume === 0) { v.muted = false; v.volume = lastNonZeroVolumeRef.current || 1; setIsHeroMuted(false); try { if (volumeSliderRef.current) volumeSliderRef.current.value = String(v.volume); } catch {} try { void v.play(); } catch {} }
                      else { v.muted = true; setIsHeroMuted(true); try { if (volumeSliderRef.current) volumeSliderRef.current.value = '0'; } catch {} }
                    }} aria-label="Mute/Volume" style={{ background: overlayBg, border:'1px solid rgba(255,255,255,0.5)', color:overlayFg, borderRadius:8, padding:'6px 8px', fontSize:12, cursor:'pointer', height:28, lineHeight:1, display:'inline-flex', alignItems:'center' }}>{isHeroMuted ? '🔇' : '🔊'}</button>
                  </div>
                </div>
                {/* Center Play/Pause */}
                <button onClick={(e)=>{ e.stopPropagation(); const v=videoRefs.current.get(itemIdx!); if(!v) return; if(v.paused){ try{ void v.play(); setShowPauseFlash(true); if(overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current); overlayHideTimerRef.current = window.setTimeout(()=>setShowPauseFlash(false),600) as unknown as number; }catch{} } else { try{ v.pause(); }catch{} } setShowHeroOverlay(true); if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current); overlayHideTimerRef.current = window.setTimeout(()=>setShowHeroOverlay(false), 4000) as unknown as number; }} aria-label="Toggle Play"
                  style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', background:'rgba(0,0,0,0.4)', color:'#fff', border:'1px solid rgba(255,255,255,0.6)', borderRadius:40, width:64, height:64, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, cursor:'pointer', opacity:(isHeroPaused?1:(showPauseFlash?1:0)), transition:'opacity .15s ease', pointerEvents:'auto' }}> {isHeroPaused ? '▶︎' : '⏸'} </button>
                {/* Fullscreen top-right */}
                <button onClick={(e)=>{ e.stopPropagation(); const v=videoRefs.current.get(itemIdx!); const wrap = (e.currentTarget.parentElement?.parentElement as HTMLElement); if(!v||!wrap) return; try{ if (!document.fullscreenElement) { if (wrap.requestFullscreen) wrap.requestFullscreen(); else if ((wrap as any).webkitRequestFullscreen) (wrap as any).webkitRequestFullscreen(); else if ((wrap as any).msRequestFullscreen) (wrap as any).msRequestFullscreen(); else if ((v as any).webkitEnterFullscreen) (v as any).webkitEnterFullscreen(); } else { if (document.exitFullscreen) document.exitFullscreen(); else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen(); else if ((document as any).msExitFullscreen) (document as any).msExitFullscreen(); } }catch{} }} aria-label="Fullscreen"
                  style={{ position:'absolute', right:12, top:12, background:'rgba(0,0,0,0.4)', color:'#fff', border:'1px solid rgba(255,255,255,0.6)', borderRadius:8, padding:'6px 8px', fontSize:12, cursor:'pointer', opacity:(showHeroOverlay?1:0), transition:'opacity .15s ease', pointerEvents:'auto', height:28, lineHeight:1, display:'inline-flex', alignItems:'center' }} className="carousel-media-overlay">⤢</button>
              </div>
            );
          })()}
        </div>
      );
    }
    return (
      <div ref={typeof itemIdx === 'number' ? setMediaWrapRef(itemIdx) : undefined} style={{ position:'relative', width:'100%', height:'100%' }}>
        <img
          src={asset.url}
          alt={asset.title || 'Artwork'}
          loading={'eager'}
          onLoad={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (img.naturalWidth && img.naturalHeight) setNaturalAspect(img.naturalWidth / img.naturalHeight);
          }}
          ref={(el) => {
            if (typeof itemIdx === 'number') {
              if (el) imageRefs.current.set(itemIdx, el); else imageRefs.current.delete(itemIdx);
            }
          }}
          style={base as any}
        />
        {isHero && (
          <div style={{ position:'absolute', left:'var(--pad-x, 0px)', top:'calc(var(--pad-y, 0px) + var(--content-h, 100%) - 0px)', transform:'translateY(-12px)', pointerEvents:'none', transformOrigin:'left bottom' }}>
            <div
              style={{ position:'relative', left:12, bottom:12, display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:8, background: (theme?.primaryColor || 'rgba(0,0,0,0.6)'), color:(theme?.accentColor || '#ffffff'), fontFamily:(theme?.fontFamily || 'inherit'), fontSize:12, lineHeight:1.2, pointerEvents:'none', opacity:(showHeroOverlay ? 1 : 0), transition:'opacity .15s ease', maxWidth:'70%', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}
              className="carousel-media-overlay"
            >
              <span style={{ fontWeight:600 }}>{asset.title || 'Untitled'}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const containerStyle: React.CSSProperties = useMemo(() => ({
    position: 'relative',
    // Target ~50% of viewport height for the hero so name + buy fit on landing
    height: 'clamp(280px, 50vh, 720px)',
    width: 'auto',
    maxWidth: 'min(92vw, 1000px)',
    aspectRatio: String(naturalAspect || 16/9),
    margin: '0 auto 16px auto',
    // perspective moved to stage for stability
    overflow: 'visible',
    touchAction: 'none',
    overscrollBehavior: 'contain',
    zIndex: 10
  }), [naturalAspect]);

  const stageStyle: React.CSSProperties = useMemo(() => ({
    position: 'absolute', inset: 0,
    perspective: '1100px',
    perspectiveOrigin: '50% 50%',
    transformStyle: 'preserve-3d',
    transformOrigin: '50% 50% 0'
  }), []);

  return (
    <div ref={rootRef as any} aria-roledescription="carousel" aria-label="Artist content" style={containerStyle}
      onMouseEnter={(e) => { setShowHeroOverlay(true); if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current); overlayHideTimerRef.current = window.setTimeout(()=>setShowHeroOverlay(false), 4000) as unknown as number; }}
      onMouseLeave={() => { if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current); setShowHeroOverlay(false); }}
      onTouchStart={() => { setShowHeroOverlay(true); if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current); }}
      onTouchEnd={() => { if (overlayHideTimerRef.current) window.clearTimeout(overlayHideTimerRef.current); overlayHideTimerRef.current = window.setTimeout(()=>setShowHeroOverlay(false), 4000) as unknown as number; }}
    >
      <div ref={stageRef} style={stageStyle}>
      {(() => {
        const visible: number[] = [];
        const seen = new Set<number>();
        for (let j = -VISIBLE_RADIUS; j <= VISIBLE_RADIUS; j++) {
          const itemIdx = (effectiveIndex + j + count) % count;
          if (seen.has(itemIdx)) continue;
          seen.add(itemIdx);
          visible.push(itemIdx);
        }
        return visible.map((itemIdx) => {
          const item = items[itemIdx];
          const itemKey = (item as any)?.id ?? itemIdx;
          const isHeroItem = itemIdx === effectiveIndex;
          return (
              <div key={`item-${itemKey}`} ref={setItemRef(itemIdx)} style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:(isHeroItem ? 'auto' : 'none'), backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden', transformStyle:'preserve-3d' }}>
              {renderMedia(item, itemIdx)}
            </div>
          );
        });
        })()}
      </div>
      <p className="sr-only" aria-live="polite">{`Showing item ${effectiveIndex + 1} of ${Math.max(1,count)}: ${currItem?.title || 'Untitled'}`}</p>
    </div>
  );
};

export default OrbitPeekCarousel;


