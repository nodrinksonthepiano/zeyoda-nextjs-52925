import React, { useState, useCallback, useEffect } from 'react';

interface OnboardingPanelProps {
  artistName: string;
  onArtistNameChange: (name: string) => void;
  onSave: (data: any) => void;
  onExit: () => void;
  uploadedFile?: File | null;
  filePreviewUrl?: string | null;
  onUploadClick?: () => void;
  mode?: 'onboarding' | 'upload-asset';
  existingArtist?: any;
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
  "Oswald, sans-serif",
  "Pacifico, cursive",
  "Dancing Script, cursive"
];

// Local dropdown component reused for onboarding
const FontDropdownOnboarding: React.FC<{ onSelect: (font: string) => void; current?: string }> = ({ onSelect, current }) => {
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [fontSearch, setFontSearch] = useState('');

  return (
    <div className="relative">
      <input
        type="text"
        value={fontSearch}
        onChange={(e) => setFontSearch(e.target.value)}
        onFocus={() => setShowFontDropdown(true)}
        placeholder={current || "Search fonts... (e.g. Arial, Roboto, Times)"}
        className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm focus:border-yellow-500"
        style={{ fontFamily: current }}
      />

      {showFontDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded max-h-40 overflow-y-auto z-50">
          {COMMON_FONTS
            .filter(font => font.toLowerCase().includes(fontSearch.toLowerCase()))
            .map((font) => (
              <button
                key={font}
                onClick={() => {
                  onSelect(font);
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

      {/* Close dropdown when clicking outside */}
      {showFontDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowFontDropdown(false)}
        />
      )}
    </div>
  );
};

const OnboardingPanel: React.FC<OnboardingPanelProps> = ({
  artistName,
  onArtistNameChange,
  onSave,
  onExit,
  uploadedFile,
  filePreviewUrl,
  onUploadClick,
  mode = 'onboarding',
  existingArtist
}) => {
  const [formData, setFormData] = useState({
    displayname: mode === 'upload-asset' ? existingArtist?.name || '' : '',
    tokenName: mode === 'upload-asset' ? existingArtist?.tokenName || '' : '',
    artworktitle: mode === 'upload-asset' ? 'New Content' : 'Featured Content #1',
    artworkyear: '2025',
    downloadPrice: 1.00, // Price for ERC-1155 featured content downloads
    description: '', // Description for the asset
    logo_url: null as string | null,
    background_image_url: null as string | null,
    logo_use_background: false,
    background_use_image: false,
    theme: {
      fontFamily: 'Bungee, cursive',
      primaryColor: '#FAF0E6',
      accentColor: '#B8860B',
      gradientStart: '#FAF0E6',
      gradientMiddle: '#FDF5E6',
      gradientEnd: '#F5F5DC'
    }
  });

  // Logo and background file state (for upload after artist creation)
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);

  // Initialize halo with current primary color
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('primaryColorChange', { detail: { color: formData.theme.primaryColor } }));
  }, []);

  const handleFieldChange = useCallback((field: string, value: any) => {
    // Handle artist name change separately to avoid React render error
    if (field === 'displayname') {
      onArtistNameChange(value);
    }
    
    setFormData(prev => {
      const updated = { ...prev };
      
      if (field === 'displayname') {
        updated.displayname = value;
        // Auto-generate token name
        updated.tokenName = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
      } else if (field.startsWith('theme.')) {
        const themeField = field.replace('theme.', '');
        updated.theme = { ...updated.theme, [themeField]: value };
        
        // Apply live preview
        if (themeField === 'primaryColor') {
          // Apply primary color only if no background image/logo is active
          if (!formData.background_use_image && !formData.logo_use_background) {
            document.body.style.background = value;
            document.body.style.backgroundImage = 'none';
          }
          // Dispatch event to update halo
          window.dispatchEvent(new CustomEvent('primaryColorChange', { detail: { color: value } }));
        } else if (themeField === 'accentColor') {
          document.documentElement.style.setProperty('--accent-color', value);
          const headerElement = document.querySelector('h1');
          if (headerElement) {
            headerElement.style.color = value;
          }
        } else if (themeField === 'fontFamily') {
          document.body.style.fontFamily = value;
          const headerElement = document.querySelector('h1');
          if (headerElement) {
            headerElement.style.fontFamily = value;
          }
        }
      } else if (field === 'logo_use_background' || field === 'background_use_image') {
        // Handle logo/background checkboxes with mutual exclusivity
        const newValue = value as boolean;
        const otherFieldValue = field === 'background_use_image' 
          ? formData.logo_use_background 
          : formData.background_use_image;
        
        if (field === 'logo_use_background') {
          updated.logo_use_background = newValue;
          updated.background_use_image = newValue ? false : formData.background_use_image;
        } else {
          updated.background_use_image = newValue;
          updated.logo_use_background = newValue ? false : formData.logo_use_background;
        }
        
        // Apply live preview with precedence
        setTimeout(() => {
          if (field === 'background_use_image') {
            if (newValue && backgroundPreview) {
              document.body.style.backgroundImage = `url(${backgroundPreview})`;
              document.body.style.backgroundSize = 'cover';
              document.body.style.backgroundPosition = 'center';
              document.body.style.backgroundRepeat = 'no-repeat';
            } else if (otherFieldValue && logoPreview) {
              document.body.style.backgroundImage = `url(${logoPreview})`;
              document.body.style.backgroundSize = 'cover';
              document.body.style.backgroundPosition = 'center';
              document.body.style.backgroundRepeat = 'no-repeat';
            } else {
              document.body.style.backgroundImage = 'none';
              document.body.style.background = updated.theme.primaryColor;
            }
          } else if (field === 'logo_use_background') {
            if (otherFieldValue && backgroundPreview) {
              document.body.style.backgroundImage = `url(${backgroundPreview})`;
              document.body.style.backgroundSize = 'cover';
              document.body.style.backgroundPosition = 'center';
              document.body.style.backgroundRepeat = 'no-repeat';
            } else if (newValue && logoPreview) {
              document.body.style.backgroundImage = `url(${logoPreview})`;
              document.body.style.backgroundSize = 'cover';
              document.body.style.backgroundPosition = 'center';
              document.body.style.backgroundRepeat = 'no-repeat';
            } else {
              document.body.style.backgroundImage = 'none';
              document.body.style.background = updated.theme.primaryColor;
            }
          }
        }, 0);
      } else {
        (updated as any)[field] = value;
      }
      
      return updated;
    });
  }, [onArtistNameChange, formData.background_use_image, formData.logo_use_background, backgroundPreview, logoPreview]);

  const applyPrimaryPreset = useCallback((presetKey: string) => {
    const preset = COLOR_PRESETS[presetKey as keyof typeof COLOR_PRESETS];
    if (preset) {
      handleFieldChange('theme.primaryColor', preset.primary);
      handleFieldChange('theme.gradientStart', preset.primary);
      handleFieldChange('theme.gradientMiddle', preset.primary);
      handleFieldChange('theme.gradientEnd', preset.primary);
    }
  }, [handleFieldChange]);

  const applyAccentPreset = useCallback((presetKey: string) => {
    const preset = COLOR_PRESETS[presetKey as keyof typeof COLOR_PRESETS];
    if (preset) {
      handleFieldChange('theme.accentColor', preset.accent);
    }
  }, [handleFieldChange]);

  const handleSave = useCallback(() => {
    const completeData = {
      ...formData,
      id: formData.tokenName.toLowerCase(),
      name: formData.tokenName, // Required for Supabase
      videosrc: 'assets/placeholder.mp4', // Will be updated with actual upload
      orbitaltokens: [],
      paused: false,
      // Logo/background files (will be uploaded after artist creation)
      logoFile: logoFile,
      backgroundFile: backgroundFile,
      // Auto-generate missing fields
      contract: null, // Will be set after deployment
      swap_address: null, // Will be set after deployment  
      download_address: null // Will be set after deployment
    };
    
    console.log('Complete artist data for deployment:', completeData);
    onSave(completeData);
  }, [formData, logoFile, backgroundFile, onSave]);

  return (
    <div className="onboarding-panel bg-gray-800 bg-opacity-90 rounded-lg p-6 mt-8 max-w-2xl mx-auto backdrop-blur-sm border border-gray-600" style={{
      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(51, 65, 85, 0.95) 100%)',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
    }}>
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Bungee, cursive', color: mode === 'upload-asset' ? (existingArtist?.theme?.accentColor || '#B8860B') : '#B8860B' }}>
          {mode === 'upload-asset' ? 'UPLOAD NEW ASSET' : 'CREATE ARTIST'}
        </h2>
        <button
          onClick={onExit}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Artist Identity Section - Only show for new artists */}
      {mode === 'onboarding' && (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Artist Identity</h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Artist Name</label>
            <input
              type="text"
              value={formData.displayname}
              onChange={(e) => {
                const value = e.target.value;
                handleFieldChange('displayname', value);
                // Real-time header update
                onArtistNameChange(value || 'WELCOME, ARTIST!');
              }}
              placeholder="e.g., DJ Nova"
              className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Token Symbol</label>
            <input
              type="text"
              value={formData.tokenName}
              onChange={(e) => handleFieldChange('tokenName', e.target.value.toUpperCase().substring(0, 8))}
              placeholder="e.g., DJNOVA"
              maxLength={8}
              className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
            />
            <div className="text-xs text-gray-400 mt-1">Max 8 characters • ERC-20 token price set by market</div>
          </div>
        </div>
      </div>
      )}

      {/* Typography Section - Only show for new artists */}
      {mode === 'onboarding' && (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Typography</h3>
        <div className="grid grid-cols-3 gap-3">
          {FONT_OPTIONS.map((font) => (
            <button
              key={font.value}
              onClick={() => handleFieldChange('theme.fontFamily', font.value)}
              className={`p-3 rounded-lg border-2 transition-all ${
                formData.theme.fontFamily === font.value
                  ? 'border-yellow-500 bg-yellow-500 bg-opacity-20'
                  : 'border-gray-600 bg-gray-700 hover:border-gray-500'
              }`}
              style={{ fontFamily: font.value }}
            >
              <div className="text-white font-bold text-sm">{font.name}</div>
            </button>
          ))}
        </div>

        {/* Font Dropdown (same behavior as ProfileEditPanel) */}
        <div className="relative mt-4">
          <label className="block text-sm text-gray-300 mb-2">Or choose from common fonts:</label>
          <FontDropdownOnboarding
            current={formData.theme.fontFamily}
            onSelect={(font) => {
              handleFieldChange('theme.fontFamily', font);
            }}
          />
        </div>
      </div>
      )}

      {/* Primary Color Section - Only show for new artists */}
      {mode === 'onboarding' && (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Primary Color (Background)</h3>
        <div className="grid grid-cols-4 gap-3 mb-4">
          {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
            <button
              key={`primary-${key}`}
              onClick={() => applyPrimaryPreset(key)}
              className={`relative w-12 h-12 rounded-lg border-2 transition-all hover:scale-110 ${
                formData.theme.primaryColor === preset.primary
                  ? 'border-white'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: preset.primary }}
              title={`${preset.name} Primary`}
            >
              {formData.theme.primaryColor === preset.primary && (
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
            value={formData.theme.primaryColor}
            onChange={(e) => handleFieldChange('theme.primaryColor', e.target.value)}
            className="w-10 h-10 rounded border border-gray-600"
          />
          <input
            type="text"
            value={formData.theme.primaryColor}
            onChange={(e) => handleFieldChange('theme.primaryColor', e.target.value)}
            className="flex-1 p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
            placeholder="#RRGGBB"
          />
        </div>
      </div>
      )}

      {/* Accent Color Section - Only show for new artists */}
      {mode === 'onboarding' && (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Accent Color (Text/Highlights)</h3>
        <div className="grid grid-cols-4 gap-3 mb-4">
          {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
            <button
              key={`accent-${key}`}
              onClick={() => applyAccentPreset(key)}
              className={`relative w-12 h-12 rounded-lg border-2 transition-all hover:scale-110 ${
                formData.theme.accentColor === preset.accent
                  ? 'border-white'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: preset.accent }}
              title={`${preset.name} Accent`}
            >
              {formData.theme.accentColor === preset.accent && (
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
            value={formData.theme.accentColor}
            onChange={(e) => handleFieldChange('theme.accentColor', e.target.value)}
            className="w-10 h-10 rounded border border-gray-600"
          />
          <input
            type="text"
            value={formData.theme.accentColor}
            onChange={(e) => handleFieldChange('theme.accentColor', e.target.value)}
            className="flex-1 p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
            placeholder="#RRGGBB"
          />
        </div>
      </div>
      )}

      {/* Logo Upload Section - Only show for new artists */}
      {mode === 'onboarding' && (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Logo Upload</h3>
        
        {/* Current logo preview */}
        {logoPreview && (
          <div className="mb-3 relative">
            <button
              onClick={() => {
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
                // Revert background
                setTimeout(() => {
                  if (formData.background_use_image && backgroundPreview) {
                    document.body.style.backgroundImage = `url(${backgroundPreview})`;
                  } else {
                    document.body.style.backgroundImage = 'none';
                    document.body.style.background = formData.theme.primaryColor;
                  }
                  document.body.style.backgroundSize = 'cover';
                  document.body.style.backgroundPosition = 'center';
                  document.body.style.backgroundRepeat = 'no-repeat';
                }, 0);
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
          onChange={(e) => {
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
            // Revoke old preview URL
            if (logoPreview && logoPreview.startsWith('blob:')) {
              URL.revokeObjectURL(logoPreview);
            }
            const preview = URL.createObjectURL(file);
            setLogoPreview(preview);
            setFormData(prev => ({ ...prev, logo_url: preview }));
            
            // Apply if checkbox is checked
            if (formData.logo_use_background) {
              setTimeout(() => {
                document.body.style.backgroundImage = `url(${preview})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundRepeat = 'no-repeat';
              }, 0);
            }
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
              setFormData(prev => {
                const updated = {
                  ...prev,
                  logo_use_background: checked,
                  background_use_image: checked ? false : prev.background_use_image
                };
                // Apply live preview
                setTimeout(() => {
                  if (checked && logoPreview) {
                    document.body.style.backgroundImage = `url(${logoPreview})`;
                    document.body.style.backgroundSize = 'cover';
                    document.body.style.backgroundPosition = 'center';
                    document.body.style.backgroundRepeat = 'no-repeat';
                  } else if (!checked && updated.background_use_image && backgroundPreview) {
                    document.body.style.backgroundImage = `url(${backgroundPreview})`;
                    document.body.style.backgroundSize = 'cover';
                    document.body.style.backgroundPosition = 'center';
                    document.body.style.backgroundRepeat = 'no-repeat';
                  } else {
                    document.body.style.backgroundImage = 'none';
                    document.body.style.background = updated.theme.primaryColor;
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
      )}

      {/* Background Image Section - Only show for new artists */}
      {mode === 'onboarding' && (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Background Image</h3>
        
        {/* Current background preview */}
        {backgroundPreview && (
          <div className="mb-3 relative">
            <button
              onClick={() => {
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
                // Revert background
                setTimeout(() => {
                  if (formData.logo_use_background && logoPreview) {
                    document.body.style.backgroundImage = `url(${logoPreview})`;
                  } else {
                    document.body.style.backgroundImage = 'none';
                    document.body.style.background = formData.theme.primaryColor;
                  }
                  document.body.style.backgroundSize = 'cover';
                  document.body.style.backgroundPosition = 'center';
                  document.body.style.backgroundRepeat = 'no-repeat';
                }, 0);
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
          onChange={(e) => {
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
            // Revoke old preview URL
            if (backgroundPreview && backgroundPreview.startsWith('blob:')) {
              URL.revokeObjectURL(backgroundPreview);
            }
            const preview = URL.createObjectURL(file);
            setBackgroundPreview(preview);
            setFormData(prev => ({ ...prev, background_image_url: preview }));
            
            // Apply if checkbox is checked
            if (formData.background_use_image) {
              setTimeout(() => {
                document.body.style.backgroundImage = `url(${preview})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundRepeat = 'no-repeat';
              }, 0);
            }
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
              setFormData(prev => {
                const updated = {
                  ...prev,
                  background_use_image: checked,
                  logo_use_background: checked ? false : prev.logo_use_background
                };
                // Apply live preview
                setTimeout(() => {
                  if (checked && backgroundPreview) {
                    document.body.style.backgroundImage = `url(${backgroundPreview})`;
                    document.body.style.backgroundSize = 'cover';
                    document.body.style.backgroundPosition = 'center';
                    document.body.style.backgroundRepeat = 'no-repeat';
                  } else if (!checked && updated.logo_use_background && logoPreview) {
                    document.body.style.backgroundImage = `url(${logoPreview})`;
                    document.body.style.backgroundSize = 'cover';
                    document.body.style.backgroundPosition = 'center';
                    document.body.style.backgroundRepeat = 'no-repeat';
                  } else {
                    document.body.style.backgroundImage = 'none';
                    document.body.style.background = updated.theme.primaryColor;
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
      )}

      {/* Content Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Featured Content</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Content Title</label>
            <input
              type="text"
              value={formData.artworktitle}
              onChange={(e) => handleFieldChange('artworktitle', e.target.value)}
              placeholder="e.g., Cosmic Dreams #1"
              className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Download Price (USD)</label>
            
            {/* Editable price display */}
            <div className="mb-3 text-center">
              <div className="inline-flex items-center gap-1">
                <span className="text-lg text-gray-300">$</span>
                <input
                  type="number"
                  min="0.01"
                  max="999999999"
                  step="0.01"
                  value={formData.downloadPrice}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 1.00;
                    const clampedValue = Math.min(Math.max(value, 0.01), 999999999);
                    handleFieldChange('downloadPrice', clampedValue);
                  }}
                  className="text-xl font-bold text-white bg-gray-700 bg-opacity-50 border border-gray-600 text-center w-32 focus:outline-none focus:border-yellow-500 focus:bg-gray-600 rounded px-2 py-1 hover:bg-gray-600 hover:bg-opacity-50 transition-all"
                  style={{ fontFamily: 'inherit' }}
                  placeholder="1.00"
                />
                <span className="text-sm text-gray-400 ml-1">per download</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">Click to edit • Use slider for quick adjustment</div>
            </div>
            
            {/* Extended slider (up to $10,000) */}
            <input
              type="range"
              min="1"
              max="10000"
              step="1"
              value={Math.min(formData.downloadPrice, 10000)}
              onChange={(e) => handleFieldChange('downloadPrice', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            
            {/* Extended price range indicators */}
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>$1</span>
              <span>$100</span>
              <span>$1K</span>
              <span>$5K</span>
              <span>$10K+</span>
            </div>
          </div>
        </div>
        
        {/* Description field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description
            <span className="text-gray-500 text-xs ml-2">(optional - you can edit later)</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            placeholder="Tell collectors about this piece..."
            rows={3}
            maxLength={500}
            className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 resize-none"
          />
          <div className="text-xs text-gray-400 mt-1 text-right">
            {formData.description.length}/500 characters
          </div>
        </div>
        
        {/* Small upload preview in form */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">Upload Preview</label>
          {uploadedFile && filePreviewUrl ? (
            <div className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
              {/* Small thumbnail */}
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-500 flex-shrink-0">
                {uploadedFile.type.startsWith('image/') ? (
                  <img 
                    src={filePreviewUrl} 
                    alt={uploadedFile.name}
                    className="w-full h-full object-cover"
                  />
                ) : uploadedFile.type.startsWith('video/') ? (
                  <video 
                    src={filePreviewUrl} 
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-600 flex items-center justify-center">
                    <span className="text-2xl">
                      {uploadedFile.type.startsWith('audio/') ? '🎵' : '📁'}
                    </span>
                  </div>
                )}
              </div>
              
              {/* File info */}
              <div className="flex-1">
                <div className="text-white text-sm font-medium truncate">{uploadedFile.name}</div>
                <div className="text-gray-400 text-xs">
                  {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB • {uploadedFile.type}
                </div>
              </div>
              
              {/* Change button */}
              <button
                onClick={onUploadClick}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                Change
              </button>
            </div>
          ) : (
            <div 
              onClick={onUploadClick}
              className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-gray-500 transition-colors"
            >
              <div className="text-gray-400 text-sm">Click to upload or use drag & drop above</div>
            </div>
          )}
        </div>
        
        <div className="text-xs text-gray-400">
          Upload content using drag & drop above or form upload • Download price is for ERC-1155 collectibles
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={mode === 'onboarding' ? (!formData.displayname || !formData.tokenName) : (!formData.artworktitle || !uploadedFile)}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-bold hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
        >
          {mode === 'upload-asset' ? '📤 UPLOAD & MINT ASSET' : '🚀 CREATE ARTIST PAGE'}
        </button>
        <button
          onClick={onExit}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="mt-4 text-center">
        <div className="text-xs text-gray-400">
          {mode === 'upload-asset' ? (
            formData.artworktitle && uploadedFile ? (
              <span className="text-green-400">✓ Ready to upload! Download price: ${formData.downloadPrice}</span>
            ) : (
              'Add content title and upload file'
            )
          ) : (
            formData.displayname && formData.tokenName ? (
              <span className="text-green-400">✓ Ready to launch! Download price: ${formData.downloadPrice}</span>
            ) : (
              'Fill in artist name and token symbol'
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPanel;
