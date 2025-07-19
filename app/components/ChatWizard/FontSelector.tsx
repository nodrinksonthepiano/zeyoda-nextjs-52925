'use client'

import React from 'react';
import { FONT_OPTIONS, useChatWizard } from '../../contexts/ChatWizardContext';

interface FontSelectorProps {
  onFontSelect: (fontFamily: string) => void;
  selectedFont?: string;
}

export function FontSelector({ onFontSelect, selectedFont }: FontSelectorProps) {
  const { updateData, addMessage, nextStep } = useChatWizard();

  const handleFontSelection = (fontFamily: string) => {
    // Update the wizard data
    updateData({ fontFamily });
    
    // Apply font immediately for real-time preview
    document.body.style.fontFamily = fontFamily;
    
    // Add user response message
    const selectedOption = FONT_OPTIONS.find(opt => opt.value === fontFamily);
    addMessage({
      type: 'user',
      content: `Selected: ${selectedOption?.label || fontFamily}`
    });
    
    // Call the callback
    onFontSelect(fontFamily);
    
    // Move to next step after short delay
    setTimeout(() => {
      nextStep();
    }, 500);
  };

  return (
    <div className="wizard-font-selector p-4 bg-gray-800 bg-opacity-70 rounded-lg mt-3 max-w-lg">
      <h4 className="text-white text-sm font-medium mb-3">Choose your artistic font:</h4>
      <div className="space-y-2">
        {FONT_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleFontSelection(option.value)}
            className={`w-full text-left p-3 rounded-md border transition-all duration-200 ${
              selectedFont === option.value
                ? 'border-blue-400 bg-blue-900 bg-opacity-30'
                : 'border-gray-600 bg-gray-700 bg-opacity-50 hover:border-gray-500 hover:bg-gray-600 hover:bg-opacity-50'
            }`}
            style={{ fontFamily: option.value }}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="text-white font-medium text-sm">{option.label}</div>
                <div 
                  className="text-gray-300 text-xs mt-1"
                  style={{ fontFamily: option.value }}
                >
                  {option.preview}
                </div>
              </div>
              {selectedFont === option.value && (
                <div className="text-blue-400 text-sm">✓</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
} 