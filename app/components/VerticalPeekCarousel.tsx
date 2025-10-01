"use client";

import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import type { ArtistAsset } from "../hooks/useArtistAssets";

interface SizeSpec {
  maxWidthPx?: number;
  minHeightVh?: number;
  perspectivePx?: number;
}

interface VerticalPeekCarouselProps {
  items: ArtistAsset[];
  index: number;
  onIndexChange: (i: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  size?: SizeSpec;
}

const DRAG_THRESHOLD_PX = 80; // distance to consider a full step
const SNAP_MS = 240; // snap duration

export default function VerticalPeekCarousel({
  items,
  index,
  onIndexChange,
  containerRef,
  size = { maxWidthPx: 800, minHeightVh: 60, perspectivePx: 800 },
}: VerticalPeekCarouselProps) {
  const rootRef = containerRef; // share the same ref with orbit renderer
  const trioRefs = {
    prev: useRef<HTMLDivElement>(null),
    current: useRef<HTMLDivElement>(null),
    next: useRef<HTMLDivElement>(null),
  };

  const stateRef = useRef({
    progress: 0, // -1..1 during drag
    anim: 0 as number | 0,
    dragging: false,
    startY: 0,
    lastY: 0,
    wheelAccum: 0,
    lastWheelTs: 0,
    lastWheelStepTs: 0,
  });

  const n = items.length;
  const stepAngle = Math.PI / 2; // 90° for trio illusion
  const Ry = 40; // vertical lift radius
  const Rz = 70; // depth radius

  // Featured sizing — match ArtistVideo behavior
  const [dims, setDims] = useState({ width: 0, height: 0, aspectRatio: 16 / 9, loaded: false });

  const handleMediaLoad = useCallback((el: HTMLImageElement | HTMLVideoElement | null) => {
    if (!el) return;
    let w = 0, h = 0;
    if (el instanceof HTMLImageElement) {
      w = el.naturalWidth; h = el.naturalHeight;
    } else if (el instanceof HTMLVideoElement) {
      w = el.videoWidth; h = el.videoHeight;
    }
    if (w && h) setDims({ width: w, height: h, aspectRatio: w / h, loaded: true });
    else setDims(prev => ({ ...prev, loaded: true }));
  }, []);

  const styleContainer = useMemo(() => {
    const p = size?.perspectivePx ?? 800;
    const minH = size?.minHeightVh ?? 60;
    const maxW = size?.maxWidthPx ?? 800;
    const ar = dims.loaded && dims.aspectRatio ? dims.aspectRatio : 16 / 9;

    // Mobile-first width heuristics (mirror ArtistVideo)
    let vw = "90vw"; let desktopMax = `${maxW}px`;
    if (ar > 1.5) { vw = "95vw"; desktopMax = `${Math.max(maxW, 900)}px`; }
    else if (ar < 0.8) { vw = "75vw"; desktopMax = `${Math.min(maxW, 500)}px`; }

    return {
      perspective: `${p}px`,
      minHeight: `${minH}vh`,
      width: "100%",
      maxWidth: `min(${vw}, ${desktopMax})`,
      aspectRatio: String(ar),
      touchAction: "none", // prevent page scroll while interacting
      overscrollBehavior: "contain", // stop scroll chaining to page
    } as React.CSSProperties;
  }, [size, dims]);

  // utility mappers
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const mapScale = (c: number) => 0.88 + ((c + 1) / 2) * (1.0 - 0.88); // cos -> scale

  // compute transforms for a given base angle offset by progress
  function setTrioTransforms(progress: number) {
    const set = (el: HTMLDivElement | null, baseAngle: number, isPeekTop: boolean) => {
      if (!el) return;
      const θ = baseAngle + progress * stepAngle;
      const c = Math.cos(θ);
      const s = Math.sin(θ);
      const liftY = Ry * s;
      const depthZ = Rz * c;
      const scale = mapScale(c);
      const rotateX = isPeekTop ? 6 : -6;
      el.style.transform = `translateY(${liftY}px) translateZ(${depthZ}px) scale(${scale}) rotateX(${rotateX}deg)`;
      el.style.opacity = isPeekTop || !isPeekTop ? (Math.abs(baseAngle) > 0 ? "0.55" : "1") : "1";
    };

    set(trioRefs.prev.current, +stepAngle, true); // above/behind
    set(trioRefs.current.current, 0, false); // front
    set(trioRefs.next.current, -stepAngle, false); // below/behind
  }

  // rAF renderer
  useEffect(() => {
    let rafId = 0;
    const render = () => {
      setTrioTransforms(stateRef.current.progress);
      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // touch handlers
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      e.preventDefault();
      stateRef.current.dragging = true;
      stateRef.current.startY = e.touches[0].clientY;
      stateRef.current.lastY = stateRef.current.startY;
    };
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!stateRef.current.dragging) return;
      const y = e.touches[0].clientY;
      const dy = y - stateRef.current.startY; // positive when dragging down
      const progress = clamp(dy / DRAG_THRESHOLD_PX, -1.2, 1.2);
      stateRef.current.progress = progress;
      stateRef.current.lastY = y;
    };
    const onEnd = () => {
      if (!stateRef.current.dragging) return;
      const p = stateRef.current.progress;
      stateRef.current.dragging = false;
      if (Math.abs(p) >= 0.33) {
        // Natural mapping: drag down (p>0) -> next (+1)
        const dir = p > 0 ? 1 : -1;
        onIndexChange((index + dir + n) % n);
      }
      // snap progress back to 0 smoothly
      const start = stateRef.current.progress;
      const startTs = performance.now();
      const animate = (t: number) => {
        const k = clamp((t - startTs) / SNAP_MS, 0, 1);
        const eased = 1 - Math.pow(1 - k, 3); // easeOutCubic
        stateRef.current.progress = start * (1 - eased);
        if (k < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    };

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart as any);
      el.removeEventListener("touchmove", onMove as any);
      el.removeEventListener("touchend", onEnd as any);
      el.removeEventListener("touchcancel", onEnd as any);
    };
  }, [index, n, onIndexChange, rootRef]);

  // wheel handling (always attached to the container)
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const wheelHandler = (e: WheelEvent) => {
        e.preventDefault();
        const now = performance.now();
        stateRef.current.lastWheelTs = now;
        const COOLDOWN = 300; // one step per gesture
        const inc = clamp(e.deltaY / 200, -0.75, 0.75);
        // If in cooldown, gently ignore frequent events
        if (now - stateRef.current.lastWheelStepTs < COOLDOWN) {
          // still allow visual nudge
          stateRef.current.progress = clamp(stateRef.current.progress + inc * 0.2, -1.2, 1.2);
          return;
        }
        // Accumulate and decide step
        const nextProgress = clamp(stateRef.current.progress + inc, -1.2, 1.2);
        if (Math.abs(nextProgress) >= 0.33) {
        // Natural mapping: wheel down (nextProgress>0) -> next (+1)
          const dir = nextProgress > 0 ? 1 : -1;
          onIndexChange((index + dir + n) % n);
          stateRef.current.lastWheelStepTs = now;
          // snap back visually
          const start = nextProgress;
          const startTs = performance.now();
          const animate = (t: number) => {
            const k = clamp((t - startTs) / SNAP_MS, 0, 1);
            const eased = 1 - Math.pow(1 - k, 3);
            stateRef.current.progress = start * (1 - eased);
            if (k < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        } else {
          stateRef.current.progress = nextProgress;
          // schedule soft snap if user stops
          clearTimeout((stateRef.current as any).wheelTimeout);
          (stateRef.current as any).wheelTimeout = setTimeout(() => {
            const start = stateRef.current.progress;
            const startTs = performance.now();
            const animate = (t: number) => {
              const k = clamp((t - startTs) / SNAP_MS, 0, 1);
              const eased = 1 - Math.pow(1 - k, 3);
              stateRef.current.progress = start * (1 - eased);
              if (k < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
          }, 300);
        }
    };

    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => {
      el.removeEventListener("wheel", wheelHandler);
    };
  }, [index, n, onIndexChange, rootRef]);

  // mouse drag support (desktop)
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      stateRef.current.dragging = true;
      stateRef.current.startY = e.clientY;
      stateRef.current.lastY = e.clientY;
      window.addEventListener("mousemove", onMouseMove, { passive: false });
      window.addEventListener("mouseup", onMouseUp, { passive: false });
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!stateRef.current.dragging) return;
      e.preventDefault();
      const dy = e.clientY - stateRef.current.startY; // positive when dragging down
      stateRef.current.progress = clamp(dy / DRAG_THRESHOLD_PX, -1.2, 1.2);
      stateRef.current.lastY = e.clientY;
    };
    const onMouseUp = (_e: MouseEvent) => {
      if (!stateRef.current.dragging) return;
      stateRef.current.dragging = false;
      const p = stateRef.current.progress;
      if (Math.abs(p) >= 0.33) {
        const dir = p > 0 ? 1 : -1;
        onIndexChange((index + dir + n) % n);
      }
      const start = stateRef.current.progress;
      const startTs = performance.now();
      const animate = (t: number) => {
        const k = clamp((t - startTs) / SNAP_MS, 0, 1);
        const eased = 1 - Math.pow(1 - k, 3);
        stateRef.current.progress = start * (1 - eased);
        if (k < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
      window.removeEventListener("mousemove", onMouseMove as any);
      window.removeEventListener("mouseup", onMouseUp as any);
    };

    el.addEventListener("mousedown", onMouseDown, { passive: false });
    return () => {
      el.removeEventListener("mousedown", onMouseDown as any);
      window.removeEventListener("mousemove", onMouseMove as any);
      window.removeEventListener("mouseup", onMouseUp as any);
    };
  }, [index, n, onIndexChange, rootRef]);

  // compute trio indices
  const prevIndex = (index - 1 + n) % n;
  const nextIndex = (index + 1) % n;
  const prev = items[prevIndex];
  const curr = items[index];
  const next = items[nextIndex];

  return (
    <div
      ref={rootRef}
      className="relative mx-auto overflow-hidden rounded-xl shadow-2xl shadow-black/50"
      style={styleContainer}
      role="region"
      aria-roledescription="carousel"
      aria-label={`Artist assets carousel, ${n} items`}
    >
      {/* prev */}
      <div
        ref={trioRefs.prev}
        className="absolute inset-0 z-10"
        style={{ willChange: "transform, opacity", opacity: 0.55, transformOrigin: "center bottom" }}
        aria-hidden="true"
      >
        {prev.type === "video" ? (
          <video src={prev.url} muted loop playsInline className="w-full h-full object-cover" />
        ) : (
          <img src={prev.url} className="w-full h-full object-cover" loading="eager" />
        )}
      </div>

      {/* current */}
      <div
        ref={trioRefs.current}
        className="absolute inset-0 z-20"
        style={{ willChange: "transform, opacity" }}
      >
        {curr.type === "video" ? (
          <video
            src={curr.url}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
            onLoadedMetadata={(e) => handleMediaLoad(e.currentTarget)}
          />
        ) : (
          <img
            src={curr.url}
            className="w-full h-full object-cover"
            onLoad={(e) => handleMediaLoad(e.currentTarget)}
          />
        )}
      </div>

      {/* next */}
      <div
        ref={trioRefs.next}
        className="absolute inset-0 z-10"
        style={{ willChange: "transform, opacity", opacity: 0.55, transformOrigin: "center top" }}
        aria-hidden="true"
      >
        {next.type === "video" ? (
          <video src={next.url} muted loop playsInline className="w-full h-full object-cover" />
        ) : (
          <img src={next.url} className="w-full h-full object-cover" loading="eager" />
        )}
      </div>

      {/* live region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Showing asset {index + 1} of {n}: {curr.title || "Untitled"}
      </div>
    </div>
  );
}



