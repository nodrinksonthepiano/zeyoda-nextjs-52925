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
    gradient_end: artistConfig?.theme?.gradientEnd || '#B8860B'
  });

  const [originalTheme, setOriginalTheme] = useState(formData);
  const [isSaving, setIsSaving] = useState(false);

  // Store original theme on mount
  useEffect(() => {
    setOriginalTheme(formData);
  }, []);

  const handleFieldChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Apply live preview exactly like OnboardingPanel
    if (field === 'primary_color') {
      document.body.style.background = value;
    } else if (field === 'accent_color') {
      document.documentElement.style.setProperty('--accent-color', value);
      const headerElement = document.querySelector('h1');
      if (headerElement) {
        headerElement.style.color = value;
      }
    } else if (field === 'font_family') {
      document.body.style.fontFamily = value;
      const headerElement = document.querySelector('h1');
      if (headerElement) {
        headerElement.style.fontFamily = value;
      }
    }
  }, []);

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
          ...formData
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
    // Restore original theme exactly like OnboardingPanel would
    if (originalTheme.primary_color) {
      document.body.style.background = originalTheme.primary_color;
    }
    if (originalTheme.accent_color) {
      document.documentElement.style.setProperty('--accent-color', originalTheme.accent_color);
      const headerElement = document.querySelector('h1');
      if (headerElement) {
        headerElement.style.color = originalTheme.accent_color;
      }
    }
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

      {/* Typography Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Typography</h3>
        <div className="grid grid-cols-3 gap-3">
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
