import { useEffect } from 'react';
import { ArtistConfig } from '../../types/artist-types';

/**
 * Custom hook to manage artist-specific theming
 * Toggles body classes based on artist configuration
 * @param artistConfig - The current artist configuration
 */
export const useArtistTheme = (artistConfig: ArtistConfig | null) => {
  useEffect(() => {
    if (!artistConfig) return;

    const bodyElement = document.body;
    
    // Remove any existing theme classes
    const existingThemeClasses = Array.from(bodyElement.classList).filter(
      className => className.startsWith('theme-')
    );
    existingThemeClasses.forEach(className => {
      bodyElement.classList.remove(className);
    });

    // Add new theme class based on artist
    const themeClass = `theme-${artistConfig.name.toLowerCase()}`;
    bodyElement.classList.add(themeClass);

    // Inject CSS custom properties for this artist
    const styleId = 'artist-theme-variables';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    // Generate CSS variables from artist config
    const cssVariables = `
      .${themeClass} {
        --accent-color: ${artistConfig.theme?.accentColor || '#4073ff'};
        --accent-color-rgb: ${hexToRgb(artistConfig.theme?.accentColor || '#4073ff')};
        --primary-color: ${artistConfig.theme?.primaryColor || '#0a1a3b'};
        --gradient-start: ${artistConfig.theme?.gradientStart || '#d4af37'};
        --gradient-middle: ${artistConfig.theme?.gradientMiddle || '#f9f295'};
        --gradient-end: ${artistConfig.theme?.gradientEnd || '#d4af37'};
        --artist-token-name: "${artistConfig.tokenName || 'TOKEN'}";
      }
    `;

    styleElement.textContent = cssVariables;

    // Cleanup function to remove theme class when component unmounts
    return () => {
      bodyElement.classList.remove(themeClass);
    };
  }, [artistConfig]);
};

/**
 * Helper function to convert hex color to RGB values
 * @param hex - Hex color string (e.g., '#4073ff')
 * @returns RGB string (e.g., '64, 115, 255')
 */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '64, 115, 255'; // Default fallback
  
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  
  return `${r}, ${g}, ${b}`;
} 