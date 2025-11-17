import React, { useState, useCallback, useEffect } from 'react';

interface ProfileEditPanelProps {
  artistConfig: any;
  userAddress: string;
  onClose: () => void;
  onSave: (updates: any) => void;
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
  onSave
}) => {
  const [formData, setFormData] = useState({
    primary_color: artistConfig?.theme?.primaryColor || '#FFD700',
    accent_color: artistConfig?.theme?.accentColor || '#B8860B',
    font_family: artistConfig?.theme?.fontFamily || 'Bungee, cursive',
    gradient_start: artistConfig?.theme?.gradientStart || '#FFD700',
    gradient_end: artistConfig?.theme?.gradientEnd || '#B8860B',
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
  
  // Apply background precedence rule
  const applyBackgroundPrecedence = useCallback(() => {
    // Rule: background_image > logo_background > primary_color
    if (formData.background_use_image && backgroundPreview) {
      document.body.style.backgroundImage = `url(${backgroundPreview})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundRepeat = 'no-repeat';
    } else if (formData.logo_use_background && logoPreview) {
      document.body.style.backgroundImage = `url(${logoPreview})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundRepeat = 'no-repeat';
    } else {
      document.body.style.backgroundImage = 'none';
      document.body.style.background = formData.primary_color;
    }
  }, [formData.background_use_image, formData.logo_use_background, formData.primary_color, backgroundPreview, logoPreview]);
  
  // Upload logo file to server
  const uploadLogoFile = async (file: File, artistId: string) => {
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('artistId', artistId);
      
      const response = await fetch('/api/uploadLogo', {
        method: 'POST',
        headers: {
          'x-wallet-address': userAddress.toLowerCase()
        },
        body: uploadFormData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Update formData with new logo URL
        setFormData(prev => {
          const updated = { ...prev, logo_url: result.logoUrl };
          setLogoPreview(result.logoUrl);
          
          // Apply background if checkbox is checked (respect precedence)
          setTimeout(() => {
            if (updated.background_use_image && backgroundPreview) {
              // Background image takes precedence
              document.body.style.backgroundImage = `url(${backgroundPreview})`;
            } else if (updated.logo_use_background && result.logoUrl) {
              // Use logo as background
              document.body.style.backgroundImage = `url(${result.logoUrl})`;
            } else {
              // Fall back to primary color
              document.body.style.backgroundImage = 'none';
              document.body.style.background = updated.primary_color;
            }
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
          }, 0);
          
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
      
      const response = await fetch('/api/uploadBackground', {
        method: 'POST',
        headers: {
          'x-wallet-address': userAddress.toLowerCase()
        },
        body: uploadFormData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Update formData with new background URL
        setFormData(prev => {
          const updated = { ...prev, background_image_url: result.backgroundImageUrl };
          setBackgroundPreview(result.backgroundImageUrl);
          
          // Apply background if checkbox is checked (background takes precedence)
          if (updated.background_use_image) {
            setTimeout(() => {
              document.body.style.backgroundImage = `url(${result.backgroundImageUrl})`;
              document.body.style.backgroundSize = 'cover';
              document.body.style.backgroundPosition = 'center';
              document.body.style.backgroundRepeat = 'no-repeat';
            }, 0);
          }
          
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
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Apply live preview exactly like OnboardingPanel
    if (field === 'primary_color') {
      // Apply primary color only if no background image/logo is active
      if (!formData.background_use_image && !formData.logo_use_background) {
        document.body.style.background = value as string;
        document.body.style.backgroundImage = 'none';
      }
      // Dispatch event to update halo
      window.dispatchEvent(new CustomEvent('primaryColorChange', { detail: { color: value as string } }));
    } else if (field === 'accent_color') {
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
    // NEW: Background precedence handling
    else if (field === 'background_use_image' || field === 'logo_use_background') {
      // Apply precedence rule immediately with updated value
      const newValue = value as boolean;
      // Get the OTHER field's current state (the one not being changed)
      const otherFieldValue = field === 'background_use_image' 
        ? formData.logo_use_background 
        : formData.background_use_image;
      
      setTimeout(() => {
        // Apply precedence: background_image > logo_background > primary_color
        if (field === 'background_use_image') {
          // Background image checkbox changed
          if (newValue && backgroundPreview) {
            // Background image takes precedence
            document.body.style.backgroundImage = `url(${backgroundPreview})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
          } else if (otherFieldValue && logoPreview) {
            // Background unchecked, fall back to logo if enabled
            document.body.style.backgroundImage = `url(${logoPreview})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
          } else {
            // Both unchecked, fall back to primary color
            document.body.style.backgroundImage = 'none';
            document.body.style.background = formData.primary_color;
          }
        } else if (field === 'logo_use_background') {
          // Logo checkbox changed
          if (otherFieldValue && backgroundPreview) {
            // Background image takes precedence (don't change)
            document.body.style.backgroundImage = `url(${backgroundPreview})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
          } else if (newValue && logoPreview) {
            // Logo checked and no background, use logo
            document.body.style.backgroundImage = `url(${logoPreview})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
          } else {
            // Logo unchecked and no background, fall back to primary color
            document.body.style.backgroundImage = 'none';
            document.body.style.background = formData.primary_color;
          }
        }
      }, 0);
    }
  }, [formData.background_use_image, formData.logo_use_background, formData.primary_color, backgroundPreview, logoPreview]);

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
      const response = await fetch('/api/artist/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
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
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ Profile saved successfully');
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
  }, [artistConfig, userAddress, formData, onSave, onClose]);

  const handleCancel = useCallback(() => {
    // Revert logo/background state
    setLogoPreview(originalTheme.logo_url);
    setBackgroundPreview(originalTheme.background_image_url);
    setFormData(originalTheme);
    
    // Apply precedence rule with original values
    if (originalTheme.background_use_image && originalTheme.background_image_url) {
      document.body.style.backgroundImage = `url(${originalTheme.background_image_url})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundRepeat = 'no-repeat';
    } else if (originalTheme.logo_use_background && originalTheme.logo_url) {
      document.body.style.backgroundImage = `url(${originalTheme.logo_url})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundRepeat = 'no-repeat';
    } else {
      document.body.style.backgroundImage = 'none';
      document.body.style.background = originalTheme.primary_color;
    }
    
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
    
    onClose();
  }, [originalTheme, onClose]);

  return (
    <div className="profile-edit-panel bg-gray-800 bg-opacity-70 shadow-xl rounded-lg border border-gray-700 backdrop-blur-md mb-8 max-w-2xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Bungee, cursive', color: formData.accent_color }}>
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
          <div className="grid grid-cols-4 gap-3 mb-4">
          {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
            <button
              key={`primary-${key}`}
              onClick={() => applyPrimaryPreset(key)}
              className={`relative w-12 h-12 rounded-lg border-2 transition-all hover:scale-110 ${
                formData.primary_color === preset.primary
                  ? 'border-white'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: preset.primary }}
              title={`${preset.name} Primary`}
            >
              {formData.primary_color === preset.primary && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">✓</span>
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
        <div className="grid grid-cols-4 gap-3 mb-4">
          {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
            <button
              key={`accent-${key}`}
              onClick={() => applyAccentPreset(key)}
              className={`relative w-12 h-12 rounded-lg border-2 transition-all hover:scale-110 ${
                formData.accent_color === preset.accent
                  ? 'border-white'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: preset.accent }}
              title={`${preset.name} Accent`}
            >
              {formData.accent_color === preset.accent && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">✓</span>
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
                    const response = await fetch('/api/deleteLogo', {
                      method: 'DELETE',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-wallet-address': userAddress.toLowerCase()
                      },
                      body: JSON.stringify({
                        artistId: artistConfig.id || artistConfig.name.toLowerCase()
                      })
                    });

                    if (response.ok) {
                      // Clear preview and state
                      if (logoPreview.startsWith('blob:')) {
                        URL.revokeObjectURL(logoPreview);
                      }
                      setLogoPreview(null);
                      setLogoFile(null);
                      setFormData(prev => ({
                        ...prev,
                        logo_url: null,
                        logo_use_background: false
                      }));
                      
                      // Revert background if logo was being used
                      setTimeout(() => {
                        if (formData.background_use_image && backgroundPreview) {
                          document.body.style.backgroundImage = `url(${backgroundPreview})`;
                        } else {
                          document.body.style.backgroundImage = 'none';
                          document.body.style.background = formData.primary_color;
                        }
                        document.body.style.backgroundSize = 'cover';
                        document.body.style.backgroundPosition = 'center';
                        document.body.style.backgroundRepeat = 'no-repeat';
                      }, 0);
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
                // Apply live preview with updated values
                setTimeout(() => {
                  if (checked && logoPreview) {
                    // Logo checked - use logo as background
                    document.body.style.backgroundImage = `url(${logoPreview})`;
                    document.body.style.backgroundSize = 'cover';
                    document.body.style.backgroundPosition = 'center';
                    document.body.style.backgroundRepeat = 'no-repeat';
                  } else if (!checked && updated.background_use_image && backgroundPreview) {
                    // Logo unchecked, but background is checked - use background
                    document.body.style.backgroundImage = `url(${backgroundPreview})`;
                    document.body.style.backgroundSize = 'cover';
                    document.body.style.backgroundPosition = 'center';
                    document.body.style.backgroundRepeat = 'no-repeat';
                  } else {
                    // Both unchecked - use primary color
                    document.body.style.backgroundImage = 'none';
                    document.body.style.background = updated.primary_color;
                  }
                }, 0);
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
                    const response = await fetch('/api/deleteBackground', {
                      method: 'DELETE',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-wallet-address': userAddress.toLowerCase()
                      },
                      body: JSON.stringify({
                        artistId: artistConfig.id || artistConfig.name.toLowerCase()
                      })
                    });

                    if (response.ok) {
                      // Clear preview and state
                      if (backgroundPreview.startsWith('blob:')) {
                        URL.revokeObjectURL(backgroundPreview);
                      }
                      setBackgroundPreview(null);
                      setBackgroundFile(null);
                      setFormData(prev => ({
                        ...prev,
                        background_image_url: null,
                        background_use_image: false
                      }));
                      
                      // Revert background if it was being used
                      setTimeout(() => {
                        if (formData.logo_use_background && logoPreview) {
                          document.body.style.backgroundImage = `url(${logoPreview})`;
                        } else {
                          document.body.style.backgroundImage = 'none';
                          document.body.style.background = formData.primary_color;
                        }
                        document.body.style.backgroundSize = 'cover';
                        document.body.style.backgroundPosition = 'center';
                        document.body.style.backgroundRepeat = 'no-repeat';
                      }, 0);
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
                // Apply live preview with updated values
                setTimeout(() => {
                  if (checked && backgroundPreview) {
                    // Background checked - use background image (takes precedence)
                    document.body.style.backgroundImage = `url(${backgroundPreview})`;
                    document.body.style.backgroundSize = 'cover';
                    document.body.style.backgroundPosition = 'center';
                    document.body.style.backgroundRepeat = 'no-repeat';
                  } else if (!checked && updated.logo_use_background && logoPreview) {
                    // Background unchecked, but logo is checked - use logo
                    document.body.style.backgroundImage = `url(${logoPreview})`;
                    document.body.style.backgroundSize = 'cover';
                    document.body.style.backgroundPosition = 'center';
                    document.body.style.backgroundRepeat = 'no-repeat';
                  } else {
                    // Both unchecked - use primary color
                    document.body.style.backgroundImage = 'none';
                    document.body.style.background = updated.primary_color;
                  }
                }, 0);
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
        <div className="grid grid-cols-3 gap-3 mb-4">
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
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-bold hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
        >
          {isSaving ? 'Saving Profile...' : '💾 SAVE PROFILE'}
        </button>
        <button
          onClick={handleCancel}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ProfileEditPanel;

