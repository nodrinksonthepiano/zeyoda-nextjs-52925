/**
 * Viewport-aware hero dimensions for onboarding/upload-asset modes.
 * Width algorithm aligned with OrbitPeekCarousel computeFitBox (sidePad = 4% vw).
 */

export type HeroFitBoxOptions = {
  /** When true, cap height on narrow viewports (onboarding mobile). */
  mobileHeightCap?: boolean;
};

export function computeHeroFitBox(
  aspectRatio: number,
  opts: HeroFitBoxOptions = { mobileHeightCap: true },
): { w: number; h: number } {
  if (typeof window === 'undefined') {
    return { w: 320, h: 180 };
  }

  const vv = window.visualViewport;
  const vw = Math.max(320, Math.round(vv?.width || window.innerWidth || 0));
  const vh = Math.max(320, Math.round(vv?.height || window.innerHeight || 0));
  const r = Math.max(0.2, Math.min(5, aspectRatio || 16 / 9));

  const targetW = Math.min(Math.round(0.5 * vw), Math.round(0.5 * vh * r));
  const targetH = Math.round(targetW / r);
  const clampedW = Math.max(280, Math.min(1000, targetW));
  const clampedH = Math.max(180, Math.min(Math.round(1000 / r), targetH));

  const sidePad = Math.round(vw * 0.04);
  let w = Math.min(clampedW, vw - sidePad * 2);
  let h = Math.min(clampedH, Math.round(w / r));

  if (opts.mobileHeightCap !== false && vw <= 640) {
    const maxH = Math.round(Math.min(320, Math.max(160, 0.28 * vh)));
    if (h > maxH) {
      h = maxH;
      w = Math.min(w, Math.round(h * r));
    }
  }

  return { w, h };
}
