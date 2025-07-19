'use client'

import React, { useState, useEffect } from 'react';
import { useChatWizard } from '../../contexts/ChatWizardContext';

interface TokenSymbolInputProps {
  onSymbolConfirm: (symbol: string) => void;
  currentSymbol: string;
}

export function TokenSymbolInput({ onSymbolConfirm, currentSymbol }: TokenSymbolInputProps) {
  const { updateData, addMessage, nextStep } = useChatWizard();
  const [symbol, setSymbol] = useState(currentSymbol);
  const [isValidating, setIsValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [isValid, setIsValid] = useState(false);

  const validateSymbol = async (inputSymbol: string) => {
    if (!inputSymbol) {
      setValidationMessage('');
      setIsValid(false);
      return;
    }

    const formatted = inputSymbol.toUpperCase().replace(/[^A-Z]/g, '');
    
    // Length validation
    if (formatted.length < 3) {
      setValidationMessage('Symbol must be at least 3 letters');
      setIsValid(false);
      return;
    }
    
    if (formatted.length > 11) {
      setValidationMessage('Symbol must be 11 letters or less');
      setIsValid(false);
      return;
    }

    // Format validation
    if (!/^[A-Z]{3,11}$/.test(formatted)) {
      setValidationMessage('Symbol must contain only uppercase letters');
      setIsValid(false);
      return;
    }

    setIsValidating(true);
    
    try {
      // Check for duplicates (simulate API call for now)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // TODO: Replace with actual Supabase check
      const existingSymbols = ['GSH', 'JAIT', 'GOSH33SH', 'JAIT33']; // Mock data
      
      if (existingSymbols.includes(formatted)) {
        setValidationMessage('This symbol is already taken');
        setIsValid(false);
      } else {
        setValidationMessage('✓ Available');
        setIsValid(true);
      }
    } catch (error) {
      setValidationMessage('Error checking availability');
      setIsValid(false);
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    if (symbol) {
      const timeoutId = setTimeout(() => {
        validateSymbol(symbol);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [symbol]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
    setSymbol(value);
  };

  const handleConfirm = () => {
    if (!isValid || !symbol) return;

    updateData({ tokenSymbol: symbol });
    
    addMessage({
      type: 'user',
      content: `Token symbol: ${symbol}`
    });

    onSymbolConfirm(symbol);

    setTimeout(() => {
      nextStep();
    }, 500);
  };

  const getValidationColor = () => {
    if (isValidating) return 'text-yellow-400';
    if (isValid) return 'text-green-400';
    if (validationMessage && !isValid) return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <div className="wizard-token-symbol p-4 bg-gray-800 bg-opacity-70 rounded-lg mt-3 max-w-md">
      <h4 className="text-white text-sm font-medium mb-3">Enter your token symbol:</h4>
      
      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={symbol}
            onChange={handleInputChange}
            placeholder="e.g., GSH, ARTIST..."
            maxLength={11}
            className="w-full p-3 text-lg font-mono bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 uppercase tracking-wider"
          />
          
          {/* Character count */}
          <div className="absolute right-3 top-3 text-xs text-gray-400">
            {symbol.length}/11
          </div>
        </div>

        {/* Validation message */}
        {(validationMessage || isValidating) && (
          <div className={`text-xs ${getValidationColor()} flex items-center`}>
            {isValidating && (
              <div className="animate-spin w-3 h-3 border border-current border-t-transparent rounded-full mr-2"></div>
            )}
            {isValidating ? 'Checking availability...' : validationMessage}
          </div>
        )}

        {/* Guidelines */}
        <div className="text-xs text-gray-400 space-y-1">
          <div>Guidelines:</div>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>3-11 uppercase letters only</li>
            <li>No numbers or special characters</li>
            <li>Must be unique across all artists</li>
          </ul>
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={!isValid || isValidating}
          className={`w-full py-3 rounded-lg font-medium transition-colors ${
            isValid && !isValidating
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isValidating ? 'Validating...' : isValid ? `Confirm "${symbol}"` : 'Enter valid symbol'}
        </button>
      </div>
    </div>
  );
} 