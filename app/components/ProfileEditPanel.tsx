import React, { useState, useCallback, useEffect, useRef } from 'react';
import { applyArtistBackground } from '../utils/themeBackground';
import { ArtistConfig } from '../../types/artist-types';
import { useWallet } from './MagicProvider';
import { authenticatedFetch } from '../utils/authenticatedFetch';

interface ProfileEditPanelProps {
  artistConfig: any;
  userAddress: string;
  onClose: () => void;
  onSave: (updates: any) => void;
  /** Live preview while toggling stardust during profile edit */
  onStardustPreviewChange?: (enabled: boolean) => void;
}

const COLOR_PRESETS = {
  gold: { name: "Gold", primary: "#FFD700", accent: "#B8860B" },
  silver: { name: "Silver", primary: "#C0C0C0", accent: "#808080" },
  bronze: { name: "Bronze", primary: "#CD7F32", accent: "#A0522D" },
  emerald: { name: "Emerald", primary: "#50C878", accent: "#228B22" },
  sapphire: { name: "Sapphire", primary: "#0F52BA", accent: "#1E40AF" },
  ruby: { name: "Ruby", primary: "#E0115F", accent: "#B22222" },
  black: { name: "Black", primary: "#1a1a1a", accent: "#404040" },
  white: { name: "White", primary: "#F8F8FF", accent: "#4A4A4A" }
};

const FONT_OPTIONS = [
  { name: "Bungee", value: "Bungee, cursive" },
  { name: "Geist", value: "Geist, sans-serif" },
  { name: "Inter", value: "Inter, sans-serif" },
  { name: "DM Sans", value: "DM Sans, sans-serif" },
  { name: "Space Grotesk", value: "Space Grotesk, sans-serif" },
  { name: "Instrument Sans", value: "Instrument Sans, sans-serif" }
];

const COMMON_FONTS = [
  "Arial, sans-serif",
  "Helvetica, sans-serif", 
  "Times New Roman, serif",
  "Georgia, serif",
  "Verdana, sans-serif",
  "Trebuchet MS, sans-serif",
  "Palatino, serif",
  "Garamond, serif",
  "Bookman, serif",
  "Comic Sans MS, cursive",
  "Impact, sans-serif",
  "Lucida Console, monospace",
  "Monaco, monospace",
  "Courier New, monospace",
  "Roboto, sans-serif",
  "Open Sans, sans-serif",
  "Lato, sans-serif",
  "Montserrat, sans-serif",
  "Poppins, sans-serif",
  "Nunito, sans-serif",
  "Raleway, sans-serif",
  "Source Sans Pro, sans-serif",
  "Ubuntu, sans-serif",
  "Merriweather, serif",
  "Playfair Display, serif",
  "Lora, serif",
  "Crimson Text, serif",
  "Oswald, sans-serif",
  "Bebas Neue, cursive",
  "Pacifico, cursive",
  "Dancing Script, cursive",
  "Lobster, cursive"
];

