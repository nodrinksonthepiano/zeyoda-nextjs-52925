'use client'

import React, { useState, useRef } from 'react';
import { COLOR_PRESETS, useChatWizard, WizardStep } from '../../contexts/ChatWizardContext';

interface ColorPaletteProps {
  colorType: 'primary' | 'accent';
  currentColor?: string;
  onColorSelect: (color: string) => void;
}

export function ColorPalette({ colorType, currentColor, onColorSelect }: ColorPaletteProps) {
  const { updateData, addMessage, nextStep, state } = useChatWizard();
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [tempColor, setTempColor] = useState(currentColor || '#000000');
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handlePresetSelection = (preset: typeof COLOR_PRESETS[0]) => {
    const color = colorType === 'primary' ? preset.primary : preset.accent;
    handleColorSelection(color, preset.name);
  };

  // Custom color handler - just updates preview, doesn't confirm
  const handleCustomColorChange = (color: string) => {
    setTempColor(color);
    
    // Update preview immediately
    const updateKey = colorType === 'primary' ? 'primaryColor' : 'accentColor';
    updateData({ [updateKey]: color });
    
    if (colorType === 'primary') {
      document.documentElement.style.setProperty('--primary-color', color);
    } else {
      document.documentElement.style.setProperty('--accent-color', color);
    }
  };

  const handleCustomColorConfirm = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    handleColorSelection(tempColor, 'Custom Color');
  };

  const handleColorSelection = (color: string, colorName: string) => {
    // Update wizard data
    const updateKey = colorType === 'primary' ? 'primaryColor' : 'accentColor';
    updateData({ [updateKey]: color });
    
    // Apply color immediately for real-time preview
    if (colorType === 'primary') {
      document.documentElement.style.setProperty('--primary-color', color);
    } else {
      document.documentElement.style.setProperty('--accent-color', color);
    }
    
    // Add user response message
    addMessage({
      type: 'user',
      content: `Selected ${colorType} color: ${colorName} (${color})`
    });
    
    // Call the callback
    onColorSelect(color);
    
    // Move to next step after short delay
    setTimeout(() => {
      nextStep();
    }, 500);
  };

  return (
    <div className="wizard-color-palette p-4 bg-gray-800 bg-opacity-70 rounded-lg mt-3 max-w-2xl">
      <h4 className="text-white text-sm font-medium mb-3">
        Choose your {colorType} color:
      </h4>
      
      {/* Preset Colors */}
      <div className="mb-4">
        <div className="text-gray-300 text-xs mb-2">Preset Themes:</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {COLOR_PRESETS.map((preset) => {
            const presetColor = colorType === 'primary' ? preset.primary : preset.accent;
            const isSelected = currentColor === presetColor;
            
            return (
              <button
                key={preset.name}
                onClick={() => handlePresetSelection(preset)}
                className={`relative p-3 rounded-lg border-2 transition-all duration-200 ${
                  isSelected 
                    ? 'border-white scale-105' 
                    : 'border-gray-600 hover:border-gray-400'
                }`}
                style={{ 
                  backgroundColor: presetColor,
                  boxShadow: isSelected ? `0 0 20px ${presetColor}50` : 'none'
                }}
              >
                <div className="text-white text-xs font-medium text-center drop-shadow-lg">
                  {preset.name}
                </div>
                <div className="text-white text-xs text-center mt-1 opacity-80">
                  {presetColor}
                </div>
                {isSelected && (
                  <div className="absolute -top-1 -right-1 text-white bg-blue-500 rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Color Picker */}
      <div className="border-t border-gray-600 pt-3">
        <button
          onClick={() => setShowCustomPicker(!showCustomPicker)}
          className="text-gray-300 text-xs hover:text-white transition-colors mb-2"
        >
          {showCustomPicker ? '▼' : '▶'} Custom Color
        </button>
        
        {showCustomPicker && (
          <div className="flex items-center space-x-3">
            <input
              type="color"
              value={tempColor || currentColor || '#000000'}
              onChange={(e) => handleCustomColorChange(e.target.value)}
              className="w-12 h-12 border-2 border-gray-600 rounded-lg cursor-pointer bg-transparent"
              title="Pick a custom color"
            />
            <button
              onClick={handleCustomColorConfirm}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
            >
              Confirm
            </button>
            <div className="text-gray-300 text-sm">
              Pick any color you like
            </div>
          </div>
        )}
      </div>

      {/* Current Selection Display */}
      {currentColor && (
        <div className="mt-3 flex items-center space-x-2 text-xs text-gray-300">
          <div 
            className="w-4 h-4 rounded border border-gray-500"
            style={{ backgroundColor: currentColor }}
          ></div>
          <span>Current: {currentColor}</span>
        </div>
      )}
    </div>
  );
} 