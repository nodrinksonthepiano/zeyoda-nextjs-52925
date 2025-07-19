'use client';

import { useContext } from 'react';
import {
  ChatWizardContext,
} from '../contexts/ChatWizardContext';

export const useChatWizard = () => {
  const context = useContext(ChatWizardContext);
  if (context === undefined) {
    throw new Error('useChatWizard must be used within a ChatWizardProvider');
  }
  return context;
}; 