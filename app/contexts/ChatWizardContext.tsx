'use client';

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';

// Define ChatMessage type directly to avoid circular dependencies
export interface ChatMessage {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
}

export enum WizardStep {
  IDLE = 'idle',
  ASK_ARTIST_NAME = 'ask_artist_name',
  ASK_BRAND_COLOR = 'ask_brand_color',
  ASK_ACCENT_COLOR = 'ask_accent_color',
  ASK_MEDIA_UPLOAD = 'ask_media_upload',
  CONFIRM_CREATION = 'confirm_creation',
  CREATING_PROFILE = 'creating_profile',
  COMPLETE = 'complete',
}

export interface WizardData {
  artistName: string;
  brandColor: string;
  accentColor: string;
  mediaFiles: File[];
  fontFamily: string;
  primaryColor: string;
  gradientStart: string;
  gradientMiddle: string;
  gradientEnd: string;
}

interface WizardState {
  isActive: boolean;
  currentStep: WizardStep;
  data: WizardData;
  messages: ChatMessage[];
}

const initialState: WizardState = {
  isActive: false,
  currentStep: WizardStep.IDLE,
  data: {
    artistName: '',
    brandColor: '#D2B48C',      // Tan canvas background
    accentColor: '#FFD700',     // Gold accent
    mediaFiles: [],
    fontFamily: 'Bungee',
    primaryColor: '#D2B48C',    // Tan canvas
    gradientStart: '#D2B48C',   // Tan canvas
    gradientMiddle: '#E6D3A3',  // Lighter tan
    gradientEnd: '#D2B48C',     // Tan canvas
  },
  messages: [],
};

type WizardAction =
  | { type: 'START_WIZARD' }
  | { type: 'SUBMIT_RESPONSE'; payload: Partial<WizardData> }
  | { type: 'NEXT_STEP' }
  | { type: 'ADD_MESSAGE'; payload: Omit<ChatMessage, 'id' | 'timestamp'> };

const wizardReducer = (state: WizardState, action: WizardAction): WizardState => {
  switch (action.type) {
    case 'START_WIZARD':
      return {
        ...initialState,
        isActive: true,
        currentStep: WizardStep.ASK_ARTIST_NAME,
        messages: [
          {
            id: '1',
            type: 'bot',
            content: 'Welcome to Zeyoda Artist Onboarding! What should we call your artist profile?',
            timestamp: new Date(),
          },
        ],
      };
    case 'ADD_MESSAGE':
        return {
            ...state,
            messages: [...state.messages, { ...action.payload, id: `${state.messages.length + 1}`, timestamp: new Date() }],
        };
    case 'NEXT_STEP':
        const nextStep = getNextStep(state.currentStep);
        return {
            ...state,
            currentStep: nextStep,
        };
    case 'SUBMIT_RESPONSE':
        return {
            ...state,
            data: { ...state.data, ...action.payload },
        };
    default:
      return state;
  }
};

const getNextStep = (currentStep: WizardStep): WizardStep => {
    const stepOrder = [
        WizardStep.ASK_ARTIST_NAME,
        WizardStep.ASK_BRAND_COLOR,
        WizardStep.ASK_ACCENT_COLOR,
        WizardStep.ASK_MEDIA_UPLOAD,
        WizardStep.CONFIRM_CREATION,
    ];
    const currentIndex = stepOrder.indexOf(currentStep);
    return stepOrder[currentIndex + 1] || WizardStep.COMPLETE;
}

export interface ChatWizardContextType {
  wizardState: WizardState;
  startWizard: () => void;
  submitResponse: (response: Partial<WizardData>) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  nextStep: () => void;
}

export const ChatWizardContext = createContext<ChatWizardContextType | undefined>(undefined);

export const ChatWizardProvider = ({ children }: { children: ReactNode }) => {
  const [wizardState, dispatch] = useReducer(wizardReducer, initialState);

  const startWizard = useCallback(() => dispatch({ type: 'START_WIZARD' }), []);
  const submitResponse = useCallback((payload: Partial<WizardData>) => dispatch({ type: 'SUBMIT_RESPONSE', payload }), []);
  const addMessage = useCallback((payload: Omit<ChatMessage, 'id' | 'timestamp'>) => dispatch({ type: 'ADD_MESSAGE', payload }), []);
  const nextStep = useCallback(() => dispatch({ type: 'NEXT_STEP' }), []);

  return (
    <ChatWizardContext.Provider value={{ wizardState, startWizard, submitResponse, addMessage, nextStep }}>
      {children}
    </ChatWizardContext.Provider>
  );
};

export const useChatWizard = () => {
  const context = useContext(ChatWizardContext);
  if (context === undefined) {
    throw new Error('useChatWizard must be used within a ChatWizardProvider');
  }
  return context;
}; 