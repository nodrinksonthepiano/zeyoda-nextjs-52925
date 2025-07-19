'use client'

import React from 'react';
import { useCommandSystem } from '../hooks/useCommandSystem';
import { useGlobalChat } from '../contexts/GlobalChatContext';
import { useWallet } from './MagicProvider';
import { useToast } from '../contexts/ToastContext';
import useArtistConfig from '../hooks/useArtistConfig';
import { useSearchParams } from 'next/navigation';

interface ChatBarProps {
  // Props for non-authenticated state (main page login)
  email?: string;
  setEmail?: (email: string) => void;
  login?: () => void;
  shakeActive?: boolean;
  // Props for wizard mode
  wizardInputHandler?: (input: string) => void;
  // Props for assets panel state management (FIXED: lifted to parent)
  showAssetsPanel?: boolean;
  setShowAssetsPanel?: (show: boolean) => void;
}

export default function ChatBar({ 
  email = '', 
  setEmail, 
  login, 
  shakeActive = false,
  wizardInputHandler,
  showAssetsPanel = false,
  setShowAssetsPanel 
}: ChatBarProps) {
  const { user } = useWallet();
  const { showToast } = useToast();
  const { artistConfig } = useArtistConfig();
  const { state: globalChatState } = useGlobalChat();
  const searchParams = useSearchParams();
  const artistIdFromUrl = (searchParams.get('artist') ?? 'gosheesh') as string;

  // Use command system with lifted setShowAssetsPanel prop
  const {
    input: commandInput,
    onChange: handleCommandInputChange,
    onSubmit: handleCommandSubmit,
  } = useCommandSystem(
    wizardInputHandler ? 'wizard' : artistIdFromUrl,
    user || null,
    artistConfig,
    showToast,
    setShowAssetsPanel || (() => {}), // Fallback function if not provided
    wizardInputHandler
  );

  // For wizard mode, render full chat interface with messages
  if (wizardInputHandler) {
    console.log('ChatBar: Rendering wizard mode with', globalChatState.messages.length, 'messages');
    return (
      <div className="bg-black bg-opacity-80 backdrop-blur-sm border-t border-gray-600 min-h-[200px]">
        {/* Chat Messages */}
        <div className="max-h-64 overflow-y-auto p-4 space-y-3">
          {globalChatState.messages.length > 0 ? (
            globalChatState.messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-lg p-3 rounded-lg ${
                  message.type === 'bot' 
                    ? 'bg-blue-900 bg-opacity-50 border border-blue-600' 
                    : 'bg-gray-700 border border-gray-600'
                }`}>
                  <div className="text-white">{message.content}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-400 py-4">
              <div className="text-lg mb-2">🎨 Loading Artist Onboarding...</div>
              <div className="text-sm">Setting up your creative workspace</div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center max-w-4xl mx-auto">
            <input
              type="text"
              value={commandInput}
              onChange={handleCommandInputChange}
              placeholder="Type your response..."
              className="flex-grow p-3 border border-gray-600 rounded-l-lg bg-gray-900 bg-opacity-70 text-white focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCommandSubmit();
                }
              }}
              aria-label="Wizard input"
            />
            <button
              onClick={handleCommandSubmit}
              className="p-3 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              Send
            </button>
          </div>
          <div className="text-center text-xs text-gray-400 mt-2">
            ✨ Your profile updates in real-time as you make changes
          </div>
        </div>
      </div>
    );
  }

  // For main page, render just the input
  console.log('ChatBar: Rendering main page mode');
  return (
    <div 
      className={`unified-input-container mock-ui-section p-4 border-t-2 border-gray-700 mt-8 ${!user && shakeActive ? 'shake' : ''}`}
    >
      {user && (
        <h3 className="text-xl font-semibold mb-3 text-center">Chat / Command</h3>
      )}
      <div className="flex items-center max-w-xl mx-auto">
        <input
          type={user ? "text" : "email"}
          value={user ? commandInput : email}
          onChange={user ? handleCommandInputChange : (e) => setEmail?.(e.target.value)}
          placeholder={
            user 
              ? "Type command, search, or safeword..." 
              : "Enter your email address to continue"
          }
          className="flex-grow p-3 border border-gray-600 rounded-l-lg bg-gray-900 bg-opacity-70 text-white focus:ring-accentColor focus:border-accentColor backdrop-blur-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (!user) {
                login?.();
              } else {
                handleCommandSubmit();
              }
            }
          }}
          aria-label={user ? "Chat or command input" : "Email address input"}
        />
        <button
          onClick={() => {
            if (!user) {
              login?.();
            } else {
              handleCommandSubmit();
            }
          }}
          className="p-3 bg-accentColor text-white rounded-r-lg hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-accentColor focus:ring-opacity-50"
        >
          {user ? "Send" : "Continue"}
        </button>
      </div>
    </div>
  );
} 