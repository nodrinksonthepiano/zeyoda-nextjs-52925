import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArtistConfig } from '../../types/artist-types';
import { 
  loadUnlockedStates, 
  saveUnlockedStates, 
  hasAnyUnlockedArtist 
} from '../utils/safewordStorage';
import { useChatWizard, WizardStep } from '../contexts/ChatWizardContext';
import { useGlobalChat } from '../contexts/GlobalChatContext';

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
  isWizardActive: boolean;
}

export const useCommandSystem = (
  artistIdFromUrl: string,
  user: string | null,
  artistConfig: ArtistConfig | null,
  showToast: (message: string, type?: "error" | "success" | "info" | undefined) => void,
  setShowAssetsPanel: (show: boolean) => void,
  wizardInputHandler?: (input: string) => void // Optional wizard input handler
): CommandSystemHookReturn => {
  const router = useRouter();
  const { wizardState, startWizard } = useChatWizard();
  const { addMessage: addGlobalMessage, setActive: setGlobalChatActive } = useGlobalChat();
  
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
    const input = safewordInput.trim().toLowerCase();

    // Handle zeyoda safeword (auto-trigger wizard with flash transition)
    if (user && input === 'zeyoda') {
      startWizard();
      setSafewordInput('');
      return;
    }
  }, [safewordInput, user, router, startWizard]);

  // Auto-submit effect
  useEffect(() => {
    handleSafewordAutosubmit();
  }, [handleSafewordAutosubmit]);

  // Input change handler
  const handleSafewordInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSafewordInput(e.target.value);
  }, []);

  // Submit handler
  const handleSafewordSubmit = useCallback(() => {
    const input = safewordInput.trim();
    if (!input) return;

    // Handle wizard mode inputs
    if (artistIdFromUrl === 'wizard') {
      if (wizardInputHandler) {
        // Add user message to global chat
        addGlobalMessage({
          type: 'user',
          content: input
        });
        
        // Delegate to wizard-specific handler
        wizardInputHandler(input);
      } else {
        showToast(`Wizard input received: "${input}" - Step: ${wizardState.currentStep}`, 'info');
      }
      setSafewordInput('');
      return;
    }

    const inputLower = input.toLowerCase();

    if (inputLower === 'zeyoda') {
      // Add user message to global chat
      addGlobalMessage({
        type: 'user',
        content: 'zeyoda'
      });
      
      // Add bot transition message  
      addGlobalMessage({
        type: 'bot',
        content: '✨ Launching artist onboarding wizard...'
      });
      
      // Activate global chat and start wizard (no redirect)
      setGlobalChatActive(true);
      startWizard();
      setSafewordInput('');
      return;
    }
    
    if (inputLower === '/wallet' || inputLower === '/portfolio') {
      setShowAssetsPanel(true);
      setSafewordInput('');
      return;
    }
    
    if (inputLower === '/exit' || inputLower === '/close') {
      setShowAssetsPanel(false);
      setSafewordInput('');
      return;
    }

    const correctSafeword = "artistocks";
    if (inputLower === correctSafeword) {
      setSafewordVerified(true);
      const newUnlockedStates = { ...unlockedArtistStates, [artistIdFromUrl]: true };
      setUnlockedArtistStates(newUnlockedStates);
      setGlobalSafewordVerified(true);
      saveUnlockedStates(user, newUnlockedStates);
      
      // Also show the assets panel (swap UI)
      setShowAssetsPanel(true);
      
      setSafewordInput('');
      return;
    }

    showToast(`Command not recognized: "${safewordInput}"`, 'error');
    setSafewordInput('');
  }, [safewordInput, artistIdFromUrl, router, setShowAssetsPanel, unlockedArtistStates, showToast, startWizard, wizardState, addGlobalMessage, setGlobalChatActive, wizardInputHandler]);

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
    setGlobalVerified,
    isWizardActive: wizardState.isActive
  };
};

export default useCommandSystem; 