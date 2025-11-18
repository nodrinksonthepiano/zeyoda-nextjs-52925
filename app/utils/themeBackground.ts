import { ArtistConfig } from '../../types/artist-types';

/**
 * Applies background with strict precedence:
 * 1) background_image_url (if background_use_image is true)
 * 2) logo_url (if logo_use_background is true)
 * 3) primaryColor (fallback)
 * 
 * Adds a cache-buster to applied *style* only (not stored), to avoid stale mobile caching.
 * No timers, no refs, no appMode checks.
 */
export function applyArtistBackground(config: ArtistConfig | null) {
  if (!config) {
    console.warn('[applyArtistBackground] No config provided');
    return;
  }

  // Use fallback theme if missing (don't early return)
  const t = config.theme || {
    primaryColor: document.documentElement.style.getPropertyValue('--primary-color') || '#000000',
    accentColor: document.documentElement.style.getPropertyValue('--accent-color') || '#4073ff',
    gradientStart: '#ffffff',
    gradientMiddle: '#cccccc',
    gradientEnd: '#999999',
    fontFamily: 'Geist Sans, sans-serif'
  };
  
  const primary = t.primaryColor || "#000000";

  // Always keep core theme variables current
  document.documentElement.style.setProperty("--primary-color", primary);

  if (t.accentColor) {
    document.documentElement.style.setProperty("--accent-color", t.accentColor);
    document.documentElement.style.setProperty(
      "--accent-color-rgb",
      t.accentColor.match(/\d+/g)?.join(", ") ?? "0,0,0"
    );
  }

  document.documentElement.style.setProperty("--gradient-start", t.gradientStart || "#ffffff");
  document.documentElement.style.setProperty("--gradient-middle", t.gradientMiddle || "#cccccc");
  document.documentElement.style.setProperty("--gradient-end", t.gradientEnd || "#999999");
  document.body.style.fontFamily = t.fontFamily || "Geist Sans, sans-serif";

  // Clear legacy background var to avoid overrides
  document.documentElement.style.setProperty("--background", "transparent");

  const ts = `?v=${Date.now()}`; // cache-buster only for applied CSS

  // Precedence: background_image > logo > primary_color
  if (config.background_image_url && config.background_use_image === true) {
    console.log('[applyArtistBackground] ✅ BRANCH: background_image', {
      url: config.background_image_url,
      cacheBuster: ts,
      background_use_image: config.background_use_image
    });
    
    const bgUrl = `${config.background_image_url}${ts}`;
    
    // CRITICAL: Set primary color as fallback FIRST (prevents white flash while image loads)
    document.body.style.setProperty("background-color", primary, "important");
    document.body.style.setProperty("background", primary, "important");
    
    // Preload image and apply once loaded (if cached, appears instantly; if not, shows primary color smoothly)
    const img = new Image();
    img.onload = () => {
      // Image loaded - apply it atomically
      document.body.style.setProperty("background-image", `url(${bgUrl})`, "important");
      document.body.style.setProperty("background-size", "cover", "important");
      document.body.style.setProperty("background-position", "center", "important");
      document.body.style.setProperty("background-repeat", "no-repeat", "important");
      document.body.style.setProperty("background-color", primary, "important"); // Keep primary as fallback
      document.body.style.setProperty("background", `${primary} url(${bgUrl}) center/cover no-repeat`, "important");
      console.log('[applyArtistBackground] ✅ Background image loaded and applied');
    };
    img.onerror = () => {
      // Image failed to load - keep primary color
      console.warn('[applyArtistBackground] ⚠️ Background image failed to load, keeping primary color');
      document.body.style.setProperty("background-color", primary, "important");
      document.body.style.setProperty("background", primary, "important");
    };
    
    // Start loading (if cached, onload fires immediately)
    img.src = bgUrl;
    
    // Clear CSS variable that might have tan value
    document.documentElement.style.setProperty("--background", primary);
    return;
  }

  // CRITICAL: Check logo branch with explicit boolean check
  if (config.logo_url && config.logo_use_background === true) {
    console.log('[applyArtistBackground] ✅ BRANCH: logo', {
      url: config.logo_url,
      cacheBuster: ts,
      logo_use_background: config.logo_use_background,
      logo_url_present: !!config.logo_url,
      logo_use_background_type: typeof config.logo_use_background,
      logo_use_background_value: config.logo_use_background
    });
    
    const logoUrl = `${config.logo_url}${ts}`;
    
    // CRITICAL: Set primary color as fallback FIRST (prevents white flash while image loads)
    document.body.style.setProperty("background-color", primary, "important");
    document.body.style.setProperty("background", primary, "important");
    
    // Preload image and apply once loaded (if cached, appears instantly; if not, shows primary color smoothly)
    const img = new Image();
    img.onload = () => {
      // Image loaded - apply it atomically
      document.body.style.setProperty("background-image", `url(${logoUrl})`, "important");
      document.body.style.setProperty("background-size", "cover", "important");
      document.body.style.setProperty("background-position", "center", "important");
      document.body.style.setProperty("background-repeat", "no-repeat", "important");
      document.body.style.setProperty("background-color", primary, "important"); // Keep primary as fallback
      document.body.style.setProperty("background", `${primary} url(${logoUrl}) center/cover no-repeat`, "important");
      console.log('[applyArtistBackground] ✅ Logo image loaded and applied');
    };
    img.onerror = () => {
      // Image failed to load - keep primary color
      console.warn('[applyArtistBackground] ⚠️ Logo image failed to load, keeping primary color');
      document.body.style.setProperty("background-color", primary, "important");
      document.body.style.setProperty("background", primary, "important");
    };
    
    // Start loading (if cached, onload fires immediately)
    img.src = logoUrl;
    
    // Clear CSS variable that might have tan value
    document.documentElement.style.setProperty("--background", primary);
    return;
  }

  // Fallback: primary color
  console.log('[applyArtistBackground] ⚠️ BRANCH: primary_color (fallback)', {
    primaryColor: primary,
    reason: !config.logo_url ? 'no logo_url' : config.logo_use_background !== true ? `logo_use_background=${config.logo_use_background} (not true)` : 'unknown',
    logo_url: config.logo_url,
    logo_use_background: config.logo_use_background,
    logo_use_background_type: typeof config.logo_use_background,
    background_image_url: config.background_image_url,
    background_use_image: config.background_use_image
  });
  // CRITICAL: Clear ALL background styles to prevent tan/onboarding from lingering
  document.body.style.setProperty("background-image", "none", "important");
  document.body.style.setProperty("background", primary, "important");
  document.body.style.removeProperty("background-color"); // Remove any inline background-color
  document.documentElement.style.setProperty("--background", primary);
}

