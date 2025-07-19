'use client'

import React, { useState } from 'react';
import { WizardData, useChatWizard } from '../../contexts/ChatWizardContext';

interface ConfirmationStepProps {
  wizardData: WizardData;
  onConfirm: () => void;
}

export function ConfirmationStep({ wizardData, onConfirm }: ConfirmationStepProps) {
  const { addMessage, nextStep } = useChatWizard();
  const [isCreating, setIsCreating] = useState(false);

  const handleConfirm = async () => {
    setIsCreating(true);
    
    addMessage({
      type: 'user',
      content: 'Yes, create my artist profile and mint tokens!'
    });

    try {
      // TODO: Call the actual onboarding API
      onConfirm();
      
      // Simulate creation process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      addMessage({
        type: 'bot',
        content: '🎉 Success! Your artist profile has been created and tokens have been minted. Welcome to Zeyoda!'
      });

      setTimeout(() => {
        nextStep();
      }, 500);
      
    } catch (error) {
      addMessage({
        type: 'bot',
        content: '❌ There was an error creating your profile. Please try again.'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = () => {
    addMessage({
      type: 'user',
      content: 'Let me make some changes'
    });
    // TODO: Add functionality to go back to previous steps
  };

  return (
    <div className="wizard-confirmation p-4 bg-gray-800 bg-opacity-70 rounded-lg mt-3 max-w-2xl">
      <h4 className="text-white text-lg font-medium mb-4">🎨 Review Your Artist Profile</h4>
      
      <div className="space-y-4">
        {/* Basic Info */}
        <div className="bg-gray-700 rounded-lg p-4">
          <h5 className="text-white font-medium mb-2">Artist Identity</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">Name:</span>
              <span className="text-white font-medium">{wizardData.artistName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Font:</span>
              <span className="text-white" style={{ fontFamily: wizardData.fontFamily }}>
                {wizardData.fontFamily}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Primary Color:</span>
              <div className="flex items-center space-x-2">
                <div 
                  className="w-4 h-4 rounded border border-gray-500"
                  style={{ backgroundColor: wizardData.primaryColor }}
                ></div>
                <span className="text-white">{wizardData.primaryColor}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Accent Color:</span>
              <div className="flex items-center space-x-2">
                <div 
                  className="w-4 h-4 rounded border border-gray-500"
                  style={{ backgroundColor: wizardData.accentColor }}
                ></div>
                <span className="text-white">{wizardData.accentColor}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Artwork Info */}
        <div className="bg-gray-700 rounded-lg p-4">
          <h5 className="text-white font-medium mb-2">Featured Artwork</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">Title:</span>
              <span className="text-white">{wizardData.artworkTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Year:</span>
              <span className="text-white">{wizardData.artworkYear}</span>
            </div>
          </div>
        </div>

        {/* Media Files */}
        {wizardData.mediaFiles.length > 0 && (
          <div className="bg-gray-700 rounded-lg p-4">
            <h5 className="text-white font-medium mb-2">Media Files ({wizardData.mediaFiles.length})</h5>
            <div className="space-y-2">
              {wizardData.mediaFiles.slice(0, 3).map((file, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="text-gray-300 truncate">{file.title}</span>
                  <span className="text-white text-xs">{file.year}</span>
                </div>
              ))}
              {wizardData.mediaFiles.length > 3 && (
                <div className="text-xs text-gray-400">
                  +{wizardData.mediaFiles.length - 3} more files...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Token Info */}
        <div className="bg-gray-700 rounded-lg p-4">
          <h5 className="text-white font-medium mb-2">Token Details</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">Symbol:</span>
              <span className="text-white font-mono">{wizardData.tokenSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Total Supply:</span>
              <span className="text-white">10,000,000,000 tokens</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Your Allocation:</span>
              <span className="text-white">1,000,000,000 tokens (10%)</span>
            </div>
          </div>
        </div>

        {/* What Happens Next */}
        <div className="bg-blue-900 bg-opacity-30 border border-blue-600 rounded-lg p-4">
          <h5 className="text-blue-300 font-medium mb-2">🚀 What happens next:</h5>
          <ul className="text-sm text-blue-200 space-y-1">
            <li>• Deploy your ERC-20 token contract</li>
            <li>• Deploy your ERC-1155 downloads contract</li>
            <li>• Create your artist profile page</li>
            <li>• Upload your media files</li>
            <li>• Make your tokens available for purchase</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handleEdit}
            disabled={isCreating}
            className="flex-1 py-3 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-500 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Make Changes
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={isCreating}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              isCreating
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isCreating ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin w-4 h-4 border border-current border-t-transparent rounded-full mr-2"></div>
                Creating...
              </div>
            ) : (
              'Create Artist Profile'
            )}
          </button>
        </div>

        {/* Warning */}
        <div className="text-xs text-gray-400 text-center">
          ⚠️ This will deploy smart contracts on Base Sepolia testnet. The process may take a few minutes.
        </div>
      </div>
    </div>
  );
} 