const ProfileEditPanel: React.FC<ProfileEditPanelProps> = ({
  artistConfig,
  userAddress,
  onClose,
  onSave,
  onStardustPreviewChange,
}) => {
  const { getDidToken } = useWallet();
  const [formData, setFormData] = useState({
    primary_color: artistConfig?.theme?.primaryColor || '#FFD700',
    accent_color: artistConfig?.theme?.accentColor || '#B8860B',
    font_family: artistConfig?.theme?.fontFamily || 'Bungee, cursive',
    gradient_start: artistConfig?.theme?.gradientStart || '#FFD700',
    gradient_end: artistConfig?.theme?.gradientEnd || '#B8860B',
    stardust: artistConfig?.theme?.stardust === true,
    logo_url: artistConfig?.logo_url || null,
    background_image_url: artistConfig?.background_image_url || null,
    logo_use_background: artistConfig?.logo_use_background || false,
    background_use_image: artistConfig?.background_use_image || false
  });

  const [originalTheme, setOriginalTheme] = useState(formData);
  const [isSaving, setIsSaving] = useState(false);
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [fontSearch, setFontSearch] = useState('');
  
  // Logo and background file state (separate from formData)
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    artistConfig?.logo_url || null
  );
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(
    artistConfig?.background_image_url || null
  );
  
  // Refs to track latest preview URLs (avoid stale closures)
  const logoPreviewRef = useRef<string | null>(artistConfig?.logo_url || null);
  const backgroundPreviewRef = useRef<string | null>(artistConfig?.background_image_url || null);
  
  // Sync refs when state changes
  useEffect(() => {
    logoPreviewRef.current = logoPreview;
  }, [logoPreview]);
  
  useEffect(() => {
    backgroundPreviewRef.current = backgroundPreview;
  }, [backgroundPreview]);

  useEffect(() => {
    onStardustPreviewChange?.(formData.stardust === true);
  }, [formData.stardust, onStardustPreviewChange]);

  // Store original theme on mount
  useEffect(() => {
    setOriginalTheme({
      ...formData,
      logo_url: artistConfig?.logo_url || null,
      background_image_url: artistConfig?.background_image_url || null,
      logo_use_background: artistConfig?.logo_use_background || false,
      background_use_image: artistConfig?.background_use_image || false
    });
    // Initialize halo with current primary color
    window.dispatchEvent(new CustomEvent('primaryColorChange', { detail: { color: formData.primary_color } }));
  }, []);
  
  // Build preview config from current form state for live preview
  const buildPreviewConfig = useCallback((): ArtistConfig | null => {
    if (!artistConfig) return null;
    
    return {
      ...artistConfig,
      theme: {
        ...artistConfig.theme,
        primaryColor: formData.primary_color,
        accentColor: formData.accent_color,
        gradientStart: formData.gradient_start,
        gradientEnd: formData.gradient_end,
        fontFamily: formData.font_family,
        stardust: formData.stardust === true,
      },
      logo_url: logoPreview || formData.logo_url || null,
      background_image_url: backgroundPreview || formData.background_image_url || null,
      logo_use_background: formData.logo_use_background,
      background_use_image: formData.background_use_image,
    };
  }, [artistConfig, formData, logoPreview, backgroundPreview]);
  
  // Upload logo file to server
  const uploadLogoFile = async (file: File, artistId: string) => {
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('artistId', artistId);
      
      const response = await authenticatedFetch('/api/uploadLogo', {
        method: 'POST',
        headers: {
          'x-wallet-address': userAddress.toLowerCase()
        },
        body: uploadFormData
      }, getDidToken);
      
      const result = await response.json();
      
      if (response.ok) {
        // Update formData with new logo URL
        setFormData(prev => {
          const updated = { ...prev, logo_url: result.logoUrl };
          setLogoPreview(result.logoUrl);
          logoPreviewRef.current = result.logoUrl; // Update ref immediately
          
          // Build preview config and apply via decider
          // CRITICAL: Use formData.logo_use_background (current checkbox state)
          const previewConfig = {
            ...artistConfig,
            theme: {
              ...artistConfig?.theme,
              primaryColor: updated.primary_color,
              accentColor: updated.accent_color,
              gradientStart: updated.gradient_start,
              gradientEnd: updated.gradient_end,
              fontFamily: updated.font_family,
            },
            logo_url: result.logoUrl,
            background_image_url: backgroundPreviewRef.current || updated.background_image_url || null,
            logo_use_background: updated.logo_use_background, // Use current checkbox state
            background_use_image: updated.background_use_image,
          };
          
          console.log('[ProfileEditPanel] Logo uploaded, applying background:', {
            logo_url: result.logoUrl,
            logo_use_background: updated.logo_use_background,
            willApplyLogo: !!(result.logoUrl && updated.logo_use_background)
          });
          
          applyArtistBackground(previewConfig as ArtistConfig);
          
          return updated;
        });
      } else {
        alert(result.error || 'Failed to upload logo');
      }
    } catch (error) {
      console.error('Logo upload error:', error);
      alert('Failed to upload logo');
    }
  };
  
  // Upload background file to server
  const uploadBackgroundFile = async (file: File, artistId: string) => {
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('artistId', artistId);
      
      const response = await authenticatedFetch('/api/uploadBackground', {
        method: 'POST',
        headers: {
          'x-wallet-address': userAddress.toLowerCase()
        },
        body: uploadFormData
      }, getDidToken);
      
      const result = await response.json();
      
      if (response.ok) {
        // Update formData with new background URL
        setFormData(prev => {
          const updated = { ...prev, background_image_url: result.backgroundImageUrl };
          setBackgroundPreview(result.backgroundImageUrl);
          backgroundPreviewRef.current = result.backgroundImageUrl; // Update ref immediately
          
          // Build preview config and apply via decider (no setTimeout)
          const previewConfig = {
            ...artistConfig,
            theme: {
              ...artistConfig?.theme,
              primaryColor: updated.primary_color,
              accentColor: updated.accent_color,
              gradientStart: updated.gradient_start,
              gradientEnd: updated.gradient_end,
              fontFamily: updated.font_family,
            },
            logo_url: logoPreviewRef.current || updated.logo_url || null,
            background_image_url: result.backgroundImageUrl,
            logo_use_background: updated.logo_use_background,
            background_use_image: updated.background_use_image,
          };
          
          applyArtistBackground(previewConfig as ArtistConfig);
          
          return updated;
        });
      } else {
        alert(result.error || 'Failed to upload background image');
      }
    } catch (error) {
      console.error('Background upload error:', error);
      alert('Failed to upload background image');
    }
  };

  const handleFieldChange = useCallback((field: string, value: string | boolean) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      if (field === 'stardust') {
        onStardustPreviewChange?.(value === true);
      }
      
      // Build preview config and apply via decider for consistency
      if (field === 'primary_color' || field === 'accent_color' || field === 'font_family' || field === 'gradient_start' || field === 'gradient_end') {
        const previewConfig = {
          ...artistConfig,
          theme: {
            ...artistConfig?.theme,
            primaryColor: field === 'primary_color' ? (value as string) : updated.primary_color,
            accentColor: field === 'accent_color' ? (value as string) : updated.accent_color,
            gradientStart: field === 'gradient_start' ? (value as string) : updated.gradient_start,
            gradientEnd: field === 'gradient_end' ? (value as string) : updated.gradient_end,
            fontFamily: field === 'font_family' ? (value as string) : updated.font_family,
          },
          logo_url: logoPreview || updated.logo_url || null,
          background_image_url: backgroundPreview || updated.background_image_url || null,
          logo_use_background: updated.logo_use_background,
          background_use_image: updated.background_use_image,
        };
        applyArtistBackground(previewConfig as ArtistConfig);
        
        // Dispatch event to update halo for primary color
        if (field === 'primary_color') {
          window.dispatchEvent(new CustomEvent('primaryColorChange', { detail: { color: value as string } }));
        }
        
        // CRITICAL: Dispatch preview config for coin live updates
        // This allows ThemeOrbitRenderer to update coin colors immediately during editing
        window.dispatchEvent(new CustomEvent('artistConfigPreview', { 
          detail: { previewConfig: previewConfig as ArtistConfig } 
        }));
      }
      
      return updated;
    });

    // Apply live preview for other fields
    if (field === 'accent_color') {
      document.documentElement.style.setProperty('--accent-color', value as string);
      const headerElement = document.querySelector('h1');
      if (headerElement) {
        headerElement.style.color = value as string;
      }
    } else if (field === 'font_family') {
      document.body.style.fontFamily = value as string;
      const headerElement = document.querySelector('h1');
      if (headerElement) {
        headerElement.style.fontFamily = value as string;
      }
    }
  }, [artistConfig, logoPreview, backgroundPreview, onStardustPreviewChange]);

  const applyPrimaryPreset = useCallback((presetKey: string) => {
    const preset = COLOR_PRESETS[presetKey as keyof typeof COLOR_PRESETS];
    if (preset) {
      handleFieldChange('primary_color', preset.primary);
    }
  }, [handleFieldChange]);

  const applyAccentPreset = useCallback((presetKey: string) => {
    const preset = COLOR_PRESETS[presetKey as keyof typeof COLOR_PRESETS];
    if (preset) {
      handleFieldChange('accent_color', preset.accent);
    }
  }, [handleFieldChange]);

  const handleSave = useCallback(async () => {
    if (!artistConfig?.name || !userAddress) return;

    setIsSaving(true);
    try {
      const response = await authenticatedFetch('/api/artist/profile', {
        method: 'PATCH',
        headers: {
          'x-wallet-address': userAddress.toLowerCase()
        },
      body: JSON.stringify({
        artistId: artistConfig.id || artistConfig.name.toLowerCase(),
        ...formData,
        // Include logo fields
        logo_url: formData.logo_url,
        background_image_url: formData.background_image_url,
        logo_use_background: formData.logo_use_background,
        background_use_image: formData.background_use_image
      })
      }, getDidToken);

      const result = await response.json();

      if (response.ok) {
        console.log('✅ Profile saved successfully');
        
        // CRITICAL: Clear preview config when save completes
        // This ensures coins use saved state instead of preview
        window.dispatchEvent(new CustomEvent('artistConfigPreviewClear'));
        
        onSave(result.updated);
        onClose();
      } else {
        console.error('❌ Profile save failed:', result);
        alert(result.error || 'Failed to save profile');
      }
    } catch (error) {
      console.error('❌ Profile save error:', error);
      alert('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  }, [artistConfig, userAddress, formData, onSave, onClose, getDidToken]);

  const handleCancel = useCallback(() => {
    // Revert logo/background state
    setLogoPreview(originalTheme.logo_url);
    setBackgroundPreview(originalTheme.background_image_url);
    logoPreviewRef.current = originalTheme.logo_url;
    backgroundPreviewRef.current = originalTheme.background_image_url;
    setFormData(originalTheme);
    
    // Build revert config and apply via decider
    const revertConfig = {
      ...artistConfig,
      theme: {
        ...artistConfig?.theme,
        primaryColor: originalTheme.primary_color,
        accentColor: originalTheme.accent_color,
        gradientStart: originalTheme.gradient_start,
        gradientEnd: originalTheme.gradient_end,
        fontFamily: originalTheme.font_family,
      },
      logo_url: originalTheme.logo_url || null,
      background_image_url: originalTheme.background_image_url || null,
      logo_use_background: originalTheme.logo_use_background,
      background_use_image: originalTheme.background_use_image,
    };
    
    applyArtistBackground(revertConfig as ArtistConfig);
    
    // Revert accent color
    if (originalTheme.accent_color) {
      document.documentElement.style.setProperty('--accent-color', originalTheme.accent_color);
      const headerElement = document.querySelector('h1');
      if (headerElement) {
        headerElement.style.color = originalTheme.accent_color;
      }
    }
    
    // Revert font
    if (originalTheme.font_family) {
      document.body.style.fontFamily = originalTheme.font_family;
      const headerElement = document.querySelector('h1');
      if (headerElement) {
        headerElement.style.fontFamily = originalTheme.font_family;
      }
    }
    
    // CRITICAL: Clear preview config when exiting edit mode (cancel)
    // This ensures coins revert to saved state
    window.dispatchEvent(new CustomEvent('artistConfigPreviewClear'));

    onStardustPreviewChange?.(originalTheme.stardust === true);
    
    onClose();
  }, [originalTheme, onClose, artistConfig, onStardustPreviewChange]);

  return (
    <div className="portal-panel-chassis profile-edit-panel bg-gray-800 bg-opacity-70 shadow-xl rounded-lg border border-gray-700 backdrop-blur-md mb-8 p-6">
      <div className="flex justify-between items-center mb-6 gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-white" style={{ fontFamily: 'Bungee, cursive', color: formData.accent_color }}>
          EDIT PROFILE
        </h2>
        <button
          onClick={handleCancel}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Primary Color Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Primary Color (Background)</h3>
          <div className="theme-color-swatch-grid grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
            <button
              key={`primary-${key}`}
              onClick={() => applyPrimaryPreset(key)}
              className={`theme-color-swatch relative w-12 h-12 rounded-lg border-2 transition-all hover:scale-110 ${
                formData.primary_color === preset.primary
                  ? 'border-white'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: preset.primary }}
              title={`${preset.name} Primary`}
            >
              {formData.primary_color === preset.primary && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="theme-color-swatch-check text-white text-lg font-bold">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
          
        <div className="flex gap-2">
          <input
            type="color"
            value={formData.primary_color}
            onChange={(e) => handleFieldChange('primary_color', e.target.value)}
            className="w-10 h-10 rounded border border-gray-600"
          />
          <input
            type="text"
            value={formData.primary_color}
            onChange={(e) => handleFieldChange('primary_color', e.target.value)}
            className="flex-1 p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
            placeholder="#RRGGBB"
          />
        </div>
      </div>

      {/* Accent Color Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Accent Color (Text/Highlights)</h3>
        <div className="theme-color-swatch-grid grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
            <button
              key={`accent-${key}`}
              onClick={() => applyAccentPreset(key)}
              className={`theme-color-swatch relative w-12 h-12 rounded-lg border-2 transition-all hover:scale-110 ${
                formData.accent_color === preset.accent
                  ? 'border-white'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: preset.accent }}
              title={`${preset.name} Accent`}
            >
              {formData.accent_color === preset.accent && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="theme-color-swatch-check text-white text-lg font-bold">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2">
          <input
            type="color"
            value={formData.accent_color}
            onChange={(e) => handleFieldChange('accent_color', e.target.value)}
            className="w-10 h-10 rounded border border-gray-600"
          />
          <input
            type="text"
            value={formData.accent_color}
            onChange={(e) => handleFieldChange('accent_color', e.target.value)}
            className="flex-1 p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
            placeholder="#RRGGBB"
          />
        </div>
      </div>

      {/* Stardust atmosphere */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Atmosphere</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            id="profileStardust"
            type="checkbox"
            checked={formData.stardust === true}
            onChange={(e) => handleFieldChange('stardust', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-accentColor focus:ring-accentColor"
          />
          <span className="text-sm text-gray-200">Stardust</span>
        </label>
        <p className="text-xs text-gray-400 mt-2 ml-7">
          Floating starfield behind your portal. Off by default — check to enable.
        </p>
      </div>

      {/* Logo Upload Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Logo Upload</h3>
        
        {/* Current logo preview */}
        {logoPreview && (
          <div className="mb-3 relative">
            <button
              onClick={async () => {
                if (confirm('Are you sure you want to remove the logo?')) {
                  try {
                    // Delete from server
                    const response = await authenticatedFetch('/api/deleteLogo', {
                      method: 'DELETE',
                      headers: {
                        'x-wallet-address': userAddress.toLowerCase()
                      },
                      body: JSON.stringify({
                        artistId: artistConfig.id || artistConfig.name.toLowerCase()
                      })
                    }, getDidToken);

                    if (response.ok) {
                      const result = await response.json();
                      console.log('[ProfileEditPanel] ✅ Logo deleted:', result);
                      
                      // Clear preview and state (LAYER 3: Client State)
                      if (logoPreview && logoPreview.startsWith('blob:')) {
                        URL.revokeObjectURL(logoPreview);
                      }
                      setLogoPreview(null);
                      logoPreviewRef.current = null;
                      setLogoFile(null);
                      
                      const updatedFormData = {
                        ...formData,
                        logo_url: null,
                        logo_use_background: false
                      };
                      setFormData(updatedFormData);
                      
                      // CRITICAL: Update parent state immediately (LAYER 3: Client State)
                      // This ensures page.tsx's artistConfig is updated and persists
                      console.log('[ProfileEditPanel] 🔄 Notifying parent of logo deletion');
                      
                      // Dispatch event to trigger hook refresh
                      window.dispatchEvent(new CustomEvent('logoDeleted'));
                      
                      onSave({
                        logo_url: null,
                        logo_use_background: false
                        // Only include changed fields - parent will merge correctly
                      });
                      
                      // Apply background immediately with cleared logo
                      const previewConfig = {
                        ...artistConfig,
                        theme: {
                          ...artistConfig?.theme,
                          primaryColor: updatedFormData.primary_color,
                          accentColor: updatedFormData.accent_color,
                          gradientStart: updatedFormData.gradient_start,
                          gradientEnd: updatedFormData.gradient_end,
                          fontFamily: updatedFormData.font_family,
                        },
                        logo_url: null,
                        background_image_url: backgroundPreviewRef.current || updatedFormData.background_image_url || null,
                        logo_use_background: false,
                        background_use_image: updatedFormData.background_use_image,
                      };
                      
                      applyArtistBackground(previewConfig as ArtistConfig);
                    } else {
                      const result = await response.json();
                      alert(result.error || 'Failed to delete logo');
                    }
                  } catch (error) {
                    console.error('Logo delete error:', error);
                    alert('Failed to delete logo');
                  }
                }
              }}
              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold transition-colors shadow-lg z-10"
              title="Remove logo"
            >
              ×
            </button>
            <img 
              src={logoPreview} 
              alt="Logo preview" 
              className="w-full h-64 object-contain rounded border border-gray-600 bg-gray-800"
            />
          </div>
        )}
        
        {/* File input */}
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
              alert('Please upload an image file (JPG, PNG, SVG, or WebP)');
              return;
            }
            
            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
              alert('File size must be less than 5MB');
              return;
            }
            
            setLogoFile(file);
            // Revoke old preview URL to prevent memory leaks
            if (logoPreview && logoPreview.startsWith('blob:')) {
              URL.revokeObjectURL(logoPreview);
            }
            const preview = URL.createObjectURL(file);
            setLogoPreview(preview);
            logoPreviewRef.current = preview; // Update ref immediately for checkbox handler
            
            // Upload to server (but don't apply yet - wait for checkbox)
            await uploadLogoFile(file, artistConfig.id || artistConfig.name.toLowerCase());
          }}
          className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 mb-3 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-500 file:text-white hover:file:bg-yellow-600"
        />
        
        {/* Checkbox - Use logo as background */}
        <label className="flex items-center text-white cursor-pointer">
          <input
            type="checkbox"
            checked={formData.logo_use_background}
            onChange={(e) => {
              const checked = e.target.checked;
              // Update both fields atomically: if checking logo, uncheck background
              setFormData(prev => {
                const updated = {
                  ...prev,
                  logo_use_background: checked,
                  background_use_image: checked ? false : prev.background_use_image
                };
                // CRITICAL: Use the NEW checked value, not updated.logo_use_background
                // (updated has the new value, but be explicit to avoid any confusion)
                const newLogoUseBackground = checked;
                const logoUrl = logoPreviewRef.current || updated.logo_url || null;
                
                // Build preview config with latest ref values (avoid stale closure)
                const previewConfig = {
                  ...artistConfig,
                  theme: {
                    ...artistConfig?.theme,
                    primaryColor: updated.primary_color,
                    accentColor: updated.accent_color,
                    gradientStart: updated.gradient_start,
                    gradientEnd: updated.gradient_end,
                    fontFamily: updated.font_family,
                  },
                  logo_url: logoUrl,
                  background_image_url: backgroundPreviewRef.current || updated.background_image_url || null,
                  logo_use_background: newLogoUseBackground, // Use explicit checked value
                  background_use_image: checked ? false : updated.background_use_image,
                };
                
                // Log for debugging
                console.log('[ProfileEditPanel] Logo checkbox changed:', {
                  checked,
                  newLogoUseBackground,
                  logoUrl,
                  logoPreviewRef: logoPreviewRef.current,
                  previewConfig: {
                    logo_url: previewConfig.logo_url,
                    logo_use_background: previewConfig.logo_use_background,
                    background_use_image: previewConfig.background_use_image,
                    hasLogoUrl: !!previewConfig.logo_url
                  }
                });
                
                // CRITICAL: Apply background IMMEDIATELY with correct values
                // Apply synchronously to prevent any race conditions
                console.log('[ProfileEditPanel] Applying background IMMEDIATELY with config:', {
                  logo_url: previewConfig.logo_url,
                  logo_use_background: previewConfig.logo_use_background,
                  hasLogoUrl: !!previewConfig.logo_url,
                  willUseLogo: !!(previewConfig.logo_url && previewConfig.logo_use_background)
                });
                applyArtistBackground(previewConfig as ArtistConfig);
                
                return updated;
              });
            }}
            className="mr-2 w-4 h-4"
            disabled={!logoPreview}
          />
          <span className={logoPreview ? '' : 'text-gray-500'}>
            Use logo as page background
          </span>
        </label>
      </div>

      {/* Background Image Section (separate from logo) */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Background Image</h3>
        
        {/* Current background preview */}
        {backgroundPreview && (
          <div className="mb-3 relative">
            <button
              onClick={async () => {
                if (confirm('Are you sure you want to remove the background image?')) {
                  try {
                    // Delete from server
                    const response = await authenticatedFetch('/api/deleteBackground', {
                      method: 'DELETE',
                      headers: {
                        'x-wallet-address': userAddress.toLowerCase()
                      },
                      body: JSON.stringify({
                        artistId: artistConfig.id || artistConfig.name.toLowerCase()
                      })
                    }, getDidToken);

                    if (response.ok) {
                      const result = await response.json();
                      console.log('[ProfileEditPanel] ✅ Background deleted:', result);
                      
                      // Clear preview and state (LAYER 3: Client State)
                      if (backgroundPreview && backgroundPreview.startsWith('blob:')) {
                        URL.revokeObjectURL(backgroundPreview);
                      }
                      setBackgroundPreview(null);
                      backgroundPreviewRef.current = null;
                      setBackgroundFile(null);
                      
                      const updatedFormData = {
                        ...formData,
                        background_image_url: null,
                        background_use_image: false
                      };
                      setFormData(updatedFormData);
                      
                      // CRITICAL: Update parent state immediately (LAYER 3: Client State)
                      // This ensures page.tsx's artistConfig is updated and persists
                      console.log('[ProfileEditPanel] 🔄 Notifying parent of background deletion');
                      
                      // Dispatch event to trigger hook refresh
                      window.dispatchEvent(new CustomEvent('backgroundDeleted'));
                      
                      onSave({
                        background_image_url: null,
                        background_use_image: false
                        // Only include changed fields - parent will merge correctly
                      });
                      
                      // Apply background immediately with cleared background image
                      const previewConfig = {
                        ...artistConfig,
                        theme: {
                          ...artistConfig?.theme,
                          primaryColor: updatedFormData.primary_color,
                          accentColor: updatedFormData.accent_color,
                          gradientStart: updatedFormData.gradient_start,
                          gradientEnd: updatedFormData.gradient_end,
                          fontFamily: updatedFormData.font_family,
                        },
                        logo_url: logoPreviewRef.current || updatedFormData.logo_url || null,
                        background_image_url: null,
                        logo_use_background: updatedFormData.logo_use_background,
                        background_use_image: false,
                      };
                      
                      applyArtistBackground(previewConfig as ArtistConfig);
                    } else {
                      const result = await response.json();
                      alert(result.error || 'Failed to delete background image');
                    }
                  } catch (error) {
                    console.error('Background delete error:', error);
                    alert('Failed to delete background image');
                  }
                }
              }}
              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold transition-colors shadow-lg z-10"
              title="Remove background image"
            >
              ×
            </button>
            <img 
              src={backgroundPreview} 
              alt="Background preview" 
              className="w-full h-64 object-contain rounded border border-gray-600 bg-gray-800"
            />
          </div>
        )}
        
        {/* File input */}
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            
            // Same validation as logo
            if (!file.type.startsWith('image/')) {
              alert('Please upload an image file (JPG, PNG, SVG, or WebP)');
              return;
            }
            if (file.size > 5 * 1024 * 1024) {
              alert('File size must be less than 5MB');
              return;
            }
            
            setBackgroundFile(file);
            // Revoke old preview URL to prevent memory leaks
            if (backgroundPreview && backgroundPreview.startsWith('blob:')) {
              URL.revokeObjectURL(backgroundPreview);
            }
            const preview = URL.createObjectURL(file);
            setBackgroundPreview(preview);
            
            // Upload to server
            await uploadBackgroundFile(file, artistConfig.id || artistConfig.name.toLowerCase());
          }}
          className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 mb-3 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-500 file:text-white hover:file:bg-yellow-600"
        />
        
        {/* Checkbox - Use background image */}
        <label className="flex items-center text-white cursor-pointer">
          <input
            type="checkbox"
            checked={formData.background_use_image}
            onChange={(e) => {
              const checked = e.target.checked;
              // Update both fields atomically: if checking background, uncheck logo
              setFormData(prev => {
                const updated = {
                  ...prev,
                  background_use_image: checked,
                  logo_use_background: checked ? false : prev.logo_use_background
                };
                
                // CRITICAL: Use the NEW checked value explicitly
                const newBackgroundUseImage = checked;
                const backgroundImageUrl = backgroundPreviewRef.current || updated.background_image_url || null;
                
                // Build preview config with latest ref values (avoid stale closure)
                const previewConfig = {
                  ...artistConfig,
                  theme: {
                    ...artistConfig?.theme,
                    primaryColor: updated.primary_color,
                    accentColor: updated.accent_color,
                    gradientStart: updated.gradient_start,
                    gradientEnd: updated.gradient_end,
                    fontFamily: updated.font_family,
                  },
                  logo_url: logoPreviewRef.current || updated.logo_url || null,
                  background_image_url: backgroundImageUrl,
                  logo_use_background: checked ? false : updated.logo_use_background,
                  background_use_image: newBackgroundUseImage, // Use explicit checked value
                };
                
                // Log for debugging
                console.log('[ProfileEditPanel] Background checkbox changed:', {
                  checked,
                  newBackgroundUseImage,
                  backgroundImageUrl,
                  backgroundPreviewRef: backgroundPreviewRef.current,
                  previewConfig: {
                    background_image_url: previewConfig.background_image_url,
                    background_use_image: previewConfig.background_use_image,
                    logo_use_background: previewConfig.logo_use_background,
                    hasBackgroundUrl: !!previewConfig.background_image_url
                  }
                });
                
                // CRITICAL: Apply background IMMEDIATELY with correct values
                console.log('[ProfileEditPanel] Applying background IMMEDIATELY with config:', {
                  background_image_url: previewConfig.background_image_url,
                  background_use_image: previewConfig.background_use_image,
                  willUseBackground: !!(previewConfig.background_image_url && previewConfig.background_use_image)
                });
                applyArtistBackground(previewConfig as ArtistConfig);
                
                return updated;
              });
            }}
            className="mr-2 w-4 h-4"
            disabled={!backgroundPreview}
          />
          <span className={backgroundPreview ? '' : 'text-gray-500'}>
            Use background image
          </span>
        </label>
      </div>

      {/* Typography Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Typography</h3>
        
        {/* Standard Font Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {FONT_OPTIONS.map((font) => (
            <button
              key={font.value}
              onClick={() => handleFieldChange('font_family', font.value)}
              className={`p-3 rounded-lg border-2 transition-all ${
                formData.font_family === font.value
                  ? 'border-yellow-500 bg-yellow-500 bg-opacity-20'
                  : 'border-gray-600 bg-gray-700 hover:border-gray-500'
              }`}
              style={{ fontFamily: font.value }}
            >
              <div className="text-white font-bold text-sm">{font.name}</div>
            </button>
          ))}
        </div>

        {/* Font Dropdown */}
        <div className="relative">
          <label className="block text-sm text-gray-300 mb-2">Or choose from common fonts:</label>
          <div className="relative">
            <input
              type="text"
              value={fontSearch}
              onChange={(e) => setFontSearch(e.target.value)}
              onFocus={() => setShowFontDropdown(true)}
              placeholder={formData.font_family || "Search fonts... (e.g. Arial, Roboto, Times)"}
              className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm focus:border-yellow-500"
              style={{ fontFamily: formData.font_family }}
            />
            
            {showFontDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded max-h-40 overflow-y-auto z-50">
                {COMMON_FONTS
                  .filter(font => font.toLowerCase().includes(fontSearch.toLowerCase()))
                  .map((font) => (
                    <button
                      key={font}
                      onClick={() => {
                        handleFieldChange('font_family', font);
                        // Clear the search so reopening shows the full list
                        setFontSearch('');
                        setShowFontDropdown(false);
                      }}
                      className="w-full text-left p-2 hover:bg-gray-700 text-white text-sm transition-colors"
                      style={{ fontFamily: font }}
                    >
                      {font}
                    </button>
                  ))}
              </div>
            )}
          </div>
          
          {/* Close dropdown when clicking outside */}
          {showFontDropdown && (
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowFontDropdown(false)}
            />
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-bold hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
        >
          {isSaving ? 'Saving Profile...' : '💾 SAVE PROFILE'}
        </button>
        <button
          onClick={handleCancel}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors sm:flex-shrink-0"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ProfileEditPanel;

