"use client";
import React, { useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { ArtistConfig, RenderableToken } from '../../types/artist-types';
import { OrbitToken } from '../hooks/useOrbitTokens';

export type SupplementalDraftOrbitToken = {
  coinPublicId: string;
  label: string;
  /** From draft_payload.theme — chip uses draft artist branding, not host page. */
  theme?: {
    primaryColor: string;
    accentColor: string;
    fontFamily: string;
  } | null;
};

type OrbitSlotToken = RenderableToken & {
  draftCoinPublicId?: string;
  chipLabel?: string;
  draftChipTheme?: {
    primaryColor: string;
    accentColor: string;
    fontFamily: string;
  };
};

interface ThemeOrbitRendererProps {
  artistConfig: ArtistConfig | null;
  orbitTokens: OrbitToken[];
  videoContainerRef: React.RefObject<HTMLDivElement | null>;
  isOrbitAnimationPaused: React.MutableRefObject<boolean>;
  allArtistsConfig: { [key: string]: ArtistConfig } | null;
  /** Workshop draft chips — click only; never artist navigation. */
  supplementalDraftOrbitTokens?: SupplementalDraftOrbitToken[];
  onSupplementalDraftClick?: (coinPublicId: string) => void;
  /** When true, `artistConfig.orbitalTokens` are omitted (draft-only workshop ring). */
  omitArtistOrbitalTokens?: boolean;
  /** Tighter ring for small heroes (e.g. workshop). Default 1. */
  orbitRadiusScale?: number;
  /** When true, only `.orbit-token` elements receive pointer events (workshop drop zone stays clickable). */
  orbitPointerEventsOnTokensOnly?: boolean;
}

const ORBIT_SPEED = 0.3; // natural radians/sec
// Interaction tuning (radians and seconds)
const WHEEL_SENS = 0.0016;      // rad per wheel deltaY unit
const DRAG_SENS = 0.008;        // rad per px (approx)
const FRICTION = 1.8;           // 1/s velocity decay
const V_EPS = 0.003;            // rad/s threshold to stop inertia
/** px — movement below this counts as tap (draft chips); matches token drag threshold (6²). */
const TAP_MOVE_THRESHOLD_SQ = 36;

const ThemeOrbitRenderer: React.FC<ThemeOrbitRendererProps> = ({
  artistConfig,
  orbitTokens,
  videoContainerRef,
  isOrbitAnimationPaused,
  allArtistsConfig,
  supplementalDraftOrbitTokens,
  onSupplementalDraftClick,
  omitArtistOrbitalTokens = false,
  orbitRadiusScale = 1,
  orbitPointerEventsOnTokensOnly = false,
}) => {
  const tokenElementRefs = useRef<(HTMLElement | null)[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const [orbitAngleOffset, setOrbitAngleOffset] = React.useState(0);
  // CRITICAL: Preview config for live coin color updates during editing
  // This is set via event from ProfileEditPanel and cleared when artistConfig changes
  const [previewConfig, setPreviewConfig] = React.useState<ArtistConfig | null>(null);
  const naturalOffsetRef = useRef(0);      // natural orbit offset (radians)
  const userOffsetRef = useRef(0);         // user-imposed offset (radians)
  const userVelocityRef = useRef(0);       // user angular velocity (radians/sec)
  const lastTsRef = useRef(0);
  const isInteractingRef = useRef(false);
  const dragStartXYRef = useRef<{x:number;y:number}|null>(null);
  const orbitContainerRef = useRef<HTMLDivElement | null>(null);
  const lastEventTsRef = useRef<number>(0);
  const centerRef = useRef<{cx:number; cy:number}>({ cx: 0, cy: 0 });
  const lastAngleRef = useRef<number | null>(null);
  const suppressClickRef = useRef<boolean>(false);
  const isHoveringRef = useRef<boolean>(false);
  const activePointerIdRef = useRef<number | null>(null);
  const downXYRef = useRef<{x:number;y:number}|null>(null);
  const draggingTokenRef = useRef<boolean>(false);
  const downTsRef = useRef<number>(0);
  const hoverPauseTimerRef = useRef<number | null>(null);
  const heroDimensionsRef = useRef<{w: number, h: number} | null>(null);

  // CRITICAL: Listen for preview config events from ProfileEditPanel for live coin updates
  useEffect(() => {
    const handlePreview = (e: Event) => {
      const customEvent = e as CustomEvent<{ previewConfig: ArtistConfig }>;
      if (customEvent.detail?.previewConfig) {
        setPreviewConfig(customEvent.detail.previewConfig);
      }
    };
    
    const handleClear = () => {
      setPreviewConfig(null);
    };
    
    window.addEventListener('artistConfigPreview', handlePreview as EventListener);
    window.addEventListener('artistConfigPreviewClear', handleClear);
    return () => {
      window.removeEventListener('artistConfigPreview', handlePreview as EventListener);
      window.removeEventListener('artistConfigPreviewClear', handleClear);
    };
  }, []);

  // CRITICAL: Clear preview config when artistConfig changes significantly (after save or artist switch)
  // This ensures we don't use stale preview data
  useEffect(() => {
    // Clear preview when artistConfig id/name changes (indicates artist switched)
    // Note: Save completion is handled by artistConfigPreviewClear event
    setPreviewConfig(null);
  }, [artistConfig?.id, artistConfig?.name]);

  const orbitSlotTokens = useMemo((): OrbitSlotToken[] => {
    if (!artistConfig) return [];
    const fromConfig = omitArtistOrbitalTokens ? [] : (artistConfig.orbitalTokens || []);
    const fromOrbit = orbitTokens.map((token) => ({
      name: token.displayName,
      angle: 0,
      artistId: token.artistId,
    }));
    const merged: OrbitSlotToken[] = [...fromConfig, ...fromOrbit].filter(
      (token, index, self) => token.name && self.findIndex((t) => t.name === token.name) === index,
    );
    const supplementalSlots: OrbitSlotToken[] = (supplementalDraftOrbitTokens ?? []).map((d) => ({
      name: d.coinPublicId,
      angle: 0,
      artistId: artistConfig.name,
      draftCoinPublicId: d.coinPublicId,
      chipLabel: d.label,
      draftChipTheme: d.theme ?? undefined,
    }));
    return [...merged, ...supplementalSlots];
  }, [artistConfig, orbitTokens, supplementalDraftOrbitTokens, omitArtistOrbitalTokens]);

  useEffect(() => {
    const videoElement = videoContainerRef.current;
    if (!artistConfig || !videoElement) {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
        return;
    }

    const combinedTokens = orbitSlotTokens;

    // Distribute angles evenly across all tokens with offset
    const allTokens = combinedTokens.map((token, index) => ({
      ...token,
      angle: ((index + 0.5) * 360) / (combinedTokens.length || 1) // Even distribution with offset
    }));

    // one-off position write to avoid starting at center before RAF begins
    const positionOnce = () => {
      let contentWidth, contentHeight, rect;
      
      // Priority 1: Use stable hero dimensions from hero:pinned event
      if (heroDimensionsRef.current && videoElement) {
        contentWidth = heroDimensionsRef.current.w;
        contentHeight = heroDimensionsRef.current.h;
        rect = videoElement.getBoundingClientRect();
        centerRef.current = { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
      } 
      // Priority 2: Measure the video element directly
      else if (videoElement) {
        contentWidth = videoElement.offsetWidth;
        contentHeight = videoElement.offsetHeight;
        rect = videoElement.getBoundingClientRect();
        
        const isContentReady = contentWidth > 50 && contentHeight > 50 && rect && rect.width > 50;
        
        if (!isContentReady) {
          // Fallback to viewport-based dimensions only if measurements invalid
          contentWidth = Math.min(window.innerWidth * 0.7, 700);
          contentHeight = contentWidth * (9 / 16);
          centerRef.current = { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
        } else {
          centerRef.current = { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
        }
      }
      // Priority 3: Viewport fallback when nothing else available
      else {
        contentWidth = Math.min(window.innerWidth * 0.7, 700);
        contentHeight = contentWidth * (9 / 16);
        centerRef.current = { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
      }

      const scale = orbitRadiusScale;
      const radiusX = ((contentWidth / 2) + 60) * scale;
      const radiusY = ((contentHeight / 2) + 40) * scale;
      const currentGlobalAngleOffset = naturalOffsetRef.current + userOffsetRef.current;
      
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
    };

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

      // natural orbit advances when not paused
      if (!isOrbitAnimationPaused.current && !isInteractingRef.current) {
        naturalOffsetRef.current += ORBIT_SPEED * deltaTime;
      }
      // inertia for user offset (no spring-to-zero; fold-in when stopped)
      if (!isInteractingRef.current) {
        if (Math.abs(userVelocityRef.current) > V_EPS) {
          userOffsetRef.current += userVelocityRef.current * deltaTime;
          userVelocityRef.current *= Math.max(0, 1 - FRICTION * deltaTime);
        } else if (Math.abs(userOffsetRef.current) > 0.0005) {
          naturalOffsetRef.current += userOffsetRef.current; // fold into natural
          userOffsetRef.current = 0;
          userVelocityRef.current = 0;
        }
      }

      positionOnce();

      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    // Seed initial positions immediately, then start RAF
    positionOnce();
    animationFrameIdRef.current = requestAnimationFrame(animate);

    // Listen to hero:pinned for stable carousel dimensions
    const onHeroPinned = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { w, h } = customEvent.detail || {};
      if (w && h) {
        heroDimensionsRef.current = { w, h };
        // Update positions immediately with new stable dimensions
        positionOnce();
      }
    };
    window.addEventListener('hero:pinned', onHeroPinned);

    // Auto-resume when carousel reports stability (pin complete or snap complete)
    const onStable = () => {
      // ensure not paused and positions valid
      isOrbitAnimationPaused.current = false;
      positionOnce();
      if (animationFrameIdRef.current === null) {
        animationFrameIdRef.current = requestAnimationFrame(animate);
      }
    };
    window.addEventListener('carousel:stable', onStable);

    // Interaction: wheel / pointer / touch
    const container = orbitContainerRef.current;
    if (container) {
      const onWheel = (e: WheelEvent) => {
        // Respond to wheel only while hovering a token or dragging
        if (!isInteractingRef.current && !isHoveringRef.current) return;
        e.preventDefault(); e.stopPropagation();
        const now = timestampNow();
        const dt = Math.max(0.008, Math.min(0.08, (now - (lastEventTsRef.current || now)) * 0.001));
        // Tangent-aware mapping: vertical wheel should rotate according to which side of the orbit you're on
        let sideSign = 1; // right side default
        const targetEl = (e.target as Element)?.closest?.('.orbit-token') as HTMLElement | null;
        if (targetEl) {
          try {
            const tr = targetEl.getBoundingClientRect();
            const tcx = tr.left + tr.width / 2;
            sideSign = (tcx >= centerRef.current.cx) ? 1 : -1;
          } catch {}
        }
        // User preference: make scroll up rotate in the same visual sense as drag on that side
        const d = (-e.deltaY) * WHEEL_SENS * sideSign;
        userOffsetRef.current += d;
        const instV = d / dt;
        userVelocityRef.current = 0.6 * userVelocityRef.current + 0.4 * instV;
        lastEventTsRef.current = now;
      };
      const timestampNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const isDraftCoinTarget = (target: Element | null) =>
        Boolean(target?.closest?.('[data-draft-coin]'));
      const onPointerDown = (e: PointerEvent) => {
        // Only start interaction if a token is grabbed
        const target = e.target as Element;
        if (!target.closest('.orbit-token')) return;
        // Draft chips handle tap vs drag on the button; skip container suppress path
        if (isDraftCoinTarget(target)) return;
        try { orbitContainerRef.current?.setPointerCapture?.(e.pointerId); } catch {}
        isInteractingRef.current = true;
        dragStartXYRef.current = { x: e.clientX, y: e.clientY };
        lastEventTsRef.current = timestampNow();
        // seed last angle for polar delta tracking
        const { cx, cy } = centerRef.current;
        lastAngleRef.current = Math.atan2(e.clientY - cy, e.clientX - cx);
        suppressClickRef.current = true;
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!isInteractingRef.current || !dragStartXYRef.current) return;
        e.preventDefault(); e.stopPropagation();
        const now = timestampNow();
        const { cx, cy } = centerRef.current;
        const ang = Math.atan2(e.clientY - cy, e.clientX - cx);
        if (lastAngleRef.current === null) lastAngleRef.current = ang;
        // normalize to [-pi, pi]
        let deltaAng = ang - lastAngleRef.current;
        if (deltaAng > Math.PI) deltaAng -= 2*Math.PI; else if (deltaAng < -Math.PI) deltaAng += 2*Math.PI;
        const dt = Math.max(0.008, Math.min(0.08, (now - (lastEventTsRef.current || now)) * 0.001));
        // Reverse mapping per user preference
        userOffsetRef.current += deltaAng;
        const instV = deltaAng / dt;
        userVelocityRef.current = 0.6 * userVelocityRef.current + 0.4 * instV;
        dragStartXYRef.current = { x: e.clientX, y: e.clientY };
        lastAngleRef.current = ang;
        lastEventTsRef.current = now;
      };
      const onPointerUp = (e: PointerEvent) => {
        isInteractingRef.current = false;
        dragStartXYRef.current = null;
        try { orbitContainerRef.current?.releasePointerCapture?.(e.pointerId); } catch {}
        lastAngleRef.current = null;
        // release click suppression shortly after
        setTimeout(() => { suppressClickRef.current = false; }, 30);
      };
      const onTouchStart = (e: TouchEvent) => {
        const target = e.target as Element;
        if (!target.closest('.orbit-token')) return;
        if (isDraftCoinTarget(target)) return;
        isInteractingRef.current = true;
        const t = e.touches[0];
        dragStartXYRef.current = { x: t.clientX, y: t.clientY };
        lastEventTsRef.current = timestampNow();
        const { cx, cy } = centerRef.current;
        lastAngleRef.current = Math.atan2(t.clientY - cy, t.clientX - cx);
        suppressClickRef.current = true;
      };
      const onTouchMove = (e: TouchEvent) => {
        if (!isInteractingRef.current || !dragStartXYRef.current) return;
        e.preventDefault(); e.stopPropagation();
        const t = e.touches[0];
        const now = timestampNow();
        const { cx, cy } = centerRef.current;
        const ang = Math.atan2(t.clientY - cy, t.clientX - cx);
        if (lastAngleRef.current === null) lastAngleRef.current = ang;
        let deltaAng = ang - lastAngleRef.current;
        if (deltaAng > Math.PI) deltaAng -= 2*Math.PI; else if (deltaAng < -Math.PI) deltaAng += 2*Math.PI;
        const dt = Math.max(0.008, Math.min(0.08, (now - (lastEventTsRef.current || now)) * 0.001));
        userOffsetRef.current += deltaAng;
        const instV = deltaAng / dt;
        userVelocityRef.current = 0.6 * userVelocityRef.current + 0.4 * instV;
        dragStartXYRef.current = { x: t.clientX, y: t.clientY };
        lastAngleRef.current = ang;
        lastEventTsRef.current = now;
      };
      const onTouchEnd = () => {
        isInteractingRef.current = false;
        dragStartXYRef.current = null;
        lastAngleRef.current = null;
        setTimeout(() => { suppressClickRef.current = false; }, 30);
      };

      container.addEventListener('wheel', onWheel, { passive: false });
      container.addEventListener('pointerdown', onPointerDown as any, { passive: false } as any);
      container.addEventListener('pointermove', onPointerMove as any, { passive: false } as any);
      container.addEventListener('pointerup', onPointerUp as any);
      const onPointerEnter = () => { isHoveringRef.current = true; };
      const onPointerLeave = () => { isHoveringRef.current = false; };
      container.addEventListener('pointerenter', onPointerEnter);
      container.addEventListener('pointerleave', onPointerLeave);
      container.addEventListener('touchstart', onTouchStart as any, { passive: false } as any);
      container.addEventListener('touchmove', onTouchMove as any, { passive: false } as any);
      container.addEventListener('touchend', onTouchEnd as any);
      // prevent accidental navigation clicks immediately after drag
      const onClickCapture = (e: MouseEvent) => {
        if (isDraftCoinTarget(e.target as Element)) return;
        if (suppressClickRef.current) { e.preventDefault(); e.stopPropagation(); }
      };
      container.addEventListener('click', onClickCapture, true);

      // track lastTs for velocity estimation
      const markTs = () => { lastTsRef.current = timestampNow(); animationFrameIdRef.current = requestAnimationFrame(markTs); };
      if (animationFrameIdRef.current === null) animationFrameIdRef.current = requestAnimationFrame(markTs);

      // cleanup listeners
      const cleanup = () => {
        container.removeEventListener('wheel', onWheel as any);
        container.removeEventListener('pointerdown', onPointerDown as any);
        container.removeEventListener('pointermove', onPointerMove as any);
        container.removeEventListener('pointerup', onPointerUp as any);
        container.removeEventListener('pointerenter', onPointerEnter);
        container.removeEventListener('pointerleave', onPointerLeave);
        container.removeEventListener('touchstart', onTouchStart as any);
        container.removeEventListener('touchmove', onTouchMove as any);
        container.removeEventListener('touchend', onTouchEnd as any);
        container.removeEventListener('click', onClickCapture, true);
      };
      // ensure we run cleanup on return
      (onStable as any).cleanup = cleanup;
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('zeyodaOrbitAngleOffset', String(naturalOffsetRef.current));
      }
      window.removeEventListener('hero:pinned', onHeroPinned);
      window.removeEventListener('carousel:stable', onStable);
      try { (onStable as any).cleanup?.(); } catch {}
    };
  }, [artistConfig, orbitSlotTokens, orbitAngleOffset, isOrbitAnimationPaused, videoContainerRef, orbitRadiusScale]);

  if (!artistConfig) return null;

  return (
    <div
      className="orbit-theme"
      style={orbitPointerEventsOnTokensOnly ? { pointerEvents: 'none' } : undefined}
    >
      <div 
        className="orbital-tokens"
        ref={orbitContainerRef}
        onMouseEnter={() => { /* pause handled on token hover */ }}
        onMouseLeave={() => { if (!isInteractingRef.current) isOrbitAnimationPaused.current = false; }}
        style={{
          touchAction: 'none',
          overscrollBehavior: 'contain' as any,
          ...(orbitPointerEventsOnTokensOnly ? { pointerEvents: 'none' } : {}),
        }}
      >
        {orbitSlotTokens.map((token, index) => {
            const isDraftChip = Boolean(token.draftCoinPublicId && onSupplementalDraftClick);
            const chipText = token.chipLabel ?? token.name;
            // CRITICAL: Merged lookup for live coin color updates
            // During editing: uses previewConfig (from ProfileEditPanel event) for immediate updates
            // After save: uses artistConfig (updated state) for persistence
            // Other artists: uses allArtistsConfig (from hook, updates on refresh)
            const getTokenTheme = (artistId: string | undefined) => {
              if (!artistId) return undefined;
              const aid = artistId.toLowerCase();
              
              // Check if this token belongs to the current artist being edited
              const currentArtistId = artistConfig?.id?.toLowerCase() || artistConfig?.name?.toLowerCase();
              if (currentArtistId === aid) {
                // Current artist: use previewConfig during editing (live), fallback to artistConfig after save
                return previewConfig?.theme || artistConfig?.theme;
              }
              
              // Other artists: use allArtistsConfig (from hook, updates on refresh)
              return allArtistsConfig?.[aid]?.theme;
            };

            const isDraftOrbitChip = Boolean(token.draftCoinPublicId);
            const tokenTheme = isDraftOrbitChip
              ? token.draftChipTheme
                ? {
                    primaryColor: token.draftChipTheme.primaryColor,
                    accentColor: token.draftChipTheme.accentColor,
                    fontFamily: token.draftChipTheme.fontFamily,
                  }
                : undefined
              : getTokenTheme(token.artistId);
            const bg = tokenTheme?.primaryColor || '#0a1230';
            const fg = tokenTheme?.accentColor || '#1e5cff';
            const ff = tokenTheme?.fontFamily || 'Bungee, cursive';

            const commonStyle: React.CSSProperties = {
              willChange: 'transform, opacity',
              opacity: 1,
              transform: 'var(--orbit-pos, translate(-50%, -50%))',
              background: bg,
              color: fg,
              border: `2px solid ${fg}`,
              fontFamily: ff,
              cursor: 'grab',
              ...(orbitPointerEventsOnTokensOnly ? { pointerEvents: 'auto' as const } : {}),
            };

            const commonHandlers = {
              onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.setAttribute('data-hovered', 'true'); isHoveringRef.current = true; if (hoverPauseTimerRef.current) window.clearTimeout(hoverPauseTimerRef.current); isOrbitAnimationPaused.current = true; },
              onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.setAttribute('data-hovered', 'false'); isHoveringRef.current = false; if (hoverPauseTimerRef.current) window.clearTimeout(hoverPauseTimerRef.current); hoverPauseTimerRef.current = window.setTimeout(()=>{ if (!isInteractingRef.current) isOrbitAnimationPaused.current = false; }, 200) as unknown as number; },
              onDragStart: (e: React.DragEvent<HTMLElement>) => { e.preventDefault(); },
              onPointerDown: (e: React.PointerEvent<HTMLElement>)=>{ try { (e.currentTarget as any).setPointerCapture?.(e.pointerId); } catch {}; activePointerIdRef.current = e.pointerId; isInteractingRef.current = true; draggingTokenRef.current = false; downXYRef.current = { x: e.clientX, y: e.clientY }; downTsRef.current = (typeof performance!=='undefined'?performance.now():Date.now()); const { cx, cy } = centerRef.current; lastAngleRef.current = Math.atan2(e.clientY - cy, e.clientX - cx); suppressClickRef.current = false; (e.currentTarget.style as any).cursor = 'grabbing'; },
              onPointerMove: (e: React.PointerEvent<HTMLElement>)=>{ if (activePointerIdRef.current !== e.pointerId || lastAngleRef.current===null) return; const dx = e.clientX - (downXYRef.current?.x||e.clientX); const dy = e.clientY - (downXYRef.current?.y||e.clientY); if (!draggingTokenRef.current && (dx*dx+dy*dy) > 36) { draggingTokenRef.current = true; suppressClickRef.current = true; } const now = (typeof performance!=='undefined'?performance.now():Date.now()); const dt = Math.max(8, Math.min(80, now - (lastEventTsRef.current||now))) * 0.001; const { cx, cy } = centerRef.current; const ang = Math.atan2(e.clientY - cy, e.clientX - cx); let d = ang - (lastAngleRef.current||ang); if (d > Math.PI) d -= 2*Math.PI; else if (d < -Math.PI) d += 2*Math.PI; userOffsetRef.current += d; userVelocityRef.current = 0.6*userVelocityRef.current + 0.4 * (d/dt); lastAngleRef.current = ang; lastEventTsRef.current = now; },
              onPointerUp: (e: React.PointerEvent<HTMLElement>)=>{ if (activePointerIdRef.current !== null) { try { (e.currentTarget as any).releasePointerCapture?.(activePointerIdRef.current); } catch {} } activePointerIdRef.current = null; isInteractingRef.current = false; draggingTokenRef.current = false; lastAngleRef.current = null; (e.currentTarget.style as any).cursor = 'grab'; if (hoverPauseTimerRef.current) window.clearTimeout(hoverPauseTimerRef.current); hoverPauseTimerRef.current = window.setTimeout(()=>{ isOrbitAnimationPaused.current = false; }, 120) as unknown as number; setTimeout(()=>{ suppressClickRef.current = false; }, 30); },
              onClickCapture: (e: React.MouseEvent<HTMLElement>)=>{ if (suppressClickRef.current) { e.preventDefault(); e.stopPropagation(); } },
            };

            if (isDraftChip) {
              const draftCoinId = token.draftCoinPublicId!;
              return (
                <button
                  type="button"
                  key={`orbit-draft-${draftCoinId}-${index}`}
                  className="orbit-token"
                  data-draft-coin={draftCoinId}
                  ref={(el: HTMLElement | null) => {
                    tokenElementRefs.current[index] = el;
                  }}
                  style={{
                    ...commonStyle,
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    margin: 0,
                    touchAction: 'manipulation',
                  }}
                  draggable={false}
                  onMouseEnter={commonHandlers.onMouseEnter}
                  onMouseLeave={commonHandlers.onMouseLeave}
                  onDragStart={commonHandlers.onDragStart}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    commonHandlers.onPointerDown(e);
                  }}
                  onPointerMove={commonHandlers.onPointerMove}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    const wasDrag = draggingTokenRef.current;
                    const down = downXYRef.current;
                    commonHandlers.onPointerUp(e);
                    if (wasDrag || !down) return;
                    const dx = e.clientX - down.x;
                    const dy = e.clientY - down.y;
                    if (dx * dx + dy * dy <= TAP_MOVE_THRESHOLD_SQ) {
                      onSupplementalDraftClick!(draftCoinId);
                    }
                  }}
                  title={`Load draft ${chipText}`}
                >
                  {chipText}
                </button>
              );
            }

            return (
              <Link 
                key={`orbit-${token.name}-${token.artistId || 'standalone'}-${index}`}
                href={`/?artist=${token.artistId?.toLowerCase()}`}
                className="orbit-token"
                data-artist-id={token.artistId?.toLowerCase()}
                ref={(el: HTMLElement | null) => {
                  tokenElementRefs.current[index] = el;
                }}
                style={commonStyle}
                onMouseEnter={commonHandlers.onMouseEnter}
                onMouseLeave={commonHandlers.onMouseLeave}
                onDragStart={commonHandlers.onDragStart}
                draggable={false}
                onPointerDown={commonHandlers.onPointerDown}
                onPointerMove={commonHandlers.onPointerMove}
                onPointerUp={commonHandlers.onPointerUp}
                onClickCapture={commonHandlers.onClickCapture}
                title={token.artistId ? `Explore ${allArtistsConfig?.[token.artistId]?.displayName || token.name}` : token.name}
              >
                {token.name}
              </Link>
            );
          })}
      </div>
    </div>
  );
};

export default ThemeOrbitRenderer; 