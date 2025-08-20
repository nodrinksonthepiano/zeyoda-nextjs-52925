import React, { useState, useCallback } from 'react';

interface OnboardingPanelProps {
  artistName: string;
  onArtistNameChange: (name: string) => void;
  onSave: (data: any) => void;
  onExit: () => void;
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
  { name: "Inter", value: "Inter, sans-serif" }
];

const OnboardingPanel: React.FC<OnboardingPanelProps> = ({
  artistName,
  onArtistNameChange,
  onSave,
  onExit
}) => {
  const [formData, setFormData] = useState({
    displayname: '',
    tokenName: '',
    artworktitle: 'Featured Content #1',
    artworkyear: '2025',
    theme: {
      fontFamily: 'Bungee, cursive',
      primaryColor: '#FAF0E6',
      accentColor: '#B8860B',
      gradientStart: '#FAF0E6',
      gradientMiddle: '#FDF5E6',
      gradientEnd: '#F5F5DC'
    }
  });

  const handleFieldChange = useCallback((field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev };
      
      if (field === 'displayname') {
        updated.displayname = value;
        // Auto-generate token name
        updated.tokenName = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
        onArtistNameChange(value);
      } else if (field.startsWith('theme.')) {
        const themeField = field.replace('theme.', '');
        updated.theme = { ...updated.theme, [themeField]: value };
        
        // Apply live preview
        if (themeField === 'primaryColor') {
          document.body.style.background = value;
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
      } else {
        updated[field as keyof typeof updated] = value;
      }
      
      return updated;
    });
  }, [onArtistNameChange]);

  const applyColorPreset = useCallback((presetKey: string) => {
    const preset = COLOR_PRESETS[presetKey as keyof typeof COLOR_PRESETS];
    if (preset) {
      handleFieldChange('theme.primaryColor', preset.primary);
      handleFieldChange('theme.accentColor', preset.accent);
      handleFieldChange('theme.gradientStart', preset.primary);
      handleFieldChange('theme.gradientMiddle', preset.primary);
      handleFieldChange('theme.gradientEnd', preset.primary);
    }
  }, [handleFieldChange]);

  const handleSave = useCallback(() => {
    const completeData = {
      ...formData,
      id: formData.tokenName.toLowerCase(),
      videosrc: 'assets/placeholder.mp4', // Will be updated with actual upload
      orbitaltokens: [],
      paused: false
    };
    onSave(completeData);
  }, [formData, onSave]);

  return (
    <div className="onboarding-panel bg-gray-800 bg-opacity-90 rounded-lg p-6 mt-8 max-w-2xl mx-auto backdrop-blur-sm border border-gray-600" style={{
      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(51, 65, 85, 0.95) 100%)',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
    }}>
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Bungee, cursive', color: '#B8860B' }}>
          CREATE ARTIST
        </h2>
        <button
          onClick={onExit}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Artist Identity Section */}
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
            <div className="text-xs text-gray-400 mt-1">Max 8 characters</div>
          </div>
        </div>
      </div>

      {/* Typography Section */}
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
      </div>

      {/* Color Theme Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Color Theme</h3>
        <div className="grid grid-cols-4 gap-3 mb-4">
          {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyColorPreset(key)}
              className={`relative w-12 h-12 rounded-lg border-2 transition-all hover:scale-110 ${
                formData.theme.primaryColor === preset.primary
                  ? 'border-white'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: preset.primary }}
              title={preset.name}
            >
              {formData.theme.primaryColor === preset.primary && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
        
        {/* Custom Colors */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Primary (Background)</label>
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
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Accent (Text)</label>
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
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Featured Content</h3>
        <input
          type="text"
          value={formData.artworktitle}
          onChange={(e) => handleFieldChange('artworktitle', e.target.value)}
          placeholder="e.g., Cosmic Dreams #1"
          className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
        />
        <div className="text-xs text-gray-400 mt-1">Upload content using the drag & drop zone above</div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={!formData.displayname || !formData.tokenName}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-bold hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
        >
          🚀 CREATE ARTIST PAGE
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
          {formData.displayname && formData.tokenName ? 'Ready to launch!' : 'Fill in artist name and token symbol'}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPanel;
