import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArtistConfig } from '../../types/artist-types';
import { 
  loadUnlockedStates, 
  saveUnlockedStates, 
  hasAnyUnlockedArtist 
} from '../utils/safewordStorage';

export interface CommandSystemHookReturn {
  input: string;
  globalSafewordVerified: boolean;
  unlockedArtistStates: { [key: string]: boolean };
  safewordVerified: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  clearInput: () => void;
  updateUnlockedStates: (states: { [key: string]: boolean }) => void;
  setGlobalVerified: (verified: boolean) => void;
}

export const useCommandSystem = (
  artistIdFromUrl: string,
  user: string | null,
  artistConfig: ArtistConfig | null,
  showToast: (message: string, type?: "error" | "success" | "info" | undefined) => void,
  setShowAssetsPanel: (show: boolean) => void,
  setAppMode?: (mode: 'normal' | 'onboarding') => void,
  setOnboardingArtistName?: (name: string) => void
): CommandSystemHookReturn => {
  const router = useRouter();
  
  // State management
  const [safewordInput, setSafewordInput] = useState('');
  const [safewordVerified, setSafewordVerified] = useState(false);
  const [globalSafewordVerified, setGlobalSafewordVerified] = useState(false);
  const [unlockedArtistStates, setUnlockedArtistStates] = useState<{ [key: string]: boolean }>({});

  // Load unlocked states when user changes or on mount
  useEffect(() => {
    const initialUnlockedStates = loadUnlockedStates(user);
    const anyArtistUnlocked = hasAnyUnlockedArtist(user);
    
    setUnlockedArtistStates(initialUnlockedStates);
    setGlobalSafewordVerified(anyArtistUnlocked);
  }, [user]);

  // Auto-submit handler
  const handleSafewordAutosubmit = useCallback(() => {
    const currentArtistId = artistIdFromUrl;

    if (user && artistConfig && safewordInput.trim().toLowerCase() === 'artistocks') {
      setSafewordVerified(true);
      const newUnlockedStates = { ...unlockedArtistStates, [currentArtistId]: true };
      setUnlockedArtistStates(newUnlockedStates);
      setGlobalSafewordVerified(true);
      saveUnlockedStates(user, newUnlockedStates);
      
      showToast(`Artist "${artistConfig.displayName}" unlocked!`, 'success');
      setSafewordInput('');
    }
  }, [safewordInput, user, artistConfig, artistIdFromUrl, unlockedArtistStates, showToast]);

  // Auto-submit effect
  useEffect(() => {
    handleSafewordAutosubmit();
  }, [handleSafewordAutosubmit]);

  // Input change handler with auto-trigger for zeyoda
  const handleSafewordInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSafewordInput(newValue);
    
    // Auto-trigger when "zeyoda" is typed (treasure discovery!)
    if (newValue.toLowerCase() === 'zeyoda') {
      if (setAppMode) {
        setAppMode('onboarding');
        if (setOnboardingArtistName) {
          setOnboardingArtistName('WELCOME, ARTIST!');
        }
        showToast('🎉 Treasure discovered! Welcome to artist creation!', 'success');
        setSafewordInput(''); // Clear input after trigger
      }
    }
  }, [setAppMode, setOnboardingArtistName, showToast]);

  // Submit handler
  const handleSafewordSubmit = useCallback(() => {
    const input = safewordInput.trim().toLowerCase();
    if (!input) return;

    if (input === 'zeyoda') {
      if (setAppMode) {
        setAppMode('onboarding');
        if (setOnboardingArtistName) {
          setOnboardingArtistName('WELCOME, ARTIST!');
        }
        showToast('Onboarding mode activated! Start typing your artist name.', 'success');
      } else {
        router.push('/create');
      }
      setSafewordInput('');
      return;
    }
    
    if (input === '/wallet' || input === '/portfolio') {
      setShowAssetsPanel(true);
      setSafewordInput('');
      return;
    }
    
    if (input === '/exit' || input === '/close') {
      setShowAssetsPanel(false);
      setSafewordInput('');
      return;
    }

    const correctSafeword = "artistocks";
    if (input === correctSafeword) {
      setSafewordVerified(true);
      const newUnlockedStates = { ...unlockedArtistStates, [artistIdFromUrl]: true };
      setUnlockedArtistStates(newUnlockedStates);
      setGlobalSafewordVerified(true);
      saveUnlockedStates(user, newUnlockedStates);
      setSafewordInput('');
      return;
    }

    showToast(`Command not recognized: "${safewordInput}"`, 'error');
    setSafewordInput('');
  }, [safewordInput, router, setShowAssetsPanel, unlockedArtistStates, artistIdFromUrl, showToast]);

  // Clear input handler
  const clearInput = useCallback(() => {
    setSafewordInput('');
  }, []);

  // Update unlocked states (for external updates)
  const updateUnlockedStates = useCallback((states: { [key: string]: boolean }) => {
    setUnlockedArtistStates(states);
    saveUnlockedStates(user, states);
    
    // Update global verification
    const anyArtistUnlocked = hasAnyUnlockedArtist(user);
    setGlobalSafewordVerified(anyArtistUnlocked);
  }, [user]);

  // Set global verified (for external updates)
  const setGlobalVerified = useCallback((verified: boolean) => {
    setGlobalSafewordVerified(verified);
  }, []);

  // Clear local safeword input when user changes
  useEffect(() => {
    setSafewordVerified(false);
    setSafewordInput('');
  }, [user]);

  // Reset safeword verified when artist changes
  useEffect(() => {
    setSafewordVerified(false);
  }, [artistIdFromUrl]);

  return {
    input: safewordInput,
    globalSafewordVerified,
    unlockedArtistStates,
    safewordVerified,
    onChange: handleSafewordInputChange,
    onSubmit: handleSafewordSubmit,
    clearInput,
    updateUnlockedStates,
    setGlobalVerified
  };
}; 